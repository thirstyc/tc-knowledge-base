// Checks link integrity and content health, writes audit-report.json, and
// exits 1 when something needs a human.
//
// Run: node scripts/audit-links.mjs   (or npm run audit:links)
//      node scripts/audit-links.mjs --skip-live   (no network)
//
// No Supabase. The site's content lives in content/docs/ and content/answers/,
// so the health checks read those files. The Supabase half of this script
// counted chunks, looked for null embeddings and summaries, and hunted
// "orphaned" chunks -- all describing a database no page reads any more. What
// replaces it measures the thing that actually went wrong in Search Console:
// answers too thin to index, French pages left behind their English pair, and
// two URLs competing to answer one question.
//
// The live crawl used to fire one request per page at once -- Promise.all over
// every .html file, unthrottled, with GET rather than HEAD. GitHub Pages
// answers a burst like that with 429s and 503s, which the audit recorded as
// broken links, failed the job over, and opened an issue about. It was
// reporting its own traffic. It also only looked at the repo root, so the
// pages under fr/ were never checked at all. Now: both directories, HEAD, and
// a concurrency limit.

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TOPICS } from '../topics.config.mjs';
import { readDocRows } from '../lib/content-docs.mjs';
import { readAnswerRows, answerParts, answerWords } from '../lib/content-files.mjs';

const SITE_URL = 'https://knowledge.thirstyc.com';
const CONCURRENCY = 8;
// Same floor content-generator --mode=expand uses. Below it, Google crawls a
// page and declines to index it.
const THIN_WORDS = 150;

// --- 1. Link integrity ------------------------------------------------------
// GitHub Pages serves this repo 1:1, so the local .html file list *is* the
// deployed page set -- no spidering needed to discover pages.

function allPages() {
  const pages = readdirSync('.').filter((f) => f.endsWith('.html'));
  if (existsSync('fr')) {
    pages.push(...readdirSync('fr').filter((f) => f.endsWith('.html')).map((f) => `fr/${f}`));
  }
  return pages;
}

function extractLocalRefs(html) {
  const refs = new Set();
  for (const [, ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (
      ref.startsWith('#') ||
      ref.startsWith('/') ||
      ref.startsWith('http') ||
      ref.startsWith('mailto:') ||
      ref.includes('${') // JS template literals caught by the same regex, not real hrefs
    ) {
      continue;
    }
    const clean = ref.split('?')[0].split('#')[0];
    if (clean) refs.add(clean);
  }
  return refs;
}

// Every local href/src must resolve to a file that exists. Resolved relative
// to the linking page, because fr/ pages link ../styles.css and each other.
function brokenLocalLinks(pages) {
  const broken = [];
  for (const page of pages) {
    const dir = path.dirname(path.resolve(page));
    for (const ref of extractLocalRefs(readFileSync(page, 'utf8'))) {
      if (!existsSync(path.resolve(dir, ref))) {
        broken.push({ type: 'missing_file', from: page, target: ref });
      }
    }
  }
  return broken;
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Every deployed file must resolve live -- catches Pages cache lag, an
// unpushed commit, or a file deleted while still linked. HEAD, not GET: this
// only reads the status code, and 2,900 page bodies is a lot of transfer to
// throw away.
async function liveStatuses(pages) {
  const broken = [];
  // The search index is not linked from any page, so the local link check
  // never sees it -- but search.html is dead without it.
  const extras = ['robots.txt', 'sitemap.xml', 'styles.css', 'site.js', 'search-index-en.json', 'search-index-fr.json'];
  const targets = [...pages, ...extras].filter((p) => existsSync(p));
  await mapLimit(targets, CONCURRENCY, async (target) => {
    try {
      const res = await fetch(`${SITE_URL}/${target}`, { method: 'HEAD' });
      if (res.status !== 200) broken.push({ type: 'live_status', target, status: res.status });
    } catch (err) {
      broken.push({ type: 'fetch_error', target, error: err.message });
    }
  });
  return broken;
}

// --- 2. Content health, read from the files ---------------------------------

function contentHealth() {
  const answers = readAnswerRows();
  const en = answers.filter((r) => r.lang === 'en');
  const fr = answers.filter((r) => r.lang === 'fr');
  const frByDoc = new Map(fr.map((r) => [r.source_doc, r]));

  // An English answer well ahead of its French pair: expanded on one side,
  // untouched on the other. The two are hreflang alternates, so they claim to
  // be the same page in two languages -- 180 words against 20 is not that.
  // Same gate as content-generator --mode=translate, which closes them.
  const diverged = en
    .filter((r) => frByDoc.has(r.source_doc))
    .filter((r) => {
      const e = answerWords(r);
      const f = answerWords(frByDoc.get(r.source_doc));
      return f < THIN_WORDS && e >= 120 && e >= f * 2;
    })
    .map((r) => r.source_doc);

  // Two URLs answering the same question compete with each other for it, and
  // Google indexes neither. Exact question matches only -- near-duplicates
  // need a human to judge, and live in drafts/duplicate-questions.md.
  const byQuestion = new Map();
  for (const row of en) {
    const q = answerParts(row)
      .question.toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (!q) continue;
    byQuestion.set(q, [...(byQuestion.get(q) ?? []), row.source_doc]);
  }
  const duplicateQuestions = [...byQuestion.values()].filter((g) => g.length > 1);

  const docs = readDocRows({ lang: 'en' });
  const docTypes = {};
  for (const row of docs) docTypes[row.chunk_type] = (docTypes[row.chunk_type] ?? 0) + 1;

  // A topic whose source document has no file renders an empty page. This is
  // the one content check that fails the run: it means a file was deleted or
  // renamed out from under topics.config.mjs.
  const docSources = new Set(docs.map((r) => r.source_doc));
  const topicsWithoutContent = TOPICS.filter((t) => !docSources.has(t.sourceDoc)).map((t) => t.slug);

  return {
    answers: { en: en.length, fr: fr.length },
    thin_answers: {
      en: en.filter((r) => answerWords(r) < THIN_WORDS).length,
      fr: fr.filter((r) => answerWords(r) < THIN_WORDS).length,
    },
    diverged_pairs: diverged,
    duplicate_questions: duplicateQuestions,
    doc_chunks_by_type: docTypes,
    topics_without_content: topicsWithoutContent,
  };
}

// --- Run --------------------------------------------------------------------

const pages = allPages();
const health = contentHealth();
const localBroken = brokenLocalLinks(pages);
const live = process.argv.includes('--skip-live') ? [] : await liveStatuses(pages);
const brokenLinks = [...localBroken, ...live];

writeFileSync(
  'audit-report.json',
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      site_url: SITE_URL,
      pages_checked: pages.length,
      broken_links: brokenLinks,
      ...health,
    },
    null,
    2
  )}\n`
);

// Only breakage fails the run. Thin answers and duplicate questions are a
// standing backlog being worked through, not a regression -- failing on them
// would fire every night and train everyone to ignore the issue it files.
const hasFailure = brokenLinks.length > 0 || health.topics_without_content.length > 0;

console.log(
  `Audit: ${pages.length} pages, ${brokenLinks.length} broken link(s), ` +
    `${health.topics_without_content.length} topic(s) without content.\n` +
    `Backlog: ${health.thin_answers.en} thin EN / ${health.thin_answers.fr} thin FR answer(s), ` +
    `${health.diverged_pairs.length} diverged EN/FR pair(s), ` +
    `${health.duplicate_questions.length} duplicated question(s).`
);
process.exit(hasFailure ? 1 : 0);
