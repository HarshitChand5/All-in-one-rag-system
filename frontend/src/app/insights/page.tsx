"use client";

import { useState, useEffect, useCallback } from "react";
import { Layers, Zap, CheckCircle2, FileText, MessageSquare, ImageIcon, Activity, TrendingUp, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface InsightsData {
  total_documents: number;
  ready_documents: number;
  processing_documents: number;
  error_documents: number;
  total_chunks: number;
  total_sessions: number;
  total_messages: number;
  user_queries: number;
  ai_responses: number;
  total_images: number;
  index_coverage: number;
  success_rate: number;
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const token = document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];
      if (!token) return;
      const response = await fetch(`${API_URL}/api/insights`, { headers: { "Authorization": `Bearer ${token}` } });
      if (response.ok) setData(await response.json());
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="h-6 w-6 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-full text-[#86868b] text-sm">
      Failed to load insights.
    </div>
  );

  const stats = [
    { title: "Documents", value: data.total_documents, icon: FileText, color: "text-violet-400" },
    { title: "Indexed Chunks", value: data.total_chunks.toLocaleString(), icon: Layers, color: "text-indigo-400" },
    { title: "AI Queries", value: data.user_queries, icon: Zap, color: "text-emerald-400" },
    { title: "Chat Sessions", value: data.total_sessions, icon: MessageSquare, color: "text-purple-400" },
  ];

  const throughputPct = data.total_documents > 0
    ? Math.round((data.ready_documents / data.total_documents) * 100)
    : 0;
  const circumference = 2 * Math.PI * 42; // r=42
  const strokeDash = (throughputPct / 100) * circumference;

  const healthLabel = throughputPct >= 80 ? "Healthy" : throughputPct >= 50 ? "Moderate" : throughputPct > 0 ? "Needs Attention" : "No Data";
  const healthColor = throughputPct >= 80 ? "text-emerald-400" : throughputPct >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <motion.div 
      initial="hidden" animate="show" variants={staggerContainer}
      className="px-6 lg:px-8 py-8 space-y-8 max-w-5xl mx-auto pb-20"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-3xl font-semibold text-white mb-1">Insights</h1>
        <p className="text-[#86868b] text-[15px]">Real-time performance metrics and usage analytics.</p>
      </motion.div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <motion.div variants={fadeUp} key={stat.title} className="apple-card p-5">
            <div className="h-9 w-9 rounded-lg bg-white/[0.06] flex items-center justify-center mb-4">
              <stat.icon className={`h-[18px] w-[18px] ${stat.color}`} />
            </div>
            <p className="text-2xl font-semibold text-white mb-0.5">{stat.value}</p>
            <p className="text-[12px] text-[#86868b]">{stat.title}</p>
          </motion.div>
        ))}
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={fadeUp} className="lg:col-span-2 apple-card p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-[15px] font-semibold text-white">Workspace Breakdown</h3>
              <p className="text-[13px] text-[#86868b]">Actual usage across features</p>
            </div>
            <Activity className="h-4 w-4 text-[#86868b]" />
          </div>
          
          <div className="space-y-8">
            {/* Index Coverage */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-[#a1a1a6]">Index Coverage</span>
                <span className="text-[15px] font-semibold text-white">{data.index_coverage}%</span>
              </div>
              <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${data.index_coverage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-violet-500" 
                />
              </div>
              <p className="text-[11px] text-[#48484a]">{data.ready_documents} of {data.total_documents} documents indexed</p>
            </div>

            {/* Success Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-[#a1a1a6]">Processing Success Rate</span>
                <span className="text-[15px] font-semibold text-white">{data.success_rate}%</span>
              </div>
              <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${data.success_rate}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                  className="h-full rounded-full bg-emerald-500" 
                />
              </div>
              <p className="text-[11px] text-[#48484a]">{data.error_documents} document{data.error_documents !== 1 ? 's' : ''} with errors</p>
            </div>

            {/* Chat Activity */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] text-[#a1a1a6]">Chat Activity</span>
                <span className="text-[15px] font-semibold text-white">{data.total_messages} messages</span>
              </div>
              <div className="flex gap-3 mt-1">
                <div className="flex items-center gap-1.5 text-[12px] text-[#86868b]">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  {data.user_queries} questions
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-[#86868b]">
                  <div className="w-2 h-2 rounded-full bg-violet-400" />
                  {data.ai_responses} responses
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-[#86868b]">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  {data.total_images} images
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Throughput Ring */}
        <motion.div variants={fadeUp} className="apple-card p-6 flex flex-col">
          <h3 className="text-[15px] font-semibold text-white mb-2">Document Readiness</h3>
          <p className="text-[13px] text-[#86868b] mb-6">Percentage of docs ready for querying</p>
          
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative h-32 w-32 mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                <motion.circle 
                  cx="50" cy="50" r="42" fill="none" stroke="#7c3aed" strokeWidth="8" strokeLinecap="round"
                  initial={{ strokeDasharray: `0 ${circumference}` }}
                  animate={{ strokeDasharray: `${strokeDash} ${circumference}` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold text-white">{throughputPct}%</span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 text-[12px] ${healthColor}`}>
              {throughputPct >= 50 ? <TrendingUp size={12} /> : <AlertCircle size={12} />}
              {healthLabel}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
