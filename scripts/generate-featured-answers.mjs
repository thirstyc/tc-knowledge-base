// Refreshes the three featured answers on index.html and fr/index.html from
// content/answers.
//
// Run: node scripts/generate-featured-answers.mjs  (or npm run generate:featured)
//
// index.html is hand-authored and stays that way -- this rewrites one <ul> in
// it and touches nothing else.
//
// It used to be filled at runtime: the page shipped with three answers already
// rendered and a script re-fetched them from Supabase on load, so a failed
// request left the static copy in place. That was a sound design when the
// database was the source of truth. It isn't any more, so the fetch could only
// ever fail, and the static copy it fell back to had no way to stay in step
// with the files. Writing it at build time is both halves of the fix.

import { readFileSync, writeFileSync } from 'node:fs';
import { readAnswerRows, answerParts } from '../lib/content-files.mjs';
import { answerPagePath, escapeHtml, frenchSpacing } from '../lib/page-shell.mjs';

// Keyed by source_doc, which a row shares with its French translation, so both
// homepages feature the same three answers.
const FEATURED = ['qa-cabernet-sauvignon-aging', 'qa-nebbiolo-barolo-vs-barbaresco', 'qa-sangiovese-food'];

const SENTENCES = 2;

function firstSentences(text, count) {
  return text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).slice(0, count).join(' ');
}

const rows = readAnswerRows();

for (const [file, lang] of [['index.html', 'en'], ['fr/index.html', 'fr']]) {
  const items = FEATURED.map((sourceDoc) => {
    const row = rows.find((r) => r.source_doc === sourceDoc && r.lang === lang);
    if (!row) throw new Error(`${file}: no ${lang} answer for ${sourceDoc}`);
    const { question, answer } = answerParts(row);
    return (
      `          <li><a href="${answerPagePath(row.source_doc)}">` +
      `<span class="q">${escapeHtml(question)}</span>` +
      `<span class="a">${escapeHtml(firstSentences(answer, SENTENCES))}</span></a></li>`
    );
  }).join('\n');

  const html = readFileSync(file, 'utf8');
  const block = /(<ul class="q-list q-questions" id="featured-answers">\n)[\s\S]*?(\n\s*<\/ul>)/;
  if (!block.test(html)) throw new Error(`${file}: no #featured-answers list found`);
  writeFileSync(file, frenchSpacing(html.replace(block, `$1${items}$2`), lang));
  console.log(`  -> ${file} (${FEATURED.length} featured answers)`);
}
