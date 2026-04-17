"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const suggestions = [
  "Summarize this document",
  "What are the key findings?",
  "Explain the main concepts",
  "Compare with other documents"
];

interface SmartSuggestionsProps {
  onSelect: (suggestion: string) => void;
  visible: boolean;
}

export const SmartSuggestions = ({ onSelect, visible }: SmartSuggestionsProps) => {
  if (!visible) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {suggestions.map((suggestion, i) => (
        <motion.button
          key={suggestion}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onSelect(suggestion)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-[#86868b] hover:text-white hover:border-violet-500/20 hover:bg-violet-500/5 transition-all"
        >
          {suggestion}
          <ArrowRight size={10} className="opacity-0 group-hover:opacity-100" />
        </motion.button>
      ))}
    </div>
  );
};
