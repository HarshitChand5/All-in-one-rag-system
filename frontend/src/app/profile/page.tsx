"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Calendar, Camera, Sparkles, Database, MessageSquare, Zap, LogOut, Loader2, Save, X, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer, scaleIn } from "@/lib/animations";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];
        const response = await fetch(`${API_URL}/api/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
        if (response.ok) setUser(await response.json());
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  const handleSave = async () => {
    if (!tempName.trim()) return;
    setSaving(true);
    try {
      const token = document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: tempName })
      });
      if (response.ok) {
        const data = await response.json();
        setUser((prev: any) => ({ ...prev, full_name: data.full_name }));
        setIsEditing(false);
      }
    } catch (error) { console.error(error); } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
    </div>
  );

  return (
    <motion.div 
      initial="hidden" animate="show" variants={staggerContainer}
      className="max-w-3xl mx-auto px-6 py-8 space-y-8 pb-20"
    >
      {/* Profile Header */}
      <motion.div variants={fadeUp} className="apple-card p-8 flex items-center gap-6">
        <div className="relative">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <User className="h-10 w-10 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="text-2xl font-semibold bg-white/[0.06] border border-white/[0.1] text-white rounded-lg px-3 py-1 outline-none focus:border-violet-500/40 transition-all flex-1"
                autoFocus
              />
              <button onClick={handleSave} disabled={saving} className="p-2 bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={18} className="animate-spin text-white" /> : <Save size={18} className="text-white" />}
              </button>
              <button onClick={() => setIsEditing(false)} className="p-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors">
                <X size={18} className="text-white" />
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-white">{user?.full_name || "User"}</h1>
              <p className="text-[14px] text-[#86868b] mt-0.5">{user?.email}</p>
            </>
          )}
        </div>
        <button 
          onClick={() => { if (!isEditing) setTempName(user?.full_name || ""); setIsEditing(!isEditing); }}
          className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg text-[13px] font-medium text-white border border-white/[0.08] transition-all"
        >
          {isEditing ? "Cancel" : "Edit Profile"}
        </button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-4">
        {[
          { label: "Documents", value: user?.doc_count || 0, icon: Database, color: "text-violet-400" },
          { label: "Sessions", value: user?.session_count || 0, icon: MessageSquare, color: "text-indigo-400" },
          { label: "AI Queries", value: user?.query_count || 0, icon: Zap, color: "text-purple-400" }
        ].map((stat, i) => (
          <div key={i} className="apple-card p-5 text-center">
            <div className="text-2xl font-semibold text-white mb-1">{stat.value}</div>
            <div className="flex items-center justify-center gap-1.5 text-[12px] text-[#86868b]">
              <stat.icon size={12} className={stat.color} />
              {stat.label}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Info Card */}
      <motion.div variants={fadeUp} className="apple-card p-6 space-y-5">
        <h3 className="text-[15px] font-semibold text-white">Account Details</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[12px] text-[#86868b]">Email</label>
            <div className="flex items-center gap-2 text-[14px] text-white">
              <Mail className="h-4 w-4 text-[#86868b]" />
              {user?.email || "—"}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-[#86868b]">Status</label>
            <div className="flex items-center gap-2 text-[14px] text-emerald-400">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-[#86868b]">Vector Store</label>
            <div className="text-[14px] text-white flex items-center gap-1">pgvector (Cloud)</div>
          </div>
          <div className="space-y-1">
            <label className="text-[12px] text-[#86868b]">Database</label>
            <div className="text-[14px] text-white flex items-center gap-1">PostgreSQL (Supabase)</div>
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div variants={fadeUp} className="apple-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-violet-400" />
          <div>
            <h3 className="text-[15px] font-semibold text-white">Security</h3>
            <p className="text-[13px] text-[#86868b]">We partner with Google Gemini to process your documents securely. Your data is stored in isolated Supabase cloud instances.</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/15 rounded-lg text-[13px] font-medium text-red-400 border border-red-500/20 flex items-center justify-center gap-2 transition-all"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </motion.div>
    </motion.div>
  );
}
