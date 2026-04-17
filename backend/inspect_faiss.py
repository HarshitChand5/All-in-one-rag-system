import os
import sys
from vector_store import get_user_vector_store

def inspect_faiss():
    user_id = "9f9b796f-cefb-4fbf-91b1-e0b61a1b7ce9"
    doc_id = "b5bd0e05-af8f-435d-9c1e-ca0168698e9b"
    
    print(f"Inspecting FAISS for user {user_id}...")
    vs_manager = get_user_vector_store(user_id)
    
    if vs_manager.vector_store is None:
        print("Vector store is empty!")
        return

    # FAISS vector store internal access
    # langchain's FAISS uses .docstore._dict
    try:
        docstore = vs_manager.vector_store.docstore
        all_ids = list(docstore._dict.keys())
        print(f"Total chunks in FAISS: {len(all_ids)}")
        
        doc_chunks = []
        for id in all_ids:
            doc = docstore.search(id)
            if doc.metadata.get("document_id") == doc_id:
                doc_chunks.append(doc)
            elif "doc_id" in doc.metadata and doc.metadata["doc_id"] == doc_id:
                 # Check for alternative naming
                 doc_chunks.append(doc)

        print(f"Chunks for document {doc_id}: {len(doc_chunks)}")
        if doc_chunks:
            print("Metadatas found:")
            for i, chunk in enumerate(doc_chunks[:5]):
                print(f"Chunk {i}: {chunk.metadata}")
        else:
            print("No chunks found with that document_id in FAISS.")
            print("Example metadata from first chunk in FAISS:")
            if all_ids:
                print(docstore.search(all_ids[0]).metadata)

    except Exception as e:
        print(f"Error accessing docstore: {e}")

if __name__ == "__main__":
    inspect_faiss()
