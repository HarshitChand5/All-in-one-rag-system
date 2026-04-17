import os
import sys
from vector_store import get_user_vector_store

def debug_scores():
    user_id = "9f9b796f-cefb-4fbf-91b1-e0b61a1b7ce9"
    doc_id = "b5bd0e05-af8f-435d-9c1e-ca0168698e9b"
    query = "Summarize this document"
    
    print(f"Debugging scores for query: '{query}'")
    vs_manager = get_user_vector_store(user_id)
    
    # 1. Similarity search with relevance scores and filter
    print("\n--- similarity_search_with_relevance_scores WITH filter ---")
    results = vs_manager.vector_store.similarity_search_with_relevance_scores(query, k=15, filter={"document_id": doc_id})
    print(f"Results count: {len(results)}")
    for i, (doc, score) in enumerate(results):
        print(f"Match {i}: Score {score:.4f}, Metadata: {doc.metadata}")

    # 2. Plain similarity search WITH filter
    print("\n--- similarity_search WITH filter ---")
    results_plain = vs_manager.vector_store.similarity_search(query, k=15, filter={"document_id": doc_id})
    print(f"Results count: {len(results_plain)}")

if __name__ == "__main__":
    debug_scores()
