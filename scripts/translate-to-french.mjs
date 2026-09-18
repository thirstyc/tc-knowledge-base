// Translates published English knowledge_chunks rows into French using
// Claude, inserting them as new rows with lang='fr' (same chunk_type/
// source_doc/chunk_index as their English source). Shared row-fetching,
// idempotency, and structural validation live in
// lib/french-translation-pipeline.mjs -- this file only builds the prompt
// and calls the model. See that file for the structural constraints every
// translation is checked against before insert.
//
// Run from the repo root: node scripts/translate-to-french.mjs [--dry-run] [--topic <slug>]
//   node scripts/translate-to-french.mjs [--dry-run] --retranslate <id,id,...>
// --retranslate re-translates the given English rows and updates their
// existing French twins in place (for English rows edited after translation).
// --topic limits the run to one topics.config.mjs topic (what its page
// shows); --pilot is kept as an alias for --topic grenache.
//
// Only `content` and `summary` are translated. `section_title` is copied
// verbatim from the source row, never translated -- see
// lib/french-translation-pipeline.mjs for why.

import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import { OVERVIEW_TYPES, retranslateRows, runTranslationPipeline } from '../lib/french-translation-pipeline.mjs';

const { ANTHROPIC_API_KEY } = process.env;
if (!ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY. Copy .env.example to .env and fill it in.');
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const DRY_RUN = process.argv.includes('--dry-run');
const topicArgIndex = process.argv.indexOf('--topic');
const TOPIC_SLUG = topicArgIndex !== -1 ? process.argv[topicArgIndex + 1] : process.argv.includes('--pilot') ? 'grenache' : null;
// A bare --topic must not fall through to a full-catalog run.
if (topicArgIndex !== -1 && (!TOPIC_SLUG || TOPIC_SLUG.startsWith('--'))) {
  throw new Error('--topic needs a slug, e.g. --topic riesling');
}

const retranslateArgIndex = process.argv.indexOf('--retranslate');
const RETRANSLATE_IDS =
  retranslateArgIndex !== -1 ? (process.argv[retranslateArgIndex + 1] ?? '').split(',').filter(Boolean).map(Number) : null;
if (RETRANSLATE_IDS && (RETRANSLATE_IDS.length === 0 || RETRANSLATE_IDS.some((id) => !Number.isInteger(id)))) {
  throw new Error('--retranslate needs a comma-separated list of English row ids, e.g. --retranslate 528,529');
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

async function translateRow(row) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildPrompt(row) }],
  });
  const raw = message.content.find((b) => b.type === 'text')?.text ?? '{}';
  // The model sometimes wraps the JSON in a ```json fence despite the
  // instruction not to; strip it rather than failing the row.
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse translation JSON for row ${row.id}: ${text.slice(0, 200)}`);
  }
  if (!parsed.content) throw new Error(`Translation for row ${row.id} missing "content"`);
  return parsed;
}

const run = RETRANSLATE_IDS
  ? retranslateRows({ ids: RETRANSLATE_IDS, dryRun: DRY_RUN, translateRow })
  : runTranslationPipeline({ topicSlug: TOPIC_SLUG, dryRun: DRY_RUN, translateRow });
run.catch((err) => {
  console.error(err);
  process.exit(1);
});
