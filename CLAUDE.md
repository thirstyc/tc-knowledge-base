# tc-knowledge-base

Static knowledge site (knowledge.thirstyc.com) plus intake pipeline that
writes to the **same production Supabase database as the Thirsty Cellar
mobile app** (repo: ~/Documents/tc-cellar-mobile). User accounts, cellars,
tastings, and subscriptions live in that database.

## Database safety rules (non-negotiable)

Born from the 2026-09-21 incident: a session from this repo dropped and
recreated the `wines` table directly in production. Every app user's wine
data was destroyed, the 7-day backup window aged out, and the data was
unrecoverable.

1. **Never DROP, TRUNCATE, ALTER, or rename a table in production directly.**
   All schema changes are written as migration files in
   `tc-cellar-mobile/supabase/migrations/` (the app repo owns the schema),
   reviewed against the app code that queries those tables, and only then run.
2. **Before ANY destructive change, take a dump** (`pg_dump --format=custom`)
   and verify its size. No dump, no DDL.
3. **This pipeline owns ONLY these tables**: knowledge_chunks,
   knowledge_base_chunks, knowledge_answers, knowledge_intake, wines
   (curated catalog), producers, regions, importers, wines_draft,
   wine_comparisons, wineries, audit_log. Never touch: user_wines, bottles,
   cellars, tastings, wishlist, discoveries, profiles, sommelier_*,
   subscription_*, notifications_sent, temperature_readings.
4. `user_wines` (user data) and `wines` (curated catalog) are separate by
   design. Never merge them; never point user tables at the catalog.
5. In the Supabase dashboard, the per-backup **Restore buttons overwrite
   production** — only "Restore to new project" is ever acceptable.
