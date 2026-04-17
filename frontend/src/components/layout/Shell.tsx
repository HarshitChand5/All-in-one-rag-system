"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MeshBackground } from "../ui/premium/MeshBackground";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export const Shell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname === "/";

  if (isAuthPage) {
    return (
      <div className="h-screen overflow-y-auto custom-scrollbar relative">
        <MeshBackground />
        <div className="relative z-10">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-black">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
