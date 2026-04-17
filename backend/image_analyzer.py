"""
Image Intelligence Module for DocuRAG.
Uses Gemini 1.5 Flash Vision for image analysis, OCR, object detection,
diagram explanation, and chat-with-image capabilities.
"""
import os
import base64
import logging
from typing import Dict, Any, List

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

def _get_vision_llm():
    """Get a Gemini Vision LLM instance."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set in environment")
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        temperature=0.1
    )

def _encode_image(image_bytes: bytes) -> str:
    """Encode image bytes to base64 data URL."""
    return f"data:image/png;base64,{base64.b64encode(image_bytes).decode('utf-8')}"

def _build_vision_message(image_bytes: bytes, prompt: str) -> HumanMessage:
    """Build a HumanMessage with image and text for Gemini Vision."""
    b64_img = _encode_image(image_bytes)
    return HumanMessage(content=[
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": b64_img}}
    ])


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_image_bytes(image_bytes: bytes, mode: str = "describe") -> Dict[str, Any]:
    """
    Analyze an image in various modes.
    
    Modes:
    - describe: Full scene description
    - detect: Object + scene detection
    - ocr: Extract text from image
    - diagram: Explain diagram/chart/graph
    
    Returns dict with mode-specific keys.
    """
    llm = _get_vision_llm()
    
    prompts = {
        "describe": (
            "Provide a detailed, comprehensive description of this image. "
            "Include: subjects, setting, colors, mood, composition, and any notable details. "
            "Be thorough but organized."
        ),
        "detect": (
            "Analyze this image and list all objects, people, and scene elements you can detect. "
            "For each item, provide:\n"
            "- Object name\n"
            "- Approximate location (top-left, center, bottom-right, etc.)\n"
            "- Confidence level (high/medium/low)\n"
            "Format as a structured list."
        ),
        "ocr": (
            "Extract ALL text visible in this image. "
            "Preserve the original formatting and layout as much as possible. "
            "If text appears in multiple areas, separate them clearly. "
            "Return ONLY the extracted text, no descriptions."
        ),
        "diagram": (
            "This image contains a diagram, chart, graph, or technical illustration. "
            "Please:\n"
            "1. Identify the type of diagram/chart\n"
            "2. Describe its structure and components\n"
            "3. Explain what it represents\n"
            "4. Highlight key insights or data points\n"
            "5. Summarize the main takeaway"
        ),
    }
    
    prompt = prompts.get(mode, prompts["describe"])
    message = _build_vision_message(image_bytes, prompt)
    
    try:
        response = llm.invoke([message])
        result_text = response.content
        
        result = {
            "mode": mode,
            "description": result_text,
        }
        
        # For OCR mode, also extract clean text
        if mode == "ocr":
            result["extracted_text"] = result_text
        
        # For detect mode, parse objects if possible
        if mode == "detect":
            result["objects_raw"] = result_text
        
        return result
        
    except Exception as e:
        logger.error(f"Image analysis failed (mode={mode}): {e}")
        raise


def chat_about_image(image_bytes: bytes, question: str) -> str:
    """
    Answer a question about an image using Gemini Vision.
    """
    llm = _get_vision_llm()
    
    prompt = (
        f"Look at this image carefully and answer the following question:\n\n"
        f"Question: {question}\n\n"
        f"Provide a clear, detailed answer based on what you see in the image."
    )
    
    message = _build_vision_message(image_bytes, prompt)
    
    try:
        response = llm.invoke([message])
        return response.content
    except Exception as e:
        logger.error(f"Image chat failed: {e}")
        raise


def image_to_text_chunks(image_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Convert an image to text chunks suitable for RAG ingestion.
    
    1. Runs comprehensive OCR + scene description
    2. Splits the combined text into chunks
    3. Returns chunks in the same format as PDF extraction
    """
    llm = _get_vision_llm()
    
    prompt = (
        "Analyze this image comprehensively and extract ALL information:\n\n"
        "1. Extract any visible text (OCR)\n"
        "2. Describe the visual content in detail\n"
        "3. If it's a diagram/chart, explain the data and relationships\n"
        "4. Note any logos, labels, or identifiers\n\n"
        "Combine everything into a well-structured document that captures "
        "all the information in this image."
    )
    
    message = _build_vision_message(image_bytes, prompt)
    
    try:
        response = llm.invoke([message])
        full_text = response.content
        
        if not full_text or len(full_text.strip()) < 10:
            return []
        
        # Split into RAG-friendly chunks
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1200,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        
        pieces = splitter.split_text(full_text)
        return [{"content": p, "page": 1} for p in pieces]
        
    except Exception as e:
        logger.error(f"Image-to-text conversion failed: {e}")
        return []


def analyze_image_with_document_context(image_bytes: bytes, document_context: str, question: str) -> str:
    """
    Cross-modal analysis: explain an image using document context.
    Used for Phase 5 cross-modal integration.
    """
    llm = _get_vision_llm()
    
    prompt = (
        f"You have two sources of information:\n\n"
        f"1. An IMAGE (attached)\n"
        f"2. DOCUMENT CONTEXT:\n{document_context[:3000]}\n\n"
        f"Using BOTH the image and the document context, answer this question:\n"
        f"{question}\n\n"
        f"Cross-reference information between the image and document where relevant. "
        f"Be specific about which information comes from which source."
    )
    
    message = _build_vision_message(image_bytes, prompt)
    
    try:
        response = llm.invoke([message])
        return response.content
    except Exception as e:
        logger.error(f"Cross-modal analysis failed: {e}")
        raise
