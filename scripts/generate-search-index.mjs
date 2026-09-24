// Builds the static search index search.html reads: search-index-en.json and
// search-index-fr.json.
//
// Run: node scripts/generate-search-index.mjs   (or npm run generate:search)
//
// search.html used to query Supabase on every keystroke -- an ilike across
// section_title and content. When the table emptied, the page kept working
// and returned nothing, for every query, with no error: "0 results" is what a
// successful search for something absent looks like. A static index cannot
// fail that way, and it removes the last runtime dependency the site had.
//
// Built by reading the generated pages rather than the content files, for one
// reason: every href in the index is then a page that demonstrably exists, in
// the exact spelling it is published under. Deriving hrefs from source_docs
// would reintroduce the class of bug the redirect table exists to paper over.
// It also means grape, region, topic and guide pages are searchable, not just
// answers -- the old Supabase query covered every chunk_type too.
//
// Bodies are capped (see SNIPPET_CHARS). Uncapped, the English index is 569KB
// raw; most of that tail is text no one searches for, and search.html has to
// download the whole file before it can answer anything.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REDIRECTS } from '../redirects.config.mjs';

const SNIPPET_CHARS = 400;
const LANGS = [
  { lang: 'en', dir: '.', out: 'search-index-en.json' },
  { lang: 'fr', dir: 'fr', out: 'search-index-fr.json' },
];

// Pages that are navigation, not content. Searching them returns the page the
// reader is already standing on.
const SKIP = new Set([
  'index.html',
  'answers.html',
  'grapes.html',
  'regions.html',
  'guides.html',
  'search.html',
  'about.html',
  '404.html',
]);

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

const text = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// One entry per page: [href, title, snippet]. Arrays rather than objects
// because the key names would otherwise repeat 1,400 times.
function indexFor({ lang, dir }) {
  const items = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    if (SKIP.has(file)) continue;
    const key = `${dir === 'fr' ? 'fr/' : ''}${file}`;
    if (key in REDIRECTS) continue;

    const html = readFileSync(path.join(dir, file), 'utf8');
    if (/Redirect stub/.test(html)) continue;

    const title = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');
    if (!title) continue;

    // Only the page's own prose. Every page type ends in a list of links to
    // other pages -- "Keep Going" on an answer, "132 Answers On Oak" on a
    // topic -- and indexing those made a short answer's snippet mostly the
    // titles of three unrelated answers, and made every query match every
    // page that happened to link a match.
    //
    // Answers keep their prose in <article class="sheet">. Grape, region and
    // guide pages use .body-copy per section. Topic pages have neither: their
    // prose is the hero lede and fact list, and everything below it is links.
    const sheet = html.match(/<article class="sheet">([\s\S]*?)<\/article>/)?.[1];
    const body = text(
      sheet ??
        [
          html.match(/<p class="lede sm">([\s\S]*?)<\/p>/)?.[1] ?? '',
          ...[...html.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => `${m[1]}: ${m[2]}`),
          ...[...html.matchAll(/<div class="body-copy">([\s\S]*?)<\/div>/g)].map((m) => m[1]),
        ].join(' ')
    );
    if (!body) continue;

    items.push([file, title, body.slice(0, SNIPPET_CHARS)]);
  }
  return items;
}

for (const target of LANGS) {
  const items = indexFor(target);
  if (items.length === 0) throw new Error(`${target.out}: no pages indexed`);
  const json = JSON.stringify({ v: 1, lang: target.lang, items });
  writeFileSync(target.out, json);
  console.log(`  -> ${target.out} (${items.length} pages, ${(json.length / 1024).toFixed(0)}KB)`);
}
