"use client";

import React from "react";
import { motion } from "framer-motion";

export const Sparkles = ({ className }: { className?: string }) => {
  return (
    <div className={className}>
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        ✨
      </motion.div>
    </div>
  );
};
