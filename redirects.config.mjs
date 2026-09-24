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
  // Exact duplicate questions: each of these asked word-for-word what the page
  // it now points at asks, and both were answered in a handful of words. The
  // longer answer survives; see drafts/duplicate-questions.md for the full
  // review list this came from. Many are a regional batch and a grape batch
  // having independently asked "what pairs with X".
  'answer-alsatian-riesling-bold-pairing.html': 'answer-alsatian-riesling-pairing.html',
  'fr/answer-alsatian-riesling-bold-pairing.html': 'fr/answer-alsatian-riesling-pairing.html',
  'answer-burgundy-pinot-investable.html': 'answer-burgundy-pinot-age.html',
  'fr/answer-burgundy-pinot-investable.html': 'fr/answer-burgundy-pinot-age.html',
  'answer-burgundy-pinot-elegant-serious.html': 'answer-burgundy-pinot-elegant.html',
  'fr/answer-burgundy-pinot-elegant-serious.html': 'fr/answer-burgundy-pinot-elegant.html',
  'answer-caladoc-bbq-pairing.html': 'answer-caladoc-languedoc-pairing.html',
  'fr/answer-caladoc-bbq-pairing.html': 'fr/answer-caladoc-languedoc-pairing.html',
  'answer-caladoc-value.html': 'answer-caladoc-languedoc-value.html',
  'fr/answer-caladoc-value.html': 'fr/answer-caladoc-languedoc-value.html',
  'answer-central-otago-pinot-pairing.html': 'answer-region-central-otago-pairing.html',
  'fr/answer-central-otago-pinot-pairing.html': 'fr/answer-region-central-otago-pairing.html',
  'answer-coonawarra-cabernet-pairing.html': 'answer-region-coonawarra-pairing.html',
  'fr/answer-coonawarra-cabernet-pairing.html': 'fr/answer-region-coonawarra-pairing.html',
  'answer-finger-lakes-riesling-pairing.html': 'answer-region-finger-lakes-pairing.html',
  'fr/answer-finger-lakes-riesling-pairing.html': 'fr/answer-region-finger-lakes-pairing.html',
  'answer-german-riesling-cuts-pairing.html': 'answer-german-riesling-pairing.html',
  'fr/answer-german-riesling-cuts-pairing.html': 'fr/answer-german-riesling-pairing.html',
  'answer-gruner-veltliner-pairing.html': 'answer-region-austria-pairing.html',
  'fr/answer-gruner-veltliner-pairing.html': 'fr/answer-region-austria-pairing.html',
  'answer-hawkes-bay-merlot-pairing.html': 'answer-region-hawkes-bay-pairing.html',
  'fr/answer-hawkes-bay-merlot-pairing.html': 'fr/answer-region-hawkes-bay-pairing.html',
  'answer-liston-negro-coastal-pairing.html': 'answer-liston-negro-canaries-pairing.html',
  'fr/answer-liston-negro-coastal-pairing.html': 'fr/answer-liston-negro-canaries-pairing.html',
  'answer-malvasia-bianca-sweet-pairing.html': 'answer-malvasia-bianca-pairing.html',
  'fr/answer-malvasia-bianca-sweet-pairing.html': 'fr/answer-malvasia-bianca-pairing.html',
  'answer-moscato-alone-pairing.html': 'answer-moscato-pairing.html',
  'fr/answer-moscato-alone-pairing.html': 'fr/answer-moscato-pairing.html',
  'answer-paarl-chenin-pairing.html': 'answer-region-paarl-pairing.html',
  'fr/answer-paarl-chenin-pairing.html': 'fr/answer-region-paarl-pairing.html',
  'answer-tokaji-pairing.html': 'answer-region-hungary-pairing.html',
  'fr/answer-tokaji-pairing.html': 'fr/answer-region-hungary-pairing.html',
  'answer-region-lebanon-pairing-2.html': 'answer-region-lebanon-pairing.html',
  'fr/answer-region-lebanon-pairing-2.html': 'fr/answer-region-lebanon-pairing.html',
  'answer-uruguayan-tannat-pairing.html': 'answer-region-uruguay-pairing.html',
  'fr/answer-uruguayan-tannat-pairing.html': 'fr/answer-region-uruguay-pairing.html',
  'answer-vinho-verde-casual-pairing.html': 'answer-region-vinho-verde-pairing.html',
  'fr/answer-vinho-verde-casual-pairing.html': 'fr/answer-region-vinho-verde-pairing.html',
  'answer-vinho-verde-pairing.html': 'answer-region-vinho-verde-pairing.html',
  'fr/answer-vinho-verde-pairing.html': 'fr/answer-region-vinho-verde-pairing.html',
  'answer-waiheke-cabernet-pairing.html': 'answer-region-waiheke-island-pairing.html',
  'fr/answer-waiheke-cabernet-pairing.html': 'fr/answer-region-waiheke-island-pairing.html',
  'answer-sagrantino-umbria-age.html': 'answer-sagrantino-age.html',
  'fr/answer-sagrantino-umbria-age.html': 'fr/answer-sagrantino-age.html',
  'answer-sagrantino-umbria-pairing.html': 'answer-sagrantino-pairing.html',
  'fr/answer-sagrantino-umbria-pairing.html': 'fr/answer-sagrantino-pairing.html',
  'answer-sancerre-loire-pure-pairing.html': 'answer-sancerre-pairing.html',
  'fr/answer-sancerre-loire-pure-pairing.html': 'fr/answer-sancerre-pairing.html',
  'answer-schiava-pairing.html': 'answer-schiava-alto-adige-pairing.html',
  'fr/answer-schiava-pairing.html': 'fr/answer-schiava-alto-adige-pairing.html',
  'answer-sherry-tapas-pairing.html': 'answer-sherry-pairing.html',
  'fr/answer-sherry-tapas-pairing.html': 'fr/answer-sherry-pairing.html',
  'answer-white-burgundy-investable.html': 'answer-white-burgundy-age.html',
  'fr/answer-white-burgundy-investable.html': 'fr/answer-white-burgundy-age.html',
  'answer-white-burgundy-premium-pairing.html': 'answer-white-burgundy-pairing.html',
  'fr/answer-white-burgundy-premium-pairing.html': 'fr/answer-white-burgundy-pairing.html',

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

  // "Albarin" was Albariño misspelled, not Albarín Blanco. All three answers
  // describe a Galician coastal white, which is Albariño; Albarín Blanco is a
  // different grape, from Asturias and Castilla y León. answer-albarin-rare
  // went further and called Albariño "a niche Galician grape with barely any
  // vineyard acreage", which is the opposite of true for the flagship of Rías
  // Baixas. Each one had an Albariño page asking the same question with a
  // better answer, so they compete for the same queries and lose.
  'answer-albarin-pairing.html': 'answer-albarino-pairing.html',
  'fr/answer-albarin-pairing.html': 'fr/answer-albarino-pairing.html',
  'answer-albarin-briny.html': 'answer-albarino-mineral.html',
  'fr/answer-albarin-briny.html': 'fr/answer-albarino-mineral.html',
  'answer-albarin-rare.html': 'answer-albarino-underrated.html',
  'fr/answer-albarin-rare.html': 'fr/answer-albarino-underrated.html',

  // The grape page behind those answers, and the same confusion in one
  // document: it is titled "Albarin", lists "Albarín Blanco" as another name
  // for it, and then describes Galicia and Rías Baixas -- which is Albariño's
  // home, not Albarín Blanco's (Asturias and Castilla y León). With its three
  // answers retired it also listed nothing at all. Retiring it means Albarín
  // Blanco is not covered; writing it properly would be a new page about a
  // genuinely obscure grape, which is a different piece of work.
  'grape-albarin.html': 'grape-albarino.html',
  'fr/grape-albarin.html': 'fr/grape-albarino.html',

  // Two pages for one wine. grape-vinho-verde covers it and matches 27
  // answers; grape-vinho-verde-green is the same Portuguese white under a
  // name nobody writes -- "Green" is a translation of "Verde", not a
  // qualifier -- so it matched none, which is why it turned up in the
  // empty-page list at all. Writing answers for it would have split one
  // subject across two URLs; its three new answers went to the real page.
  'grape-vinho-verde-green.html': 'grape-vinho-verde.html',
  'fr/grape-vinho-verde-green.html': 'fr/grape-vinho-verde.html',
};
