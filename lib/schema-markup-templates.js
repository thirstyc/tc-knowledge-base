// JSON-LD (schema.org) builders for knowledge.thirstyc.com pages.
//
// Each builder returns a plain object. Generated pages pass them to
// renderHead({ jsonLd }) in lib/page-shell.mjs:
//   faqPageSchema -> scripts/generate-missing-pages.mjs (answer-*.html)
//   topicSchema   -> generate-topic-pages.mjs (topic-*.html, fr/topic-*.html)
// index.html is hand-built, so organizationSchema()'s output is pasted into
// its <head> -- regenerate it with toJsonLdScript() if the fields change.

import { BASE_URL } from '../topics.config.mjs';

const ORG_NAME = 'Thirsty Cunt Wine Knowledge';
const ORG_ID = `${BASE_URL}/#organization`;

// Serialises a schema object into a <script> tag. `<` is escaped so a
// stray "</script>" inside answer text can't break out of the tag.
export function toJsonLdScript(schema) {
  const json = JSON.stringify(schema, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

// A. Organization — homepage (index.html) only.
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: ORG_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/assets/tc-monogram.png`,
    email: 'hello@thirstyc.com',
    sameAs: ['https://www.instagram.com/thirstyc.official/', 'https://thirstyc.com'],
  };
}

// B. FAQPage — answer-*.html and other Q&A pages.
//
// faqs: [{ question, answer }] — DYNAMIC: for generated answer pages this is
// the knowledge_chunks row (question = section_title / heading, answer = the
// chunk's plain-text content). Pass plain text; answer may contain simple
// HTML (<p>, <a>, <ul>, <strong>), which Google allows.
// url: DYNAMIC — the page path, e.g. 'answer-tannat-pairing.html'.
export function faqPageSchema({ url, faqs, lang = 'en' }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: `${BASE_URL}/${url}`,
    inLanguage: lang,
    publisher: { '@id': ORG_ID },
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

// C. Topic — topic-*.html grape/region/enology pages.
//
// schema.org has no Wine or GrapeVariety type that search engines use, so
// this is a WebPage *about* the topic. All fields DYNAMIC from the
// topics.config.mjs entry + generate-topic-pages.mjs overview chunk:
//   name        topic.topicName            e.g. 'Riesling'
//   description overview chunk summary     (same text as <meta description>)
//   url         `topic-${topic.slug}.html` (or `fr/topic-...` for French)
//   kind        topic.kind                 'grape' | 'region' | 'enology'
export function topicSchema({ name, description, url, kind, lang = 'en' }) {
  const about = { '@type': kind === 'region' ? 'Place' : 'Thing', name };
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url: `${BASE_URL}/${url}`,
    inLanguage: lang,
    about,
    creator: { '@id': ORG_ID },
    isPartOf: { '@type': 'WebSite', name: ORG_NAME, url: BASE_URL },
  };
}
