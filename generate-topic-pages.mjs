// Generates topic-{slug}.html for every entry in topics.config.mjs.
//
// Run: node generate-topic-pages.mjs   (or npm run generate:topics)
//
// Each page is pre-rendered with its content: the Overview chunk and the
// matching Q&A rows are fetched from Supabase here, at build time, so
// crawlers that don't run JavaScript see the real page instead of a
// "Loading…" shell. Content changes reach the site when this script reruns
// (the weekly generate-pages workflow does that).
//
// If a topic's fetch fails, its existing file is left as-is and the script
// exits 1 — a network blip never ships an empty topic page.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { TOPICS, BASE_URL, effectiveKeywordPattern } from './topics.config.mjs';
import { writeSitemap } from './lib/sitemap.mjs';
import { topicSchema } from './lib/schema-markup-templates.js';
import {
  renderHead as renderHeadShell,
  renderHeader as renderHeaderShell,
  renderFooter as renderFooterShell,
  assetPrefixFor,
  renderHeroBand,
  deriveQuestion,
  escapeHtml,
  answerPagePath,
} from './lib/page-shell.mjs';

// Same public anon key used by every other page (client-side, protected by
// RLS's unconditional public-read policy on knowledge_chunks) -- read-only
// generation doesn't need the service role key.
const SUPABASE_URL = 'https://qcyzcjikyqnzvnvmfwtk.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeXpjamlreXFuenZudm1md3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTc4NjIsImV4cCI6MjA5MjI5Mzg2Mn0.8Fp1wk_BxQ7NrEQRnMPKX6kdaz-0k7bNj94DN4cLP2U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function topicName(topic, lang) {
  return lang === 'fr' ? topic.topicNameFr ?? topic.topicName : topic.topicName;
}

function renderHead(topic, lang) {
  const title = lang === 'fr' ? `${topicName(topic, lang)} — Thirsty Cunt` : `${topic.topicName} — Thirsty Cunt Knowledge Base`;
  const description = lang === 'fr' ? topic.metaDescriptionFr ?? topic.metaDescription : topic.metaDescription;
  const jsonLd = [
    topicSchema({
      name: topicName(topic, lang),
      description,
      url: `${lang === 'fr' ? 'fr/' : ''}topic-${topic.slug}.html`,
      kind: topic.kind,
      lang,
    }),
  ];
  return renderHeadShell({ title, description, lang, assetPrefix: assetPrefixFor(lang), alternates: hreflangAlternates(topic), jsonLd });
}

// EN and FR pages of a frReady topic both carry the same full set of
// hreflang links; English is the x-default. Untranslated topics get none.
function hreflangAlternates(topic) {
  if (!topic.frReady) return [];
  const pageFile = `topic-${topic.slug}.html`;
  return [
    { hreflang: 'en', href: `${BASE_URL}/${pageFile}` },
    { hreflang: 'fr', href: `${BASE_URL}/fr/${pageFile}` },
    { hreflang: 'x-default', href: `${BASE_URL}/${pageFile}` },
  ];
}

// Topic pages don't have a single hub page anymore (topics.html was
// removed as duplicate content once grapes.html/regions.html/guides.html
// existed as the real browse destinations) -- highlight whichever of those
// this topic's kind maps to, or nothing for enology topics (no equivalent).
// Only pages with a real translated counterpart (topic.frReady) get a
// working EN|FR toggle; everything else keeps the inert '#' placeholder
// it already had -- rewiring every page's toggle is a later, separate step.
function langToggleHrefs(topic, lang) {
  const pageFile = `topic-${topic.slug}.html`;
  return {
    frHref: lang === 'en' && topic.frReady ? `fr/${pageFile}` : null,
    enHref: lang === 'fr' ? `../${pageFile}` : null,
  };
}

function renderHeader(topic, lang) {
  const currentNav = { grape: 'grapes.html', region: 'regions.html' }[topic.kind] ?? null;
  return renderHeaderShell({ currentNav, lang, assetPrefix: assetPrefixFor(lang), ...langToggleHrefs(topic, lang) });
}

// --- Supabase fetch -------------------------------------------------------

function publishedChunks(lang) {
  return supabase
    .from('knowledge_chunks')
    .select('id, content, source_doc, section_title, chunk_type')
    .eq('status', 'published')
    .eq('lang', lang);
}

