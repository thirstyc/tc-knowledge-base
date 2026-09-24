// Builds sitemap.xml from topics.config.mjs plus every answer-*.html page on
// disk, in both languages. French topic pages (fr/, frReady topics only) are
// included too; they carry hreflang links in their <head> via
// generate-topic-pages.mjs. Answer pages are generated from knowledge_chunks
// by scripts/generate-missing-pages.mjs; reading them from the filesystem
// keeps this synchronous and DB-free. French answer/difficulty pages are
// only included if the fr/ directory exists yet -- a fresh checkout that
// hasn't run the generators shouldn't crash building the sitemap.
//
// <lastmod> is emitted only for pages whose content file has a real edit in
// git -- see lib/content-dates.mjs for why most do not, and why omitting it is
// better than stamping the migration date across the whole corpus. No
// priority/changefreq (both deprecated by every major search engine).

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { TOPICS, STATIC_PAGES, BASE_URL } from '../topics.config.mjs';
import { contentEditDates } from './content-dates.mjs';
import { REDIRECTS } from '../redirects.config.mjs';

// prefix is the page's path relative to the site root ('' or 'fr/'), which
// is how REDIRECTS keys are written.
function pagesMatching(pattern, dir, prefix = '') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => pattern.test(name) && !(`${prefix}${name}` in REDIRECTS))
    .sort();
}

function answerPages(dir, prefix = '') {
  return pagesMatching(/^answer-[a-z0-9-]+\.html$/, dir, prefix);
}

// Guide, comparison, grape, region and enology pages from
// scripts/generate-catalog-pages.mjs.
function guidePages(dir, prefix = '') {
  return pagesMatching(/^(guide|comparison|grape|region|enology)-[a-z0-9-]+\.html$/, dir, prefix);
}

// The static pages with a real French counterpart: '' (the homepage,
// listed as fr/ -- the same directory-style URL as the English '/', so
// search engines don't see fr/ and fr/index.html as two pages),
// about/answers/grapes/regions/guides. Not every STATIC_PAGES entry
// qualifies -- answer-grenache-alcohol-tannin.html is a single hand-authored
// answer page with no French twin, and the difficulty pages are handled
// separately below (their own existsSync-gated block, mirroring answer
// pages' per-directory listing rather than a fixed filename swap).
const STATIC_PAGES_WITH_FR = ['', 'about.html', 'answers.html', 'grapes.html', 'regions.html', 'guides.html'];

// The content file a page is generated from, so its edit date can be looked
// up. Browse pages (answers.html, grapes.html), the homepage and the other
// hand-authored pages have no single content file behind them and get no
// lastmod -- answers.html genuinely changes whenever any of 1,170 answers
// does, which is not a freshness claim worth making about the page itself.
function contentFileFor(path) {
  const isFr = path.startsWith('fr/');
  const name = isFr ? path.slice(3) : path;
  const lang = isFr ? 'fr' : 'en';

  const answer = name.match(/^answer-(.+)\.html$/);
  if (answer) return `content/answers/${lang}/${answer[1]}.md`;

  const topic = name.match(/^topic-(.+)\.html$/);
  if (topic) {
    const sourceDoc = TOPICS.find((t) => t.slug === topic[1])?.sourceDoc;
    return sourceDoc ? `content/docs/${lang}/${sourceDoc}.md` : null;
  }

  const doc = name.match(/^((?:guide|comparison|grape|region|enology)-.+)\.html$/);
  if (doc) return `content/docs/${lang}/${doc[1]}.md`;

  return null;
}

export function writeSitemap(rootDir = '.') {
  const frDir = `${rootDir}/fr`;
  const difficultyPages = STATIC_PAGES.filter((p) => p.startsWith('difficulty-'));
  const frStaticPages = existsSync(frDir)
    ? STATIC_PAGES_WITH_FR.map((p) => `fr/${p}`)
    : [];

  const paths = [
    ...new Set([
      ...STATIC_PAGES,
      ...frStaticPages,
      ...TOPICS.map((t) => `topic-${t.slug}.html`),
      ...TOPICS.filter((t) => t.frReady).map((t) => `fr/topic-${t.slug}.html`),
      ...answerPages(rootDir),
      ...answerPages(frDir, 'fr/').map((name) => `fr/${name}`),
      ...guidePages(rootDir),
      ...guidePages(frDir, 'fr/').map((name) => `fr/${name}`),
      ...(existsSync(frDir) ? difficultyPages.map((p) => `fr/${p}`) : []),
    ]),
  ];
  const editDates = contentEditDates({ cwd: rootDir });
  const urls = paths
    .map((path) => {
      const lastmod = editDates.get(contentFileFor(path));
      return `  <url>\n    <loc>${BASE_URL}/${path}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  writeFileSync(`${rootDir}/sitemap.xml`, xml);
  return paths.length;
}
