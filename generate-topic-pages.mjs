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
import { readDocRows } from './lib/content-docs.mjs';
import { readAnswerRows } from './lib/content-files.mjs';
import { TOPICS, BASE_URL, effectiveKeywordPattern, TOPIC_ANSWER_LIMIT } from './topics.config.mjs';
import { writeSitemap } from './lib/sitemap.mjs';
import { topicSchema } from './lib/schema-markup-templates.js';
import { REDIRECTS } from './redirects.config.mjs';
import { isSectionRow, sectionPageHref, sectionAnchor } from './lib/sections.mjs';
import { renderMarkdown } from './lib/markdown.mjs';
import {
  renderHead as renderHeadShell,
  renderHeader as renderHeaderShell,
  renderFooter as renderFooterShell,
  assetPrefixFor,
  renderHeroBand,
  deriveQuestion,
  escapeHtml,
  answerPagePath,
  kindLabel,
  frenchSpacing,
} from './lib/page-shell.mjs';


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

// Content comes from content/docs/ and content/answers/, not Supabase.
// See lib/content-docs.mjs and lib/content-files.mjs.

// `content ILIKE %term%` for one term or, for a topic like Oak where French
// uses several words for the same idea ("chêne", but also "boisé"/"fût" when a
// row describes barrel ageing without naming the wood), any of a list.
function matchesTerm(content, term) {
  const haystack = content.toLowerCase();
  return [].concat(term).some((t) => haystack.includes(String(t).toLowerCase()));
}

// Same queries the topic pages used to run in the browser. Most topics are
// unchanged proper nouns in French (Grenache, Riesling, Rhône...), so the
// English match term still finds French rows too; a few translate to a
// different word entirely (Burgundy -> Bourgogne, Oak -> chêne, the
// corrected "tanin" spelling) and set matchTermFr in topics.config.mjs.
// async only because the caller drives all 44 topics through Promise.all.
async function fetchTopicData(topic, lang) {
  const docRows = readDocRows({ lang }).filter((r) => r.source_doc === topic.sourceDoc);
  const overviewRow = docRows.find((r) => r.section_title === 'Overview');
  // Every topic in topics.config.mjs has real Overview content, so none here
  // means something is wrong upstream, not an empty topic.
  if (!overviewRow) throw new Error(`no ${lang} Overview for ${topic.sourceDoc} in content/docs/${lang}/`);

  // The topic's own explainer sections, shown on the page itself.
  const sections = topic.kind === 'enology' ? docRows.filter((r) => r.section_title !== 'Overview') : [];

  const answers = readAnswerRows()
    .filter((r) => r.lang === lang)
    .sort((a, b) => a.source_doc.localeCompare(b.source_doc));

  // Answer rows whose page is retired in redirects.config.mjs aren't listed.
  const retired = (r) => `${lang === 'fr' ? 'fr/' : ''}${answerPagePath(r.source_doc)}` in REDIRECTS;

  if (topic.sourceDocPrefixes) {
    // Membership by source_doc prefix (see topics.config.mjs), not keyword.
    const byPrefix = answers
      .filter((r) => topic.sourceDocPrefixes.some((prefix) => r.source_doc.startsWith(prefix)))
      .filter((r) => !retired(r))
      .slice(0, 200);
    return { overview: parseOverview(overviewRow.content), sections, qaRows: byPrefix };
  }

  const matchTerm = lang === 'fr' ? topic.matchTermFr ?? topic.matchTerm ?? topic.topicName : topic.matchTerm ?? topic.topicName;
  let qaRows = answers
    .filter((r) => matchesTerm(r.content, matchTerm))
    .filter((r) => !topic.excludeTerm || !matchesTerm(r.content, topic.excludeTerm))
    .filter((r) => !retired(r));

  // An enology topic also lists explainer sections from OTHER enology
  // documents that mention its term -- never its own, which are rendered
  // inline above.
  if (topic.kind === 'enology') {
    const others = readDocRows({ lang, chunkType: 'enology' })
      .filter((r) => r.section_title !== 'Overview' && r.source_doc !== topic.sourceDoc)
      .filter((r) => matchesTerm(r.content, matchTerm))
      .sort((a, b) => a.source_doc.localeCompare(b.source_doc));
    qaRows = qaRows.concat(others);
  }

  return { overview: parseOverview(overviewRow.content), sections, qaRows: qaRows.slice(0, TOPIC_ANSWER_LIMIT) };
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
// Answers link to their answer page, enology/region sections to their
// section on the source_doc's page (scripts/generate-catalog-pages.mjs);
// the modal is only a fallback for a page that doesn't exist yet.
function renderRow(chunk, lang) {
  const href = ['qa', 'region-qa'].includes(chunk.chunk_type)
    ? answerPagePath(chunk.source_doc)
    : isSectionRow(chunk)
      ? sectionPageHref({ ...chunk, lang })
      : null;
  const onDisk = href && `${lang === 'fr' ? 'fr/' : ''}${href.split('#')[0]}`;
  const linkAttrs =
    href && existsSync(onDisk)
      ? `href="${href}"`
      : `href="#" onclick="window.KnowledgeBase.showChunkDetail(${escapeHtml(JSON.stringify(chunk))}); return false;"`;
  return `        <a class="row-item" ${linkAttrs}>
          <span class="t">${escapeHtml(rowTitle(chunk))}</span>
          ${kindLabel(chunk.chunk_type, lang) ? `<span class="k">${escapeHtml(kindLabel(chunk.chunk_type, lang))}</span>` : ''}
        </a>`;
}

function countLine(count, name, lang) {
  if (lang === 'fr') {
    return count === 0 ? `Pas Encore De Réponses Sur ${name}` : `${count} Réponse${count !== 1 ? 's' : ''} Sur ${name}`;
  }
  return count === 0 ? `No Answers Yet On ${name}` : `${count} Answer${count !== 1 ? 's' : ''} On ${name}`;
}

// A section's content opens with its heading line, then the body.
function renderOwnSections(sections) {
  return sections
    .map((row) => {
      const [first, ...rest] = row.content.split('\n');
      const heading = first.trim();
      return `      <section class="guide-part" id="${sectionAnchor(row)}">
        <h2 class="guide-part-title">${escapeHtml(heading)}</h2>
        <div class="body-copy">
${renderMarkdown(rest.join('\n').trim())}
        </div>
      </section>`;
    })
    .join('\n');
}

function renderMain(topic, lang, { overview, sections = [], qaRows }) {
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
${sections.length ? `${renderOwnSections(sections)}\n` : ''}      <p class="list-head">${escapeHtml(countLine(qaRows.length, name, lang))}</p>
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
  writeFileSync(outPath, frenchSpacing(renderPage(topic, lang, data), lang));
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
