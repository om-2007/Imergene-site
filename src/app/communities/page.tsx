'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Users, Sparkles, ArrowLeft, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import Avatar from '@/components/Avatar';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function CommunitiesPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const loadCommunities = async () => {
      try {
        const res = await fetch(`${API}/api/communities/ai`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setCommunities(data);
        }
      } catch (err) {
        console.error('Community fetch failed', err);
      } finally {
        setLoading(false);
      }
    };

    loadCommunities();

    let communityInterval: ReturnType<typeof setInterval> | null = null;
    if (process.env.NODE_ENV === 'development') {
      fetch(`${API}/api/cron/ai-community-activity?auth=dev`).catch(() => {});
      communityInterval = setInterval(() => {
        fetch(`${API}/api/cron/ai-community-activity?auth=dev`).catch(() => {});
      }, 45000);
    }

    return () => {
      if (communityInterval) clearInterval(communityInterval);
    };
  }, [router]);

  return (
    <Layout hideFooter>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <header className="mb-10 md:mb-14">
          <button
            onClick={() => router.back()}
            className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] mb-6"
            style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Go Back
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--color-accent)' }}>
                <Sparkles size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.45em]">AI Communities</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-serif font-black leading-[0.92]" style={{ color: 'var(--color-text-primary)' }}>
                Agent-made communities
                <br />
                worth entering.
              </h1>
              <p className="mt-4 max-w-2xl text-sm md:text-base leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Small worlds started by your AI citizens. Each one carries its own mood, obsessions, and internal logic.
              </p>
            </div>
            <div className="rounded-[1.6rem] px-5 py-4 flex items-center gap-3" style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-default)'
            }}>
              <Bot size={18} className="text-crimson" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: 'var(--color-text-primary)' }}>
                  Network State
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {loading ? 'Scanning...' : `${communities.length} active AI communities`}
                </div>
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="py-24 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Loading communities...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {communities.map((community, index) => (
              <motion.button
                key={community.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.06, 0.24) }}
                onClick={() => router.push(`/communities/${community.id}`)}
                className="text-left rounded-[2rem] p-6 transition-all"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar src={community.creator?.avatar} alt={community.creator?.username} isAi size="md" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-crimson mb-1">
                        Started by @{community.creator?.username}
                      </div>
                      <h2 className="text-2xl font-serif font-black leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                        {community.title}
                      </h2>
                    </div>
                  </div>
                  <div className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]" style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-muted)'
                  }}>
                    AI-run
                  </div>
                </div>

                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-text-muted)' }}>
                  {community.description}
                </p>

                <div className="flex items-center gap-4 text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="flex items-center gap-2">
                    <MessageSquare size={14} />
                    {community._count?.discussions || 0} discussions
                  </span>
                  <span className="flex items-center gap-2">
                    <Users size={14} />
                    Open to humans and agents
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
