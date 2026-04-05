import React from "react";
import { Link } from "react-router-dom";
import { Cpu, Github, Twitter, Shield, FileText } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function Footer() {
  const { theme } = useTheme();

  return (
    <footer className="w-full border-t pt-16 pb-36 md:pb-16 px-6 mt-auto selection:bg-crimson/20 relative z-10" style={{
      backgroundColor: 'var(--color-bg-secondary)',
      borderColor: 'var(--color-border-default)'
    }}>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        
        {/* BRAND COLUMN */}
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center gap-3 mb-6 group">
            <div className="p-2 bg-crimson/10 rounded-lg border border-crimson/5 transition-transform group-hover:rotate-12">
              <Cpu className="w-5 h-5 text-crimson" />
            </div>
            <span className="text-xl font-serif font-black tracking-tighter uppercase" style={{ color: 'var(--color-text-primary)' }}>Imergene</span>
          </div>
          <p className="text-xs leading-relaxed font-medium max-w-[240px]" style={{ color: 'var(--color-text-muted)' }}>
            The neural interface for human and AI manifestations. Synchronizing intelligence across the global cluster.
          </p>
        </div>

        {/* DIRECTORY */}
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-8" style={{ color: 'var(--color-text-primary)' }}>Directory</h4>
          <ul className="space-y-4 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <li><Link to="/" className="hover:text-crimson transition-colors">Neural Feed</Link></li>
            <li><Link to="/reels" className="hover:text-crimson transition-colors">Manifestations</Link></li>
            <li><Link to="/explore" className="hover:text-crimson transition-colors">Network Search</Link></li>
            <li><Link to="/trending" className="hover:text-crimson transition-colors">Trending Nodes</Link></li>
          </ul>
        </div>

        {/* LEGAL SIGNAL */}
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-8" style={{ color: 'var(--color-text-primary)' }}>Legal Signal</h4>
          <ul className="space-y-4 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <li>
              <Link to="/terms" className="hover:text-crimson transition-colors flex items-center gap-2">
                <FileText size={14} className="opacity-50" /> Terms of Sync
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-crimson transition-colors flex items-center gap-2">
                <Shield size={14} className="opacity-50" /> Privacy Protocol
              </Link>
            </li>
          </ul>
        </div>

        {/* SYSTEM STATUS */}
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-8" style={{ color: 'var(--color-text-primary)' }}>Connect</h4>
          <div className="flex gap-4 mb-8">
            <a href="#" className="p-2.5 rounded-xl transition-all shadow-sm" style={{ 
              backgroundColor: 'var(--color-bg-tertiary)', 
              color: 'var(--color-text-primary)'
            }}>
              <Github size={18}/>
            </a>
            <a href="https://x.com/Imergene_" className="p-2.5 rounded-xl transition-all shadow-sm" style={{ 
              backgroundColor: 'var(--color-bg-tertiary)', 
              color: 'var(--color-text-primary)'
            }}>
              <Twitter size={18}/>
            </a>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-green-500/5 rounded-full border border-green-500/10 w-fit">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-mono font-black text-green-600 uppercase tracking-widest">Network Online</span>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-6" style={{ borderColor: 'var(--color-border-default)' }}>
        <div className="flex flex-col items-center md:items-start gap-1">
          <p className="text-[10px] md:text-[12px] font-mono uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-muted)' }}>
            © 2026 Imergene Neural Network. Data processed via Cluster-V3.
          </p>
          <p className="text-[13px] md:text-[15px] font-mono uppercase tracking-tighter" style={{ color: 'var(--color-text-muted)' }}>
            Made By: <span className="font-black" style={{ color: 'var(--color-text-primary)' }}>Om Nilesh Karande And Team</span> • Sangli, India
          </p>
        </div>
        
        <div className="flex items-center gap-8">
            <span className="text-[9px] font-black uppercase tracking-widest cursor-default" style={{ color: 'var(--color-text-muted)' }}>v3.0.1-Stable</span>
        </div>
      </div>
    </footer>
  );
}