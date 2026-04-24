import os
import uuid
import logging
import shutil
import threading
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel

import models
import auth
import vector_store
from database import engine, get_db
from supabase_service import insert_document_metadata, sync_user_profile, supabase
from concurrent.futures import ThreadPoolExecutor, as_completed
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
import base64

# Global Config
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Initialize FastAPI
app = FastAPI(title="DocuRAG Professional API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://192.168.1.35:3000" # Your network IP
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded documents for frontend viewer
app.mount("/api/files", StaticFiles(directory=UPLOAD_DIR), name="files")

@app.get("/api/docs/{doc_id}/raw")
async def get_raw_document(doc_id: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id, models.Document.owner_id == current_user.id).first()
    if not doc:
        logger.warning(f"Document {doc_id} not found for user {current_user.id}")
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = os.path.join(UPLOAD_DIR, doc.file_name)
    logger.info(f"Serving raw document {doc_id} from {file_path}")
    
    if not os.path.exists(file_path):
        logger.error(f"File binary not found at {file_path}")
        raise HTTPException(status_code=404, detail="File binary not found on server")
    
    from fastapi.responses import FileResponse
    return FileResponse(file_path, media_type='application/pdf', filename=doc.title)

# Initialize Database
models.Base.metadata.create_all(bind=engine)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Models ---

class ChatQueryRequest(BaseModel):
    query: str
    session_id: str
    active_doc_id: Optional[str] = None
    image_ids: Optional[List[str]] = None  # Phase 5: cross-modal

class SessionCreate(BaseModel):
    title: str = "New Chat"

class TextActionRequest(BaseModel):
    action: str  # rewrite, summarize, explain
    text: str
    doc_id: Optional[str] = None

class ImageAnalyzeRequest(BaseModel):
    mode: str = "describe"  # describe, detect, ocr, diagram

class ImageChatRequest(BaseModel):
    image_id: str
    question: str

class ResumeAnalyzeRequest(BaseModel):
    doc_id: str
    job_description: Optional[str] = None

# --- Auth Models ---

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ProfileUpdate(BaseModel):
    full_name: str

# --- Document Processing ---

# Semaphore to limit concurrent Gemini OCR calls (prevents API throttling)
_OCR_SEMAPHORE = threading.Semaphore(2)

def extract_chunks_from_pdf(file_path: str, progress_callback=None):
    """
    Extract text chunks from PDF using PyMuPDF (fitz) and RecursiveCharacterSplitter.
    Upgraded with batched parallel processing and OCR rate limiting.
    """
    import fitz
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    
    doc = fitz.open(file_path)
    total_pages = len(doc)
    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    
    vision_llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GEMINI_API_KEY"))
    
    def process_page(page_idx, page):
        text = page.get_text().strip()
        if not text:
            # Rate-limited OCR fallback with semaphore
            with _OCR_SEMAPHORE:
                try:
                    pix = page.get_displaylist().get_pixmap()
                    img_data = pix.tobytes("png")
                    b64_img = base64.b64encode(img_data).decode('utf-8')
                    
                    message = HumanMessage(content=[
                        {"type": "text", "text": "Extract all text from this PDF page image. Provide only the transcribed text."},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_img}"}}
                    ])
                    text = vision_llm.invoke([message]).content
                except Exception as e:
                    logger.warning(f"OCR Fallback failed for page {page_idx}: {e}")
                    text = ""

        if text:
            pieces = splitter.split_text(text)
            return [{"content": p, "page": page_idx} for p in pieces]
        return []

    all_chunks = []
    pages_done = 0
    batch_size = 50  # Process pages in batches of 50
    
    for batch_start in range(0, total_pages, batch_size):
        batch_end = min(batch_start + batch_size, total_pages)
        batch_pages = range(batch_start + 1, batch_end + 1)  # 1-indexed
        
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(process_page, idx, doc[idx-1]): idx for idx in batch_pages}
            for future in as_completed(futures):
                try:
                    all_chunks.extend(future.result())
                except Exception as e:
                    logger.error(f"Page processing error: {e}")
                pages_done += 1
                if progress_callback:
                    # Extraction is ~40% of total work
                    progress_callback(int((pages_done / total_pages) * 40))
    
    doc.close()
    all_chunks.sort(key=lambda x: x["page"])
    return all_chunks

