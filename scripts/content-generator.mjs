// Four content-generation modes. Everything this script writes lands as a
// draft — nothing reaches the live site until a human reviews it.
//
// Where each mode writes:
//   qa-gen, expand   content/answers/en/*.md with `status: draft`. Answer
//                    content lives in this repo, not Supabase — see
//                    lib/content-files.mjs. Review the file, delete the
//                    status line, run `npm run generate:pages`.
//   vault-scan       knowledge_chunks as status='draft' (atlas chunks, which
//                    have no page generator and so no file representation).
//   wine-gen         the wines_draft staging table.
//
// The two Supabase modes need SUPABASE_SERVICE_ROLE_KEY via lib/supabase.mjs;
// qa-gen and expand need only ANTHROPIC_API_KEY.
//
// Usage:
//   node scripts/content-generator.mjs --mode=vault-scan
//   node scripts/content-generator.mjs --mode=qa-gen --topic="Chenin Blanc" --difficulty=Beginner
//   node scripts/content-generator.mjs --mode=expand --topic="Sherry" --limit=6
//   node scripts/content-generator.mjs --mode=translate --topic="Australian" --limit=19
//   node scripts/content-generator.mjs --mode=wine-gen --region="Priorat"

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import { supabase } from '../lib/supabase.mjs';
import { existsSync } from 'node:fs';
import { readAnswerRows, writeAnswerFile, answerFilePath } from '../lib/content-files.mjs';
import { embed } from '../lib/embeddings.mjs';
import { chunkText } from '../lib/chunking.mjs';
import { slugify } from '../lib/page-shell.mjs';

const CONTENT_MODEL = 'claude-sonnet-5';

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- MODE=vault-scan ---------------------------------------------------
// add-intake.mjs and process-knowledge-intake.mjs read the first vault. The
// second had its own script (process-obsidian-to-supabase.js, deleted — it
// held a service-role key and upserted to knowledge_chunks on a conflict
// target that no longer has a matching unique index), so this is now the only
// thing that reads it, and the only one that reads both in one pass.
//
// LOCAL USE ONLY. These are absolute paths on the machine running the
// script, not anything checked into this repo — confirmed by actually
// running vault-scan in GitHub Actions: both dirs come back ENOENT and it
// silently reports "Added 0 new chunks" (exit 0, no error). That's why
// generate-content.yml's workflow_dispatch only offers qa-gen/wine-gen.
// Run this mode with `npm run content -- --mode=vault-scan` on your own
// machine instead.

const VAULTS = [
  { tag: 'kb', dir: '/Users/cathe/Documents/Thirsty Cunt/Knowledge Base' },
  { tag: 'sommelier', dir: '/Users/cathe/Documents/Thirsty Cunt/AI sommelier' },
];

async function summarize(content) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: `Summarize the following in 1-2 sentences. Respond with ONLY the summary text, no preamble.\n\n---\n${content}`,
      },
    ],
  });
  return message.content.find((b) => b.type === 'text')?.text?.trim() ?? null;
}

