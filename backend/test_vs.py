import os
from vector_store import VectorStoreManager
from dotenv import load_dotenv

load_dotenv()

def test_vector_store():
    user_id = "test_user_id_123"
    print(f"Testing VectorStore for user: {user_id}")
    try:
        vm = VectorStoreManager(user_id)
        print("Initialized VectorStoreManager")
        
        text = "This is a test sentence to verify embeddings and FAISS indexing."
        metadata = {"test": "true"}
        
        print("Adding text chunks...")
        num_chunks = vm.add_text_chunks(text, metadata)
        print(f"Success! Added {num_chunks} chunks.")
        
        print("Searching...")
        results = vm.similarity_search("test sentence", k=1)
        print(f"Search result: {results[0].page_content if results else 'No results'}")
        
    except Exception as e:
        import traceback
        print(f"FAILED with error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    test_vector_store()
