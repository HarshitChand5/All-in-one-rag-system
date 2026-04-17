"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User } from "lucide-react";

export const Header = () => {
  const pathname = usePathname();

  const getPageTitle = () => {
    const segments: Record<string, string> = {
      dashboard: "Dashboard",
      documents: "Documents",
      chat: "AI Chat",
      insights: "Insights",
      settings: "Settings",
      profile: "Profile",
      "pdf-editor": "PDF Editor",
    };
    const path = pathname.split("/").filter(Boolean)[0];
    return segments[path || ""] || "Dashboard";
  };

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl sticky top-0 z-40">
      <h2 className="text-[15px] font-semibold text-white">
        {getPageTitle()}
      </h2>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] group focus-within:border-violet-500/40 transition-all">
          <Search size={13} className="text-[#86868b] group-focus-within:text-violet-400" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none outline-none text-[13px] text-white placeholder:text-[#48484a] w-40"
          />
        </div>

        <Link href="/profile" className="flex items-center">
          <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.12] transition-colors cursor-pointer">
            <User size={14} className="text-[#86868b]" />
          </div>
        </Link>
      </div>
    </header>
  );
};
