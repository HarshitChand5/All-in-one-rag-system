import os
from vector_store import get_user_vector_store

def debug_doc(user_id, doc_id):
    vs = get_user_vector_store(user_id)
    # Search for anything in that document
    docs = vs.vector_store.similarity_search("", k=100, filter={"document_id": doc_id})
    print(f"Found {len(docs)} chunks for doc {doc_id}")
    for i, d in enumerate(docs[:10]):
        print(f"--- Chunk {i} ---\n{d.page_content[:200]}\n")

if __name__ == "__main__":
    import sys
    # I need to find the user_id and doc_id from the database
    from database import SessionLocal
    import models
    db = SessionLocal()
    user = db.query(models.User).first()
    doc = db.query(models.Document).filter(models.Document.title.like("%IoT%")).first()
    if user and doc:
        print(f"Debugging User: {user.id}, Doc: {doc.id} ({doc.title})")
        debug_doc(user.id, doc.id)
    else:
        print("User or Doc not found")