// Same queries the topic pages used to run in the browser. Most topics are
// unchanged proper nouns in French (Grenache, Riesling, Rhône...), so the
// English match term still finds French rows too; a few translate to a
// different word entirely (Burgundy -> Bourgogne, Oak -> chêne, the
// corrected "tanin" spelling) and set matchTermFr in topics.config.mjs.
async function fetchTopicData(topic, lang) {
  const overview = await publishedChunks(lang)
    .eq('chunk_type', topic.kind)
    .eq('source_doc', topic.sourceDoc)
    .eq('section_title', 'Overview')
    .limit(1);
  if (overview.error) throw overview.error;
  // Every topic in topics.config.mjs has real Overview content, so none
  // here means something is wrong upstream, not an empty topic.
  if (overview.data.length === 0) throw new Error(`no ${lang} Overview chunk for ${topic.sourceDoc}`);

  const matchTerm = lang === 'fr' ? topic.matchTermFr ?? topic.matchTerm ?? topic.topicName : topic.matchTerm ?? topic.topicName;
  let qa = publishedChunks(lang)
    .eq('chunk_type', topic.kind === 'region' ? 'region-qa' : 'qa')
    .ilike('content', `%${matchTerm}%`);
  if (topic.excludeTerm) qa = qa.not('content', 'ilike', `%${topic.excludeTerm}%`);
  const queries = [qa];
  if (topic.kind === 'enology') {
    queries.push(
      publishedChunks(lang).eq('chunk_type', 'enology').ilike('content', `%${matchTerm}%`).neq('section_title', 'Overview')
    );
  }
  // id as tiebreaker keeps output stable run to run, so regenerating
  // unchanged content produces no diff.
  const results = await Promise.all(queries.map((q) => q.order('source_doc').order('id').limit(100)));
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;

  return { overview: parseOverview(overview.data[0].content), qaRows: results.flatMap((r) => r.data) };
}

// Overview content is "eyebrow\n\nname\n\nlede\n\nKey: value\nKey: value".
function parseOverview(content) {
  const [eyebrow = '', name = '', lede = '', factsBlock = ''] = content.split('\n\n');
  const facts = factsBlock
    .split('\n')
    .map((line) => {
      const sep = line.indexOf(':');
      return sep === -1 ? null : [line.slice(0, sep).trim(), line.slice(sep + 1).trim()];
    })
    .filter(Boolean);
  return { eyebrow, name, lede, facts };
}

// --- Page body -------------------------------------------------------------

// Mirrors deriveCardTitle() in supabase-client.js.
function rowTitle(chunk) {
  if (chunk.chunk_type === 'enology') return chunk.section_title || chunk.content.split('\n')[0];
  return deriveQuestion(chunk.content);
}

// qa/region-qa rows have their own answer page (scripts/generate-missing-
// pages.mjs writes both languages); enology rows don't, and open the same
// inline modal the client-rendered version used instead. The href written
// into the page is always the plain same-directory filename -- a French
// topic page and its qa row's French answer page are both siblings inside
// fr/, so neither needs an assetPrefix; existsSync() below checks the real
// on-disk location instead, which for a French row does need the fr/ prefix.
function renderRow(chunk, lang) {
  const href = ['qa', 'region-qa'].includes(chunk.chunk_type) ? answerPagePath(chunk.source_doc) : null;
  const onDisk = href && lang === 'fr' ? `fr/${href}` : href;
  const linkAttrs =
    href && existsSync(onDisk)
      ? `href="${href}"`
      : `href="#" onclick="window.KnowledgeBase.showChunkDetail(${escapeHtml(JSON.stringify(chunk))}); return false;"`;
  return `        <a class="row-item" ${linkAttrs}>
          <span class="id">${escapeHtml(chunk.source_doc.toUpperCase())}</span>
          <span class="t">${escapeHtml(rowTitle(chunk))}</span>
          <span class="k">${escapeHtml(chunk.chunk_type.toUpperCase())}</span>
        </a>`;
}

function countLine(count, name, lang) {
  if (lang === 'fr') {
    return count === 0 ? `Pas Encore De Réponses Sur ${name}` : `${count} Réponse${count !== 1 ? 's' : ''} Sur ${name}`;
  }
  return count === 0 ? `No Answers Yet On ${name}` : `${count} Answer${count !== 1 ? 's' : ''} On ${name}`;
}

