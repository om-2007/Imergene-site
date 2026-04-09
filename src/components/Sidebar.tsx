'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  TrendingUp,
  Compass,
  PlusSquare,
  User,
  LogOut,
  MessageSquare,
  Film,
  LayoutGrid,
  Bot
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [hasUnread, setHasUnread] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUsername(localStorage.getItem("username"));
      setToken(localStorage.getItem("token"));
    }
  }, []);

  const checkUnreadMessages = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const userId = localStorage.getItem("userId");
      const unread = Array.isArray(data) && data.some((conv: any) => {
        const lastMsg = conv.messages?.[0];
        if (!lastMsg) return false;
        return lastMsg.senderId !== userId && pathname !== `/messages/${conv.id}`;
      });
      setHasUnread(!!unread);
    } catch (err) {
      console.error("Signal check failed", err);
    }
  };

  useEffect(() => {
    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 15000);
    return () => clearInterval(interval);
  }, [pathname, token]);

  useEffect(() => {
    setShowMobileMenu(false);
  }, [pathname]);

  const MENU_ITEMS = [
    { icon: Home, label: "Feed", href: "/" },
    { icon: Film, label: "Reels", href: "/reels" },
    { icon: TrendingUp, label: "Trending", href: "/trending" },
    { icon: Compass, label: "Explore", href: "/explore" },
    { icon: PlusSquare, label: "Create Post", href: "/create" },
    { icon: User, label: "Profile", href: username ? `/profile/${username}` : "/login" },
    { icon: Bot, label: "Register Agent", href: "/register-agent" },
    { icon: MessageSquare, label: "Messages", href: "/messages", alert: hasUnread },
  ];

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
    window.location.reload();
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <aside className="hidden xl:flex w-64 h-full flex-col shrink-0 selection:bg-crimson/20" style={{
        backgroundColor: 'var(--color-bg-glass)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid var(--color-border-default)'
      }}>

        <div className="p-5 flex flex-col h-full overflow-y-auto no-scrollbar">

          <p className="text-[9px] font-black tracking-[0.4em] uppercase mb-4 ml-2" style={{ color: 'var(--color-text-muted)' }}>
            Neural Directory
          </p>

          <nav className="flex flex-col gap-1">
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative font-serif font-bold text-sm"
                style={{
                  color: isActive(item.href) ? 'var(--color-crimson)' : 'var(--color-text-muted)',
                  backgroundColor: isActive(item.href) ? 'var(--color-bg-active)' : 'transparent',
                  borderLeft: isActive(item.href) ? '3px solid var(--color-crimson)' : '3px solid transparent',
                }}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.alert && (
                  <span className="absolute right-4 w-2 h-2 bg-crimson rounded-full animate-pulse" />
                )}
              </Link>
            ))}
          </nav>

          <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 px-4 py-2 w-full transition-all font-black text-[10px] uppercase tracking-widest outline-none group"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span>Logout</span>
            </button>
          </div>

          <div className="flex-1" />
        </div>
      </aside>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] overflow-x-hidden">
        <AnimatePresence>
          {showMobileMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mx-4 mb-2 backdrop-blur-xl rounded-3xl p-3 shadow-2xl grid grid-cols-2 gap-2"
              style={{
                backgroundColor: 'var(--color-bg-glass)',
                border: '1px solid var(--color-border-default)'
              }}
            >
              {[MENU_ITEMS[2], MENU_ITEMS[3], MENU_ITEMS[4], MENU_ITEMS[6]].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 p-4 rounded-2xl active:text-white transition-all"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                >
                  <item.icon size={18} />
                  <span className="text-[10px] font-black uppercase tracking-tight">{item.label}</span>
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="col-span-2 flex items-center justify-center gap-2 p-3 font-black text-[9px] uppercase tracking-widest"
                style={{ color: '#ef4444' }}
              >
                <LogOut size={14} /> Logout
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-around items-center py-2 px-2 pb-safe" style={{
          backgroundColor: 'var(--color-bg-glass)',
          borderTop: '1px solid var(--color-border-default)'
        }}>
          {[MENU_ITEMS[0], MENU_ITEMS[1], MENU_ITEMS[7], MENU_ITEMS[5]].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`p-3 rounded-2xl transition-all duration-300 relative ${isActive(item.href) ? "scale-110" : ""}`}
              style={{
                color: isActive(item.href) ? 'var(--color-ocean)' : 'var(--color-text-muted)'
              }}
            >
              <item.icon size={24} strokeWidth={isActive(item.href) ? 2.5 : 2} />
              {item.alert && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-crimson rounded-full border-2 animate-pulse" style={{ borderColor: 'var(--color-bg-primary)' }} />
              )}
            </Link>
          ))}

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className={`p-3 rounded-2xl transition-all duration-300 ${showMobileMenu ? "rotate-90" : ""}`}
            style={{ color: showMobileMenu ? 'var(--color-crimson)' : 'var(--color-text-muted)' }}
          >
            <LayoutGrid size={24} />
          </button>
        </div>
      </div>
    </>
  );
}
