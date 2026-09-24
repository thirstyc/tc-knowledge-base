// Last real edit date per content file, for the sitemap's <lastmod>.
//
// The obvious implementation -- the git date of each page's HTML -- would be
// wrong. Templates change, and when they do every one of the 2,930 pages is
// rewritten on the same day; a sitemap claiming the whole site changed at once
// is the signal search engines learn to ignore. The content files are the
// better source: a page's text changes when its .md changes.
//
// But not every commit touching a .md is an edit to its text. The content was
// lifted out of Supabase and into this repo in September 2026, so nearly every
// file in content/ has the same birth date -- a date that says when the
// migration ran, not when anything was written. Those commits are listed in
// INFRASTRUCTURE below and skipped.
//
// A file whose only history is a migration gets no date, and the sitemap omits
// <lastmod> for it rather than inventing one. That is deliberate: lastmod is
// optional per URL, and "these 116 pages changed, the rest I'm not claiming
// about" is a far more useful thing to tell a crawler than one date stamped
// across the entire corpus.

import { execFileSync } from 'node:child_process';

// Commits that moved or restored files without changing what a reader sees.
const INFRASTRUCTURE = new Map([
  ['aca50a6d', 'Move answer content into the repo and off Supabase -- the answers import'],
  ['a7fe82b7', 'Lift grape, region and topic content into the repo -- the docs import'],
  // Restored sections to region-burgundy and region-rhone that had been lost
  // from the files. The pages they generate were already live and came back
  // byte-identical, so nothing changed for a reader.
  ['12fafb73', 'Retire supabase-client.js -- included the region-burgundy/rhone repair'],
]);

const isInfrastructure = (sha) => [...INFRASTRUCTURE.keys()].some((prefix) => sha.startsWith(prefix));

// One `git log` pass, newest first, so the first time a path appears is its
// most recent edit.
//
// Throws on a shallow clone rather than returning an empty map. actions/checkout
// defaults to fetch-depth 1, which would leave `git log` with a single commit
// and quietly drop every <lastmod> from the sitemap -- a regression nothing
// would have failed on, since a sitemap with no lastmod is still a valid
// sitemap. The workflows that build the sitemap set fetch-depth: 0.
export function contentEditDates({ cwd = '.' } = {}) {
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd, encoding: 'utf8' }).trim();
  if (shallow === 'true') {
    throw new Error(
      'Refusing to build content dates from a shallow clone: git log cannot see the history ' +
        'the dates come from. Check out with fetch-depth: 0.'
    );
  }

  const log = execFileSync('git', ['log', '--format=C %H %cs', '--name-only', '--', 'content/'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  const dates = new Map();
  let sha = null;
  let date = null;
  for (const line of log.split('\n')) {
    if (line.startsWith('C ')) {
      [, sha, date] = line.split(' ');
      continue;
    }
    if (!line.startsWith('content/') || !sha || isInfrastructure(sha)) continue;
    if (!dates.has(line)) dates.set(line, date);
  }
  return dates;
}
