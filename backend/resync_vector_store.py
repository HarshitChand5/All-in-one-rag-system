import os
import sys
import shutil
import uuid
import fitz  # PyMuPDF
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import vector_store
from main import extract_chunks_from_pdf, UPLOAD_DIR

def resync_and_heal():
    db = SessionLocal()
    try:
        # Target the active user for fast fix
        target_user_id = "9f9b796f-cefb-4fbf-91b1-e0b61a1b7ce9"
        user = db.query(models.User).filter(models.User.id == target_user_id).first()
        if not user:
            print(f"Target user {target_user_id} not found.")
            return

        print(f"\n--- Healing & Resyncing User: {user.email} ({user.id}) ---")
            
        # 1. Clear existing FAISS index for user to ensure a clean slate
        user_vs = vector_store.get_user_vector_store(user.id)
        index_dir = user_vs.index_path
        if os.path.exists(index_dir):
            print(f"Removing old index: {index_dir}")
            shutil.rmtree(index_dir)
        
        user_vs.vector_store = None
        
        # 2. Fetch all documents for this user
        user_docs = db.query(models.Document).filter(models.Document.owner_id == user.id).all()
        print(f"Found {len(user_docs)} documents.")

        for doc in user_docs:
            print(f"\nProcessing {doc.title} ({doc.id})...")
            
            # Check if chunks exist in DB
            chunks = db.query(models.DocumentChunk).filter(models.DocumentChunk.document_id == doc.id).all()
            
            if not chunks:
                print(f"  [!] Missing chunks in DB for {doc.title}. HEALING...")
                file_path = os.path.join(UPLOAD_DIR, doc.file_name)
                if not os.path.exists(file_path):
                    print(f"  [X] CRITICAL: File not found at {file_path}")
                    doc.status = "failed"
                    continue
                
                # Re-extract chunks
                extracted = extract_chunks_from_pdf(file_path)
                if not extracted:
                    print(f"  [X] Failed to extract chunks from {file_path}")
                    doc.status = "failed"
                    continue
                
                # Save chunks to DB
                for ch in extracted:
                    db_chunk = models.DocumentChunk(
                        id=str(uuid.uuid4()),
                        content=ch["content"],
                        page_number=ch["page"],
                        document_id=doc.id
                    )
                    db.add(db_chunk)
                
                doc.chunk_count = len(extracted)
                doc.status = "ready"
                db.commit()
                print(f"  [+] Saved {len(extracted)} chunks to DB and updated status to ready.")
                
                # Re-fetch chunks for indexing
                chunks = db.query(models.DocumentChunk).filter(models.DocumentChunk.document_id == doc.id).all()

            # Add to FAISS
            print(f"  Syncing {len(chunks)} chunks to Vector Store...")
            texts = [c.content for c in chunks]
            metas = [{"page": c.page_number} for c in chunks]
            
            user_vs.add_precomputed_chunks(
                text_chunks=texts,
                chunk_metadatas=metas,
                base_metadata={"document_id": doc.id, "title": doc.title}
            )
                
        print(f"\nHeal and Sync Complete for {user.email}!")
        
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    resync_and_heal()
