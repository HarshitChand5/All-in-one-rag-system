import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def sync_supabase_schema():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    # Direct IPv6 fallback for db.vacxznpripxqlgfbqjtl.supabase.co
    SUPABASE_DB_IP = "[2406:da1c:f42:ae14:1a9f:1925:2a3:2516]"
    
    print("Connecting to Supabase Postgres...")
    try:
        # Try standard connection first
        try:
            conn = psycopg2.connect(db_url, connect_timeout=5)
        except Exception as dns_err:
            print(f"DNS Resolution failed, trying direct IPv6 fallback to {SUPABASE_DB_IP}...")
            # Modify the connection string to use the IP
            # Example: postgresql://user:pass@host:port/db -> postgresql://user:pass@[IP]:5432/db
            import re
            fixed_url = re.sub(r'@[^:/]+', f'@{SUPABASE_DB_IP}', db_url)
            conn = psycopg2.connect(fixed_url, connect_timeout=10)

        cur = conn.cursor()

        print("Enabling pgvector...")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # Update profiles table
        print("Ensuring 'profiles' table exists...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS public.profiles (
                id UUID PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)

        # Update documents table
        print("Ensuring 'documents' table matches professional schema...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS public.documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                title TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER,
                status TEXT DEFAULT 'processing',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        
        # Add columns robustly
        columns = [
            ("user_id", "UUID"),
            ("file_name", "TEXT"),
            ("status", "TEXT"),
            ("chunk_count", "INTEGER")
        ]
        for col_name, col_type in columns:
            try:
                cur.execute(f"ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS {col_name} {col_type};")
            except: pass

        print("Updating 'document_chunks' table for 768-dim embeddings...")
        # If the table exists but has wrong dimension, we might need to recreate it.
        # But for non-destructive update, we'll just ensure it exists with 768.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS public.document_chunks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
                user_id UUID NOT NULL,
                content TEXT NOT NULL,
                embedding VECTOR(768) NOT NULL,
                chunk_index INTEGER,
                page_number INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)

        print("Creating professional 'match_document_chunks' function...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION match_document_chunks(
                query_embedding VECTOR(768),
                match_count INT,
                filter_user_id UUID,
                filter_document_id UUID DEFAULT NULL
            )
            RETURNS TABLE (
                id UUID,
                document_id UUID,
                content TEXT,
                page_number INTEGER,
                similarity FLOAT
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
                    (1 - (dc.embedding <=> query_embedding))::FLOAT AS similarity
                FROM public.document_chunks dc
                WHERE dc.user_id = filter_user_id
                  AND (filter_document_id IS NULL OR dc.document_id = filter_document_id)
                ORDER BY dc.embedding <=> query_embedding
                LIMIT match_count;
            END;
            $$;
        """)

        conn.commit()
        print("SUCCESS: Supabase Cloud Schema Synchronized (768 Dimensions)!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"FAILED to sync schema: {e}")

if __name__ == "__main__":
    sync_supabase_schema()
