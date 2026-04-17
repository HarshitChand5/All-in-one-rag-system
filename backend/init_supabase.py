import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def init_supabase_vector():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    print("Connecting to Supabase Postgres...")
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        print("Enabling pgvector extension...")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        print("Creating document_embeddings table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS document_embeddings (
                id BIGSERIAL PRIMARY KEY,
                document_id TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata JSONB DEFAULT '{}',
                embedding VECTOR(384) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)

        print("Creating match_documents function...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION match_documents(
                query_embedding VECTOR(384),
                match_document_id TEXT,
                match_count INT DEFAULT 15
            )
            RETURNS TABLE (
                id BIGINT,
                document_id TEXT,
                content TEXT,
                metadata JSONB,
                similarity FLOAT
            )
            LANGUAGE plpgsql
            AS $$
            BEGIN
                RETURN QUERY
                SELECT
                    de.id,
                    de.document_id,
                    de.content,
                    de.metadata,
                    (de.embedding <-> query_embedding)::FLOAT AS similarity
                FROM document_embeddings de
                WHERE de.document_id = match_document_id
                ORDER BY de.embedding <-> query_embedding
                LIMIT match_count;
            END;
            $$;
        """)

        conn.commit()
        print("Supabase Vector Setup Complete!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error during Supabase setup: {e}")

if __name__ == "__main__":
    init_supabase_vector()
