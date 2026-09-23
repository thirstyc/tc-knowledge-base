# knowledge.thirstyc.com — crawlability & indexing audit

Audit body written 2026-09-23 against `origin/main` at `213780cf`, read-only.
Sections 1–10 are that audit as taken. This block records what was found and
changed afterwards, in the same session, and supersedes the body where they
disagree.

## Since the audit — read this first

### 1. `knowledge_chunks` is damaged in production (found after the body was written)

Not an SEO finding, and the most serious thing here. The public REST endpoint —
the one the live site calls — reports that `knowledge_chunks` has **no `status`
column and no `lang` column**, and returns **zero rows** to the anon key.
`id`, `content`, `source_doc`, `section_title`, `chunk_type` and `created_at`
survive.

Every query in this repo filters on `status=eq.published` and `lang=eq.en|fr`,
so all of them now return HTTP 400 `42703`.

Dated from CI:

| when | what |
|---|---|
| 2026-09-20 12:54 UTC | `generate-pages.yml` **succeeded** — "1762 total URLs across 9 content types". Schema healthy, ~4,143 rows. |
| 2026-09-21 12:29 UTC | audit workflow failed; cause not in the retained log |
| 2026-09-21 ~18:07 | CLAUDE.md written: *"the 2026-09-21 incident: a session from this repo dropped and recreated the `wines` table"* |
| 2026-09-22 11:19 UTC | audit failed — `column knowledge_chunks.status does not exist` |
| 2026-09-23 11:13 UTC | same |

The window lands on the 2026-09-21 incident. CLAUDE.md records that incident as
hitting `wines`. The evidence says `knowledge_chunks` was hit too and nobody
noticed — it isn't mentioned in CLAUDE.md, and the daily audit that would have
caught it has been failing ever since, so it never wrote a report.

Consequences beyond this audit: all four generators fail on their first fetch,
`generate-pages.yml` has been broken since 2026-09-20, `audit-links.mjs` has
been dead for three days, and `answers.html` / `search.html` / the homepage
answer lists are **empty for real users**, not merely for crawlers — see the
correction in §10.

Nothing here touched the database. Restoring the columns is DDL on production,
which CLAUDE.md puts behind a reviewed migration and a verified `pg_dump`.
Whether the rows still exist or are only RLS-hidden could not be determined from
the anon key.

### 2. What has since been fixed

Three commits, pushed to `main` (`0d64f486`, `b03625cc`, `a5ddc3f7`). They
change generators only — **no page on disk has been regenerated**, because that
needs the database:

- Region pages now list the answers about their sub-regions (`lib/region-answers.mjs`).
  §10's "no `region-*` page links any answer page" is addressed in code.
- Topic pages now match both answer chunk types instead of assuming answers are
  filed on the topic's own axis — `topic-burgundy` had 12 answers, most of them
  about Austria, Jura, Languedoc and Willamette; it gets 77.
- Both answer-list caps were binding and truncating alphabetically (topics at
  100, grapes at 60). Raised to 250 and 120, sized from measurement, with
  `scripts/verify-answer-coverage.mjs` failing the build if a page outgrows one.

Projected effect on §10's headline figure: **573 → 346** sibling-only answer
pages. The remaining 346 need hub pages that don't exist (105 minor grapes and
drinks, 47 regions with no document, 21 general service/health questions), not
better matching.

Both `npm run verify:region-answers` and `npm run verify:answer-coverage` run
without a database and pass.

## Scope note — which tree this audits

The local tree has now been **fast-forwarded to `origin/main` (`213780cf`)** and
everything below is re-verified against it directly. It is confirmed to be what
is live: the deployed `sitemap.xml` is byte-identical, and spot-checked URLs
return the same bytes.

The first pass was run against a checkout that was **17 commits behind**, which
produced two wrong findings, both now corrected:

- *"Only 7 of 2,324 pages have a canonical"* — commit `4fafbe67 Give every page
  a canonical URL` had already fixed this upstream. Actual: 2,913 self-
  referencing canonicals, 3 absent. (§4)
- *"No crawlable index of the answer corpus exists"* — wrong for a different
  reason: I had inbound-link counts but never broke them down by source type,
  and inferred all links were sibling-to-sibling. `grape-*` and `topic-*` pages
  carry ~3,600 static links to answer pages. Corrected in §10, where the real
  and narrower problem is stated.

Pre-existing uncommitted work (the sitemap-rename changes, plus a `metadata.json`
and `sitemap.xml` regenerated from the stale tree) was **stashed, not
discarded**, to allow the fast-forward:

```
stash@{0}: On main: sitemap-rename WIP + stale metadata/sitemap (pre-pull, audit session 2026-09-23)
```

It is untouched and recoverable with `git stash pop`. See §9 before restoring it
— two of those files are now strictly worse than what upstream has. The untracked
`CLAUDE.md` was removed only after verifying byte-identity with `origin/main`'s
copy (it was a leftover of a `reset: moving to HEAD~1` visible in the reflog);
the pull restored it exactly. Both peer worktrees (`fr-localization-session`,
`sitemap-session`) were clean and were not touched.

