# Pipeline Gap Audit — Intended vs. Actual (2026-09-16)

Scope: the 6-step (later expanded to phases with exact schemas/scripts) intake → processing →
filter → publish → auto-generate → deploy pipeline you described. This audits what actually
exists in the repo/Supabase against that spec.

## Headline finding: two disconnected knowledge tables

The pipeline scripts that exist and the live website read/write **different Supabase tables**
with **incompatible schemas**:

| | `knowledge_base_chunks` (what the intake scripts write to) | `knowledge_chunks` (what the live site reads from) |
|---|---|---|
| Rows | 5 | 1,470 |
| Columns | `id, source_file, chunk_index, title, content, summary, tags, category, embedding, status, created_at, published_at` | `id, content, embedding, source_doc, section_title, chunk_type, wine_id, created_at, updated_at` |
| Has confidence score? | No | No |
| Has bilingual (EN/FR)? | No | No |
| Has difficulty/audience/author? | No | No |

**No script in this repo inserts into `knowledge_chunks`.** Its 1,470 rows got there some other
way (manual SQL, a one-off import, or the mobile app's sommelier pipeline) — the documented
intake→publish flow (`add-intake.mjs` → `process-knowledge-intake.mjs --publish`) is writing into
a near-empty table nobody reads. `schema.sql`'s own `create table if not exists knowledge_chunks`
also doesn't match the live table's actual columns, so it isn't what created it either.

Every gap below stacks on top of this: even if Steps 1–3 worked perfectly, the output currently
lands somewhere the website never looks.

## Step 1 — Intake Scanner

| Sub-step | Status | Detail |
|---|---|---|
| Read Obsidian vault | ⚠️ Partial, inconsistent | Three different scripts point at **two different vault paths**: [process-obsidian-to-supabase.js:18](process-obsidian-to-supabase.js#L18) uses `.../Thirsty Cunt/AI sommelier`; [add-intake.mjs:6](add-intake.mjs#L6) and [process-knowledge-intake.mjs:10](process-knowledge-intake.mjs#L10) use `.../Thirsty Cunt/Knowledge Base`. No single source of truth. |
| Scan user Q&As from app | ❌ Missing | Nothing reads `sommelier_messages` (42 rows, live in Supabase) or any other app table for candidate Q&A content. |
| Scan tasting notes + producers | ❌ Missing | No scanner of the `tastings` (11 rows) or `producers` (40 rows) tables. `populate-40-wines.js` is a one-off hardcoded seed script (3 regions/producers/wines in the file), not a scanner — and it doesn't even run to completion (only inserts `regions`, the rest of the function body for producers/wines/importers is never called). |
| Normalize to standard Q&A format | ⚠️ Partial | `add-intake.mjs` normalizes markdown frontmatter (title/tags/category/id/status) but has no concept of question/answer fields — it's a generic note-intake normalizer, not Q&A-specific. |

## Step 2 — Processing

| Sub-step | Status | Detail |
|---|---|---|
| Claude weave/dedup | ⚠️ Partial | [process-knowledge-intake.mjs:15-45](process-knowledge-intake.mjs#L15-L45) calls Claude Haiku, but only for a 1–2 sentence summary plus tag/category suggestions. There's no deduplication or "weaving together" of overlapping sources — each file is processed independently. |
| Confidence scores | ❌ Missing | Zero references to "confidence" anywhere in the codebase. Notably, the static page templates already have UI for this (`README.md` documents `.badge.high/.moderate/.review` confidence badge classes) — the frontend expects a field the pipeline never produces. |
| Translate to French (DeepL) | ❌ Missing | Zero references to DeepL or translation anywhere in the repo. No bilingual fields exist on either knowledge table. |
| Tag topic/difficulty/audience/source/author | ⚠️ Partial | Only `tags` + `category` are populated (via the Claude enrich call or frontmatter). `difficulty`, `audience`, `source`, and `author` are never set anywhere — despite static archive pages `difficulty-intermediate.html` and `audience-enthusiast.html` already existing as hand-built templates that assume this metadata exists. |

## Step 3 — Filter Gate

| Sub-step | Status | Detail |
|---|---|---|
| Confidence ≥ 0.80 threshold | ❌ Missing | Can't filter on a field that's never computed. No filter-gate logic exists anywhere in the pipeline. |

## Step 4 — Publish to Supabase

| Sub-step | Status | Detail |
|---|---|---|
| Insert with full metadata | ❌ Broken | Writes to `knowledge_base_chunks`, not the table the site reads (`knowledge_chunks`) — see headline finding. Even within `knowledge_base_chunks`, there's no confidence/author/difficulty/audience column to insert into. |
| Track source, author, confidence, timestamp | ⚠️ Partial | `source_file` and `created_at`/`published_at` are tracked; `author` and `confidence` are not. |
| Mark as published | ✅ Exists (but pointless) | `--publish` flag flips `status: 'draft' → 'published'` — works mechanically, just on the disconnected table. |

## Step 5 — Website Auto-Generation

| Sub-step | Status | Detail |
|---|---|---|
| Read Supabase `knowledge_chunks` | ✅ Exists | [supabase-client.js](supabase-client.js) does this correctly, client-side, with the public anon key. |
| Generate `/index.html` (live stats, featured) | ⚠️ Partial | `index.html` fetches live stats via client-side JS at page-load time — that's "live," but it's a hand-authored HTML file with embedded fetch calls, not something a build script regenerates. There is no `scripts/generate-homepage.js`. |
| Generate `/topic-*.html` (one per grape/region) | ❌ Missing (manual) | All 18 `topic-*.html` files are **static, individually hand-committed HTML** (confirmed: `README.md` states outright *"static HTML... No build step, no JS"*, describing the original design intent). There is no `scripts/generate-topic-pages.js`, no `scripts/` directory at all, and no template loop over Supabase topics. Adding a 19th topic means writing another HTML file by hand. |
| Generate `/search.html` (vector query interface) | ⚠️ Partial, wrong method | `search.html` exists and calls Supabase, but does a plain keyword/text filter via `fetchPublishedChunks` — **not** a vector/embedding similarity search. `schema.sql` even defines a `match_knowledge_chunks()` pgvector cosine-similarity RPC function, but nothing on the site calls it, and that function's schema doesn't match the live `knowledge_chunks` table anyway (see headline finding). |
| Generate `sitemap.xml` | ❌ Missing | No sitemap file exists anywhere in the repo. |
| Detail pages (`/answers/{id}.html`) | ❌ Missing | Only one hand-built example exists (`answer-grenache-alcohol-tannin.html`); no generator, no per-entry pages at scale. |
| Bilingual EN/FR URLs | ❌ Missing | No `/en/` or `/fr/` structure; consistent with no translation step existing. |

## Step 6 — Deploy

| Sub-step | Status | Detail |
|---|---|---|
| Commit generated files to GitHub | ✅ Works, but manual | Nothing is "generated" — files are hand-edited and committed by you directly. |
| Push to main | ✅ Works | Confirmed working in the previous audit (once actually pushed). |
| GitHub Pages auto-deploy | ✅ Works | Confirmed: builds from `main` branch root, deploys correctly (~1–2 min build time). |
| GitHub Actions scheduled automation | ❌ Missing | No `.github/workflows/` directory exists — there's no way to trigger this pipeline on a schedule even if the rest were built. |

## Bottom line

What's real: Obsidian markdown intake with basic Claude tagging (into the wrong table), GitHub
Pages deployment, and a client-side Supabase read layer for stats/search/homepage.

What's aspirational: everything involving confidence scoring, deduplication, French translation,
difficulty/audience/author metadata, the vector search the schema already half-supports, sitemap
generation, and any form of templated/generated topic or answer pages. The website today is a
hand-maintained static site with a live data sprinkle on top, not a pipeline output — and the one
existing intake→publish script writes to a table the site doesn't read.

## Suggested order if you want to close these gaps
1. **Pick one `knowledge_chunks` schema** and reconcile `schema.sql`, the live table, and every
   script to agree on it — this unblocks everything else.
2. Add `confidence`, `author`, `difficulty`, `audience` columns (the frontend already has UI
   expecting some of these).
3. Wire `add-intake.mjs`/`process-knowledge-intake.mjs` to write to the real table.
4. Build one topic-page generator before touching translation/vector-search/automation — it's the
   highest-leverage missing piece (18 hand-written files today, growing manually forever otherwise).
