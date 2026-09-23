// Checks lib/region-answers.mjs against fixtures rebuilt from the generated
// pages on disk, so the region -> answer matching can be verified without
// touching Supabase.
//
// Run: node scripts/verify-region-answers.mjs   (or npm run verify:region-answers)
// Exits 1 if any check fails.
//
// Why fixtures instead of the database: every other script here reads
// knowledge_chunks, so none of them can run when the database is unavailable
// -- which is exactly when a matching change is most likely to go unnoticed.
// region-*.html and answer-*.html already contain the two things the matcher
// needs (section headings + bodies, and answer source_docs recoverable from
// the filenames), so the committed pages serve as the fixture set. That also
// means this catches a regression the moment the pages are regenerated, rather
// than only when someone reads the diff.
//
// The trade-off: fixtures are only as current as the last generator run. A
// change to what the generator *writes* (heading markup, file naming) needs
// this file updated alongside it.

import { readdirSync, readFileSync } from 'node:fs';
import { buildRegionAnswerIndex, regionAnswerToken, matchPhrase } from '../lib/region-answers.mjs';

// Entities the generators emit; enough to recover heading and body text.
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, ' ');

const textOf = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// One row per <section class="guide-part">, shaped like the knowledge_chunks
// rows buildRegionAnswerIndex receives: content opens with the heading line,
// which is what splitHeading() hands it in the real generator.
function regionRowsFromDisk() {
  const rows = [];
  for (const file of readdirSync('.').filter((f) => /^region-.*\.html$/.test(f))) {
    const html = readFileSync(file, 'utf8');
    for (const [, section] of html.matchAll(/<section class="guide-part"[^>]*>([\s\S]*?)<\/section>/g)) {
      const heading = decode((section.match(/<h2 class="guide-part-title">([^<]*)<\/h2>/)?.[1] ?? '').trim());
      if (!heading) continue;
      rows.push({
        source_doc: file.replace('.html', ''),
        section_title: heading,
        content: `${heading}\n${textOf(section.replace(/<h2[\s\S]*?<\/h2>/, ''))}`,
      });
    }
  }
  return rows;
}

// answerPagePath() writes answer-<slug>.html from source_doc "qa-<slug>", so
// the source_doc is recoverable by putting the prefix back.
const answerRowsFromDisk = () =>
  readdirSync('.')
    .filter((f) => /^answer-.*\.html$/.test(f))
    .map((f) => ({ source_doc: `qa-${f.replace(/^answer-|\.html$/g, '')}` }));

const regionRows = regionRowsFromDisk();
const answerRows = answerRowsFromDisk();
if (regionRows.length === 0 || answerRows.length === 0) {
  console.error('  !! no fixtures found -- run this from the repo root, after the pages have been generated');
  process.exit(1);
}

const index = buildRegionAnswerIndex(regionRows, answerRows, (row) => row.content.split('\n')[0]);
const regionAnswers = answerRows.filter((row) => regionAnswerToken(row.source_doc));
const routed = new Set([...index.values()].flatMap((docs) => [...docs]));
const fanOut = (sourceDoc) => [...index.values()].filter((docs) => docs.has(sourceDoc)).length;
const owns = (regionDoc, answerDoc) => index.get(regionDoc)?.has(answerDoc) ?? false;

let failures = 0;
function check(label, got, want = true) {
  const ok = Object.is(got, want);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
}

console.log(
  `fixtures: ${regionRows.length} region sections across ${new Set(regionRows.map((r) => r.source_doc)).size} documents, ${answerRows.length} answers`
);
console.log(
  `routed: ${routed.size}/${regionAnswers.length} region answers -> ${[...index.values()].reduce((n, s) => n + s.size, 0)} links across ${index.size} region pages\n`
);

console.log('token parsing:');
check('trailing question angle is dropped', regionAnswerToken('qa-region-yarra-valley-style'), ' yarra valley ');
check('a "-2" disambiguator is dropped too', regionAnswerToken('qa-region-croatia-pairing-2'), ' croatia ');
check('plain qa rows have no sub-region', regionAnswerToken('qa-albarino-pairing'), null);
check('accents fold to the slug spelling', matchPhrase("Île d'Orléans"), ' ile d orleans ');
check('padding keeps matches on word boundaries', matchPhrase('Rioja').includes(' rioja '), true);

console.log('\nownership via a section heading:');
check('Barossa -> region-australia', owns('region-australia', 'qa-region-barossa-style'));
check('Napa -> region-usa-california', owns('region-usa-california', 'qa-region-napa-style'));
check('Rioja -> region-spain-north', owns('region-spain-north', 'qa-region-rioja-style'));

console.log('\nownership via an unambiguous body mention:');
check('Yarra Valley -> region-australia', owns('region-australia', 'qa-region-yarra-valley-style'));
check('Stellenbosch -> region-south-africa', owns('region-south-africa', 'qa-region-stellenbosch-style'));
check('Etna -> region-italy-south-islands', owns('region-italy-south-islands', 'qa-region-etna-style'));

console.log('\nprecision guards:');
// Names every region document mentions comparatively must resolve to their own
// page via a heading, not spread across everyone who name-checks them.
check('Bordeaux lands only on region-bordeaux', fanOut('qa-region-bordeaux-style') === 1);
check('Burgundy lands only on region-burgundy', fanOut('qa-region-burgundy-style') === 1);
// The single-match restriction on the body pass, tested where it actually
// binds: Veneto is named by no section heading and mentioned by both
// region-italy-northeast and region-italy-overview, so it is deliberately left
// unplaced. Relaxing `mentions.length === 1` in lib/region-answers.mjs fails
// this line -- which is the point of having it.
check('an ambiguous body-only place stays unplaced (Veneto)', routed.has('qa-region-veneto-style'), false);
check('Veneto really is the ambiguous case, not simply absent', regionAnswers.some((r) => r.source_doc === 'qa-region-veneto-style'));
const worst = [...routed].map((doc) => [doc, fanOut(doc)]).sort((a, b) => b[1] - a[1])[0];
check(`no answer lands on more than 2 region pages (worst: ${worst[0]} on ${worst[1]})`, worst[1] <= 2);
check('every routed answer is reachable from at least one page', [...routed].every((doc) => fanOut(doc) >= 1));

// Not a failure: these are places no region document covers, so there is no
// page to link them from. Printed so the catalog gap stays visible.
const unplaced = [...new Set(
  regionAnswers.filter((row) => !routed.has(row.source_doc)).map((row) => regionAnswerToken(row.source_doc).trim())
)];
console.log(`\nunplaced (${regionAnswers.length - routed.size} answers across ${unplaced.length} places with no region document):`);
console.log(`  ${unplaced.join(', ')}`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
