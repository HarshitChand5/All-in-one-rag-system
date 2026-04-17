"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { 
  FileEdit, 
  Upload, 
  FileText, 
  ArrowRight, 
  Search, 
  Plus, 
  Loader2, 
  CheckCircle2,
  Sparkles,
  Download,
  AlertCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function PDFEditorLobby() {
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const getAuthToken = () => {
    return document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];
  };

  const fetchDocuments = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/docs`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Only show PDFs - Map to file_type
        setDocuments(data.filter((doc: any) => 
          doc.file_type?.toLowerCase().includes('pdf') || 
          doc.file_name?.toLowerCase().endsWith('.pdf')
        ));
      }
    } catch (error) {
      console.error("Failed to fetch documents", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);
  
  // Poll for updates if any documents are still in 'processing' state
  const hasIndexing = useMemo(() => documents.some(d => d.status === 'processing'), [documents]);

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
      const response = await fetch(`${API_URL}/api/docs/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Imported ${file.name}`);
        // Use data.id to match backend response
        router.push(`/documents/edit/${data.id}`);
      } else {
        toast.error("Import failed");
      }
    } catch {
      toast.error("Network error during import");
    } finally {
      setIsUploading(false);
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: false,
    disabled: isUploading,
    accept: { 'application/pdf': ['.pdf'] }
  });

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial="hidden"
      animate="show"
      variants={staggerContainer}
      className="space-y-10 max-w-6xl mx-auto px-4 py-8"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <FileEdit size={24} />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tighter">PDF Intelligence Editor</h1>
          </div>
          <p className="text-slate-400 text-lg">Modify and annotate research documents locally.</p>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PDF library..." 
            className="h-12 w-64 glass-morphism rounded-2xl border-white/5 pl-12 pr-4 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-purple-500/30 transition-all"
          />
        </div>
      </motion.div>

      {/* Import Component */}
      <motion.div variants={fadeUp} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-[30px] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
        <div 
          {...getRootProps()} 
          className={cn(
            "relative glass-morphism rounded-[28px] border-2 border-dashed transition-all duration-300 p-12 text-center",
            isUploading ? "border-purple-500/50 bg-purple-500/5 cursor-wait" :
            isDragActive ? "border-purple-400 bg-purple-500/10 scale-[1.01]" : 
            "border-white/10 hover:border-purple-500/30 hover:bg-white/5 cursor-pointer"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-[24px] bg-purple-500/10 flex items-center justify-center mb-6">
              {isUploading ? <Loader2 className="animate-spin text-purple-500" size={32} /> : <Upload size={32} className="text-purple-400" />}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Import New PDF for Editing</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              {isUploading ? "Initializing encryption and loading document..." : "Drag and drop any PDF here to jump straight into the editor."}
            </p>
            <div className="mt-8 flex items-center gap-6">
               <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <Sparkles size={12} className="text-amber-500" />
                  Local Processing
               </div>
               <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <Download size={12} className="text-blue-500" />
                  Instant Export
               </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* PDF List */}
      <div className="space-y-6">
         <motion.h3 variants={fadeUp} className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Available Documents ({filteredDocs.length})</motion.h3>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredDocs.map((doc, idx) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative"
                >
                  <div className="relative glass-morphism rounded-3xl border border-white/5 p-6 hover:border-white/20 transition-all flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-6">
                       <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/10 transition-colors">
                          <FileText size={24} className="text-slate-400 group-hover:text-purple-400" />
                       </div>
                       <div className="min-w-0">
                          <h4 className="text-white font-bold truncate leading-tight">{doc.title}</h4>
                          <span className="text-[10px] text-slate-500 uppercase font-bold">{formatFileSize(doc.file_size)}</span>
                       </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between gap-3">
                       <button 
                         onClick={() => router.push(`/documents/edit/${doc.id}`)}
                         className="flex-1 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-500/10 flex items-center justify-center gap-2"
                       >
                          Open Editor <ArrowRight size={14} />
                       </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredDocs.length === 0 && !isLoading && (
              <div className="col-span-full py-12 text-center glass-morphism rounded-[28px] border-white/5 border border-dashed">
                 <AlertCircle className="mx-auto text-slate-700 mb-4" size={32} />
                 <p className="text-slate-500 font-bold">No PDF documents available for editing.</p>
                 <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest mt-2">Upload one above to get started</p>
              </div>
            )}
         </div>
      </div>
    </motion.div>
  );
}
