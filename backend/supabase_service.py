import os
import logging
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Supabase credentials missing in .env")
    supabase: Optional[Client] = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_supabase():
    return supabase

# User Management
def sync_user_profile(user_data: dict):
    if not supabase: return None
    try:
        # Expects: id, email, full_name
        res = supabase.table("profiles").upsert(user_data).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Supabase Error (sync_profile): {e}")
        return None

# Documents Management
def insert_document_metadata(doc_data: dict):
    if not supabase: return None
    
    max_retries = 3
    retry_delay = 2 # seconds
    
    for attempt in range(max_retries):
        try:
            # logger.info(f"Syncing to Supabase (attempt {attempt+1}): {doc_data['title']}")
            res = supabase.table("documents").upsert(doc_data).execute()
            if not res.data:
                logger.warning(f"Supabase upsert returned empty data for {doc_data.get('id')}")
            return res.data[0] if res.data else None
        except Exception as e:
            error_msg = str(e)
            if "PGRST204" in error_msg or "schema cache" in error_msg:
                logger.warning(f"Supabase cache delay (attempt {attempt+1}/{max_retries}). Retrying in {retry_delay}s...")
                import time
                time.sleep(retry_delay)
                continue
            logger.error(f"Supabase Error (insert_doc): {e}")
            return None
    return None

def get_document_by_id(doc_id: str):
    if not supabase: return None
    try:
        res = supabase.table("documents").select("*").eq("id", doc_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Supabase Error (get_doc): {e}")
        return None

# Embedding Management
def insert_vector_embeddings(rows: list):
    if not supabase or not rows: return 0
    
    # Pre-flight check: ensure the parent doc exists in Supabase
    doc_id = rows[0].get("document_id")
    import time
    time.sleep(1) # Reduced cool-off
    
    verified = False
    for attempt in range(3):
        try:
            check = supabase.table("documents").select("id").eq("id", doc_id).execute()
            if check.data:
                verified = True
                break
            logger.warning(f"[PRE-FLIGHT] Doc {doc_id} not seen by chunks API (attempt {attempt+1}/3). Waiting...")
        except: pass
        time.sleep(1)
        
    if not verified:
        logger.error(f"[PRE-FLIGHT] FATAL: Doc {doc_id} still not found in Supabase. Indexing will fail.")

    try:
        # Insert in batches of 500 for high throughput
        inserted = 0
        for i in range(0, len(rows), 500):
            batch = rows[i:i+500]
            # Map columns to match public.document_chunks (from schema.sql)
            supabase.table("document_chunks").insert(batch).execute()
            inserted += len(batch)
        return inserted
    except Exception as e:
        logger.error(f"Supabase Error (insert_vectors): {e}")
        return 0

def match_documents(query_embedding: list, user_id: str, doc_id: str, k: int = 15):
    if not supabase: return []
    try:
        res = supabase.rpc("match_document_chunks", {
            "query_embedding": query_embedding,
            "filter_user_id": user_id,
            "filter_document_id": doc_id,
            "match_count": k
        }).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Supabase Error (match_documents): {e}")
        return []
