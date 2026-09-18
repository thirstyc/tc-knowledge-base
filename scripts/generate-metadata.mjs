// Writes metadata.json: how many published English documents each
// knowledge_chunks chunk_type holds (distinct source_doc, since one doc is
// split into several chunks), plus the current sitemap.xml URL count.
//
// urlsByType counts content in Supabase, not pages on disk -- atlas and
// producer docs have no generated pages yet, so totalUrls can differ from
// sitemapUrls (which also counts fr/, topic and index pages).
//
// Run: node scripts/generate-metadata.mjs   (or npm run generate:metadata)

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function publishedDocsByType() {
  const docs = new Map();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('chunk_type, source_doc')
      .eq('status', 'published')
      .eq('lang', 'en')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const { chunk_type, source_doc } of data) {
      if (!docs.has(chunk_type)) docs.set(chunk_type, new Set());
      docs.get(chunk_type).add(source_doc);
    }
    if (data.length < PAGE_SIZE) break;
  }
  return Object.fromEntries(
    [...docs].map(([type, slugs]) => [type, slugs.size]).sort((a, b) => b[1] - a[1]),
  );
}

const urlsByType = await publishedDocsByType();
const totalUrls = Object.values(urlsByType).reduce((sum, n) => sum + n, 0);
const sitemapUrls = (readFileSync('sitemap.xml', 'utf8').match(/<loc>/g) ?? []).length;
const now = new Date();

const metadata = {
  generated: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  totalUrls,
  urlsByType,
  sitemapUrls,
  lastUpdated: now.toISOString().slice(0, 10),
};
writeFileSync('metadata.json', `${JSON.stringify(metadata, null, 2)}\n`);
console.log(
  `Generated metadata with ${totalUrls} total URLs across ${Object.keys(urlsByType).length} content types` +
    ` (sitemap.xml: ${sitemapUrls} urls)`,
);
