import os
import sys
from vector_store import get_user_vector_store

def debug_faiss():
    user_id = "9f9b796f-cefb-4fbf-91b1-e0b61a1b7ce9"
    doc_id = "b5bd0e05-af8f-435d-9c1e-ca0168698e9b"
    
    print(f"Debugging FAISS for user {user_id}...")
    vs_manager = get_user_vector_store(user_id)
    
    if vs_manager.vector_store is None:
        print("FAIL: Vector store is None")
        return

    # Search without filter to see what's in there
    print("\n--- Search without filter ---")
    results = vs_manager.vector_store.similarity_search("Harshit Chand", k=50)
    print(f"Found {len(results)} results in total search")
    
    doc_ids_seen = set()
    matches = 0
    for i, res in enumerate(results):
        did = res.metadata.get("document_id")
        doc_ids_seen.add(did)
        if did == doc_id:
            matches += 1
            if matches == 1:
                print(f"Found match! Metadata: {res.metadata}")
    
    print(f"\nDocument IDs present in top 50 search results: {doc_ids_seen}")
    print(f"Resume matches in top 50: {matches}")
    
    # Search WITH filter explicitly
    print("\n--- Search WITH filter ---")
    results_filtered = vs_manager.vector_store.similarity_search("Harshit Chand", k=10, filter={"document_id": doc_id})
    print(f"Found {len(results_filtered)} results with filter")

if __name__ == "__main__":
    debug_faiss()