Deployed tree: **2,930 HTML files** — 1,470 at root, 1,460 under `fr/`.
Of those, **2,416 are answer pages** (1,205 EN + 1,204 FR real pages, plus 7
redirect stubs), and there are 14 redirect stubs sitewide.

---

## 1. Are answers in the static HTML, or loaded at runtime?

**All five sample pages ship the complete answer text in the static HTML.**
Zero answer pages anywhere on the site load `supabase-client.js`, and zero
contain a `fetch(` call. A crawler that never executes JavaScript sees the
entire answer.

| Page | `<script src>` | `fetch(` | Answer text in static HTML |
|---|---|---|---|
| `answer-albarino-pairing.html` (EN) | none | no | yes — full |
| `answer-alcohol-content.html` (EN) | none | no | yes — full |
| `answer-grenache-alcohol-tannin.html` (EN) | none | no | yes — full |
| `fr/answer-albarino-pairing.html` (FR) | none | no | yes — full |
| `fr/answer-alcohol-content.html` (FR) | none | no | yes — full |

Sitewide, `supabase-client.js` is referenced by **504 pages** — all of them
`grape-*` (364), `region-*` (64), `topic-*` (44), `comparison-*` (8),
`guide-*` (6), `enology-*` (4), and the hub pages — split evenly EN/FR. Those
pages' own body copy is still static; on `grape-*`/`region-*`/`topic-*` the
script tag is loaded but **no inline code calls it**, so it is a dead request
on 476 pages.

Where it genuinely matters is the hubs — see §10.

---

## 2. robots.txt

Live file (identical on `origin/main`). **31 `User-agent` groups, 3
`Crawl-delay` lines, 1 `Sitemap:` line.**

### Full block — AI / scraper crawlers (`Disallow: /`, no Crawl-delay)

GPTBot · ChatGPT-User · OAI-SearchBot · ClaudeBot · Claude-Web · anthropic-ai ·
CCBot · Google-Extended · Applebot-Extended · Bytespider · PerplexityBot ·
Perplexity-User · Diffbot · Omgili · Omgilibot · FacebookBot ·
Meta-ExternalAgent · Meta-ExternalFetcher · cohere-ai ·
cohere-training-data-crawler · Amazonbot · YouBot · Timpibot · ImagesiftBot ·
Ai2Bot  — **25 agents**

### Full block — SEO crawlers (`Disallow: /`)

MJ12bot · DotBot · MZBot — **3 agents**

### Throttled

| User-agent | Allow | Disallow | Crawl-delay |
|---|---|---|---|
| `AhrefsBot` | — | `/api/`, `/admin/` | **10** |
| `SemrushBot` | — | `/api/`, `/admin/` | **10** |

### Catch-all

| User-agent | Allow | Disallow | Crawl-delay |
|---|---|---|---|
| `*` | `/` | `/api/`, `/admin/`, `/search?`, `/*.json$`, `/*?*utm_`, `/*?*fbclid=`, `/*?*gclid=` | **1** |

`Sitemap: https://knowledge.thirstyc.com/sitemap.xml`

### Observations

- **All three `Crawl-delay` lines** are as listed above (AhrefsBot 10,
  SemrushBot 10, `*` 1). Google ignores `Crawl-delay` entirely; Bing and Yandex
  honour it. At `Crawl-delay: 1`, a full 2,911-URL crawl takes Bing ~48 minutes
  minimum. That is tolerable, but it is a real ceiling on recrawl rate for a
  site this size.
- `Disallow: /*.json$` blocks `/metadata.json`. Harmless today (nothing needs
  it), but worth knowing it is blocked.
- CSS, JS and `assets/` are **not** blocked, so Google can render pages fully.
- `Disallow: /search?` does **not** block `/search.html` — the search page is
  fully crawlable. See §10.
- Blocking `Google-Extended` only opts out of Gemini/Vertex training; it does
  **not** affect Google Search indexing. Blocking `OAI-SearchBot`,
  `PerplexityBot` and `Applebot-Extended` does remove the site from those
  products' answer surfaces. That is a deliberate posture, not a defect —
  flagged only so the tradeoff is explicit.

---

## 3. Sitemaps

**One sitemap file exists and is deployed: `/sitemap.xml`.** No sitemap index,
no per-language or per-type split.

| Metric | Value |
|---|---|
| Total `<loc>` entries | **2,911** |
| Unique URLs | 2,911 (**0 duplicates**) |
| File size | 280,346 bytes (~274 KB) |
| `<lastmod>` entries | **0** |
| `<changefreq>` / `<priority>` | 0 / 0 |

Well inside the 50,000-URL / 50 MB limits — no need to split.

### Do all sitemap URLs match a file in the repo?

**Yes — 0 mismatches.** Every one of the 2,911 URLs resolves to a file that
exists in the deployed tree. (`/` → `index.html`, `/fr/` → `fr/index.html`.)
Spot-checked 12 live: all 200.

### lastmod — real, placeholder, or absent?

