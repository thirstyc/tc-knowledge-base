import { readdir, readFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import { supabase } from './lib/supabase.mjs';
import { embed } from './lib/embeddings.mjs';
import { chunkText } from './lib/chunking.mjs';

const INTAKE_DIR = path.resolve('/Users/cathe/Documents/Thirsty Cunt/Knowledge Base');
const ARCHIVE_DIR = path.resolve('archive');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function enrich(content, existingTags, existingCategory) {
  const needsTags = !existingTags?.length;
  const needsCategory = !existingCategory;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Summarize the following knowledge base entry in 1-2 sentences.${
          needsTags ? ' Also suggest 3-5 short lowercase tags.' : ''
        }${needsCategory ? ' Also suggest a single-word category.' : ''}
Respond with ONLY minified JSON in the shape {"summary": string${
          needsTags ? ', "tags": string[]' : ''
        }${needsCategory ? ', "category": string' : ''}}. No other text.

---
${content}`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === 'text')?.text ?? '{}';
  try {
    return JSON.parse(text);
  } catch {
    console.warn('Could not parse enrichment JSON, continuing without it:', text);
    return {};
  }
}

// --source=<prefix> limits the publish to drafts whose source_doc starts with
// that prefix (e.g. --source=sommelier- or --source=qa-gen-). Without it every
// draft row goes live, which is how a vault-scan batch and an unrelated qa-gen
// batch can be published together by accident.
async function publish({ source } = {}) {
  let query = supabase
    .from('knowledge_chunks')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('status', 'draft');

  if (source !== undefined) {
    if (!source) throw new Error('--source needs a value, e.g. --source=sommelier-');
    // source_doc values are slugified, so anything outside this set is a typo
    // or a stray LIKE wildcard ('%' would silently widen the publish).
    if (!/^[A-Za-z0-9._-]+$/.test(source)) {
      throw new Error(`--source must match [A-Za-z0-9._-]+ (got "${source}")`);
    }
    query = query.like('source_doc', `${source}%`);
  }

  const { data, error } = await query.select('id');

  if (error) throw error;
  const scope = source ? `source_doc starting with "${source}"` : 'all sources';
  console.log(`Published ${data.length} chunk(s) (${scope}).`);
}

async function processIntake() {
  await mkdir(INTAKE_DIR, { recursive: true });
  await mkdir(ARCHIVE_DIR, { recursive: true });

  const files = (await readdir(INTAKE_DIR)).filter((f) => f.endsWith('.md'));
  let processed = 0;

  for (const file of files) {
    const filePath = path.join(INTAKE_DIR, file);
    const raw = await readFile(filePath, 'utf8');
    const { data, content } = matter(raw);

    if (data.status !== 'pending') {
      console.log(`Skipping ${file}: run \`npm run add\` first (not marked pending).`);
      continue;
    }
    if (!content.trim()) {
      console.warn(`Skipping ${file}: empty content.`);
      continue;
    }

    console.log(`Processing ${file}...`);
    const enrichment = await enrich(content, data.tags, data.category);
    const tags = data.tags?.length ? data.tags : enrichment.tags ?? [];
    const category = data.category ?? enrichment.category ?? null;
    const summary = enrichment.summary ?? null;

    const chunks = chunkText(content);
    const rows = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embed(chunks[i]);
      rows.push({
        source_doc: file,
        chunk_index: i,
        section_title: data.title,
        content: chunks[i],
        summary,
        tags,
        chunk_type: category ?? 'atlas',
        embedding,
        status: 'draft',
      });
    }

    // Idempotent re-processing: clear any prior chunks for this source file.
    const { error: deleteError } = await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('source_doc', file);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from('knowledge_chunks').insert(rows);
    if (insertError) throw insertError;

    await rename(filePath, path.join(ARCHIVE_DIR, file));
    processed++;
    console.log(`  -> ${rows.length} chunk(s) upserted as draft, archived ${file}.`);
  }

  console.log(`Done. ${processed} file(s) processed.`);
}

async function main() {
  if (process.argv.includes('--publish')) {
    const sourceArg = process.argv.find((a) => a === '--source' || a.startsWith('--source='));
    await publish(
      sourceArg === undefined ? {} : { source: sourceArg.replace(/^--source=?/, '') }
    );
  } else {
    await processIntake();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