def process_document_background(doc_id: str, file_path: str, user_id: str):
    """Refactored with batched embedding, progress tracking, and Supabase pgvector indexing."""
    db = SessionLocal() # Manual session for bg task
    try:
        doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
        if not doc: return

        def update_progress(progress: int):
            """Update processing progress in local DB only (Supabase schema lacks this column)."""
            try:
                doc.processing_progress = min(progress, 99)
                db.commit()
            except Exception:
                pass  # Non-critical

        # 1. Verification Loop: Ensure doc exists in Supabase before indexing
        logger.info(f"Verifying document {doc_id} visibility in Supabase...")
        verified = False
        import time
        for i in range(5):
            try:
                check = supabase.table("documents").select("id").eq("id", doc_id).execute()
                if check.data:
                    verified = True
                    break
                logger.info(f"Supabase visibility check {i+1}/5: Document not yet visible. Waiting...")
            except Exception as e:
                logger.warning(f"Visibility check error: {e}")
            time.sleep(1)
        
        if not verified:
            logger.error(f"FATAL: Document {doc_id} not visible in Supabase after 5s. Aborting indexing.")
            doc.status = "error"
            db.commit()
            return

        logger.info(f"Document {doc_id} verified in Supabase. Proceeding to index.")
        update_progress(5)

        # 2. Extract chunks with progress callbacks (0-40%)
        chunks = extract_chunks_from_pdf(file_path, progress_callback=update_progress)
        update_progress(40)
        
        if not chunks:
            logger.warning(f"No chunks extracted from document {doc_id}")
            doc.status = "ready"
            doc.chunk_count = 0
            doc.processing_progress = 100
            db.commit()
            return

        # 2.5 Save chunks to local DB for text reconstruction (Resume Analyzer support)
        logger.info(f"Saving {len(chunks)} chunks to local DB for document {doc_id}...")
        for c in chunks:
            db_chunk = models.DocumentChunk(
                id=str(uuid.uuid4()),
                content=c["content"],
                page_number=c["page"],
                document_id=doc_id
            )
            db.add(db_chunk)
        db.commit()

        # 3. Batch embed + index in cloud (40-95%)
        vs_manager = vector_store.get_user_vector_store(user_id)
        texts = [c["content"] for c in chunks]
        metas = [{"page": c["page"]} for c in chunks]
        
        def embedding_progress(pct):
            # Map 0-100 embedding progress to 40-95 overall progress
            update_progress(40 + int(pct * 0.55))
        
        indexed_count = vs_manager.add_precomputed_chunks_batched(
            text_chunks=texts,
            chunk_metadatas=metas,
            base_metadata={"document_id": doc_id, "title": doc.title},
            batch_size=100,
            progress_callback=embedding_progress
        )
        
        # 4. Finalize
        doc.status = "ready"
        doc.chunk_count = indexed_count
        doc.processing_progress = 100
        db.commit()
        
        # Update Supabase status (only columns that exist in the schema)
        if supabase:
            try:
                supabase.table("documents").update({
                    "status": "ready"
                }).eq("id", doc_id).execute()
            except Exception as se:
                logger.error(f"Supabase status update failed: {se}")
        
        logger.info(f"Document {doc_id} processed: {indexed_count} chunks indexed in cloud.")
    except Exception as e:
        logger.error(f"Background processing failed: {e}")
        try:
            doc.status = "error"
            doc.processing_progress = 0
            db.commit()
        except:
            db.rollback()
    finally:
        db.close()

from database import SessionLocal

# --- Endpoints ---

@app.post("/api/docs/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    doc = models.Document(
        id=file_id,
        title=file.filename,
        file_name=f"{file_id}{file_ext}",
        file_type=file.content_type,
        file_size=os.path.getsize(save_path),
        owner_id=current_user.id,
        status="processing"
    )
    db.add(doc)
    db.commit()
    
    # Finalize metadata values
    file_type = file.content_type or "application/pdf"
    file_size = os.path.getsize(save_path)

    # Sync metadata to Supabase early (with retry logic)
    sync_res = insert_document_metadata({
        "id": doc.id,
        "title": doc.title,
        "file_name": doc.file_name,
        "file_type": file_type,
        "file_size": file_size,
        "user_id": current_user.id,
        "status": "processing"
    })
    
    if not sync_res:
        # If sync fails after retries, don't start the indexing or save locally
        logger.error(f"Failed to sync metadata to Supabase Cloud for doc {doc.id}")
        # Note: In a production app you might roll back the local DB transaction here
        raise HTTPException(status_code=500, detail="Failed to sync to Supabase Cloud. Document indexing aborted.")

    background_tasks.add_task(process_document_background, doc.id, save_path, current_user.id)
    
    return {"id": doc.id, "title": doc.title}

