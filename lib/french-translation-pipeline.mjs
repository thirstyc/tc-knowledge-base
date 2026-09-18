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
//     parsed positionally by parseOverview() in generate-topic-pages.mjs and
//     by buildGrapes() in scripts/generate-catalog-pages.mjs. Must stay
//     exactly 4.
//   - factsBlock lines must each still contain a ':' separator (the label
//     text itself can be translated -- only the presence of ':' matters to
//     the parser, which does `line.indexOf(':')`).
//   - qa/region-qa rows: deriveQuestion() (lib/page-shell.mjs) finds the
//     question by matching the first "?" followed by whitespace. The
//     translated content must contain that same "?<whitespace>" boundary
//     between question and answer.
//
// section_title is copied verbatim below and never sent through
// translateRow() -- correct for grape/region/enology *Overview* rows, where
// it's the literal lookup key "Overview", but for non-Overview enology rows
// it's a real display heading (e.g. "Tannins — structure, astringency, and
// age"), not a key. Those 29 headings across the 2 enology source_docs were
// hand-translated once via direct SQL after the fact, rather than through
// this pipeline -- if new non-Overview enology content is added later, its
// section_title will need the same manual translation pass, or this file
// will need a third branch (distinct from the Overview and qa/region-qa
// cases) that actually translates it.

import { supabase } from './supabase.mjs';
import { TOPICS } from '../topics.config.mjs';
import { frenchSectionTitleCandidates } from './sections.mjs';

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
async function findFrenchRows(row) {
  let query = supabase
    .from('knowledge_chunks')
    .select('id')
    .eq('lang', 'fr')
    .eq('source_doc', row.source_doc);
  // Some French enology rows carry a translated section_title (see
  // lib/sections.mjs); match those too, or they'd look untranslated and get
  // inserted a second time.
  query =
    row.section_title === null
      ? query.is('section_title', null)
      : query.in('section_title', frenchSectionTitleCandidates(row.section_title));
  query = row.wine_id === null ? query.is('wine_id', null) : query.eq('wine_id', row.wine_id);
  const { data, error } = await query.limit(2);
  if (error) throw error;
  return data;
}

export async function alreadyTranslated(row) {
  return (await findFrenchRows(row)).length > 0;
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
// Model output occasionally comes back malformed (bad JSON, a dropped
// paragraph) even though a retry of the same row succeeds, so each row gets
// a few attempts before it counts as failed.
const TRANSLATION_ATTEMPTS = 3;

async function translateValidated(row, translateRow) {
  let lastError;
  for (let attempt = 1; attempt <= TRANSLATION_ATTEMPTS; attempt++) {
    try {
      const result = await translateRow(row);
      const invalidReason = validateTranslation(row, result);
      if (invalidReason) {
        throw new Error(`Translation for row ${row.id} (${row.source_doc}) failed structural check: ${invalidReason}`);
      }
      return result;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

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
      const result = await translateValidated(row, translateRow);

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

// Re-translates English rows whose content changed after they were first
// translated, updating their existing French row in place (the normal
// pipeline above skips any row that already has a French twin). Rows with
// no French twin yet are left for the normal pipeline.
export async function retranslateRows({ ids, dryRun, translateRow }) {
  const { data: rows, error } = await supabase.from('knowledge_chunks').select('*').in('id', ids).eq('lang', 'en');
  if (error) throw error;
  const missing = ids.filter((id) => !rows.some((row) => row.id === id));
  if (missing.length) throw new Error(`Not English rows (or not found): ${missing.join(', ')}`);

  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const french = await findFrenchRows(row);
      if (french.length !== 1) {
        throw new Error(`expected exactly one French row, found ${french.length}`);
      }
      const result = await translateValidated(row, translateRow);

      console.log(`  -> [${row.chunk_type}] ${row.source_doc} (fr id ${french[0].id}): ${result.content.slice(0, 60).replace(/\n/g, ' ')}...`);
      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('knowledge_chunks')
          .update({ content: result.content, summary: result.summary ?? row.summary, updated_at: new Date().toISOString() })
          .eq('id', french[0].id)
          .eq('lang', 'fr');
        if (updateError) throw updateError;
      }
      updated++;
    } catch (err) {
      console.error(`  FAILED row ${row.id} [${row.chunk_type}] ${row.source_doc}: ${err.message}`);
      failed++;
    }
  }
  console.log(`${dryRun ? '[dry run] would update' : 'Updated'} ${updated} French row(s), ${failed} failed.`);
  if (failed) process.exitCode = 1;
}
