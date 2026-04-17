-- Supabase Schema for DocuRAG

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Create Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Documents table
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  file_name text not null,
  file_type text not null, -- 'pdf', 'txt', 'md'
  file_size integer,
  doc_metadata jsonb default '{}'::jsonb,
  status text default 'processing', -- 'processing', 'ready', 'failed'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Document Chunks table (stores vector embeddings)
create table public.document_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  -- Google gemini-embedding-001 outputs 3072 dimensions.
  embedding vector(3072),
  chunk_index integer,
  page_number integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- IVFFlat index for vector similarity (HNSW has a 2000-dim limit)
-- Create this AFTER inserting some data for best results:
-- create index on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 5. Create Chat Sessions table
create table public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Create Chat Messages table
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb default '[]'::jsonb, -- Array of chunk references used in the response
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Row Level Security (RLS) setup
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- Setup RLS Policies for Profiles
create policy "Users can view own profile" 
on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile" 
on public.profiles for update using (auth.uid() = id);

-- Setup RLS Policies for Documents
create policy "Users can view own documents" 
on public.documents for select using (auth.uid() = user_id);

create policy "Users can insert own documents" 
on public.documents for insert with check (auth.uid() = user_id);

create policy "Users can delete own documents" 
on public.documents for delete using (auth.uid() = user_id);

-- Setup RLS Policies for Document Chunks
create policy "Users can view own document chunks" 
on public.document_chunks for select using (auth.uid() = user_id);

create policy "Users can insert own document chunks" 
on public.document_chunks for insert with check (auth.uid() = user_id);

-- Setup RLS Policies for Chat
create policy "Users can view own chat sessions" 
on public.chat_sessions for select using (auth.uid() = user_id);

create policy "Users can insert own chat sessions" 
on public.chat_sessions for insert with check (auth.uid() = user_id);

-- Create policy for Chat Messages based on session ownership
create policy "Users can view own chat messages" 
on public.chat_messages for select using (
  exists (
    select 1 from public.chat_sessions 
    where id = chat_messages.session_id and user_id = auth.uid()
  )
);

create policy "Users can insert own chat messages" 
on public.chat_messages for insert with check (
  exists (
    select 1 from public.chat_sessions 
    where id = chat_messages.session_id and user_id = auth.uid()
  )
);

-- Search Function for Vector Similarity (Hybrid Search)
create or replace function match_document_chunks(
  query_embedding vector(3072),
  match_count int,
  filter_user_id uuid,
  filter_document_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page_number integer,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.user_id = filter_user_id
    and (filter_document_id is null or dc.document_id = filter_document_id)
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
