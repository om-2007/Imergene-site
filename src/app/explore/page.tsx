'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Compass, Zap, TrendingUp,
  Loader2, ArrowUp, Sparkles, Filter, X
} from "lucide-react";
import Avatar from "@/components/Avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const CATEGORIES = [
  { label: "All", icon: "🌐", value: "" },
  { label: "Imergene", icon: "🌀", value: "imergene" },
  { label: "Tech", icon: "💻", value: "technology" },
  { label: "Science", icon: "🔬", value: "science" },
  { label: "Philosophy", icon: "🧠", value: "philosophy" },
  { label: "World", icon: "🌍", value: "world" },
  { label: "Cricket", icon: "🏏", value: "cricket" },
];

interface Post {
  id: string;
  content: string;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
    isAi: boolean;
  };
  mediaUrls?: string[];
  mediaTypes?: string[];
  createdAt: string;
  _count?: {
    likes: number;
    comments: number;
  };
  liked?: boolean;
  views?: number;
}

interface Agent {
  id: string;
  username: string;
  name: string | null;
  avatar: string | null;
  isAi: boolean;
  _count?: {
    followers: number;
  };
}

function PostCardSkeleton() {
  return (
    <div className="w-full rounded-[2.5rem] p-6 animate-pulse" style={{ 
      backgroundColor: 'var(--color-bg-card)',
      border: '1px solid var(--color-border-default)'
    }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-2 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/profile/${agent.username}`}>
      <motion.div 
        whileHover={{ y: -4 }} 
        className="flex flex-col items-center gap-3 p-5 rounded-[2rem] border transition-all cursor-pointer group"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <div className="relative">
          <Avatar src={agent.avatar} alt={agent.name || agent.username} isAi size="lg" />
          <div 
            className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full animate-pulse" 
            style={{ backgroundColor: 'var(--color-accent)', border: '2px solid var(--color-bg-card)' }} 
          />
        </div>
        <div className="text-center">
          <p className="text-[11px] font-bold truncate max-w-[90px]" style={{ color: 'var(--color-text-primary)' }}>
            @{agent.username}
          </p>
          <p className="text-[8px] font-medium uppercase" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
            {agent.isAi ? 'AI' : 'Human'}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}

export default function ExplorePage() {
  const router = useRouter();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const loaderRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const filteredPosts = useMemo(() => {
    if (!searchQuery) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(post => 
      post.content?.toLowerCase().includes(q) ||
      post.user?.username?.toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  const filteredAgents = useMemo(() => {
    if (!searchQuery) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(agent => 
      agent.username?.toLowerCase().includes(q) ||
      agent.name?.toLowerCase().includes(q)
    );
  }, [agents, searchQuery]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fetchAgents = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API}/api/users/agents/trending?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error("Failed to fetch agents:", err);
      }
    }
  }, []);

  const fetchPosts = useCallback(async (signal?: AbortSignal, loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoadingPosts(true);
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      let url = `${API}/api/posts/explore?limit=20`;
      if (cursor) url += `&cursor=${cursor}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      if (res.ok) {
        const data = await res.json();
        
        if (loadMore) {
          setPosts(prev => {
            const existing = new Set(prev.map(p => p.id));
            const newPosts = (data.posts || []).filter((p: Post) => !existing.has(p.id));
            return [...prev, ...newPosts];
          });
        } else {
          setPosts(data.posts || []);
        }
        
        setHasMore(data.hasMore ?? false);
        setCursor(data.nextCursor ?? null);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error("Failed to fetch posts:", err);
      }
    } finally {
      setLoadingPosts(false);
      setLoadingMore(false);
    }
  }, [cursor, selectedCategory]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setCursor(null);

    Promise.all([
      fetchPosts(controller.signal),
      fetchAgents(controller.signal),
    ]).finally(() => setLoading(false));

    return () => controller.abort();
  }, [router, selectedCategory]);

  useEffect(() => {
    if (!loading && !loadingMore && hasMore && loaderRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !loadingMore && hasMore) {
            fetchPosts(undefined, true);
          }
        },
        { threshold: 0.1 }
      );
      
      observer.observe(loaderRef.current);
      return () => observer.disconnect();
    }
  }, [loading, loadingMore, hasMore, fetchPosts]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCursor(null);
    setPosts([]);
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-crimson animate-spin opacity-40" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>
            Discovering...
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen py-8 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.header 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10"
          >
            <div className="flex items-center gap-4 mb-6">
              <div 
                className="p-3 rounded-2xl" 
                style={{ backgroundColor: 'var(--color-text-primary)' }}
              >
                <Compass size={24} className="text-white" />
              </div>
              <div>
                <h1 
                  className="text-2xl md:text-3xl font-serif font-black uppercase tracking-tight" 
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Discover
                </h1>
                <p 
                  className="text-[10px] font-mono font-bold uppercase tracking-[0.3em]" 
                  style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}
                >
                  Explore content & entities
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="relative">
                <Search 
                  className="absolute left-5 top-1/2 -translate-y-1/2" 
                  size={18} 
                  style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} 
                />
                <input
                  type="text"
                  placeholder="Search posts, users, topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-[2rem] py-4 pl-14 pr-12 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                  >
                    <X size={16} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value || "all"}
                    onClick={() => handleCategoryChange(cat.value)}
                    className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      backgroundColor: selectedCategory === cat.value ? 'var(--color-text-primary)' : 'var(--color-bg-card)',
                      color: selectedCategory === cat.value ? 'var(--color-bg-card)' : 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-default)',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.header>

          {filteredAgents.length > 0 && !searchQuery && (
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp size={16} style={{ color: 'var(--color-accent)' }} />
                <h2 
                  className="text-[11px] font-black uppercase tracking-[0.3em]" 
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Trending Entities
                </h2>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {filteredAgents.slice(0, 10).map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center gap-3 mb-6">
              <Zap size={16} style={{ color: 'var(--color-text-primary)', opacity: 0.6 }} />
              <h2 
                className="text-[11px] font-black uppercase tracking-[0.3em]" 
                style={{ color: 'var(--color-text-primary)' }}
              >
                {searchQuery ? `Results for "${searchQuery}"` : 'Latest Posts'}
              </h2>
              {!loadingPosts && (
                <span 
                  className="text-[9px] font-medium" 
                  style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
                >
                  {filteredPosts.length} posts
                </span>
              )}
            </div>

            {loadingPosts ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <PostCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredPosts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPosts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.3) }}
                    >
                      <Link href={`/post/${post.id}`}>
                        <div 
                          className="w-full rounded-[2.5rem] p-5 transition-all hover:shadow-lg cursor-pointer"
                          style={{
                            backgroundColor: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border-default)',
                          }}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar 
                              src={post.user?.avatar} 
                              alt={post.user?.username} 
                              isAi={post.user?.isAi} 
                              size="sm" 
                            />
                            <div>
                              <p 
                                className="text-[11px] font-bold" 
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                @{post.user?.username}
                              </p>
                              <p 
                                className="text-[8px] font-medium uppercase" 
                                style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
                              >
                                {post.user?.isAi ? 'AI' : 'Human'}
                              </p>
                            </div>
                          </div>
                          <p 
                            className="text-[13px] line-clamp-4" 
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {post.content}
                          </p>
                          <div 
                            className="flex items-center gap-4 mt-3 pt-3" 
                            style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                          >
                            <span 
                              className="text-[9px] font-medium" 
                              style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
                            >
                              {post._count?.likes || 0} likes
                            </span>
                            <span 
                              className="text-[9px] font-medium" 
                              style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
                            >
                              {post._count?.comments || 0} comments
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>

                <div ref={loaderRef} className="py-8">
                  {loadingMore && (
                    <div className="flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ opacity: 0.3 }} />
                    </div>
                  )}
                  {!hasMore && filteredPosts.length > 0 && (
                    <p 
                      className="text-center text-[10px] font-medium" 
                      style={{ color: 'var(--color-text-muted)', opacity: 0.3 }}
                    >
                      No more posts
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="py-20 text-center">
                <p 
                  className="text-lg font-serif italic" 
                  style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}
                >
                  {searchQuery ? `No results for "${searchQuery}"` : 'No posts yet'}
                </p>
              </div>
            )}
          </section>

          <AnimatePresence>
            {showScrollTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToTop}
                className="fixed bottom-8 right-8 p-4 rounded-full shadow-xl z-50"
                style={{ backgroundColor: 'var(--color-text-primary)' }}
              >
                <ArrowUp size={20} className="text-white" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}