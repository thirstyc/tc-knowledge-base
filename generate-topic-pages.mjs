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

import { readFileSync, writeFileSync } from 'node:fs';
import { TOPICS, STATIC_PAGES, BASE_URL } from './topics.config.mjs';
import { renderHead as renderHeadShell, renderHeader as renderHeaderShell, renderFooter as renderFooterShell } from './lib/page-shell.mjs';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHead(topic) {
  return renderHeadShell({
    title: `${topic.topicName} — Thirsty Cunt Knowledge Base`,
    description: topic.metaDescription,
  });
}

// Topic pages don't have a single hub page anymore (topics.html was
// removed as duplicate content once grapes.html/regions.html/guides.html
// existed as the real browse destinations) -- highlight whichever of those
// this topic's kind maps to, or nothing for enology topics (no equivalent).
function renderHeader(topic) {
  const currentNav = { grape: 'grapes.html', region: 'regions.html' }[topic.kind] ?? null;
  return renderHeaderShell(currentNav);
}

function renderMain(topic) {
  return `  <main>
    <div class="wrap">
      <p class="breadcrumb"><a href="index.html">Home</a> / ${topic.topicName}</p>
      <div class="split">
        <div>
          <p class="eyebrow" id="grape-eyebrow">Loading&hellip;</p>
          <h1 class="display" id="grape-name">${topic.topicName}</h1>
          <p class="lede sm" id="grape-lede" style="margin: 0">Loading&hellip;</p>
        </div>
        <dl class="facts" id="grape-facts"></dl>
      </div>

      <p class="list-head" id="qa-count">Loading answers&hellip;</p>
      <div id="qa-list"></div>
    </div>
  </main>`;
}

function renderFooter() {
  return renderFooterShell();
}

// Shared by every kind: fetch the Overview chunk and paint eyebrow/name/lede/facts.
const OVERVIEW_JS = `      const overviewRows = await window.KnowledgeBase.fetchChunks(
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
        document.getElementById('grape-lede').textContent = "Couldn't load this right now — try refreshing.";
      }`;

// Shared by every kind: render the count line + answer list once qaRows is populated.
const RENDER_LIST_JS = `      const countEl = document.getElementById('qa-count');
      const listEl = document.getElementById('qa-list');

      if (qaRows.length === 0) {
        countEl.textContent = \`No Answers Yet On \${TOPIC_NAME}\`;
        return;
      }

      countEl.textContent = \`\${qaRows.length} Answer\${qaRows.length !== 1 ? 's' : ''} On \${TOPIC_NAME}\`;
      listEl.innerHTML = qaRows.map(chunk => {`;

function renderQaFetchAndList(topic) {
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

${RENDER_LIST_JS}
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

${RENDER_LIST_JS}
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

function renderScript(topic) {
  const matchTerm = topic.matchTerm ?? topic.topicName;
  const qaChunkType = topic.kind === 'region' ? 'region-qa' : 'qa';

  const consts = [
    `    const TOPIC_CHUNK_TYPE = '${topic.kind}';`,
    `    const TOPIC_SOURCE_DOC = '${topic.sourceDoc}';`,
    `    const TOPIC_NAME = '${topic.topicName}';`,
    `    const QA_CHUNK_TYPE = '${qaChunkType}';`,
  ];
  if (topic.note) consts.push(wrapComment(topic.note));
  consts.push(`    const QA_MATCH_TERM = '${matchTerm}';`);
  if (topic.excludeTerm) consts.push(`    const QA_EXCLUDE_TERM = '${topic.excludeTerm}';`);

  return `  <script src="supabase-client.js"></script>
  <script>
${consts.join('\n')}

    document.addEventListener('DOMContentLoaded', async () => {
${OVERVIEW_JS}

${renderQaFetchAndList(topic)}
    });
  </script>
</body>
</html>
`;
}

function renderPage(topic) {
  return [
    renderHead(topic),
    renderHeader(topic),
    renderMain(topic),
    renderFooter(),
    '',
    renderScript(topic),
  ].join('\n');
}

for (const topic of TOPICS) {
  const outPath = `topic-${topic.slug}.html`;
  writeFileSync(outPath, renderPage(topic));
  console.log(`  -> ${outPath}`);
}

console.log(`Generated ${TOPICS.length} topic page(s).`);

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
// Only <loc> is included: no lastmod (we don't track real per-page edit
// times, and fabricating one would be a false freshness signal) and no
// priority/changefreq (both deprecated by every major search engine).

function renderSitemap() {
  const paths = [...STATIC_PAGES, ...TOPICS.map((t) => `topic-${t.slug}.html`)];
  const urls = paths
    .map((path) => `  <url>\n    <loc>${BASE_URL}/${path}</loc>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

writeFileSync('sitemap.xml', renderSitemap());
console.log(`  -> sitemap.xml (${STATIC_PAGES.length + TOPICS.length} urls)`);
