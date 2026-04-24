"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Type, 
  Highlighter, 
  Loader2, 
  CheckCircle2,
  PenTool,
  RotateCw,
  Trash2,
  ArrowRight,
  Image as ImageIcon,
  Sparkles,
  MessageSquare,
  Wand2,
  BookOpen,
  X,
  Palette,
  Bold,
  Italic
} from "lucide-react";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "rgba(255, 255, 0, 0.35)", rgb: [1, 1, 0] },
  { name: "Green", value: "rgba(74, 222, 128, 0.35)", rgb: [0.29, 0.87, 0.5] },
  { name: "Blue", value: "rgba(96, 165, 250, 0.35)", rgb: [0.38, 0.65, 0.98] },
  { name: "Pink", value: "rgba(244, 114, 182, 0.35)", rgb: [0.96, 0.45, 0.71] },
  { name: "Orange", value: "rgba(251, 146, 60, 0.35)", rgb: [0.98, 0.57, 0.24] },
  { name: "Red", value: "rgba(248, 113, 113, 0.35)", rgb: [0.97, 0.44, 0.44] },
];

const TEXT_COLORS = [
  { name: "Black", value: "#000000", rgb: [0, 0, 0] },
  { name: "Red", value: "#ef4444", rgb: [0.94, 0.27, 0.27] },
  { name: "Blue", value: "#3b82f6", rgb: [0.23, 0.51, 0.96] },
  { name: "Green", value: "#22c55e", rgb: [0.13, 0.77, 0.37] },
  { name: "Purple", value: "#a855f7", rgb: [0.66, 0.33, 0.97] },
  { name: "Orange", value: "#f97316", rgb: [0.98, 0.45, 0.09] },
  { name: "White", value: "#ffffff", rgb: [1, 1, 1] },
  { name: "Gray", value: "#6b7280", rgb: [0.42, 0.45, 0.5] },
];

interface Annotation {
  id: string;
  type: "text" | "highlight" | "whiteout" | "image" | "signature" | "comment";
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  src?: string;
  color?: string;
  colorRgb?: number[];
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  textColorRgb?: number[];
}

