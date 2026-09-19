// Shared header/footer markup for generated pages. Every static page in
// this repo uses an identical header and footer (README says as much) —
// this is the single copy, used by generate-topic-pages.mjs and
// generate-missing-pages.mjs so a third generator doesn't paste a third copy.
//
// French support (see the French-localization plan): French pages live one
// directory deeper, at fr/{same-filename}.html, so every asset/nav href
// needs an `assetPrefix` ('' for English, '../' for French) prepended.
// Nav labels have French text baked in here; wine *content* translation is
// a separate pipeline (scripts/translate-to-french.mjs) -- this file only
// covers the static chrome every page shares.

import { toJsonLdScript } from './schema-markup-templates.js';

// French pages live one directory deeper (fr/{same-filename}.html) than
// their English counterpart, so every asset/nav href needs this prepended.
// Shared by generate-topic-pages.mjs and scripts/generate-missing-pages.mjs.
export function assetPrefixFor(lang) {
  return lang === 'fr' ? '../' : '';
}

const FR_LABELS = {
  'index.html': 'Accueil',
  'answers.html': 'Réponses',
  'grapes.html': 'Cépages',
  'regions.html': 'Régions',
  'guides.html': 'Guides',
  'search.html': 'Rechercher',
  'about.html': 'À propos',
};

