// Backend-agnostic pieces of the English -> French knowledge_chunks
// translation pipeline: which rows need translating, whether a row's
// already been done, and whether a translation result is structurally safe
// to insert. Two backends currently drive this with their own translateRow()
// implementation: scripts/translate-to-french.mjs (Claude) and
// scripts/translate-to-french-deepl.mjs (DeepL) -- everything below is
// identical between them, only the actual translation call differs.
//
// Structural constraints a translation must preserve (see validateTranslation
// below, which every insert is checked against before it happens):
//   - grape/region/enology Overview rows: content is exactly 4 paragraphs
//     separated by blank lines ({eyebrow}\n\n{name}\n\n{lede}\n\n{factsBlock}),
//     parsed positionally by OVERVIEW_JS in generate-topic-pages.mjs and by
//     renderGrapesCatalog() in supabase-client.js. Must stay exactly 4.
//   - factsBlock lines must each still contain a ':' separator (the label
//     text itself can be translated -- only the presence of ':' matters to
//     the parser, which does `line.indexOf(':')`).
//   - qa/region-qa rows: deriveQuestion() (lib/page-shell.mjs) finds the
//     question by matching the first "?" followed by whitespace. The
//     translated content must contain that same "?<whitespace>" boundary
//     between question and answer.

import { supabase } from './supabase.mjs';
import { TOPICS } from '../topics.config.mjs';

export const OVERVIEW_TYPES = ['grape', 'region', 'enology'];

// The row set a topic page surfaces (see renderScript/renderQaFetchAndList in
// generate-topic-pages.mjs): its Overview row plus every qa (or region-qa)
// row matching the topic's match term, minus its exclude term. Enology
// pages also list matching non-Overview enology rows. Keeping this in step
// with the page means translating a topic fills exactly its French page.
async function fetchTopicRows(topic) {
  const matchTerm = topic.matchTerm ?? topic.topicName;
  const published = () => supabase.from('knowledge_chunks').select('*').eq('lang', 'en').eq('status', 'published');
  const withTerms = (query) => {
    query = query.ilike('content', `%${matchTerm}%`);
    return topic.excludeTerm ? query.not('content', 'ilike', `%${topic.excludeTerm}%`) : query;
  };

  const queries = [
    published().eq('chunk_type', topic.kind).eq('source_doc', topic.sourceDoc).eq('section_title', 'Overview'),
    withTerms(published().eq('chunk_type', topic.kind === 'region' ? 'region-qa' : 'qa')),
  ];
  if (topic.kind === 'enology') {
    queries.push(withTerms(published().eq('chunk_type', 'enology').neq('section_title', 'Overview')));
  }

  const results = await Promise.all(queries);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
  return results.flatMap((r) => r.data);
}

// topicSlug: a slug from topics.config.mjs, or null for the full catalog.
export async function fetchRowsToTranslate({ topicSlug }) {
  if (topicSlug) {
    const topic = TOPICS.find((t) => t.slug === topicSlug);
    if (!topic) throw new Error(`Unknown topic "${topicSlug}" -- see topics.config.mjs for valid slugs.`);
    return fetchTopicRows(topic);
  }

  // PostgREST caps an unpaginated response at 1000 rows -- with ~1,483
  // candidate rows total, a single .select() would silently drop the rest.
  // Page through with .range() until a page comes back short.
  const PAGE_SIZE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .eq('lang', 'en')
      .eq('status', 'published')
      .in('chunk_type', ['qa', 'region-qa', 'grape', 'region', 'enology', 'guide', 'comparison'])
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

// chunk_index is null on every row in this table, so it can't distinguish
// rows that share a source_doc (up to 26 do -- multi-section region/grape/
// enology entries). The real per-row identity is the same one the DB's own
// unique index enforces: source_doc + section_title + wine_id. Matching on
// chunk_index instead would make every row after the first sibling with a
// given source_doc look "already translated" and get silently skipped
// forever.
export async function alreadyTranslated(row) {
  let query = supabase
    .from('knowledge_chunks')
    .select('id')
    .eq('lang', 'fr')
    .eq('source_doc', row.source_doc);
  query = row.section_title === null ? query.is('section_title', null) : query.eq('section_title', row.section_title);
  query = row.wine_id === null ? query.is('wine_id', null) : query.eq('wine_id', row.wine_id);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data.length > 0;
}

export function validateTranslation(row, translated) {
  const isOverview = OVERVIEW_TYPES.includes(row.chunk_type) && row.section_title === 'Overview';
  const isQa = row.chunk_type === 'qa' || row.chunk_type === 'region-qa';

  if (isOverview) {
    const parts = translated.content.split('\n\n');
    if (parts.length !== 4) {
      return `expected 4 \\n\\n-separated paragraphs, got ${parts.length}`;
    }
    const factsLines = parts[3].split('\n').filter((l) => l.trim());
    const badLine = factsLines.find((l) => !l.includes(':'));
    if (badLine) return `factsBlock line missing ':' separator: "${badLine}"`;
  } else if (isQa) {
    if (!/\?\s/.test(translated.content)) {
      return 'no "?" followed by whitespace found (deriveQuestion() would fail to find the question boundary)';
    }
  }
  return null;
}

// translateRow(row) => Promise<{content: string, summary?: string}>, thrown
// errors (network, validation, whatever) are caught per-row so one bad row
// doesn't stop the rest of the run.
export async function runTranslationPipeline({ topicSlug, dryRun, translateRow }) {
  const rows = await fetchRowsToTranslate({ topicSlug });
  console.log(`Found ${rows.length} English row(s) to consider${topicSlug ? ` (topic: ${topicSlug})` : ''}.`);

  let translated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (await alreadyTranslated(row)) {
      skipped++;
      continue;
    }

    try {
      const result = await translateRow(row);
      const invalidReason = validateTranslation(row, result);
      if (invalidReason) {
        throw new Error(`Translation for row ${row.id} (${row.source_doc}) failed structural check: ${invalidReason}`);
      }

      console.log(`  -> [${row.chunk_type}] ${row.source_doc}: ${result.content.slice(0, 60).replace(/\n/g, ' ')}...`);

      if (!dryRun) {
        const { id, created_at, updated_at, published_at, ...rest } = row;
        const { error } = await supabase.from('knowledge_chunks').insert({
          ...rest,
          lang: 'fr',
          content: result.content,
          summary: result.summary ?? row.summary,
          published_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      translated++;
    } catch (err) {
      console.error(`  FAILED [${row.chunk_type}] ${row.source_doc}: ${err.message}`);
      failed++;
    }
  }

  console.log(
    `${dryRun ? '[dry run] would translate' : 'Translated'} ${translated} row(s), skipped ${skipped} (already translated), ${failed} failed.`
  );
}
