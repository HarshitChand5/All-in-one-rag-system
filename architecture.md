# DocuRAG Architecture

This document provides a high-level overview of the DocuRAG Professional architecture, detailing the technology stack, system components, and primary data flows.

## 1. System Overview

DocuRAG Professional is a full-stack Retrieval-Augmented Generation (RAG) system designed to provide intelligent, AI-driven interactions over uploaded documents (PDFs) and images. The application splits the workload between a Next.js React frontend and a FastAPI Python backend, using Supabase for centralized state and metadata syncing, and LangChain with Google's Gemini models for heavy lifting AI workloads.

## 2. Technology Stack

### Frontend Application (`/frontend`)
- **Framework**: Next.js 16 (App Router), React 19
- **Styling & UI**: Tailwind CSS v4, Base UI, Shadcn, Framer Motion
- **Document Handling**: `react-dropzone` for uploads, `pdf-lib` and `pdfjs-dist` for client-side rendering and local manipulation.
- **Data Visualization**: `recharts` for telemetry and analytics features.
- **Authentication & Backend Comms**: `@supabase/ssr`, `@supabase/supabase-js`, standard `fetch` API.

### Backend Infrastructure (`/backend`)
- **Server Framework**: FastAPI and Uvicorn
- **Databases**: SQLAlchemy (interacting with local SQLite for robust local caching and state management) combined with Supabase Postgres for scalable cloud syncing.
- **Vector Search**: FAISS (local fallback) and Supabase pgvector. 
- **AI Integration**: LangChain, `langchain-google-genai`, `google-generativeai` utilizing Google's Gemini APIs for text, vision, and embeddings.
- **PDF Parsing & OCR**: PyMuPDF (`fitz`) for standard extraction, combined with Gemini Vision as an advanced OCR fallback for scanned images.

## 3. Core System Components

### 3.1. Document Ingestion Pipeline
When a document is uploaded, it is passed to the backend FastAPI server and immediately scheduled as a background task. 
1. **Chunking**: The PDF is parsed via PyMuPDF. If a page lacks extractable text, a rate-limited backup uses Gemini Vision to transcribe the page raster. 
2. **Vectorization & Indexing**: Batched chunks are vectorized via Google text embedding models and inserted into a vector store (Supabase or FAISS). 
3. **Database Syncing**: Document statuses and statistics are synchronously kept up-to-date in both the local SQLAlchemy SQLite database and the cloud Supabase Postgres instance.

### 3.2. Intelligent RAG Engine (`ai_researcher.py`)
Chat sessions query the backend for relevant vectors.
A specialized RAG orchestrator constructs conversational context, pulling in sources from the database based on vector-similarity of the queried question, and providing these contexts to the Gemini LLM to construct an intelligent answer.

### 3.3. Advanced Capabilities
- **Resume Analyzer**: Restructures ingested document chunks into a synthesized resume payload. The pipeline evaluates the resume using ATS-simulating LLM prompts, assigning readiness scores and matching it against input Job Descriptions.
- **Cross-Modal Image Intelligence (`image_analyzer.py`)**: Supports ingestion of loose image assets. Provides OCR, description, and an independent chat pipeline specific to discussing the visual content of the user-provided image.
- **AI Text Actions**: Quick-action endpoints designed for specific document edits. Features on-the-fly execution for requests to "rewrite", "summarize", or "explain" targeted pieces of text from the client side.

## 4. Key Endpoints
- **`/api/docs/upload`**: Document ingestion, triggers chunking background tasks.
- **`/api/chat/query`**: Entry point for the RAG assistant. Retrieves specific snippets and context.
- **`/api/auth/*`**: Authentication via bcrypt local hashing, mapped seamlessly into Supabase Cloud accounts.
- **`/api/images/*`**: Vision-specific capabilities handled outside standardized PDF vector chunks.
- **`/api/resume/analyze`**: Specialized single-document evaluation module.