async function vaultScan({ limit } = {}) {
  const maxNew = limit ? parseInt(limit, 10) : Infinity;
  let added = 0;
  let skipped = 0;
  let newFilesProcessed = 0;

  for (const vault of VAULTS) {
    let relFiles;
    try {
      // { recursive: true } (Node 20+) is required here, not optional: the
      // "AI sommelier" vault keeps 268 of its 304 files one level down in
      // subfolders (Grapes/, Producers/, Regions/, ...) — a flat readdir
      // would silently miss 88% of it.
      relFiles = (await readdir(vault.dir, { recursive: true })).filter((f) => f.endsWith('.md'));
    } catch (err) {
      console.warn(`Skipping vault ${vault.dir}: ${err.message}`);
      continue;
    }

    for (const relFile of relFiles) {
      if (newFilesProcessed >= maxNew) break;

      // Fold subfolder structure into the slug so "Grapes/Sangiovese.md"
      // and a hypothetical top-level "Sangiovese.md" can't collide.
      const sourceDoc = `${vault.tag}-${slugify(relFile.replace(/\.md$/, ''))}`;

      const { data: existing, error: checkErr } = await supabase
        .from('knowledge_chunks')
        .select('id')
        .eq('source_doc', sourceDoc)
        .limit(1);
      if (checkErr) throw checkErr;
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const raw = await readFile(path.join(vault.dir, relFile), 'utf8');
      if (!raw.trim()) continue;

      const summary = await summarize(raw).catch((err) => {
        console.warn(`  summary failed for ${relFile}, continuing without one: ${err.message}`);
        return null;
      });

      const chunks = chunkText(raw);
      const rows = [];
      for (let i = 0; i < chunks.length; i++) {
        rows.push({
          source_doc: sourceDoc,
          chunk_index: i,
          content: chunks[i],
          summary: i === 0 ? summary : null,
          chunk_type: 'atlas',
          status: 'draft',
          embedding: await embed(chunks[i]),
        });
      }

      const { error: insertErr } = await supabase.from('knowledge_chunks').insert(rows);
      if (insertErr) throw insertErr;

      console.log(`  -> ${sourceDoc}: ${rows.length} chunk(s)`);
      added += rows.length;
      newFilesProcessed++;
    }
  }

  console.log(`Added ${added} new chunks as draft${skipped ? ` (${skipped} file(s) already ingested, skipped)` : ''}.`);
}

// --- MODE=qa-gen / MODE=expand -------------------------------------------
//
// Both write .md files into content/answers/en with `status: draft`, so
// nothing reaches the site until a human removes that line. Neither touches
// Supabase: answer content lives in this repo (see lib/content-files.mjs).
//
// The house style these prompts ask for is NOT the old one. The previous
// qa-gen prompt asked for "terse, factual, no fluff" and offered
// "Why does Refosco taste so dark and peppery? Slovenian/Italian red. High
// tannin. Pepper. Dark." as the model to match. That prompt is where a large
// part of the thin-content problem came from: 844 of 1,170 English answers are
// under 150 words, and Google responds by crawling them and declining to index
// them. Generating more of those would make the problem worse, so the brief
// now asks for the thing that was missing -- the mechanism behind the answer.

const VALID_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

const HOUSE_STYLE = `Voice: candid, irreverent, intimate -- like a knowledgeable friend over a glass, not a textbook and not a wine merchant. Confident, never snobby. A little dry humour is welcome; jokes for their own sake are not. No emojis. No filler phrases ("at the end of the day", "game-changer", "in this guide"). Never open by restating the question.

Length: 150-200 words. This is the whole point of the exercise -- a four-word answer is what we are replacing.

Substance: explain the actual mechanism, not the label. Not "high acidity, mineral, coastal" but why the acidity is there and what it does on the table. Name grapes, places, techniques, numbers and temperatures where they are real. If there is a common misconception, correct it. If there is a practical instruction (serving temperature, when to drink it, what to avoid), give it.

Accuracy matters more than flourish. Do not invent appellation rules, vintages, percentages or producer names. If you are not certain of a figure, describe it qualitatively instead.`;

