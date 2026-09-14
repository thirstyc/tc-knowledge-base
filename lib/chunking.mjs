const MAX_CHARS = 1500;
const OVERLAP_CHARS = 150;

// Splits on paragraph boundaries, packing paragraphs up to MAX_CHARS per
// chunk and carrying a small overlap forward so context isn't lost at
// chunk edges.
export function chunkText(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > MAX_CHARS && current) {
      chunks.push(current);
      const tail = current.slice(-OVERLAP_CHARS);
      current = `${tail}\n\n${paragraph}`;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks.length ? chunks : [text.trim()];
}
