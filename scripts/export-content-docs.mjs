// One-time: lifts grape / region / topic / enology / guide / comparison
// content out of the generated pages into content/docs/{en,fr}/*.md, so the
// repo holds it rather than Supabase.
//
// Run: node scripts/export-content-docs.mjs [--dry-run]
//
// Companion to export-content-files.mjs, which did the same for answers. That
// one had it easier: answer pages carry a FAQPage JSON-LD holding the original
// chunk text verbatim. These pages have no such thing, so the body has to be
// un-rendered from the HTML that lib/markdown.mjs produced. The subset is
// small -- <p>, <br>, <ul>/<ol>, <strong>, <em> -- and the inverse is faithful,
// with two known losses:
//
//   - ordered lists come back as "1." throughout, because renderMarkdown
//     discards the original numbering
//   - section_title is taken from the rendered <h2>, not the original column
//
// The second one has teeth: sectionAnchor() slugifies section_title into the
// in-page anchors regions.html links to. Verify the anchors round-trip after
// running this, which scripts/verify-doc-roundtrip.mjs does.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { writeDocFile, docFilePath, parseDoc, DOCS_DIR } from '../lib/content-docs.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
// --only=region-burgundy limits the run to one source_doc. Re-extracting all
// 490 documents to repair one is a lot of blast radius for no reason.
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length) ?? null;

// Which page prefixes hold which chunk_type. Topic pages are the odd one:
// their Overview belongs to the topic's own sourceDoc (grape-riesling,
// region-burgundy, enology-oak), not to "topic-riesling".
// hasOverview marks the page types whose hero is a real Overview chunk.
// Only buildGrapePages renders one (`eyebrow: overview.eyebrow`); topic pages
// render the Overview of the topic's own source_doc. buildSectionPages and
// buildGuidePages SYNTHESISE their hero -- the eyebrow is "Wine Region · 8
// sections" and the lede is shorten(firstSection.body), truncated at 160
// characters with an ellipsis. Extracting that as an Overview would invent a
// chunk that does not exist and store corrupted, truncated text as content.
const KINDS = [
  { prefix: 'grape', chunkType: 'grape', hasOverview: true },
  { prefix: 'region', chunkType: 'region', hasOverview: false },
  { prefix: 'enology', chunkType: 'enology', hasOverview: false },
  { prefix: 'guide', chunkType: 'guide', hasOverview: false },
  { prefix: 'comparison', chunkType: 'comparison', hasOverview: false },
];

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

const strip = (html) => decode(html.replace(/<[^>]+>/g, '')).trim();

const inlineToMarkdown = (html) =>
  decode(
    html
      .replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
      .replace(/<em>([\s\S]*?)<\/em>/g, '*$1*')
      .replace(/<[^>]+>/g, '')
  ).trim();

// The inverse of lib/markdown.mjs over the subset it emits.
function htmlToMarkdown(html) {
  const blocks = [];
  for (const [, tag, inner] of html.matchAll(/<(p|ul|ol)>([\s\S]*?)<\/\1>/g)) {
    if (tag === 'p') {
      blocks.push(inner.split(/<br\s*\/?>/).map(inlineToMarkdown).join('\n'));
    } else {
      const items = [...inner.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((i) => inlineToMarkdown(i[1]));
      blocks.push(items.map((item) => (tag === 'ul' ? `- ${item}` : `1. ${item}`)).join('\n'));
    }
  }
  return blocks.join('\n\n').trim();
}

// eyebrow / name / lede / facts, in the layout parseOverview() reads back.
function overviewBody(html) {
  const eyebrow = strip(html.match(/<p class="eyebrow">([\s\S]*?)<\/p>/)?.[1] ?? '');
  const name = strip(html.match(/<h1 class="display">([\s\S]*?)<\/h1>/)?.[1] ?? '');
  const lede = strip(html.match(/<p class="lede sm">([\s\S]*?)<\/p>/)?.[1] ?? '');
  const facts = [...html.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)]
    .map(([, k, v]) => `${strip(k)}: ${strip(v)}`)
    .join('\n');
  return name ? [eyebrow, name, lede, facts].filter(Boolean).join('\n\n') : null;
}

