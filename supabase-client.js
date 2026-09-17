// Supabase Client for TC Knowledge Base
const SUPABASE_URL = 'https://qcyzcjikyqnzvnvmfwtk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeXpjamlreXFuenZudm1md3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTc4NjIsImV4cCI6MjA5MjI5Mzg2Mn0.8Fp1wk_BxQ7NrEQRnMPKX6kdaz-0k7bNj94DN4cLP2U';

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
  return fetchTable('knowledge_chunks', `${queryString}&status=eq.published`);
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
  return countTable('knowledge_chunks', `${queryString}&status=eq.published`);
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
  { pattern: /chenin blanc/i, slug: 'chenin-blanc' },
  { pattern: /cabernet sauvignon/i, slug: 'cabernet-sauvignon' },
  { pattern: /rh[oô]ne/i, slug: 'rhone-valley' },
  { pattern: /nebbiolo/i, slug: 'nebbiolo' },
  { pattern: /\bgamay\b/i, slug: 'gamay' },
  { pattern: /riesling/i, slug: 'riesling' },
  { pattern: /burgundy/i, slug: 'burgundy' },
  { pattern: /priorat/i, slug: 'priorat' },
  { pattern: /\bjura\b/i, slug: 'jura' },
  { pattern: /\betna\b/i, slug: 'etna' },
  { pattern: /niagara/i, slug: 'niagara' },
  { pattern: /grenache/i, slug: 'grenache' },
  { pattern: /biodynamic/i, slug: 'biodynamic' },
  { pattern: /fermentation/i, slug: 'fermentation' },
  { pattern: /sulf?ite/i, slug: 'sulphites' },
  { pattern: /\btannins?\b/i, slug: 'tannins' },
  { pattern: /\boak\b/i, slug: 'oak' },
  { pattern: /\bfault(s|y)?\b/i, slug: 'faults' },
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

