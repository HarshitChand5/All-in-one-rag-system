import os
import re
import time
import asyncio
import logging
from typing import List, Dict, Any, Tuple
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, START, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI

import vector_store

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------
# LLM Provider setup
# ---------------------------------------------------------------------

def get_llm(prefer_gemini=False):
    """Get LLM with Groq primary, Gemini fallback."""
    groq_key = os.getenv("GROQ_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    if not prefer_gemini and groq_key:
        return ChatGroq(model="llama-3.1-8b-instant", temperature=0.0)
    
    if gemini_key:
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.0)
    
    if groq_key:
        return ChatGroq(model="llama-3.1-8b-instant", temperature=0.0)
        
    raise ValueError("No LLM API keys found in .env")

def get_fallback_llm():
    """Get Gemini as fallback when Groq fails."""
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.0)
    return None

LLM = get_llm()
FALLBACK_LLM = get_fallback_llm()
OUTPUT_PARSER = StrOutputParser()

# ---------------------------------------------------------------------
# State Management
# ---------------------------------------------------------------------

class ResearchState(TypedDict, total=False):
    user_id: str
    doc_id: str
    question: str
    local_hits: List[Any]
    answer: str
    answer_source: str # 'document' or 'llm'
    sources: List[Dict[str, Any]]

_NOT_FOUND_PHRASES = [
    "could not find information",
    "not found in",
    "no information about",
    "not mentioned in",
    "unable to find",
]

def _answer_needs_fallback(answer: str) -> bool:
    lower = answer.lower()
    return any(phrase in lower for phrase in _NOT_FOUND_PHRASES)

# ---------------------------------------------------------------------
# Graph Nodes
# ---------------------------------------------------------------------

def retrieve_local(state: ResearchState) -> ResearchState:
    doc_id = state.get("doc_id")
    
    # If no document is selected, skip retrieval entirely — the pipeline
    # will fall through to the LLM fallback for a general-knowledge answer.
    if not doc_id:
        state["local_hits"] = []
        return state
    
    vs_manager = vector_store.get_user_vector_store(state["user_id"])
    
    # Use our new pgvector search logic
    hits = vs_manager.search_with_score(
        state["question"], 
        k=8, 
        score_threshold=0.15,
        filter={"document_id": doc_id}
    )
    
    state["local_hits"] = hits
    return state

def generate_grounded_answer(state: ResearchState) -> ResearchState:
    question = state["question"]
    hits = state.get("local_hits") or []

    if not hits:
        state["answer"] = ""
        state["answer_source"] = "llm" 
        return state

    # Build context string
    context_lines = []
    for i, hit in enumerate(hits, start=1):
        content = hit.page_content.strip()
        page = hit.metadata.get("page", "?")
        context_lines.append(f"[Source {i}] (Page {page}): {content}")
    
    context = "\n\n".join(context_lines)
    
    # Truncate context to stay within Groq's token limits (~4000 chars)
    if len(context) > 4000:
        context = context[:4000] + "\n\n[Context truncated for length]"

    system_prompt = (
        "You are a STRICTLY document-grounded AI assistant.\n\n"
        "RULES:\n"
        "1. Answer ONLY using the provided Context below.\n"
        "2. If the answer is not in the context, say: 'I could not find information about this in the uploaded documents.'\n"
        "3. Keep your response professional, organized, and factual.\n"
        "4. Do NOT use outside knowledge.\n"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", "Question: {question}\n\nContext:\n{context}")
    ])

    # Try Groq first, fallback to Gemini on errors
    try:
        chain = prompt | LLM | OUTPUT_PARSER
        answer = chain.invoke({"question": question, "context": context})
    except Exception as e:
        error_msg = str(e)
        if FALLBACK_LLM and ("429" in error_msg or "413" in error_msg or "rate_limit" in error_msg):
            logger.warning(f"Groq failed ({error_msg[:80]}), falling back to Gemini...")
            chain = prompt | FALLBACK_LLM | OUTPUT_PARSER
            answer = chain.invoke({"question": question, "context": context})
        else:
            raise
    
    if _answer_needs_fallback(answer):
        state["answer"] = ""
        state["answer_source"] = "llm"
    else:
        state["answer"] = answer
        state["answer_source"] = "document"
        
        # Format sources for UI
        sources = []
        for i, hit in enumerate(hits, start=1):
            sources.append({
                "id": f"S{i}",
                "title": hit.metadata.get("title", "Document"),
                "page": hit.metadata.get("page")
            })
        state["sources"] = sources

    return state

