// Supabase Client for TC Knowledge Base
const SUPABASE_URL = 'https://qcyzcjikyqnzvnvmfwtk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeXpjamlreXFuenZudm1md3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTc4NjIsImV4cCI6MjA5MjI5Mzg2Mn0.8Fp1wk_BxQ7NrEQRnMPKX6kdaz-0k7bNj94DN4cLP2U';

// A page is French if it's served from a /fr/ path. One check here means
// every fetchChunks/countChunks caller (and everything built on them --
// loadAnswers, goToChunk, etc.) is language-aware for free, instead
// of every page needing to pass its own language down.
function currentLang() {
  return window.location.pathname.includes('/fr/') ? 'fr' : 'en';
}

async function fetchTable(table, queryString) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${queryString}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${table}:`, error);
    return [];
  }
}

// knowledge_chunks only: every caller gets the published-only filter for
// free, instead of each of the ~20 pages that build their own query string
// having to remember to add it.
async function fetchChunks(queryString) {
  return fetchTable('knowledge_chunks', `${queryString}&status=eq.published&lang=eq.${currentLang()}`);
}

// chunkTypeFilter (e.g. 'qa,region-qa') is optional and off by default so
// search.html's broad "search everything" behavior is unchanged; pages that
// specifically mean "answers" (qa/region-qa only, not grape/region/enology
// overview rows that happen to be recent) pass it explicitly.
async function fetchPublishedChunks(limit = 10, searchQuery = null, chunkTypeFilter = null) {
  const columns = 'id,content,section_title,source_doc,chunk_type';
  const typeClause = chunkTypeFilter ? `&chunk_type=in.(${chunkTypeFilter})` : '';
  let query = `select=${columns}${typeClause}&order=created_at.desc&limit=${limit}`;

  if (searchQuery) {
    query = `select=${columns}${typeClause}&or=(section_title.ilike.%25${encodeURIComponent(searchQuery)}%25,content.ilike.%25${encodeURIComponent(searchQuery)}%25)&order=created_at.desc&limit=${limit}`;
  }

  return fetchChunks(query);
}

async function countTable(table, queryString = '') {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${queryString}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact',
        'Range': '0-0',
      },
    });

    if (!response.ok) return 0;
    const range = response.headers.get('content-range');
    if (!range) return 0;
    const total = range.split('/')[1];
    return total === '*' ? 0 : parseInt(total, 10);
  } catch (error) {
    console.error(`Error counting ${table}:`, error);
    return 0;
  }
}

async function countChunks(queryString) {
  return countTable('knowledge_chunks', `${queryString}&status=eq.published&lang=eq.${currentLang()}`);
}

function getSearchParam(param) {
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}

// --- BEGIN GENERATED TOPIC ROUTING (source: topics.config.mjs; run `npm run generate:topics`) ---
// Topics with a dedicated topic-[slug].html page. Anything not resolved
// here falls back to the inline modal so a link never points at a 404.
const TOPIC_PAGE_SLUGS = new Set([
  'chenin-blanc', 'cabernet-sauvignon', 'rhone-valley', 'nebbiolo', 'gamay', 'riesling',
  'burgundy', 'priorat', 'jura', 'etna', 'niagara', 'grenache',
  'biodynamic', 'fermentation', 'sulphites', 'tannins', 'oak', 'faults',
]);

// Maps a region-/enology-prefixed source_doc to its topic slug when the two
// differ. Anything not listed here just strips the prefix as-is.
const SOURCE_DOC_SLUG_OVERRIDES = {
  'region-rhone': 'rhone-valley',
};

// Ordered longest-phrase-first (see topics.config.mjs) so e.g. "Chenin
// Blanc" matches before a shorter, coincidental single-word hit would.
// Used only for chunk_types that don't carry their own grape-/region-/
// enology-prefixed source_doc, or whose prefix lookup didn't resolve.
const TOPIC_KEYWORDS = [
  { pattern: /(?:chenin blanc)|(?:chenins? blancs?)/i, slug: 'chenin-blanc' },
  { pattern: /cabernet sauvignon/i, slug: 'cabernet-sauvignon' },
  { pattern: /rh[oô]ne/i, slug: 'rhone-valley' },
  { pattern: /nebbiolo/i, slug: 'nebbiolo' },
  { pattern: /\bgamay\b/i, slug: 'gamay' },
  { pattern: /riesling/i, slug: 'riesling' },
  { pattern: /(?:burgundy)|(?:bourgogne)/i, slug: 'burgundy' },
  { pattern: /priorat/i, slug: 'priorat' },
  { pattern: /\bjura\b/i, slug: 'jura' },
  { pattern: /\betna\b/i, slug: 'etna' },
  { pattern: /niagara/i, slug: 'niagara' },
  { pattern: /grenache/i, slug: 'grenache' },
  { pattern: /(?:biodynamic)|(?:biodynamique)/i, slug: 'biodynamic' },
  { pattern: /fermentation/i, slug: 'fermentation' },
  { pattern: /sulf?ite/i, slug: 'sulphites' },
  { pattern: /(?:\btannins?\b)|(?:\btanins?\b)/i, slug: 'tannins' },
  { pattern: /(?:\boak\b)|(?:\bch[êe]ne\b|\bbois[ée]s?\b|\bf[uû]ts?\b)/i, slug: 'oak' },
  { pattern: /(?:\bfault(s|y)?\b)|(?:d[ée]fauts?)/i, slug: 'faults' },
];
// --- END GENERATED TOPIC ROUTING ---

function resolveTopicSlug(chunk) {
  if (!chunk) return null;
  const doc = chunk.source_doc || '';

  if (['grape', 'region', 'enology'].includes(chunk.chunk_type)) {
    const prefix = `${chunk.chunk_type}-`;
    if (doc.startsWith(prefix)) {
      const slug = SOURCE_DOC_SLUG_OVERRIDES[doc] || doc.slice(prefix.length);
      if (TOPIC_PAGE_SLUGS.has(slug)) return slug;
    }
    // Falling through to keyword-matching below would be wrong here: a
    // grape/region/enology chunk's own descriptive content routinely
    // mentions other topics' keywords incidentally (e.g. every grape's
    // Overview says something about tannin/acidity/oak), which isn't the
    // same as that chunk BEING about that topic the way a qa/region-qa
    // answer's content is. No exact source_doc match means no page exists
    // for this one -- the modal is correct, not a keyword guess.
    return null;
  }

  const haystack = `${chunk.content || ''} ${chunk.section_title || ''}`;
  for (const { pattern, slug } of TOPIC_KEYWORDS) {
    if (TOPIC_PAGE_SLUGS.has(slug) && pattern.test(haystack)) return slug;
  }
  return null;
}

// Every published qa/region-qa row has its own answer-{slug}.html detail
// page now (generate-missing-pages.mjs), keyed by its source_doc with the
// leading "qa-" stripped, slugified -- mirrors slugify()/answerSlug() in
// lib/page-shell.mjs / scripts/generate-missing-pages.mjs exactly. Kept in
// sync by hand since this copy runs in the browser and those run in Node.
function resolveAnswerHref(chunk) {
  if (!chunk || !['qa', 'region-qa'].includes(chunk.chunk_type)) return null;
  const stripped = (chunk.source_doc || '').replace(/^qa-/, '');
  const slug = stripped.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug ? `answer-${slug}.html` : null;
}

// The page a chunk links to: its own answer page for qa/region-qa rows
// (the most specific page there is), else its topic page, else null.
function chunkHref(chunk) {
  // Guides/comparisons have one page per source_doc (generate-catalog-pages.mjs).
  if (chunk && ['guide', 'comparison'].includes(chunk.chunk_type) && chunk.source_doc) {
    return `${chunk.source_doc}.html`;
  }
  const answerHref = resolveAnswerHref(chunk);
  if (answerHref) return answerHref;
  // Region sections live on their chapter's region-*.html page.
  if (chunk && chunk.chunk_type === 'region' && chunk.section_title !== 'Overview' && chunk.source_doc) {
    return `${chunk.source_doc}.html`;
  }
  const topicSlug = resolveTopicSlug(chunk);
  if (topicSlug) return `topic-${topicSlug}.html`;
  // Grapes without a topic page have their own grape-*.html page
  // (grape-varieties is a reference list, not a grape).
  if (chunk && chunk.chunk_type === 'grape' && chunk.source_doc && chunk.source_doc !== 'grape-varieties') {
    return `${chunk.source_doc}.html`;
  }
  return null;
}

// Attributes for a card linking to a chunk: a real href whenever a page
// exists (so crawlers, middle-click and link sharing work), else the inline
// modal so we never link to a 404.
function chunkLinkAttrs(chunk) {
  const href = chunkHref(chunk);
  if (href) return `href="${href}"`;
  return `href="#" onclick="window.KnowledgeBase.showChunkDetail(${JSON.stringify(chunk).replace(/"/g, '&quot;')}); return false;"`;
}

