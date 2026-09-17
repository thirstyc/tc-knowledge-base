// Inserts new English qa answers from a drafts file into knowledge_chunks.
//
// Run: node scripts/insert-qa-batch.mjs drafts/pairing-batch-3.md [--dry-run]
//
// Draft format (one block per answer, separated by "---" lines):
//
//   ## 1. What wine goes with mussels?
//
//   - **source_doc:** `qa-pairing-mussels`
//
//   Answer paragraphs...
//
// Each row is stored as `question + ' ' + answer` (the shape deriveQuestion()
// expects), chunk_type 'qa', section_title 'Beginner', published. Rows whose
// source_doc already exists are skipped, so re-running is safe. French
// versions come from scripts/translate-to-french-deepl.mjs afterwards.

import { readFileSync } from 'node:fs';
import { supabase } from '../lib/supabase.mjs';

const file = process.argv[2];
const DRY_RUN = process.argv.includes('--dry-run');
if (!file) throw new Error('Usage: node scripts/insert-qa-batch.mjs <drafts file> [--dry-run]');

const text = readFileSync(file, 'utf8');
const answers = [
  ...`${text}\n\n---`.matchAll(/^## \d+\. ([^\n]+)\n\n- \*\*source_doc:\*\* `(qa-[a-z0-9-]+)`\n\n([\s\S]*?)\n+---/gm),
].map(([, question, sourceDoc, body]) => ({ question: question.trim(), sourceDoc, body: body.trim() }));
if (answers.length === 0) throw new Error(`No answers found in ${file}`);

let inserted = 0;
let skipped = 0;
for (const { question, sourceDoc, body } of answers) {
  if (!/\?$/.test(question)) throw new Error(`${sourceDoc}: question must end with "?"`);
  const { data: existing, error: lookupError } = await supabase
    .from('knowledge_chunks')
    .select('id')
    .eq('source_doc', sourceDoc)
    .limit(1);
  if (lookupError) throw lookupError;
  if (existing.length) {
    console.log(`  skip ${sourceDoc} (already exists)`);
    skipped++;
    continue;
  }
  if (!DRY_RUN) {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .insert({
        source_doc: sourceDoc,
        section_title: 'Beginner',
        chunk_type: 'qa',
        content: `${question} ${body}`,
        status: 'published',
        published_at: new Date().toISOString(),
        lang: 'en',
      })
      .select('id')
      .single();
    if (error) throw error;
    console.log(`  -> ${sourceDoc} (id ${data.id})`);
  } else {
    console.log(`  -> ${sourceDoc} (${body.split(/\s+/).length} words)`);
  }
  inserted++;
}
console.log(`${DRY_RUN ? '[dry run] would insert' : 'Inserted'} ${inserted}, skipped ${skipped}.`);
