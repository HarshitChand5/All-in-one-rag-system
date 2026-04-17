import os
import logging
from typing import List, Dict, Any
from langchain_core.documents import Document as LangDocument
import supabase_service

logger = logging.getLogger(__name__)

_EMBEDDINGS_CACHE = None

def get_embeddings():
    global _EMBEDDINGS_CACHE
    if _EMBEDDINGS_CACHE is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            # Cloud embeddings: much faster than CPU-based local model
            # gemini-embedding-001 outputs 3072-dim (matches pgvector schema)
            logger.info("Loading CLOUD embedding model: gemini-embedding-001 (3072-dim)")
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            _EMBEDDINGS_CACHE = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=api_key,
            )
        else:
            logger.warning("No GEMINI_API_KEY - cloud embeddings unavailable!")
            raise ValueError("GEMINI_API_KEY required for embedding model")
    return _EMBEDDINGS_CACHE

class VectorStoreManager:
    """
    Manages vector storage and search in Supabase pgvector.
    This replaces the local FAISS implementation for professional-grade RAG.
    """
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.embeddings = get_embeddings()

    def add_precomputed_chunks(self, text_chunks: list[str], chunk_metadatas: list[dict], base_metadata: dict):
        """
        Embeds chunks LOCALLY and pushes them to Supabase pgvector.
        Zero quota limits, maximum speed.
        """
        doc_id = base_metadata.get("document_id")
        if not doc_id:
            logger.error("No document_id provided for indexing")
            return 0

        logger.info(f"Generating LOCAL embeddings for {len(text_chunks)} chunks for doc {doc_id}...")
        
        # Local embeddings have no rate limit, so we can embed all at once
        embeddings = self.embeddings.embed_documents(text_chunks)
        
        rows = []
        for idx, (text, meta, emb) in enumerate(zip(text_chunks, chunk_metadatas, embeddings)):
            rows.append({
                "document_id": doc_id,
                "user_id": self.user_id,
                "content": text,
                "embedding": emb,
                "chunk_index": idx,
                "page_number": meta.get("page")
            })
            
        inserted_count = supabase_service.insert_vector_embeddings(rows)
        logger.info(f"Successfully pushed {inserted_count} local embeddings to Supabase.")
        return inserted_count

    def add_precomputed_chunks_batched(self, text_chunks: list[str], chunk_metadatas: list[dict], 
                                        base_metadata: dict, batch_size: int = 50, 
                                        progress_callback=None):
        """
        Batched version of add_precomputed_chunks for large documents.
        Includes retry logic for API rate limits (Google free tier: 100 req/min).
        """
        import time
        import re
        
        doc_id = base_metadata.get("document_id")
        if not doc_id:
            logger.error("No document_id provided for indexing")
            return 0

        total = len(text_chunks)
        logger.info(f"Batched embedding: {total} chunks in batches of {batch_size} for doc {doc_id}")
        
        total_inserted = 0
        for batch_start in range(0, total, batch_size):
            batch_end = min(batch_start + batch_size, total)
            batch_texts = text_chunks[batch_start:batch_end]
            batch_metas = chunk_metadatas[batch_start:batch_end]
            
            # Embed with retry for rate limits
            embeddings = None
            for attempt in range(5):
                try:
                    embeddings = self.embeddings.embed_documents(batch_texts)
                    break
                except Exception as e:
                    error_msg = str(e)
                    if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                        # Extract retry delay from error if available
                        wait_time = 60  # default wait
                        match = re.search(r'retry in (\d+)', error_msg.lower())
                        if match:
                            wait_time = int(match.group(1)) + 5
                        logger.warning(f"Rate limited (attempt {attempt+1}/5). Waiting {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        raise  # Non-rate-limit errors bubble up
            
            if embeddings is None:
                logger.error(f"Failed to embed batch after 5 retries. Skipping.")
                continue
            
            rows = []
            for idx, (text, meta, emb) in enumerate(zip(batch_texts, batch_metas, embeddings)):
                rows.append({
                    "document_id": doc_id,
                    "user_id": self.user_id,
                    "content": text,
                    "embedding": emb,
                    "chunk_index": batch_start + idx,
                    "page_number": meta.get("page")
                })
            
            inserted = supabase_service.insert_vector_embeddings(rows)
            total_inserted += inserted
            
            if progress_callback:
                progress_callback(int((batch_end / total) * 100))
            
            logger.info(f"Batch {batch_start//batch_size + 1}: embedded and pushed {inserted} chunks")
            
            # Pause between batches to respect rate limits
            if batch_end < total:
                time.sleep(2)
        
        logger.info(f"Batched embedding complete: {total_inserted}/{total} chunks indexed")
        return total_inserted

    def search_with_score(self, query: str, k: int = 15, score_threshold: float = 0.2, filter: dict = None):
        """
        Performs high-speed similarity search in Supabase.
        """
        if not filter or "document_id" not in filter:
            logger.warning("Searching without document_id filter is currently restricted.")
            return []

        doc_id = filter["document_id"]
        logger.info(f"Searching pgvector for query: '{query[:30]}...' in doc {doc_id}")
        
        # 1. Embed query
        query_embedding = self.embeddings.embed_query(query)
        
        # 2. Call Supabase RPC
        hits = supabase_service.match_documents(query_embedding, self.user_id, doc_id, k=k)
        
        relevant_docs = []
        for hit in hits:
            # similarity in pgvector <-> (L2) is actually distance. 
            # match_documents returns similarity (lower is better for <->).
            # We map distance to 1-score for thresholding
            distance = hit.get("similarity", 2.0)
            score = max(0.0, 1.0 - (distance / 2.0))
            
            if score >= score_threshold:
                doc = LangDocument(
                    page_content=hit.get("content", ""),
                    metadata={**hit.get("metadata", {}), "score": score}
                )
                relevant_docs.append(doc)
                
        logger.info(f"pgvector found {len(hits)} hits, {len(relevant_docs)} passed threshold.")
        return relevant_docs

_VECTOR_STORE_CACHE = {}

def get_user_vector_store(user_id: str):
    if user_id not in _VECTOR_STORE_CACHE:
        _VECTOR_STORE_CACHE[user_id] = VectorStoreManager(user_id)
    return _VECTOR_STORE_CACHE[user_id]