function goToChunk(chunk) {
  const href = chunkHref(chunk);
  if (href) {
    window.location.href = href;
    return;
  }
  showChunkDetail(chunk);
}

// section_title is only a real title for grape/region/enology/guide/producer/
// comparison chunks (e.g. "Overview", "Malolactic conversion (MLF)"). For qa
// and region-qa chunks it's always a difficulty label ("Beginner" /
// "Intermediate") instead -- every one of the 883 qa/region-qa rows in
// knowledge_chunks confirms this, no exceptions. Using it as a title there
// showed "Intermediate" as the headline instead of the actual question.
function deriveCardTitle(chunk) {
  if (chunk.chunk_type === 'qa' || chunk.chunk_type === 'region-qa') {
    const raw = (chunk.content || '').trim();
    // "?" followed by ANY whitespace, not just a literal space -- 9 of 904
    // qa/region-qa rows separate question/answer with "?\n\n" instead of
    // "? ", which indexOf('? ') missed entirely (fell through to the whole
    // content blob as the "question").
    const match = raw.match(/\?\s/);
    return match ? raw.slice(0, match.index + 1) : raw;
  }
  if (chunk.chunk_type === 'enology') {
    return chunk.section_title || (chunk.content || '').split('\n')[0];
  }
  return chunk.section_title || chunk.source_doc || 'Untitled';
}

