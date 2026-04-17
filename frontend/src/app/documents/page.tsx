"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { 
  FileText, Trash2, Upload, Loader2, CheckCircle2,
  Clock, Layers, ArrowRight, Search, FileEdit, AlertCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { docsApi } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  const getAuthToken = () => {
    return document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];
  };

  const fetchDocuments = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token || token === "undefined") {
        router.push("/login");
        return;
      }
      const data = await docsApi.list(token);
      setDocuments(data);
    } catch (error) {
      console.error("Failed to fetch documents", error);
      // api.ts wrapper handles 401s
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll for processing progress on active docs
  const processingDocs = useMemo(() => documents.filter(d => d.status === 'processing' || d.status === 'indexing'), [documents]);
  
  useEffect(() => {
    if (processingDocs.length === 0) return;
    
    const pollProgress = async () => {
      const token = getAuthToken();
      if (!token) return;
      
      for (const doc of processingDocs) {
        try {
          const res = await fetch(`${API_URL}/api/docs/${doc.id}/status`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setProgressMap(prev => ({ ...prev, [doc.id]: data.processing_progress || 0 }));
            if (data.status === 'ready') {
              fetchDocuments(); // Refresh full list when a doc becomes ready
            }
          }
        } catch {}
      }
    };
    
    pollProgress();
    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [processingDocs, fetchDocuments]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadFileName(file.name);
    setUploading(true);

    try {
      const token = getAuthToken();
      if (!token || token === "undefined") return;

      await docsApi.upload(file, token);
      toast.success(`Uploaded ${file.name}`);
      fetchDocuments();
    } catch (error) {
      console.error("Upload error", error);
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setUploadFileName("");
    }
  }, [fetchDocuments]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: false,
    disabled: uploading,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] }
  });

  const deleteDocument = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      const token = getAuthToken();
      if (!token || token === "undefined") return;
      
      await docsApi.delete(id, token);
      toast.success("Document deleted");
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (error) {
      console.error("Delete failed", error);
      toast.error("Delete failed");
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial="hidden"
      animate="show"
      variants={staggerContainer}
      className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto pb-20"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-1">Documents</h1>
          <p className="text-[#86868b] text-[15px]">Upload and manage your research files.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#48484a]" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..." 
            className="h-9 w-56 bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 text-[13px] text-white placeholder:text-[#48484a] outline-none focus:border-violet-500/40 transition-all"
          />
        </div>
      </motion.div>

      {/* Upload */}
      <motion.div variants={fadeUp}>
        <div 
          {...getRootProps()} 
          className={cn(
            "rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
            uploading 
              ? "border-violet-500/30 bg-violet-500/5 cursor-default" 
              : isDragActive 
                ? "border-violet-400/50 bg-violet-500/5" 
                : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
          )}
        >
          <input {...getInputProps()} />
          
          {uploading ? (
            <div className="flex items-center gap-4 p-6">
              <Loader2 size={20} className="animate-spin text-violet-400" />
              <div>
                <p className="text-[14px] font-medium text-white">{uploadFileName}</p>
                <p className="text-[13px] text-[#86868b]">Uploading and indexing...</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-10">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center mb-3">
                <Upload size={18} className="text-[#86868b]" />
              </div>
              <p className="text-[14px] font-medium text-white mb-1">Drop files here or click to upload</p>
              <p className="text-[13px] text-[#48484a]">PDF, TXT, or Markdown files</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Document Grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredDocs.map((doc, idx) => {
            const progress = progressMap[doc.id] ?? doc.processing_progress ?? 0;
            const isProcessing = doc.status === 'processing' || doc.status === 'indexing';
            
            return (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.03 }}
              className="group apple-card p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center group-hover:bg-violet-500/10 transition-colors">
                  <FileText size={18} className="text-[#86868b] group-hover:text-violet-400 transition-colors" />
                </div>
                <button 
                  onClick={() => deleteDocument(doc.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#48484a] hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              <h4 className="text-[14px] font-medium text-white truncate mb-1">{doc.title}</h4>
              <div className="flex items-center gap-2 text-[12px] text-[#86868b]">
                <span className="uppercase">{doc.file_type?.split('/')[1] || 'DOC'}</span>
                <span>·</span>
                <span>{formatFileSize(doc.file_size)}</span>
              </div>

              {/* Progress Bar for processing docs */}
              {isProcessing && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-amber-400 font-medium">Processing...</span>
                    <span className="text-[11px] text-[#86868b] font-mono">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[12px] text-[#86868b]">
                  <Layers size={12} />
                  <span>{doc.chunk_count} chunks</span>
                </div>
                {doc.status === 'ready' ? (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                    <CheckCircle2 size={12} />
                    <span>Indexed</span>
                  </div>
                ) : doc.status === 'error' ? (
                  <div className="flex items-center gap-1 text-[11px] text-red-400">
                    <AlertCircle size={12} />
                    <span>Error</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-amber-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span>{progress > 0 ? `${progress}%` : 'Indexing'}</span>
                  </div>
                )}
              </div>

              {doc.file_type?.toLowerCase().includes('pdf') && (
                <button 
                  onClick={() => router.push(`/documents/edit/${doc.id}`)}
                  className="w-full mt-3 py-2 rounded-lg bg-white/[0.04] hover:bg-violet-500/10 border border-white/[0.06] text-[12px] text-[#86868b] hover:text-violet-400 transition-all flex items-center justify-center gap-1.5"
                >
                  <FileEdit size={12} /> Edit PDF
                </button>
              )}
            </motion.div>
          )})}
          
          {filteredDocs.length === 0 && !isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-16 flex flex-col items-center justify-center"
            >
              <FileText size={24} className="text-[#48484a] mb-3" />
              <p className="text-[#86868b] text-[15px] mb-1">No documents found</p>
              <p className="text-[#48484a] text-[13px]">Upload a file or clear your search filter.</p>
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-violet-400 text-[13px] mt-2 hover:underline">
                  Clear search
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
