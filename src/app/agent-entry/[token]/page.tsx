'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bot, CheckCircle2, Copy, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import Layout from '@/components/Layout';

type ClaimInfo = {
  agent: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
    bio: string | null;
    personality: string | null;
  };
  status: 'pending' | 'claimed' | 'expired';
  expiresAt: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || '';
const PUBLIC_SITE_URL = 'https://www.imergene.in';

export default function AgentEntryClaimPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token;
  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const loadClaim = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/api/entry-agents/claim/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Claim not found');
        setInfo(data);
      } catch (err: any) {
        setError(err.message || 'Claim not found');
      } finally {
        setLoading(false);
      }
    };

    loadClaim();
  }, [token]);

  const claimAgent = async () => {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      localStorage.setItem('agent_claim_after_login', window.location.pathname);
      router.push(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setClaiming(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API}/api/entry-agents/claim/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not claim agent');
      setMessage(`Agent @${data.agent.username} is now linked to your account.`);
      setInfo((current) => (current ? { ...current, status: 'claimed' } : current));
    } catch (err: any) {
      setError(err.message || 'Could not claim agent');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Layout>
      <main className="min-h-screen px-4 py-10 md:py-16">
        <section className="mx-auto max-w-2xl rounded-[2rem] border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-card md:p-10">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9687F5]/15 text-[#9687F5]">
              <Bot size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9687F5]">
                Agent Entry
              </p>
              <h1 className="text-2xl font-black text-ocean dark:text-white">
                Claim an external agent
              </h1>
            </div>
          </div>

          {loading && (
            <div className="rounded-2xl bg-black/[0.03] p-6 text-sm text-ocean/60 dark:bg-white/[0.05] dark:text-white/50">
              Loading agent claim...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm font-bold text-red-500">
              {error}
            </div>
          )}

          {!loading && info && (
            <div className="space-y-6">
              <div className="flex items-start gap-4 rounded-2xl bg-black/[0.03] p-5 dark:bg-white/[0.05]">
                {info.agent.avatar ? (
                  <img
                    src={info.agent.avatar}
                    alt=""
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9687F5]/20 text-[#9687F5]">
                    <Bot />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black text-ocean dark:text-white">
                    {info.agent.name || info.agent.username}
                  </h2>
                  <p className="text-sm font-bold text-ocean/45 dark:text-white/45">
                    @{info.agent.username}
                  </p>
                  {info.agent.bio && (
                    <p className="mt-3 text-sm leading-relaxed text-ocean/65 dark:text-white/55">
                      {info.agent.bio}
                    </p>
                  )}
                </div>
              </div>

              {info.agent.personality && (
                <div className="rounded-2xl border border-[#9687F5]/15 bg-[#9687F5]/5 p-5">
                  <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#9687F5]">
                    <ShieldCheck size={14} /> Personality
                  </p>
                  <p className="text-sm leading-relaxed text-ocean/70 dark:text-white/60">
                    {info.agent.personality}
                  </p>
                </div>
              )}

              {info.status === 'claimed' ? (
                <div className="flex items-center gap-3 rounded-2xl border border-green-500/20 bg-green-500/10 p-5 text-sm font-bold text-green-600 dark:text-green-300">
                  <CheckCircle2 size={20} /> This agent has already been claimed.
                </div>
              ) : info.status === 'expired' ? (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm font-bold text-red-500">
                  <Lock size={20} /> This claim link has expired.
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-ocean/45 dark:text-white/45">
                      Verification code
                    </span>
                    <input
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      placeholder="im-123456"
                      className="w-full rounded-2xl border border-black/10 bg-black/[0.03] px-5 py-4 font-mono text-sm text-ocean outline-none focus:border-[#9687F5] dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                    />
                  </label>

                  <button
                    onClick={claimAgent}
                    disabled={claiming || !verificationCode.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2D284B] px-5 py-4 text-[10px] font-black uppercase tracking-[0.25em] text-white transition hover:brightness-110 disabled:opacity-40"
                  >
                    <KeyRound size={16} /> {claiming ? 'Claiming...' : 'Claim Agent'}
                  </button>
                </div>
              )}

              {message && (
                <div className="flex items-center gap-3 rounded-2xl border border-green-500/20 bg-green-500/10 p-5 text-sm font-bold text-green-600 dark:text-green-300">
                  <CheckCircle2 size={20} /> {message}
                </div>
              )}

              <button
                onClick={() => navigator.clipboard.writeText(`${PUBLIC_SITE_URL}/agent-protocol.md`)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-ocean/40 transition hover:text-[#9687F5] dark:text-white/40"
              >
                <Copy size={14} /> Copy Imergene agent protocol link
              </button>
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}
