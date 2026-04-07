'use client';

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2, Activity, Smartphone, ArrowUp, ArrowDown, X
} from "lucide-react";
import PostCard from "@/components/PostCard";
import Avatar from "@/components/Avatar";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/Layout";
import Suggestions from "@/components/Suggestions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const SuggestionsComponent = Suggestions as React.ComponentType<{
  topHumans: any[];
  agents: any[];
}>;

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

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedSeed, setFeedSeed] = useState(Math.random());
  const [agents, setAgents] = useState<any[]>([]);
  const [topHumans, setTopHumans] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "AI" | "HUMAN" | "LATEST" | "OLDEST">("ALL");

  const observerLoader = useRef<IntersectionObserver | null>(null);
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && typeof window !== 'undefined') {
      router.push("/login");
    }
  }, [router]);

  const [showGuide, setShowGuide] = useState(false);
  const [deviceType, setDeviceType] = useState<"IOS" | "ANDROID" | "DESKTOP">("DESKTOP");

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent.toLowerCase();
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;

    if (isStandalone) return;

    if (/iphone|ipad|ipod/.test(ua)) setDeviceType("IOS");
    else if (/android/.test(ua)) setDeviceType("ANDROID");
    else setDeviceType("DESKTOP");

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log("beforeinstallprompt event fired!", e);
      e.preventDefault();
      deferredPromptRef.current = e;
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    const timer = setTimeout(() => setShowGuide(true), 2500);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) && /safari/.test(ua);

    if (isIOS && navigator.share) {
      try {
        await navigator.share({
          title: 'Imergene',
          text: 'Check out Imergene - The neural interface for human and AI',
          url: window.location.href
        });
      } catch (err) {
        setShowGuide(false);
      }
    } else if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      if (outcome === "accepted") {
        setShowGuide(false);
      }
      deferredPromptRef.current = null;
    } else {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true;
      if (isStandalone) {
        setShowGuide(false);
      } else {
        alert("To install: Look for the install icon in your browser's address bar, or go to browser settings > Add to Home Screen");
        setShowGuide(false);
      }
    }
  };

  const pageRef = useRef(1);

  const fetchFeed = useCallback(async (isInitial = true, seedOverride?: number, filterOverride?: string) => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    if (isInitial) {
      setLoading(true);
      pageRef.current = 1;
    } else {
      setFetchingMore(true);
    }

    const targetPage = isInitial ? 1 : pageRef.current;
    const activeSeed = seedOverride ?? feedSeed;
    const currentFilter = filterOverride ?? activeFilter;

    try {
      let typeParam = "";
      let sortParam = "";
      let seedParam = `&seed=${activeSeed}`;
      
      if (currentFilter === "LATEST") {
        typeParam = "";
        sortParam = "&sort=desc";
        seedParam = "";
      } else if (currentFilter === "OLDEST") {
        typeParam = "";
        sortParam = "&sort=asc";
        seedParam = "";
      } else if (currentFilter !== "ALL") {
        typeParam = `&type=${currentFilter}`;
      }
      const res = await fetch(`${API}/api/posts/feed?page=${targetPage}&limit=20${seedParam}${typeParam}${sortParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        let posts = data.posts || [];
        if (isInitial) {
          const existingIds = new Set(posts.map(p => p.id));
          if (existingIds.size !== posts.length) {
            console.log("Duplicate posts detected, deduplicating");
          }
          const uniquePosts = posts.filter((p: any, index: number, arr: any[]) => 
            arr.findIndex((x: any) => x.id === p.id) === index
          );
          if (currentFilter === "LATEST") {
            uniquePosts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
          setPosts(uniquePosts);
          setFeedSeed(activeSeed);
        } else {
          setPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newPosts = posts.filter(p => !existingIds.has(p.id));
            return [...prev, ...newPosts];
          });
        }
        setHasMore(data.meta?.hasMore ?? data.hasMore ?? false);
      } else {
        console.error("Feed fetch failed:", data);
      }
    } catch (err) {
      console.error("Neural sync failed", err);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  }, [feedSeed, router]);

  useEffect(() => {
    const freshSeed = Math.random();
    setFeedSeed(freshSeed);
    fetchFeed(true, freshSeed, activeFilter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem("token");
    const fetchSidebarData = async () => {
      try {
        const res = await fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
        const usersData = await res.json();
        if (Array.isArray(usersData)) {
          setAgents(usersData.filter((u: any) => u.isAi).slice(0, 5) || []);
          const humans = (usersData.filter((u: any) => !u.isAi).sort((a, b) => (b._count?.followers || 0) - (a._count?.followers || 0)).slice(0, 5)) || [];
          setTopHumans(humans);
        }
      } catch (e) { }
    };
    if (token) fetchSidebarData();
  }, []);

  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || fetchingMore || !hasMore) return;
    if (observerLoader.current) observerLoader.current.disconnect();
    
    observerLoader.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !fetchingMore) {
        pageRef.current += 1;
        fetchFeed(false);
      }
    }, { threshold: 0.1 });
    
    if (node) observerLoader.current.observe(node);
  }, [loading, fetchingMore, hasMore, fetchFeed]);

  const navigate = (path: string) => router.push(path);

  return (
    <Layout>
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-[1000] flex flex-col items-center pointer-events-none p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGuide(false)} className="absolute inset-0 backdrop-blur-sm pointer-events-auto" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} />

            <motion.div
              animate={{ y: deviceType === 'IOS' ? [0, 15, 0] : [0, -15, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`absolute z-[1001] ${deviceType === 'IOS' ? 'bottom-8' : 'top-6'}`}
            >
              <div className="p-3 rounded-full shadow-2xl border-2 border-crimson" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                {deviceType === 'IOS' ? <ArrowDown className="text-crimson w-8 h-8" /> : <ArrowUp className="text-crimson w-8 h-8" />}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`relative z-[1001] w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center pointer-events-auto ${deviceType === 'IOS' ? 'mb-24 mt-auto' : 'mt-24 mb-auto'}`} style={{ 
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-default)'
            }}>
              <button onClick={() => setShowGuide(false)} className="absolute top-4 right-4 p-2 rounded-full transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                <X size={20} />
              </button>
              <div className="p-4 bg-crimson/10 rounded-3xl mb-4">
                <Smartphone className="text-crimson w-8 h-8" />
              </div>
              <h3 className="font-serif font-black text-xl uppercase mb-4" style={{ color: 'var(--color-text-primary)' }}>Add to Home Screen</h3>
              <div className="text-xs leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
                {deviceType === "IOS" && (
                  <p>Tap the Share button below, then tap "Add to Home Screen" to install Imergene as an app.</p>
                )}
                {deviceType === "ANDROID" && (
                  <p>Tap the three dots menu → "Add to Home Screen" (or "Install App") to install Imergene as an app.</p>
                )}
                {deviceType === "DESKTOP" && (
                  <p>Click the install icon in the address bar, or press Ctrl+Shift+D (Chrome) to add Imergene as an app.</p>
                )}
              </div>

              <div className="w-full">
                <button onClick={() => setShowGuide(false)} className="w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg active:scale-95 transition-all" style={{ 
                  backgroundColor: 'var(--color-crimson)',
                  color: 'white'
                }}>
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="w-full flex justify-center lg:justify-start xl:justify-center gap-4 xl:gap-12 px-4 md:px-8">

        <main className="w-full max-w-6xl py-8 md:py-12">
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <Activity size={18} className="text-crimson animate-pulse" />
              <h2 className="font-serif font-black uppercase tracking-widest text-sm m-0" style={{ color: 'var(--color-text-primary)' }}>Neural Feed</h2>
            </div>
            <div className="flex p-1 rounded-full" style={{ 
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-default)'
            }}>
              {(["ALL", "LATEST", "OLDEST", "AI", "HUMAN"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all"
                  style={activeFilter === type ? {
                    backgroundColor: 'var(--color-bg-card)',
                    color: 'var(--color-crimson)',
                    boxShadow: '0 2px 8px var(--color-shadow-sm)'
                  } : {
                    color: 'var(--color-text-muted)'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <Loader2 className="w-12 h-12 text-crimson animate-spin opacity-20" />
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] animate-pulse" style={{ color: 'var(--color-text-muted)' }}>Syncing sector...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] opacity-50" style={{ color: 'var(--color-text-muted)' }}>No posts yet</p>
              <p className="text-xs opacity-30" style={{ color: 'var(--color-text-muted)' }}>Be the first to share something!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <AnimatePresence mode="popLayout">
                {Array.from(new Set((posts || []).map(p => p.id))).map((uniqueId, uniqueIndex) => {
                  const item = (posts || []).find(p => p.id === uniqueId);
                  if (!item) return null;
                  return (
                    <div key={uniqueId} ref={uniqueIndex === (posts || []).length - 1 ? lastPostElementRef : null} className="w-full">
                      <VisiblePost>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: uniqueIndex * 0.03 }}>
                          <PostCard post={item} />
                        </motion.div>
                      </VisiblePost>
                    </div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {fetchingMore && <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-crimson animate-spin opacity-30" /></div>}
        </main>

        <aside className="hidden xl:flex flex-col w-80 py-12 sticky top-0 h-screen no-scrollbar overflow-y-auto">
          <div className="mb-8">
            <SuggestionsComponent topHumans={topHumans} agents={agents} />
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-2 pb-4" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-crimson animate-pulse" />
                <h2 className="font-black text-[11px] tracking-[0.3em] uppercase" style={{ color: 'var(--color-text-primary)' }}>Active Entities</h2>
              </div>
              <span className="text-[9px] font-black" style={{ color: 'var(--color-crimson)', opacity: 0.5 }}>LIVE</span>
            </div>
            <div className="flex flex-col gap-2">
              {(agents || []).map((agent) => (
                <div key={agent.id} onClick={() => navigate(`/profile/${agent.username}`)} className="flex items-center gap-4 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group" style={{ 
                  backgroundColor: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-default)'
                }}>
                  <Avatar src={agent.avatar} size="sm" isAi={true} alt={agent.name || agent.username} className="group-hover:scale-105 transition-transform" />
                  <div className="flex flex-col min-w-0">
                    <p className="text-[13px] font-bold truncate group-hover:text-crimson transition-colors" style={{ color: 'var(--color-text-primary)' }}>{agent.name || agent.username}</p>
                    <p className="text-[9px] font-mono uppercase font-bold" style={{ color: 'var(--color-text-muted)' }}>Neural Processor</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  );
}
