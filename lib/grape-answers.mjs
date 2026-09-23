// Which answers belong on a grape page.
//
// Split out of scripts/generate-catalog-pages.mjs so the matcher can be
// exercised without it: that script generates at import, so anything defined
// inside it can only run against a live database. Keeping this pure lets
// scripts/verify-answer-coverage.mjs count each grape's real match set from
// fixtures and check it against GRAPE_ANSWER_LIMIT -- the guard would be
// worthless against a re-implementation that drifts from this one.

import { escapeRegex } from '../topics.config.mjs';

// Grape names like "Riesling (Australia)" are regional takes on a grape.
// Their answer list only includes answers that mention the place too;
// style qualifiers ("Old-Vine", "White") don't narrow the match. `name`
// comes from the row's own-language Overview content, so on a French page
// the qualifier is already translated ("Old-Vine" -> "Vieilles Vignes",
// "Southern Rhône" -> "Rhône méridional") -- both lookups need the French
// spelling too, or every translated qualifier gets misread as an unmatched
// place name and wrongly required verbatim in the answer content (the
// French grape pages showed 0 "mentioning" answers for exactly these
// grapes until this was found and fixed). Lookups are case-insensitive
// since translated casing isn't consistent ("blanc" vs "Vieilles Vignes").
export const STYLE_QUALIFIERS = new Set(
  ['White', 'Nebbiolo', 'Old-Vine', 'Higher Quality', 'Rot', 'Blanc', 'Vieilles Vignes', 'Qualité Supérieure', 'Rouge'].map(
    (s) => s.toLowerCase()
  )
);
// "néo-zélandais"/"américain" (adjective) show up in content at least as
// often as the noun phrase, so these use a short prefix ("néo-zélandai",
// "Améri") that covers both the noun and its French adjective agreements
// (-e/-s/-es), the same trick "Ital"/"Argentin" already use below.
export const PLACE_PATTERNS = {
  nz: 'New Zealand|NZ|Nouvelle-Zélande|néo-zélandai',
  usa: 'USA|America|\\bUS\\b|États-Unis|Améri',
  'états-unis': 'USA|America|\\bUS\\b|États-Unis|Améri',
  italy: 'Ital',
  italie: 'Ital',
  argentina: 'Argentin',
  argentine: 'Argentin',
  'argentine high-altitude': 'Argentin',
  'haute altitude argentine': 'Argentin',
  // "Leban" alone doesn't cover the French adjective "libanais" (different
  // vowel after the shared "L"), so this pairs both languages' noun+adjective
  // prefixes rather than relying on one prefix to coincidentally cover both.
  lebanon: 'Leban|Liban',
  liban: 'Leban|Liban',
  uruguay: 'Urugua',
  israel: 'Isra',
  'israël': 'Isra',
  'southern rhône': 'Rhône',
  'rhône méridional': 'Rhône',
  'northern rhône': 'Rhône',
  'rhône septentrional': 'Rhône',
  // Content says "South African"/"sud-africain" (adjective) at least as
  // often as the noun phrase, so match both forms in both languages.
  'south africa': 'South Africa|South African|Afrique du Sud|sud-africain',
  'afrique du sud': 'South Africa|South African|Afrique du Sud|sud-africain',
};

export function grapeAnswerMatcher(name) {
  const [, base, qualifier] = name.match(/^(.*?)\s*(?:\((.*)\))?\s*$/);
  // Case-insensitive: French often lowercases grape names as common nouns
  // ("à base de grenache") where the grape's own name is capitalized
  // ("Grenache (...)").
  const mentionsBase = new RegExp(`(^|[^\\p{L}])${escapeRegex(base)}(?![\\p{L}])`, 'iu');
  const qualifierKey = qualifier?.toLowerCase();
  const place = qualifier && !STYLE_QUALIFIERS.has(qualifierKey) ? PLACE_PATTERNS[qualifierKey] ?? escapeRegex(qualifier) : null;
  const mentionsPlace = place ? new RegExp(place, 'iu') : null;
  return {
    base,
    matches: (content) => mentionsBase.test(content) && (!mentionsPlace || mentionsPlace.test(content)),
  };
}
