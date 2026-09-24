// Node copy of renderMarkdown() from the old browser client, for pages rendered at
// build time. knowledge_chunks content is plain text using a small Markdown
// subset (checked across every published row): **bold**, *italic*, "- "
// bullets, "1. " numbered lists and blank-line paragraphs. Kept in sync by
// hand since that copy runs in the browser.

import { escapeHtml } from './page-shell.mjs';

function renderInline(escapedText) {
  return escapedText
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*\n]*)\*(?!\*)/g, '$1<em>$2</em>');
}

export function renderMarkdown(text) {
  const html = [];
  for (const block of (text || '').trim().split(/\n\s*\n/)) {
    let paragraph = [];
    let list = null;
    const flushParagraph = () => {
      if (paragraph.length) html.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (list) html.push(`<${list.tag}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${list.tag}>`);
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
  return html.join('\n');
}
