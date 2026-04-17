"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  ImageIcon, Upload, Loader2, Eye, MessageSquare,
  FileText, Scan, Type, BarChart3, X, Send,
  ArrowRight, Sparkles, Trash2
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { imagesApi } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AnalysisMode = "describe" | "detect" | "ocr" | "diagram";

const ANALYSIS_TABS: { mode: AnalysisMode; label: string; icon: any; color: string }[] = [
  { mode: "describe", label: "Description", icon: Eye, color: "text-violet-400" },
  { mode: "detect", label: "Objects", icon: Scan, color: "text-emerald-400" },
  { mode: "ocr", label: "OCR Text", icon: Type, color: "text-blue-400" },
  { mode: "diagram", label: "Diagram", icon: BarChart3, color: "text-amber-400" },
];

interface ImageAsset {
  id: string;
  file_name: string;
  original_name: string;
  analysis_text: string;
  created_at: string;
}

export default function ImagesPage() {
  const router = useRouter();
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageAsset | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisMode>("describe");
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);

  // Chat with image
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Ingest
  const [ingesting, setIngesting] = useState(false);

  const getAuthToken = () => document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];

  const fetchImages = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const data = await imagesApi.list(token);
      setImages(data);
    } catch (err) {
      console.error("Failed to fetch images", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", "describe");

    try {
      const token = getAuthToken();
      if (!token) return;
      
      const data = await imagesApi.analyze(formData, token);
      toast.success(`Analyzed ${file.name}`);
      setAnalysisResults(prev => ({ ...prev, describe: data.description }));
      fetchImages();
      // Auto-select the new image
      setSelectedImage({
        id: data.image_id,
        file_name: data.image_id + (file.name.includes('.') ? '.' + file.name.split('.').pop() : '.png'),
        original_name: file.name,
        analysis_text: data.description,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      toast.error("Image analysis failed");
    } finally {
      setIsUploading(false);
    }
  }, [fetchImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: isUploading,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'] }
  });

  // Run analysis for a specific mode
  const runAnalysis = async (mode: AnalysisMode) => {
    // If we already have a cached result for this mode, just switch tabs
    if (!selectedImage || (mode in analysisResults && analysisResults[mode])) {
      setActiveTab(mode);
      return;
    }

    setAnalyzing(true);
    setActiveTab(mode);

    try {
      const token = getAuthToken();
      if (!token) return;

      // Use the reanalyze endpoint — no re-upload, no duplicates
      const data = await imagesApi.reanalyze(selectedImage.id, mode, token) as any;
      setAnalysisResults(prev => ({ ...prev, [mode]: data.description }));
    } catch (err) {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // Chat with image
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedImage || chatLoading) return;

    const question = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: question }]);
    setChatLoading(true);

    try {
      const token = getAuthToken();
      if (!token) return;
      
      const data = await imagesApi.chat({ image_id: selectedImage.id, question }, token as string) as any;
      setChatMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      toast.error("Chat failed");
    } finally {
      setChatLoading(false);
    }
  };

  // Convert image to RAG document
  const ingestImage = async () => {
    if (!selectedImage || ingesting) return;
    setIngesting(true);

    try {
      const token = getAuthToken();
      if (!token) return;
      const imgRes = await fetch(`${API_URL}/api/files/${selectedImage.file_name}`);
      if (!imgRes.ok) throw new Error("Failed to fetch image");
      const blob = await imgRes.blob();

      const formData = new FormData();
      formData.append("file", blob, selectedImage.original_name);

      const data = await imagesApi.ingest(formData, token as string) as any;
      toast.success(`Image converted to document: ${data.title}`);
    } catch (err) {
      toast.error("Conversion failed");
    } finally {
      setIngesting(false);
    }
  };

  // Delete image
  const deleteImage = async (imageId: string) => {
    if (!confirm("Delete this image permanently?")) return;
    try {
      const token = getAuthToken();
      if (!token) return;
      await imagesApi.delete(imageId, token);
      toast.success("Image deleted");
      if (selectedImage?.id === imageId) {
        setSelectedImage(null);
        setAnalysisResults({});
        setChatMessages([]);
        setChatOpen(false);
      }
      setImages(prev => prev.filter(img => img.id !== imageId));
    } catch (err) {
      toast.error("Failed to delete image");
    }
  };

  return (
    <motion.div
      initial="hidden" animate="show" variants={staggerContainer}
      className="p-6 lg:p-8 max-w-7xl mx-auto pb-20"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
            <ImageIcon size={22} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Image Intelligence</h1>
            <p className="text-[#86868b] text-[14px]">Upload images for AI-powered analysis, OCR, and cross-modal queries.</p>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-6">
        {/* Left: Upload + Gallery */}
        <div className="w-[380px] shrink-0 space-y-4">
          {/* Upload Zone */}
          <motion.div variants={fadeUp}>
            <div
              {...getRootProps()}
              className={cn(
                "rounded-2xl border-2 border-dashed transition-all p-8 text-center cursor-pointer",
                isUploading ? "border-violet-500/30 bg-violet-500/5 cursor-wait" :
                  isDragActive ? "border-violet-400 bg-violet-500/10" :
                    "border-white/[0.08] hover:border-violet-500/30 hover:bg-white/[0.02]"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center">
                {isUploading ? (
                  <>
                    <Loader2 size={28} className="animate-spin text-violet-400 mb-3" />
                    <p className="text-[13px] text-white font-medium">Analyzing image...</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.06] flex items-center justify-center mb-3">
                      <Upload size={20} className="text-[#86868b]" />
                    </div>
                    <p className="text-[14px] font-medium text-white mb-1">Drop image here</p>
                    <p className="text-[12px] text-[#48484a]">PNG, JPG, WEBP, GIF</p>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* Image Gallery */}
          <motion.div variants={fadeUp} className="space-y-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#48484a]">
              Gallery ({images.length})
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
              {images.map(img => (
                <div
                  key={img.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedImage(img);
                    // Only cache the description if it actually has content
                    setAnalysisResults(img.analysis_text ? { describe: img.analysis_text } : {});
                    setActiveTab("describe");
                    setChatMessages([]);
                    setChatOpen(false);
                  }}
                  className={cn(
                    "group w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer",
                    selectedImage?.id === img.id
                      ? "bg-violet-500/10 border-violet-500/30"
                      : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.15]"
                  )}
                >
                  <img
                    src={`${API_URL}/api/files/${img.file_name}`}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    alt={img.original_name}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-white truncate">{img.original_name}</p>
                    <p className="text-[11px] text-[#48484a]">
                      {new Date(img.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteImage(img.id); }}
                    className="flex-shrink-0 p-1.5 rounded-lg text-[#48484a] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    title="Delete image"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {images.length === 0 && !isLoading && (
                <div className="py-8 text-center">
                  <ImageIcon size={20} className="mx-auto text-[#48484a] mb-2" />
                  <p className="text-[12px] text-[#48484a]">No images yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right: Analysis Panel */}
        <motion.div variants={fadeUp} className="flex-1 min-w-0">
          {selectedImage ? (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d0d0d]">
                <img
                  src={`${API_URL}/api/files/${selectedImage.file_name}`}
                  className="w-full max-h-[300px] object-contain"
                  alt={selectedImage.original_name}
                />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={() => deleteImage(selectedImage.id)}
                    className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-lg text-red-400 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <button
                    onClick={() => setChatOpen(!chatOpen)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all",
                      chatOpen
                        ? "bg-violet-500 text-white"
                        : "bg-black/60 backdrop-blur-lg text-white border border-white/10 hover:bg-white/10"
                    )}
                  >
                    <MessageSquare size={12} /> Chat
                  </button>
                  <button
                    onClick={ingestImage}
                    disabled={ingesting}
                    className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-lg text-white border border-white/10 hover:bg-white/10 text-[11px] font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {ingesting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    {ingesting ? "Converting..." : "To RAG"}
                  </button>
                </div>
              </div>

              {/* Analysis Tabs */}
              <div className="flex gap-1.5 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                {ANALYSIS_TABS.map(tab => (
                  <button
                    key={tab.mode}
                    onClick={() => runAnalysis(tab.mode)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all",
                      activeTab === tab.mode
                        ? "bg-white/[0.08] text-white"
                        : "text-[#48484a] hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <tab.icon size={13} className={activeTab === tab.mode ? tab.color : ""} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Analysis Result */}
              <div className="apple-card p-5 min-h-[200px]">
                {analyzing ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 size={24} className="animate-spin text-violet-400" />
                    <p className="text-[13px] text-[#86868b]">Analyzing image...</p>
                  </div>
                ) : analysisResults[activeTab] ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-[13px] text-[#e5e5ea] leading-relaxed font-sans bg-transparent p-0 m-0 border-none">
                      {analysisResults[activeTab]}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Sparkles size={20} className="text-[#48484a]" />
                    <p className="text-[13px] text-[#48484a]">Click a tab to run analysis</p>
                  </div>
                )}
              </div>

              {/* Chat with Image Panel */}
              <AnimatePresence>
                {chatOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="apple-card overflow-hidden"
                  >
                    <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-violet-400" />
                        <h4 className="text-[13px] font-medium text-white">Chat with Image</h4>
                      </div>
                      <button onClick={() => setChatOpen(false)} className="text-[#48484a] hover:text-white">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="max-h-[250px] overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {chatMessages.length === 0 && (
                        <p className="text-[12px] text-[#48484a] text-center py-4">Ask anything about this image...</p>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[80%] rounded-xl px-3 py-2 text-[13px]",
                            msg.role === "user"
                              ? "bg-violet-600 text-white"
                              : "bg-white/[0.04] border border-white/[0.06] text-[#e5e5ea]"
                          )}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex items-center gap-2 text-[#86868b]">
                          <Loader2 size={14} className="animate-spin" />
                          <span className="text-[12px]">Thinking...</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border-t border-white/[0.06]">
                      <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }} className="flex gap-2">
                        <input
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          placeholder="Ask about this image..."
                          className="flex-1 h-9 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 text-[13px] text-white placeholder:text-[#48484a] outline-none focus:border-violet-500/40"
                        />
                        <Button
                          type="submit"
                          disabled={chatLoading || !chatInput.trim()}
                          className="h-9 px-3 bg-violet-600 hover:bg-violet-700 rounded-lg text-[12px] disabled:opacity-40"
                        >
                          <Send size={13} />
                        </Button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-3xl bg-white/[0.04] flex items-center justify-center mb-4">
                <ImageIcon size={28} className="text-[#48484a]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Select or Upload an Image</h3>
              <p className="text-[#86868b] text-[14px] max-w-sm text-center">
                Upload an image to get AI-powered descriptions, object detection, OCR, and chat capabilities.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
