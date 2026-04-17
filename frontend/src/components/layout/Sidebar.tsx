"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { authApi } from "@/lib/api";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  PieChart,
  FileEdit,
  LogOut,
  ImageIcon,
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "Documents", href: "/documents" },
  { icon: Briefcase, label: "Resume Analyzer", href: "/resume" },
  { icon: FileEdit, label: "PDF Editor", href: "/pdf-editor" },
  { icon: MessageSquare, label: "AI Chat", href: "/chat" },
  { icon: ImageIcon, label: "Images", href: "/images" },
  { icon: PieChart, label: "Insights", href: "/insights" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("");
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      try {
        const token = document.cookie.match(/(?:^|; )auth_token=([^;]+)/)?.[1];
        if (!token || token === "undefined") return;
        
        const data = await authApi.me(token) as any;
        setUserName(data.full_name || data.email?.split("@")[0] || "User");
      } catch (err) { 
        console.error("Sidebar user fetch failed", err);
        // api.ts wrapper handles 401s
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    // Clear cookies accurately on client side as fallback
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    
    // Call server action to guarantee deletion
    try {
      const { logout } = await import("@/app/login/actions");
      logout().finally(() => {
        window.location.replace("/login");
      });
    } catch (err) {
      window.location.replace("/login");
    }
  };

  const nameToDisplay = mounted ? (userName || "User") : "User";
  const initials = nameToDisplay.charAt(0).toUpperCase();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      className={cn(
        "relative flex flex-col h-screen border-r border-white/[0.06] bg-[#0d0d0d] transition-all duration-300 z-50",
        collapsed ? "items-center" : "items-start"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 w-full overflow-hidden border-b border-white/[0.06]">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">D</span>
        </div>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-semibold text-[15px] text-white"
          >
            DocuRAG
          </motion.span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 w-full px-3 py-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-[#86868b] hover:text-white hover:bg-white/[0.04]"
              )}>
                <item.icon className={cn(
                  "w-[18px] h-[18px] flex-shrink-0",
                  isActive && "text-violet-400"
                )} />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[13px] font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute bottom-20 -right-3 w-6 h-6 rounded-full bg-[#1d1d1f] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-violet-600 transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Bottom Profile */}
      <div className="w-full border-t border-white/[0.06] p-3">
        <Link href="/profile">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer",
            collapsed && "justify-center"
          )}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex-shrink-0 flex items-center justify-center text-[11px] font-semibold text-white">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[13px] font-medium text-white truncate">{nameToDisplay}</span>
              </div>
            )}
          </div>
        </Link>
        {!collapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#86868b] hover:text-red-400 hover:bg-red-500/5 transition-colors mt-1"
          >
            <LogOut size={16} />
            <span className="text-[13px] font-medium">Sign Out</span>
          </button>
        )}
      </div>
    </motion.aside>
  );
};
