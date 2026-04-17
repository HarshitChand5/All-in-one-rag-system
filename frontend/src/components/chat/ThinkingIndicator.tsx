"use client";

import { motion } from "framer-motion";
import { Loader2, Search, BrainCircuit, Database } from "lucide-react";

export type ThinkingState = "analyzing" | "searching" | "generating" | null;

interface ThinkingIndicatorProps {
  state: ThinkingState;
}

export const ThinkingIndicator = ({ state }: ThinkingIndicatorProps) => {
  if (!state) return null;

  const states = {
    analyzing: { icon: BrainCircuit, text: "Analyzing context...", color: "text-violet-400" },
    searching: { icon: Database, text: "Searching documents...", color: "text-indigo-400" },
    generating: { icon: Search, text: "Generating response...", color: "text-purple-400" }
  };

  const current = states[state];
  const Icon = current.icon;

  return (
    <div className="flex justify-start mb-4">
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 flex items-center gap-2"
      >
        <Loader2 className={`w-3.5 h-3.5 ${current.color} animate-spin`} />
        <span className="text-[13px] text-[#86868b]">{current.text}</span>
      </motion.div>
    </div>
  );
};
