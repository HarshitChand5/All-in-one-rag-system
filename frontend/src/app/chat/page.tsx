"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { 
  Send, Bot, Loader2, Plus, BookOpen, Upload, 
  X, ChevronRight, FileText, Search, History, Layers,
  Mic, MicOff, Volume2, VolumeX, Zap, ImageIcon
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ThinkingIndicator, ThinkingState } from "@/components/chat/ThinkingIndicator";
import { SmartSuggestions } from "@/components/chat/SmartSuggestions";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message { id: string; role: "user" | "assistant"; content: string; sources?: { title: string; content: string }[]; created_at: string; }
interface Session { id: string; title: string; created_at: string; }
interface Document { id: string; title: string; type: string; status: string; date: string; size: number; chunk_count: number; file_name?: string; }

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [thinkingState, setThinkingState] = useState<ThinkingState>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [kbOpen, setKbOpen] = useState(true);
  
  // Voice features
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  
  // Image attachment
  const [attachedImages, setAttachedImages] = useState<{id: string, file: File, preview: string}[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getAuthToken = () => {
    return document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];
  };

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/docs`, { headers: { "Authorization": `Bearer ${token}` } });
      if (response.ok) setDocuments(await response.json());
    } catch (error) { console.error("Failed to fetch documents", error); }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/chat/sessions`, { headers: { "Authorization": `Bearer ${token}` } });
      if (response.ok) setSessions(await response.json());
    } catch (error) { console.error("Failed to fetch sessions", error); }
  }, []);

  useEffect(() => { fetchSessions(); fetchDocuments(); }, [fetchSessions, fetchDocuments]);

  // Poll for indexing status
  const hasIndexing = useMemo(() => documents.some(d => d.status === 'indexing' || d.status === 'processing'), [documents]);
  
  useEffect(() => {
    if (!hasIndexing) return;
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [hasIndexing, fetchDocuments]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/docs/upload`, { method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Uploaded ${file.name}`);
        fetchDocuments();
        setActiveDoc({ id: data.doc_id, title: file.name, type: file.name.split('.').pop() || '', status: 'indexing', date: new Date().toISOString(), size: file.size, chunk_count: 0 });
      }
    } catch { toast.error("Upload failed"); } finally { setIsUploading(false); }
  }, [fetchDocuments]);

  const { getRootProps, getInputProps } = useDropzone({ onDrop, noClick: true, accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] } });

  const loadSession = async (session: Session) => {
    setCurrentSession(session);
    setMessages([]);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/chat/sessions/${session.id}/messages`, { headers: { "Authorization": `Bearer ${token}` } });
      if (response.ok) setMessages(await response.json());
    } catch { toast.error("Failed to load conversation"); }
  };

  const createNewChat = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/chat/sessions`, { method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ title: "New Chat" }) });
      if (response.ok) {
        const newSession = await response.json();
        setSessions(prev => [newSession, ...prev]);
        setCurrentSession(newSession);
        setMessages([]);
      }
    } catch { toast.error("Failed to create new chat"); }
  };

  // --- Voice: Speech-to-Text ---
  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser. Try Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    
    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error); // Use warn instead of error to prevent Next.js dev overlay
      if (event.error === 'network') {
        toast.error("Speech recognition network error. Try Chrome, ensure an active internet connection, and check your firewall rules.");
      } else if (event.error === 'not-allowed') {
        toast.error("Microphone access denied. Please allow microphone permissions.");
      } else {
        toast.error("Speech recognition error: " + event.error);
      }
      setIsRecording(false);
    };
    
    recognition.onend = () => {
      setIsRecording(false);
      // In voice mode, auto-send on silence
      if (voiceMode) {
        setTimeout(() => {
          const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
          if (inputEl?.value?.trim()) {
            sendMessage(inputEl.value.trim());
          }
        }, 500);
      }
    };
    
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  // --- Voice: Text-to-Speech ---
  const speakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // In voice mode, auto-start listening after TTS finishes
      if (voiceMode) {
        setTimeout(startRecording, 300);
      }
    };
    
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  };

  // --- Image Attachment ---
  const handleImageAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (const file of Array.from(files)) {
      // Upload to backend and get image_id
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "describe");
      
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/api/images/analyze`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setAttachedImages(prev => [...prev, {
            id: data.image_id,
            file,
            preview: URL.createObjectURL(file)
          }]);
        }
      } catch {
        toast.error("Failed to process image");
      }
    }
  };

  const removeAttachedImage = (imageId: string) => {
    setAttachedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const sendMessage = async (val?: string) => {
    const query = typeof val === 'string' ? val : input.trim();
    if (!query || !currentSession || isLoading) return;
    setInput("");
    setIsLoading(true);
    setThinkingState("analyzing");
    const tempUserMsg: Message = { id: `temp-${Date.now()}`, role: "user", content: query, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const token = getAuthToken();
      setTimeout(() => setThinkingState("searching"), 800);
      
      const body: any = { 
        session_id: currentSession.id, 
        query, 
        active_doc_id: activeDoc?.id 
      };
      
      // Add image IDs if attached
      if (attachedImages.length > 0) {
        body.image_ids = attachedImages.map(img => img.id);
      }
      
      const response = await fetch(`${API_URL}/api/chat/query`, { 
        method: "POST", 
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, 
        body: JSON.stringify(body) 
      });
      
      if (response.ok) {
        setThinkingState("generating");
        const data = await response.json();
        setTimeout(() => {
          setThinkingState(null);
          setMessages(prev => [...prev, { id: data.id, role: "assistant", content: data.content, sources: data.sources, created_at: new Date().toISOString() }]);
          
          // In voice mode, auto-read the response
          if (voiceMode && data.content) {
            speakText(data.content);
          }
        }, 600);
        if (data.session_title && data.session_title !== currentSession.title) {
          const newTitle = data.session_title;
          setCurrentSession(prev => prev ? { ...prev, title: newTitle } : prev);
          setSessions(prev => prev.map(s => s.id === currentSession.id ? { ...s, title: newTitle } : s));
        }
      }
      
      // Clear attached images after sending
      setAttachedImages([]);
    } catch { setThinkingState(null); toast.error("Network error"); } finally { setIsLoading(false); }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinkingState]);

  return (
    <div {...getRootProps()} className="flex h-full w-full overflow-hidden bg-black p-3 gap-3">
      <input {...getInputProps()} />
      
      {/* History */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl flex flex-col h-full overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-[#86868b]" />
                <span className="text-[13px] font-medium text-[#86868b]">History</span>
              </div>
              <button onClick={createNewChat} className="p-1.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#86868b] hover:text-white transition-colors">
                <Plus size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all flex items-center justify-between",
                    currentSession?.id === session.id 
                      ? "bg-white/[0.08] text-white" 
                      : "text-[#86868b] hover:bg-white/[0.04] hover:text-white"
                  )}
                >
                  <span className="truncate">{session.title}</span>
                  {currentSession?.id === session.id && <ChevronRight size={12} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex-1 bg-[#0d0d0d] border border-white/[0.06] rounded-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="h-12 px-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setHistoryOpen(!historyOpen)} className="p-1.5 rounded-md bg-white/[0.04] text-[#86868b] hover:text-white transition-colors">
                <History size={14} />
              </button>
              <h3 className="text-[14px] font-medium text-white truncate">
                {currentSession?.title || "AI Chat"}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Voice Mode Toggle */}
              <button 
                onClick={() => setVoiceMode(!voiceMode)}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  voiceMode 
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30" 
                    : "bg-white/[0.04] text-[#86868b] hover:text-white"
                )}
                title={voiceMode ? "Voice mode ON" : "Voice mode OFF"}
              >
                <Zap size={14} />
              </button>
              <button onClick={() => setKbOpen(!kbOpen)} className={cn("p-1.5 rounded-md", kbOpen ? 'bg-violet-500/10 text-violet-400' : 'bg-white/[0.04] text-[#86868b]')}>
                <BookOpen size={14} />
              </button>
            </div>
          </div>

          {/* Voice Mode Indicator */}
          {voiceMode && (
            <div className="px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400 font-medium">Voice Mode Active — Speak to chat, responses will be read aloud</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar space-y-1">
            {!currentSession && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Bot size={32} className="text-[#48484a] mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Start a conversation</h2>
                <p className="text-[#86868b] max-w-sm mb-6 text-[14px]">
                  Create a new chat to start asking questions about your documents.
                </p>
                <Button onClick={createNewChat} className="px-6 h-9 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[13px] font-medium gap-2 transition-all">
                  <Plus size={14} /> New Chat
                </Button>
              </div>
            )}
            
            {messages.map((m) => (
              <MessageBubble 
                key={m.id} 
                message={m} 
                onSourceClick={(title) => { const doc = documents.find(d => d.title === title); if (doc) { setActiveDoc(doc); setKbOpen(true); } }}
                onSpeak={speakText}
                isSpeaking={isSpeaking}
                onStopSpeaking={stopSpeaking}
              />
            ))}
            
            <ThinkingIndicator state={thinkingState} />
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/[0.06]">
            {/* Attached Images Preview */}
            {attachedImages.length > 0 && (
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                {attachedImages.map(img => (
                  <div key={img.id} className="relative group">
                    <img src={img.preview} className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                    <button 
                      onClick={() => removeAttachedImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <span className="text-[11px] text-[#86868b]">{attachedImages.length} image(s) attached</span>
              </div>
            )}
            
            <SmartSuggestions visible={messages.length > 0 && !isLoading} onSelect={(s) => sendMessage(s)} />
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="relative">
              <input 
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isRecording ? "🎙️ Listening..." : "Ask a question..."}
                className={cn(
                  "w-full h-11 bg-white/[0.04] border outline-none rounded-xl px-4 pr-32 text-white text-[14px] placeholder:text-[#48484a] transition-all",
                  isRecording 
                    ? "border-emerald-500/40 bg-emerald-500/5" 
                    : "border-white/[0.08] focus:border-violet-500/40"
                )}
                disabled={isLoading}
              />
              <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                {/* Image Attach */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#86868b] hover:text-white hover:bg-white/[0.08] transition-all"
                  title="Attach image"
                >
                  <ImageIcon size={14} />
                </button>
                <input 
                  ref={imageInputRef} 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={handleImageAttach}
                />
                
                {/* Mic Button */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                    isRecording 
                      ? "bg-red-500/20 text-red-400 animate-pulse" 
                      : "text-[#86868b] hover:text-white hover:bg-white/[0.08]"
                  )}
                  title={isRecording ? "Stop recording" : "Start voice input"}
                >
                  {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                
                <Button 
                  type="submit" 
                  disabled={isLoading || !input.trim()}
                  className="bg-violet-600 hover:bg-violet-700 h-8 px-3 rounded-lg text-[12px] text-white transition-all disabled:opacity-40"
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} className="mr-1" /> Send</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Knowledge Base Panel */}
      <AnimatePresence>
        {kbOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 520, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex flex-col gap-3 h-full"
          >
            <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-violet-400" />
                <h3 className="text-[13px] font-medium text-white">Documents</h3>
              </div>
              <button onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.onchange = (e: any) => onDrop(Array.from(e.target.files));
                input.click();
              }} className="p-1.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#86868b] hover:text-white transition-colors">
                <Upload size={14} />
              </button>
            </div>

            <div className="flex-1 bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden flex flex-col">
              {activeDoc ? (
                <div className="flex-1 flex flex-col p-3">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="text-violet-400 w-4 h-4 flex-shrink-0" />
                      <h4 className="text-[13px] font-medium text-white truncate">{activeDoc.title}</h4>
                    </div>
                    <button onClick={() => setActiveDoc(null)} className="p-1 hover:bg-white/[0.08] rounded text-[#86868b]">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex-1 rounded-lg overflow-hidden bg-[#1d1d1f] border border-white/[0.06]">
                    {activeDoc.status === 'ready' ? (
                      <iframe src={`${API_URL}/api/files/${activeDoc.file_name || activeDoc.id + '.' + activeDoc.type}`} className="w-full h-full border-none" />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-3">
                        <Loader2 size={20} className="animate-spin text-violet-400" />
                        <p className="text-[13px] text-[#86868b]">Indexing document...</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  <div className="relative mb-3">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#48484a]" />
                    <input className="w-full h-9 bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 text-[12px] text-white placeholder:text-[#48484a] outline-none focus:border-violet-500/30 transition-all" placeholder="Search documents..." />
                  </div>

                  {documents.map(doc => (
                    <motion.div 
                      variants={fadeUp}
                      initial="hidden"
                      animate="show"
                      key={doc.id}
                      onClick={() => setActiveDoc(doc)}
                      className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-violet-500/20 hover:bg-white/[0.04] transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-[#86868b]" />
                          <p className="text-[13px] font-medium text-white truncate">{doc.title}</p>
                        </div>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", doc.status === 'ready' ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10")}>
                          {doc.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#48484a] ml-6">{(doc.file_name ? (doc.file_name.split('.').pop() || '') : (doc.type || 'doc')).toUpperCase()} · {doc.chunk_count} chunks</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
