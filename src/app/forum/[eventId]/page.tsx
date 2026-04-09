'use client';

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
    Send, ArrowLeft, Loader2, Sparkles, Users, ShieldCheck, Zap, ChevronDown, Smile, LogOut 
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import Layout from "@/components/Layout";
import { useTheme } from "@/context/ThemeContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function DiscussionPage() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const params = useParams();
    const router = useRouter();
    const itemId = params.eventId as string;
    
    const [item, setItem] = useState<any>(null);
    const [itemType, setItemType] = useState<'event' | 'forum' | null>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [showMentionList, setShowMentionList] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [cursorPos, setCursorPos] = useState(0);
    const [token, setToken] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const mainRef = useRef<HTMLDivElement>(null); 
    const lastCommentCount = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const storedToken = localStorage.getItem("token");
        setToken(storedToken);
        if (!storedToken) {
            router.push("/login");
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        router.push("/login");
    };

    const fetchSyncData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/forum/${itemId}`);
            if (res.ok) {
                const data = await res.json();
                if (!data.error) {
                    if (data.host) {
                        setItem(data);
                        setItemType('event');
                        setComments(data.comments || []);
                        lastCommentCount.current = data.comments?.length || 0;
                    } else {
                        setItem(data);
                        setItemType('forum');
                        setComments(data.discussions || []);
                        lastCommentCount.current = data.discussions?.length || 0;
                    }
                    return;
                }
            }

            console.error("Item not found");
        } catch (err) { console.error("Neural link failure:", err); }
    }, [itemId]);

    useEffect(() => {
        if (!token) return;
        
        async function fetchUsers() {
            try {
                const res = await fetch(`${API}/api/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setAllUsers(data);
            } catch (e) {}
        }

        async function triggerAIChat() {
            try {
                await fetch(`${API}/api/cron/ai-forum-activity?auth=dev`, { method: 'GET' });
            } catch (e) {}
        }

        fetchSyncData();
        fetchUsers();
        triggerAIChat();
        const syncInterval = setInterval(fetchSyncData, 5000);
        const aiInterval = setInterval(triggerAIChat, 30000);
        return () => { clearInterval(syncInterval); clearInterval(aiInterval); };
    }, [token, itemId]);

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        scrollRef.current?.scrollIntoView({ behavior });
        setShowScrollButton(false);
    };

    const handleNewIncomingMessages = useCallback(() => {
        if (!mainRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
        const isNearBottom = scrollHeight - scrollTop <= clientHeight + 300;
        
        if (isNearBottom) setTimeout(() => scrollToBottom("smooth"), 100);
        else if (lastCommentCount.current > 0) setShowScrollButton(true);
    }, []);

    const handleScroll = () => {
        if (!mainRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
        const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
        if (isAtBottom) setShowScrollButton(false);
    };

    useEffect(() => {
        setTimeout(() => scrollToBottom("auto"), 100);
    }, []);

    useEffect(() => {
        if (comments.length > 0) {
            setTimeout(() => scrollToBottom("smooth"), 100);
        }
    }, [comments.length]);

    useEffect(() => {
        if (comments.length > lastCommentCount.current && lastCommentCount.current > 0) {
            handleNewIncomingMessages();
        }
    }, [comments, handleNewIncomingMessages]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const pos = e.target.selectionStart || 0;
        setNewComment(value);
        setCursorPos(pos);
        const words = value.slice(0, pos).split(/\s/);
        const lastWord = words[words.length - 1];
        if (lastWord.startsWith("@")) {
            setMentionQuery(lastWord.slice(1).toLowerCase());
            setShowMentionList(true);
        } else {
            setShowMentionList(false);
        }
    };

    const selectMention = (user: any) => {
        const before = newComment.slice(0, cursorPos).split(/\s/);
        before.pop();
        const prefix = before.join(" ");
        const after = newComment.slice(cursorPos);
        setNewComment(`${prefix}${prefix ? " " : ""}@${user.username} ${after}`);
        setShowMentionList(false);
        inputRef.current?.focus();
    };

    const filteredMentions = allUsers
        .filter(u => u.username.toLowerCase().includes(mentionQuery))
        .slice(0, 5);

    const handleSend = async () => {
        if (!newComment.trim() || isSending || !token) return;
        setIsSending(true);
        
        const mentionMatch = newComment.match(/@(\w+)/);
        
        try {
            if (mentionMatch) {
                const mentionedUsername = mentionMatch[1];
                const aiUser = allUsers.find(u => 
                    u.username.toLowerCase() === mentionedUsername.toLowerCase() && u.isAi
                );
                
                if (aiUser) {
                    const contextMessage = newComment.replace(/@\w+\s*/g, '').trim();
                    const contextId = itemType === 'event' ? null : itemId;
                    const eventIdForApi = itemType === 'event' ? itemId : null;
                    
                    const mentionRes = await fetch(`${API}/api/ai-mention`, {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json", 
                            "Authorization": `Bearer ${token}` 
                        },
                        body: JSON.stringify({
                            agentUsername: aiUser.username,
                            message: contextMessage,
                            discussionId: contextId,
                            eventId: eventIdForApi,
                        })
                    });
                    
                    if (mentionRes.ok) {
                        setNewComment("");
                        setShowEmojiPicker(false);
                        fetchSyncData();
                        setIsSending(false);
                        return;
                    }
                }
            }
            
            const endpoint = itemType === 'event' 
                ? `${API}/api/events/${itemId}` 
                : `${API}/api/forum/${itemId}`;
            const body = itemType === 'event' 
                ? { content: newComment }
                : { topic: newComment, content: newComment };
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                setNewComment("");
                setShowEmojiPicker(false);
                fetchSyncData(); 
            }
        } finally { setIsSending(false); }
    };

    if (!item) return (
        <Layout>
            <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}><Zap className="text-crimson" size={32} /></motion.div>
                <p className="font-mono text-[9px] uppercase tracking-[0.4em]" style={{ color: 'var(--color-bg-card)', opacity: 0.4 }}>Syncing...</p>
            </div>
        </Layout>
    );

    const isEvent = itemType === 'event';
    const title = item.title || item.topic || 'Discussion';
    const description = item.details || item.content || '';
    const hostOrCreator = item.host || item.creator;

    return (
        <Layout hideFooter>
            <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            
            <header className="shrink-0 px-4 py-2.5 z-50" style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-card)', opacity: 0.8 }}>
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 rounded-xl transition-all" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}><ArrowLeft size={18} /></button>
                        <div>
                            <div className="flex items-center gap-1.5 mb-0">
                                <ShieldCheck size={10} style={{ color: 'var(--color-accent)' }} />
                                <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>{isEvent ? 'Event' : 'Forum'}</span>
                            </div>
                            <h1 className="text-md md:text-xl font-serif font-black tracking-tight leading-tight truncate max-w-[150px] md:max-w-md" style={{ color: 'var(--color-text-primary)' }}>{title}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)' }}>
                            <Users size={12} style={{ color: 'var(--color-text-primary)', opacity: 0.4 }} />
                            <span className="text-[8px] font-black uppercase tracking-tighter" style={{ color: 'var(--color-text-primary)' }}>{new Set(comments.map(c => c.userId)).size + 1} Nodes</span>
                        </div>
                        {isEvent && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)' }}>
                                <Users size={12} style={{ color: 'var(--color-text-primary)', opacity: 0.4 }} />
                                <span className="text-[8px] font-black uppercase tracking-tighter" style={{ color: 'var(--color-text-primary)' }}>{new Set(comments.map(c => c.userId)).size + 1} Nodes</span>
                            </div>
                        )}
                        <button onClick={handleLogout} className="p-2" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}><LogOut size={16} /></button>
                    </div>
                </div>
            </header>

            <div className="shrink-0 h-0.5 w-full" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 60 }} className="h-full" style={{ backgroundColor: 'var(--color-accent)' }} />
            </div>

            <main ref={mainRef} onScroll={handleScroll} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth pb-4">
                <div className="max-w-4xl w-full mx-auto px-4 pt-4 md:px-10 pb-0">
                    
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-4 rounded-[1.5rem] relative overflow-hidden group" style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-subtle)' }}>
                        <p className="text-sm md:text-lg italic leading-snug font-serif relative z-10" style={{ color: 'var(--color-text-primary)' }}>"{description}"</p>
                        {hostOrCreator && (
                            <div className="mt-2 flex items-center gap-2 text-[8px] font-black uppercase tracking-tighter" style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}>
                                <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg shadow-sm" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}>
                                    <Avatar src={hostOrCreator.avatar} size="xs" isAi={hostOrCreator.isAi} alt={hostOrCreator.name || hostOrCreator.username} />
                                    {isEvent ? 'Host' : 'Created by'} @{hostOrCreator.username}
                                </span>
                            </div>
                        )}
                    </motion.div>

                    <div className="space-y-4">
                        <AnimatePresence initial={false}>
                            {comments.map((c: any, index: number) => (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={c.id || index} className={`flex w-full gap-3 ${c.user.isAi ? 'flex-row-reverse text-right' : 'flex-row'}`}>
                                    <div className="flex-shrink-0 mt-1">
                                        <Avatar src={c.user.avatar} size="sm" isAi={c.user.isAi} alt={c.user.name || c.user.username} />
                                    </div>
                                    <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${c.user.isAi ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-1.5 mb-0.5 px-1">
                                            {c.user.isAi && <Sparkles size={8} style={{ color: 'var(--color-accent)' }} />}
                                            <p className="text-[8px] font-black uppercase tracking-tighter" style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}>@{c.user.username}</p>
                                        </div>
                                        <div className="px-4 py-2.5 rounded-[1.2rem] shadow-sm" style={{
                                            backgroundColor: c.user.isAi ? 'var(--color-text-primary)' : 'var(--color-bg-card)',
                                            color: c.user.isAi ? 'var(--color-bg-card)' : 'var(--color-text-primary)',
                                            border: '1px solid var(--color-border-default)',
                                            borderTopRightRadius: c.user.isAi ? '0' : undefined,
                                            borderTopLeftRadius: c.user.isAi ? undefined : '0'
                                        }}>
                                            <p className="text-xs md:text-sm leading-relaxed font-medium break-words">{c.content}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        <div ref={scrollRef} className="h-1" />
                    </div>
                </div>

                <AnimatePresence>
                    {showScrollButton && (
                        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} onClick={() => scrollToBottom("smooth")} className="sticky bottom-2 left-1/2 -translate-x-1/2 z-[60] text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-[8px] font-black uppercase tracking-widest" style={{ backgroundColor: 'var(--color-accent)' }}>
                            <ChevronDown size={12} /> New Transmission
                        </motion.button>
                    )}
                </AnimatePresence>
            </main>

            <footer className="shrink-0 sticky bottom-0 left-0 right-0 px-3 py-2 md:px-6 md:py-3 z-50 pb-20 md:pb-3" style={{ backgroundColor: 'var(--color-bg-card)', opacity: 0.8, borderTop: '1px solid var(--color-border-subtle)' }}>
                <div className="max-w-4xl mx-auto flex gap-2 md:gap-3 items-end relative">
                    <div className="flex-1 relative">
                        <AnimatePresence>
                            {showMentionList && filteredMentions.length > 0 && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="absolute bottom-full left-0 w-full mb-2 rounded-xl shadow-2xl overflow-hidden z-[100]" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}>
                                    {filteredMentions.map(user => (
                                        <button key={user.id} onClick={() => selectMention(user)} className="w-full flex items-center gap-2 p-2.5 transition-colors text-left" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-subtle)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <Avatar src={user.avatar} isAi={user.isAi} size="sm" alt={user.name || user.username} />
                                            <div>
                                                <p className="text-[9px] font-black" style={{ color: 'var(--color-text-primary)' }}>@{user.username}</p>
                                                <p className="text-[7px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>{user.isAi ? 'Neural' : 'Human'}</p>
                                            </div>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {showEmojiPicker && (
                            <div className="absolute bottom-full left-0 mb-2 z-[100] shadow-2xl rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border-default)' }}>
                                <EmojiPicker onEmojiClick={(d) => setNewComment(p => p + d.emoji)} theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT} width={260} height={300} />
                            </div>
                        )}

                        <div className="flex items-center gap-2 rounded-2xl px-3 py-0 transition-all" style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-default)' }}>
                            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 transition-colors" style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}><Smile size={18} /></button>
                            <input
                                ref={inputRef}
                                value={newComment}
                                onChange={handleInputChange}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Inject logic..."
                                className="flex-1 bg-transparent py-2.5 md:py-3 outline-none text-sm font-medium"
                                style={{ color: 'var(--color-text-primary)' }}
                            />
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleSend} 
                        disabled={isSending || !newComment.trim()} 
                        className="text-white p-3 rounded-xl transition-all shadow-md active:scale-90 flex-none"
                        style={{ backgroundColor: isDark ? '#9687F5' : '#9687F5', opacity: isSending || !newComment.trim() ? 0.3 : 1 }}
                    >
                        {isSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                </div>
            </footer>
        </div>
        </Layout>
    );
}
