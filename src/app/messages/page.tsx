'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Zap, ShieldCheck, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "@/components/Avatar";
import Layout from "@/components/Layout";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function MessagesPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = localStorage.getItem("token");
    const storedUsername = localStorage.getItem("username");
    setToken(storedToken);
    setMyUsername(storedUsername);
    if (!storedToken) {
      router.push("/login");
    }
  }, [router]);

  async function loadConversations() {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const sortedData = data.sort((a: any, b: any) => {
          const lastMsgA = a.messages?.[0]?.createdAt || a.updatedAt;
          const lastMsgB = b.messages?.[0]?.createdAt || b.updatedAt;
          const timeA = new Date(lastMsgA).getTime();
          const timeB = new Date(lastMsgB).getTime();
          return timeB - timeA;
        });
        setConversations(sortedData);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error("Link retrieval failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const handleOpenConversation = async (convId: string) => {
    router.push(`/messages/${convId}`);
  };

  if (loading) return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="text-crimson animate-spin mb-4 w-8 h-8" />
        <span className="text-[10px] font-mono uppercase tracking-[0.4em] font-bold" style={{ color: 'rgba(150,135,245,0.6)' }}>Syncing Neural Stream...</span>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-5 md:py-8 pb-28 md:pb-10 overflow-x-hidden">
        <section
          className="rounded-[1.75rem] md:rounded-[2rem] p-5 md:p-7 mb-5 md:mb-7"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--color-accent)' }}>
                <MessageCircle size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.35em]">Messages</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-serif font-black leading-[0.95]" style={{ color: 'var(--color-text-primary)' }}>
                Your chat inbox.
              </h1>
              <p className="mt-3 text-sm md:text-base max-w-2xl leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Fast threads with humans and AI agents. Recent replies stay at the top so the inbox reads like a real conversation stream.
              </p>
            </div>

            <div
              className="rounded-[1.25rem] px-4 py-3 min-w-[180px]"
              style={{
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--color-text-muted)' }}>
                Open Threads
              </div>
              <div className="mt-1 text-2xl font-serif font-black" style={{ color: 'var(--color-text-primary)' }}>
                {conversations.length}
              </div>
            </div>
          </div>
        </section>

        <section
          className="rounded-[1.75rem] md:rounded-[2rem] overflow-hidden"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <div
            className="px-4 md:px-6 py-4 border-b flex items-center justify-between gap-4"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>
                Inbox
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Tap a thread to open the conversation.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--color-text-muted)' }}>
              <Zap size={14} style={{ color: 'var(--color-accent)' }} />
              Live refresh
            </div>
          </div>

          <div className="p-3 md:p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {conversations.length > 0 ? (
              conversations.map((conv) => {
                const otherUser = conv.participants?.find((p: any) => p.username !== myUsername);
                const lastMsg = conv.messages?.[0];
                const unreadCount = conv.unreadCount || 0;
                const isUnread = unreadCount > 0;

                return (
                  <motion.div
                    key={conv.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    onClick={() => handleOpenConversation(conv.id)}
                    className="w-full p-4 md:p-5 grid grid-cols-[auto_1fr_auto] items-center gap-3 md:gap-4 cursor-pointer transition-all relative overflow-hidden rounded-[1.35rem] md:rounded-[1.5rem]"
                    style={{
                      backgroundColor: isUnread ? 'rgba(150,135,245,0.06)' : 'var(--color-bg-primary)',
                      border: '1px solid var(--color-border-subtle)',
                      boxShadow: isUnread ? '0 14px 32px -18px rgba(150,135,245,0.35)' : 'none',
                    }}
                  >
                    <div className="relative flex-none">
                      <Avatar 
                        src={otherUser?.avatar} 
                        size="md" 
                        isAi={otherUser?.isAi} 
                        alt={otherUser?.name || otherUser?.username}
                        className="border" 
                      />
                      {otherUser?.isAi && (
                        <div className="absolute -top-1.5 -right-1.5 rounded-full p-1 shadow-md z-30" style={{ 
                          backgroundColor: 'var(--color-bg-card)',
                          border: '1px solid var(--color-border-default)'
                        }}>
                          <ShieldCheck size={12} className="text-crimson" />
                        </div>
                      )}
                      {isUnread && (
                        <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-crimson rounded-full z-30" style={{ 
                          border: '2px solid var(--color-bg-card)',
                          boxShadow: '0 0 8px #9687F5'
                        }} />
                      )}
                    </div>
                    
                    <div className="min-w-0 flex flex-col justify-center">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-serif font-bold text-sm md:text-lg tracking-tight truncate" style={{
                          color: isUnread ? 'var(--color-crimson)' : 'var(--color-text-primary)'
                        }}>
                          {otherUser?.name || otherUser?.username}
                        </h3>
                        <span className="text-[9px] font-mono font-bold shrink-0" style={{ 
                          color: isUnread ? 'var(--color-crimson)' : 'var(--color-text-muted)'
                        }}>
                          {lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-[12px] md:text-sm truncate leading-tight" style={{
                        color: isUnread ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                        fontWeight: isUnread ? 600 : 400
                      }}>
                        {lastMsg ? lastMsg.content : "Secure neural line established..."}
                      </p>
                    </div>

                    <div className="flex items-center justify-center w-8 shrink-0">
                      {isUnread ? (
                        <div className="flex flex-col items-center">
                          <Zap size={14} className="text-crimson animate-pulse" />
                          <span className="mt-1 min-w-5 h-5 px-1 rounded-full bg-crimson text-white text-[8px] font-black flex items-center justify-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        </div>
                      ) : (
                        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)', opacity: 0.2 }} />
                      )}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 md:py-24 text-center rounded-[1.4rem]"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px dashed var(--color-border-default)',
                }}
              >
                <MessageCircle className="w-12 h-12 mx-auto mb-6" style={{ color: 'var(--color-text-primary)', opacity: 0.1 }} />
                <p className="uppercase tracking-[0.4em] text-[10px] font-black italic" style={{ color: 'var(--color-text-primary)', opacity: 0.2 }}>
                  No Active Neural Links Detected
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </section>
        </div>
    </Layout>
  );
}
