// Translates published English knowledge_chunks rows into French using the
// DeepL API, inserting them as new rows with lang='fr' (same chunk_type/
// source_doc/chunk_index as their English source). Shared row-fetching,
// idempotency, and structural validation live in
// lib/french-translation-pipeline.mjs -- this file only calls DeepL.
//
// Run from the repo root: node scripts/translate-to-french-deepl.mjs [--dry-run] [--topic <slug>]
// --topic limits the run to one topics.config.mjs topic (what its page
// shows); --pilot is kept as an alias for --topic grenache.
//
// Unlike the Claude backend (scripts/translate-to-french.mjs), DeepL is a
// dedicated MT engine, not an LLM -- there's no prompt to give it structural
// instructions, so this relies on DeepL's own paragraph/line-break
// preservation (preserve_formatting=true) plus the same post-hoc
// validateTranslation() check every row goes through regardless of backend.
// section_title is copied verbatim from the source row, never translated --
// see lib/french-translation-pipeline.mjs for why.
//
// GLOSSARY_ENTRIES corrects domain vocabulary DeepL otherwise gets wrong
// without wine-specific context -- notably "soft" (tannin texture) ->
// "doux", which in French wine vocabulary specifically means *sweet*
// (residual sugar), a real mistranslation risk on a wine-education site.
// Found by comparing DeepL's pilot output against the existing Claude
// translations before scaling to the full catalog.

import 'dotenv/config';
import { runTranslationPipeline } from '../lib/french-translation-pipeline.mjs';

const { DEEPL_API_KEY } = process.env;
if (!DEEPL_API_KEY) {
  throw new Error('Missing DEEPL_API_KEY. Copy .env.example to .env and fill it in.');
}

// Free-tier ("Developer" plan) keys are suffixed ":fx" and only work against
// the api-free host; paid keys use the plain api host.
const DEEPL_HOST = DEEPL_API_KEY.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';

const DRY_RUN = process.argv.includes('--dry-run');
const topicArgIndex = process.argv.indexOf('--topic');
const TOPIC_SLUG = topicArgIndex !== -1 ? process.argv[topicArgIndex + 1] : process.argv.includes('--pilot') ? 'grenache' : null;
// A bare --topic must not fall through to a full-catalog run.
if (topicArgIndex !== -1 && (!TOPIC_SLUG || TOPIC_SLUG.startsWith('--'))) {
  throw new Error('--topic needs a slug, e.g. --topic riesling');
}

const GLOSSARY_NAME = 'tc-wine-glossary-en-fr';
const GLOSSARY_ENTRIES = [
  ['Soft', 'Souple'],
  ['soft', 'souple'],
  ['Tannin', 'Tanin'],
  ['tannin', 'tanin'],
  ['Tannins', 'Tanins'],
  ['tannins', 'tanins'],
  ['Oak', 'Chêne'],
  ['oak', 'chêne'],
  ['Terroir', 'Terroir'],
  ['terroir', 'terroir'],
];

async function deeplFetch(path, body) {
  const response = await fetch(`https://${DEEPL_HOST}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepL ${path} failed: ${response.status} ${text.slice(0, 200)}`);
  }
  return response.json();
}

// Reuses the glossary by name if one already exists (idempotent across
// runs) instead of creating a duplicate every time this script starts.
async function ensureGlossary() {
  const listResponse = await fetch(`https://${DEEPL_HOST}/v2/glossaries`, {
    headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
  });
  if (!listResponse.ok) throw new Error(`DeepL glossary list failed: ${listResponse.status}`);
  const { glossaries } = await listResponse.json();
  const existing = glossaries.find((g) => g.name === GLOSSARY_NAME);
  if (existing) return existing.glossary_id;

  const entries = GLOSSARY_ENTRIES.map(([en, fr]) => `${en}\t${fr}`).join('\n');
  const created = await deeplFetch('/v2/glossaries', {
    name: GLOSSARY_NAME,
    source_lang: 'EN',
    target_lang: 'FR',
    entries_format: 'tsv',
    entries,
  });
  return created.glossary_id;
}

async function translateRow(row, glossaryId) {
  const texts = [row.content, row.summary].filter(Boolean);

  const { translations } = await deeplFetch('/v2/translate', {
    text: texts,
    source_lang: 'EN',
    target_lang: 'FR',
    preserve_formatting: true,
    glossary_id: glossaryId,
  });

  const [content, summary] = translations.map((t) => t.text);
  return row.summary ? { content, summary } : { content };
}

const glossaryId = await ensureGlossary();
console.log(`Using DeepL glossary ${glossaryId} (${GLOSSARY_NAME}).`);

runTranslationPipeline({ topicSlug: TOPIC_SLUG, dryRun: DRY_RUN, translateRow: (row) => translateRow(row, glossaryId) }).catch(
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
