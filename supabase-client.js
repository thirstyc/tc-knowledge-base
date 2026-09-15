// Supabase Client for TC Knowledge Base
const SUPABASE_URL = 'https://qcyzcjikyqnzvnvmfwtk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjeXpjamkreXFuenZudmZydGsiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcyMjY1MjE2OCwiZXhwIjoxODAwNDE4MTY4fQ.sVrfPRfgW1ZZ_YLsJ4w3p3v-6V5p8m8K0zK0X0Y1Z0A';

async function fetchPublishedAnswers(limit = 10) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/knowledge_base_chunks?select=*&status=eq.published&order=created_at.desc&limit=${limit}`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching answers:', error);
    return [];
  }
}

function renderAnswerCard(chunk) {
  const id = chunk.id;
  const title = chunk.title || chunk.source_file;
  const content = chunk.content || '';
  const summary = chunk.summary || content.substring(0, 150) + '...';
  const tags = chunk.tags || [];
  const category = chunk.category || 'General';

  return `
    <a class="card" href="answer-${id}.html">
      <span class="card-meta muted">${id.substring(0, 8).toUpperCase()} &middot; ${category}</span>
      <span class="card-title sm">${title}</span>
      <p>${summary}</p>
      <span class="chip-row tag-row">
        ${tags.slice(0, 2).map(tag => `<span class="tag">${tag}</span>`).join('')}
      </span>
    </a>
  `;
}

async function loadAnswers(containerId, limit = 3, topic = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<p style="text-align: center; color: #999;">Loading answers...</p>';

  const answers = await fetchPublishedAnswers(limit);
  if (answers.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999;">No answers yet. Check back soon!</p>';
    return;
  }
  container.innerHTML = answers.map(renderAnswerCard).join('');
}

window.KnowledgeBase = { loadAnswers, fetchPublishedAnswers };
