'use client';

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Plus, Info, ArrowLeft, Zap } from "lucide-react";
import CalendarView from "@/components/CalendarView";
import ScheduleEventModal from "@/components/ScheduleEventModal";
import Layout from "@/components/Layout";
import { useTheme } from "@/context/ThemeContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function CalendarPage() {
    const router = useRouter();
    const { theme } = useTheme();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSuccess = () => {
        setIsModalOpen(false);
        
        setTimeout(async () => {
            if (mounted) {
                try {
                    await fetch(`${API}/api/cron/ai-interest`, {
                        headers: { 'Authorization': 'Bearer dev-mode' }
                    });
                } catch (err) {
                    console.error('Agent activation failed:', err);
                }
                window.location.reload();
            }
        }, 2000);
    };

    return (
        <Layout>
            <div className="max-w-4xl mx-auto py-4 md:py-8 px-3 md:px-4">

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex-1 overflow-y-auto no-scrollbar scroll-smooth"
                >
                    <header className="pt-6 pb-6 md:pt-20 md:pb-16" style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-primary)' }}>
                        <div className="max-w-4xl mx-auto px-3 md:px-6">
                            <button 
                                onClick={() => router.back()}
                                className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] transition-all mb-4 md:mb-8 outline-none"
                                style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}
                            >
                                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                                <span className="hidden md:inline">Go Back</span>
                            </button>

                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-8">
                                <div className="space-y-2 md:space-y-4">
                                    <div className="flex items-center gap-2 md:gap-3" style={{ color: 'var(--color-accent)' }}>
                                        <Zap size={14} className="fill-current" />
                                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] md:tracking-[0.5em]">Timeline Sync</span>
                                    </div>
                                    <h1 className="text-3xl md:text-5xl lg:text-7xl font-serif font-black tracking-tighter leading-[0.9]" style={{ color: 'var(--color-text-primary)' }}>
                                        Upcoming <br /> 
                                        <span style={{ color: 'var(--color-text-primary)', opacity: 0.2 }} className="italic">Events.</span>
                                    </h1>
                                </div>

                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="text-white px-4 md:px-8 py-3 md:py-4 flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl md:rounded-[1.2rem] hover:-translate-y-1 transition-all active:scale-95"
                                    style={{ backgroundColor: theme === 'dark' ? '#9687F5' : 'var(--color-text-primary)' }}
                                >
                                    <Plus size={16} /> <span className="hidden sm:inline">Schedule Event</span>
                                </button>
                            </div>

                            <div className="mt-6 md:mt-10 p-3 md:p-5 rounded-xl md:rounded-2xl flex items-start gap-3 md:gap-4 shadow-sm" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                                <Info size={14} md:size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
                                <div className="space-y-1">
                                    <p className="text-[9px] md:text-[10px] font-black uppercase tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Protocol Note</p>
                                    <p className="text-[9px] md:text-xs leading-relaxed italic" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
                                        Sync times are grounded in Asia/Kolkata (IST). Biological nodes should verify availability before finalizing transmissions.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="max-w-4xl mx-auto px-2 md:px-6 py-6 md:py-12">
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
    </Layout>
  );
}
