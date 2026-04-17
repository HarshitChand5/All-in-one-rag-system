"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Search, Shield, Sparkles, Cpu, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/animations";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-black overflow-y-auto">
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-12 items-center justify-between px-6 lg:px-12">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">D</span>
            </div>
            <span className="font-semibold text-[15px] text-white">DocuRAG</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-[#86868b]">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#security" className="hover:text-white transition-colors">Security</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[13px] text-[#86868b] hover:text-white transition-colors px-3">
              Sign In
            </Link>
            <Link href="/signup">
              <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-full h-8 px-4 text-[13px] font-medium">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {/* Hero */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/8 blur-[150px] rounded-full pointer-events-none" />
          
          <div className="container mx-auto px-6 lg:px-12 text-center relative">
            <motion.div 
              initial="hidden"
              animate="show"
              variants={staggerContainer}
              className="mx-auto max-w-4xl"
            >
              <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl lg:text-[80px] font-semibold tracking-tight text-white mb-6 leading-[1.05]">
                Document
                <br />
                <span className="premium-gradient-text">Intelligence.</span>
              </motion.h1>
              
              <motion.p variants={fadeUp} className="text-lg md:text-xl text-[#86868b] mb-10 max-w-2xl mx-auto leading-relaxed">
                Upload your documents. Ask questions. Get precise, source-backed answers powered by advanced RAG technology.
              </motion.p>
              
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/signup">
                  <Button className="h-12 px-8 bg-white text-black hover:bg-white/90 rounded-full font-medium text-[15px] gap-2 transition-all">
                    Start Free <ArrowRight size={16} />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button className="h-12 px-8 bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.1] rounded-full font-medium text-[15px] transition-all">
                    Sign In
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 relative">
          <div className="container mx-auto px-6 lg:px-12">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">Built for deep research.</h2>
              <p className="text-[#86868b] text-lg max-w-lg mx-auto">Every feature designed to help you understand your documents better.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                {
                  icon: Cpu,
                  title: "Semantic Search",
                  description: "Documents are split into chunks and embedded locally using FAISS. Every query finds the most relevant context."
                },
                {
                  icon: Zap,
                  title: "Instant Indexing",
                  description: "Upload a PDF and it's indexed in seconds. Multi-threaded extraction with OCR fallback for scanned pages."
                },
                {
                  icon: Search,
                  title: "Cited Answers",
                  description: "Every AI response links back to the exact source document and page. No hallucinations, just facts."
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="p-8 rounded-2xl apple-card group"
                >
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-5 group-hover:bg-violet-500/15 transition-colors">
                    <feature.icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-[#86868b] text-[15px] leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Security Banner */}
        <section id="security" className="py-20">
          <div className="container mx-auto px-6 lg:px-12">
            <div className="max-w-3xl mx-auto apple-card p-10 md:p-14 text-center">
              <Shield className="h-10 w-10 text-violet-400 mx-auto mb-6" />
              <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">Your data stays local.</h2>
              <p className="text-[#86868b] text-[15px] leading-relaxed max-w-lg mx-auto">
                All document processing happens on your machine. FAISS indices are stored locally. 
                Only the final query is sent to the AI model — your raw documents never leave your device.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="container mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[13px] text-[#48484a]">
            © {new Date().getFullYear()} DocuRAG
          </span>
          <div className="flex gap-6">
            <Link href="#" className="text-[13px] text-[#48484a] hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="text-[13px] text-[#48484a] hover:text-white transition-colors">Terms</Link>
            <Link href="https://github.com" className="text-[13px] text-[#48484a] hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
