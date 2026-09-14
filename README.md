# tc-knowledge-pipeline

Intake → process → publish pipeline for a Supabase-backed knowledge base.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
3. Run `schema.sql` in the Supabase SQL editor to create the `knowledge_chunks` table, its vector index, and the `match_knowledge_chunks` search function.

## Usage

1. Drop `.md` files into `intake/`. Optional frontmatter: `title`, `tags`, `category`.
2. `npm run add` — normalizes each file (assigns an `id`, marks `status: pending`).
3. `npm run process` — for each pending file: gets a Claude-generated summary (and tags/category if missing), chunks the content, embeds each chunk locally (`Xenova/gte-small`, 384-dim, no API key needed), upserts the chunks into `knowledge_chunks` as `status: draft`, and archives the source file to `archive/`.
4. `npm run publish` — flips all `draft` chunks to `published`, making them visible to `match_knowledge_chunks`.

Re-dropping a file with the same name and re-running `add`/`process` replaces its prior chunks (matched on `source_file`).

## Querying published chunks

From any client with the anon/service key, embed a query with the same model and call:

```sql
select * from match_knowledge_chunks(query_embedding := '[...]'::vector, match_count := 5);
```