**Absent entirely.** Not fabricated, not placeholder — the element is simply
never emitted. This is deliberate and documented in `lib/sitemap.mjs`:

> Only `<loc>` is included: no lastmod (we don't track real per-page edit times,
> and fabricating one would be a false freshness signal) and no
> priority/changefreq (both deprecated by every major search engine).

Dropping `changefreq`/`priority` is correct. Dropping `lastmod` is a defensible
call but it costs something real: with 2,911 URLs and no freshness signal,
Google has no way to prioritise recrawling the ~530 pages that actually got
expanded to full-length answers over the ~1,780 that are still stubs. Real
`lastmod` values are derivable — `knowledge_chunks` rows carry `created_at`, and
git carries per-file commit times.

### Files in the tree but NOT in the sitemap (19)

Deliberate and correct (9): `404.html`, `fr/404.html`, `search.html`,
`fr/search.html`, plus 5 `answer-*` redirect stubs and
`fr/answer-burgundy-pinot-premium-pairing.html`.

Deliberate per `topics.config.mjs` (3): `audience-beginner.html`,
`audience-enthusiast.html`, `audience-intermediate.html`.

**Not deliberate, and a problem (4+1):**

- `difficulty-beginner.html`, `difficulty-intermediate.html`,
  `fr/difficulty-beginner.html`, `fr/difficulty-intermediate.html`,
  `guide-tasting-notes.html` — all redirect stubs, so their absence from the
  sitemap is **correct** (`lib/sitemap.mjs` filters `REDIRECTS` keys out).
  The defect is that `topics.config.mjs` still lists the two difficulty pages in
  `STATIC_PAGES` and its comment still describes them as real generated pages.
  Inert, but misleading. See §10.

---

## 4. The five sample pages

| | `answer-albarino-pairing` (EN) | `answer-alcohol-content` (EN) | `answer-grenache-alcohol-tannin` (EN) | `fr/answer-albarino-pairing` | `fr/answer-alcohol-content` |
|---|---|---|---|---|---|
| `<html lang>` | `en` | `en` | `en` | `fr` | `fr` |
| `<title>` | What pairs with Albariño? — Thirsty Cunt | What is alcohol content in wine? — Thirsty Cunt | Why Grenache Gets You Tipsy Without Grabbing Your Gums — Thirsty Cunt | Avec quoi marier l'Albariño ? — Thirsty Cunt | Qu'est-ce que le degré d'alcool dans le vin ? — Thirsty Cunt |
| title length | 40 | 47 | **69** | 48 | 68 |
| meta description | "Raw oysters. Raw seafood." | "Most wine is between 11% and 15% alcohol by volume, and the number is printed on every label. Alcohol comes from sugar." | "Sugar sits in the pulp, tannin sits in the skins. Why Grenache runs high in alcohol and low in grip." | "Des huîtres crues. Des fruits de mer crus." | "La plupart des vins titrent entre 11 % et 15 % d'alcool par volume, et ce chiffre est indiqué sur chaque étiquette. L'alcool provient du sucre." |
| desc length | **25** | 119 | 100 | **42** | 151 |
| canonical | self ✓ | self ✓ | self ✓ | self ✓ | self ✓ |
| hreflang | 3 (en / fr / x-default) | 3 | **0 — absent** | 3 | 3 |
| JSON-LD | `FAQPage`, 1 `Question` | `FAQPage`, 1 `Question` | **none** | `FAQPage`, 1 `Question` | `FAQPage`, 1 `Question` |
| body word count | **10** | 185 | 30 | **21** | 253 |

hreflang on the four that have it is the correct 3-link reciprocal set
(`en` → EN URL, `fr` → FR URL, `x-default` → EN URL), identical on both sides of
each pair.

### Sitewide metadata coverage (2,930 pages)

| | count | share |
|---|---|---|
| self-referencing canonical | 2,913 | 99.4% |
| cross-referencing canonical (redirect stubs + 2 real pages) | 14 | 0.5% |
| **no canonical at all** | **3** | `404.html`, `fr/404.html`, `audience-enthusiast.html` |
| hreflang present | 2,912 | 99.4% |
| JSON-LD present | 2,900 | 99.0% |
| `noindex` | **0** | — |
| wrong `<html lang>` | **0** | — |
| hreflang → non-existent file | **0** | — |
| hreflang missing reciprocal return link | **0** | — |

Canonical/hreflang hygiene is genuinely good. The exceptions:

- **`answer-grenache-alcohol-tannin.html`** is the only real answer page with
  **no hreflang and no JSON-LD**. It is hand-written (it is the one answer page
  listed individually in `STATIC_PAGES`) and has no `fr/` counterpart, so it
  fell outside the generator that adds both.
- **`audience-enthusiast.html`** has no canonical, no hreflang, no JSON-LD, and
  no `noindex`. Per `topics.config.mjs` it is "a hand-built mockup with
  fabricated placeholder answers". It is excluded from the sitemap and is now
  orphaned (zero inbound links), so crawl risk is low — but *sitemap exclusion
  is not deindexing*. If it ever picks up an external link it can be indexed
  with fabricated content. It needs `<meta name="robots" content="noindex">`.