@app.get("/api/docs")
def list_documents(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Document).filter(models.Document.owner_id == current_user.id).all()

@app.get("/api/docs/{doc_id}/status")
def get_document_status(doc_id: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """Lightweight polling endpoint for document processing progress."""
    doc = db.query(models.Document).filter(models.Document.id == doc_id, models.Document.owner_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "status": doc.status,
        "processing_progress": doc.processing_progress,
        "chunk_count": doc.chunk_count
    }

@app.post("/api/chat/sessions")
def create_session(request: SessionCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    session = models.ChatSession(id=str(uuid.uuid4()), title=request.title, owner_id=current_user.id)
    db.add(session)
    db.commit()
    return {"id": session.id, "title": session.title}

@app.get("/api/chat/sessions")
def get_sessions(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.ChatSession).filter(models.ChatSession.owner_id == current_user.id).order_by(models.ChatSession.created_at.desc()).all()

@app.get("/api/chat/sessions/{session_id}/messages")
def get_session_messages(session_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.owner_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.created_at.asc()).all()
    return [{"id": m.id, "role": m.role, "content": m.content, "sources": m.sources, "created_at": m.created_at} for m in messages]

# --- Auth Endpoints ---

@app.post("/api/auth/signup")
def signup(request: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == request.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pass = auth.get_password_hash(request.password)
    new_user = models.User(
        id=str(uuid.uuid4()),
        email=request.email,
        hashed_password=hashed_pass,
        full_name=request.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Sync to Supabase
    sync_user_profile({
        "id": new_user.id,
        "email": new_user.email,
        "full_name": new_user.full_name
    })

    # Auto-login: generate an access token so the frontend can set the auth cookie
    access_token = auth.create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer", "message": "User created successfully"}

@app.post("/api/auth/login")
def login(request: UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user or not auth.verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = auth.create_access_token(data={"sub": user.email})
    
    # Ensure profile exists in Supabase (sync on login)
    sync_user_profile({
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name
    })

    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    doc_count = db.query(models.Document).filter(models.Document.owner_id == current_user.id).count()
    session_count = db.query(models.ChatSession).filter(models.ChatSession.owner_id == current_user.id).count()
    query_count = db.query(models.ChatMessage).filter(
        models.ChatMessage.role == 'user',
        models.ChatMessage.session_id.in_(
            db.query(models.ChatSession.id).filter(models.ChatSession.owner_id == current_user.id)
        )
    ).count()

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "doc_count": doc_count,
        "session_count": session_count,
        "query_count": query_count
    }

@app.put("/api/auth/me")
def update_profile(request: ProfileUpdate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.full_name = request.full_name
    db.commit()
    db.refresh(user)

    # Sync update to Supabase
    sync_user_profile({
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name
    })

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name
    }

# --- Additional Document Endpoints ---

@app.delete("/api/docs/{doc_id}")
def delete_document(doc_id: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id, models.Document.owner_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Cascade delete handles embeddings in Supabase via service layer if needed
    # but for now we delete locally and it cascades to our chunks
    db.delete(doc)
    db.commit()
    
    # Cleanup file
    try:
        file_path = os.path.join(UPLOAD_DIR, doc.file_name)
        if os.path.exists(file_path):
            os.remove(file_path)
    except: pass
    
    return {"message": "Document deleted"}

@app.post("/api/chat/query")
async def chat_query(
    request: ChatQueryRequest,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == request.session_id, models.ChatSession.owner_id == current_user.id).first()
    
    if not session:
        if request.session_id.startswith("resume-"):
            # Auto-create virtual session for resume chat
            session = models.ChatSession(
                id=request.session_id,
                title="Resume Analysis Chat",
                owner_id=current_user.id
            )
            db.add(session)
            db.commit()
        else:
            raise HTTPException(status_code=404, detail="Session not found")

    # 1. Save User Message
    user_msg = models.ChatMessage(
        id=str(uuid.uuid4()),
        role="user",
        content=request.query,
        session_id=request.session_id
    )
    db.add(user_msg)
    db.commit()

    # 2. Run Professional RAG Pipeline
    from ai_researcher import get_intelligent_response
    try:
        result = await get_intelligent_response(
            user_id=current_user.id,
            doc_id=request.active_doc_id,
            question=request.query,
            image_ids=request.image_ids
        )
        
        # 3. Save AI Message
        ai_message = models.ChatMessage(
            id=str(uuid.uuid4()),
            role="assistant",
            content=result["answer"],
            sources=result["sources"],
            session_id=request.session_id
        )
        db.add(ai_message)
        
        # Auto-title session
        if session.title == "New Chat":
            session.title = request.query[:40] + "..." if len(request.query) > 40 else request.query
            
        db.commit()
        
        return {
            "id": ai_message.id,
            "role": "assistant",
            "content": ai_message.content,
            "sources": ai_message.sources,
            "created_at": ai_message.created_at
        }
    except Exception as e:
        logger.error(f"RAG Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- AI Text Actions (Phase 2: PDF Editor AI) ---

@app.post("/api/ai/text-action")
async def ai_text_action(
    request: TextActionRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    """AI actions on selected text: rewrite, summarize, explain."""
    from ai_researcher import get_llm
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    
    prompts = {
        "rewrite": "Rewrite the following text to be clearer and more professional. Return only the rewritten text:\n\n{text}",
        "summarize": "Summarize the following text in 2-3 concise sentences:\n\n{text}",
        "explain": "Explain the following text in simple, easy-to-understand terms:\n\n{text}",
    }
    
    template = prompts.get(request.action)
    if not template:
        raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}. Use: rewrite, summarize, explain")
    
    try:
        llm = get_llm()
        prompt = ChatPromptTemplate.from_messages([("user", template)])
        chain = prompt | llm | StrOutputParser()
        result = await asyncio.to_thread(chain.invoke, {"text": request.text})
        return {"result": result}
    except Exception as e:
        logger.error(f"AI text action error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Resume Analyzer (Phase 6) ---

@app.post("/api/resume/analyze")
async def analyze_resume(
    request: ResumeAnalyzeRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze a resume document against an optional job description."""
    from ai_researcher import get_llm
    from langchain_core.prompts import ChatPromptTemplate
    import json
    import re
    
    # 1. Authorize and fetch document
    doc = db.query(models.Document).filter(models.Document.id == request.doc_id, models.Document.owner_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    # 2. Reconstruct resume text from chunks
    chunks = db.query(models.DocumentChunk).filter(models.DocumentChunk.document_id == request.doc_id).all()
    if not chunks:
        # Fallback to vector store if we don't have local chunks stored (though we usually do if indexed)
        pass # Actually, if chunk_count > 0, they should be in the DB. Let's just collect whatever we have.
    
    resume_text = "\n".join([chunk.content for chunk in chunks])
    
    if not resume_text.strip():
        raise HTTPException(status_code=400, detail="The selected resume contains no searchable text. Please ensure it's a valid PDF with selectable text.")

    # 3. Create the specialized Prompt
    system_prompt = (
        "You are an expert AI recruiter and ATS (Applicant Tracking System) simulator. "
        "Analyze the provided Resume Text. If a Job Description is provided, score the resume against it. "
        "You MUST return ONLY valid JSON in the exact structure below, no markdown formatting blocks outside the JSON."
        "\n\nJSON STRUCTURE:\n"
        "{{\n"
        "  \"score\": 85,\n"
        "  \"match_percentage\": 80,\n"
        "  \"missing_skills\": [\"skill1\", \"skill2\"],\n"
        "  \"format_issues\": [\"Issue 1\", \"Issue 2\"],\n"
        "  \"suggestions\": [\"Improvement 1\", \"Improvement 2\"],\n"
        "  \"interview_questions\": [\"Question 1\", \"Question 2\"]\n"
        "}}"
    )
    
    user_prompt = f"RESUME TEXT:\n{resume_text}\n\n"
    if request.job_description:
        user_prompt += f"JOB DESCRIPTION:\n{request.job_description}\n"

    try:
        llm = get_llm()
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", user_prompt)
        ])
        
        # Invoke LLM
        response = await asyncio.to_thread(lambda: prompt.pipe(llm).invoke({}))
        output = response.content
        
        # Extract JSON if markdown block is present
        match = re.search(r"```json\s*(\{.*?\})\s*```", output, re.DOTALL)
        if match:
            output = match.group(1)
        else:
            # Maybe it just returned raw json
            output = output.strip()
            if output.startswith("```"):
                output = re.sub(r"^```.*?\n|```$", "", output, flags=re.DOTALL).strip()
                
        result_json = json.loads(output)
        return result_json
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM resume JSON: {output} - Error: {e}")
        raise HTTPException(status_code=500, detail="AI returned invalid format. Please try again.")
    except Exception as e:
        logger.error(f"Resume analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Image Intelligence (Phase 4) ---

@app.post("/api/images/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    mode: str = Form("describe"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze an uploaded image using Gemini Vision."""
    from image_analyzer import analyze_image_bytes
    
    image_bytes = await file.read()
    
    # Save image asset
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1] or ".png"
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    with open(save_path, "wb") as f:
        f.write(image_bytes)
    
    # Save to DB
    img_asset = models.ImageAsset(
        id=file_id,
        file_name=f"{file_id}{file_ext}",
        original_name=file.filename,
        owner_id=current_user.id
    )
    db.add(img_asset)
    db.commit()
    
    try:
        result = await asyncio.to_thread(analyze_image_bytes, image_bytes, mode)
        
        # Update with analysis
        img_asset.analysis_text = result.get("description", "")
        db.commit()
        
        return {"image_id": file_id, **result}
    except Exception as e:
        logger.error(f"Image analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/images/{image_id}/reanalyze")
async def reanalyze_image(
    image_id: str,
    mode: str = Form("describe"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Re-analyze an existing image in a different mode without creating duplicates."""
    from image_analyzer import analyze_image_bytes
    
    img = db.query(models.ImageAsset).filter(
        models.ImageAsset.id == image_id,
        models.ImageAsset.owner_id == current_user.id
    ).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    file_path = os.path.join(UPLOAD_DIR, img.file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image file not found")
    
    with open(file_path, "rb") as f:
        image_bytes = f.read()
    
    try:
        result = await asyncio.to_thread(analyze_image_bytes, image_bytes, mode)
        return {"image_id": image_id, **result}
    except Exception as e:
        logger.error(f"Image reanalysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/images/chat")
async def chat_with_image(
    request: ImageChatRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Ask questions about a previously uploaded image."""
    from image_analyzer import chat_about_image
    
    img = db.query(models.ImageAsset).filter(
        models.ImageAsset.id == request.image_id,
        models.ImageAsset.owner_id == current_user.id
    ).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    file_path = os.path.join(UPLOAD_DIR, img.file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image file not found")
    
    with open(file_path, "rb") as f:
        image_bytes = f.read()
    
    try:
        answer = await asyncio.to_thread(chat_about_image, image_bytes, request.question)
        return {"answer": answer}
    except Exception as e:
        logger.error(f"Image chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/images/ingest")
async def ingest_image_to_rag(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Convert image → text chunks → index into RAG vector store."""
    from image_analyzer import image_to_text_chunks
    
    image_bytes = await file.read()
    
    # Save as a document
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1] or ".png"
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    with open(save_path, "wb") as f:
        f.write(image_bytes)
    
    # Create document entry for the image-derived content
    doc = models.Document(
        id=file_id,
        title=f"[Image] {file.filename}",
        file_name=f"{file_id}{file_ext}",
        file_type="image/" + file_ext.lstrip("."),
        file_size=len(image_bytes),
        owner_id=current_user.id,
        status="processing"
    )
    db.add(doc)
    db.commit()
    
    # Process in background
    def ingest_bg():
        bg_db = SessionLocal()
        try:
            chunks = image_to_text_chunks(image_bytes)
            if chunks:
                vs_manager = vector_store.get_user_vector_store(current_user.id)
                texts = [c["content"] for c in chunks]
                metas = [{"page": 1} for _ in chunks]
                count = vs_manager.add_precomputed_chunks_batched(
                    text_chunks=texts,
                    chunk_metadatas=metas,
                    base_metadata={"document_id": file_id, "title": doc.title},
                    batch_size=50
                )
                bg_doc = bg_db.query(models.Document).filter(models.Document.id == file_id).first()
                if bg_doc:
                    bg_doc.status = "ready"
                    bg_doc.chunk_count = count
                    bg_doc.processing_progress = 100
                    bg_db.commit()
        except Exception as e:
            logger.error(f"Image ingest error: {e}")
        finally:
            bg_db.close()
    
    background_tasks.add_task(ingest_bg)
    return {"doc_id": file_id, "title": doc.title}

@app.get("/api/images")
def list_images(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """List all image assets for the current user."""
    images = db.query(models.ImageAsset).filter(models.ImageAsset.owner_id == current_user.id).order_by(models.ImageAsset.created_at.desc()).all()
    return [{
        "id": img.id,
        "file_name": img.file_name,
        "original_name": img.original_name,
        "analysis_text": img.analysis_text,
        "created_at": img.created_at
    } for img in images]

@app.get("/api/insights")
def get_insights(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """Real usage metrics for the Insights dashboard."""
    from sqlalchemy import func
    
    # Documents
    total_docs = db.query(func.count(models.Document.id)).filter(models.Document.owner_id == current_user.id).scalar() or 0
    ready_docs = db.query(func.count(models.Document.id)).filter(models.Document.owner_id == current_user.id, models.Document.status == "ready").scalar() or 0
    processing_docs = db.query(func.count(models.Document.id)).filter(models.Document.owner_id == current_user.id, models.Document.status == "processing").scalar() or 0
    error_docs = db.query(func.count(models.Document.id)).filter(models.Document.owner_id == current_user.id, models.Document.status == "error").scalar() or 0
    
    # Chunks
    total_chunks = db.query(func.sum(models.Document.chunk_count)).filter(models.Document.owner_id == current_user.id).scalar() or 0
    
    # Chat
    total_sessions = db.query(func.count(models.ChatSession.id)).filter(models.ChatSession.owner_id == current_user.id).scalar() or 0
    total_messages = db.query(func.count(models.ChatMessage.id)).join(models.ChatSession).filter(models.ChatSession.owner_id == current_user.id).scalar() or 0
    user_queries = db.query(func.count(models.ChatMessage.id)).join(models.ChatSession).filter(models.ChatSession.owner_id == current_user.id, models.ChatMessage.role == "user").scalar() or 0
    ai_responses = db.query(func.count(models.ChatMessage.id)).join(models.ChatSession).filter(models.ChatSession.owner_id == current_user.id, models.ChatMessage.role == "assistant").scalar() or 0
    
    # Images
    total_images = db.query(func.count(models.ImageAsset.id)).filter(models.ImageAsset.owner_id == current_user.id).scalar() or 0
    
    # Index coverage (% of docs that are ready)
    index_coverage = round((ready_docs / total_docs * 100), 1) if total_docs > 0 else 0
    
    # Success rate (% of docs NOT in error state)
    success_rate = round(((total_docs - error_docs) / total_docs * 100), 1) if total_docs > 0 else 100
    
    return {
        "total_documents": total_docs,
        "ready_documents": ready_docs,
        "processing_documents": processing_docs,
        "error_documents": error_docs,
        "total_chunks": int(total_chunks),
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "user_queries": user_queries,
        "ai_responses": ai_responses,
        "total_images": total_images,
        "index_coverage": index_coverage,
        "success_rate": success_rate,
    }

@app.delete("/api/images/{image_id}")
def delete_image(image_id: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """Delete an image asset and its file."""
    img = db.query(models.ImageAsset).filter(
        models.ImageAsset.id == image_id,
        models.ImageAsset.owner_id == current_user.id
    ).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete file from disk
    try:
        file_path = os.path.join(UPLOAD_DIR, img.file_name)
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass  # Non-critical
    
    # Delete from DB
    db.delete(img)
    db.commit()
    
    return {"message": "Image deleted"}

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    # Startup: preload embeddings in background
    def preload():
        try:
            vector_store.get_embeddings()
        except: pass
    threading.Thread(target=preload, daemon=True).start()
    print("Server ready! (Professional Multimodal Mode)")
    yield
    # Shutdown: cleanup if needed

app.router.lifespan_context = lifespan

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)
