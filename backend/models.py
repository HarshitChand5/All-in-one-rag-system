from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from database import Base
import datetime
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    documents = relationship("Document", back_populates="owner")
    chat_sessions = relationship("ChatSession", back_populates="owner")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String)
    file_name = Column(String)
    file_type = Column(String)
    file_size = Column(Integer)
    chunk_count = Column(Integer, default=0)
    processing_progress = Column(Integer, default=0)  # 0-100 percentage
    status = Column(String, default="processing")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner_id = Column(String, ForeignKey("users.id"))

    owner = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=generate_uuid)
    content = Column(Text)
    page_number = Column(Integer)
    document_id = Column(String, ForeignKey("documents.id"))
    
    document = relationship("Document", back_populates="chunks")

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner_id = Column(String, ForeignKey("users.id"))

    owner = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    role = Column(String)  # 'user' or 'assistant'
    content = Column(Text)
    sources = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    session_id = Column(String, ForeignKey("chat_sessions.id"))

    session = relationship("ChatSession", back_populates="messages")

class ImageAsset(Base):
    __tablename__ = "image_assets"

    id = Column(String, primary_key=True, default=generate_uuid)
    file_name = Column(String)
    original_name = Column(String)
    analysis_text = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner_id = Column(String, ForeignKey("users.id"))

    owner = relationship("User")