- `404.html` / `fr/404.html` correctly return HTTP 404 live, so their lack of
  canonical is fine.

### Duplicate titles and descriptions (real answer pages only)

| | EN | FR |
|---|---|---|
| duplicate `<title>` | 31 groups / **63 pages** | 20 groups / **40 pages** |
| duplicate meta description | 52 groups / **199 pages** | 41 groups / **162 pages** |
| duplicate answer body text | 13 groups / **31 pages** | 10 groups / **24 pages** |

Worst offenders (EN descriptions): `"Grilled meat. Lamb."` on **26 pages**;
`"Seafood. Fresh pasta."` on 11; `"Grilled meat. Stew."` on 11; `"Light salads.
Grilled fish."` on 8. The description is generated by truncating the first two
sentences of an answer, and the shortest answers are exactly the ones whose
first two sentences are generic pairing nouns.

Worst offenders (EN titles): three pages titled *"What pairs with Vinho
Verde?"* (`answer-region-vinho-verde-pairing`, `answer-vinho-verde-casual-pairing`,
`answer-vinho-verde-pairing`); two each for Alsatian Riesling, Beaujolais
(×3 separate pairs), Burgundy Pinot.

Identical body text across distinct URLs (EN): 4 pages share *"Grilled fish.
Roasted poultry. Mushrooms. Elegant."* (`new-zealand-pinot`, `oregonian-pinot`,
`south-african-pinot`, `victoria-pinot` — all `-pairing`). These will be
collapsed by Google as duplicates regardless of the distinct canonicals.

### Metadata length

| | count (of 2,409 real answer pages) |
|---|---|
| title > 60 chars | **984** (41%) |
| description < 70 chars | **1,112** (46%) |
| description > 160 chars | **847** (35%) |
| description missing | 0 |

Only ~19% of descriptions land in the 70–160 char window that survives
untruncated in a SERP.

---

## 5. English text on `/fr/` pages

**None found.** This is clean.

Checks run across all 1,460 `fr/` pages:

