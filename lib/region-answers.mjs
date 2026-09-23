// Which answers belong on which region page.
//
// Region pages list the answers about their sub-regions, the way grape pages
// list the answers mentioning their grape. Without this, region-*.html was the
// one content page type linking no answers at all, which left the region
// answers reachable only from each other's "Keep Going" cards.
//
// Regions can't reuse generate-catalog-pages.mjs's grapeAnswerMatcher: a grape
// page's name ("Tannat") is a term that appears in answer content, while a
// region page's name is a humanized document slug ("Spain Central East
// Catalunya", "Usa California") that appears nowhere. The join runs the other
// way instead -- from the answer's own source_doc, which encodes the
// sub-region it is about ("qa-region-yarra-valley-style" -> "yarra valley") --
// and asks which region document owns that sub-region.
//
// Pure functions, no Supabase: the caller passes the rows in, so the matching
// can be exercised against fixtures without a database.

// Comparing normalized slug words, not raw text, keeps the accented spellings
// in the documents ("Rías Baixas", "Montérégie", "Île d'Orléans") matching the
// unaccented slugs the source_docs use.
export function matchPhrase(text) {
  const normalized = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  // Padded so `includes` only ever matches on word boundaries: " rioja "
  // must not hit "riojana", and " napa " must not hit "napanee".
  return ` ${normalized} `;
}

// "qa-region-appalachian-plateau-pairing" -> " appalachian plateau ". The last
// segment is the question angle (-pairing / -style / -positioning / -audience)
// and a trailing "-2" disambiguates a second question on the same angle;
// neither is part of the place name. Answers whose source_doc isn't a
// qa-region-* one (plain qa rows) have no sub-region to match on.
export function regionAnswerToken(sourceDoc) {
  if (!sourceDoc.startsWith('qa-region-')) return null;
  const segments = sourceDoc.replace(/^qa-region-/, '').replace(/-\d+$/, '').split('-');
  segments.pop();
  return segments.length ? matchPhrase(segments.join(' ')) : null;
}

// A region document owns a sub-region when one of its section headings names
// it -- the Australia document's "Coonawarra & Cabernet" owns the Coonawarra
// answers. Headings alone only place about two thirds of them, so a sub-region
// no heading names falls back to a mention anywhere in the document's body,
// but only when exactly one document mentions it.
//
// The single-match restriction is what keeps the fallback conservative: a
// place several documents discuss has no one owner, so it is left to the
// heading tier rather than guessed at. The body pass therefore only picks up
// places exactly one document talks about (Yarra Valley, Stellenbosch, Etna).
//
// It binds rarely, because the heading tier already absorbs the names every
// document name-checks comparatively -- Bordeaux, Burgundy and Rioja all match
// a heading on their own page first and never reach the body pass. Today it
// excludes one place: Veneto, which no heading names and both
// region-italy-northeast and region-italy-overview mention. Dropping the
// restriction would currently add 6 links and no fan-out beyond 2 pages; it is
// kept because that ceiling is a property of the present data, not of the
// rule, and a place mentioned everywhere but headed nowhere would spray.
//
// Sub-regions no document names at all (Austria, Croatia, Hungary, the Quebec
// appellations) get no region page -- there is no region document covering
// them to link from. They stay reachable from their sibling answers, and the
// gap is in the region catalog, not here.
//
// headingOf(row) is passed in rather than imported so this module doesn't
// depend on the generator's private splitHeading.
export function buildRegionAnswerIndex(regionRows, answerRows, headingOf) {
  const byDoc = new Map();
  for (const row of regionRows) {
    if (!byDoc.has(row.source_doc)) byDoc.set(row.source_doc, []);
    byDoc.get(row.source_doc).push(row);
  }
  const documents = [...byDoc].map(([sourceDoc, rows]) => ({
    sourceDoc,
    headings: rows
      .filter((row) => row.section_title !== 'Overview')
      .map((row) => matchPhrase(headingOf(row))),
    body: matchPhrase(rows.map((row) => row.content).join(' ')),
  }));

  const index = new Map();
  for (const row of answerRows) {
    const token = regionAnswerToken(row.source_doc);
    if (!token) continue;
    let owners = documents.filter((doc) => doc.headings.some((heading) => heading.includes(token)));
    if (owners.length === 0) {
      const mentions = documents.filter((doc) => doc.body.includes(token));
      if (mentions.length === 1) owners = mentions;
    }
    for (const owner of owners) {
      if (!index.has(owner.sourceDoc)) index.set(owner.sourceDoc, new Set());
      index.get(owner.sourceDoc).add(row.source_doc);
    }
  }
  return index;
}
