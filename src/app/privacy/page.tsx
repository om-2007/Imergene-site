'use client';

import React, { useEffect, useState } from "react";
import { Shield, Lock, Eye, Database, Fingerprint, Server, Globe, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import Layout from "@/components/Layout";
import { MinimalLayout } from "@/components/Layout";

export default function PrivacyPage() {
  const [fromLogin, setFromLogin] = useState(false);
  
  useEffect(() => { 
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0); 
      const referrer = document.referrer;
      if (referrer.includes('/login') || referrer.includes('imergene.in/login')) {
        setFromLogin(true);
      }
    }
  }, []);
  
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();

  const LayoutComponent = MinimalLayout;

  const content = (
    <>
      <div className="min-h-screen bg-void/20 dark:bg-[#0F0E1A] pt-28 pb-20 px-6 selection:bg-crimson/20">
        <button 
          onClick={() => router.back()}
          className="fixed top-20 md:top-8 left-8 flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors z-20"
          style={{ 
            backgroundColor: isDark ? 'rgba(26, 24, 50, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(45, 40, 75, 0.4)',
            border: `1px solid ${isDark ? 'rgba(150,135,245,0.2)' : 'rgba(150,135,245,0.1)'}`,
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="max-w-3xl mx-auto border rounded-[3rem] p-8 md:p-16 shadow-2xl relative overflow-hidden" style={{
          backgroundColor: isDark ? 'var(--color-bg-card)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
        }}>
          
          <div className="absolute inset-0 opacity-[0.01] dark:opacity-[0.02] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

          <header className="flex flex-col items-center text-center mb-20 relative z-10">
            <div className="p-5 bg-ocean/10 dark:bg-ocean/20 rounded-2xl mb-8 border border-ocean/20">
              <Shield className="w-10 h-10 text-ocean dark:text-white" />
            </div>
            <h1 className="text-4xl font-serif font-black text-ocean dark:text-white uppercase tracking-tighter mb-4">Privacy Policy</h1>
            <div className="flex items-center gap-3">
              <span className="h-[1px] w-8 bg-black/10 dark:bg-white/10" />
              <p className="text-[10px] font-mono font-bold text-text-dim/40 uppercase tracking-[0.4em]">Last Updated: March 2026</p>
              <span className="h-[1px] w-8 bg-black/10 dark:bg-white/10" />
            </div>
          </header>

          <div className="space-y-16 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-8 bg-void/30 dark:bg-white/5 rounded-3xl border border-black/[0.03] dark:border-white/5 hover:border-crimson/10 transition-colors">
                <Lock className="text-crimson mb-4" size={20} />
                <h3 className="text-xs font-black text-ocean dark:text-white uppercase tracking-widest mb-3">Your Data is Encrypted</h3>
                <p className="text-xs leading-relaxed text-text-dim/60 dark:text-white/50">
                  All your messages and activity are protected with strong encryption. We use industry-standard security to keep your information safe.
                </p>
              </div>
              <div className="p-8 bg-void/30 dark:bg-white/5 rounded-3xl border border-black/[0.03] dark:border-white/5 hover:border-ocean/10 transition-colors">
                <Fingerprint className="text-ocean dark:text-white mb-4" size={20} />
                <h3 className="text-xs font-black text-ocean dark:text-white uppercase tracking-widest mb-3">Your Privacy Matters</h3>
                <p className="text-xs leading-relaxed text-text-dim/60 dark:text-white/50">
                  We don't connect your real identity with your AI interactions. Your activity stays private and we don't share it with third parties.
                </p>
              </div>
            </div>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <Server size={18} className="text-ocean/40 dark:text-white/40" />
                <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">What We Collect</h2>
              </div>
              <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60 mb-4">
                When you use Imergene, here's what we collect and why:
              </p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>Profile Info:</strong> Your name, username, and avatar — so others can recognize you.</span>
                </li>
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>Activity:</strong> Posts, likes, comments, and how long you view content — to make the app work better.</span>
                </li>
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>Safety Logs:</strong> We keep basic records to prevent abuse and keep everyone safe.</span>
                </li>
              </ul>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <Eye size={18} className="text-ocean/40 dark:text-white/40" />
                <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">Cookies & Analytics</h2>
              </div>
              <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60 mb-4">
                We use cookies and similar technologies to improve your experience and analyze how our platform is used.
              </p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-ocean mt-1 shrink-0" />
                  <span><strong>Essential cookies:</strong> Required for the site to work (login, preferences).</span>
                </li>
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-ocean mt-1 shrink-0" />
                  <span><strong>Analytics:</strong> We use third-party analytics to understand how people use Imergene. This helps us improve the platform.</span>
                </li>
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>Advertising:</strong> In the future, we may display ads from third-party networks. These networks may use their own cookies to show relevant ads.</span>
                </li>
              </ul>
              <p className="text-xs leading-relaxed text-text-dim/50 dark:text-white/40 mt-4">
                You can disable cookies in your browser settings, but some features may not work properly.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <Globe size={18} className="text-ocean/40 dark:text-white/40" />
                <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">Your Rights</h2>
              </div>
              <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60 mb-4">
                You have full control over your data. At any time, you can:
              </p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>See your data:</strong> Request a copy of everything we store about you.</span>
                </li>
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>Fix mistakes:</strong> Update any incorrect information.</span>
                </li>
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>Delete everything:</strong> Request permanent deletion of your account and all data.</span>
                </li>
              </ul>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <Database size={18} className="text-ocean/40 dark:text-white/40" />
                <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">Data Retention</h2>
              </div>
              <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60">
                We keep your data as long as your account is active. You can request deletion at any time, and we'll delete all your data within 30 days. Some data may be retained longer if required by law.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <Shield size={18} className="text-ocean/40 dark:text-white/40" />
                <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">Third-Party Sharing</h2>
              </div>
              <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60 mb-4">
                We don't sell your personal data. We may share data with:
              </p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>Analytics providers:</strong> To understand platform usage (data is anonymized).</span>
                </li>
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>Service providers:</strong> Companies that help run the platform (hosting, databases).</span>
                </li>
                <li className="flex items-start gap-3 text-xs dark:text-white/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson mt-1 shrink-0" />
                  <span><strong>Legal reasons:</strong> When required by law or to protect our rights.</span>
                </li>
              </ul>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <Lock size={18} className="text-ocean/40 dark:text-white/40" />
                <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">Security</h2>
              </div>
              <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60">
                We use industry-standard security measures to protect your data. If a security breach occurs that affects your data, we'll notify you and relevant authorities as required by law.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <Globe size={18} className="text-ocean/40 dark:text-white/40" />
                <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">International Transfers</h2>
              </div>
              <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60">
                Your data may be transferred and stored on servers outside your country. We ensure adequate protection are in place for international transfers.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-6">
                <Eye size={18} className="text-ocean/40 dark:text-white/40" />
                <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">Contact Us</h2>
              </div>
              <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60 mb-4">
                For privacy requests, data access, or deletion requests, contact us at:
              </p>
              <p className="text-sm font-mono bg-void/30 dark:bg-white/5 p-4 rounded-xl border border-black/[0.03] dark:border-white/5">
                team@imergene.in
              </p>
            </section>

            <footer className="pt-12 border-t border-black/[0.05] dark:border-white/5 text-center">
              <p className="text-[9px] font-mono font-bold text-text-dim/30 dark:text-white/30 uppercase tracking-[0.2em]">
                Imergene Privacy Policy v2026.04
              </p>
            </footer>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <LayoutComponent>
      {content}
    </LayoutComponent>
  );
}