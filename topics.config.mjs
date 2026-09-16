// Single source of truth for topic-*.html pages. Add an entry here and run
// `npm run generate:topics` instead of hand-copying an existing page.
//
// kind determines which Supabase query shape generate-topic-pages.mjs uses:
//   - 'grape'    chunk_type=grape overview, single chunk_type=qa QA fetch
//   - 'region'   chunk_type=region overview, single chunk_type=region-qa QA fetch
//   - 'enology'  chunk_type=enology overview, QA fetch combines chunk_type=qa
//                 + chunk_type=enology (section_title != Overview) matches
//
// matchTerm defaults to topicName if omitted. excludeTerm is rare (only
// cabernet-sauvignon needs it, to keep "Cabernet Franc" mentions out of the
// Cabernet Sauvignon page).
//
// NOTE: adding a topic here and regenerating does NOT make it linkable from
// search/homepage cards automatically — TOPIC_PAGE_SLUGS and TOPIC_KEYWORDS
// in supabase-client.js are a second, manually-maintained list that routes
// chunk cards to the right topic page. Update those too for a genuinely new
// topic.

export const TOPICS = [
  {
    slug: 'biodynamic',
    kind: 'enology',
    topicName: 'Biodynamic Wine',
    sourceDoc: 'enology-biodynamic',
    metaDescription: 'Farming by the lunar calendar. Everything we know about biodynamic wine.',
    matchTerm: 'Biodynamic',
  },
  {
    slug: 'burgundy',
    kind: 'region',
    topicName: 'Burgundy',
    sourceDoc: 'region-burgundy',
    metaDescription: "The world's most detailed expression of terroir. Everything we know about Burgundy.",
  },
  {
    slug: 'cabernet-sauvignon',
    kind: 'grape',
    topicName: 'Cabernet Sauvignon',
    sourceDoc: 'grape-cabernet-sauvignon',
    metaDescription: 'Structured, tannic, built to age. Everything we know about Cabernet Sauvignon.',
    matchTerm: 'Cabernet',
    excludeTerm: 'Franc',
    note:
      'Most entries just say "Cabernet", not the full varietal name, so we ' +
      'match broadly and exclude Cabernet Franc mentions instead of requiring ' +
      'the exact phrase (which was missing ~32 of the 40 real matches).',
  },
  {
    slug: 'chenin-blanc',
    kind: 'grape',
    topicName: 'Chenin Blanc',
    sourceDoc: 'grape-chenin-blanc',
    metaDescription: 'Bone-dry to lusciously sweet, one grape doing it all. Everything we know about Chenin Blanc.',
  },
  {
    slug: 'etna',
    kind: 'region',
    topicName: 'Etna',
    sourceDoc: 'region-etna',
    metaDescription: "Volcanic wine from the slopes of Sicily's active volcano. Everything we know about Etna.",
  },
  {
    slug: 'faults',
    kind: 'enology',
    topicName: 'Wine Faults',
    sourceDoc: 'enology-faults',
    metaDescription: 'Flaw or style choice? Everything we know about wine faults.',
    matchTerm: 'Fault',
  },
  {
    slug: 'fermentation',
    kind: 'enology',
    topicName: 'Fermentation',
    sourceDoc: 'enology-fermentation',
    metaDescription: 'How grape juice becomes wine. Everything we know about fermentation.',
  },
  {
    slug: 'gamay',
    kind: 'grape',
    topicName: 'Gamay',
    sourceDoc: 'grape-gamay',
    metaDescription: 'Light, juicy, chillable red from Beaujolais. Everything we know about Gamay.',
  },
  {
    slug: 'grenache',
    kind: 'grape',
    topicName: 'Grenache',
    sourceDoc: 'grape-grenache',
    metaDescription: 'Soft, generous, high in alcohol and low in grip. Everything we know about Grenache.',
  },
  {
    slug: 'jura',
    kind: 'region',
    topicName: 'Jura',
    sourceDoc: 'region-jura',
    metaDescription: "France's strangest, most beloved region. Everything we know about Jura.",
  },
  {
    slug: 'nebbiolo',
    kind: 'grape',
    topicName: 'Nebbiolo',
    sourceDoc: 'grape-nebbiolo',
    metaDescription: 'Pale in color, ferociously tannic. Everything we know about Nebbiolo.',
  },
  {
    slug: 'niagara',
    kind: 'region',
    topicName: 'Niagara Peninsula',
    sourceDoc: 'region-niagara',
    metaDescription: "Canada's cool-climate Riesling and ice wine country. Everything we know about Niagara.",
    matchTerm: 'Niagara',
  },
  {
    slug: 'oak',
    kind: 'enology',
    topicName: 'Oak',
    sourceDoc: 'enology-oak',
    metaDescription: 'Vanilla, spice, and texture from the barrel. Everything we know about oak.',
  },
  {
    slug: 'priorat',
    kind: 'region',
    topicName: 'Priorat',
    sourceDoc: 'region-priorat',
    metaDescription: 'Dark, mineral reds off steep Spanish slate. Everything we know about Priorat.',
  },
  {
    slug: 'rhone-valley',
    kind: 'region',
    topicName: 'Rhône Valley',
    sourceDoc: 'region-rhone',
    metaDescription: 'Syrah in the north, Gren­ache blends in the south. Everything we know about the Rhône Valley.',
    matchTerm: 'Rhône',
  },
  {
    slug: 'riesling',
    kind: 'grape',
    topicName: 'Riesling',
    sourceDoc: 'grape-riesling',
    metaDescription: 'Aromatic and misunderstood. Everything we know about Riesling.',
  },
  {
    slug: 'sulphites',
    kind: 'enology',
    topicName: 'Sulphites',
    sourceDoc: 'enology-sulphites',
    metaDescription: "The winemaker's essential preservative, and the headache myth around it. Everything we know about sulphites.",
    matchTerm: 'Sulfite',
  },
  {
    slug: 'tannins',
    kind: 'enology',
    topicName: 'Tannins',
    sourceDoc: 'enology-tannins',
    metaDescription: "Where grip comes from, and why it fades with age. Everything we know about tannins.",
    matchTerm: 'Tannin',
  },
];
