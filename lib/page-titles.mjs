// Titles that would otherwise collide with another page's.
//
// Three page families can produce the same <title> from the same subject, and
// two subjects actually do:
//
//   grape-champagne  the wine style ("Sparkling / France")
//   region-champagne the place, eleven sections of reference
//
//   topic-burgundy   the answers hub for Burgundy
//   region-burgundy  the place, eleven sections of reference
//
// Both pairs shipped as "Champagne — ..." and "Burgundy — ...", which is two
// URLs telling a search engine they are the same page and letting it pick. The
// region pages take the qualifier because "Wine Region" is exactly what they
// are, and because the grape and topic pages are the ones that should rank for
// the bare name.
//
// Only the <title> changes. The <h1>, breadcrumb and hero keep the plain name:
// a reader who has landed on the page does not need telling twice.
//
// scripts/audit-links.mjs fails on any duplicate title, so a third page
// entering either family shows up as a failed run rather than a silent
// collision.
const TITLE_OVERRIDES = {
  'region-champagne.html': { en: 'Champagne Wine Region', fr: 'Champagne — Région viticole' },
  'region-burgundy.html': { en: 'Burgundy Wine Region', fr: 'Bourgogne — Région viticole' },
};

export function titleNameFor(file, lang, defaultName) {
  return TITLE_OVERRIDES[file]?.[lang] ?? defaultName;
}