// alternates: [{ hreflang, href }] with absolute hrefs, emitted as
// <link rel="alternate" hreflang> tags. Only pages with a real translated
// counterpart pass these -- each page in a pair lists every language
// (itself included) plus x-default, as Google requires.
// jsonLd: schema objects from lib/schema-markup-templates.js, one
// <script type="application/ld+json"> each. Pass raw (unescaped) text in
// them -- JSON serialisation does its own escaping.
export function renderHead({ title, description, lang = 'en', assetPrefix = '', alternates = [], jsonLd = [] } = {}) {
  const alternateLinks = alternates
    .map(({ hreflang, href }) => `\n<link rel="alternate" hreflang="${hreflang}" href="${href}" />`)
    .join('');
  const jsonLdScripts = jsonLd.map((schema) => `\n${toJsonLdScript(schema)}`).join('');
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="${assetPrefix}styles.css" />${alternateLinks}${jsonLdScripts}
</head>`;
}

// currentNav/frHref/enHref are plain filenames like 'answers.html' -- this
// function prepends assetPrefix itself, callers never build cross-directory
// paths by hand. frHref/enHref, when given, point the EN|FR toggle at a
// *real* sibling-language page (used for the handful of pages that actually
// have a translated counterpart); omitted, the toggle stays the inert `#`
// placeholder every other page already has -- unwiring 900+ pages' toggles
// was never in scope for this pass, only giving real pairs a real link.
// The EN|FR switch, shared by header and footer. The current language is
// plain text (not a link to '#'); the other language is a real link only
// when that page has a translated counterpart, otherwise a dimmed,
// non-interactive label -- never a dead link that just jumps to the top.
export function renderLangToggle({ lang = 'en', frHref = null, enHref = null } = {}) {
  const current = (label) => `<span class="current" aria-current="true">${label}</span>`;
  const other = (label, href, code, unavailableTitle) =>
    href
      ? `<a class="off" href="${href}" hreflang="${code}" lang="${code}">${label}</a>`
      : `<span class="off unavailable" aria-disabled="true" lang="${code}" title="${unavailableTitle}">${label}</span>`;
  const sep = '<span class="sep">|</span>';
  return lang === 'fr'
    ? `${other('En', enHref, 'en', 'English version coming soon')}${sep}${current('Fr')}`
    : `${current('En')}${sep}${other('Fr', frHref, 'fr', 'Version française à venir')}`;
}

// Nav targets (index/answers/grapes/regions/guides/search/about) all have a
// French sibling living next to whichever directory the current page is in
// (root for English, fr/ for French), so they're always same-directory
// links with no assetPrefix -- only true shared assets (styles.css, the
// brand image) need it, since those exist once, at the site root.
export function renderHeader({ currentNav = null, lang = 'en', assetPrefix = '', frHref = null, enHref = null } = {}) {
  const isFr = lang === 'fr';
  const navLink = (hrefBase, labelEn) => {
    const label = isFr ? FR_LABELS[hrefBase] : labelEn;
    return `<a href="${hrefBase}"${currentNav === hrefBase ? ' aria-current="page"' : ''}>${label}</a>`;
  };

  const langToggle = `<span class="lang">${renderLangToggle({ lang, frHref, enHref })}</span>`;

  return `<body>
  <header class="site-header">
    <a class="brand" href="index.html"><img src="${assetPrefix}assets/tc-monogram.png" alt="Thirsty Cunt" /></a>
    <nav class="nav">
      ${navLink('index.html', 'Home')}
      ${navLink('answers.html', 'Answers')}
      ${navLink('grapes.html', 'Grapes')}
      ${navLink('regions.html', 'Regions')}
      ${navLink('guides.html', 'Guides')}
      ${navLink('search.html', 'Search')}
      ${navLink('about.html', 'About')}
      ${langToggle}
      <a class="btn-pill" href="https://apps.apple.com/ca/app/thirsty-cellar/id6772614506">${isFr ? "Télécharger l'app" : 'Get the app'}</a>
    </nav>
  </header>`;
}

export function renderFooter({ lang = 'en', assetPrefix = '', frHref = null, enHref = null } = {}) {
  const isFr = lang === 'fr';
  const langToggle = renderLangToggle({ lang, frHref, enHref });
  return isFr
    ? `  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="${assetPrefix}assets/tc-monogram-white.png" alt="Thirsty Cunt" />
        <p>Une marque de style de vie autour du vin, fondée sur l'idée que le vin devrait être social, intéressant et ancré dans le vécu.</p>
      </div>
      <div class="footer-col">
        <p class="k">Explorer</p>
        <div class="links">
          <a href="#">L'app</a>
          <a href="#">Dégustations</a>
          <a href="#">Les écrits</a>
          <a href="#">Instagram</a>
        </div>
      </div>
      <div class="footer-col">
        <p class="k">Nous contacter</p>
        <div class="links">
          <a href="#">Contact</a>
          <a href="mailto:hello@thirstyc.com">hello@thirstyc.com</a>
        </div>
      </div>
      <div class="footer-col">
        <p class="k">Mentions légales</p>
        <div class="links">
          <a href="#">Politique de confidentialité</a>
          <a href="#">Vos choix de confidentialité</a>
          <a href="#">Conditions générales</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="copy">&copy; 2026 Thirsty Cunt &middot; À consommer avec modération</span>
      <span class="lang">${langToggle}</span>
    </div>
  </footer>`
    : `  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="${assetPrefix}assets/tc-monogram-white.png" alt="Thirsty Cunt" />
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
      <span class="lang">${langToggle}</span>
    </div>
  </footer>`;
}

// Every chunk_type='qa'/'region-qa' row stores the question as the first
// sentence of `content`, up to the first "? " — section_title is a
// difficulty label ("Beginner"/"Intermediate"), never a real title. Mirrors
// deriveCardTitle() in supabase-client.js; kept in sync by hand since that
// copy runs in the browser and this one runs in Node.
// Reader-facing label for a chunk type in answer lists. Answers need no
// label (they are what every list is mostly made of); other kinds get a plain
// word instead of the raw chunk_type code.
const KIND_LABELS = {
  en: { guide: 'Guide', comparison: 'Comparison', enology: 'Wine science', overview: 'Overview', grape: 'Grape', region: 'Region' },
  fr: { guide: 'Guide', comparison: 'Comparaison', enology: 'Science du vin', overview: 'Présentation', grape: 'Cépage', region: 'Région' },
};
export function kindLabel(chunkType, lang = 'en') {
  if (!chunkType || chunkType === 'qa' || chunkType === 'region-qa') return '';
  const labels = KIND_LABELS[lang] ?? KIND_LABELS.en;
  return labels[chunkType] ?? chunkType.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

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

// The one place that maps a qa/region-qa row's source_doc to its answer
// page's filename -- generate-missing-pages.mjs (which writes the page) and
// generate-topic-pages.mjs (which links to it from topic pages) both need
// this to agree exactly, or a topic page's QA row would link to a URL the
// other generator never actually wrote. Mirrors resolveAnswerHref() in
// supabase-client.js; kept in sync by hand since that copy runs in the
// browser and this one runs in Node.
export function answerPagePath(sourceDoc) {
  // qa-* and qa-region-* source_docs are already readable identifiers (e.g.
  // "qa-assyrtiko-region", "qa-region-georgia-style-2"); just strip the
  // leading "qa-" so the URL isn't stuttering ("answer-qa-...html").
  return `answer-${slugify(sourceDoc.replace(/^qa-/, ''))}.html`;
}

// Teal hero band for content pages -- the homepage's .hero-band look, reused
// by topic and answer pages. breadcrumb is trusted HTML (callers build it
// from escaped parts); eyebrow/title/lede are plain text. aside, when given,
// is trusted HTML shown beside the title (the topic pages' facts box).
// Callers render it as the first child of <main class="has-hero">.
export function renderHeroBand({ breadcrumb, eyebrow = '', title, lede = '', aside = '', variant = '' }) {
  const text = [
    eyebrow && `          <p class="eyebrow">${escapeHtml(eyebrow)}</p>`,
    `          <h1 class="display">${escapeHtml(title)}</h1>`,
    lede && `          <p class="lede sm">${escapeHtml(lede)}</p>`,
  ]
    .filter(Boolean)
    .join('\n');
  const body = aside ? `        <div class="split">\n        <div>\n${text}\n        </div>\n${aside}\n        </div>` : text;
  return `    <section class="hero-band page-hero${variant ? ` ${variant}` : ''}">
      <div class="wrap">
        <p class="breadcrumb">${breadcrumb}</p>
${body}
      </div>
    </section>`;
}