function renderMain(topic, lang, { overview, qaRows }) {
  const name = topicName(topic, lang);
  const home = lang === 'fr' ? 'Accueil' : 'Home';
  const facts = overview.facts
    .map(([key, value]) => `          <div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('\n');
  const hero = renderHeroBand({
    breadcrumb: `<a href="${assetPrefixFor(lang)}index.html">${home}</a> / ${escapeHtml(name)}`,
    eyebrow: overview.eyebrow,
    title: overview.name || name,
    lede: overview.lede,
    aside: `        <dl class="facts">\n${facts}\n        </dl>`,
  });
  return `  <main class="has-hero">
${hero}
    <div class="wrap">
      <p class="list-head">${escapeHtml(countLine(qaRows.length, name, lang))}</p>
      <div>
${qaRows.map((chunk) => renderRow(chunk, lang)).join('\n')}
      </div>
    </div>
  </main>`;
}

function renderFooter(topic, lang) {
  return renderFooterShell({ lang, assetPrefix: assetPrefixFor(lang), ...langToggleHrefs(topic, lang) });
}

function renderPage(topic, lang, data) {
  // supabase-client.js is still loaded for the row modal and the shared
  // header behaviour (Android App Store guard).
  return [
    renderHead(topic, lang),
    renderHeader(topic, lang),
    renderMain(topic, lang, data),
    renderFooter(topic, lang),
    '',
    `  <script src="${assetPrefixFor(lang)}supabase-client.js"></script>
</body>
</html>
`,
  ].join('\n');
}

// French pages: only for topics with real translated content so far
// (topic.frReady -- see scripts/translate-to-french.mjs). Generating a
// French page for an untranslated topic would just ship the "no content"
// fallback UI for no reason.
const jobs = [
  ...TOPICS.map((topic) => ({ topic, lang: 'en', outPath: `topic-${topic.slug}.html` })),
  ...TOPICS.filter((t) => t.frReady).map((topic) => ({ topic, lang: 'fr', outPath: `fr/topic-${topic.slug}.html` })),
];
mkdirSync('fr', { recursive: true });

const results = await Promise.all(
  jobs.map((job) => fetchTopicData(job.topic, job.lang).then((data) => ({ ...job, data }), (error) => ({ ...job, error })))
);
let failedTopics = 0;
for (const { topic, lang, outPath, data, error } of results) {
  if (error) {
    console.error(`  !! ${outPath}: ${error.message} -- kept the existing file`);
    failedTopics++;
    continue;
  }
  writeFileSync(outPath, renderPage(topic, lang, data));
  console.log(`  -> ${outPath} (${data.qaRows.length} answers)`);
}
console.log(`Generated ${jobs.length - failedTopics} of ${jobs.length} topic page(s).`);
if (failedTopics) process.exitCode = 1;

// --- Answer-card routing table in supabase-client.js -----------------------
// TOPIC_PAGE_SLUGS, SOURCE_DOC_SLUG_OVERRIDES, and TOPIC_KEYWORDS are all
// derivable from the same config, so generate them here instead of
// hand-maintaining a second list that has to be kept in sync manually.

function wrapList(items, perLine = 6) {
  const lines = [];
  for (let i = 0; i < items.length; i += perLine) {
    lines.push('  ' + items.slice(i, i + perLine).join(', ') + ',');
  }
  return lines.join('\n');
}

function renderTopicPageSlugs() {
  const items = TOPICS.map((t) => `'${t.slug}'`);
  return `const TOPIC_PAGE_SLUGS = new Set([\n${wrapList(items)}\n]);`;
}

function renderSourceDocSlugOverrides() {
  const entries = TOPICS.filter((t) => {
    const prefix = `${t.kind}-`;
    return t.sourceDoc.startsWith(prefix) && t.sourceDoc.slice(prefix.length) !== t.slug;
  }).map((t) => `  '${t.sourceDoc}': '${t.slug}',`);
  return `const SOURCE_DOC_SLUG_OVERRIDES = {\n${entries.join('\n')}\n};`;
}

function renderTopicKeywords() {
  const entries = TOPICS.map((t) => `  { pattern: /${effectiveKeywordPattern(t)}/i, slug: '${t.slug}' },`);
  return `const TOPIC_KEYWORDS = [\n${entries.join('\n')}\n];`;
}

const ROUTING_BLOCK_START = '// --- BEGIN GENERATED TOPIC ROUTING (source: topics.config.mjs; run `npm run generate:topics`) ---';
const ROUTING_BLOCK_END = '// --- END GENERATED TOPIC ROUTING ---';

function renderRoutingBlock() {
  return [
    ROUTING_BLOCK_START,
    '// Topics with a dedicated topic-[slug].html page. Anything not resolved',
    '// here falls back to the inline modal so a link never points at a 404.',
    renderTopicPageSlugs(),
    '',
    '// Maps a region-/enology-prefixed source_doc to its topic slug when the two',
    '// differ. Anything not listed here just strips the prefix as-is.',
    renderSourceDocSlugOverrides(),
    '',
    '// Ordered longest-phrase-first (see topics.config.mjs) so e.g. "Chenin',
    '// Blanc" matches before a shorter, coincidental single-word hit would.',
    '// Used only for chunk_types that don\'t carry their own grape-/region-/',
    '// enology-prefixed source_doc, or whose prefix lookup didn\'t resolve.',
    renderTopicKeywords(),
    ROUTING_BLOCK_END,
  ].join('\n');
}

const clientPath = 'supabase-client.js';
const clientSrc = readFileSync(clientPath, 'utf8');
const blockRegex = new RegExp(
  `${ROUTING_BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${ROUTING_BLOCK_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
);

if (!blockRegex.test(clientSrc)) {
  console.error(`Could not find generated-routing markers in ${clientPath}. Skipping.`);
} else {
  const updated = clientSrc.replace(blockRegex, renderRoutingBlock());
  writeFileSync(clientPath, updated);
  console.log(`  -> ${clientPath} (routing table)`);
}

// --- sitemap.xml -------------------------------------------------------

const sitemapCount = writeSitemap('.');
console.log(`  -> sitemap.xml (${sitemapCount} urls)`);
