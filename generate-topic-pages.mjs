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

import { writeFileSync } from 'node:fs';
import { TOPICS } from './topics.config.mjs';

function renderHead(topic) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${topic.topicName} — Thirsty Cunt Knowledge Base</title>
<meta name="description" content="${topic.metaDescription}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="styles.css" />
</head>`;
}

function renderHeader() {
  return `<body>
  <header class="site-header">
    <a class="brand" href="index.html"><img src="assets/tc-monogram.png" alt="Thirsty Cunt" /></a>
    <nav class="nav">
      <a href="index.html">Home</a>
      <a href="answers.html">Answers</a>
      <a href="topics.html" aria-current="page">Topics</a>
      <a href="search.html">Search</a>
      <a href="about.html">About</a>
      <span class="lang"><a href="#">En</a><span>|</span><a class="off" href="#">Fr</a></span>
      <a class="btn-pill" href="#">Get the app</a>
    </nav>
  </header>`;
}

function renderMain(topic) {
  return `  <main>
    <div class="wrap">
      <p class="breadcrumb"><a href="index.html">Home</a> / <a href="topics.html">Topics</a> / ${topic.topicName}</p>
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
  return `  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="assets/tc-monogram-white.png" alt="Thirsty Cunt" />
        <p>A wine lifestyle brand built on the belief that wine should feel social, interesting, and grounded in lived experience.</p>
      </div>
      <div class="footer-col">
        <p class="k">Explore</p>
        <div class="links">
          <a href="#">The App</a>
          <a href="#">Tastings</a>
          <a href="#">The Writing</a>
          <a href="#">Instagram</a>
        </div>
      </div>
      <div class="footer-col">
        <p class="k">Get In Touch</p>
        <div class="links">
          <a href="#">Contact</a>
          <a href="mailto:hello@thirstyc.com">hello@thirstyc.com</a>
        </div>
      </div>
      <div class="footer-col">
        <p class="k">Legal</p>
        <div class="links">
          <a href="#">Privacy Policy</a>
          <a href="#">Your Privacy Choices</a>
          <a href="#">Terms &amp; Conditions</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="copy">&copy; 2026 Thirsty Cunt &middot; Drink Responsibly</span>
      <span class="lang"><a href="#">En</a><span>|</span><a class="off" href="#">Fr</a></span>
    </div>
  </footer>`;
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
        let title;
        if (chunk.chunk_type === 'enology') {
          title = chunk.section_title || (chunk.content || '').split('\\n')[0];
        } else {
          const raw = (chunk.content || '').trim();
          const qMark = raw.indexOf('? ');
          title = qMark !== -1 ? raw.slice(0, qMark + 1) : raw;
        }
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
        const raw = (chunk.content || '').trim();
        const qMark = raw.indexOf('? ');
        const title = qMark !== -1 ? raw.slice(0, qMark + 1) : raw;
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
    renderHeader(),
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
