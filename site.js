// Everything the published pages still run in the browser.
//
// This replaces supabase-client.js, which shipped 19.5KB to every one of the
// 2,930 pages -- a REST client, a chunk-routing table, a Markdown renderer, an
// answer-card renderer and a detail modal -- to support content that is now
// rendered at build time from the files in content/. Once answers.html,
// search.html and index.html stopped fetching, nothing called any of it: no
// page referenced window.KnowledgeBase, and no page carried an inline handler
// that reached it. What survives is what actually runs.
//
// It also carried the Supabase project URL and anon key in plain text on every
// page. Those are publishable by design, but publishing credentials for a
// database the site no longer reads is not a tradeoff, just exposure.
//
// The Markdown renderer lives on in lib/markdown.mjs, which renders the same
// syntax at build time and was always the copy the pages were generated with.

function currentLang() {
  return window.location.pathname.includes('/fr/') ? 'fr' : 'en';
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

// Thirsty Cellar is iPhone-only, and the "Get the app" button in the header of
// every page points at an App Store listing Android has no way to open. Rather
// than send Android visitors to a dead end, relabel the button and explain.
function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function showAndroidComingSoonModal() {
  const isFr = currentLang() === 'fr';
  const heading = isFr ? 'Android Arrive, Mais Pas Encore' : "Android's Coming, Just Not Yet";
  const body = isFr
    ? "Thirsty Cellar vit sur iPhone pour le moment. Android arrive — on n'a juste pas fini de le préparer."
    : "Thirsty Cellar lives on iPhone right now. Android's on the way — we just haven't finished pouring it yet.";
  showModal(`<div class="modal-content"><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button><h2>${heading}</h2><div class="modal-body"><p>${body}</p></div></div>`);
}

function guardAppStoreLinksOnAndroid() {
  if (!isAndroid()) return;
  const label = currentLang() === 'fr' ? 'Android bientôt' : 'Android soon';
  document.querySelectorAll('a.btn-pill').forEach((link) => {
    link.textContent = label;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showAndroidComingSoonModal();
    });
  });
}

guardAppStoreLinksOnAndroid();
