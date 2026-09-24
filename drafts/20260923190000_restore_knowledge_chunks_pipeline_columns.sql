-- Restore the columns the knowledge-base pipeline writes to knowledge_chunks.
--
-- DRAFT — not applied. Review before running. See the notes at the bottom.
--
-- RETAINED DELIBERATELY. knowledge.thirstyc.com no longer reads this table —
-- the site generates from content/docs and content/answers in this repo — so
-- nothing on the website needs this migration any more. It is kept for the AI
-- sommelier, which is the one thing that still wants embeddings and the
-- pipeline columns. Do not bin it as leftover from the Supabase migration.
--
-- Background. knowledge_chunks was created by 20260710194133_knowledge_base_rag
-- with nine columns. The tc-knowledge-base pipeline then added status, lang,
-- published_at, chunk_index, summary and tags directly in production, without a
-- migration. When the table was rebuilt on or around 2026-09-21 it came back as
-- the tracked migration defines it, and those six columns went with it, along
-- with every row created after 2026-07-10 (343 of roughly 4,143 survive, all
-- dated 2026-07-10, none of them qa or region-qa).
--
-- That is the actual root cause, and it recurs on the next rebuild unless the
-- columns live in a migration. Restoring the data does not fix it; this does.
--
-- Every generator in tc-knowledge-base filters on `status = 'published'` and
-- `lang = 'en'|'fr'`, so all of them currently fail with 42703, and so does
-- every client-side query on knowledge.thirstyc.com.
--
-- Additive only. No DROP, no TRUNCATE, no data deleted. The one index that is
-- replaced is widened, not narrowed.

-- 1. The six missing columns.
--
-- status is added with default 'published' and then switched to default
-- 'draft'. That is deliberate: ADD COLUMN ... DEFAULT backfills the existing
-- rows in the catalog without touching them, so the 343 survivors come back
-- visible, while anything inserted from here on defaults to the safe value. It
-- also avoids an UPDATE — see the trigger note at the bottom.
--
-- Existing rows are all English (region, enology and grape content from the
-- July seed), so `default 'en'` backfills them correctly.
alter table public.knowledge_chunks
  add column if not exists status       text not null default 'published',
  add column if not exists lang         text not null default 'en',
  add column if not exists published_at timestamptz,
  add column if not exists chunk_index  integer,
  add column if not exists summary      text,
  add column if not exists tags         text[];

alter table public.knowledge_chunks
  alter column status set default 'draft';

-- 2. Pinned vocabulary, same reasoning as bottles.departure_reason in
-- 20260923150000: these two are the difference between a page being on the
-- site and not, and free text drifts.
--
-- 'draft' and 'published' are the only values the pipeline writes
-- (process-knowledge-intake.mjs inserts draft then publishes;
-- insert-qa-batch.mjs inserts published). 'pending' belongs to
-- knowledge_intake, a different table, and is deliberately not allowed here.
alter table public.knowledge_chunks
  drop constraint if exists knowledge_chunks_status_valid;
alter table public.knowledge_chunks
  add constraint knowledge_chunks_status_valid
    check (status in ('draft', 'published'));

alter table public.knowledge_chunks
  drop constraint if exists knowledge_chunks_lang_valid;
alter table public.knowledge_chunks
  add constraint knowledge_chunks_lang_valid
    check (lang in ('en', 'fr'));

-- 3. Widen the uniqueness rule to include lang.
--
-- This is the blocker for re-ingesting the French half of the corpus.
-- 20260710213901 made (source_doc, section_title, wine_id) unique, and
-- section_title is never translated — it is the join key back to English (see
-- fetchRows in scripts/generate-catalog-pages.mjs). So every French row
-- collides with its English twin under the old index, and the 1,205 French
-- answer pages cannot be restored while it stands.
--
-- The coalesce on wine_id is carried over unchanged: NULLs compare as distinct
-- in a unique index, so without it a NULL wine_id would defeat the constraint.
drop index if exists public.knowledge_chunks_source_section_uidx;

create unique index if not exists knowledge_chunks_source_section_lang_uidx
  on public.knowledge_chunks (
    source_doc,
    section_title,
    lang,
    (coalesce(wine_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );

-- 4. Grant the public read that RLS has been enabling against nothing.
--
-- 20260710194133 enabled row level security on this table and never added a
-- policy, so the anon key currently reads zero rows regardless of what is in
-- it. The site's public read was another thing added by hand and lost. Without
-- this, restoring the columns and the data still leaves every page empty.
--
-- Scoped to anon and authenticated rather than `public`: service_role bypasses
-- RLS anyway, and the sibling policy on knowledge_base_chunks granting to
-- `public` is wider than it needs to be.
drop policy if exists "Public read published chunks" on public.knowledge_chunks;

create policy "Public read published chunks"
  on public.knowledge_chunks
  for select
  to anon, authenticated
  using (status = 'published');

-- 5. Serve the shape every generator actually queries: published rows for one
-- language, optionally narrowed by chunk_type, ordered by (source_doc, id).
create index if not exists knowledge_chunks_published_lang_idx
  on public.knowledge_chunks (lang, chunk_type, source_doc, id)
  where status = 'published';

-- Notes for whoever applies this
-- -----------------------------------------------------------------------
--
-- 1. There is an active `embed-knowledge-on-write` trigger on this table that
--    fires http_request into the embed-knowledge edge function on insert and
--    update. This migration deliberately contains no UPDATE: DDL does not fire
--    row triggers, so nothing here calls the function. A bulk re-ingest later
--    WILL fire it once per row — roughly 2,400 calls for the full corpus —
--    which wants planning (disable the trigger, load, re-enable, backfill
--    embeddings) rather than discovering mid-run.
--
-- 2. Production's migration history does not match this repo. As of drafting,
--    supabase_migrations.schema_migrations records nothing between
--    20260713194201 and 20260923150000, yet 20260921150000_create_user_wines
--    and others have clearly taken effect. Do not apply this with a blanket
--    `supabase db push` — it may try to replay seven unapplied migrations
--    against a schema that already has them. Apply this one file deliberately.
--
-- 3. Per CLAUDE.md, take a `pg_dump --format=custom` and check its size before
--    running this, even though it is additive.
--
-- 4. This restores the shape, not the content. The 343 surviving rows are the
--    July seed; the answer corpus is gone from the database and currently
--    exists only as generated HTML in tc-knowledge-base. Restoring from a
--    pre-2026-09-21 backup is the better route while the 7-day window is open
--    — and per CLAUDE.md rule 5, "Restore to new project" only.
