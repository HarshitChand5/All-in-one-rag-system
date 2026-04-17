"""
Migration script: Change pgvector from 768-dim to 3072-dim
for Google's gemini-embedding-001 model.

Steps:
1. Delete all existing embeddings (they're 768-dim, incompatible)
2. Alter the column from vector(768) to vector(3072)
3. Recreate the HNSW index
4. Recreate the match_document_chunks function with vector(3072)

After running this, re-upload your documents to re-index them.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=== DocuRAG: pgvector 768 -> 3072 Migration ===\n")

# Step 1: Delete all existing chunk embeddings
print("[1/4] Clearing old embeddings (768-dim, incompatible)...")
try:
    result = sb.table("document_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print("  [OK] Cleared document_chunks table")
except Exception as e:
    print(f"  [FAIL] Error clearing chunks: {e}")

# Step 2-4: Run SQL migration via psycopg2 (direct DB connection)
print("\n[2/4] Altering vector column 768 -> 3072...")
print("[3/4] Recreating HNSW index...")
print("[4/4] Updating match_document_chunks function...")

MIGRATION_SQL = """
-- Step 2: Alter vector column
ALTER TABLE public.document_chunks 
  ALTER COLUMN embedding TYPE vector(3072);

-- Step 3: Recreate HNSW index
DROP INDEX IF EXISTS document_chunks_embedding_idx;
CREATE INDEX ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

-- Step 4: Update match function
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(3072),
  match_count int,
  filter_user_id uuid,
  filter_document_id uuid default null
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  page_number integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE dc.user_id = filter_user_id
    AND (filter_document_id IS NULL OR dc.document_id = filter_document_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
"""

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("\n  [FAIL] DATABASE_URL not found in .env!")
    print("  Please run the following SQL manually in Supabase SQL Editor:\n")
    print(MIGRATION_SQL)
    exit(1)

try:
    import psycopg2
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Step 2: Alter column
    cur.execute("ALTER TABLE public.document_chunks ALTER COLUMN embedding TYPE vector(3072);")
    print("  [OK] Column altered to vector(3072)")
    
    # Step 3: Recreate index
    cur.execute("DROP INDEX IF EXISTS document_chunks_embedding_idx;")
    cur.execute("CREATE INDEX ON public.document_chunks USING hnsw (embedding vector_cosine_ops);")
    print("  [OK] HNSW index recreated")
    
    # Step 4: Update match function
    cur.execute("""
    CREATE OR REPLACE FUNCTION match_document_chunks(
      query_embedding vector(3072),
      match_count int,
      filter_user_id uuid,
      filter_document_id uuid default null
    )
    RETURNS TABLE (
      id uuid,
      document_id uuid,
      content text,
      page_number integer,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        1 - (dc.embedding <=> query_embedding) AS similarity
      FROM public.document_chunks dc
      WHERE dc.user_id = filter_user_id
        AND (filter_document_id IS NULL OR dc.document_id = filter_document_id)
      ORDER BY dc.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
    """)
    print("  [OK] match_document_chunks function updated")
    
    cur.close()
    conn.close()
    
    print("\n=== Migration complete! Re-upload your documents to re-index. ===")
    
except ImportError:
    print("\n  psycopg2 not installed. Installing...")
    import subprocess
    subprocess.check_call(["pip", "install", "psycopg2-binary"])
    print("  Installed. Please re-run this script.")
except Exception as e:
    print(f"\n  [FAIL] Database error: {e}")
    print("  Try running the SQL manually in Supabase SQL Editor (printed above).")
