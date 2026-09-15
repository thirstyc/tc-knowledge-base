// Supabase Client for TC Knowledge Base
const SUPABASE_URL = 'https://qcyzcjikyqnzvnvmfwtk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeXpjamlreXFuelp2bWZ3dGsiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5NjM0NjE3MSwiZXhwIjoxNzI3ODgyMTcxfQ.YOI9vfPILa9_Tz_gJ4pK3kN_M6mL8zR9xQ2pT5vU1wY';

async function fetchPublishedChunks(limit = 10, searchQuery = null) {
  try {
    let url = `${SUPABASE_URL}/rest/v1/knowledge_chunks?select=*&order=created_at.desc&limit=${limit}`;
    
    if (searchQuery) {
      url = `${SUPABASE_URL}/rest/v1/knowledge_chunks?select=*&or=(section_title.ilike.%25${encodeURIComponent(searchQuery)}%25,content.ilike.%25${encodeURIComponent(searchQuery)}%25)&order=created_at.desc&limit=${limit}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching chunks:', error);
    return [];
  }
}

function getSearchParam(param) {
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}

function renderAnswerCard(chunk) {
  if (!chunk || !chunk.id) return '';
  const title = chunk.section_title || chunk.source_doc || 'Untitled';
  const content = chunk.content || '';
  const summary = chunk.summary || content.substring(0, 150) + '...';
  const category = chunk.chunk_type || 'General';
  const source = chunk.source_doc || 'knowledge';
  
  return `<a class="answer-card" href="#chunk-${chunk.id}" onclick="showChunkDetail(${JSON.stringify(chunk).replace(/"/g, '&quot;')}); return false;"><span class="meta"><span class="id">${source.toUpperCase()}</span><span class="badge high">${category}</span></span><h3>${title}</h3><p>${summary}</p></a>`;
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

window.KnowledgeBase = { loadAnswers, fetchPublishedChunks, showChunkDetail, getSearchParam };
