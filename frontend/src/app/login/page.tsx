"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { scaleIn } from "@/lib/animations";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setLoading(true);
    try {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else if (result?.success) {
        router.push("/dashboard");
      }
    } catch (e) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#000000]">
      <motion.div
        variants={scaleIn}
        initial="hidden"
        animate="show"
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center mb-4">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
          <p className="text-[#86868b] text-[14px] mt-1">Sign in to your account</p>
        </div>

        <div className="bg-[#1d1d1f] border border-white/10 rounded-2xl p-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-400 flex items-center gap-2"
            >
              <AlertCircle size={14} />
              {error}
            </motion.div>
          )}

          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[12px] text-[#86868b] uppercase tracking-wider font-semibold">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="h-11 bg-white/[0.05] border-white/5 rounded-xl px-4 text-white placeholder:text-[#48484a] outline-none focus:border-violet-500/40 transition-all"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-[12px] text-[#86868b] uppercase tracking-wider font-semibold">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="h-11 bg-white/[0.05] border-white/5 rounded-xl px-4 text-white outline-none focus:border-violet-500/40 transition-all"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium text-[15px] transition-all mt-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <span className="text-[13px] text-[#86868b]">
              Don't have an account?{" "}
              <Link href="/signup" className="text-violet-400 hover:underline">
                Register now
              </Link>
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
