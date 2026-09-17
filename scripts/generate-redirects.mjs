// Writes a redirect stub page for every entry in redirects.config.mjs.
//
// Run: node scripts/generate-redirects.mjs   (or npm run generate:redirects)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { REDIRECTS } from '../redirects.config.mjs';
import { BASE_URL } from '../topics.config.mjs';

const REDIRECT_MARKER = '<!-- Redirect stub from generate-redirects.mjs — edit redirects.config.mjs instead -->';

function renderStub(target) {
  const url = `${BASE_URL}/${target}`;
  return `<!DOCTYPE html>
${REDIRECT_MARKER}
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Moved</title>
<link rel="canonical" href="${url}" />
<meta http-equiv="refresh" content="0; url=${url}" />
<script>location.replace(${JSON.stringify(url)});</script>
</head>
<body>
<p>This page has moved to <a href="${url}">${url}</a>.</p>
</body>
</html>
`;
}

let failed = false;
for (const [from, to] of Object.entries(REDIRECTS)) {
  if (!existsSync(to)) {
    console.error(`  !! ${from} -> ${to}: target does not exist, skipped`);
    failed = true;
    continue;
  }
  // Never clobber a real page that has since been generated at the old path.
  if (existsSync(from) && !readFileSync(from, 'utf8').includes(REDIRECT_MARKER)) {
    console.error(`  !! ${from}: a real page exists at this path, skipped`);
    failed = true;
    continue;
  }
  writeFileSync(from, renderStub(to));
  console.log(`  -> ${from} -> ${to}`);
}
if (failed) process.exit(1);
