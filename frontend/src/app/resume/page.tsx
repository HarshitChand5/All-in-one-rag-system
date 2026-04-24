"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { 
  FileText, Upload, Briefcase, Search, Loader2, 
  ChevronRight, CheckCircle2, AlertCircle, XCircle,
  Lightbulb, Sparkles, MessageSquare, Send, Bot
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Document { id: string; title: string; type: string; status: string; date: string; size: number; chunk_count: number; file_name?: string; }
interface AnalyzeResult {
  score: number;
  match_percentage: number;
  missing_skills: string[];
  format_issues: string[];
  suggestions: string[];
  interview_questions: string[];
}
interface Message { id: string; role: "user" | "assistant"; content: string; created_at: string; }

export default function ResumeAnalyzerPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResult | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const getAuthToken = () => document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];

  const fetchDocuments = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/docs`, { headers: { "Authorization": `Bearer ${token}` } });
      if (response.ok) {
        const docs = await response.json();
        setDocuments(docs);
      }
    } catch (error) { console.error("Failed to fetch documents", error); }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/docs/upload`, { 
        method: "POST", 
        headers: { "Authorization": `Bearer ${token}` }, 
        body: formData 
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Uploaded ${file.name}`);
        fetchDocuments();
        const newDoc = { id: data.id || data.doc_id, title: file.name, type: file.name.split('.').pop() || '', status: 'indexing', date: new Date().toISOString(), size: file.size, chunk_count: 0 };
        setActiveDoc(newDoc);
        setAnalysisResult(null);
      }
    } catch { toast.error("Upload failed"); } finally { setIsUploading(false); }
  }, [fetchDocuments]);

  const { getRootProps, getInputProps } = useDropzone({ onDrop, noClick: true, accept: { 'application/pdf': ['.pdf'] } });

  const analyzeResume = async () => {
    if (!activeDoc) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/resume/analyze`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: activeDoc.id, job_description: jobDescription })
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysisResult(data);
        toast.success("Analysis complete");
      } else {
        const error = await response.json();
        toast.error(error.detail || "Analysis failed");
      }
    } catch {
      toast.error("Network error during analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeDoc || isChatLoading) return;
    
    const query = chatInput.trim();
    setChatInput("");
    setIsChatLoading(true);
    
    const tempUserMsg: Message = { id: `temp-${Date.now()}`, role: "user", content: query, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const token = getAuthToken();
      // Use existing chat query endpoint by creating a temporary session string if needed
      // Actually, we can just use the standard AI text action or let ai_researcher handle it, but wait:
      // The chat endpoint expects a session_id. We can just use the activeDoc.id as session_id for simplicity 
      // or create a standalone RAG call. Let's use the standard endpoint with a pseudo session.
      const response = await fetch(`${API_URL}/api/chat/query`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: `resume-${activeDoc.id}`, query, active_doc_id: activeDoc.id })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { id: data.id, role: "assistant", content: data.content, created_at: new Date().toISOString() }]);
      }
    } catch {
      toast.error("Failed to get AI response");
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div {...getRootProps()} className="flex h-full w-full overflow-hidden bg-black p-3 gap-3">
      <input {...getInputProps()} />
      
      {/* Left Column: Selector & Input */}
      <div className="w-[340px] flex flex-col gap-3 h-full">
        <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl flex flex-col overflow-hidden h-[45%]">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-violet-400" />
              <span className="text-[13px] font-medium text-white">Select Resume</span>
            </div>
            <button onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.pdf';
              input.onchange = (e: any) => onDrop(Array.from(e.target.files));
              input.click();
            }} className="p-1.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#86868b] hover:text-white transition-colors">
              {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {documents.filter(d => d.type?.includes('pdf') || d.file_name?.includes('.pdf')).map(doc => (
              <div 
                key={doc.id}
                onClick={() => { setActiveDoc(doc); setAnalysisResult(null); setMessages([]); }}
                className={cn(
                  "p-3 rounded-lg border transition-all cursor-pointer",
                  activeDoc?.id === doc.id 
                    ? "bg-violet-500/10 border-violet-500/30" 
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                )}
              >
                <div className="flex items-center gap-2">
                  <FileText className={cn("w-4 h-4", activeDoc?.id === doc.id ? "text-violet-400" : "text-[#86868b]")} />
                  <p className="text-[13px] font-medium text-white truncate">{doc.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl flex flex-col flex-1 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-emerald-400" />
            <span className="text-[13px] font-medium text-white">Job Description (Optional)</span>
          </div>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here to get a match score and missing keywords..."
            className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-[13px] text-white placeholder:text-[#48484a] outline-none focus:border-violet-500/40 custom-scrollbar resize-none mb-3"
          />
          <Button 
            onClick={analyzeResume}
            disabled={!activeDoc || isAnalyzing}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-lg h-10 font-medium"
          >
            {isAnalyzing ? <><Loader2 size={16} className="animate-spin mr-2" /> Analyzing...</> : <><Sparkles size={16} className="mr-2" /> Analyze Resume</>}
          </Button>
        </div>
      </div>

      {/* Right Column: Dashboard & Chat */}
      <div className="flex-1 bg-[#0d0d0d] border border-white/[0.06] rounded-xl flex flex-col overflow-hidden relative">
        {!activeDoc ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-[#86868b]">
            <Briefcase size={40} className="mb-4 opacity-50" />
            <h2 className="text-lg font-medium text-white mb-2">Resume Analyzer</h2>
            <p className="text-[14px]">Select or upload a resume from the left panel to begin.</p>
          </div>
        ) : !analysisResult && !isAnalyzing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-[#86868b]">
            <Sparkles size={40} className="mb-4 opacity-50 text-violet-400" />
            <h2 className="text-lg font-medium text-white mb-2">Ready to Analyze</h2>
            <p className="text-[14px]">Click the Analyze button to extract ATS score and insights.</p>
          </div>
        ) : isAnalyzing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-[#86868b]">
            <Loader2 size={40} className="mb-4 animate-spin text-violet-500" />
            <h2 className="text-lg font-medium text-white mb-2">Simulating ATS System...</h2>
            <p className="text-[14px]">Scoring keywords, checking structure, and preparing interview questions.</p>
          </div>
        ) : analysisResult && (
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col xl:flex-row">
            {/* Dashboard Content */}
            <div className="flex-1 p-6 space-y-6">
              
              <div className="flex items-center gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle 
                      cx="50" cy="50" r="45" fill="none" 
                      stroke={analysisResult.score > 80 ? "#34c759" : analysisResult.score > 60 ? "#ff9f0a" : "#ff453a"}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(analysisResult.score / 100) * 283} 283`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{analysisResult.score}</span>
                    <span className="text-[10px] text-[#86868b] uppercase font-semibold tracking-wider">ATS Score</span>
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">{jobDescription ? `Match: ${analysisResult.match_percentage}%` : "General Resume Score"}</h3>
                  <p className="text-[13px] text-[#86868b]">
                    {analysisResult.score > 80 ? "Excellent format and keyword utilization." : analysisResult.score > 60 ? "Good baseline, but needs optimization." : "Requires significant structural changes to pass ATS filters."}
                  </p>
                </div>
              </div>

              {jobDescription && analysisResult.missing_skills?.length > 0 && (
                <div>
                  <h4 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
                    <AlertCircle size={16} className="text-amber-500" /> Missing Job Keywords
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.missing_skills.map((skill, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.format_issues?.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                  <h4 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
                    <XCircle size={16} className="text-red-400" /> Formatting Issues
                  </h4>
                  <ul className="space-y-2">
                    {analysisResult.format_issues.map((issue, i) => (
                      <li key={i} className="text-[13px] text-red-200/80 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span> {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
                  <Lightbulb size={16} className="text-emerald-400" /> Actionable Suggestions
                </h4>
                <div className="space-y-2">
                  {analysisResult.suggestions?.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[13px] text-[#a1a1aa] flex items-start gap-3">
                      <CheckCircle2 size={16} className="text-emerald-500 my-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-3">
                  <MessageSquare size={16} className="text-indigo-400" /> Potential Interview Questions
                </h4>
                <div className="space-y-2">
                  {analysisResult.interview_questions?.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-[13px] text-indigo-200/90 font-medium">
                      Q: {item}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* AI Chat Box */}
            <div className="w-full xl:w-[320px] flex flex-col border-t xl:border-t-0 xl:border-l border-white/[0.06] bg-[#09090b]">
              <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
                <Bot size={16} className="text-violet-400" />
                <span className="text-[13px] font-medium text-white">Chat with Resume</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                  <p className="text-[12px] text-[#86868b] text-center mt-4">
                    Ask AI to rewrite a bullet point, explain a section, or prepare you for the interview.
                  </p>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={cn("max-w-[90%] rounded-xl px-3 py-2 text-[13px]", msg.role === 'user' ? "bg-violet-600 text-white ml-auto" : "bg-white/[0.06] text-[#e5e5ea]")}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <div className="text-[13px] leading-relaxed">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                            a: ({node, ...props}) => <a className="text-violet-400 hover:underline" {...props} />,
                            h1: ({node, ...props}) => <h1 className="text-lg font-bold text-white mb-2 mt-3 first:mt-0" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-base font-bold text-white mb-2 mt-3 first:mt-0" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-[14px] font-bold text-white mb-1 mt-2 first:mt-0" {...props} />,
                            code: ({node, inline, ...props}: any) => 
                              inline ? (
                                <code className="bg-black/30 px-1.5 py-0.5 rounded text-[12px] font-mono text-violet-300" {...props} />
                              ) : (
                                <code className="block bg-black/50 p-2.5 rounded-lg text-[12px] font-mono text-violet-300 overflow-x-auto mb-2" {...props} />
                              )
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                ))}
                {isChatLoading && (
                  <div className="bg-white/[0.06] rounded-xl px-3 py-2 text-[13px] w-fit">
                    <Loader2 size={14} className="animate-spin text-[#86868b]" />
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-white/[0.06]">
                <form onSubmit={sendChatMessage} className="relative">
                  <input 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask AI to rewrite..."
                    className="w-full h-9 bg-white/[0.04] border border-white/[0.08] rounded-lg pl-3 pr-10 text-[12px] text-white outline-none focus:border-violet-500/40"
                  />
                  <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="absolute right-1 top-1 w-7 h-7 flex items-center justify-center text-[#86868b] hover:text-white disabled:opacity-50 transition-colors">
                    <Send size={12} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
