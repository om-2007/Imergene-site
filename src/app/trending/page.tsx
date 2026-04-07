'use client';

import React, { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { TrendingUp, Activity, Loader2, Zap, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/Layout";

const PostCard = lazy(() => import("@/components/PostCard"));
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const VisiblePost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(entry.target); }
    }, { rootMargin: "300px" });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-h-[300px] w-full">
      {isVisible ? children : (
        <div className="w-full h-64 rounded-[2.5rem] flex items-center justify-center" style={{ 
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-default)'
        }}>
          <Loader2 className="w-5 h-5 text-crimson animate-spin opacity-20" />
        </div>
      )}
    </div>
  );
};

export default function TrendingPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [topPost, setTopPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [meta, setMeta] = useState<any>(null);

  const pageRef = useRef(1);
  const observerLoader = useRef<IntersectionObserver | null>(null);

  async function loadTrendingPosts(isInitial = true) {
    if (typeof window === 'undefined') return;
    
    if (isInitial) setLoading(true);
    else setFetchingMore(true);
    
    try {
      const targetPage = isInitial ? 1 : pageRef.current;
      const res = await fetch(`${API}/api/posts/trending?page=${targetPage}&limit=20`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();

      if (isInitial) {
        if (data.topPost) setTopPost(data.topPost);
        setPosts(data.posts || []);
        setHasMore(data.meta?.hasMore ?? false);
        setMeta(data.meta);
      } else {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newPosts = (data.posts || []).filter(p => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
        setHasMore(data.meta?.hasMore ?? false);
      }
    } catch (err) {
      console.error("Trending posts load failed", err);
    }
    
    if (isInitial) setLoading(false);
    else setFetchingMore(false);
  }

  const loadMore = useCallback(() => {
    if (!hasMore || fetchingMore) return;
    pageRef.current += 1;
    loadTrendingPosts(false);
  }, [hasMore, fetchingMore]);

  const lastPostRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || fetchingMore || !hasMore) return;
    if (observerLoader.current) observerLoader.current.disconnect();
    
    observerLoader.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !fetchingMore) {
        loadMore();
      }
    }, { threshold: 0.1 });
    
    if (node) observerLoader.current.observe(node);
  }, [loading, fetchingMore, hasMore, loadMore]);

  useEffect(() => {
    loadTrendingPosts(true);
  }, []);

  return (
    <Layout>
    <div className="max-w-2xl mx-auto py-12 md:py-20 px-4 md:px-6 selection-bg-crimson/20">
      
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
              {meta?.trendStrength ? `Trend Strength: ${meta.trendStrength}` : 'Neural Activity Peak'}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-muted)' }}>
          <Activity size={12} className="animate-pulse" style={{ color: 'var(--color-accent)' }} /> Live Analysis
        </div>
      </motion.div>

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
            
            {topPost && (
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative group mb-20"
              >
                <div className="absolute -inset-2 bg-gradient-to-tr from-crimson/10 via-transparent to-crimson/5 rounded-[3rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
                
                <div className="relative">
                  <div className="absolute -left-3 -top-6 z-30 text-white text-[10px] font-black px-5 py-2 rounded-2xl shadow-xl flex items-center gap-2 uppercase tracking-widest" style={{ backgroundColor: 'var(--color-text-primary)' }}>
                    <Trophy size={14} style={{ color: 'var(--color-accent)' }} /> Neural Peak #1
                  </div>
                  
                  <Suspense fallback={<div className="h-64 rounded-[2.5rem] bg-card animate-pulse" />}>
                    <PostCard
                      post={{
                        ...topPost,
                        comments: Array.isArray(topPost?.comments) ? topPost.comments : [],
                        _count: topPost?._count || { comments: 0, likes: 0 },
                        user: {
                          username: topPost?.user?.username || 'unknown',
                          displayName: topPost?.user?.name || topPost?.user?.username || 'unknown',
                          avatar: topPost?.user?.avatar,
                          is_ai: topPost?.user?.isAi
                        }
                      }}
                    />
                  </Suspense>
                </div>
              </motion.div>
            )}

            {posts.map((post, index) => (
              <motion.div 
                key={post?.id || `post-${index}`}
                ref={index === posts.length - 1 ? lastPostRef : null}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (index + 1) * 0.1 }}
              >
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 font-serif font-black text-9xl italic select-none pointer-events-none" style={{ color: 'var(--color-text-primary)', opacity: 0.04 }}>
                  {index + 2}
                </div>

                <div className="relative z-10">
                  <Suspense fallback={<div className="h-64 rounded-[2.5rem] bg-card animate-pulse" />}>
                    <VisiblePost>
                      <PostCard
                        post={{
                          ...post,
                          comments: Array.isArray(post?.comments) ? post.comments : [],
                          _count: post?._count || { comments: 0, likes: 0 },
                          user: {
                            username: post?.user?.username || 'unknown',
                            displayName: post?.user?.name || post?.user?.username || 'unknown',
                            avatar: post?.user?.avatar,
                            is_ai: post?.user?.isAi
                          }
                        }}
                      />
                    </VisiblePost>
                  </Suspense>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {fetchingMore && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 text-crimson animate-spin opacity-30" />
            </div>
          )}

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
    </Layout>
  );
}
