"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  FileText, 
  MessageSquare, 
  Zap, 
  Loader2, 
  ArrowRight,
  Activity,
  Layers
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { fadeUp, staggerContainer } from "@/lib/animations";
import { authApi } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const COLORS = ['#7c3aed', '#818cf8', '#a78bfa'];

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState([
    { title: "Documents", value: "0", icon: FileText, color: "text-violet-400" },
    { title: "Chat Sessions", value: "0", icon: MessageSquare, color: "text-indigo-400" },
    { title: "AI Queries", value: "0", icon: Zap, color: "text-purple-400" },
  ]);
  const [distribution, setDistribution] = useState<any[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getAuthToken = () => {
    return document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];
  };

  const fetchData = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token || token === "undefined") return;

      const data = await authApi.me(token) as any;
      
      setUser(data);
      setStats([
        { title: "Documents", value: data.doc_count?.toString() || "0", icon: FileText, color: "text-violet-400" },
        { title: "Chat Sessions", value: data.session_count?.toString() || "0", icon: MessageSquare, color: "text-indigo-400" },
        { title: "AI Queries", value: data.query_count?.toString() || "0", icon: Zap, color: "text-purple-400" },
      ]);
      
      const dist = Object.entries(data.distribution || {}).map(([name, value]) => ({
        name: name.toUpperCase(),
        value: value
      }));
      setDistribution(dist.length > 0 ? dist : [{ name: 'EMPTY', value: 1 }]);
      setTotalChunks(data.total_chunks || 0);
      setTrendData(data.activity_trend || []);
      
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
      // The global API interceptor will handle 401s
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !mounted) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
    </div>
  );

  return (
    <motion.div 
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto pb-20"
    >
      {/* Welcome */}
      <motion.section variants={fadeUp}>
        <h1 className="text-3xl font-semibold text-white mb-1">
          Welcome back, {user?.full_name?.split(' ')[0] || "there"}
        </h1>
        <p className="text-[#86868b] text-[15px]">
          Here's an overview of your research workspace.
        </p>
        <div className="flex gap-3 mt-5">
          <Link href="/chat" className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors">
            Start Research <ArrowRight size={14} />
          </Link>
          <Link href="/documents" className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08] rounded-lg text-[13px] font-medium transition-colors">
            Upload Documents
          </Link>
        </div>
      </motion.section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <motion.div 
            variants={fadeUp}
            key={stat.title} 
            className="apple-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-9 w-9 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <stat.icon className={`h-[18px] w-[18px] ${stat.color}`} />
              </div>
            </div>
            <p className="text-[13px] text-[#86868b] mb-1">{stat.title}</p>
            <div className="text-2xl font-semibold text-white">{stat.value}</div>
          </motion.div>
        ))}
      </section>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Chart */}
        <motion.div variants={fadeUp} className="lg:col-span-2 apple-card p-5 h-[350px] flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[15px] font-semibold text-white">Activity</h3>
              <p className="text-[13px] text-[#86868b]">Queries over the last 7 days</p>
            </div>
            <Activity className="h-4 w-4 text-[#86868b]" />
          </div>
          <div className="flex-1 w-full">
            {trendData.some(d => d.queries > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#86868b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#86868b', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1d1d1f', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '13px',
                      color: '#f5f5f7'
                    }} 
                  />
                  <Area type="monotone" dataKey="queries" stroke="#7c3aed" strokeWidth={2} fillOpacity={1} fill="url(#colorQueries)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center">
                <Activity size={24} className="text-[#48484a] mb-3" />
                <p className="text-[#86868b] text-[13px] mb-1">No activity yet</p>
                <p className="text-[#48484a] text-[12px]">Start a chat session to see trends here.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Distribution */}
        <motion.div variants={fadeUp} className="apple-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-semibold text-white">Knowledge Base</h3>
            <Layers className="h-4 w-4 text-[#86868b]" />
          </div>
          <div className="flex-1 min-h-[200px] relative">
            {distribution.some(d => d.value > 0 && d.name !== 'EMPTY') ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribution} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                      {distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-semibold text-white">{totalChunks}</span>
                  <span className="text-[11px] text-[#86868b]">chunks</span>
                </div>
              </>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center">
                <Layers size={24} className="text-[#48484a] mb-3" />
                <p className="text-[#86868b] text-[13px] mb-1">No documents</p>
                <p className="text-[#48484a] text-[12px]">Upload files to build your knowledge base.</p>
              </div>
            )}
          </div>
          <div className="space-y-2 mt-3">
            {distribution.filter(d => d.value > 0 && d.name !== 'EMPTY').map((item, i) => {
              const total = distribution.reduce((acc, curr) => acc + (curr.value as number), 0);
              const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[#a1a1a6]">{item.name}</span>
                  </div>
                  <span className="text-white font-medium">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
