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

async function publish() {
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('status', 'draft')
    .select('id');

  if (error) throw error;
  console.log(`Published ${data.length} chunk(s).`);
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
    await publish();
  } else {
    await processIntake();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
