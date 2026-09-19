// Old URL -> new URL, as paths relative to the site root.
//
// GitHub Pages (see CNAME) can't send real 301s and ignores Netlify/Vercel
// `_redirects` files, so scripts/generate-redirects.mjs writes a tiny stub
// page at each old path: an instant meta refresh (which Google treats as a
// permanent redirect) plus rel=canonical to the target. lib/sitemap.mjs
// reads this list to keep the stubs out of sitemap.xml.
//
// Every target must be a page that exists — generate-redirects.mjs refuses
// to write a stub that points at a 404.
//
// Listing a generated answer page here retires it: generate-missing-pages.mjs,
// generate-topic-pages.mjs, and scripts/generate-catalog-pages.mjs all skip
// its row (even while it's still published in knowledge_chunks) wherever
// they'd otherwise link to it, and generate-redirects.mjs replaces the page
// itself with a stub. French pages need their own fr/ entry.

export const REDIRECTS = {
  // answer-region-adour-positioning.html / answer-region-alentejo-style.html
  // don't exist (no Adour or Alentejo answer pages have been generated), so
  // these go to the regions archive until they are.
  'answer-region-adour-pairing.html': 'regions.html',
  'answer-region-alentejo-audience.html': 'regions.html',
  'answer-pairing-riesling-thai.html': 'topic-riesling.html',
  'answer-vintage-variation-guide.html': 'topic-faults.html',
  'audience-beginner.html': 'answers.html',
  'audience-intermediate.html': 'answers.html',
  'difficulty-beginner.html': 'answers.html',
  'difficulty-intermediate.html': 'answers.html',
  'fr/difficulty-beginner.html': 'fr/answers.html',
  'fr/difficulty-intermediate.html': 'fr/answers.html',
  'guide-tasting-notes.html': 'guides.html',
  'answer-oak-influence-age.html': 'topic-oak.html',
  // Same question as answer-burgundy-pinot-pairing.html with a near-identical
  // answer -- duplicate content. Unpublish qa-burgundy-pinot-premium-pairing
  // in knowledge_chunks when convenient; this entry already retires the page.
  'answer-burgundy-pinot-premium-pairing.html': 'answer-burgundy-pinot-pairing.html',
  'fr/answer-burgundy-pinot-premium-pairing.html': 'fr/answer-burgundy-pinot-pairing.html',
};
