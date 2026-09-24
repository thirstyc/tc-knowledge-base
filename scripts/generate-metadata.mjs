// Writes metadata.json: how many English documents each chunk_type holds
// (distinct source_doc, since one document is several chunks), plus the
// current sitemap.xml URL count.
//
// Counts come from content/docs/ and content/answers/, not Supabase. atlas and
// producer content appears in neither -- those types never had generated
// pages, so there was nothing to extract them from when the content moved into
// this repo, and they are gone. totalUrls drops accordingly. sitemapUrls also
// counts fr/, topic and index pages, so the two were never meant to match.
//
// The file is only rewritten when a count changes, so the weekly
// generate-pages workflow doesn't commit a timestamp-only diff.
//
// Run after the sitemap: node scripts/generate-metadata.mjs
// (or npm run generate:metadata)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readDocRows } from '../lib/content-docs.mjs';
import { readAnswerRows } from '../lib/content-files.mjs';
import { TOPICS } from '../topics.config.mjs';

const METADATA_PATH = 'metadata.json';
const topicPages = TOPICS.length;

// Counted from the content files in this repo, not from Supabase. One
// document can be several chunks, so this counts distinct source_docs --
// the same thing the old `select distinct source_doc` did.
function publishedDocsByType() {
  const docs = new Map();
  const add = ({ chunk_type, source_doc }) => {
    if (!docs.has(chunk_type)) docs.set(chunk_type, new Set());
    docs.get(chunk_type).add(source_doc);
  };
  readDocRows({ lang: 'en' }).forEach(add);
  readAnswerRows().filter((r) => r.lang === 'en').forEach(add);
  return Object.fromEntries([...docs].map(([type, slugs]) => [type, slugs.size]).sort((a, b) => b[1] - a[1]));
}

const urlsByType = publishedDocsByType();
const counts = {
  totalUrls: Object.values(urlsByType).reduce((sum, n) => sum + n, 0),
  urlsByType,
  sitemapUrls: (readFileSync('sitemap.xml', 'utf8').match(/<loc>/g) ?? []).length,
  topicPages,
};
const summary =
  `${counts.totalUrls} total URLs across ${Object.keys(urlsByType).length} content types` +
  ` (sitemap.xml: ${counts.sitemapUrls} urls)`;

const previous = existsSync(METADATA_PATH) ? JSON.parse(readFileSync(METADATA_PATH, 'utf8')) : null;
const unchanged =
  previous &&
  JSON.stringify({ totalUrls: previous.totalUrls, urlsByType: previous.urlsByType, sitemapUrls: previous.sitemapUrls, topicPages: previous.topicPages }) ===
    JSON.stringify(counts);

if (unchanged) {
  console.log(`  -> metadata.json unchanged (${summary})`);
} else {
  const now = new Date();
  const metadata = {
    generated: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    totalUrls: counts.totalUrls,
    urlsByType,
    sitemapUrls: counts.sitemapUrls,
    topicPages,
    lastUpdated: now.toISOString().slice(0, 10),
  };
  writeFileSync(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Generated metadata with ${summary}`);
}
