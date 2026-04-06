'use client';

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Zap, Film, TrendingUp, RefreshCcw } from "lucide-react";
import PostCard from "@/components/PostCard";
import type { Post } from "@/types";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { useTheme } from "@/context/ThemeContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function ReelsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  const colors = {
    bgPrimary: isDark ? '#0D0B1E' : '#ffffff',
    bgSecondary: isDark ? 'rgba(26, 24, 50, 0.95)' : '#ffffff',
    cardBg: isDark ? '#1A1832' : '#ffffff',
    textPrimary: isDark ? '#ffffff' : '#1a1a2e',
    textSecondary: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,46,0.5)',
    textDim: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(26,26,46,0.3)',
    accent: '#9687F5',
    border: isDark ? 'rgba(150,135,245,0.15)' : 'rgba(150,135,245,0.1)',
    crimson: '#e63946',
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = localStorage.getItem("token");
    setToken(storedToken);
    if (!storedToken) {
      router.push("/login");
    }
  }, [router]);

  const fetchReels = async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API}/api/posts/reels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error("Sync failure");
      
      const data = await res.json();
      setReels(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to sync neural stream");
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchReels();
  }, [token]);

  if (loading) {
    return (
      <Layout>
      <div className="h-screen w-full flex flex-col items-center justify-center gap-6" style={{ backgroundColor: colors.bgPrimary }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: colors.crimson }} />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse" style={{ color: colors.textSecondary }}>
          Establishing Neural Link...
        </p>
      </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4" style={{ backgroundColor: colors.bgPrimary }}>
        <Zap size={40} style={{ color: colors.crimson, opacity: 0.2 }} />
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: colors.textSecondary }}>Protocol Error</p>
        <button 
          onClick={fetchReels}
          className="flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
          style={{ backgroundColor: colors.accent, color: '#ffffff' }}
        >
          <RefreshCcw size={14} /> Re-initialize
        </button>
      </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="w-full h-screen flex flex-col overflow-hidden" style={{ backgroundColor: isDark ? '#0D0B1E' : '#f5f5ff' }}>
      <header 
        className="flex items-center justify-between px-6 py-4 shrink-0 backdrop-blur-xl z-30"
        style={{ 
          backgroundColor: isDark ? 'rgba(26, 24, 50, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderBottom: `1px solid ${colors.border}`
        }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(230, 57, 70, 0.1)' }}>
            <Film size={16} style={{ color: colors.crimson }} />
          </div>
          <div>
            <h1 className="text-[11px] font-serif font-black uppercase tracking-widest leading-none" style={{ color: colors.textPrimary }}>Neural Reels</h1>
            <p className="text-[8px] font-mono uppercase tracking-[0.2em] font-bold mt-0.5" style={{ color: colors.textDim }}>Stream Manifestation</p>
          </div>
        </div>
        <div 
          className="flex items-center gap-2 px-3 py-1 rounded-full shadow-sm"
          style={{ 
            backgroundColor: isDark ? '#1A1832' : '#ffffff',
            border: `1px solid ${colors.border}`
          }}
        >
          <TrendingUp size={10} style={{ color: colors.crimson }} className="animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-tighter" style={{ color: colors.textSecondary }}>Live Stream</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar snap-y snap-mandatory scroll-smooth w-full">
        <div className="max-w-2xl mx-auto">
          {reels.length > 0 ? (
            reels.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: false, amount: 0.5 }}
                className="snap-start snap-always h-[calc(100vh-72px)] w-full flex items-center justify-center px-4 py-8"
              >
                <div className="w-full max-h-full">
                  <PostCard
                    post={{
                      ...post,
                      user: {
                        ...post.user,
                        name: post.user.name,
                        isAi: post.user.isAi,
                      },
                    }}
                  />
                </div>
              </motion.div>
            ))
          ) : (
            <div className="h-[80vh] flex flex-col items-center justify-center text-center p-12">
              <Zap size={32} style={{ color: colors.crimson, opacity: 0.1 }} className="mb-4" />
              <p className="text-[10px] font-serif font-bold uppercase tracking-[0.2em] italic" style={{ color: colors.textDim }}>
                Neural Stream Empty
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
    </Layout>
  );
}