async function askClaude(prompt, maxTokens = 4000) {
  const message = await anthropic.messages.create({
    model: CONTENT_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = message.content.find((b) => b.type === 'text')?.text ?? '[]';
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
  try {
    return JSON.parse(json);
  } catch {
    throw new Error(`Could not parse Claude's response as JSON: ${text.slice(0, 200)}`);
  }
}

function writeDrafts(items, { chunkType = 'qa', sectionTitle = null, lang = 'en' } = {}) {
  const written = [];
  for (const { source_doc, question, answer } of items) {
    if (!question || !answer) continue;
    written.push(
      writeAnswerFile(lang, {
        source_doc,
        chunk_type: chunkType,
        section_title: sectionTitle,
        status: 'draft',
        question,
        answer,
      })
    );
  }
  return written;
}

// New questions on a topic. Adds pages, so use it where coverage is genuinely
// missing -- not as a way to bulk up a topic that already has thin pages,
// which is what MODE=expand is for.
async function qaGen({ topic, difficulty, count }) {
  if (!topic) throw new Error('qa-gen requires --topic="..."');
  const level =
    VALID_DIFFICULTIES.find((d) => d.toLowerCase() === (difficulty || '').toLowerCase()) || 'Beginner';
  const n = Number(count) || 6;

  const existing = readAnswerRows({ includeDrafts: true })
    .filter((r) => r.lang === 'en' && r.content.toLowerCase().includes(topic.toLowerCase()))
    .map((r) => r.content.slice(0, r.content.indexOf('? ') + 1))
    .filter(Boolean);

  const pairs = await askClaude(`Write ${n} wine Q&A pairs about "${topic}" for a ${level.toLowerCase()} reader.

${HOUSE_STYLE}

These questions already exist and must NOT be duplicated or rephrased:
${existing.length ? existing.map((q) => `- ${q}`).join('\n') : '(none yet)'}

Respond with ONLY a JSON array: [{"question": "...", "answer": "..."}]`);

  const stamp = Date.now();
  const files = writeDrafts(
    pairs.map((p, i) => ({ ...p, source_doc: `qa-${slugify(topic)}-${slugify(p.question).slice(0, 40)}-${stamp}-${i}` })),
    { sectionTitle: level }
  );
  if (files.length === 0) throw new Error('Claude returned no usable Q&A pairs.');
  console.log(`Wrote ${files.length} draft(s):`);
  files.forEach((f) => console.log(`  ${f}`));
  console.log('\nReview them, drop the "status: draft" line to publish, then: npm run generate:pages');
}

// Rewrites answers that are already published but too short. This is the mode
// that addresses "Crawled - currently not indexed": same questions, same URLs,
// more substance. Drafts are written alongside as {slug}--expanded so the
// original is never overwritten unreviewed.
async function expand({ topic, limit, minWords }) {
  const floor = Number(minWords) || 150;
  const max = Number(limit) || 6;
  const thin = readAnswerRows()
    .filter((r) => r.lang === 'en')
    .map((r) => {
      const i = r.content.indexOf('? ');
      return { ...r, q: i === -1 ? r.content : r.content.slice(0, i + 1), a: i === -1 ? '' : r.content.slice(i + 2) };
    })
    .filter((r) => r.a.split(/\s+/).filter(Boolean).length < floor)
    .filter((r) => !topic || r.content.toLowerCase().includes(topic.toLowerCase()))
    // Resumable: anything that already has a draft beside it is skipped, so a
    // rerun fills the gaps left by a failed batch instead of paying to
    // regenerate what worked. Delete a draft to have it redone.
    .filter((r) => !existsSync(answerFilePath('en', `${r.source_doc}--expanded`)))
    .slice(0, max);

  if (thin.length === 0) throw new Error(topic ? `No answers under ${floor} words matching "${topic}".` : `No answers under ${floor} words.`);
  console.log(`Expanding ${thin.length} answer(s)${topic ? ` matching "${topic}"` : ''}:`);
  thin.forEach((r) => console.log(`  ${r.source_doc} (${r.a.split(/\s+/).filter(Boolean).length}w)`));

  // Batched, because one call cannot hold them all. Each answer costs roughly
  // 450 output tokens, so eighteen in one request overruns any sane max_tokens
  // and the reply comes back truncated -- which used to parse into a short
  // array, match no ids, and report "Wrote 0 draft(s)" as though it had
  // succeeded. Five at a time, sized to the batch, and anything that does not
  // come back is named rather than silently dropped.
  const BATCH = 5;
  const byId = new Map();
  for (let i = 0; i < thin.length; i += BATCH) {
    const slice = thin.slice(i, i + BATCH);
    process.stdout.write(`  requesting ${i + 1}-${i + slice.length} of ${thin.length}... `);
    let rewritten;
    try {
      rewritten = await askClaude(
        `Rewrite each of these wine answers at proper length. Keep the question exactly as given -- it is a live URL. Keep whatever the current answer asserts as true unless it is plainly wrong; you are deepening it, not replacing it.

${HOUSE_STYLE}

${JSON.stringify(slice.map((r) => ({ id: r.source_doc, question: r.q, current: r.a })), null, 1)}

Respond with ONLY a JSON array: [{"id": "...", "answer": "..."}]`,
        // 900 per answer, not 600. A 200-word answer is ~270 tokens, but the
        // JSON wrapper, long em-dashed sentences and the occasional overrun
        // push past a tight budget, and a truncated reply is unparseable --
        // the whole batch is lost for the sake of a few hundred tokens.
        slice.length * 900
      );
    } catch (error) {
      // One bad batch should not discard the ones that worked.
      console.log(`failed (${error.message.split('\n')[0].slice(0, 60)})`);
      continue;
    }
    for (const { id, answer } of rewritten) if (id && answer) byId.set(id, answer);
    console.log(`${rewritten.length} back`);
  }

  const missing = thin.filter((r) => !byId.get(r.source_doc));
  if (missing.length) {
    console.warn(`\n  !! ${missing.length} answer(s) came back empty or unmatched:`);
    missing.forEach((r) => console.warn(`     ${r.source_doc}`));
  }

  const files = writeDrafts(
    thin
      .filter((r) => byId.get(r.source_doc))
      .map((r) => ({ source_doc: `${r.source_doc}--expanded`, question: r.q, answer: byId.get(r.source_doc) })),
    { sectionTitle: null }
  );

  if (files.length === 0) {
    console.error('\nNothing was written. Nothing was changed.');
    process.exitCode = 1;
    return;
  }
  console.log(`\nWrote ${files.length} draft(s) alongside the originals:`);
  files.forEach((f) => console.log(`  ${f}`));
  console.log('\nReview each, then move the answer into the original file and delete the --expanded draft.');
}

// --- MODE=translate ------------------------------------------------------
//
// Renders an expanded English answer into French, for pages where the two have
// fallen out of step -- which is what promoting an English expansion does:
// hreflang alternates reading 179 words against 18.
//
// Deliberately NOT expand pointed at content/answers/fr. Expanding the French
// independently would produce a French answer that says different things from
// the English one, and a pair that diverges in substance is worse than a pair
// that diverges in length. This takes the English as the source of truth and
// renders it, keeping the existing French question untouched because it is a
// live URL.

async function translate({ topic, limit }) {
  const max = Number(limit) || 10;
  const rows = readAnswerRows();
  const words = (r) => {
    const i = r.content.indexOf('? ');
    return (i === -1 ? '' : r.content.slice(i + 2)).split(/\s+/).filter(Boolean).length;
  };
  const part = (r) => {
    const i = r.content.indexOf('? ');
    return { q: i === -1 ? r.content : r.content.slice(0, i + 1), a: i === -1 ? '' : r.content.slice(i + 2) };
  };
  const fr = new Map(rows.filter((r) => r.lang === 'fr').map((r) => [r.source_doc, r]));

  const pending = rows
    .filter((r) => r.lang === 'en' && words(r) >= 150)
    .filter((r) => fr.has(r.source_doc) && words(fr.get(r.source_doc)) < 150)
    .filter((r) => !topic || r.content.toLowerCase().includes(topic.toLowerCase()))
    .filter((r) => !existsSync(answerFilePath('fr', `${r.source_doc}--translated`)))
    .slice(0, max);

  if (pending.length === 0) throw new Error(topic ? `No English answers ahead of their French pair matching "${topic}".` : 'No English answers ahead of their French pair.');
  console.log(`Translating ${pending.length} answer(s)${topic ? ` matching "${topic}"` : ''}:`);
  pending.forEach((r) => console.log(`  ${r.source_doc}  en ${words(r)}w -> fr ${words(fr.get(r.source_doc))}w`));

  const BATCH = 4;
  const byId = new Map();
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    process.stdout.write(`  requesting ${i + 1}-${i + slice.length} of ${pending.length}... `);
    let out;
    try {
      out = await askClaude(
        `Render each English wine answer below into French, for a Québec readership.

This is a rendering, not a literal translation and not a rewrite. Say what the English says -- same facts, same figures, same structure, same order -- in French that reads as though it were written in French. Do not add claims the English does not make, and do not drop any it does.

${HOUSE_STYLE}

Québec French: use "vous", metric, and natural Québécois usage where it is genuinely idiomatic (croustilles, not chips). Wine terms take their French forms: macération carbonique, élevage, cépage, tanin, acidité. Grape and place names stay as they are.

${JSON.stringify(slice.map((r) => ({ id: r.source_doc, french_question: part(fr.get(r.source_doc)).q, english_answer: part(r).a })), null, 1)}

Respond with ONLY a JSON array: [{"id": "...", "answer": "..."}]`,
        slice.length * 1100
      );
    } catch (error) {
      console.log(`failed (${error.message.split('\n')[0].slice(0, 60)})`);
      continue;
    }
    for (const { id, answer } of out) if (id && answer) byId.set(id, answer);
    console.log(`${out.length} back`);
  }

  const missing = pending.filter((r) => !byId.get(r.source_doc));
  if (missing.length) {
    console.warn(`\n  !! ${missing.length} came back empty or unmatched:`);
    missing.forEach((r) => console.warn(`     ${r.source_doc}`));
  }

  const files = writeDrafts(
    pending
      .filter((r) => byId.get(r.source_doc))
      .map((r) => ({ source_doc: `${r.source_doc}--translated`, question: part(fr.get(r.source_doc)).q, answer: byId.get(r.source_doc) })),
    { lang: 'fr', sectionTitle: null }
  );
  if (files.length === 0) {
    console.error('\nNothing was written. Nothing was changed.');
    process.exitCode = 1;
    return;
  }
  console.log(`\nWrote ${files.length} French draft(s):`);
  files.forEach((f) => console.log(`  ${f}`));
  console.log('\nReview each, then move the answer into the original French file and delete the --translated draft.');
}

// --- MODE=wine-gen ---------------------------------------------------------
// Writes to wines_draft, NOT the live `wines` table. `wines` is read
// directly by ~10 tc-cellar-mobile features (wine-of-the-day,
// recommendations, discovery, bottle-add autocomplete) with no draft filter
// in any of those call sites — unreviewed AI output has no business there.
// Promote a row into `wines`/`producers` by hand after review.

async function wineGen({ region }) {
  if (!region) throw new Error('wine-gen requires --region="..."');

  const message = await anthropic.messages.create({
    model: CONTENT_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Generate a structured list of 8 real, representative wines from ${region}, spanning a range of producers and styles.

Respond with ONLY a minified JSON array, no other text: [{"wine_name": "...", "producer_name": "...", "vintage": 2021, "style": "...", "colour": "red|white|rosé|orange|sparkling", "varietal_blend": {"grape name": percentage, ...}, "notes": "1-2 sentences"}]`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === 'text')?.text ?? '[]';
  let wines;
  try {
    wines = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse Claude's response as JSON: ${text.slice(0, 200)}`);
  }

  const rows = wines
    .filter((w) => w.wine_name)
    .map((w) => ({
      region_name: region,
      wine_name: w.wine_name,
      producer_name: w.producer_name ?? null,
      vintage: w.vintage ?? null,
      style: w.style ?? null,
      colour: w.colour ?? null,
      varietal_blend: w.varietal_blend ?? null,
      notes: w.notes ?? null,
      status: 'draft',
    }));

  if (rows.length === 0) throw new Error('Claude returned no usable wines.');

  const { error } = await supabase.from('wines_draft').insert(rows);
  if (error) throw error;

  console.log(`Generated ${rows.length} new wines for ${region} — staged in wines_draft, review and promote manually.`);
}

// --- Entry point -------------------------------------------------------

async function main() {
  const args = parseArgs();
  switch (args.mode) {
    case 'vault-scan':
      return vaultScan(args);
    case 'translate':
      return translate(args);
    case 'expand':
      return expand(args);
    case 'qa-gen':
      return qaGen(args);
    case 'wine-gen':
      return wineGen(args);
    default:
      throw new Error(`Unknown or missing --mode (got "${args.mode}"). Expected: vault-scan | qa-gen | expand | translate | wine-gen`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
