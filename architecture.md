# DocuRAG System Architecture

## Overview
DocuRAG is a professional, full-stack Document Intelligence application that combines Retrieval-Augmented Generation (RAG) with multi-modal capabilities (Text + Vision).

### Tech Stack
* **Frontend:** Next.js (React), Tailwind CSS, Framer Motion
* **Backend:** FastAPI (Python), SQLAlchemy, LangGraph, LangChain
* **Databases:** 
  * Supabase (PostgreSQL + pgvector) for cloud vector search and user metadata.
  * Local SQLite (`docurag.db`) for tracking chunk processing and chat history.
* **Storage:** Local filesystem (`uploads/` directory) and Supabase Storage.

---

## AI Models Used
The system intelligently routes tasks to different models based on their strengths and capabilities:

1. **`gemini-embedding-001` (Google Gemini)**
   * **Use Case:** Text embedding.
   * **Details:** Converts text chunks into 3072-dimensional vectors. Used for all document indexing and query embedding.

2. **`llama-3.1-8b-instant` (Groq)**
   * **Use Case:** Primary conversational AI, RAG answering, and text actions.
   * **Details:** Used via LangChain for lightning-fast inference. Provides grounded answers based on document context.

3. **`gemini-2.5-flash` (Google Gemini Vision)**
   * **Use Case:** Multimodal tasks, Image Analysis, OCR, and Fallback.
   * **Details:** Used for extracting text from scanned PDFs, describing uploaded images, object detection, diagram explanation, and as a fallback LLM when the Groq API hits rate limits.

---

## Core Features & Workflows

### 1. Document Processing & Indexing
When a user uploads a PDF, the system converts it into searchable vector data.
* **Text Extraction:** Uses `PyMuPDF (fitz)` to extract raw text page by page.
* **OCR Fallback:** If a page contains no extractable text (e.g., a scanned document), it converts the page to an image and uses `gemini-2.5-flash` to extract the text.
* **Chunking Strategy:** The extracted text is passed to LangChain's `RecursiveCharacterTextSplitter`.
  * `chunk_size`: 1200 characters
  * `chunk_overlap`: 200 characters
  * `separators`: `["\n\n", "\n", ".", " ", ""]`
* **Embedding & Storage:** The chunks are batched (size 100) and embedded using `gemini-embedding-001`. The resulting vectors, along with page metadata, are stored in **Supabase pgvector**.

### 2. AI Chat & RAG Pipeline (LangGraph)
When a user asks a question about a document, the system uses a graph-based state machine (`ai_researcher.py`):
* **Retrieval:** The user's query is embedded and searched against the Supabase `pgvector` database. It retrieves the top 8 most relevant chunks (`k=8`).
* **Grounding:** The context is fed into `llama-3.1-8b-instant` with a strict system prompt to *only* answer using the provided context.
* **Fallback:** If the document doesn't contain the answer, the graph conditionally routes the query to a "fallback" node where the LLM answers based on general knowledge, clearly stating the document lacked the info.
* **Cross-Modal Integration:** If an image is attached to the chat, the image and the document context are sent to `gemini-2.5-flash` to synthesize an answer combining both sources.

### 3. Resume Analyzer
A specialized module that grades resumes against job descriptions.
* **Mechanism:** Reconstructs the uploaded resume from local database chunks.
* **Model:** Feeds the entire resume and job description to `llama-3.1-8b-instant`.
* **Output:** Uses prompt engineering to enforce a strict JSON output schema containing an ATS score, missing skills, format issues, actionable suggestions, and interview questions.

### 4. Image Intelligence
A multimodal feature to analyze and chat with standalone images.
* **Modes:** Describe (scene), Detect (objects), OCR (text extraction), and Diagram (chart explanation).
* **Model:** `gemini-2.5-flash`.
* **Workflow:** Images are base64 encoded and sent to the Gemini Vision API with tailored prompts based on the selected mode. Images can also be fully converted into text chunks and ingested into the RAG vector store.

### 5. PDF Editor AI Actions
A tool for inline text manipulation.
* **Features:** Rewrite, Summarize, and Explain selected text.
* **Mechanism:** Sends the selected text directly to `llama-3.1-8b-instant` with a specialized template to return the modified text.