def llm_fallback(state: ResearchState) -> ResearchState:
    question = state["question"]
    
    system_prompt = (
        "You are a helpful AI assistant. The user's uploaded documents did not contain the answer, "
        "so you must answer based on your general knowledge. Start by briefly mentioning that "
        "this information is not in the document context."
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", "{question}")
    ])

    try:
        chain = prompt | LLM | OUTPUT_PARSER
        state["answer"] = chain.invoke({"question": question})
    except Exception as e:
        if FALLBACK_LLM and ("429" in str(e) or "413" in str(e) or "rate_limit" in str(e)):
            logger.warning(f"Groq failed in fallback, using Gemini...")
            chain = prompt | FALLBACK_LLM | OUTPUT_PARSER
            state["answer"] = chain.invoke({"question": question})
        else:
            raise
    state["answer_source"] = "llm"
    state["sources"] = [{"id": "LLM", "title": "General Knowledge"}]
    return state

# ---------------------------------------------------------------------
# Graph Routing & Construction
# ---------------------------------------------------------------------

def route_after_grounding(state: ResearchState) -> str:
    if state.get("answer_source") == "llm" and not state.get("answer"):
        return "fallback"
    return "end"

def build_research_graph():
    graph = StateGraph(ResearchState)
    
    graph.add_node("retrieve", retrieve_local)
    graph.add_node("ground", generate_grounded_answer)
    graph.add_node("fallback", llm_fallback)
    
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "ground")
    graph.add_conditional_edges(
        "ground",
        route_after_grounding,
        {"fallback": "fallback", "end": END}
    )
    graph.add_edge("fallback", END)
    
    return graph.compile()

RESEARCH_APP = build_research_graph()

# ---------------------------------------------------------------------
# Cache & Public Execution
# ---------------------------------------------------------------------

_QUERY_CACHE = {} # Simple in-memory cache

async def get_intelligent_response(user_id: str, doc_id: str, question: str, image_ids: list = None):
    cache_key = (doc_id, question, tuple(image_ids or []))
    if cache_key in _QUERY_CACHE:
        return _QUERY_CACHE[cache_key]

    # Standard RAG pipeline
    state = await asyncio.to_thread(
        RESEARCH_APP.invoke,
        {"user_id": user_id, "doc_id": doc_id, "question": question}
    )
    
    result = {
        "answer": state.get("answer"),
        "sources": state.get("sources", []),
        "answer_source": state.get("answer_source")
    }
    
    # Phase 5: Cross-modal integration — merge image context if provided
    if image_ids and len(image_ids) > 0:
        try:
            import os
            from image_analyzer import analyze_image_with_document_context
            
            UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
            
            # Get document context from RAG results
            doc_context = result.get("answer", "")
            
            for image_id in image_ids[:3]:  # Limit to 3 images max
                # Find image file
                import glob
                matches = glob.glob(os.path.join(UPLOAD_DIR, f"{image_id}.*"))
                if not matches:
                    continue
                    
                with open(matches[0], "rb") as f:
                    image_bytes = f.read()
                
                # Cross-modal analysis
                cross_modal_answer = await asyncio.to_thread(
                    analyze_image_with_document_context,
                    image_bytes, doc_context, question
                )
                
                # Merge: append cross-modal insight to the answer
                result["answer"] = (
                    f"{result['answer']}\n\n"
                    f"---\n"
                    f"**🖼️ Cross-Modal Analysis (Image + Document):**\n\n"
                    f"{cross_modal_answer}"
                )
                result["answer_source"] = "multimodal"
                result["sources"].append({"id": "IMG", "title": f"Image Analysis", "page": None})
                
        except Exception as e:
            logger.error(f"Cross-modal integration error: {e}")
            # Gracefully fall back to text-only answer
    
    _QUERY_CACHE[cache_key] = result
    return result
