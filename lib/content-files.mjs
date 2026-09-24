// Answer content as files in this repo, rather than rows in Supabase.
//
// Layout: content/answers/{en,fr}/{slug}.md, one file per answer, where slug
// is the source_doc with its "qa-" prefix stripped -- the same slug that
// becomes answer-{slug}.html.
//
//     ---
//     source_doc: qa-albarino-pairing
//     chunk_type: qa
//     section_title: Beginner
//     ---
//     What pairs with Albariño?
//
//     Raw oysters. Raw seafood. Ceviche. Anything coastal.
//
// First paragraph is the question, everything after it is the answer. That
// split is what deriveQuestion() does to a chunk's `content` field, so a file
// and a row carry exactly the same text; readAnswerRows() rejoins them into
// the `content` the generators already expect.
//
// Why files. These pages were generated from knowledge_chunks, which lost its
// contents in September with no backup. The pages survived because they are
// committed here, which is the argument for the content living here too:
// versioned, diffable, restorable from any commit, editable without a
// database, and reviewable in a pull request. Nothing about a static site
// needs a database in the middle.
//
// `id` is not stored. The generators only use it to order rows and to pick
// each page's three "Keep Going" neighbours, so readAnswerRows() assigns ids
// by sorted source_doc. That makes neighbours same-subject (albarin-briny sits
// beside albarin-pairing) instead of insertion-order accidents, and keeps the
// output identical run to run.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

export const CONTENT_DIR = 'content/answers';
export const LANGS = ['en', 'fr'];

// status mirrors what knowledge_chunks used to carry: anything marked draft is
// written to disk but not rendered, so generated copy can be reviewed in a pull
// request before it reaches the site. Absent means published, so the 2,408
// files exported from the live pages need no migration.
const FIELDS = ['source_doc', 'chunk_type', 'section_title', 'status'];

export function serializeAnswer({ source_doc, chunk_type, section_title, status, question, answer }) {
  const front = FIELDS.map((key) => {
    const value = { source_doc, chunk_type, section_title, status }[key];
    return value === null || value === undefined || value === '' ? null : `${key}: ${value}`;
  }).filter(Boolean);
  return `---\n${front.join('\n')}\n---\n\n${question.trim()}\n\n${answer.trim()}\n`;
}

export function parseAnswer(text, file) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    meta[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  const body = match[2].trim();
  // First blank-line-separated block is the question; the rest is the answer.
  const split = body.indexOf('\n\n');
  const question = (split === -1 ? body : body.slice(0, split)).trim();
  const answer = (split === -1 ? '' : body.slice(split)).trim();
  if (!meta.source_doc) throw new Error(`${file}: frontmatter has no source_doc`);
  if (!question) throw new Error(`${file}: no question`);
  return { ...meta, question, answer };
}

export function answerFilePath(lang, sourceDoc) {
  return path.join(CONTENT_DIR, lang, `${sourceDoc.replace(/^qa-/, '')}.md`);
}

export function writeAnswerFile(lang, row) {
  const file = answerFilePath(lang, row.source_doc);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, serializeAnswer(row));
  return file;
}

// Rows in the shape the generators already consume: the same fields
// knowledge_chunks returned, with `content` rejoined as "question answer".
//
// Drafts are excluded unless includeDrafts is set, so an unreviewed file can
// sit in the tree without appearing on the site.
export function readAnswerRows({ includeDrafts = false } = {}) {
  const rows = [];
  for (const lang of LANGS) {
    const dir = path.join(CONTENT_DIR, lang);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
      const full = path.join(dir, file);
      const parsed = parseAnswer(readFileSync(full, 'utf8'), full);
      if (!includeDrafts && parsed.status === 'draft') continue;
      rows.push({
        status: parsed.status ?? 'published',
        source_doc: parsed.source_doc,
        chunk_type: parsed.chunk_type || 'qa',
        section_title: parsed.section_title ?? null,
        content: `${parsed.question} ${parsed.answer}`.trim(),
        lang,
        file: full,
      });
    }
  }
  // Stable, content-independent ids so regenerating an unchanged tree produces
  // no diff. Assigned per language so the two stay aligned with each other.
  for (const lang of LANGS) {
    rows
      .filter((r) => r.lang === lang)
      .sort((a, b) => a.source_doc.localeCompare(b.source_doc))
      .forEach((row, index) => {
        row.id = index + 1;
      });
  }
  return rows;
}
