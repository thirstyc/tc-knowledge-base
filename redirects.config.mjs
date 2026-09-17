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

export const REDIRECTS = {
  // answer-region-adour-positioning.html / answer-region-alentejo-style.html
  // don't exist (no Adour or Alentejo answer pages have been generated), so
  // these go to the regions archive until they are.
  'answer-region-adour-pairing.html': 'regions.html',
  'answer-region-alentejo-audience.html': 'regions.html',
  'answer-pairing-riesling-thai.html': 'topic-riesling.html',
  'answer-vintage-variation-guide.html': 'topic-faults.html',
  'audience-beginner.html': 'difficulty-beginner.html',
  'audience-intermediate.html': 'difficulty-intermediate.html',
  'guide-tasting-notes.html': 'guides.html',
  'answer-oak-influence-age.html': 'topic-oak.html',
};
