// Crawls the deployed site + queries Supabase for content-health signals,
// writes audit-report.json, and exits 1 when something needs a human.
//
// Read-only end to end: public anon key for Supabase (same one committed in
// supabase-client.js), plain GET for the live site. No secrets required —
// this can run in CI with zero repo secrets configured.
//
// Run: node scripts/audit-links.mjs   (writes ./audit-report.json)

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { TOPICS } from '../topics.config.mjs';
import { fetchAllRows } from '../lib/pagination.mjs';

const SITE_URL = 'https://knowledge.thirstyc.com';
const SUPABASE_URL = 'https://qcyzcjikyqnzvnvmfwtk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeXpjamlreXFuenZudm1md3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTc4NjIsImV4cCI6MjA5MjI5Mzg2Mn0.8Fp1wk_BxQ7NrEQRnMPKX6kdaz-0k7bNj94DN4cLP2U';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 1. Link crawl ----------------------------------------------------------
// GitHub Pages serves this repo's root 1:1, so the local *.html file list
// *is* the deployed page set — no need to discover pages by spidering.

function localHtmlFiles() {
  return readdirSync('.').filter((f) => f.endsWith('.html'));
}

function extractLocalRefs(html) {
  const refs = new Set();
  const attrRe = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = attrRe.exec(html))) {
    const ref = m[1];
    if (
      ref.startsWith('#') ||
      ref.startsWith('http') ||
      ref.startsWith('mailto:') ||
      ref.includes('${') // JS template literals caught by the same regex, not real hrefs
    ) {
      continue;
    }
    refs.add(ref.split('?')[0].split('#')[0]);
  }
  return refs;
}

async function crawlLinks() {
  const brokenLinks = [];
  const htmlFiles = localHtmlFiles();

  // 1a. Every local href/src must resolve to a file that actually exists.
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    for (const ref of extractLocalRefs(html)) {
      if (!existsSync(ref)) {
        brokenLinks.push({ type: 'missing_file', from: file, target: ref });
      }
    }
  }

  // 1b. Every file that's actually deployed must resolve live (catches
  // Pages cache lag, unpushed commits, or a file deleted but still linked).
  const deployed = [...htmlFiles, 'robots.txt', 'sitemap.xml', 'styles.css', 'supabase-client.js'];
  await Promise.all(
    deployed.map(async (path) => {
      if (!existsSync(path)) return; // covered by 1a already
      try {
        const res = await fetch(`${SITE_URL}/${path}`, { method: 'GET' });
        if (res.status !== 200) {
          brokenLinks.push({ type: 'live_status', target: path, status: res.status });
        }
      } catch (err) {
        brokenLinks.push({ type: 'fetch_error', target: path, error: err.message });
      }
    })
  );

  return brokenLinks;
}

// --- 2. Supabase content health ---------------------------------------------

async function chunkCounts() {
  const data = await fetchAllRows(() => supabase.from('knowledge_chunks').select('chunk_type'));
  const counts = {};
  for (const row of data) counts[row.chunk_type] = (counts[row.chunk_type] || 0) + 1;
  return counts;
}

async function missingData() {
  const missing = [];

  const { count: nullEmbedding, error: e1 } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null);
  if (e1) throw e1;
  if (nullEmbedding > 0) missing.push({ type: 'null_embedding', count: nullEmbedding });

  const { count: nullContent, error: e2 } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .or('content.is.null,content.eq.');
  if (e2) throw e2;
  if (nullContent > 0) missing.push({ type: 'null_content', count: nullContent });

  // Dangling wine_id: a chunk pointing at a wine row that no longer exists.
  // 0 rows use wine_id today, so this is a forward-looking integrity check,
  // not a current defect — kept separate from orphaned_chunks below because
  // it's a broken reference, not an unreachable-but-valid chunk.
  const linked = await fetchAllRows(() =>
    supabase.from('knowledge_chunks').select('id, wine_id').not('wine_id', 'is', null)
  );
  if (linked.length > 0) {
    const wineIds = [...new Set(linked.map((r) => r.wine_id))];
    const { data: existingWines, error: e4 } = await supabase
      .from('wines')
      .select('id')
      .in('id', wineIds);
    if (e4) throw e4;
    const existingSet = new Set((existingWines || []).map((w) => w.id));
    const dangling = linked.filter((r) => !existingSet.has(r.wine_id));
    if (dangling.length > 0) {
      missing.push({ type: 'dangling_wine_id', count: dangling.length, ids: dangling.map((r) => r.id) });
    }
  }

  return missing;
}

// "Orphaned" here means unreachable by either routing mechanism the site
// actually uses (a dedicated topic page, or the keyword fallback that same
// page's config defines) for chunk_type='grape'/'region'/'enology' — NOT
// "has no dedicated topic page", which is true for the large majority of
// the corpus by design (only 18 of ~190+ grape/region docs get one) and
// would make this check fire constantly on normal, expected state.
async function orphanedChunks() {
  const data = await fetchAllRows(() =>
    supabase
      .from('knowledge_chunks')
      .select('id, source_doc, content, section_title, chunk_type')
      .in('chunk_type', ['grape', 'region', 'enology'])
      .eq('status', 'published')
  );

  const sourceDocSet = new Set(TOPICS.map((t) => t.sourceDoc));
  const keywordPatterns = TOPICS.map((t) => ({
    slug: t.slug,
    re: new RegExp(t.keywordPattern ?? t.topicName.toLowerCase(), 'i'),
  }));

  const orphaned = [];
  for (const row of data) {
    if (sourceDocSet.has(row.source_doc)) continue;
    const haystack = `${row.content || ''} ${row.section_title || ''}`;
    if (keywordPatterns.some(({ re }) => re.test(haystack))) continue;
    // Still reachable via search.html's ilike text match even without a
    // dedicated page or keyword hit — only flag chunks whose own
    // section_title/content give literally nothing else to search by,
    // which in practice never happens for real content. Flag everything
    // else too, but at low severity, since it's a coverage gap, not a bug.
    orphaned.push({ id: row.id, source_doc: row.source_doc, chunk_type: row.chunk_type });
  }
  return orphaned;
}

// --- Run ---------------------------------------------------------------

async function main() {
  const [brokenLinks, counts, missing, orphaned] = await Promise.all([
    crawlLinks(),
    chunkCounts(),
    missingData(),
    orphanedChunks(),
  ]);

  const { count: draftCount } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft');

  const { count: summaryMissingCount } = await supabase
    .from('knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .is('summary', null);

  const report = {
    generated_at: new Date().toISOString(),
    site_url: SITE_URL,
    broken_links: brokenLinks,
    orphaned_chunks: orphaned,
    missing_data: missing,
    chunk_counts: counts,
    // Informational only — not a failure trigger. As of this writing 100%
    // of rows have no summary, which is expected current state, not a
    // regression; flagging it as a failure would fire every single run.
    summary_coverage: { missing: summaryMissingCount ?? 0 },
    draft_count: draftCount ?? 0,
  };

  writeFileSync('audit-report.json', JSON.stringify(report, null, 2));

  const hasFailure = brokenLinks.length > 0 || missing.length > 0;
  console.log(
    `Audit: ${brokenLinks.length} broken link(s), ${missing.length} missing-data issue(s), ` +
      `${orphaned.length} orphaned chunk(s) (coverage gap, non-blocking), ${draftCount ?? 0} draft chunk(s) pending review.`
  );

  process.exit(hasFailure ? 1 : 0);
}

main().catch((err) => {
  console.error('Audit failed to run:', err);
  process.exit(1);
});
