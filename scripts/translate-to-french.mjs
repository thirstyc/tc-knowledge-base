// Translates published English knowledge_chunks rows into French, inserting
// them as new rows with lang='fr' (same chunk_type/source_doc/chunk_index as
// their English source -- see the migration in the French-localization plan).
// Run from the repo root: node scripts/translate-to-french.mjs [--dry-run] [--pilot]
//
// Only `content` and `summary` are translated. `section_title` is copied
// verbatim from the source row, never translated: for grape/region/enology
// Overview rows it's the literal string "Overview" that generate-topic-
// pages.mjs and renderGrapesCatalog() look up by exact match; for qa/
// region-qa rows it's a difficulty label ("Beginner"/"Intermediate") that
// answer-page generation and the difficulty archives filter on. Translating
// either would silently break every page that depends on that exact value.
//
// Structural constraints the translation must preserve (told to the model
// explicitly in the prompt, then verified against every response before
// insert -- see validateTranslation()):
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

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill it in.');
}
if (!ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY. Copy .env.example to .env and fill it in.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const DRY_RUN = process.argv.includes('--dry-run');
const PILOT = process.argv.includes('--pilot');

const OVERVIEW_TYPES = ['grape', 'region', 'enology'];

async function fetchRowsToTranslate() {
  if (PILOT) {
    // Exactly the row set topic-grenache.html itself surfaces: the Overview
    // row plus every qa row matching "Grenache" -- a real, checkable slice
    // small enough to hand-review before translating the other ~1,476 rows.
    const [{ data: overview, error: e1 }, { data: qa, error: e2 }] = await Promise.all([
      supabase
        .from('knowledge_chunks')
        .select('*')
        .eq('lang', 'en')
        .eq('status', 'published')
        .eq('chunk_type', 'grape')
        .eq('source_doc', 'grape-grenache')
        .eq('section_title', 'Overview'),
      supabase
        .from('knowledge_chunks')
        .select('*')
        .eq('lang', 'en')
        .eq('status', 'published')
        .eq('chunk_type', 'qa')
        .ilike('content', '%Grenache%'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    return [...overview, ...qa];
  }

  const { data, error } = await supabase
    .from('knowledge_chunks')
    .select('*')
    .eq('lang', 'en')
    .eq('status', 'published')
    .in('chunk_type', ['qa', 'region-qa', 'grape', 'region', 'enology', 'guide', 'comparison']);
  if (error) throw error;
  return data;
}

async function alreadyTranslated(row) {
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .select('id')
    .eq('lang', 'fr')
    .eq('source_doc', row.source_doc)
    .is('chunk_index', row.chunk_index)
    .limit(1);
  if (error) throw error;
  return data.length > 0;
}

function buildPrompt(row) {
  const isOverview = OVERVIEW_TYPES.includes(row.chunk_type) && row.section_title === 'Overview';
  const isQa = row.chunk_type === 'qa' || row.chunk_type === 'region-qa';

  const constraints = [];
  if (isOverview) {
    constraints.push(
      'This is a 4-paragraph "Overview" entry: {eyebrow}\\n\\n{name}\\n\\n{lede}\\n\\n{factsBlock}, separated by blank lines. ' +
        'Your translation MUST have exactly 4 paragraphs in the same order, separated by blank lines. ' +
        'The last paragraph (factsBlock) is several lines, each "Label: value" -- translate both the label and the value naturally into French, but every line must still contain a ":" separator. ' +
        'The {name} paragraph is just the entity\'s name -- use the standard French name if one exists (e.g. a region exonym like "Tuscany" -> "Toscane"), otherwise keep it as-is (most grape names, like "Grenache" or "Cabernet Sauvignon", are unchanged in French).'
    );
  } else if (isQa) {
    constraints.push(
      'This is a question immediately followed by its answer, with a "?" marking the boundary (e.g. "Why does X taste like Y? Because...", or "...Y?\\n\\nBecause..."). ' +
        'Your translation MUST keep a "?" immediately followed by whitespace at that same boundary, so the question can still be extracted programmatically. Phrase the French question naturally.'
    );
  } else {
    constraints.push('Translate the full text naturally into French, preserving paragraph breaks exactly as they are.');
  }
  constraints.push(
    'Use established French wine/sommelier vocabulary, not literal word-for-word translation -- many terms are already French or have fixed French equivalents (e.g. "tannin" -> "tanin", "terroir" stays "terroir", "oak" -> "chêne" in context of barrels).'
  );

  return `You are translating wine knowledge-base content from English to French for a wine education website. ${constraints.join(' ')}

Respond with ONLY minified JSON, no other text, in the shape {"content": string${row.summary ? ', "summary": string' : ''}}.

---
CONTENT:
${row.content}
${row.summary ? `\n---\nSUMMARY:\n${row.summary}` : ''}`;
}

function validateTranslation(row, translated) {
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

async function translateRow(row) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildPrompt(row) }],
  });
  const text = message.content.find((b) => b.type === 'text')?.text ?? '{}';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse translation JSON for row ${row.id}: ${text.slice(0, 200)}`);
  }
  if (!parsed.content) throw new Error(`Translation for row ${row.id} missing "content"`);

  const invalidReason = validateTranslation(row, parsed);
  if (invalidReason) {
    throw new Error(`Translation for row ${row.id} (${row.source_doc}) failed structural check: ${invalidReason}`);
  }
  return parsed;
}

async function main() {
  const rows = await fetchRowsToTranslate();
  console.log(`Found ${rows.length} English row(s) to consider${PILOT ? ' (pilot: Grenache only)' : ''}.`);

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
      console.log(`  -> [${row.chunk_type}] ${row.source_doc}: ${result.content.slice(0, 60).replace(/\n/g, ' ')}...`);

      if (!DRY_RUN) {
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
    `${DRY_RUN ? '[dry run] would translate' : 'Translated'} ${translated} row(s), skipped ${skipped} (already translated), ${failed} failed.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