function sectionsOf(html) {
  const out = [];
  for (const [, attrs, section] of html.matchAll(/<section class="guide-part"([^>]*)>([\s\S]*?)<\/section>/g)) {
    const heading = strip(section.match(/<h2 class="guide-part-title">([\s\S]*?)<\/h2>/)?.[1] ?? '');
    const body = htmlToMarkdown(section.match(/<div class="body-copy">([\s\S]*?)<\/div>/)?.[1] ?? '');
    // Capture the anchor the page already publishes rather than deriving one.
    // It is slugify(section_title), and section_title is not the heading -- see
    // the note in lib/content-docs.mjs. Guide and comparison sections carry no
    // id at all, so those get null and fall back to the heading.
    const anchor = attrs.match(/\bid="([^"]+)"/)?.[1] ?? null;
    if (heading && body) out.push({ heading, anchor, body });
  }
  return out;
}

const written = { en: 0, fr: 0 };
const skipped = [];

for (const [dir, lang] of [['.', 'en'], ['fr', 'fr']]) {
  const files = readdirSync(dir);

  for (const { prefix, chunkType, hasOverview } of KINDS) {
    for (const file of files.filter((f) => new RegExp(`^${prefix}-.*\\.html$`).test(f))) {
      const html = readFileSync(path.join(dir, file), 'utf8');
      if (/Redirect stub/.test(html)) continue;
      const sourceDoc = file.replace(/\.html$/, '');
      if (ONLY && sourceDoc !== ONLY) continue;

      const sections = [];
      if (hasOverview) {
        const overview = overviewBody(html);
        if (overview) sections.push({ heading: 'Overview', body: overview });
      }
      sections.push(...sectionsOf(html));

      if (sections.length === 0) {
        skipped.push(`${dir === '.' ? '' : 'fr/'}${file} (nothing extractable)`);
        continue;
      }
      if (!DRY_RUN) writeDocFile(lang, { source_doc: sourceDoc, chunk_type: chunkType, sections });
      written[lang]++;
    }
  }

  // Topic pages carry the Overview for the topic's own source_doc, and for
  // enology topics their explainer sections too. buildGrapePages skips a grape
  // whose Overview belongs to a topic, so without this those documents have no
  // file at all.
  const { TOPICS } = await import('../topics.config.mjs');
  for (const topic of TOPICS) {
    if (ONLY && topic.sourceDoc !== ONLY) continue;
    const file = path.join(dir, `topic-${topic.slug}.html`);
    let html;
    try {
      html = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (/Redirect stub/.test(html)) continue;

    const sections = [];
    const overview = overviewBody(html);
    if (overview) sections.push({ heading: 'Overview', body: overview });
    if (topic.kind === 'enology') sections.push(...sectionsOf(html));
    if (sections.length === 0) continue;

    // MERGE, do not overwrite. A topic's sourceDoc is often also a page the
    // KINDS pass above already extracted -- topic-burgundy's Overview belongs
    // to region-burgundy, which has its own region-burgundy.html with eleven
    // sections in it. Writing this file outright threw those away and left a
    // document holding nothing but an Overview, which buildSectionPages()
    // then skips for having no sections, so the stale page survived and
    // silently stopped being regenerated.
    const existing = existsSync(docFilePath(lang, topic.sourceDoc))
      ? parseDoc(readFileSync(docFilePath(lang, topic.sourceDoc), 'utf8'), docFilePath(lang, topic.sourceDoc)).sections
      : [];
    const kept = existing.filter((s) => s.heading !== 'Overview');
    const merged = [...sections, ...kept.filter((s) => !sections.some((n) => n.heading === s.heading))];
    if (!DRY_RUN) writeDocFile(lang, { source_doc: topic.sourceDoc, chunk_type: topic.kind, sections: merged });
    written[lang]++;
  }
}

console.log(DRY_RUN ? 'DRY RUN — nothing written\n' : `wrote ${DOCS_DIR}/\n`);
console.log(`  en: ${written.en}`);
console.log(`  fr: ${written.fr}`);
console.log(`  total: ${written.en + written.fr}`);
if (skipped.length) {
  console.log(`\nskipped ${skipped.length}:`);
  skipped.slice(0, 10).forEach((s) => console.log(`  ${s}`));
}
