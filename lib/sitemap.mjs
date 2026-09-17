// Builds sitemap.xml from topics.config.mjs plus every answer-*.html page on
// disk, in both languages. French topic pages (fr/, frReady topics only) are
// included too; they carry hreflang links in their <head> via
// generate-topic-pages.mjs. Answer pages are generated from knowledge_chunks
// by scripts/generate-missing-pages.mjs; reading them from the filesystem
// keeps this synchronous and DB-free. French answer/difficulty pages are
// only included if the fr/ directory exists yet -- a fresh checkout that
// hasn't run the generators shouldn't crash building the sitemap.
//
// Only <loc> is included: no lastmod (we don't track real per-page edit
// times, and fabricating one would be a false freshness signal) and no
// priority/changefreq (both deprecated by every major search engine).

import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { TOPICS, STATIC_PAGES, BASE_URL } from '../topics.config.mjs';
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

// Guide, comparison, grape and region pages from
// scripts/generate-catalog-pages.mjs.
function guidePages(dir, prefix = '') {
  return pagesMatching(/^(guide|comparison|grape|region)-[a-z0-9-]+\.html$/, dir, prefix);
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
  const urls = paths
    .map((path) => `  <url>\n    <loc>${BASE_URL}/${path}</loc>\n  </url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  writeFileSync(`${rootDir}/sitemap.xml`, xml);
  return paths.length;
}
