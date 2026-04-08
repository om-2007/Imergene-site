'use client';

import React, { useState, useEffect, useRef, useCallback, lazy } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
    Send, 
    ChevronLeft, 
    Smile, 
    CheckCheck, 
    Zap, 
    Cpu, 
    Loader2, 
    AlertCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "@/components/Avatar";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import Layout from "@/components/Layout";
import { useTheme } from "@/context/ThemeContext";

const PostCard = lazy(() => import("@/components/PostCard"));

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function ChatDetailsPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    
    const [messages, setMessages] = useState<any[]>([]);
    const [otherUser, setOtherUser] = useState<any>(null);
    const [input, setInput] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [mentionIndex, setMentionIndex] = useState(0);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
    const [token, setToken] = useState<string | null>(null);
    const [myUsername, setMyUsername] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const emojiRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const scrollTop = useRef(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const storedToken = localStorage.getItem("token");
        const storedUsername = localStorage.getItem("username");
        setToken(storedToken);
        setMyUsername(storedUsername);
        if (!storedToken) {
            router.push("/login");
        }
    }, [router]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!chatContainerRef.current) return;
        isDragging.current = true;
        chatContainerRef.current.classList.add('active-drag');
        startY.current = e.pageY - chatContainerRef.current.offsetTop;
        scrollTop.current = chatContainerRef.current.scrollTop;
    };

    const handleMouseLeave = () => {
        isDragging.current = false;
        chatContainerRef.current?.classList.remove('active-drag');
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        chatContainerRef.current?.classList.remove('active-drag');
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !chatContainerRef.current) return;
        e.preventDefault();
        const y = e.pageY - chatContainerRef.current.offsetTop;
        const walk = (y - startY.current) * 1.5;
        chatContainerRef.current.scrollTop = scrollTop.current - walk;
    };

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        if (chatContainerRef.current && !isDragging.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior
            });
        }
    };

    const renderMessageWithMentions = (content: string) => {
        const parts = content.split(/(@\w+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                const username = part.slice(1);
                return (
                    <span 
                        key={i} 
                        className="font-bold cursor-pointer hover:underline transition-all"
                        style={{ color: isDark ? '#C4B5FD' : '#7C3AED' }}
                        onClick={() => router.push(`/profile/${username}`)}
                    >
                        {part}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    const broadcastTyping = async (isTyping: boolean) => {
        if (!token) return;
        try {
            await fetch(`${API}/api/chat/conversations/${id}/typing`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ isTyping })
            });
        } catch (err) {}
    };

    const loadChat = useCallback(async (isInitial = false) => {
        const currentToken = localStorage.getItem("token");
        const currentUsername = localStorage.getItem("username");
        
        if (!currentToken || !id) return;
        try {
            const res = await fetch(`${API}/api/chat/${id}`, {
                headers: { Authorization: `Bearer ${currentToken}` }
            });
            
            if (!res.ok) throw new Error("Sync Interrupted");
            
            const data = await res.json();
            const newMessages = data.messages || [];

            const container = chatContainerRef.current;
            const isAtBottom = container ? (container.scrollHeight - container.scrollTop <= container.clientHeight + 150) : true;

            setMessages(newMessages);
            setOtherUser(data.participants?.find((p: any) => p.username !== currentUsername));

            if (isInitial || (isAtBottom && newMessages.length > messages.length)) {
                setTimeout(() => scrollToBottom(isInitial ? "auto" : "smooth"), 60);
            }

            setIsOtherTyping(!!data.lastTypingId && data.lastTypingId !== localStorage.getItem("userId"));
            setError(null);
        } catch (err) { 
            if (isInitial) setError("Connection to node lost.");
        }
    }, [id]);

    useEffect(() => {
        loadChat(true);
        const interval = setInterval(() => loadChat(false), 3000);
        return () => clearInterval(interval);
    }, [id]);

    useEffect(() => {
        async function fetchUsers() {
            const currentToken = localStorage.getItem("token");
            if (!currentToken) return;
            try {
                const res = await fetch(`${API}/api/users`, {
                    headers: { Authorization: `Bearer ${currentToken}` }
                });
                const data = await res.json();
                if (Array.isArray(data)) setAllUsers(data);
            } catch (err) {
                console.error('Failed to fetch users for mentions:', err);
            }
        }
        fetchUsers();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInput(value);

        if (!typingTimeoutRef.current) broadcastTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            broadcastTyping(false);
            typingTimeoutRef.current = null;
        }, 3000);

        const lastWord = value.split(" ").pop() || "";
        if (lastWord.startsWith("@")) {
            const query = lastWord.slice(1).toLowerCase();
            const matches = allUsers.filter(u =>
                u.username.toLowerCase().includes(query) || (u.name && u.name.toLowerCase().includes(query))
            ).slice(0, 5);
            setFilteredUsers(matches);
            setMentionSearch(query);
            setMentionIndex(0);
            setShowMentions(matches.length > 0);
        } else { 
            setShowMentions(false);
            setMentionSearch("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showMentions || filteredUsers.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMentionIndex(i => Math.min(i + 1, filteredUsers.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMentionIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (filteredUsers[mentionIndex]) {
                insertMention(filteredUsers[mentionIndex].username);
            }
        } else if (e.key === 'Escape') {
            setShowMentions(false);
        }
    };

    const insertMention = (username: string) => {
        const words = input.split(" ");
        words.pop();
        setInput([...words, `@${username} `].join(" "));
        setShowMentions(false);
        setMentionSearch("");
        inputRef.current?.focus();
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isSending) return;
        if (!token) return;
        setIsSending(true);

        const optimisticId = Date.now().toString();
        const mentionedUsernames = input.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
        
        const optimisticMsg = {
            id: optimisticId,
            content: input,
            sender: { username: myUsername },
            createdAt: new Date().toISOString(),
            sending: true,
            mentions: mentionedUsernames
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setInput("");
        setShowEmojiPicker(false);
        setShowMentions(false);
        setMentionSearch("");
        setTimeout(() => scrollToBottom("smooth"), 50);

        try {
            const res = await fetch(`${API}/api/chat/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ 
                    content: optimisticMsg.content,
                    mentions: mentionedUsernames
                })
            });
            if (res.ok) {
                const confirmedMsg = await res.json();
                setMessages(prev => prev.map(m => m.id === optimisticId ? confirmedMsg : m));
            }
        } catch (err) {}
        finally { setIsSending(false); }
    };

    if (error) return (
        <Layout>
            <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
                <AlertCircle className="w-10 h-10 text-crimson opacity-40" />
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}>{error}</p>
                <button onClick={() => window.location.reload()} className="btn-action">Re-establish Link</button>
            </div>
        </Layout>
    );

    if (!otherUser) return (
        <Layout>
            <div className="flex items-center justify-center h-[70vh]">
                <Loader2 className="w-6 h-6 text-crimson animate-spin opacity-20" />
            </div>
        </Layout>
    );

    return (
        <Layout>
            <div className="max-w-3xl mx-auto h-[calc(100vh-80px)] flex flex-col pt-6 px-4 pb-28 md:pb-0 selection:bg-crimson/20 overflow-hidden">
            <div className="!p-3 !mb-4 flex items-center gap-4 shrink-0" style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '1.25rem'
            }}>
                <Link href="/messages" className="p-2 rounded-full" style={{ color: 'var(--color-text-muted)' }}>
                    <ChevronLeft size={20} />
                </Link>
                <Avatar src={otherUser.avatar} alt={otherUser.name || otherUser.username || "User"} isAi={otherUser.isAi} className="border" />
                <div className="flex-1 min-w-0">
                    <h2 className="font-serif font-bold text-sm tracking-tight truncate" style={{ color: 'var(--color-text-primary)' }}>{otherUser.name || otherUser.username}</h2>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${otherUser.isAi ? 'bg-crimson animate-pulse' : 'bg-green-500'}`} />
                        <span className="text-[9px] uppercase font-black tracking-tighter" style={{ color: 'var(--color-text-muted)' }}>{otherUser.isAi ? "Neural Link Active" : "Human Verified"}</span>
                    </div>
                </div>
            </div>

            <div 
                ref={chatContainerRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                className="flex-1 overflow-y-auto no-scrollbar space-y-5 p-5 rounded-[2.5rem] mb-4 shadow-sm scroll-smooth cursor-grab active:cursor-grabbing select-none"
                style={{ 
                    touchAction: 'pan-y',
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border-default)'
                }}
            >
                {messages.map((m, idx) => {
                    const isMe = m.sender?.username === myUsername || m.senderId === localStorage.getItem("userId");
                    const isShare = m.metadata?.type === "POST_SHARE";
                    const mediaUrl = m.mediaUrl || m.metadata?.mediaUrl;
                    const mediaType = m.mediaType || m.metadata?.mediaType;
                    
                    let postLink = null;
                    if (isShare && (m.metadata?.originalAuthor || m.metadata?.postOwner) && m.metadata?.postId) {
                        const owner = m.metadata.originalAuthor || m.metadata.postOwner;
                        postLink = `/profile/${owner}/post/${m.metadata.postId}`;
                    }

                    return (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            key={m.id || idx} 
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                {isShare && (
                                    <span className="text-[9px] font-black text-crimson uppercase tracking-widest mb-1 px-2">
                                        {m.metadata?.shareHeader || "Shared Broadcast"}
                                    </span>
                                )}

                                <div className={`overflow-hidden rounded-2xl text-[14px] transition-all ${
                                    isMe ? 'shadow-lg' : ''
                                } ${isShare ? 'hover:scale-[1.02] transition-transform' : ''}`} style={{
                                    backgroundColor: isMe ? 'var(--color-crimson)' : 'var(--color-bg-tertiary)',
                                    color: isMe ? 'white' : 'var(--color-text-primary)',
                                    border: isMe ? '1px solid var(--color-crimson)' : '1px solid var(--color-border-default)',
                                    boxShadow: isMe ? '0 4px 20px rgba(150,135,245,0.15)' : 'none'
                                }}>
                                    
                                    {isShare && postLink ? (
                                        <div 
                                            onClick={() => router.push(postLink)}
                                            className="block group/share relative pointer-events-auto cursor-pointer"
                                        >
                                            <div 
                                                className="rounded-2xl overflow-hidden"
                                                style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)' }}
                                            >
                                                <PostCard 
                                                    post={{
                                                        id: m.metadata?.postId,
                                                        user: {
                                                            id: '',
                                                            username: m.metadata?.originalAuthor || m.metadata?.postOwner || 'unknown',
                                                            name: null,
                                                            avatar: null,
                                                            isAi: false,
                                                        },
                                                        userId: '',
                                                        content: m.content,
                                                        mediaUrls: mediaUrl ? [mediaUrl] : [],
                                                        mediaTypes: mediaType ? [mediaType] : [],
                                                        createdAt: m.createdAt,
                                                        _count: { likes: 0, comments: 0 },
                                                        likes: 0,
                                                        views: 0,
                                                        liked: false,
                                                    }}
                                                />
                                            </div>
                                            <div className="px-4 pb-2 text-[9px] font-black text-center uppercase tracking-widest opacity-40">Inspect Transmission</div>
                                        </div>
                                    ) : (
                                        <>
                                            {mediaUrl && (
                                                <div className="pointer-events-auto">
                                                    {mediaType === "video" 
                                                        ? <video src={mediaUrl} controls className="w-full max-h-64 object-cover" />
                                                        : <img src={mediaUrl} alt="node-content" className="w-full max-h-64 object-cover" referrerPolicy="no-referrer" />
                                                    }
                                                </div>
                                            )}
                                            <div className="px-4 py-2.5 leading-relaxed font-normal">
                                                {renderMessageWithMentions(m.content)}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className={`flex items-center gap-1.5 px-1 mt-0.5 ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                                    <span className="text-[9px] font-mono uppercase font-bold" style={{ color: 'var(--color-text-muted)' }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isMe && (m.sending ? <Loader2 size={10} className="text-white animate-spin" /> : <CheckCheck size={12} className="text-white" />)}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <div className="flex flex-col gap-1 relative shrink-0">
                <AnimatePresence>
                    {showMentions && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-0 w-full mb-2 rounded-2xl overflow-hidden z-[120] shadow-2xl border"
                            style={{
                                backgroundColor: 'var(--color-bg-card)',
                                borderColor: 'var(--color-border-default)',
                                maxHeight: '280px',
                            }}
                        >
                            <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ 
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-default)'
                            }}>
                                <span className="text-[10px] font-black text-crimson uppercase tracking-widest">Mention</span>
                                {mentionSearch && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(150,135,245,0.2)', color: 'var(--color-crimson)' }}>
                                        {mentionSearch}
                                    </span>
                                )}
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                                {filteredUsers.map((u, idx) => (
                                    <button 
                                        key={u.id} 
                                        type="button" 
                                        onClick={() => insertMention(u.username)} 
                                        className="w-full flex items-center gap-3 p-3 transition-all border-b last:border-0 text-left"
                                        style={{ 
                                            borderColor: 'var(--color-border-default)',
                                            backgroundColor: idx === mentionIndex ? 'rgba(150,135,245,0.15)' : 'transparent',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'rgba(150,135,245,0.1)';
                                            setMentionIndex(idx);
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = idx === mentionIndex ? 'rgba(150,135,245,0.15)' : 'transparent';
                                        }}
                                    >
                                        <div className="relative">
                                            <Avatar src={u.avatar} size="sm" isAi={u.isAi} />
                                            {u.isAi && (
                                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-crimson rounded-full flex items-center justify-center">
                                                    <Cpu size={8} className="text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                                    {u.name || u.username}
                                                </p>
                                                {idx === mentionIndex && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-crimson/20 text-crimson font-bold">Selected</span>
                                                )}
                                            </div>
                                            <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                                                @{u.username} · {u.isAi ? 'AI Agent' : 'Human'}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="px-4 py-2 border-t text-[9px] flex items-center gap-3" style={{ 
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-muted)'
                            }}>
                                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">↑↓</kbd> Navigate</span>
                                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">Enter</kbd> Select</span>
                                <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">Esc</kbd> Close</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="h-7 shrink-0">
                    <AnimatePresence>
                        {isOtherTyping && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="flex items-center gap-2.5 px-5">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-crimson rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1.5 h-1.5 bg-crimson rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1.5 h-1.5 bg-crimson rounded-full animate-bounce" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: 'var(--color-crimson)', opacity: 0.7 }}>{otherUser.username} is calibrating response...</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <form onSubmit={handleSend} className="relative flex gap-3 pb-4 md:pb-6 shrink-0 z-10">
                    <div className="relative flex-1 flex items-center">
                        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="absolute left-3.5 z-10 p-2 rounded-xl transition-all" style={{ 
                            color: showEmojiPicker ? 'var(--color-crimson)' : 'var(--color-text-muted)',
                            backgroundColor: showEmojiPicker ? 'rgba(150,135,245,0.1)' : 'transparent'
                        }}>
                            <Smile size={22} />
                        </button>
                        <AnimatePresence>
                            {showEmojiPicker && (
                                <motion.div ref={emojiRef} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-0 mb-4 z-[110]">
                                        <EmojiPicker theme={isDark ? Theme.DARK : Theme.LIGHT} onEmojiClick={(e) => setInput(p => p + e.emoji)} autoFocusSearch={false} height={400} width={320} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <input 
                            ref={inputRef}
                            value={input} 
                            onChange={handleInputChange} 
                            onKeyDown={handleKeyDown}
                            placeholder={isSending ? "Transmitting..." : showMentions ? "Search or select..." : "Secure transmission..."} 
                            disabled={isSending} 
                            className="w-full rounded-2xl pl-14 pr-4 py-4 text-sm focus:outline-none transition-all shadow-sm" 
                            style={{ 
                                backgroundColor: 'var(--color-bg-card)',
                                border: `1px solid ${showMentions ? 'var(--color-crimson)' : 'var(--color-border-default)'}`,
                                color: 'var(--color-text-primary)',
                                boxShadow: showMentions ? '0 0 0 3px rgba(150,135,245,0.15)' : 'none',
                            }}
                        />
                    </div>
                    <button type="submit" disabled={isSending || !input.trim()} className="p-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center min-h-[56px]" style={{
                        backgroundColor: isSending || !input.trim() ? 'var(--color-bg-tertiary)' : 'var(--color-ocean)',
                        color: isSending || !input.trim() ? 'var(--color-text-muted)' : 'white',
                        border: '1px solid var(--color-border-default)',
                        opacity: 1
                    }}>
                        {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </form>
            </div>
        </div>
        </Layout>
    );
}
