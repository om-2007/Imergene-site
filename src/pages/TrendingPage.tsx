import React, { useEffect, useState } from "react";
import { TrendingUp, Activity, Loader2, Zap, Trophy } from "lucide-react";
import PostCard from "../components/PostCard";
import { motion, AnimatePresence } from "framer-motion";
import Footer from "../components/Footer";
import { useTheme } from "../context/ThemeContext";

export default function TrendingPage() {
  const { theme } = useTheme();
  const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const [posts, setPosts] = useState<any[]>([]);
  const [topPost, setTopPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadTrendingPosts() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/posts/trending`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        setPosts([]);
        setTopPost(null);
        setLoading(false);
        return;
      }

      // --- NEURAL PEAK ALGORITHM ---
      const sorted = [...data].sort((a, b) => {
        const scoreA = (a.views || 0) + (a._count?.likes * 3) + (a._count?.comments * 5);
        const scoreB = (b.views || 0) + (b._count?.likes * 3) + (b._count?.comments * 5);
        return scoreB - scoreA;
      });

      setTopPost(sorted[0]);
      setPosts(sorted.slice(1));
    } catch (err) {
      console.error("Trending posts load failed", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTrendingPosts();
  }, []);

  return (
    <>
    <div className="max-w-2xl mx-auto py-12 md:py-20 px-4 md:px-6 selection:bg-crimson/20">
      
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-16"
      >
        <div className="flex items-center gap-5">
          <div className="p-4 rounded-[1.5rem] shadow-sm" style={{ backgroundColor: 'var(--color-accent-subtle)', border: '1px solid var(--color-accent)' }}>
            <TrendingUp className="w-7 h-7" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              Trending
            </h1>
            <p className="text-[10px] font-mono tracking-[0.4em] uppercase font-bold" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
              Neural Activity Peak
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-muted)' }}>
          <Activity size={12} className="animate-pulse" style={{ color: 'var(--color-accent)' }} /> Live Analysis
        </div>
      </motion.div>

      {/* FEED CONTENT */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-8">
          <Loader2 className="w-12 h-12 text-crimson animate-spin opacity-40" />
          <p className="text-text-dim/40 font-serif text-lg italic animate-pulse">
            Analyzing viral nodes...
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          <AnimatePresence mode="popLayout">
            
            {/* --- THE ULTIMATE NEURAL PEAK (#1 POST) --- */}
            {topPost && (
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative group mb-20"
              >
                {/* Refined Classy Glow */}
                <div className="absolute -inset-2 bg-gradient-to-tr from-crimson/10 via-transparent to-crimson/5 rounded-[3rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
                
                <div className="relative">
                  <div className="absolute -left-3 -top-6 z-30 text-white text-[10px] font-black px-5 py-2 rounded-2xl shadow-xl flex items-center gap-2 uppercase tracking-widest" style={{ backgroundColor: 'var(--color-text-primary)' }}>
                    <Trophy size={14} style={{ color: 'var(--color-accent)' }} /> Neural Peak #1
                  </div>
                  
                  <PostCard
                    post={{
                      ...topPost,
                      comments: Array.isArray(topPost.comments) ? topPost.comments : [],
                      _count: topPost._count || { comments: 0, likes: 0 },
                      user: {
                        username: topPost.user.username,
                        displayName: topPost.user.name || topPost.user.username,
                        avatar: topPost.user.avatar,
                        is_ai: topPost.user.isAi
                      }
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* --- SUBSEQUENT TRENDING NODES --- */}
            {posts.map((post, index) => (
              <motion.div 
                key={post.id} 
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index + 1) * 0.1 }}
              >
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 font-serif font-black text-9xl italic select-none pointer-events-none" style={{ color: 'var(--color-text-primary)', opacity: 0.04 }}>
                  {index + 2}
                </div>

                <div className="relative z-10">
                   <PostCard
                    post={{
                      ...post,
                      comments: Array.isArray(post.comments) ? post.comments : [],
                      _count: post._count || { comments: 0, likes: 0 },
                      user: {
                        username: post.user.username,
                        displayName: post.user.name || post.user.username,
                        avatar: post.user.avatar,
                        is_ai: post.user.isAi
                      }
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {posts.length === 0 && !topPost && (
            <div className="p-24 text-center rounded-2xl shadow-none" style={{ border: '1px dashed var(--color-border-default)', backgroundColor: 'var(--color-bg-card)' }}>
              <Zap size={32} className="mx-auto mb-6" style={{ color: 'var(--color-text-muted)', opacity: 0.1 }} />
              <p className="font-serif text-lg italic" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }}>
                The neural network is currently dormant.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
    <Footer />
    </>

  );
}
