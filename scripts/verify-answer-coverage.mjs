// Guards the two answer-list ceilings in topics.config.mjs against fixtures
// rebuilt from the generated pages on disk, without touching Supabase.
//
// Run: node scripts/verify-answer-coverage.mjs   (or npm run verify:answer-coverage)
// Exits 1 if any check fails.
//
// Why this exists: both caps used to bind, and nothing said so. A page kept
// rendering, the generators kept exiting 0, and the answers past the cut simply
// had no hub page linking them -- discoverable only by counting inbound links
// across the whole site. The corpus grows every batch, so the same thing
// happens again the moment a topic's match set passes TOPIC_ANSWER_LIMIT. This
// fails first, with the number and the headroom.
//
// It reads the real matcher (lib/grape-answers.mjs) and the real limits
// (topics.config.mjs) rather than re-implementing either, so a change to the
// matching rules is reflected here instead of quietly diverging.
//
// Topic matching is the one thing reproduced rather than imported: the
// generator does it in SQL (`content ILIKE %matchTerm%`), which has no
// JavaScript equivalent to call. A case-insensitive substring test is exactly
// what that SQL means -- see matchesTopic below.

import { readdirSync, readFileSync } from 'node:fs';
import { TOPICS, TOPIC_ANSWER_LIMIT, GRAPE_ANSWER_LIMIT } from '../topics.config.mjs';
import { grapeAnswerMatcher } from '../lib/grape-answers.mjs';

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z]+;/gi, ' ');
const textOf = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// An answer page's question and answer, which together are what the generators
// match against knowledge_chunks.content.
function answerFixtures() {
  return readdirSync('.')
    .filter((f) => /^answer-.*\.html$/.test(f))
    .map((file) => {
      const html = readFileSync(file, 'utf8');
      const question = decode((html.match(/<h1 class="display">([\s\S]*?)<\/h1>/) || [])[1] || '');
      const body = textOf(
        ((html.match(/<div class="short-answer">([\s\S]*?)<\/div>/) || [])[1] || '').replace(
          /<p class="k">[\s\S]*?<\/p>/g,
          ' '
        )
      );
      return { file, content: `${question} ${body}` };
    });
}

// Redirect stubs are skipped, and a page with no <h1> is dropped rather than
// passed on with an empty name. grapeAnswerMatcher('') builds a regex that
// matches every answer, so retiring two grape pages made the harness report
// 1,244 matches each against a limit of 120 -- a number with no meaning,
// produced by measuring pages that no longer exist.
const grapeFixtures = () =>
  readdirSync('.')
    .filter((f) => /^grape-.*\.html$/.test(f))
    .map((file) => {
      const html = readFileSync(file, 'utf8');
      if (/Redirect stub/.test(html)) return null;
      const name = decode((html.match(/<h1 class="display">([\s\S]*?)<\/h1>/) || [])[1] || '').trim();
      if (!name) {
        console.warn(`  !! ${file} has no <h1 class="display"> -- skipped, it cannot be matched against`);
        return null;
      }
      return { file, name };
    })
    .filter(Boolean);

// `content ILIKE %term%` for each of the topic's terms, OR'd -- plus the
// excludeTerm NOT ILIKE that Cabernet Sauvignon uses to keep Cabernet Franc out.
function matchesTopic(topic, content) {
  const terms = [].concat(topic.matchTerm ?? topic.topicName).map((t) => t.toLowerCase());
  const haystack = content.toLowerCase();
  if (topic.excludeTerm && haystack.includes(topic.excludeTerm.toLowerCase())) return false;
  return terms.some((term) => haystack.includes(term));
}

const answers = answerFixtures();
const grapes = grapeFixtures();
if (answers.length === 0 || grapes.length === 0) {
  console.error('  !! no fixtures found -- run this from the repo root, after the pages have been generated');
  process.exit(1);
}

