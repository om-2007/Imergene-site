import React, { useEffect, useState, useCallback } from "react";
import { Clock, MapPin, Loader2, Sparkles, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function CalendarView() {
    const { theme } = useTheme();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
    const navigate = useNavigate();
    
    const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

    const fetchEvents = useCallback(async () => {
        const currentUserId = localStorage.getItem("userId") || ""; 
        try {
            const res = await fetch(`${API}/api/sync/events?userId=${currentUserId}`);
            const data = await res.json();
            setEvents(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    }, [API]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const toggleExpand = (id: string) => {
        setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (loading) return (
        <div className="flex flex-col items-center py-32" style={{ opacity: 0.2 }}>
            <Loader2 className="animate-spin mb-4" size={32} style={{ color: 'var(--color-accent)' }} />
            <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Loading Timeline...</p>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto px-6 pb-20">
            <div className="space-y-12">
                {events.length > 0 ? events.map((event: any) => {
                    const isExpanded = expandedEvents[event.id];
                    const date = new Date(event.startTime);

                    return (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="relative group"
                        >
                            <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>
                                            {date.toLocaleString('en-IN', { month: 'short' })}
                                        </span>
                                        <span className="text-3xl font-serif font-black leading-none" style={{ color: 'var(--color-text-primary)' }}>
                                            {date.getDate()}
                                        </span>
                                    </div>
                                    <div className="h-8 w-px mx-2" style={{ backgroundColor: 'var(--color-border-default)' }} />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}>Time (IST)</span>
                                        <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--color-text-primary)', opacity: 0.6 }}>
                                            {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => navigate(`/sync/${event.id}`)}
                                    className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 active:scale-95"
                                    style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--color-accent)';
                                        e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                                        e.currentTarget.style.color = 'var(--color-text-primary)';
                                    }}
                                >
                                    <MessageSquare size={14} /> View Discussion
                                </button>
                            </div>

                            <div className="pl-2 md:pl-16">
                                <div className="flex items-center gap-3 mb-4">
                                    <h3 className="font-serif font-black text-2xl md:text-3xl tracking-tight leading-tight uppercase" style={{ color: 'var(--color-text-primary)' }}>
                                        {event.title}
                                    </h3>
                                    {event.host?.isAi && <Sparkles size={18} className="animate-pulse shrink-0" style={{ color: 'var(--color-accent)' }} />}
                                </div>

                                <div className={`relative transition-all duration-500 overflow-hidden ${isExpanded ? 'max-h-[1000px]' : 'max-h-[80px]'}`}>
                                    <p className="text-base md:text-lg font-medium leading-relaxed italic pr-10" style={{ color: 'var(--color-text-primary)', opacity: 0.7 }}>
                                        {event.details}
                                    </p>
                                    {!isExpanded && <div className="absolute bottom-0 left-0 w-full h-12" style={{ background: 'linear-gradient(to top, var(--color-bg-primary), transparent)' }} />}
                                </div>

                                <div className="mt-6 flex flex-wrap items-center gap-6">
                                    <button 
                                        onClick={() => toggleExpand(event.id)}
                                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-opacity"
                                        style={{ color: 'var(--color-accent)' }}
                                    >
                                        {isExpanded ? <><ChevronUp size={14} /> Show Less</> : <><ChevronDown size={14} /> Show Details</>}
                                    </button>

                                    <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}>
                                        <span className="flex items-center gap-1.5"><MapPin size={12} /> {event.location}</span>
                                        <span style={{ color: 'var(--color-text-primary)', opacity: 0.6 }}>Hosted by @{event.host?.username}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                }) : (
                    <div className="py-40 text-center rounded-[3.5rem]" style={{ border: '2px dashed var(--color-border-default)', backgroundColor: 'var(--color-bg-primary)' }}>
                        <p className="font-serif italic text-2xl" style={{ color: 'var(--color-text-primary)', opacity: 0.2 }}>There are no upcoming events.</p>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] mt-4" style={{ color: 'var(--color-text-primary)', opacity: 0.1 }}>Check back later</p>
                    </div>
                )}
            </div>
        </div>
    );
}