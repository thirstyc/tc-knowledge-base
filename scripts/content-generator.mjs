// Three content-ingestion modes for knowledge_chunks (and, for wine-gen,
// the wines_draft staging table). Everything this script writes lands as
// status='draft' — nothing it does is visible on the live site until
// someone runs `npm run publish` (process-knowledge-intake.mjs --publish).
//
// Needs SUPABASE_SERVICE_ROLE_KEY (via lib/supabase.mjs) because inserting
// into knowledge_chunks requires bypassing the public-read-only RLS policy.
//
// Usage:
//   node scripts/content-generator.mjs --mode=vault-scan
//   node scripts/content-generator.mjs --mode=qa-gen --topic="Chenin Blanc" --difficulty=Beginner
//   node scripts/content-generator.mjs --mode=wine-gen --region="Priorat"

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import { supabase } from '../lib/supabase.mjs';
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
// Both vault paths already exist elsewhere in this repo (add-intake.mjs /
// process-knowledge-intake.mjs use the first; process-obsidian-to-supabase.js
// uses the second) — this is the first script that reads both in one pass.
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

// --- MODE=qa-gen ---------------------------------------------------------

const VALID_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

async function qaGen({ topic, difficulty }) {
  if (!topic) throw new Error('qa-gen requires --topic="..."');
  const normalizedDifficulty =
    VALID_DIFFICULTIES.find((d) => d.toLowerCase() === (difficulty || '').toLowerCase()) || 'Beginner';

  const message = await anthropic.messages.create({
    model: CONTENT_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Generate 5-10 wine Q&A pairs about "${topic}" at ${normalizedDifficulty} difficulty.

Match this exact house style — terse, factual, no fluff, short sentences, ends assertively:

"Is Assyrtiko Only From Santorini? Mostly. Santorini is home. You'll find small plantings in Paros and other Aegean islands. But 90%+ is Santorini. The volcanic terroir is the story."

"Why does Refosco taste so dark and peppery? Slovenian/Italian red. High tannin. Pepper. Dark."

Respond with ONLY a minified JSON array, no other text: [{"question": "...", "answer": "..."}]`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === 'text')?.text ?? '[]';
  let pairs;
  try {
    pairs = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse Claude's response as JSON: ${text.slice(0, 200)}`);
  }

  const rows = [];
  const stamp = Date.now();
  for (let i = 0; i < pairs.length; i++) {
    const { question, answer } = pairs[i];
    if (!question || !answer) continue;
    const content = `${question} ${answer}`;
    rows.push({
      source_doc: `qa-gen-${slugify(topic)}-${normalizedDifficulty.toLowerCase()}-${stamp}-${i}`,
      content,
      chunk_type: 'qa',
      section_title: normalizedDifficulty,
      // Local, deterministic, no extra API call — a truncated answer is a
      // reasonable proxy summary and matches "generate locally" for this mode.
      summary: answer.length > 150 ? `${answer.slice(0, 150)}...` : answer,
      status: 'draft',
      embedding: await embed(content),
    });
  }

  if (rows.length === 0) throw new Error('Claude returned no usable Q&A pairs.');

  const { error } = await supabase.from('knowledge_chunks').insert(rows);
  if (error) throw error;

  console.log(
    `Generated ${rows.length} Q&A drafts — review at https://supabase.com/dashboard/project/qcyzcjikyqnzvnvmfwtk/editor`
  );
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
    case 'qa-gen':
      return qaGen(args);
    case 'wine-gen':
      return wineGen(args);
    default:
      throw new Error(`Unknown or missing --mode (got "${args.mode}"). Expected: vault-scan | qa-gen | wine-gen`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
