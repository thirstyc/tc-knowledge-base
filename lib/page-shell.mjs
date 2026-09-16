// Shared header/footer markup for generated pages. Every static page in
// this repo uses an identical header and footer (README says as much) —
// this is the single copy, used by generate-topic-pages.mjs and
// generate-missing-pages.mjs so a third generator doesn't paste a third copy.

export function renderHead({ title, description }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="styles.css" />
</head>`;
}

export function renderHeader(currentNav = null) {
  const navLink = (href, label) =>
    `<a href="${href}"${currentNav === href ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<body>
  <header class="site-header">
    <a class="brand" href="index.html"><img src="assets/tc-monogram.png" alt="Thirsty Cunt" /></a>
    <nav class="nav">
      ${navLink('index.html', 'Home')}
      ${navLink('answers.html', 'Answers')}
      ${navLink('topics.html', 'Topics')}
      ${navLink('grapes.html', 'Grapes')}
      ${navLink('regions.html', 'Regions')}
      ${navLink('guides.html', 'Guides')}
      ${navLink('search.html', 'Search')}
      ${navLink('about.html', 'About')}
      <span class="lang"><a href="#">En</a><span>|</span><a class="off" href="#">Fr</a></span>
      <a class="btn-pill" href="https://apps.apple.com/ca/app/thirsty-cellar/id6772614506">Get the app</a>
    </nav>
  </header>`;
}

export function renderFooter() {
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

// Every chunk_type='qa'/'region-qa' row stores the question as the first
// sentence of `content`, up to the first "? " — section_title is a
// difficulty label ("Beginner"/"Intermediate"), never a real title. Mirrors
// deriveCardTitle() in supabase-client.js; kept in sync by hand since that
// copy runs in the browser and this one runs in Node.
export function deriveQuestion(content) {
  const raw = (content || '').trim();
  // "?" followed by ANY whitespace, not just a literal space — 9 of 904
  // qa/region-qa rows separate question/answer with "?\n\n" instead of "? ",
  // which a plain indexOf('? ') misses entirely (falls through to returning
  // the whole content blob as the "question").
  const match = raw.match(/\?\s/);
  return match ? raw.slice(0, match.index + 1) : raw;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
