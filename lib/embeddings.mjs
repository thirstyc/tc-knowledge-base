import { pipeline } from '@xenova/transformers';

// Matches the 384-dim vector column in schema.sql. Runs fully locally —
// no API key, first call downloads and caches the model under ./.cache.
let extractorPromise;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/gte-small');
  }
  return extractorPromise;
}

export async function embed(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
