// Writes metadata.json: how many published English documents each
// knowledge_chunks chunk_type holds (distinct source_doc, since one doc is
// split into several chunks), plus the current sitemap.xml URL count.
//
// urlsByType counts content in Supabase, not pages on disk -- atlas and
// producer docs have no generated pages yet, so totalUrls can differ from
// sitemapUrls (which also counts fr/, topic and index pages).
//
// The file is only rewritten when a count changes, so the weekly
// generate-pages workflow doesn't commit a timestamp-only diff.
//
// Run after the sitemap: node scripts/generate-metadata.mjs
// (or npm run generate:metadata)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { fetchAllRows } from '../lib/pagination.mjs';
import { TOPICS } from '../topics.config.mjs';

// Same public anon key as generate-missing-pages.mjs: published rows are
// readable without secrets, so the workflow needs none.
const SUPABASE_URL = 'https://qcyzcjikyqnzvnvmfwtk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeXpjamlreXFuenZudm1md3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTc4NjIsImV4cCI6MjA5MjI5Mzg2Mn0.8Fp1wk_BxQ7NrEQRnMPKX6kdaz-0k7bNj94DN4cLP2U';
const METADATA_PATH = 'metadata.json';

// Topic pages, for about.html's "Topics Covered" figure.
const topicPages = TOPICS.length;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function publishedDocsByType() {
  const rows = await fetchAllRows(() =>
    supabase
      .from('knowledge_chunks')
      .select('chunk_type, source_doc')
      .eq('status', 'published')
      .eq('lang', 'en')
      .order('id'),
  );
  const docs = new Map();
  for (const { chunk_type, source_doc } of rows) {
    if (!docs.has(chunk_type)) docs.set(chunk_type, new Set());
    docs.get(chunk_type).add(source_doc);
  }
  return Object.fromEntries(
    [...docs].map(([type, slugs]) => [type, slugs.size]).sort((a, b) => b[1] - a[1]),
  );
}

const urlsByType = await publishedDocsByType();
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