export default function PDFEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [pdfjs, setPdfjs] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.5);
  const [tool, setTool] = useState<Annotation["type"] | "none">("none");
  const [activeAnnId, setActiveAnnId] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set());
  
  // Advanced settings
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [fontSize, setFontSize] = useState(14);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextSettings, setShowTextSettings] = useState(false);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  
  // AI Actions
  const [selectedText, setSelectedText] = useState("");
  const [showAiToolbar, setShowAiToolbar] = useState(false);
  const [aiToolbarPos, setAiToolbarPos] = useState({ x: 0, y: 0 });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  
  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newAnn: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        type: "image",
        page: currentPage,
        x: 100,
        y: 100,
        width: 150,
        height: 150,
        src: dataUrl
      };
      setAnnotations([...annotations, newAnn]);
    };
    reader.readAsDataURL(file);
  };

  const startSigning = () => setIsSigning(true);
  const saveSignature = () => {
    if (!sigCanvasRef.current) return;
    const dataUrl = sigCanvasRef.current.toDataURL();
    
    const newAnn: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      type: "signature",
      page: currentPage,
      x: 50,
      y: 50,
      width: 150,
      height: 60,
      src: dataUrl
    };
    
    setAnnotations([...annotations, newAnn]);
    setIsSigning(false);
    setTool("none");
  };

  const getAuthToken = () => document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];

  const fetchPdf = useCallback(async (pdfjsLib: any) => {
    if (!id || id === "undefined" || !pdfjsLib) {
      setLoading(false);
      return;
    }
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/docs/${id}/raw`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch PDF");
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      setPdfData(data);
      
      const pdf = await pdfjsLib.getDocument({ 
        data,
        isEvalSupported: false // Recommended for Next.js CSP and environments
      }).promise;
      pdfDocRef.current = pdf;
      console.log(`PDF Loaded: ${pdf.numPages} pages`);
      setNumPages(pdf.numPages);
      setLoading(false);
    } catch (error) {
      console.error("Fetch PDF Error:", error);
      toast.error("Error loading document. Please try again.");
      // router.push("/documents"); // Removed auto-redirect for better debugging
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    const initAndFetch = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Use local worker copied to /public
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        setPdfjs(pdfjsLib);
        if (id && id !== "undefined") {
          await fetchPdf(pdfjsLib);
        }
      } catch (err) {
        console.error("PDF.js Init Error:", err);
        setLoading(false);
      }
    };
    initAndFetch();
    return () => { if (pdfDocRef.current) pdfDocRef.current.destroy(); };
  }, [id, fetchPdf]);

  const renderPage = useCallback(async (pageNum: number, scale: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const rotation = pageRotations[pageNum] || 0;
      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport, canvas }).promise;
    } catch (error) { console.error("Rendering error:", error); }
  }, [pageRotations]);

  useEffect(() => {
    if (!loading && !deletedPages.has(currentPage)) renderPage(currentPage, zoom);
  }, [loading, currentPage, zoom, renderPage, deletedPages]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (tool === "none" || tool === "signature" || tool === "image") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    const newAnnotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      type: tool,
      page: currentPage,
      x,
      y,
      width: tool === "text" ? undefined : 120,
      height: tool === "text" ? undefined : 40,
      content: tool === "text" ? "Double click to edit" : tool === "comment" ? "" : undefined,
      color: tool === "highlight" ? highlightColor.value : undefined,
      colorRgb: tool === "highlight" ? highlightColor.rgb : undefined,
      fontSize: tool === "text" ? fontSize : undefined,
      textColor: tool === "text" ? textColor.value : undefined,
      textColorRgb: tool === "text" ? textColor.rgb : undefined,
    };
    setAnnotations([...annotations, newAnnotation]);
    if (tool === "comment") {
      setActiveComment(newAnnotation.id);
    }
    setTool("none");
  };

  const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
    setAnnotations(annotations.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  // AI Actions
  const handleAiAction = async (action: string) => {
    if (!selectedText) return;
    setAiLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/ai/text-action`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: selectedText, doc_id: id })
      });
      if (res.ok) {
        const data = await res.json();
        setAiResult(data.result);
      } else {
        toast.error("AI action failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAiLoading(false);
    }
  };

  // Detect text selection for AI toolbar
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 5) {
        setSelectedText(text);
        const range = sel?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        if (rect) {
          setAiToolbarPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
          setShowAiToolbar(true);
        }
      } else {
        // Small delay to allow button clicks
        setTimeout(() => {
          if (!document.querySelector('.ai-toolbar:hover')) {
            setShowAiToolbar(false);
          }
        }, 200);
      }
    };
    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, []);

  const handleSave = async () => {
    if (!pdfData) return;
    const toastId = toast.loading("Processing document intelligence...");
    try {
      const pdfDoc = await PDFDocument.load(pdfData);
      const sortedDeleted = Array.from(deletedPages).sort((a, b) => b - a);
      for (const p of sortedDeleted) pdfDoc.removePage(p - 1);
      const remainingPages = pdfDoc.getPages();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const courierFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
      
      let activePageIndex = 0;
      for (let i = 1; i <= numPages; i++) {
        if (deletedPages.has(i)) continue;
        const page = remainingPages[activePageIndex];
        if (!page) break;
        if (pageRotations[i]) {
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees((currentRotation + pageRotations[i]) % 360));
        }
        const pageAnns = annotations.filter(a => a.page === i);
        const { width: pWidth, height: pHeight } = page.getSize();
        for (const ann of pageAnns) {
          const pdfX = ann.x * (pWidth / (canvasRef.current!.width / zoom));
          const pdfY = pHeight - (ann.y * (pHeight / (canvasRef.current!.height / zoom)));
          if (ann.type === "text") {
            const font = ann.fontFamily === "Times" ? timesFont : ann.fontFamily === "Courier" ? courierFont : helveticaFont;
            const cr = ann.textColorRgb || [0, 0, 0];
            page.drawText(ann.content || "", { 
              x: pdfX, y: pdfY - 12, 
              size: ann.fontSize || 12, 
              font, 
              color: rgb(cr[0], cr[1], cr[2]) 
            });
          } else if (ann.type === "highlight") {
            const cr = ann.colorRgb || [1, 1, 0];
            page.drawRectangle({ x: pdfX, y: pdfY - (ann.height || 0), width: ann.width || 50, height: ann.height || 20, color: rgb(cr[0], cr[1], cr[2]), opacity: 0.35 });
          } else if (ann.type === "whiteout") {
            page.drawRectangle({ x: pdfX, y: pdfY - (ann.height || 0), width: ann.width || 50, height: ann.height || 20, color: rgb(1, 1, 1), opacity: 1 });
          } else if (ann.type === "comment") {
            // Comments exported as text annotations
            if (ann.content) {
              page.drawText(`💬 ${ann.content}`, { x: pdfX, y: pdfY - 12, size: 9, font: helveticaFont, color: rgb(0.5, 0.3, 0.8) });
            }
          } else if ((ann.type === "signature" || ann.type === "image") && ann.src) {
            const isPng = ann.src.startsWith("data:image/png");
            const image = isPng ? await pdfDoc.embedPng(ann.src) : await pdfDoc.embedJpg(ann.src);
            page.drawImage(image, { x: pdfX, y: pdfY - (ann.height || 0), width: ann.width || 100, height: ann.height || 40 });
          }
        }
        activePageIndex++;
      }
      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([modifiedPdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pro_edited_${id}.pdf`;
      link.click();
      toast.success("Document Finalized", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Process Failed", { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-4">
        <Loader2 size={40} className="animate-spin text-purple-500" />
        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">DocuRAG Editor Engine v2.0</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0a0a0a] flex flex-col overflow-hidden text-slate-300 font-sans">
      {/* Header */}
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-2xl shrink-0">
        <div className="flex items-center gap-6">
          <Button onClick={() => router.back()} variant="ghost" className="hover:bg-white/5 rounded-2xl">
            <ArrowLeft size={18} />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-white tracking-widest uppercase">Intelligence PDF Editor</h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">V2.0 — MULTIMODAL FEATURES</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center bg-white/5 rounded-2xl p-1 gap-1 border border-white/5">
              <Button size="icon" variant="ghost" onClick={() => setZoom(z => Math.max(0.5, z-0.2))} className="h-8 w-8 rounded-xl"><ZoomOut size={16}/></Button>
              <div className="w-12 text-center text-[10px] font-black">{Math.round(zoom * 100)}%</div>
              <Button size="icon" variant="ghost" onClick={() => setZoom(z => Math.min(3, z+0.2))} className="h-8 w-8 rounded-xl"><ZoomIn size={16}/></Button>
           </div>
           <Button onClick={handleSave} className="bg-white text-black hover:bg-slate-200 h-10 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest gap-2 shadow-2xl transition-all hover:scale-105 active:scale-95">
              <Download size={14} /> Finish & Export
           </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Toolbar */}
        <div className="w-20 border-r border-white/5 bg-black/20 flex flex-col items-center py-6 gap-3 shrink-0 overflow-y-auto custom-scrollbar">
           <ToolbarItem icon={Type} label="Text" active={tool === "text"} onClick={() => { setTool("text"); setShowTextSettings(true); }} color="text-blue-400" />
           
           {/* Highlight with color picker */}
           <div className="relative">
             <ToolbarItem icon={Highlighter} label="Highlight" active={tool === "highlight"} onClick={() => { setTool("highlight"); setShowColorPicker(!showColorPicker); }} color="text-yellow-400" />
             <AnimatePresence>
               {showColorPicker && (
                 <motion.div 
                   initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                   className="absolute left-full ml-2 top-0 z-50 bg-[#1a1a1a] border border-white/10 rounded-2xl p-3 shadow-2xl"
                 >
                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Color</p>
                   <div className="grid grid-cols-3 gap-1.5">
                     {HIGHLIGHT_COLORS.map(c => (
                       <button 
                         key={c.name}
                         onClick={() => { setHighlightColor(c); setShowColorPicker(false); }}
                         className={cn("w-7 h-7 rounded-lg border-2 transition-all hover:scale-110", 
                           highlightColor.name === c.name ? "border-white scale-110" : "border-transparent"
                         )}
                         style={{ background: c.value }}
                         title={c.name}
                       />
                     ))}
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
           
           <ToolbarItem icon={CheckCircle2} label="Whiteout" active={tool === "whiteout"} onClick={() => setTool("whiteout")} color="text-white" />
           <ToolbarItem icon={MessageSquare} label="Comment" active={tool === "comment"} onClick={() => setTool("comment")} color="text-cyan-400" />
           <ToolbarItem icon={PenTool} label="Sign" onClick={() => { setTool("signature"); startSigning(); }} color="text-purple-400" />
           <ToolbarItem icon={ImageIcon} label="Image" onClick={() => fileInputRef.current?.click()} color="text-emerald-400" />
           
           <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
           
           <div className="w-10 h-px bg-white/5 my-2" />
           <Button variant="ghost" onClick={() => setPageRotations({ ...pageRotations, [currentPage]: (pageRotations[currentPage] || 0) + 90 })} className="w-12 h-12 rounded-2xl hover:bg-white/5 text-slate-500"><RotateCw size={20} /></Button>
           <Button variant="ghost" disabled={numPages <= 1} onClick={() => { setDeletedPages(new Set([...deletedPages, currentPage])); if (currentPage > 1) setCurrentPage(currentPage - 1); }} className="w-12 h-12 rounded-2xl hover:bg-red-500/10 text-red-900/40 hover:text-red-500"><Trash2 size={20} /></Button>
        </div>

        {/* Text settings popover */}
        <AnimatePresence>
          {showTextSettings && tool === "text" && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="w-56 border-r border-white/5 bg-[#111] p-4 space-y-4 shrink-0"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Text Format</p>
                <button onClick={() => setShowTextSettings(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
              </div>
              
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1.5">Font Size</label>
                <input 
                  type="range" min="8" max="72" value={fontSize} 
                  onChange={e => setFontSize(parseInt(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <span className="text-[11px] text-white font-mono">{fontSize}pt</span>
              </div>
              
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1.5">Color</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {TEXT_COLORS.map(c => (
                    <button 
                      key={c.name}
                      onClick={() => setTextColor(c)}
                      className={cn("w-7 h-7 rounded-lg border-2 transition-all hover:scale-110",
                        textColor.name === c.name ? "border-violet-400 scale-110" : "border-white/10"
                      )}
                      style={{ background: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto bg-[#0a0a0a] p-12 flex flex-col items-center custom-scrollbar scroll-smooth">
           <div className="relative group select-none" style={{ cursor: tool !== "none" ? "crosshair" : "default" }} onClick={handleCanvasClick}>
              <div className="relative shadow-[0_0_100px_rgba(0,0,0,1)] ring-1 ring-white/10 rounded-sm overflow-hidden bg-white">
                 <canvas ref={canvasRef} />
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ width: canvasRef.current?.width, height: canvasRef.current?.height }}>
                  <AnimatePresence>
                  {annotations.filter(a => a.page === currentPage).map(ann => (
                    <motion.div
                      key={ann.id}
                      drag
                      dragMomentum={false}
                      onDragEnd={(e, info) => {
                        updateAnnotation(ann.id, { x: ann.x + info.delta.x / zoom, y: ann.y + info.delta.y / zoom });
                      }}
                      className={cn("absolute pointer-events-auto group/ann cursor-move", activeAnnId === ann.id && "ring-2 ring-blue-500")}
                      style={{ left: ann.x * zoom, top: ann.y * zoom }}
                      onClick={(e) => { e.stopPropagation(); setActiveAnnId(ann.id); }}
                    >
                       {ann.type === "text" ? (
                         <input 
                           autoFocus={activeAnnId === ann.id} 
                           value={ann.content} 
                           onChange={(e) => updateAnnotation(ann.id, { content: e.target.value })} 
                           className="bg-transparent border-none outline-none font-bold p-1 m-0 whitespace-nowrap" 
                           style={{ 
                             fontSize: (ann.fontSize || 13) * zoom, 
                             color: ann.textColor || "#000",
                             fontStyle: ann.italic ? "italic" : "normal"
                           }} 
                         />
                       ) : ann.type === "comment" ? (
                         <div className="relative">
                           <button 
                             onClick={(e) => { e.stopPropagation(); setActiveComment(activeComment === ann.id ? null : ann.id); }}
                             className="w-8 h-8 rounded-full bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30 hover:scale-110 transition-transform"
                           >
                             <MessageSquare size={14} />
                           </button>
                           {activeComment === ann.id && (
                             <motion.div 
                               initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                               className="absolute left-10 top-0 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl p-3 shadow-2xl z-50"
                             >
                               <textarea
                                 autoFocus
                                 value={ann.content || ""}
                                 onChange={e => updateAnnotation(ann.id, { content: e.target.value })}
                                 placeholder="Add a comment..."
                                 className="w-full h-20 bg-white/5 border border-white/10 rounded-lg p-2 text-[12px] text-white placeholder:text-slate-600 outline-none resize-none"
                               />
                               <button 
                                 onClick={() => setActiveComment(null)}
                                 className="mt-2 text-[10px] text-cyan-400 font-bold uppercase tracking-widest hover:underline"
                               >
                                 Done
                               </button>
                             </motion.div>
                           )}
                         </div>
                       ) : (ann.type === "signature" || ann.type === "image") ? (
                         <div className="relative group/resize">
                            <img src={ann.src} style={{ width: (ann.width || 100) * zoom, height: (ann.height || 40) * zoom }} />
                             <div 
                               draggable 
                               onDrag={(e) => {
                                 if (e.clientX === 0) return;
                                 const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                 if (!rect) return;
                                 updateAnnotation(ann.id, { 
                                     width: (e.clientX - rect.left) / zoom,
                                     height: (e.clientY - rect.top) / zoom
                                 });
                               }}
                               className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-nwse-resize opacity-0 group-hover/resize:opacity-100 transition-opacity" 
                             />
                         </div>
                       ) : (
                         <div className="relative group/resize">
                            <div 
                              className={cn("border border-transparent px-1 py-1", 
                                ann.type === "highlight" ? "" : "bg-white border-slate-300 shadow-xl"
                              )} 
                              style={{ 
                                width: (ann.width || 0) * zoom, 
                                height: (ann.height || 0) * zoom,
                                background: ann.type === "highlight" ? (ann.color || "rgba(255, 255, 0, 0.35)") : undefined
                              }} 
                            />
                            <div 
                               draggable 
                               onDrag={(e) => {
                                 if (e.clientX === 0) return;
                                 const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                 if (!rect) return;
                                 updateAnnotation(ann.id, { 
                                     width: (e.clientX - rect.left) / zoom,
                                     height: (e.clientY - rect.top) / zoom
                                 });
                               }}
                               className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-nwse-resize opacity-0 group-hover/resize:opacity-100 transition-opacity" 
                            />
                         </div>
                       )}
                       <button onClick={(e) => { e.stopPropagation(); setAnnotations(annotations.filter(a => a.id !== ann.id)); }} className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover/ann:opacity-100 transition-opacity font-bold shadow-lg">×</button>
                    </motion.div>
                  ))}
                  </AnimatePresence>
              </div>
           </div>
           <div className="mt-12 flex items-center gap-6 bg-black/60 border border-white/5 px-6 py-3 rounded-[30px] backdrop-blur-xl shadow-2xl">
              <Button variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="rounded-full w-10 h-10 hover:bg-white/5 disabled:opacity-20"><ArrowLeft size={16}/></Button>
              <div className="flex flex-col items-center"><span className="text-[10px] font-black uppercase text-slate-500">Page</span><span className="text-white font-bold leading-none">{currentPage} <span className="opacity-20 mx-1">/</span> {numPages}</span></div>
              <Button variant="ghost" size="icon" disabled={currentPage === numPages} onClick={() => setCurrentPage(currentPage + 1)} className="rounded-full w-10 h-10 hover:bg-white/5 disabled:opacity-20"><ArrowRight size={16}/></Button>
           </div>
        </div>

        {/* Context Sidebar */}
        <div className="w-80 border-l border-white/5 bg-black/20 flex flex-col shrink-0">
           <div className="p-6 border-b border-white/5 flex items-center gap-2 text-emerald-400">
              <Sparkles size={14} /><h3 className="text-[10px] font-black uppercase tracking-widest text-white tracking-[0.2em]">Context Sidebar</h3>
           </div>
           <div className="flex-1 p-4 space-y-4 overflow-auto custom-scrollbar">
              {/* Active Layers */}
              <div className="space-y-3">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Active Layers ({annotations.filter(a => a.page === currentPage).length})</h4>
                 <div className="space-y-1.5">
                    {annotations.filter(a => a.page === currentPage).length === 0 && (
                        <div className="p-6 text-center border border-dashed border-white/5 rounded-2xl opacity-20">
                            <span className="text-[10px] font-bold uppercase tracking-widest">No active layers</span>
                        </div>
                    )}
                    {annotations.filter(a => a.page === currentPage).map(a => (
                       <div key={a.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/[0.07] transition-all cursor-pointer" onClick={() => setActiveAnnId(a.id)}>
                          <div className="flex items-center gap-3">
                             <div className={cn("w-1.5 h-1.5 rounded-full", 
                               a.type === 'text' ? 'bg-blue-400' : 
                               a.type === 'image' ? 'bg-emerald-400' : 
                               a.type === 'signature' ? 'bg-purple-400' : 
                               a.type === 'comment' ? 'bg-cyan-400' : 'bg-yellow-400'
                             )} />
                             <span className="text-[11px] font-bold text-slate-300 uppercase shrink-0">{a.type}</span>
                             {a.type === 'comment' && a.content && (
                               <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{a.content}</span>
                             )}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setAnnotations(annotations.filter(ann => ann.id !== a.id)); }} className="text-[10px] text-slate-500 hover:text-red-500 font-bold uppercase py-1 px-2">Remove</button>
                       </div>
                    ))}
                 </div>
              </div>
              
              {/* AI Result Display */}
              {aiResult && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-violet-400 flex items-center gap-1.5">
                      <Wand2 size={12} /> AI Result
                    </h4>
                    <button onClick={() => setAiResult(null)} className="text-slate-500 hover:text-white"><X size={12} /></button>
                  </div>
                  <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {aiResult}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(aiResult);
                      toast.success("Copied to clipboard");
                    }}
                    className="text-[10px] text-violet-400 font-bold uppercase tracking-widest hover:underline"
                  >
                    Copy Result
                  </button>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* AI Floating Toolbar */}
      <AnimatePresence>
        {showAiToolbar && selectedText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="ai-toolbar fixed z-[100] flex items-center gap-1 bg-[#1a1a1a] border border-white/10 rounded-2xl p-1.5 shadow-2xl shadow-black/50"
            style={{ left: aiToolbarPos.x - 120, top: aiToolbarPos.y - 50 }}
          >
            {aiLoading ? (
              <div className="px-4 py-2 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-violet-400" />
                <span className="text-[11px] text-slate-400">Processing...</span>
              </div>
            ) : (
              <>
                <button onClick={() => handleAiAction("rewrite")} className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white hover:bg-violet-500/20 transition-colors flex items-center gap-1.5">
                  <Wand2 size={12} className="text-violet-400" /> Rewrite
                </button>
                <button onClick={() => handleAiAction("summarize")} className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white hover:bg-blue-500/20 transition-colors flex items-center gap-1.5">
                  <BookOpen size={12} className="text-blue-400" /> Summarize
                </button>
                <button onClick={() => handleAiAction("explain")} className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5">
                  <Sparkles size={12} className="text-emerald-400" /> Explain
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Signature Modal */}
      <AnimatePresence>
      {isSigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
           <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} className="bg-[#0a0a0a] border border-white/10 rounded-[40px] w-full max-w-xl overflow-hidden shadow-[0_0_100px_rgba(168,85,247,0.1)]">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                 <div className="flex flex-col">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">Digital Fingerprint</h3>
                    <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Capture your authentic signature</span>
                 </div>
                 <Button variant="ghost" onClick={() => setIsSigning(false)} size="icon" className="hover:bg-white/5 text-slate-500 rounded-full h-10 w-10 text-xl flex items-center justify-center">×</Button>
              </div>
              <div className="p-10">
                 <div className="bg-white rounded-[30px] overflow-hidden shadow-[inset_0_2px_20px_rgba(0,0,0,0.1)] transition-transform hover:scale-[1.01]">
                    <canvas ref={sigCanvasRef} width={500} height={250} className="cursor-crosshair w-full h-[250px]" onMouseDown={(e) => {
                        const canvas = sigCanvasRef.current;
                        if (!canvas) return;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;
                        ctx.beginPath();
                        ctx.lineWidth = 3;
                        ctx.lineCap = 'round';
                        ctx.strokeStyle = '#111';
                        const rect = canvas.getBoundingClientRect();
                        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                        const handleMove = (ev: MouseEvent) => {
                          ctx.lineTo(ev.clientX - rect.left, ev.clientY - rect.top);
                          ctx.stroke();
                        };
                        const handleUp = () => {
                          window.removeEventListener('mousemove', handleMove);
                          window.removeEventListener('mouseup', handleUp);
                        };
                        window.addEventListener('mousemove', handleMove);
                        window.addEventListener('mouseup', handleUp);
                      }} />
                 </div>
                 <div className="mt-8 flex gap-4">
                    <Button onClick={() => { const ctx = sigCanvasRef.current?.getContext('2d'); ctx?.clearRect(0,0,600,600); }} variant="ghost" className="flex-1 rounded-2xl border border-white/5 text-slate-500 h-12 uppercase text-[10px] font-black tracking-widest hover:bg-white/5">Clear Canvas</Button>
                    <Button onClick={saveSignature} className="flex-[2] bg-white text-black hover:bg-slate-200 rounded-2xl h-12 uppercase text-[10px] font-black tracking-[0.2em]">Apply Signature</Button>
                 </div>
              </div>
           </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}

function ToolbarItem({ icon: Icon, label, active, onClick, color = "text-slate-400" }: any) {
  return (
    <div className="flex flex-col items-center gap-1 group">
       <Button 
         variant="ghost" 
         onClick={onClick}
         className={cn(
           "w-12 h-12 rounded-2xl transition-all duration-300",
           active ? "bg-white text-black shadow-lg shadow-white/10 scale-110" : "hover:bg-white/5 " + color
         )}
       >
         <Icon size={20} />
       </Button>
       <span className={cn("text-[9px] font-black uppercase tracking-tighter transition-opacity", active ? "opacity-100 text-white" : "opacity-0 group-hover:opacity-40 text-slate-400")}>{label}</span>
    </div>
  );
}
