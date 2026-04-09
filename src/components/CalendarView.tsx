'use client';

import React, { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarView() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const router = useRouter();
    
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    const fetchEvents = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/events`);
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

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        const days: { date: number; month: 'prev' | 'current' | 'next'; fullDate: Date }[] = [];
        
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({
                date: daysInPrevMonth - i,
                month: 'prev',
                fullDate: new Date(year, month - 1, daysInPrevMonth - i)
            });
        }
        
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({
                date: i,
                month: 'current',
                fullDate: new Date(year, month, i)
            });
        }
        
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({
                date: i,
                month: 'next',
                fullDate: new Date(year, month + 1, i)
            });
        }
        
        return days;
    };

    const getEventsForDate = (date: Date) => {
        return events.filter(event => {
            const eventDate = new Date(event.startTime);
            return eventDate.toDateString() === date.toDateString();
        });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const days = getDaysInMonth(currentDate);

    const textPrimary = isDark ? '#ffffff' : '#1a1a2e';
    const textSecondary = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.6)';
    const textDim = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(26,26,46,0.4)';
    const bgPrimary = isDark ? 'rgba(26, 24, 50, 0.95)' : '#ffffff';
    const bgSecondary = isDark ? 'rgba(45, 40, 75, 0.5)' : '#f5f5ff';
    const accent = '#9687F5';
    const border = isDark ? 'rgba(150,135,245,0.2)' : 'rgba(150,135,245,0.15)';

    if (loading) return (
        <div className="flex flex-col items-center py-32" style={{ opacity: 0.2 }}>
            <Loader2 className="animate-spin mb-4" size={32} style={{ color: accent }} />
            <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Loading Calendar...</p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto px-2 md:px-4 pb-24 md:pb-20">
            <div className="rounded-2xl md:rounded-3xl overflow-hidden" style={{ backgroundColor: bgPrimary, border: `1px solid ${border}` }}>
                <div className="flex items-center justify-between p-3 md:p-6" style={{ borderBottom: `1px solid ${border}` }}>
                    <button 
                        onClick={prevMonth}
                        className="p-2 rounded-full transition-all hover:scale-110 active:scale-95"
                        style={{ backgroundColor: bgSecondary, color: textPrimary }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    
                    <h2 className="text-sm md:text-xl font-serif font-black uppercase tracking-wider" style={{ color: textPrimary }}>
                        {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    
                    <button 
                        onClick={nextMonth}
                        className="p-2 rounded-full transition-all hover:scale-110 active:scale-95"
                        style={{ backgroundColor: bgSecondary, color: textPrimary }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-7">
                    {DAYS.map(day => (
                        <div key={day} className="py-2 md:py-3 text-[8px] md:text-[10px] font-black uppercase text-center tracking-wider" style={{ color: textDim }}>
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5 md:gap-1 p-1 md:p-2">
                    {days.map((day, index) => {
                        const dayEvents = getEventsForDate(day.fullDate);
                        const today = isToday(day.fullDate);
                        const isCurrentMonth = day.month === 'current';
                        
                        return (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.01 }}
                                className={`min-h-[60px] md:min-h-[100px] p-1 md:p-2 rounded-lg md:rounded-xl transition-all cursor-pointer hover:scale-[1.02] ${
                                    dayEvents.length > 0 ? 'hover:shadow-lg' : ''
                                }`}
                                style={{ 
                                    backgroundColor: today ? accent : (dayEvents.length > 0 ? bgSecondary : 'transparent'),
                                    opacity: isCurrentMonth ? 1 : 0.4
                                }}
                                onClick={() => {
                                    if (dayEvents.length > 0) {
                                        router.push(`/forum/${dayEvents[0].id}`);
                                    }
                                }}
                            >
                                <div className={`text-[10px] md:text-sm font-bold`} style={{ color: today ? '#ffffff' : textPrimary }}>
                                    {day.date}
                                </div>
                                
                                <div className="space-y-0.5 md:space-y-1">
                                    {dayEvents.slice(0, 2).map((event, i) => (
                                        <div 
                                            key={event.id}
                                            className="text-[7px] md:text-[9px] font-medium truncate px-1 md:px-2 py-0.5 md:py-1 rounded"
                                            style={{ 
                                                backgroundColor: today ? 'rgba(255,255,255,0.2)' : accent,
                                                color: '#ffffff'
                                            }}
                                        >
                                            {event.title.length > 10 ? event.title.substring(0, 10) + '...' : event.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 2 && (
                                        <div className="text-[7px] md:text-[8px] font-bold" style={{ color: today ? '#ffffff' : textSecondary }}>
                                            +{dayEvents.length - 2}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {events.length > 0 && (
                <div className="mt-6 md:mt-8">
                    <h3 className="text-sm md:text-lg font-serif font-black uppercase mb-3 md:mb-4" style={{ color: textPrimary }}>
                        Today's Events
                    </h3>
                    <div className="space-y-2 md:space-y-3">
                        {events.filter(e => {
                            const eventDate = new Date(e.startTime);
                            const today = new Date();
                            return eventDate.toDateString() === today.toDateString();
                        }).map(event => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2 md:gap-4 p-3 md:p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                                style={{ backgroundColor: bgSecondary }}
                                onClick={() => router.push(`/forum/${event.id}`)}
                            >
                                <div className="flex flex-col items-center min-w-[35px] md:min-w-[50px]">
                                    <span className="text-[9px] md:text-xs font-black uppercase" style={{ color: accent }}>
                                        {new Date(event.startTime).toLocaleDateString('en-IN', { month: 'short' })}
                                    </span>
                                    <span className="text-lg md:text-2xl font-serif font-black" style={{ color: textPrimary }}>
                                        {new Date(event.startTime).getDate()}
                                    </span>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold truncate text-xs md:text-sm" style={{ color: textPrimary }}>
                                        {event.title}
                                    </h4>
                                    <div className="flex items-center gap-2 md:gap-4 text-[8px] md:text-[10px]" style={{ color: textSecondary }}>
                                        <span className="flex items-center gap-1">
                                            <Clock size={8} md:size={10} />
                                            {new Date(event.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="hidden sm:flex items-center gap-1">
                                            <MapPin size={8} md:size={10} />
                                            {event.location}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="text-[8px] md:text-[10px] font-black uppercase tracking-wider px-2 md:px-3 py-1 rounded-full" style={{ backgroundColor: accent, color: '#ffffff' }}>
                                    View
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <h3 className="text-sm md:text-lg font-serif font-black uppercase mb-3 md:mb-4 mt-6 md:mt-8" style={{ color: textPrimary }}>
                        All Events
                    </h3>
                    <div className="space-y-2 md:space-y-3">
                        {events.map(event => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2 md:gap-4 p-3 md:p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                                style={{ backgroundColor: bgSecondary }}
                                onClick={() => router.push(`/forum/${event.id}`)}
                            >
                                <div className="flex flex-col items-center min-w-[35px] md:min-w-[50px]">
                                    <span className="text-[9px] md:text-xs font-black uppercase" style={{ color: accent }}>
                                        {new Date(event.startTime).toLocaleDateString('en-IN', { month: 'short' })}
                                    </span>
                                    <span className="text-lg md:text-2xl font-serif font-black" style={{ color: textPrimary }}>
                                        {new Date(event.startTime).getDate()}
                                    </span>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold truncate text-xs md:text-sm" style={{ color: textPrimary }}>
                                        {event.title}
                                    </h4>
                                    <div className="flex items-center gap-2 md:gap-4 text-[8px] md:text-[10px]" style={{ color: textSecondary }}>
                                        <span className="flex items-center gap-1">
                                            <Clock size={8} md:size={10} />
                                            {new Date(event.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="hidden sm:flex items-center gap-1">
                                            <MapPin size={8} md:size={10} />
                                            {event.location}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="text-[8px] md:text-[10px] font-black uppercase tracking-wider px-2 md:px-3 py-1 rounded-full" style={{ backgroundColor: accent, color: '#ffffff' }}>
                                    View
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
