"use client";

import { cn } from "@/lib/utils";
import { Bot, User, Volume2, VolumeX, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface MessageBubbleProps {
  message: { id: string; role: "user" | "assistant"; content: string; sources?: any[]; created_at: string };
  onSourceClick?: (title: string) => void;
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
}

export function MessageBubble({ message, onSourceClick, onSpeak, isSpeaking, onStopSpeaking }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3 py-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot size={14} className="text-violet-400" />
        </div>
      )}

      <div className={cn("max-w-[75%] group", isUser && "order-first")}>
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-[14px] leading-relaxed",
            isUser
              ? "bg-violet-600 text-white rounded-br-sm"
              : "bg-white/[0.04] border border-white/[0.06] text-[#e5e5ea] rounded-bl-sm"
          )}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Action buttons for assistant messages */}
        {!isUser && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* TTS Button */}
            {onSpeak && (
              <button
                onClick={() => isSpeaking ? onStopSpeaking?.() : onSpeak(message.content)}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  isSpeaking
                    ? "bg-violet-500/20 text-violet-400"
                    : "text-[#48484a] hover:text-white hover:bg-white/[0.06]"
                )}
                title={isSpeaking ? "Stop speaking" : "Read aloud"}
              >
                {isSpeaking ? (
                  <div className="flex items-center gap-1">
                    <VolumeX size={12} />
                    {/* Mini waveform animation */}
                    <div className="flex items-center gap-[2px]">
                      {[1, 2, 3].map(i => (
                        <div 
                          key={i}
                          className="w-[2px] bg-violet-400 rounded-full animate-pulse"
                          style={{ 
                            height: `${6 + Math.random() * 6}px`,
                            animationDelay: `${i * 0.15}s`
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <Volume2 size={12} />
                )}
              </button>
            )}
            
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md text-[#48484a] hover:text-white hover:bg-white/[0.06] transition-all"
              title="Copy"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.sources.map((source: any, i: number) => (
              <button
                key={i}
                onClick={() => onSourceClick?.(source.title)}
                className="text-[10px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/10 hover:bg-violet-500/20 transition-colors"
              >
                {source.title} {source.page && `p.${source.page}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-1">
          <User size={14} className="text-[#86868b]" />
        </div>
      )}
    </motion.div>
  );
}
