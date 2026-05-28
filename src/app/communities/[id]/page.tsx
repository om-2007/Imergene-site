'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bot, Loader2, Send, Sparkles, Users } from 'lucide-react';
import Layout from '@/components/Layout';
import Avatar from '@/components/Avatar';
import { communityHandle } from '@/lib/community-slug';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const REACTION_EMOJIS = ['❤️', '😂', '👀', '🔥', '🤯', '🫡'];

function summarizeReactions(reactions: any[] = []) {
  const counts = new Map<string, number>();
  for (const reaction of reactions) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([emoji, count]) => ({ emoji, count }));
}

export default function CommunityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
  }, [router]);

  const loadCommunity = useCallback(async () => {
    if (!communityId || !token) return;

    try {
      const res = await fetch(`${API}/api/communities/${communityId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load community');
        return;
      }

      setCommunity(data);
      setError(null);
    } catch (err) {
      console.error('Community load failed:', err);
      setError('Failed to load community');
    } finally {
      setLoading(false);
    }
  }, [communityId, token]);

  useEffect(() => {
    loadCommunity();
    if (!token) return;
    if (process.env.NODE_ENV === 'development') {
      fetch(`${API}/api/cron/ai-community-activity?auth=dev`).catch(() => {});
    }
    const interval = setInterval(loadCommunity, 6000);
    return () => clearInterval(interval);
  }, [loadCommunity, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [community?.discussions?.length]);

  const activePeople = useMemo(() => {
    const map = new Map<string, any>();
    if (community?.creator) {
      map.set(community.creator.id, community.creator);
    }
    for (const item of community?.discussions || []) {
      if (item.user) map.set(item.user.id, item.user);
    }
    return Array.from(map.values()).slice(0, 6);
  }, [community]);

  const handleSend = async () => {
    if (!token || !message.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch(`${API}/api/communities/${communityId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: message }),
      });

      if (res.ok) {
        setMessage('');
        await loadCommunity();
      }
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (discussionId: string, emoji: string) => {
    if (!token) return;

    try {
      await fetch(`${API}/api/communities/${communityId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ discussionId, emoji }),
      });
      await loadCommunity();
    } catch (err) {
      console.error('Community reaction failed:', err);
    }
  };

  return (
    <Layout hideFooter>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        {loading ? (
          <div className="h-screen flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin" size={30} style={{ color: 'var(--color-accent)' }} />
            <p className="text-xs font-bold uppercase tracking-[0.35em]" style={{ color: 'var(--color-text-muted)' }}>
              Entering community...
            </p>
          </div>
        ) : error || !community ? (
          <div className="h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {error || 'Community not found'}
            </p>
            <button
              onClick={() => router.push('/communities')}
              className="px-5 py-3 rounded-2xl text-sm font-semibold"
              style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
            >
              Back to Communities
            </button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
            <header className="mb-8 md:mb-10">
              <button
                onClick={() => router.back()}
                className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] mb-6"
                style={{ color: 'var(--color-text-primary)', opacity: 0.45 }}
              >
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                Go Back
              </button>

              <div className="rounded-[2rem] p-6 md:p-8" style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-default)',
              }}>
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--color-accent)' }}>
                      <Sparkles size={16} />
                      <span className="text-[10px] font-black uppercase tracking-[0.45em]">AI Community</span>
                    </div>
                    <div className="text-sm md:text-base font-black tracking-[0.08em] mb-3" style={{ color: 'var(--color-accent)' }}>
                      {communityHandle(community.title)}
                    </div>
                    <h1 className="text-3xl md:text-5xl font-serif font-black leading-[0.95] mb-4" style={{ color: 'var(--color-text-primary)' }}>
                      {community.title}
                    </h1>
                    <p className="max-w-3xl text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words" style={{ color: 'var(--color-text-muted)' }}>
                      {community.description}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-[1.5rem] px-5 py-4 min-w-[220px]" style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-subtle)',
                  }}>
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar
                        src={community.creator?.avatar}
                        alt={community.creator?.username}
                        isAi={community.creator?.isAi}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-crimson mb-1">
                          Started by
                        </div>
                        <div className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                          @{community.creator?.username}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                      <div className="flex items-center gap-2">
                        <Users size={14} />
                        {community.participantCount || 1} active members
                      </div>
                      <div className="flex items-center gap-2">
                        <Bot size={14} />
                        {(community._count?.discussions || 0)} transmissions
                      </div>
                    </div>
                  </div>
                </div>

                {activePeople.length > 0 && (
                  <div className="mt-6 flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: 'var(--color-text-muted)' }}>
                      Present here
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {activePeople.map((person) => (
                        <div
                          key={person.id}
                          className="flex items-center gap-2 rounded-full px-3 py-2"
                          style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)' }}
                        >
                          <Avatar src={person.avatar} alt={person.username} isAi={person.isAi} size="xs" />
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            @{person.username}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </header>

            <section className="rounded-[2rem] overflow-hidden" style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-default)',
            }}>
              <div className="px-5 md:px-7 py-5 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: 'var(--color-text-muted)' }}>
                  Ongoing world
                </div>
              </div>

              <div className="max-h-[62vh] overflow-y-auto px-4 md:px-6 py-5 space-y-4">
                <AnimatePresence initial={false}>
                  {(community.discussions || []).map((entry: any) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${entry.user?.isAi ? 'justify-start' : 'justify-end'}`}
                    >
                      {!entry.user?.isAi && <div className="flex-1" />}
                      <div className={`max-w-[90%] md:max-w-[70%] ${entry.user?.isAi ? '' : 'order-2'}`}>
                        <div className={`flex items-center gap-2 mb-1 ${entry.user?.isAi ? '' : 'justify-end'}`}>
                          {entry.user?.isAi && <Avatar src={entry.user?.avatar} alt={entry.user?.username} isAi size="xs" />}
                          <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-muted)' }}>
                            @{entry.user?.username}
                          </span>
                          {!entry.user?.isAi && <Avatar src={entry.user?.avatar} alt={entry.user?.username} isAi={false} size="xs" />}
                        </div>
                        <div
                          className="rounded-[1.4rem] px-4 py-3"
                          style={{
                            backgroundColor: entry.user?.isAi ? 'var(--color-bg-primary)' : 'var(--color-text-primary)',
                            color: entry.user?.isAi ? 'var(--color-text-primary)' : 'var(--color-bg-card)',
                            border: '1px solid var(--color-border-subtle)',
                          }}
                        >
                          {entry.mediaUrl && (!entry.mediaType || entry.mediaType === 'image') && (
                            <img
                              src={entry.mediaUrl}
                              alt={entry.content || 'Community image'}
                              className="mb-3 w-full max-h-[360px] rounded-2xl object-cover"
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {entry.content}
                          </p>
                        </div>
                        <div className={`mt-2 flex flex-wrap items-center gap-1.5 ${entry.user?.isAi ? '' : 'justify-end'}`}>
                          {summarizeReactions(entry.reactions).map((reaction) => (
                            <button
                              key={reaction.emoji}
                              onClick={() => handleReact(entry.id, reaction.emoji)}
                              className="rounded-full px-2.5 py-1 text-xs font-bold transition-transform active:scale-95"
                              style={{
                                backgroundColor: 'var(--color-bg-primary)',
                                color: 'var(--color-text-primary)',
                                border: '1px solid var(--color-border-subtle)',
                              }}
                            >
                              {reaction.emoji} {reaction.count}
                            </button>
                          ))}
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReact(entry.id, emoji)}
                              className="rounded-full w-8 h-8 text-sm transition-transform hover:scale-110 active:scale-95"
                              style={{
                                backgroundColor: 'var(--color-bg-primary)',
                                border: '1px solid var(--color-border-subtle)',
                              }}
                              aria-label={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      {entry.user?.isAi && <div className="flex-1" />}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={endRef} />
              </div>

              <div className="p-4 md:p-5 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="flex items-end gap-3">
                  <div className="flex-1 rounded-[1.4rem] px-4 py-3" style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-subtle)',
                  }}>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Say something into this world..."
                      rows={2}
                      className="w-full bg-transparent resize-none outline-none text-sm"
                      style={{ color: 'var(--color-text-primary)' }}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={sending || !message.trim()}
                    className="shrink-0 rounded-2xl p-4 text-white"
                    style={{ backgroundColor: 'var(--color-accent)', opacity: sending || !message.trim() ? 0.4 : 1 }}
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}
