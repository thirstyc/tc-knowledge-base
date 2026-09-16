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

async function fetchChunks(queryString) {
  return fetchTable('knowledge_chunks', queryString);
}

async function fetchPublishedChunks(limit = 10, searchQuery = null) {
  const columns = 'id,content,section_title,source_doc,chunk_type';
  let query = `select=${columns}&order=created_at.desc&limit=${limit}`;

  if (searchQuery) {
    query = `select=${columns}&or=(section_title.ilike.%25${encodeURIComponent(searchQuery)}%25,content.ilike.%25${encodeURIComponent(searchQuery)}%25)&order=created_at.desc&limit=${limit}`;
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
  return countTable('knowledge_chunks', queryString);
}

function getSearchParam(param) {
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}

// Topics with a dedicated topic-[slug].html page. Add to this set (and to
// TOPIC_KEYWORDS below, if it's not a grape/region source_doc) as more pages
// get built. Anything not resolved here falls back to the inline modal so a
// link never points at a page that doesn't exist.
const TOPIC_PAGE_SLUGS = new Set([
  'grenache', 'cabernet-sauvignon', 'chenin-blanc', 'nebbiolo', 'gamay', 'riesling',
  'rhone-valley', 'burgundy', 'priorat', 'jura', 'etna', 'niagara',
  'tannins', 'fermentation', 'biodynamic', 'sulphites', 'oak', 'faults',
]);

// Maps a region-/enology-prefixed source_doc to its topic slug when the two
// differ (e.g. the region source_doc is "region-rhone" but the page is
// "rhone-valley"). Anything not listed here just strips the prefix as-is.
const SOURCE_DOC_SLUG_OVERRIDES = {
  'region-rhone': 'rhone-valley',
};

// Ordered longest-phrase-first so e.g. "Chenin Blanc" matches before a
// shorter, coincidental single-word hit would. Used only for chunk_types
// (qa, region-qa, ...) that don't carry their own grape-/region-/enology-
// prefixed source_doc, or whose prefix lookup didn't resolve.
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

function resolveTopicSlug(chunk) {
  if (!chunk) return null;
  const doc = chunk.source_doc || '';

  if (['grape', 'region', 'enology'].includes(chunk.chunk_type)) {
    const prefix = `${chunk.chunk_type}-`;
    if (doc.startsWith(prefix)) {
      const slug = SOURCE_DOC_SLUG_OVERRIDES[doc] || doc.slice(prefix.length);
      if (TOPIC_PAGE_SLUGS.has(slug)) return slug;
    }
  }

  const haystack = `${chunk.content || ''} ${chunk.section_title || ''}`;
  for (const { pattern, slug } of TOPIC_KEYWORDS) {
    if (TOPIC_PAGE_SLUGS.has(slug) && pattern.test(haystack)) return slug;
  }
  return null;
}

// Navigate to a chunk's dedicated topic page when one exists; otherwise fall
// back to the inline modal so we never link to a 404.
function goToChunk(chunk) {
  const slug = resolveTopicSlug(chunk);
  if (slug) {
    window.location.href = `topic-${slug}.html`;
  } else {
    showChunkDetail(chunk);
  }
}

function renderAnswerCard(chunk) {
  if (!chunk || !chunk.id) return '';
  const title = chunk.section_title || chunk.source_doc || 'Untitled';
  const content = chunk.content || '';
  const summary = chunk.summary || content.substring(0, 150) + '...';
  const category = chunk.chunk_type || 'General';
  const source = chunk.source_doc || 'knowledge';

  return `<a class="answer-card" href="#chunk-${chunk.id}" onclick="window.KnowledgeBase.goToChunk(${JSON.stringify(chunk).replace(/"/g, '&quot;')}); return false;"><span class="meta"><span class="id">${source.toUpperCase()}</span><span class="badge high">${category}</span></span><h3>${title}</h3><p>${summary}</p></a>`;
}

async function loadAnswers(containerId, limit = 3, searchQuery = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '<p style="text-align: center; color: #999;">Loading...</p>';
  const chunks = await fetchPublishedChunks(limit, searchQuery);
  
  if (chunks.length === 0) {
    container.innerHTML = '<div class="empty"><p class="k">Nothing Yet</p><p class="t">We Haven\'t Written That One Down</p><p>Try fewer words, or a topic name.</p></div>';
    return;
  }
  
  container.innerHTML = chunks.map(renderAnswerCard).join('');
}

function showChunkDetail(chunk) {
  const title = chunk.section_title || chunk.source_doc || 'Untitled';
  const content = chunk.content || '';
  const category = chunk.chunk_type || 'General';
  const source = chunk.source_doc || 'knowledge';
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-content"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button><h2>${title}</h2><div class="modal-meta"><span class="badge">${category}</span><span class="source">${source}</span></div><div class="modal-body">${content}</div></div>`;
  
  if (!document.getElementById('modal-styles')) {
    const styles = document.createElement('style');
    styles.id = 'modal-styles';
    styles.textContent = '.modal-overlay{display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;z-index:1000}.modal-content{background:white;border-radius:8px;padding:2rem;max-width:800px;max-height:80vh;overflow-y:auto}.modal-close{position:absolute;top:1rem;right:1rem;background:0;border:0;font-size:1.5rem;cursor:pointer}';
    document.head.appendChild(styles);
  }
  
  document.body.appendChild(modal);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('featured-answers')) loadAnswers('featured-answers', 3);
  const searchQuery = getSearchParam('q');
  if (document.getElementById('results') && searchQuery) loadAnswers('results', 50, searchQuery);
  if (document.getElementById('answers-grid')) loadAnswers('answers-grid', 100);
});

window.KnowledgeBase = { loadAnswers, fetchPublishedChunks, fetchChunks, fetchTable, countChunks, countTable, showChunkDetail, goToChunk, resolveTopicSlug, getSearchParam };
