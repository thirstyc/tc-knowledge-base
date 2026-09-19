// Shared rules for "section" rows -- region and enology chunks that live as
// sections on a per-source_doc page (region-*.html, enology-*.html, written
// by scripts/generate-catalog-pages.mjs) and are linked to from catalog and
// topic pages.
//
// section_title is the join key between a French row and its English
// original. Region rows kept the English section_title, but the French
// enology section titles were translated in place, so this map takes them
// back to English. A bounded, known set -- add an entry if a new enology
// section is translated.

import { slugify } from './page-shell.mjs';
import { TOPICS } from '../topics.config.mjs';

const ENOLOGY_TITLES_EN_BY_FR = {
  // enology-chemistry-phenolics-ageing
  'Phénols — la famille qui façonne le vin rouge': 'Phenolics — the family that shapes red wine',
  "Anthocyanes — d'où vient la couleur rouge": 'Anthocyanins — where red color comes from',
  'Tanins — structure, astringence et vieillissement': 'Tannins — structure, astringency, and age',
  'En quoi la maturité du tanin diffère de celle du sucre': 'How tannin ripeness differs from sugar ripeness',
  'Acides organiques dans le vin fini': 'Organic acids in the finished wine',
  'Stabilité tartrique et « diamants » de vin': 'Tartrate stability and wine diamonds',
  'Arôme — les trois couches': 'Aroma — the three layers',
  "Chimie de l'arôme — les familles de composés": 'Aroma chemistry — the compound families',
  'Pourquoi le vin vieillit — la chimie de la bouteille': 'Why wine ages — the bottle chemistry',
  'Potentiel de garde par style (guide pratique)': 'Ageing potential by style (practical guide)',
  'La phase muette': 'The dumb phase',
  'Clarification et collage': 'Clarification and fining',
  "Stabilisation — préserver l'intégrité du vin en bouteille": 'Stabilization — keeping wine sound in bottle',
  'Les principaux défauts du vin (guide de reconnaissance)': 'The main wine faults (recognition guide)',
  'De la chimie au verre — résumé': 'From chemistry to the glass — summary',
  // enology-fermentation-microbiology
  'Fermentation alcoolique — la réaction centrale': 'Alcoholic fermentation — the core reaction',
  'Levures du vin — Saccharomyces cerevisiae et les autres': 'Wine yeasts — Saccharomyces cerevisiae and the others',
  'Nutrition des levures et fermentation bloquée': 'Yeast nutrition and stuck fermentation',
  'Température de fermentation et son effet sur le style': 'Fermentation temperature and its effect on style',
  'Fermentation malolactique (FML) — la seconde fermentation': 'Malolactic conversion (MLF) — the second fermentation',
  "Bactéries lactiques, agents d'altération": 'Lactic acid bacteria as spoilage agents',
  'Bactéries acétiques et acidité volatile': 'Acetic acid bacteria and volatile acidity',
  "Dioxyde de soufre (SO2) — l'outil essentiel du vigneron": 'Sulfur dioxide (SO2) — the winemakers essential tool',
  'Oxygène — ami et ennemi': 'Oxygen — friend and enemy',
  'Composition du moût — ce que contient le jus de raisin': 'Must composition — whats in grape juice',
  'Acidité, pH et en quoi ils diffèrent': 'Acidity, pH, and why theyre different',
  'Chaptalisation et enrichissement': 'Chaptalization and enrichment',
  "Concentration et ajustement de l'alcool": 'Concentration and alcohol adjustment',
  'Résumé : de la fermentation au verre': 'The fermentation-to-glass summary',
};

// Every section_title a French row with this English section_title can
// have: the English title itself (the normal case) plus any translated one.
export function frenchSectionTitleCandidates(englishTitle) {
  const translated = Object.entries(ENOLOGY_TITLES_EN_BY_FR)
    .filter(([, en]) => en === englishTitle)
    .map(([fr]) => fr);
  return [englishTitle, ...translated];
}

export function englishSectionTitle(row) {
  if (row.lang === 'fr') return ENOLOGY_TITLES_EN_BY_FR[row.section_title] ?? row.section_title;
  return row.section_title;
}

// Anchor for a section on its page, identical in both languages.
export function sectionAnchor(row) {
  return slugify(englishSectionTitle(row));
}

// Region and enology rows other than a topic's Overview live on their
// source_doc's section page.
export function isSectionRow(row) {
  return ['region', 'enology'].includes(row.chunk_type) && row.section_title !== 'Overview';
}

// An enology topic's own sections (source_doc = the topic's sourceDoc, e.g.
// enology-fermentation) are shown inline on its topic page, not on a
// separate enology-*.html page.
export function topicOwningSections(row) {
  return row.chunk_type === 'enology' ? TOPICS.find((t) => t.sourceDoc === row.source_doc) ?? null : null;
}

export function sectionPageHref(row) {
  const topic = topicOwningSections(row);
  if (topic) return `topic-${topic.slug}.html#${sectionAnchor(row)}`;
  return `${row.source_doc}.html#${sectionAnchor(row)}`;
}
