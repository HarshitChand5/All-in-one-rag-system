"use client";

import { useState } from "react";
import { Settings, Key, Database, Bell, Lock, Monitor, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", name: "General", icon: Monitor, desc: "Theme & Display" },
    { id: "api", name: "AI Model", icon: Cpu, desc: "API Configuration" },
    { id: "security", name: "Security", icon: Lock, desc: "Privacy & Access" },
    { id: "storage", name: "Storage", icon: Database, desc: "Vector Store" },
  ];

  return (
    <motion.div 
      initial="hidden" animate="show" variants={staggerContainer}
      className="max-w-5xl mx-auto px-6 py-8 space-y-8 pb-20"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-3xl font-semibold text-white mb-1">Settings</h1>
        <p className="text-[#86868b] text-[15px]">Configure your workspace preferences.</p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Tabs */}
        <motion.div variants={fadeUp} className="lg:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                activeTab === tab.id 
                  ? "bg-white/[0.08] text-white" 
                  : "text-[#86868b] hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <tab.icon size={18} className={activeTab === tab.id ? "text-violet-400" : ""} />
              <div className="flex flex-col items-start text-left">
                <span className="text-[13px] font-medium">{tab.name}</span>
                <span className="text-[11px] text-[#48484a]">{tab.desc}</span>
              </div>
            </button>
          ))}
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 space-y-6"
          >
            {activeTab === "general" && (
              <div className="space-y-6">
                <div className="apple-card p-6">
                  <h3 className="text-[15px] font-semibold text-white mb-6">Display</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] text-white">Theme</p>
                        <p className="text-[13px] text-[#86868b]">Choose your interface appearance</p>
                      </div>
                      <div className="flex bg-white/[0.04] rounded-lg border border-white/[0.06] p-1">
                        <button className="px-4 py-1.5 bg-violet-600 rounded-md text-[12px] font-medium text-white">Dark</button>
                        <button className="px-4 py-1.5 text-[12px] text-[#86868b] hover:text-white transition-colors">Light</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] text-white">Animations</p>
                        <p className="text-[13px] text-[#86868b]">Enable interface animations</p>
                      </div>
                      <div className="h-6 w-10 bg-violet-600 rounded-full relative cursor-pointer p-0.5">
                        <div className="absolute right-0.5 top-0.5 h-5 w-5 bg-white rounded-full shadow" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="apple-card p-6">
                  <h3 className="text-[15px] font-semibold text-white mb-6">Notifications</h3>
                  <div className="space-y-3">
                    {[
                      { name: "Document indexed", desc: "When processing completes" },
                      { name: "Error alerts", desc: "AI generation failures" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div>
                          <p className="text-[13px] text-white">{item.name}</p>
                          <p className="text-[11px] text-[#48484a]">{item.desc}</p>
                        </div>
                        <div className="h-5 w-8 bg-violet-600 rounded-full relative p-0.5 cursor-pointer">
                          <div className="absolute right-0.5 top-0.5 h-4 w-4 bg-white rounded-full shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "api" && (
              <div className="apple-card p-6">
                <h3 className="text-[15px] font-semibold text-white mb-2">AI Model Configuration</h3>
                <p className="text-[13px] text-[#86868b] mb-6">Manage the API keys used for document analysis and chat.</p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-[#86868b]">Gemini API Key</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#48484a] font-mono">
                        ••••••••••••••••••••••••
                      </div>
                      <button className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-[12px] font-medium text-white transition-colors">
                        Update
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] text-[#86868b]">Groq API Key (Fallback)</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-2.5 text-[13px] text-[#48484a] font-mono">
                        ••••••••••••••••••••••••
                      </div>
                      <button className="px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg text-[12px] font-medium text-white border border-white/[0.06] transition-colors">
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "storage" && (
              <div className="apple-card p-8 text-center">
                <Database size={32} className="text-violet-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Vector Store</h3>
                <p className="text-[13px] text-[#86868b] max-w-sm mx-auto mb-6">
                  Your documents are indexed using FAISS for fast semantic search on your local machine.
                </p>
                <div className="flex gap-3 justify-center">
                  <button className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg text-[12px] font-medium text-white border border-white/[0.06] transition-colors">
                    Export Index
                  </button>
                  <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/15 rounded-lg text-[12px] font-medium text-red-400 border border-red-500/20 transition-colors">
                    Clear All Data
                  </button>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="apple-card p-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white mb-1">Local Processing</h3>
                    <p className="text-[13px] text-[#86868b] leading-relaxed mb-4">
                      All document text extraction and vector indexing happens locally. Only chat queries are sent to the AI model API. Your raw documents are never uploaded to external servers.
                    </p>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[12px] text-emerald-400 font-medium">All systems secure</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
