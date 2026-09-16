# Architecture Audit — knowledge.thirstyc.com (2026-09-16)

## What Exists
- [x] GitHub Pages deployment — served from **branch `main`, path `/` (repo root)**, NOT `docs/`
- [x] index.html (homepage) — dynamic, pulls live stats from Supabase
- [x] search.html (search interface)
- [x] Topic pages (topic-*.html) — 18 topic pages in the repo (grenache, burgundy, riesling, cabernet-sauvignon, nebbiolo, gamay, chenin-blanc, jura, etna, priorat, rhone-valley, niagara, oak, tannins, sulphites, faults, fermentation, biodynamic)
- [x] supabase-client.js (DB connection) — uses public anon key, correct client-side pattern
- [x] robots.txt (scraping/AI-crawler protection)
- [x] .env file (API keys) — present locally, correctly gitignored, never committed
- [x] package.json with npm scripts (`add`, `process`, `publish` — content intake pipeline, not a build step)

## ⚠️ Critical Finding: Unpushed Commit
Local `main` is **1 commit ahead of `origin/main`**. The most recent commit (`b9dd84c` — "Build out remaining 17 topic pages, replacing search fallbacks") has **not been pushed**, so 17 of the 18 topic pages exist only locally and 404 on the live site.

| File | Local | Live |
|---|---|---|
| `topic-grenache.html` (older commit) | ✓ | 200 |
| `topic-biodynamic.html` (in unpushed commit) | ✓ | **404** |
| All other new `topic-*.html` from `b9dd84c` | ✓ | **404** |

**Fix:** `git push origin main`

## Stale/Dead Directory
`docs/index.html` is a leftover, disconnected copy of an older homepage (with its own embedded Supabase fetch logic, different from the current root `supabase-client.js` approach). Since GitHub Pages is configured to build from the repo **root**, this file is dead weight — it's not deployed and will confuse anyone assuming Pages builds from `docs/`. Recommend deleting `docs/` entirely.

## What's Connected
- [x] `index.html` fetches from Supabase — loads `supabase-client.js`, computes live hero stats from `knowledge_chunks` + `wines`
- [x] `search.html` loads `supabase-client.js` (queries `knowledge_chunks`)
- [x] Topic pages — built as static HTML (generated from Supabase data at build time via the pipeline scripts, not live-fetched per page load)
- [x] Featured answers displayed on homepage (curated `knowledge_chunks` QA ids)

## Endpoints Status (live, as of this audit)
| Endpoint | Status |
|---|---|
| Homepage `/` | 200 |
| `/robots.txt` | 200 |
| `/search.html` | 200 |
| `/topics.html` | 200 |
| `/topic-grenache.html` | 200 |
| `/topic-biodynamic.html` | **404** (unpushed) |
| `/supabase-client.js` | 200 |

## Database Status
- **Supabase connected:** Y — project `qcyzcjikyqnzvnvmfwtk`, matches `SUPABASE_URL` in `supabase-client.js` and `.env`
- **`knowledge_chunks` table:** Y — **1,470 rows total**, RLS enabled, public `SELECT` policy (`anon`+`authenticated`, `qual: true`) — correct for a public knowledge base
  - Breakdown by `chunk_type`: qa 670, region 294, grape 234, region-qa 213, enology 35, producer 8, guide 8, comparison 8
- **`wines` table:** Y — 40 rows, public read policy enabled (matches the "40 wines" homepage stat)
- **`regions` / `producers`:** public read enabled, 15 / 8 rows respectively
- **RLS policies enabled:** Y on every table in `public` schema, including the app's own user data tables (`profiles`, `cellars`, `bottles`, `sommelier_messages`, etc. — this Supabase project is shared with the tc-cellar-mobile app)
- **Security advisories (non-blocking, pre-existing):** 3 `SECURITY DEFINER` functions callable by `anon`/`authenticated` (`check_rate_limit`, `delete_user_account`, `has_paid_entitlement`, `reset_scan_period_if_expired`) and one function with a mutable `search_path` — worth a follow-up pass but unrelated to the knowledge-base site itself and likely already known from prior security work

## Next Actions
1. **`git push origin main`** — ships the 17 missing topic pages (highest priority, one command)
2. Delete the stale `docs/` folder — it's not part of the deployed site and is misleading
3. Confirm the "667 Q&As" marketing stat vs. the live 670-row count — either the copy is slightly stale or it's computed dynamically already (worth a quick check of the homepage stat logic)
4. Optional: address the 4 `SECURITY DEFINER` advisories on the shared Supabase project (separate from this site's scope — flagging for awareness only)
