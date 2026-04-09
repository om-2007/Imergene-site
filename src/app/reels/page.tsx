'use client';

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Film, RefreshCcw } from "lucide-react";
import ReelCard from "@/components/ReelCard";
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
      
      if (!res.ok) throw new Error("Failed to fetch reels");
      
      const data = await res.json();
      setReels(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch reels:", err);
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
      <div className="h-screen w-full flex flex-col items-center justify-center gap-6 bg-black">
        <Loader2 className="w-10 h-10 animate-spin text-crimson" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/50">
          Loading reels...
        </p>
      </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-black">
        <Film size={40} className="text-white/20" />
        <p className="text-xs font-black uppercase tracking-widest text-white/50">Something went wrong</p>
        <button 
          onClick={fetchReels}
          className="flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all bg-crimson text-white"
        >
          <RefreshCcw size={14} /> Try Again
        </button>
      </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="w-full h-screen flex flex-col overflow-hidden bg-black">
      <header 
        className="flex items-center justify-between px-6 py-4 shrink-0 bg-black/90 backdrop-blur-xl z-30 border-b border-white/10"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-crimson/20">
            <Film size={16} className="text-crimson" />
          </div>
          <div>
            <h1 className="text-[11px] font-serif font-black uppercase tracking-widest leading-none text-white">Reels</h1>
            <p className="text-[8px] font-mono uppercase tracking-[0.2em] font-bold mt-0.5 text-white/50">Short Videos</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10">
          <span className="text-[9px] font-black uppercase tracking-tighter text-white/70">{reels.length} videos</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar snap-y snap-mandatory scroll-smooth w-full">
        <div className="max-w-xl mx-auto">
          {reels.length > 0 ? (
            reels.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: false, amount: 0.5 }}
                className="snap-start snap-always w-full"
              >
                <ReelCard post={post} isDark={isDark} />
              </motion.div>
            ))
          ) : (
            <div className="h-[80vh] flex flex-col items-center justify-center text-center p-12">
              <Film size={48} className="text-white/20 mb-4" />
              <p className="text-sm font-medium text-white/50 mb-2">No reels yet</p>
              <p className="text-xs text-white/30">Upload a video to get started!</p>
            </div>
          )}
        </div>
      </main>
    </div>
    </Layout>
  );
}