- FR answer text byte-identical to its EN counterpart: **0**
- FR meta description identical to EN: **0**
- FR `<title>` identical to EN: **5**, all legitimate —
  `fr/answer-burgundy-pinot-premium-pairing.html`, `fr/difficulty-beginner.html`
  and `fr/difficulty-intermediate.html` are redirect stubs titled `Moved` (a
  real bug, but §10's, not a translation bug), and
  `fr/answer-compare-albarino-vermentino.html` /
  `fr/answer-compare-barbera-sangiovese.html` are genuinely
  `"Albariño vs Vermentino ?"` / `"Barbera vs Sangiovese ?"` in both languages.
- English-function-word density > 10% inside `<main>`: **0 of 1,460**.

Page chrome is fully localised (`Accueil`, `Réponses`, `Cépages`, `Régions`,
`Rechercher`, `À propos`, `Télécharger l'app`, `Réponse courte`, `Continuer`,
`Lire la réponse`). `<html lang="fr">` is correct on all 1,460. No
double-encoded entities anywhere (`&amp;#39;` count: 0).

Early flags on `fr/regions.html`, `fr/topic-burgundy.html` and
`fr/grape-tannat.html` were false positives — the matches were slug/ID strings
like `REGION-SOUTH-AFRICA` and `QA-…-PAIRING` in `.eyebrow` / `.card-meta`
elements, not prose.

---

## 6. Thin content

Measured as prose words inside `<div class="short-answer">` — the actual answer,
excluding the `Topic` / `Difficulty` meta bar, nav, related cards and footer.
Population: 2,409 real answer pages (7 redirect stubs excluded).

| threshold | pages | share | EN | FR |
|---|---|---|---|---|
| **under 150 words** | **1,779** | **73.8%** | 890 | 889 |
| under 100 words | 1,779 | 73.8% | 890 | 889 |
| under 50 words | 1,718 | 71.3% | 881 | 837 |

min 4 · median **23** · mean 70.6 · max 309 · total corpus 169,956 words.

The distribution is sharply bimodal, with **nothing at all between 100 and 149
words**:

```
   0- 24   1258  ##################################################
  25- 49    460  ##################
  50- 74     55  ##
  75- 99      6  
 100-149      0
 150-174     58  ##
 175-199    229  #########
 200-224     83  ###
 225-249    149  ######
 250-274     89  ####
 275-299     21  #
 300-324      1  
```

Two distinct content generations: ~1,779 one-line stubs (median 23 words) and
~630 properly written answers (median ~215). There is no middle. The stub half
is the site's indexing problem — at 23 words with a duplicated meta description
and a duplicated title, those pages have almost nothing for Google to index that
isn't already on a sibling page.

### The 20 shortest

| # | words | file | full answer text |
|---|---|---|---|
| 1 | 4 | `answer-vermouth-aperitivo-pairing.html` | Aperitivo. Cocktails. Appetizers. Herbal. |
| 2 | 5 | `answer-alsatian-riesling-serious.html` | European Riesling underrated. Quality serious. |
| 3 | 5 | `answer-beaujolais-casual-pairing.html` | Light salads. Charcuterie. Fresh. Casual. |
| 4 | 5 | `answer-beaujolais-everyday.html` | Volume production. Casual red. Everyday. |
| 5 | 5 | `answer-bordeaux-blend-structured.html` | Cabernet-Merlot-Cabernet Franc. Elegant. Structured. Premium. |
| 6 | 5 | `answer-burgundy-pinot-investable.html` | Yes. 10–20 years. Investment premium. |
| 7 | 5 | `answer-caladoc-value.html` | Languedoc reds underrated. Value excellent. |
| 8 | 5 | `answer-israeli-cabernet-ripe.html` | Mediterranean climate. Ripe. Structured. Modern. |
| 9 | 5 | `answer-liston-negro-emerging.html` | Canary Islands specialty. Limited. Emerging. |
| 10 | 5 | `answer-piccolit-dessert-pairing.html` | Dessert. Pungent cheese. Walnuts. Honey-driven. |
| 11 | 5 | `answer-pinot-gris-mass-market.html` | Approachable. Light. Casual. Mass-market friendly. |
| 12 | 5 | `answer-region-burgundy-positioning.html` | Ancient terroir classification. Scarcity. Legend. |
| 13 | 5 | `answer-sancerre-loire-pure-pairing.html` | Seafood. Goat cheese. Bright. Mineral-pure. |
| 14 | 5 | `answer-sherry-serious.html` | Fortified perception. But complexity serious. |
| 15 | 5 | `answer-sherry-tapas-pairing.html` | Tapas. Seafood. Almonds. Ham. Dry. |
| 16 | 5 | `answer-vermouth-styles-vary.html` | Regional traditions. Different botanicals. Styles. |
| 17 | 5 | `answer-victoria-pinot-elegant.html` | Cool climate. Elegant. Mineral. Serious. |
| 18 | 5 | `answer-vinho-verde-casual-pairing.html` | Seafood. Salads. Light appetizers. Casual. |
| 19 | 5 | `answer-washington-syrah-peppery.html` | Cool climate. Spicy. Structured. Serious. |
| 20 | 6 | `answer-alsatian-riesling-bold-pairing.html` | Spicy food. Asian. Pungent cheese. Bold. |

Every one of these also emits a `FAQPage` JSON-LD whose `acceptedAnswer.text` is
that same 4–6 word fragment. Google's FAQ structured-data guidelines require the
answer to be the complete answer to the question; 4-word fragments are the kind
of thing that gets a site's rich results suppressed.

---

## 7. Slug-prefix clusters (EN answer pages, 1,211 total, 340 clusters)

Clustered by longest entity-slug prefix matched against the vocabulary of
`grape-*` / `region-*` / `topic-*` page slugs, falling back to the first token.
`region-*` is a naming prefix rather than an entity, so it is split one level
deeper.

### 15 largest

| # | cluster | pages |
|---|---|---|
| 1 | `pairing-*` | 51 |
| 2 | `buying-*` | 40 |
| 3 | `what-*` | 33 |
| 4 | `wine-*` | 27 |
| 5 | `compare-*` | 26 |
| 6 | `australian-*` | 18 |
| 7 | `south-*` | 12 |
| 8 | `sourcing-*` | 10 |
| 9 | `chilean-*` | 9 |
| 10 | `moscato-*` | 9 |
| 11 | `new-zealand-*` | 9 |
| 12 | `region-central-*` | 9 |
| 13 | `assyrtiko-*` | 7 |
| 14 | `burgundy-*` | 7 |
| 15 | `furmint-*` | 7 |

Next 15, all 6 pages each: `alsatian-*`, `argentinean-*`, `beaujolais-*`,
`caladoc-*`, `california-*`, `champagne-*`, `chianti-*`, `german-*`,
`israeli-*`, `liston-*`, `loire-*`, `malvasia-*`, `ontario-*`,
`region-appalachian-*`, `region-croatia-*`.

### Shape of the tail

- **64 singleton clusters** (one page, no sibling)
- **215 clusters of 2–3 pages**

279 of 340 clusters — 82% — are three pages or fewer. The corpus is extremely
wide and extremely shallow: it covers ~340 entities at a median of ~3 pages
each, most of them stubs. That is the opposite of the shape that earns topical
authority.

### Near-duplicate clusters (same subject, two slug spellings)

- **`albarin-*` (3 pages) ~ `albarino-*` (4 pages)** — and separately
  `alvarinho-*` (3 pages), the Portuguese name for the same grape. Three
  clusters, ten pages, one grape. `answer-albarin-pairing.html` ("Raw oysters.
  Raw seafood. Ceviche. Ocean wine.") and `answer-albarino-pairing.html` ("Raw
  oysters. Raw seafood. Ceviche. Anything coastal. Pure terroir expression.")
  are near-verbatim and compete for the same query.
- **`vintage-*` (4) ~ `vintages-*` (5)** — singular/plural split of one topic
  across nine pages.

---

## 8. `.github/workflows` — 503 risk

Three workflows, all identical between the local tree and `origin/main`. **There
is no deploy workflow** — GitHub Pages builds from the branch, so a push is the
only deploy trigger.

| workflow | trigger | deploy-causing? |
|---|---|---|
| `audit.yml` | `schedule: 0 6 * * *` (daily 06:00 UTC) + dispatch | no (read-only) |
| `generate-content.yml` | `workflow_dispatch` only | no (writes to Supabase) |
| `generate-pages.yml` | `schedule: 0 8 * * 0` (Sundays 08:00 UTC) + dispatch | yes — commits and pushes |

**Deploy frequency is not a 503 risk.** One scheduled push per week, plus
whatever Cath pushes by hand. Nowhere near GitHub Pages' soft limit of ~10
builds/hour.

### The actual 503 risk: `audit.yml` self-DDoSes the site daily

`scripts/audit-links.mjs` (lines 63–78):

```js
const deployed = [...htmlFiles, 'robots.txt', 'sitemap.xml', 'styles.css', 'supabase-client.js'];
await Promise.all(
  deployed.map(async (path) => {
    ...
    const res = await fetch(`${SITE_URL}/${path}`, { method: 'GET' });
```

`localHtmlFiles()` returns every `.html` in the repo root — **1,470 files** on
`origin/main`. Plus 4 assets, that is **1,474 full `GET` requests fired
simultaneously** from one runner IP, with:

- no concurrency cap
- no delay or throttle between requests
- `method: 'GET'` (full body download, not `HEAD`) — ~9 MB pulled in one burst
- no retry and no distinction between a real failure and a rate-limit response

GitHub Pages rate-limits bursts from a single IP and answers with 429/503. So
this job, every day at 06:00 UTC:

1. is very likely **causing** 503s on the live site during the burst window, and
2. records those 503s as `live_status` findings, which
3. fails the job (`exit 1`), which
4. **opens or comments on a GitHub issue** with the false positives.

If `automated-audit` issues have been accumulating noise, this is why. It also
means the audit's real signal is buried.

Two secondary defects in the same function:

- **`localHtmlFiles()` is not recursive** — it only reads the repo root. The
  **entire `fr/` tree (1,460 pages, half the site) is never checked** for live
  status, and no `fr/` page's outbound links are checked either.
- The burst would grow to 2,930 requests if it were made recursive without also
  adding a concurrency cap.

### Secondary: no `concurrency:` group on any workflow

`generate-pages.yml` ends with `git add -A && git commit && git push` and has no
`concurrency:` block. A manual `workflow_dispatch` overlapping the Sunday
schedule gives two runs pushing to `main`; the second gets a non-fast-forward
rejection with no rebase or retry, and the run fails after having regenerated
everything. Low probability, easy to prevent.

---

## 9. Uncommitted local work — sitemap rename

Not live, but it will be if committed as-is. Flagging because it would be a
significant regression.

The working tree renames the sitemap to
`sitemap-80489494cde31196bceb2e56.xml` ("deliberately unguessable … so scrapers
can't pull the full URL list from the usual /sitemap.xml") and removes the
`Sitemap:` line from `robots.txt`.

Three problems:

1. **`writeSitemap()` never deletes the old `sitemap.xml`.** The rename only
   changes the write path. On the next CI run the tree would contain *both*
   files, and `git add -A` would commit the new one while leaving the old,
   now-frozen `sitemap.xml` deployed and still referenced by whatever Google has
   cached. Two sitemaps, one permanently stale.
2. The obfuscation does not achieve its goal. Every URL in the sitemap is
   already discoverable by crawling, and the sitemap URL itself leaks via GSC,
   referrer headers and anyone who fetches it. Meanwhile it removes the standard
   discovery path for Bing, Yandex, DuckDuckGo and every other engine that is
   not GSC/BWT.
3. The regenerated local sitemap has **2,823 URLs vs 2,911 live** — because the
   local tree is 17 commits behind and is missing 92 answer pages that exist and
   return 200 in production. Committing a sitemap generated from this stale tree
   would silently delist 92 live pages.

If the goal is to keep scrapers out, `robots.txt` already blocks 28 named agents;
hiding the sitemap filename adds no protection and costs real discovery.

---

## 10. Internal linking

**Correction.** My first pass claimed "no crawlable index of the answer corpus
exists." That was wrong, and it was wrong because I asserted something I had not
measured — I had the inbound-link *counts* but never broke them down by *source
type*, and inferred the links were all sibling-to-sibling. They are not. A static
hierarchy does exist. The corrected picture is below; the real problem is
narrower but still worth fixing.

### The difficulty stubs were deliberate

Traced to `edfc0b2f Apply page-review fixes to templates and hand-written pages`
(2026-09-19), from your own review of the live site:

> - Answer pages drop the source code eyebrow, topic and difficulty.
> - **The difficulty pages are retired and redirect to the answers index, which
>   now browses by topic.**

`redirects.config.mjs` gained the four entries in that commit; `d6238cc2
Regenerate pages with the page-review fixes` rewrote the files as stubs. Verified
in the pulled tree — all four are stubs titled `Moved`, canonical →
`answers.html`, zero static answer links — and live (HTTP 200).

So this is intended behaviour, not a regression. What it did change is where
answer pages get their inbound links, and that redistribution left gaps.

### The static hierarchy that actually exists

| hub | static outbound links |
|---|---|
| `index.html` | 17 topic/region/grape, 3 answer |
| `answers.html` | **10 topic**, 0 answer |
| `grapes.html` | 182 grape |
| `regions.html` | 288 region |
| `guides.html` | 7 guide/comparison |

And the entity pages do carry answers:

| page type | count | statically link ≥1 answer page |
|---|---|---|
| `topic-*` | 44 | **44 (100%)** |
| `grape-*` | 364 | **340 (93%)** |
| `region-*` | 64 | **0 (0%)** |

`topic-riesling.html` alone emits 100 static answer links; `grape-chablis.html`
38. Measured inbound links to answer pages by source: 1,989 from EN `grape-*`,
828 from EN `topic-*` (plus FR equivalents), against 4,816 from sibling
`answer-*` "Keep Going" cards. So hubs contribute real link equity — my original
claim that none did was simply false.

### What is actually broken

**573 of 2,409 answer pages (24%) are reachable only from sibling answer pages.**
No topic, grape, region or index page links them. They sit in a closed mesh of
3-card "Keep Going" blocks pointing at each other, discoverable by crawlers only
via the sitemap. Examples: `answer-beaujolais-pairing.html`,
`answer-corked-wine.html`, `answer-champagne-dom-perignon-age.html`,
`answer-collecting-authenticate.html`, `answer-avoid-hangovers.html`,
`answer-cortese-*` (all three), `answer-coda-di-volpe-*` (all three).

The other 1,836 (76%) are hub-reachable and fine.

Three contributing causes:

1. **No `region-*` page links any answer page.** All 64 of them. Every
   `region-qa` answer therefore depends on a topic/grape page happening to pick
   it up, or on siblings alone. `answer-region-*` slugs are 246 of the EN corpus.
2. **`answers.html` links only 10 of 22 EN topic pages** — the ten enology
   topics (`biodynamic`, `buying`, `faults`, `fermentation`, `fortified`,
   `natural-wine`, `oak`, `sparkling`, `sulphites`, `tannins`). The twelve
   grape/region topics are absent, so "browses by topic" is a partial browse.
3. **`answers.html` emits zero static answer links** despite being the second
   most internally-linked page on the site (3,879 inbound). Live fetch returns
   0 `class="card"` elements:

   ```js
   window.KnowledgeBase.loadAnswers('answers-grid', 100, null, 'qa,region-qa');
   ```

   Same for `search.html` (1,460 inbound, 0 static content links).

   **Correction.** This section originally read that as a client-side rendering
   choice — bad for crawlers, fine for people. It isn't. That request returns
   HTTP 400 (`column knowledge_chunks.status does not exist`), `fetchTable`
   catches the non-OK response and returns `[]`, and the grid renders empty. The
   page is blank **for everyone**, not just for a non-rendering crawler. The
   cause is the schema damage above, not the architecture. Pre-rendering these
   hubs is still worth doing, but it is not what is wrong today.

There is no A-Z or paginated full index anywhere on the site.

### Stale config contradicting the code

`topics.config.mjs` still lists `difficulty-beginner.html` and
`difficulty-intermediate.html` in `STATIC_PAGES`, with the comment:

> difficulty-intermediate.html/difficulty-beginner.html WERE excluded here as
> fabricated mockups; both are now generated from real Beginner/Intermediate
> knowledge_chunks rows, so they're back in.

They are redirect stubs now. `lib/sitemap.mjs` filters `REDIRECTS` keys out of
the sitemap, so the entries are inert rather than harmful — the sitemap is
correct — but the config and its comment now describe a state that no longer
exists, and the next person to read it will be misled exactly as I was.

### Distribution and hygiene

Inbound internal links to the 2,409 real answer pages, counting only non-stub
sources:

| inbound links | pages |
|---|---|
| 0 | **0** |
| 1–2 | 19 |
| 3–5 | 1,380 |
| 6–10 | 774 |
| 11+ | 236 |

- **Broken internal links across all 2,930 pages: 0.** Clean.
- **Orphan pages (zero inbound): 15**, of which 14 are redirect stubs (expected).
  The one real orphan is **`audience-enthusiast.html`**: no inbound links, not in
  the sitemap, no canonical, no `noindex`, and per the config comment it holds
  fabricated placeholder content.
- Topic pages are thinly linked themselves: `topic-buying.html` and
  `topic-nebbiolo.html` have 2 inbound links each.
- **23,329 placeholder `href="#"` links across 2,916 pages** — the footer's "The
  App", "Tastings", "The Writing", "Instagram", "Contact", "Privacy Policy",
  "Your Privacy Choices", "Terms & Conditions". Eight dead links in the footer of
  every page. Not a crawl blocker, but "Privacy Policy" and "Terms & Conditions"
  resolving to nothing is a trust-signal problem, and for an alcohol-adjacent
  site it is the kind of thing a manual reviewer notices.

### Domain / transport

- `http://knowledge.thirstyc.com/` → **301** → `https://` ✓
- `https://www.knowledge.thirstyc.com/` does not resolve — no duplicate-host risk ✓
- 404s return a real HTTP 404 ✓ (`fr/` 404s land on root `404.html`, which
  bounces client-side to `fr/404.html` while preserving the 404 status)
- No GSC/Bing verification files in the repo — presumably DNS or meta-tag verified.

---

## Findings ranked

**Blocking indexing / crawl discovery**

0. **`knowledge_chunks` has lost its `status` and `lang` columns in production**
   and returns no rows. Every generator, the daily audit, and every client-side
   query on the live site fail with HTTP 400. Not an SEO finding — it outranks
   all of them. (Since-the-audit §1)
1. **573 of 2,409 answer pages (24%) are reachable only from sibling answer
   pages** — no topic, grape, region or index page links them. Discoverable by
   crawlers via the sitemap alone. Driven by: zero of 64 `region-*` pages linking
   any answer page, and `answers.html` surfacing only 10 of 22 EN topics. (§10)
   *Addressed in code; projected 573 → 346 once the pages can be regenerated.*
2. `answers.html` — 3,879 inbound links, the #2 page on the site — and
   `search.html` (1,460 inbound) serve zero static content links. Currently
   blank for real users too, because the underlying query 400s. (§10, §1)

**Suppressing quality / triggering duplicate handling**

3. 1,779 of 2,409 answer pages (73.8%) are under 150 words; 1,718 under 50;
   median 23 words. Nothing exists between 100 and 149 words. (§6)
4. 199 EN + 162 FR pages share a meta description with at least one other page;
   `"Grilled meat. Lamb."` appears on 26. 63 EN + 40 FR pages share a title.
   31 EN + 24 FR pages have byte-identical body text. (§4)
5. `FAQPage` structured data on ~1,718 pages carries a 4–6 word
   `acceptedAnswer.text`, against Google's FAQ guidelines. (§6)
6. Three clusters (`albarin-*`, `albarino-*`, `alvarinho-*`) and a
   `vintage-*`/`vintages-*` split cannibalise themselves. 82% of clusters are
   ≤3 pages. (§7)

**Operational**

7. `audit.yml` fires 1,474 concurrent GETs at the live site daily, very likely
   causing the 503s it then reports, failing the job and filing issues about its
   own traffic. It also skips the entire `fr/` tree. (§8)
8. No `concurrency:` group on `generate-pages.yml`; overlapping runs race on
   push. (§8)

**Correctness / hygiene**

9. Uncommitted sitemap rename would leave a stale `sitemap.xml` deployed
   alongside the new one, remove `Sitemap:` from `robots.txt`, and — generated
   from the stale local tree — delist 92 live pages. (§9)
10. `audience-enthusiast.html`: fabricated content, no `noindex`, no canonical.
    (§4, §10)
11. `answer-grenache-alcohol-tannin.html`: only real answer page with no
    hreflang and no JSON-LD. (§4)
12. Sitemap has no `lastmod`, so no freshness signal distinguishes the ~630
    expanded answers from the ~1,779 stubs. (§3)
13. 984 titles over 60 chars; 1,112 descriptions under 70; 847 over 160. Only
    ~19% of descriptions are SERP-safe. (§4)
14. 23,329 placeholder `href="#"` footer links across 2,916 pages, including
    "Privacy Policy" and "Terms & Conditions". (§10)
15. `supabase-client.js` loaded but never called on 476 `grape-*`/`region-*`/
    `topic-*` pages — a dead request per page. (§1)

**Clean — verified, no action needed**

- The difficulty-page retirement was deliberate (`edfc0b2f`, from your own page
  review) and the redirects are correctly excluded from the sitemap. (§10)
- A static crawl hierarchy does exist: 44/44 topic pages and 340/364 grape pages
  link answer pages directly. (§10)
- Answer text is fully static on all answer pages; nothing loads at runtime. (§1)
- Zero broken internal links across 2,930 pages. (§10)
- Zero sitemap URLs pointing at missing files; zero duplicates. (§3)
- Zero English body text on any of 1,460 `fr/` pages; `<html lang>` correct
  everywhere. (§5)
- hreflang: 2,912 pages, zero dangling targets, zero missing return links. (§4)
- Canonical: 2,913 self-referencing, 3 absent (2 are 404 pages). (§4)
- HTTPS redirect, no `www` duplicate, real 404 status codes. (§10)

---

*Sections 1–10 were an audit only; no file was modified while taking them.
Three generator fixes have since been made and pushed — see "Since the audit"
above. No generated page has been regenerated, because `knowledge_chunks` is
still missing the columns every generator reads.*
