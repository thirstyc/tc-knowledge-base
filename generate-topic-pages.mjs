// Generates topic-{slug}.html for every entry in topics.config.mjs.
//
// Run: node generate-topic-pages.mjs   (or npm run generate:topics)
//
// The page shell (head/header/footer) and the client-side Supabase fetch
// logic are identical across every topic page today — only a handful of
// strings differ (title, meta description, breadcrumb, and the three
// TOPIC_*/QA_* query params). This script is that template, parameterized
// by topics.config.mjs, so adding a topic is one config entry instead of
// copy-pasting and hand-editing an existing HTML file.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { TOPICS, BASE_URL } from './topics.config.mjs';
import { writeSitemap } from './lib/sitemap.mjs';
import { renderHead as renderHeadShell, renderHeader as renderHeaderShell, renderFooter as renderFooterShell } from './lib/page-shell.mjs';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// French pages live at fr/topic-{slug}.html -- one directory deeper than
// their English counterpart -- so every asset/nav href needs '../'.
function assetPrefixFor(lang) {
  return lang === 'fr' ? '../' : '';
}

function topicName(topic, lang) {
  return lang === 'fr' ? topic.topicNameFr ?? topic.topicName : topic.topicName;
}

function renderHead(topic, lang) {
  const title = lang === 'fr' ? `${topicName(topic, lang)} — Thirsty Cunt` : `${topic.topicName} — Thirsty Cunt Knowledge Base`;
  const description = lang === 'fr' ? topic.metaDescriptionFr ?? topic.metaDescription : topic.metaDescription;
  return renderHeadShell({ title, description, lang, assetPrefix: assetPrefixFor(lang), alternates: hreflangAlternates(topic) });
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

function renderMain(topic, lang) {
  const name = topicName(topic, lang);
  const home = lang === 'fr' ? 'Accueil' : 'Home';
  const loading = lang === 'fr' ? 'Chargement&hellip;' : 'Loading&hellip;';
  const loadingAnswers = lang === 'fr' ? 'Chargement des réponses&hellip;' : 'Loading answers&hellip;';
  return `  <main>
    <div class="wrap">
      <p class="breadcrumb"><a href="${assetPrefixFor(lang)}index.html">${home}</a> / ${name}</p>
      <div class="split">
        <div>
          <p class="eyebrow" id="grape-eyebrow">${loading}</p>
          <h1 class="display" id="grape-name">${name}</h1>
          <p class="lede sm" id="grape-lede" style="margin: 0">${loading}</p>
        </div>
        <dl class="facts" id="grape-facts"></dl>
      </div>

      <p class="list-head" id="qa-count">${loadingAnswers}</p>
      <div id="qa-list"></div>
    </div>
  </main>`;
}

function renderFooter(topic, lang) {
  return renderFooterShell({ lang, assetPrefix: assetPrefixFor(lang), ...langToggleHrefs(topic, lang) });
}

// Shared by every kind: fetch the Overview chunk and paint eyebrow/name/lede/facts.
function overviewJs(lang) {
  const failedMsg = lang === 'fr'
    ? "Impossible de charger cette page pour le moment — essayez de rafraîchir."
    : "Couldn't load this right now — try refreshing.";
  return `      const overviewRows = await window.KnowledgeBase.fetchChunks(
        \`select=content&chunk_type=eq.\${TOPIC_CHUNK_TYPE}&source_doc=eq.\${TOPIC_SOURCE_DOC}&section_title=eq.Overview&limit=1\`
      );

      if (overviewRows.length > 0) {
        const [eyebrow, name, lede, factsBlock] = overviewRows[0].content.split('\\n\\n');
        document.getElementById('grape-eyebrow').textContent = eyebrow || '';
        document.getElementById('grape-name').textContent = name || TOPIC_NAME;
        document.getElementById('grape-lede').textContent = lede || '';

        const factsEl = document.getElementById('grape-facts');
        factsEl.innerHTML = (factsBlock || '').split('\\n').map(line => {
          const sep = line.indexOf(':');
          if (sep === -1) return '';
          const key = line.slice(0, sep).trim();
          const value = line.slice(sep + 1).trim();
          return \`<div><dt>\${key}</dt><dd>\${value}</dd></div>\`;
        }).join('');
      } else {
        // Every topic in topics.config.mjs has real Overview content --
        // an empty result here means the request failed, not that this
        // topic has no overview. Without this, eyebrow/lede stay stuck on
        // their initial "Loading…" text forever instead of ever resolving.
        document.getElementById('grape-eyebrow').textContent = '';
        document.getElementById('grape-lede').textContent = "${failedMsg}";
      }`;
}

// Shared by every kind: render the count line + answer list once qaRows is populated.
function renderListJs(lang) {
  const noAnswers = lang === 'fr' ? 'Pas Encore De Réponses Sur' : 'No Answers Yet On';
  const answerWord = lang === 'fr' ? 'Réponse' : 'Answer';
  const onWord = lang === 'fr' ? 'Sur' : 'On';
  return `      const countEl = document.getElementById('qa-count');
      const listEl = document.getElementById('qa-list');

      if (qaRows.length === 0) {
        countEl.textContent = \`${noAnswers} \${TOPIC_NAME}\`;
        return;
      }

      countEl.textContent = \`\${qaRows.length} ${answerWord}\${qaRows.length !== 1 ? 's' : ''} ${onWord} \${TOPIC_NAME}\`;
      listEl.innerHTML = qaRows.map(chunk => {`;
}

function renderQaFetchAndList(topic, lang) {
  const matchTerm = topic.matchTerm ?? topic.topicName;

  if (topic.kind === 'enology') {
    return `      const [qaMatches, enologyMatches] = await Promise.all([
        window.KnowledgeBase.fetchChunks(
          \`select=id,content,source_doc,chunk_type&chunk_type=eq.\${QA_CHUNK_TYPE}&content=ilike.%25\${encodeURIComponent(QA_MATCH_TERM)}%25&order=source_doc.asc&limit=100\`
        ),
        window.KnowledgeBase.fetchChunks(
          \`select=id,content,source_doc,section_title,chunk_type&chunk_type=eq.enology&content=ilike.%25\${encodeURIComponent(QA_MATCH_TERM)}%25&section_title=neq.Overview&order=source_doc.asc&limit=100\`
        ),
      ]);
      const qaRows = [...qaMatches, ...enologyMatches];

${renderListJs(lang)}
        const title = window.KnowledgeBase.deriveCardTitle(chunk);
        const safeChunk = JSON.stringify(chunk).replace(/"/g, '&quot;');
        return \`<a class="row-item" href="#" onclick="window.KnowledgeBase.showChunkDetail(\${safeChunk}); return false;">
          <span class="id">\${(chunk.source_doc || '').toUpperCase()}</span>
          <span class="t">\${title}</span>
          <span class="k">\${chunk.chunk_type.toUpperCase()}</span>
        </a>\`;
      }).join('');`;
  }

  const excludeClause = topic.excludeTerm
    ? `&content=not.ilike.%25\${encodeURIComponent(QA_EXCLUDE_TERM)}%25`
    : '';

  return `      const qaRows = await window.KnowledgeBase.fetchChunks(
        \`select=id,content,source_doc,chunk_type&chunk_type=eq.\${QA_CHUNK_TYPE}&content=ilike.%25\${encodeURIComponent(QA_MATCH_TERM)}%25${excludeClause}&order=source_doc.asc&limit=100\`
      );

${renderListJs(lang)}
        const title = window.KnowledgeBase.deriveCardTitle(chunk);
        const safeChunk = JSON.stringify(chunk).replace(/"/g, '&quot;');
        return \`<a class="row-item" href="#" onclick="window.KnowledgeBase.showChunkDetail(\${safeChunk}); return false;">
          <span class="id">\${(chunk.source_doc || '').toUpperCase()}</span>
          <span class="t">\${title}</span>
          <span class="k">\${chunk.chunk_type.toUpperCase()}</span>
        </a>\`;
      }).join('');`;
}

// Wraps `note` into //-prefixed comment lines matching the script block's
// 4-space indent, at roughly the same width as the hand-written originals.
function wrapComment(note, width = 70) {
  const words = note.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.map((l) => `    // ${l}`).join('\n');
}

function renderScript(topic, lang) {
  const matchTerm = topic.matchTerm ?? topic.topicName;
  const qaChunkType = topic.kind === 'region' ? 'region-qa' : 'qa';

  const consts = [
    `    const TOPIC_CHUNK_TYPE = '${topic.kind}';`,
    `    const TOPIC_SOURCE_DOC = '${topic.sourceDoc}';`,
    `    const TOPIC_NAME = '${topicName(topic, lang)}';`,
    `    const QA_CHUNK_TYPE = '${qaChunkType}';`,
  ];
  if (topic.note) consts.push(wrapComment(topic.note));
  // The match term stays the English word even on French pages: fetchChunks
  // already filters to lang=eq.fr, and for the translated topics so far
  // (grapes: Grenache, Riesling) the term is an unchanged proper noun in
  // French too. A topic whose French name diverges from the English match
  // term (e.g. a translated concept name) will need its own matchTermFr
  // field when it's translated.
  consts.push(`    const QA_MATCH_TERM = '${matchTerm}';`);
  if (topic.excludeTerm) consts.push(`    const QA_EXCLUDE_TERM = '${topic.excludeTerm}';`);

  return `  <script src="${assetPrefixFor(lang)}supabase-client.js"></script>
  <script>
${consts.join('\n')}

    document.addEventListener('DOMContentLoaded', async () => {
${overviewJs(lang)}

${renderQaFetchAndList(topic, lang)}
    });
  </script>
</body>
</html>
`;
}

function renderPage(topic, lang) {
  return [
    renderHead(topic, lang),
    renderHeader(topic, lang),
    renderMain(topic, lang),
    renderFooter(topic, lang),
    '',
    renderScript(topic, lang),
  ].join('\n');
}

for (const topic of TOPICS) {
  const outPath = `topic-${topic.slug}.html`;
  writeFileSync(outPath, renderPage(topic, 'en'));
  console.log(`  -> ${outPath}`);
}

console.log(`Generated ${TOPICS.length} topic page(s).`);

// French pages: only for topics with real translated content so far
// (topic.frReady -- see scripts/translate-to-french.mjs). Generating a
// French page for an untranslated topic would just ship the "no content"
// fallback UI for no reason.
const frTopics = TOPICS.filter((t) => t.frReady);
if (frTopics.length > 0) {
  mkdirSync('fr', { recursive: true });
  for (const topic of frTopics) {
    const outPath = `fr/topic-${topic.slug}.html`;
    writeFileSync(outPath, renderPage(topic, 'fr'));
    console.log(`  -> ${outPath}`);
  }
  console.log(`Generated ${frTopics.length} French topic page(s).`);
}

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
  const entries = TOPICS.map((t) => {
    const pattern = t.keywordPattern ?? escapeRegex(t.topicName.toLowerCase());
    return `  { pattern: /${pattern}/i, slug: '${t.slug}' },`;
  });
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
