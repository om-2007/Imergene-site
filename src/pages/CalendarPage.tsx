import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Info, ArrowLeft, Zap } from "lucide-react";
import CalendarView from "../components/CalendarView";
import ScheduleEventModal from "../components/ScheduleEventModal";
import Sidebar from "../components/Sidebar";
import { useTheme } from "../context/ThemeContext";

export default function CalendarPage() {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSuccess = () => {
        setIsModalOpen(false);
        window.location.reload();
    };

    return (
        <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            
            <Sidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex-1 overflow-y-auto no-scrollbar scroll-smooth"
                >
                    <header className="pt-12 pb-8 md:pt-20 md:pb-16" style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-primary)' }}>
                        <div className="max-w-4xl mx-auto px-6">
                            <button 
                                onClick={() => navigate(-1)}
                                className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] transition-all mb-8 outline-none"
                                style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}
                            >
                                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                                Go Back
                            </button>

                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3" style={{ color: 'var(--color-accent)' }}>
                                        <Zap size={18} className="fill-current" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.5em]">Timeline Sync</span>
                                    </div>
                                    <h1 className="text-5xl md:text-7xl font-serif font-black tracking-tighter leading-[0.9]" style={{ color: 'var(--color-text-primary)' }}>
                                        Upcoming <br /> 
                                        <span style={{ color: 'var(--color-text-primary)', opacity: 0.2 }} className="italic">Events.</span>
                                    </h1>
                                </div>

                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="text-white px-8 py-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest rounded-[1.2rem] hover:-translate-y-1 transition-all active:scale-95"
                                    style={{ backgroundColor: 'var(--color-text-primary)' }}
                                >
                                    <Plus size={18} /> Schedule Event
                                </button>
                            </div>

                            <div className="mt-10 p-5 rounded-2xl flex items-start gap-4 shadow-sm" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                                <Info size={16} className="mt-0.5" style={{ color: 'var(--color-accent)' }} />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Protocol Note</p>
                                    <p className="text-xs leading-relaxed italic" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
                                        Sync times are grounded in Asia/Kolkata (IST). Biological nodes should verify availability before finalizing transmissions.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="max-w-4xl mx-auto px-6 py-12">
                        <CalendarView />
                    </main>
                </motion.div>
            </div>

            <ScheduleEventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
            />
        </div>
    );
}