function renderAnswerCard(chunk) {
  if (!chunk || !chunk.id) return '';
  const title = deriveCardTitle(chunk);
  const content = chunk.content || '';
  const summary = chunk.summary || content.substring(0, 150) + '...';
  const category = chunk.chunk_type || 'General';
  const source = chunk.source_doc || 'knowledge';

  return `<a class="answer-card" ${chunkLinkAttrs(chunk)}><span class="meta"><span class="id">${source.toUpperCase()}</span><span class="badge high">${category}</span></span><h3>${title}</h3><p>${summary}</p></a>`;
}

async function loadAnswers(containerId, limit = 3, searchQuery = null, chunkTypeFilter = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<p style="text-align: center; color: #999;">Loading...</p>';
  const chunks = await fetchPublishedChunks(limit, searchQuery, chunkTypeFilter);
  
  if (chunks.length === 0) {
    container.innerHTML = '<div class="empty"><p class="k">Nothing Yet</p><p class="t">We Haven\'t Written That One Down</p><p>Try fewer words, or a topic name.</p></div>';
    return;
  }
  
  container.innerHTML = chunks.map(renderAnswerCard).join('');
}

function ensureModalStyles() {
  if (document.getElementById('modal-styles')) return;
  const styles = document.createElement('style');
  styles.id = 'modal-styles';
  styles.textContent = '.modal-overlay{display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;z-index:1000}.modal-content{background:white;border-radius:8px;padding:2rem;max-width:800px;max-height:80vh;overflow-y:auto}.modal-close{position:absolute;top:1rem;right:1rem;background:0;border:0;font-size:1.5rem;cursor:pointer}.modal-body p{margin:0 0 1em}.modal-body ul,.modal-body ol{margin:0 0 1em;padding-left:1.4em}.modal-body li{margin-bottom:0.35em}';
  document.head.appendChild(styles);
}

function showModal(contentHtml) {
  ensureModalStyles();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = contentHtml;
  document.body.appendChild(modal);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(escapedText) {
  return escapedText
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*\n]*)\*(?!\*)/g, '$1<em>$2</em>');
}

// Chunk content is plain text using a small Markdown subset -- checked
// across every published row: **bold**, *italic*, "- " bullets, "1. "
// numbered lists, and blank-line paragraphs (no headings, links or code).
// No stored row contains HTML, so the text is escaped first and only that
// subset is turned into markup.
function renderMarkdown(text) {
  const html = [];
  for (const block of (text || '').trim().split(/\n\s*\n/)) {
    let paragraph = [];
    let list = null;
    const flushParagraph = () => {
      if (paragraph.length) html.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br>')}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (list) html.push(`<${list.tag}>${list.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${list.tag}>`);
      list = null;
    };
    for (const line of block.split('\n')) {
      const item = escapeHtml(line).match(/^\s*(?:([-*•])|\d+[.)])\s+(.*)$/);
      if (!item) {
        flushList();
        paragraph.push(escapeHtml(line));
        continue;
      }
      const tag = item[1] ? 'ul' : 'ol';
      flushParagraph();
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(item[2]);
    }
    flushParagraph();
    flushList();
  }
  return html.join('');
}

function showChunkDetail(chunk) {
  const title = escapeHtml(deriveCardTitle(chunk));
  const category = escapeHtml(chunk.chunk_type || 'General');
  const source = escapeHtml(chunk.source_doc || 'knowledge');

  showModal(`<div class="modal-content"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button><h2>${title}</h2><div class="modal-meta"><span class="badge">${category}</span><span class="source">${source}</span></div><div class="modal-body">${renderMarkdown(chunk.content)}</div></div>`);
}

// The App Store link is iOS-only (Thirsty Cellar has no Android build), and
// apps.apple.com has no install path at all on Android -- just the listing
// page with no GET button. Rather than send Android visitors to a dead end,
// relabel the button and show a modal instead of navigating there.
function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function showAndroidComingSoonModal() {
  showModal(`<div class="modal-content"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button><h2>Android's Coming, Just Not Yet</h2><div class="modal-body"><p>Thirsty Cellar lives on iPhone right now. Android's on the way — we just haven't finished pouring it yet.</p></div></div>`);
}

function guardAppStoreLinksOnAndroid() {
  if (!isAndroid()) return;
  document.querySelectorAll('a.btn-pill').forEach((link) => {
    link.textContent = 'Android soon';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showAndroidComingSoonModal();
    });
  });
}

guardAppStoreLinksOnAndroid();

window.KnowledgeBase = { loadAnswers, fetchPublishedChunks, fetchChunks, fetchTable, countChunks, countTable, showChunkDetail, goToChunk, chunkHref, chunkLinkAttrs, resolveTopicSlug, getSearchParam, deriveCardTitle };
