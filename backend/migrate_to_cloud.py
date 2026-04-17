import os
import sys
import uuid
from database import SessionLocal
import models
import vector_store
import supabase_service
from main import extract_chunks_from_pdf, UPLOAD_DIR

def migrate_to_cloud():
    db = SessionLocal()
    try:
        # 1. Get the active user
        target_user_id = "9f9b796f-cefb-4fbf-91b1-e0b61a1b7ce9"
        user = db.query(models.User).filter(models.User.id == target_user_id).first()
        if not user:
            print("Target user not found in local DB.")
            return

        print(f"\n--- MIGRATING TO CLOUD: {user.email} ---")
        
        # 2. Get all local documents
        local_docs = db.query(models.Document).filter(models.Document.owner_id == target_user_id).all()
        print(f"Found {len(local_docs)} local documents to migrate.")

        vs_manager = vector_store.get_user_vector_store(user.id)

        for doc in local_docs:
            print(f"\nMigrating {doc.title} ({doc.id})...")
            
            # Step A: Ensure document exists in Supabase 'documents' table
            doc_data = {
                "id": doc.id,
                "title": doc.title,
                "file_name": doc.file_name,
                "file_type": doc.file_type,
                "file_size": doc.file_size,
                "owner_id": doc.owner_id,
                "status": "processing"
            }
            supabase_service.insert_document_metadata(doc_data)
            
            # Step B: Re-extract and re-index with new 1200 chunk size
            file_path = os.path.join(UPLOAD_DIR, doc.file_name)
            if not os.path.exists(file_path):
                print(f"  [X] Local file missing: {file_path}")
                continue
                
            print(f"  Extracting chunks (1200 chars)...")
            extracted = extract_chunks_from_pdf(file_path)
            if not extracted:
                print(f"  [X] Extraction failed.")
                continue
            
            # Step C: Push embeddings to Supabase pgvector
            texts = [ch["content"] for ch in extracted]
            metas = [{"page": ch["page"]} for ch in extracted]
            
            indexed_count = vs_manager.add_precomputed_chunks(
                text_chunks=texts,
                chunk_metadatas=metas,
                base_metadata={"document_id": doc.id, "title": doc.title}
            )
            
            # Step D: Update status in Supabase
            supabase_service.supabase.table("documents").update({
                "status": "ready",
                "chunk_count": indexed_count
            }).eq("id", doc.id).execute()
            
            print(f"  [+] Migration SUCCESS: {indexed_count} chunks pushed to cloud.")

        print("\n=== CLOUD MIGRATION COMPLETE ===")
        print("Your project is now 100% running on Supabase with pgvector!")
        
    except Exception as e:
        print(f"Migration Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_to_cloud()