// Navigate to a chunk's dedicated topic page when one exists, else its own
// answer detail page when it's a qa/region-qa row, else fall back to the
// inline modal so we never link to a 404.
function goToChunk(chunk) {
  const topicSlug = resolveTopicSlug(chunk);
  if (topicSlug) {
    window.location.href = `topic-${topicSlug}.html`;
    return;
  }
  const answerHref = resolveAnswerHref(chunk);
  if (answerHref) {
    window.location.href = answerHref;
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

  return `<a class="answer-card" href="#chunk-${chunk.id}" onclick="window.KnowledgeBase.goToChunk(${JSON.stringify(chunk).replace(/"/g, '&quot;')}); return false;"><span class="meta"><span class="id">${source.toUpperCase()}</span><span class="badge high">${category}</span></span><h3>${title}</h3><p>${summary}</p></a>`;
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
  styles.textContent = '.modal-overlay{display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;z-index:1000}.modal-content{background:white;border-radius:8px;padding:2rem;max-width:800px;max-height:80vh;overflow-y:auto}.modal-close{position:absolute;top:1rem;right:1rem;background:0;border:0;font-size:1.5rem;cursor:pointer}';
  document.head.appendChild(styles);
}

function showModal(contentHtml) {
  ensureModalStyles();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = contentHtml;
  document.body.appendChild(modal);
}

function showChunkDetail(chunk) {
  const title = deriveCardTitle(chunk);
  const content = chunk.content || '';
  const category = chunk.chunk_type || 'General';
  const source = chunk.source_doc || 'knowledge';

  showModal(`<div class="modal-content"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button><h2>${title}</h2><div class="modal-meta"><span class="badge">${category}</span><span class="source">${source}</span></div><div class="modal-body">${content}</div></div>`);
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

// --- Full-catalog renderers -------------------------------------------
// Shared by grapes.html/regions.html/guides.html and their embedded copies
// on topics.html, so there's one source of truth per catalog instead of a
// near-duplicate inline script on each page that can drift out of sync.

// Grapes here means chunk_type='grape', section_title='Overview' -- the one
// canonical row per variety (188 of them). Non-Overview 'grape' rows are
// sub-topics of a variety (e.g. "Grenache -- New World") and aren't separate
// grapes, so they're excluded to avoid duplicate/near-duplicate tiles.
// Content shape: "{eyebrow}\n\n{name}\n\n{lede}\n\n{factsBlock}".
async function renderGrapesCatalog({ gridId, countId, ledeId, searchInputId }) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  function parseGrape(row) {
    const [eyebrow, name] = (row.content || '').split('\n\n');
    const country = (eyebrow || '').split('/')[1]?.trim() || '';
    const grapeName = (name || row.source_doc.replace(/^grape-/, '')).trim();
    return {
      name: grapeName,
      country,
      // deriveCardTitle()'s default branch (used by the modal when this
      // grape has no dedicated topic page) shows section_title, which is
      // literally "Overview" on every one of these rows -- override it
      // with the parsed name so the modal title is actually useful.
      chunk: { ...row, section_title: grapeName },
    };
  }

  function render(grapes) {
    const countEl = countId && document.getElementById(countId);
    if (grapes.length === 0) {
      if (countEl) countEl.textContent = 'No grapes match that search.';
      grid.innerHTML = '';
      return;
    }
    if (countEl) countEl.textContent = `${grapes.length} grape${grapes.length !== 1 ? 's' : ''}`;
    grid.innerHTML = grapes
      .map((g) => {
        const safeChunk = JSON.stringify(g.chunk).replace(/"/g, '&quot;');
        return `<a class="tile" href="#" onclick="window.KnowledgeBase.goToChunk(${safeChunk}); return false;">
          <span class="name">${g.name}</span>
          <span class="n">${g.country}</span>
        </a>`;
      })
      .join('');
  }

  const rows = await fetchChunks(
    'select=id,content,source_doc,chunk_type&chunk_type=eq.grape&section_title=eq.Overview&order=source_doc.asc&limit=300'
  );
  const allGrapes = rows.map(parseGrape).sort((a, b) => a.name.localeCompare(b.name));

  const ledeEl = ledeId && document.getElementById(ledeId);
  if (ledeEl) ledeEl.textContent = `${allGrapes.length} varieties. Click one to see what we've written about it.`;

  render(allGrapes);

  const searchEl = searchInputId && document.getElementById(searchInputId);
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      render(q ? allGrapes.filter((g) => g.name.toLowerCase().includes(q)) : allGrapes);
    });
  }
}

