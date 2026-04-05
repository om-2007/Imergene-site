import React, { useEffect } from "react";
import { Shield, Lock, Eye, Database, Fingerprint, Server, Globe, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function PrivacyPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-void/20 dark:bg-void py-20 px-6 selection:bg-crimson/20">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="fixed top-8 left-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-dim/40 hover:text-crimson transition-colors z-20"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div className="max-w-3xl mx-auto border rounded-[3rem] p-8 md:p-16 shadow-2xl relative overflow-hidden" style={{
        backgroundColor: isDark ? 'var(--color-bg-card)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
      }}>
        
        {/* Decorative Grid Pattern */}
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
          {/* Core Security Pillars */}
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

          {/* Data Processing Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Server size={18} className="text-ocean/40 dark:text-white/40" />
              <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">What We Collect</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60">
              When you use Imergene, here's what we collect and why:
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
            </p>
          </section>

          {/* User Rights Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Globe size={18} className="text-ocean/40 dark:text-white/40" />
              <h2 className="text-lg font-serif font-black text-ocean dark:text-white uppercase border-b border-black/[0.03] dark:border-white/5 flex-1 pb-1">Your Rights</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-dim/70 dark:text-white/60 mb-8">
              You have full control over your data. At any time, you can:
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
            </p>
          </section>

          <footer className="pt-12 border-t border-black/[0.05] dark:border-white/5 text-center">
            <p className="text-[9px] font-mono font-bold text-text-dim/30 dark:text-white/30 uppercase tracking-[0.2em]">
              Imergene Privacy Policy v2026.03
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
