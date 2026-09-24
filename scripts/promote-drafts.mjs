// Moves reviewed drafts into the real answer files.
//
// Run: node scripts/promote-drafts.mjs [--dry-run]   (or npm run promote)
//
// content-generator.mjs writes its output beside the original rather than over
// it: --mode=expand produces content/answers/en/{slug}--expanded.md, and
// --mode=translate produces content/answers/fr/{slug}--translated.md, both with
// `status: draft` so they render nothing. This is the step that accepts them.
//
// Only the answer body moves. The original's frontmatter and question are kept
// verbatim: the question is a live URL, and section_title is the real
// Beginner/Intermediate label, which a draft does not carry.
//
// Nothing here calls an API, so it costs nothing and can be re-run safely.
// Reject a draft by deleting the file instead.

import { readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseAnswer, serializeAnswer, answerFilePath, CONTENT_DIR, LANGS } from '../lib/content-files.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const SUFFIXES = ['--expanded', '--translated'];

let promoted = 0;
const problems = [];

for (const lang of LANGS) {
  const dir = path.join(CONTENT_DIR, lang);
  if (!existsSync(dir)) continue;
  const drafts = readdirSync(dir).filter((f) => SUFFIXES.some((s) => f.endsWith(`${s}.md`)));

  for (const file of drafts) {
    const draftPath = path.join(dir, file);
    const draft = parseAnswer(readFileSync(draftPath, 'utf8'), draftPath);
    const originalDoc = draft.source_doc.replace(/--(expanded|translated)$/, '');
    const originalPath = answerFilePath(lang, originalDoc);

    if (!existsSync(originalPath)) {
      // A French translation of an answer that had no French page at all --
      // what --mode=translate now produces for a newly written English answer.
      // There is nothing to merge into, so the draft becomes the page: its own
      // translated question (it has no live URL to preserve), and chunk_type
      // and section_title taken from the English original, which is where
      // those belong anyway.
      const sourcePath = answerFilePath(lang === 'fr' ? 'en' : 'fr', originalDoc);
      if (lang !== 'fr' || !existsSync(sourcePath)) {
        problems.push(`${file}: no original at ${originalPath}`);
        continue;
      }
      const source = parseAnswer(readFileSync(sourcePath, 'utf8'), sourcePath);
      if (!DRY_RUN) {
        writeFileSync(
          originalPath,
          serializeAnswer({
            source_doc: originalDoc,
            chunk_type: source.chunk_type,
            section_title: source.section_title,
            status: source.status,
            question: draft.question,
            answer: draft.answer,
          })
        );
        rmSync(draftPath);
      }
      promoted += 1;
      console.log(`  ${lang}   new      ${draft.answer.split(/\s+/).filter(Boolean).length}w  ${originalDoc}`);
      continue;
    }
    if (!draft.answer.trim()) {
      problems.push(`${file}: empty answer, skipped`);
      continue;
    }

    const original = parseAnswer(readFileSync(originalPath, 'utf8'), originalPath);
    const before = original.answer.split(/\s+/).filter(Boolean).length;
    const after = draft.answer.split(/\s+/).filter(Boolean).length;

    if (!DRY_RUN) {
      writeFileSync(
        originalPath,
        serializeAnswer({
          source_doc: original.source_doc,
          chunk_type: original.chunk_type,
          section_title: original.section_title,
          status: original.status,
          question: original.question,
          answer: draft.answer,
        })
      );
      rmSync(draftPath);
    }
    promoted++;
    console.log(`  ${lang}  ${String(before).padStart(3)}w -> ${String(after).padStart(3)}w  ${originalDoc}`);
  }
}

if (problems.length) {
  console.warn(`\n${problems.length} skipped:`);
  problems.forEach((p) => console.warn(`  ${p}`));
}
console.log(
  promoted === 0
    ? '\nNo drafts to promote.'
    : `\n${DRY_RUN ? 'Would promote' : 'Promoted'} ${promoted} draft(s). Run: npm run generate:pages`
);
process.exitCode = problems.length && promoted === 0 ? 1 : 0;
