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
  // Duplicate questions, not duplicate pages: each of these asked the same
  // thing as the page it now points at, and both were answered in five or six
  // words. The survivor carries a full answer; this retires the twin so Google
  // has one URL per question instead of two competing thin ones.
  'answer-beaujolais-casual-pairing.html': 'answer-beaujolais-pairing.html',
  'fr/answer-beaujolais-casual-pairing.html': 'fr/answer-beaujolais-pairing.html',
  'answer-beaujolais-fun-fruity.html': 'answer-beaujolais-fruity.html',
  'fr/answer-beaujolais-fun-fruity.html': 'fr/answer-beaujolais-fruity.html',
  'answer-beaujolais-everyday.html': 'answer-beaujolais-price.html',
  'fr/answer-beaujolais-everyday.html': 'fr/answer-beaujolais-price.html',
  'answer-vermouth-aperitivo-pairing.html': 'answer-vermouth-pairing.html',
  'fr/answer-vermouth-aperitivo-pairing.html': 'fr/answer-vermouth-pairing.html',
  'answer-vermouth-botanical.html': 'answer-vermouth-herbal.html',
  'fr/answer-vermouth-botanical.html': 'fr/answer-vermouth-herbal.html',
  'answer-vermouth-styles-vary.html': 'answer-vermouth-variation.html',
  'fr/answer-vermouth-styles-vary.html': 'fr/answer-vermouth-variation.html',

  'answer-oak-influence-age.html': 'topic-oak.html',
  // Same question as answer-burgundy-pinot-pairing.html with a near-identical
  // answer -- duplicate content. Unpublish qa-burgundy-pinot-premium-pairing
  // in knowledge_chunks when convenient; this entry already retires the page.
  'answer-burgundy-pinot-premium-pairing.html': 'answer-burgundy-pinot-pairing.html',
  'fr/answer-burgundy-pinot-premium-pairing.html': 'fr/answer-burgundy-pinot-pairing.html',
};
