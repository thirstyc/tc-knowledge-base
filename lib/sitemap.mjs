// Builds sitemap.xml from topics.config.mjs plus every answer-*.html page on
// disk. French topic pages (fr/, frReady topics only) are included too; they
// carry hreflang links in their <head> via generate-topic-pages.mjs.
// Answer pages are generated from knowledge_chunks by
// scripts/generate-missing-pages.mjs; reading them from the filesystem keeps
// this synchronous and DB-free.
//
// Only <loc> is included: no lastmod (we don't track real per-page edit
// times, and fabricating one would be a false freshness signal) and no
// priority/changefreq (both deprecated by every major search engine).

import { readdirSync, writeFileSync } from 'node:fs';
import { TOPICS, STATIC_PAGES, BASE_URL } from '../topics.config.mjs';
import { REDIRECTS } from '../redirects.config.mjs';

function answerPages(rootDir) {
  return readdirSync(rootDir)
    .filter((name) => /^answer-[a-z0-9-]+\.html$/.test(name) && !(name in REDIRECTS))
    .sort();
}

export function writeSitemap(rootDir = '.') {
  const paths = [
    ...new Set([
      ...STATIC_PAGES,
      ...TOPICS.map((t) => `topic-${t.slug}.html`),
      ...TOPICS.filter((t) => t.frReady).map((t) => `fr/topic-${t.slug}.html`),
      ...answerPages(rootDir),
    ]),
  ];
  const urls = paths
    .map((path) => `  <url>\n    <loc>${BASE_URL}/${path}</loc>\n  </url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  writeFileSync(`${rootDir}/sitemap.xml`, xml);
  return paths.length;
}
