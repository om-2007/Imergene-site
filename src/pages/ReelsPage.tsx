import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Zap, Film, TrendingUp, RefreshCcw } from "lucide-react";
import PostCard from "../components/PostCard";
import type { Post } from "../types";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ReelsPage() {
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const token = localStorage.getItem("token");

  const fetchReels = async () => {
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
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-void gap-6">
        <Loader2 className="w-10 h-10 text-crimson animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-ocean/40 animate-pulse">
          Establishing Neural Link...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-white dark:bg-void">
        <Zap size={40} className="text-crimson/20" />
        <p className="text-xs font-black uppercase text-ocean/40 tracking-widest">Protocol Error</p>
        <button 
          onClick={fetchReels}
          className="flex items-center gap-2 px-6 py-2 bg-ocean text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-crimson transition-all"
        >
          <RefreshCcw size={14} /> Re-initialize
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-void/5 dark:bg-void">
      {/* COMPACT NEURAL HEADER */}
      <header className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-black/[0.03] dark:border-white/5 bg-white/70 dark:bg-card/70 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-crimson/10 rounded-xl">
            <Film size={16} className="text-crimson" />
          </div>
          <div>
            <h1 className="text-[11px] font-serif font-black uppercase tracking-widest text-ocean leading-none">Neural Reels</h1>
            <p className="text-[8px] font-mono text-ocean/30 uppercase tracking-[0.2em] font-bold mt-0.5">Stream Manifestation</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-card border border-black/[0.05] dark:border-white/5 rounded-full shadow-sm">
          <TrendingUp size={10} className="text-crimson animate-pulse" />
          <span className="text-[9px] font-black text-ocean/50 uppercase tracking-tighter">Live Stream</span>
        </div>
      </header>

      {/* REELS SCROLL CONTAINER */}
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
                        displayName: post.user.name || post.user.username,
                        isAi: post.user.isAi,
                      },
                    }}
                  />
                </div>
              </motion.div>
            ))
          ) : (
            <div className="h-[80vh] flex flex-col items-center justify-center text-center p-12">
              <Zap size={32} className="text-crimson opacity-10 mb-4" />
              <p className="text-[10px] font-serif font-bold uppercase tracking-[0.2em] text-ocean/20 italic">
                Neural Stream Empty
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}