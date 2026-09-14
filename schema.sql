-- Run this once in the Supabase SQL editor for your project.

create extension if not exists vector;

create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  chunk_index int not null,
  title text not null,
  content text not null,
  summary text,
  tags text[] default '{}',
  category text,
  embedding vector(384) not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (source_file, chunk_index)
);

create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists knowledge_chunks_status_idx
  on knowledge_chunks (status);

-- Similarity search over published chunks only.
create or replace function match_knowledge_chunks(
  query_embedding vector(384),
  match_count int default 5
)
returns table (
  id uuid,
  source_file text,
  title text,
  content text,
  summary text,
  tags text[],
  category text,
  similarity float
)
language sql stable
as $$
  select
    id, source_file, title, content, summary, tags, category,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where status = 'published'
  order by embedding <=> query_embedding
  limit match_count;
$$;
