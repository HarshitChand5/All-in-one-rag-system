import os
import sys
from vector_store import get_user_vector_store

def final_verify():
    user_id = "9f9b796f-cefb-4fbf-91b1-e0b61a1b7ce9"
    resume_id = "b5bd0e05-af8f-435d-9c1e-ca0168698e9b"
    admit_id = "6446bcc1-98b1-4606-abab-b26035976f3d"
    
    vs_manager = get_user_vector_store(user_id)
    
    print("\n=== VERIFYING RESUME RETRIEVAL ===")
    res1 = vs_manager.search_with_score("Summarize my resume", k=5, score_threshold=0.2, filter={"document_id": resume_id})
    print(f"Resume Search Results: {len(res1)}")
    if res1:
        print(f"Top Result Score: {res1[0].metadata['score']:.4f}")
        print(f"Content Snippet: {res1[0].page_content[:100]}...")

    print("\n=== VERIFYING ADMIT CARD RETRIEVAL ===")
    res2 = vs_manager.search_with_score("What is my roll number?", k=5, score_threshold=0.2, filter={"document_id": admit_id})
    print(f"Admit Card Search Results: {len(res2)}")
    if res2:
        print(f"Top Result Score: {res2[0].metadata['score']:.4f}")
        print(f"Content Snippet: {res2[0].page_content[:100]}...")

if __name__ == "__main__":
    final_verify()