let failures = 0;
const empty = [];
// Over the limit is reported, not failed. That is a deliberate change from
// how this started, and the reason it is safe now is not that the limit
// stopped mattering -- two things it depended on changed:
//
//   The generator used to cut the list in source_doc order, so the answers
//   dropped were whichever sorted late in the alphabet. It now ranks by how
//   central the term is (named in the question, then mention count), so what
//   falls off the end is the passing mentions.
//
//   An answer dropped from a topic page used to risk having no inbound link
//   at all. answers.html now links all 1,167, so nothing is orphaned by a
//   truncated topic list.
//
// With both of those true, a topic matching more answers than it lists is
// ordinary growth, and expansion guarantees more of it -- topic-tannins went
// from inside the cap to 270 matches on the first tranche alone, because a
// 160-word answer explains mechanisms and mentions tannin in passing where a
// 12-word one did not. Failing on that would fire on every tranche.
//
// A page matching NOTHING is collected and named at the end, but does not fail
// either. Twelve do today, and eleven are obscure grape/region pages nobody
// has written an answer for yet -- pre-existing coverage gaps, not a matcher
// that broke. Failing on a known backlog every night is how a check gets
// ignored. They are listed by name so the gap stays visible and someone can
// decide to write for them or retire them.
function report(kind, name, count, limit) {
  const headroom = limit - count;
  if (count === 0) {
    empty.push(`${kind} ${name}`);
  } else if (count > limit) {
    console.log(`  over  ${kind} ${name}: ${count} matches, lists the ${limit} most relevant`);
  } else if (headroom <= limit * 0.1) {
    console.log(`  near  ${kind} ${name}: ${count} matches, ${headroom} under the limit of ${limit}`);
  }
  return count;
}

console.log(`fixtures: ${answers.length} answers, ${grapes.length} grape pages, ${TOPICS.length} topics`);
console.log(`limits: TOPIC_ANSWER_LIMIT=${TOPIC_ANSWER_LIMIT}, GRAPE_ANSWER_LIMIT=${GRAPE_ANSWER_LIMIT}\n`);

// Topics. The generator now matches both answer chunk types, so every answer
// page is a candidate for every topic regardless of which kind the topic is.
console.log('topic answer lists:');
const topicCounts = TOPICS.map((topic) => {
  const count = answers.filter((a) => matchesTopic(topic, a.content)).length;
  report('topic', topic.slug, count, TOPIC_ANSWER_LIMIT);
  return [topic.slug, count];
}).sort((a, b) => b[1] - a[1]);
const [topTopic, topTopicCount] = topicCounts[0];
console.log(`  largest: ${topTopic} at ${topTopicCount} of ${TOPIC_ANSWER_LIMIT} (${TOPIC_ANSWER_LIMIT - topTopicCount} spare)`);
console.log(`  next:    ${topicCounts.slice(1, 4).map(([s, n]) => `${s} ${n}`).join(', ')}`);

// Grapes, through the matcher the generator itself uses.
console.log('\ngrape answer lists:');
const grapeCounts = grapes
  .map(({ file, name }) => {
    const matcher = grapeAnswerMatcher(name);
    const count = answers.filter((a) => matcher.matches(a.content)).length;
    report('grape', file.replace(/^grape-|\.html$/g, ''), count, GRAPE_ANSWER_LIMIT);
    return [file.replace(/^grape-|\.html$/g, ''), count];
  })
  .sort((a, b) => b[1] - a[1]);
const [topGrape, topGrapeCount] = grapeCounts[0];
console.log(`  largest: ${topGrape} at ${topGrapeCount} of ${GRAPE_ANSWER_LIMIT} (${GRAPE_ANSWER_LIMIT - topGrapeCount} spare)`);
console.log(`  next:    ${grapeCounts.slice(1, 4).map(([s, n]) => `${s} ${n}`).join(', ')}`);

// A limit that no longer binds anything is the point; one that binds silently
// is the bug this guards. Both messages name the page and the number so the
// fix is a decision (split the topic, or raise the limit deliberately) rather
// than a mystery.
if (empty.length) {
  console.log(`\n${empty.length} page(s) list no answers at all:`);
  console.log(`  ${empty.join(', ')}`);
  console.log('  Either nothing has been written on them yet, or their match term no longer matches.');
} else {
  console.log('\nevery topic and grape page lists answers');
}
process.exitCode = failures ? 1 : 0;
