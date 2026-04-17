# DocuRAG Professional

DocuRAG Professional is an enterprise-grade web application bringing powerful Large Language Model (LLM) and Retrieval-Augmented Generation (RAG) capabilities to your personal and professional documents. By combining a robust Next.js frontend with an agile, LangChain-fueled FastAPI backend, users can upload PDFs and Images, ask intelligent questions across their content, dynamically assess resumes, and edit text with AI on the fly. 

## Key Features

- **Conversational RAG**: Upload extensive PDF documents. DocuRAG automatically partitions text, intelligently indexes semantic meaning using vector similarity, and answers direct queries backed by exact source citations.
- **Cross-Modal Vision AI**: Direct support for images (PNG/JPG). Extensively analyze images to extract text, describe content, or continuously chat regarding the visual specifics. 
- **Resilient OCR Fallback**: If a PDF consists of unselectable scanned pages, DocuRAG automatically detects the empty text layer and engages Gemini Vision to rasterize and transcribe the page without losing context.
- **AI Text Sandbox**: Built-in endpoints immediately capable of analyzing specific text blocks to **Rewrite**, **Summarize**, or **Explain** concepts with a single click.
- **Resume ATS Simulator**: A unique specialized module built to parse uploaded Resumes against a requested Job Description to rank missing skills, grade formats, and generate likely interview questions.
- **Dual-State Sync**: Combines rapid local caching using SQLAlchemy/SQLite with seamless, scalable syncing into a remote Supabase Cloud project.

---

## Getting Started

### Prerequisites
- Node.js 18+ (or Bun)
- Python 3.10+
- Supabase Project Database Setup (with `pgvector` supported)
- Google Gemini API Key

### Backend Setup (FastAPI + LangChain)

1. Open a terminal and navigate to the `backend` directory.
2. Create a virtual environment and install the requirements:
   ```bash
   cd backend
   python -m venv .venv
   # Activate it (Windows):
   .venv\Scripts\activate
   # Activate it (Mac/Linux):
   source .venv/bin/activate
   
   pip install -r requirements.txt
   ```
3. Set your environment variables (create a `.env` in the backend):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_service_key
   ```
4. Start up the server using Uvicorn:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Frontend Setup (Next.js)

1. Open a newly separated terminal and navigate to the `frontend` directory.
2. Install the necessary dependencies:
   ```bash
   cd frontend
   npm install
   # Or using bun:
   bun install
   ```
3. Boot the development server:
   ```bash
   npm run dev
   # Or using bun:
   bun dev
   ```
4. Navigate to `http://localhost:3000` in your browser.

---

## Architectural Deep Dive

Want to understand the inner workings of our parallel chunk processing, the LLM prompt implementations, or our UI component strategy?

### 👉 [View `architecture.md`](./architecture.md) for full context!

---

## Notice
Make sure your Supabase instance is properly configured with a `documents` and `users` schema allowing inserts to support background sync tasks natively running in the Python threads.
