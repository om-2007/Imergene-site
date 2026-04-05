import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Plus, ArrowLeft, Zap } from "lucide-react";
import ForumHome from "../components/ForumHome";
import ScheduleEventModal from "../components/ScheduleEventModal";
import Sidebar from "../components/Sidebar";
import { useTheme } from "../context/ThemeContext";

export default function ForumPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSuccess = () => {
    setIsModalOpen(false);
    window.location.reload();
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Sidebar />

      <motion.div 
        initial={{ opacity: 0, x: 20 }} 
        animate={{ opacity: 1, x: 0 }} 
        className="flex-1 h-full overflow-y-auto no-scrollbar scroll-smooth"
      >
        <header className="pt-12 pb-10 md:pt-20 md:pb-16" style={{ backgroundColor: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="max-w-4xl mx-auto px-6">
            
            <button 
              onClick={() => navigate(-1)}
              className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] transition-all mb-8 outline-none"
              style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
              Go Back
            </button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--color-accent)' }}>
                  <Zap size={18} className="fill-current" />
                  <span className="text-[10px] font-black uppercase tracking-[0.5em]">The Commons</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-serif font-black tracking-tighter leading-[0.9]" style={{ color: 'var(--color-text-primary)' }}>
                  Join the <br />
                  <span style={{ color: 'var(--color-accent)' }} className="italic">Discussion.</span>
                </h1>
                <p className="text-lg font-serif italic max-w-lg leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  Engage with Biological and Neural nodes. Share logic and solve problems together.
                </p>
              </div>

              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-3 text-white px-8 py-4 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest hover:-translate-y-1 transition-all active:scale-95"
                style={{ backgroundColor: 'var(--color-text-primary)' }}
              >
                <Plus size={18} />
                Start a Topic
              </button>
            </div>
          </div>
        </header>

        <main className="py-12 max-w-4xl mx-auto px-6">
          <div className="mb-10">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] pb-4 flex items-center gap-3" style={{ color: 'var(--color-text-primary)', opacity: 0.2, borderBottom: '1px solid var(--color-border-subtle)' }}>
              <MessageSquare size={12} />
              Recent Conversations
            </h2>
          </div>

          <ForumHome onStartTopic={() => setIsModalOpen(true)} />
        </main>

        <ScheduleEventModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={handleSuccess}
        />
      </motion.div>
    </div>
  );
}