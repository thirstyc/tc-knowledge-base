import { randomUUID } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const INTAKE_DIR = path.resolve('intake');

async function main() {
  await mkdir(INTAKE_DIR, { recursive: true });

  const files = (await readdir(INTAKE_DIR)).filter((f) => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('No .md files in intake/. Drop files there and run `npm run add` again.');
    return;
  }

  let normalized = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(INTAKE_DIR, file);
    const raw = await readFile(filePath, 'utf8');
    const parsed = matter(raw);

    if (parsed.data.id && parsed.data.status) {
      skipped++;
      continue;
    }

    if (!parsed.content.trim()) {
      console.warn(`Skipping ${file}: no content body.`);
      continue;
    }

    const data = {
      title: parsed.data.title || path.basename(file, '.md'),
      tags: parsed.data.tags || [],
      category: parsed.data.category || null,
      ...parsed.data,
      id: parsed.data.id || randomUUID(),
      status: 'pending',
      addedAt: parsed.data.addedAt || new Date().toISOString(),
    };

    await writeFile(filePath, matter.stringify(parsed.content, data));
    normalized++;
    console.log(`Normalized ${file} (id: ${data.id})`);
  }

  console.log(`Done. ${normalized} normalized, ${skipped} already ready for processing.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
