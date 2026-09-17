// Regenerates sitemap.xml only (no topic pages).
//
// Run: node scripts/generate-sitemap.mjs   (or npm run generate:sitemap)

import { writeSitemap } from '../lib/sitemap.mjs';

const count = writeSitemap('.');
console.log(`  -> sitemap.xml (${count} urls)`);
