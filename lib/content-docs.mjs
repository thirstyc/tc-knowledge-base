// Section-based content (grapes, regions, topics, enology, guides,
// comparisons) as files in this repo, rather than rows in Supabase.
//
// Layout: content/docs/{en,fr}/{source_doc}.md, one file per document. Unlike
// answers -- one chunk, one file -- these documents are several chunks each,
// so a file holds the whole document and `## ` delimits its chunks:
//
//     ---
//     source_doc: region-australia
//     chunk_type: region
//     ---
//
//     ## Overview
//
//     Wine Region / Australia
//
//     Australia
//
//     A continent's worth of climates...
//
//     Also Called: ...
//     Typical Alcohol: ...
//
//     ## Shiraz — the flagship
//
//     Shiraz (the same grape as Syrah) is Australia's signature red...
//
// Each `## ` heading becomes one knowledge_chunks-shaped row. "Overview" is
// the row the topic and grape pages render as their hero, and its body keeps
// the eyebrow / name / lede / facts layout parseOverview() expects. Every
// other heading is a section row whose content opens with that heading line,
// which is the shape splitHeading() reads back.
//
// A section may carry an explicit anchor: `## Heading {#the-anchor}`.
//
// This is not decoration. The in-page anchors regions.html and the topic pages
// link to are slugify(section_title), and section_title is a column the page
// never renders -- it is NOT the heading. On the enology documents the two
// diverge: the heading reads "Sulfur dioxide (SO2) - the winemaker's essential
// tool" and slugifies to "...winemaker-s...", while the live anchor is
// "...winemakers...". Re-deriving anchors from headings would have silently
// broken every one of those inbound links. The anchor is therefore stored as
// captured from the page, and only falls back to slugifying the heading when
// a section has none (a new section someone writes by hand).

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

export const DOCS_DIR = 'content/docs';
export const LANGS = ['en', 'fr'];

const FIELDS = ['source_doc', 'chunk_type', 'status'];

export function serializeDoc({ source_doc, chunk_type, status, sections }) {
  const front = FIELDS.map((key) => {
    const value = { source_doc, chunk_type, status }[key];
    return value === null || value === undefined || value === '' ? null : `${key}: ${value}`;
  }).filter(Boolean);
  const body = sections
    .map(({ heading, anchor, body: text }) =>
      `## ${heading.trim()}${anchor ? ` {#${anchor}}` : ''}\n\n${text.trim()}`
    )
    .join('\n\n');
  return `---\n${front.join('\n')}\n---\n\n${body}\n`;
}

export function parseDoc(text, file) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    meta[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  if (!meta.source_doc) throw new Error(`${file}: frontmatter has no source_doc`);

  const sections = [];
  // Split on "## " at the start of a line. A body may itself contain "##"
  // mid-line, so anchor the match.
  const parts = match[2].split(/\n(?=## )/);
  for (const part of parts) {
    const m = part.match(/^##\s+(.*?)\n([\s\S]*)$/);
    if (!m) continue;
    const withAnchor = m[1].trim().match(/^(.*?)\s*\{#([^}]+)\}$/);
    sections.push({
      heading: (withAnchor ? withAnchor[1] : m[1]).trim(),
      anchor: withAnchor ? withAnchor[2].trim() : null,
      body: m[2].trim(),
    });
  }
  if (sections.length === 0) throw new Error(`${file}: no "## " sections`);
  return { ...meta, sections };
}

export function docFilePath(lang, sourceDoc) {
  return path.join(DOCS_DIR, lang, `${sourceDoc}.md`);
}

export function writeDocFile(lang, doc) {
  const file = docFilePath(lang, doc.source_doc);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, serializeDoc(doc));
  return file;
}

// Rows in the shape the generators already consume from knowledge_chunks.
// `id` is assigned by document order then section order, which is what the
// generators use for ordering only -- stable run to run, no diff churn.
export function readDocRows({ chunkType = null, lang = 'en', includeDrafts = false } = {}) {
  const dir = path.join(DOCS_DIR, lang);
  if (!existsSync(dir)) return [];
  const rows = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const full = path.join(dir, file);
    const doc = parseDoc(readFileSync(full, 'utf8'), full);
    if (!includeDrafts && doc.status === 'draft') continue;
    if (chunkType && doc.chunk_type !== chunkType) continue;
    for (const { heading, anchor, body } of doc.sections) {
      rows.push({
        source_doc: doc.source_doc,
        chunk_type: doc.chunk_type,
        section_title: heading,
        anchor,
        // Three content layouts, because the generators use three readers:
        //   Overview            parseOverview() -- eyebrow/name/lede/facts, no heading line
        //   guide, comparison   splitPart()     -- heading is the first BLOCK, split on a blank line
        //   everything else     splitHeading()  -- heading is the first LINE
        // Joining a guide's heading to its body with a single newline makes
        // splitPart() read the heading and the first paragraph as one heading.
        content:
          heading === 'Overview'
            ? body
            : `${heading}${['guide', 'comparison'].includes(doc.chunk_type) ? '\n\n' : '\n'}${body}`,
        lang,
        file: full,
      });
    }
  }
  rows.forEach((row, index) => {
    row.id = index + 1;
  });
  return rows;
}