// chunk_type='region' isn't one row per browsable region -- it's ~35
// macro-region "chapters" (source_doc, e.g. "region-italy-central"), each
// holding many section rows for its actual sub-regions (Chianti, Tuscany,
// Umbria, ...). There's no per-country label stored anywhere, so grouping/
// naming is derived mechanically from the source_doc slug rather than
// guessed at with a hardcoded country list that would only ever cover some
// of ~35 groups.
async function renderRegionsCatalog({ containerId, ledeId }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  function humanizeSlug(slug) {
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function render(groups, idPrefix) {
    container.innerHTML = groups
      .map((group, i) => {
        const rows = group.rows
          .map((chunk) => {
            const safeChunk = JSON.stringify(chunk).replace(/"/g, '&quot;');
            return `<a class="row-item" href="#" onclick="window.KnowledgeBase.goToChunk(${safeChunk}); return false;">
              <span class="id">${(chunk.source_doc || '').toUpperCase()}</span>
              <span class="t">${chunk.section_title || 'Untitled'}</span>
              <span class="k">${chunk.chunk_type.toUpperCase()}</span>
            </a>`;
          })
          .join('');
        return `<section style="margin-bottom: 20px">
          <button type="button" class="list-head" style="width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid var(--hairline-strong); cursor: pointer; display: flex; justify-content: space-between; color: inherit; font: inherit; padding-bottom: 12px" onclick="document.getElementById('${idPrefix}-${i}').hidden = !document.getElementById('${idPrefix}-${i}').hidden">
            <span>${group.name}</span>
            <span>${group.rows.length}</span>
          </button>
          <div id="${idPrefix}-${i}" hidden>${rows}</div>
        </section>`;
      })
      .join('');
  }

  const rows = await fetchChunks(
    'select=id,content,source_doc,section_title,chunk_type&chunk_type=eq.region&order=source_doc.asc&limit=500'
  );

  const bySourceDoc = new Map();
  for (const row of rows) {
    if (!bySourceDoc.has(row.source_doc)) bySourceDoc.set(row.source_doc, []);
    bySourceDoc.get(row.source_doc).push(row);
  }

  const groups = [...bySourceDoc.entries()]
    .map(([sourceDoc, groupRows]) => ({
      name: humanizeSlug(sourceDoc.replace(/^region-/, '')),
      rows: groupRows,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const ledeEl = ledeId && document.getElementById(ledeId);
  if (ledeEl) ledeEl.textContent = `${groups.length} regions, ${rows.length} sub-topics between them. Expand one to browse.`;

  render(groups, containerId);
}

// guide/comparison chunks are grouped in 2-3 rows per source_doc (e.g.
// "Concept" + "Teaching", or "Overview" + "Practice"). One card per
// source_doc, using its first row as the click-through into the existing
// modal -- 7 total groups, not enough to justify a detail-page generator
// the way qa/region-qa answers got one.
//
// enology rows are deliberately excluded: they already have 6 dedicated
// topic pages (Tannins, Fermentation, Biodynamic, Sulphites, Oak, Faults)
// plus the "How Wine Works" section on topics.html, so listing them again
// here would just duplicate that.
async function renderGuidesCatalog({ gridId, ledeId }) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  // Titles come from source_doc, not section_title: rows within a group use
  // inconsistent suffix conventions ("— Concept"/"— Teaching" for
  // comparisons, but arbitrary phrases like "Why Cabernet Franc wins" for
  // guide-food-pairing-masterclass), so stripping a fixed suffix list missed
  // cases. source_doc is a single per-group, always-present slug.
  function titleFromSourceDoc(sourceDoc) {
    return sourceDoc
      .replace(/^(guide|comparison)-/, '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function render(groups) {
    grid.innerHTML = groups
      .map((group) => {
        const primary = group.rows[0];
        const body = (primary.content || '').split('\n\n').slice(1).join(' ').trim();
        const safeChunk = JSON.stringify({ ...primary, section_title: group.title }).replace(/"/g, '&quot;');
        return `<a class="card topic" href="#" onclick="window.KnowledgeBase.showChunkDetail(${safeChunk}); return false;">
          <span class="card-meta">${primary.chunk_type.toUpperCase()} &middot; ${group.rows.length} part${group.rows.length !== 1 ? 's' : ''}</span>
          <span class="card-title sm">${group.title}</span>
          <p>${body.slice(0, 160)}${body.length > 160 ? '…' : ''}</p>
          <span class="more">Read &rarr;</span>
        </a>`;
      })
      .join('');
  }

  const rows = await fetchChunks(
    'select=id,content,source_doc,section_title,chunk_type&chunk_type=in.(guide,comparison)&order=source_doc.asc&limit=200'
  );

  const bySourceDoc = new Map();
  for (const row of rows) {
    if (!bySourceDoc.has(row.source_doc)) bySourceDoc.set(row.source_doc, []);
    bySourceDoc.get(row.source_doc).push(row);
  }

  const groups = [...bySourceDoc.entries()].map(([sourceDoc, groupRows]) => ({
    title: titleFromSourceDoc(sourceDoc),
    rows: groupRows,
  }));

  const ledeEl = ledeId && document.getElementById(ledeId);
  if (ledeEl) ledeEl.textContent = `${groups.length} guides and comparisons, ${rows.length} parts in total.`;

  render(groups);
}

window.KnowledgeBase = { loadAnswers, fetchPublishedChunks, fetchChunks, fetchTable, countChunks, countTable, showChunkDetail, goToChunk, resolveTopicSlug, getSearchParam, deriveCardTitle, renderGrapesCatalog, renderRegionsCatalog, renderGuidesCatalog };
