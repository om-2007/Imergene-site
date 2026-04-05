import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
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
import Avatar from "../components/Avatar";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useTheme } from "../context/ThemeContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ChatDetailsPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { id } = useParams();
    const [messages, setMessages] = useState<any[]>([]);
    const [otherUser, setOtherUser] = useState<any>(null);
    const [input, setInput] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Typing Status
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Mentions
    const [showMentions, setShowMentions] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<any[]>([]);

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const emojiRef = useRef<HTMLDivElement>(null);
    
    // Drag to Scroll Refs
    const isDragging = useRef(false);
    const startY = useRef(0);
    const scrollTop = useRef(0);

    const token = localStorage.getItem("token");
    const myUsername = localStorage.getItem("username");

    // --- DRAG TO SCROLL LOGIC ---
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
        const walk = (y - startY.current) * 1.5; // Scroll speed multiplier
        chatContainerRef.current.scrollTop = scrollTop.current - walk;
    };

    // --- SCROLL UTILITY ---
    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        if (chatContainerRef.current && !isDragging.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior
            });
        }
    };

    // --- API: TYPING STATUS ---
    const broadcastTyping = async (isTyping: boolean) => {
        try {
            await fetch(`${API}/api/chat/conversations/${id}/typing`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ isTyping })
            });
        } catch (err) { /* Silent fail */ }
    };

    // --- API: LOAD CHAT DATA ---
    const loadChat = async (isInitial = false) => {
        try {
            const res = await fetch(`${API}/api/chat/conversations/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error("Sync Interrupted");
            
            const data = await res.json();
            const newMessages = data.messages || [];

            const container = chatContainerRef.current;
            const isAtBottom = container ? (container.scrollHeight - container.scrollTop <= container.clientHeight + 150) : true;

            setMessages(newMessages);
            setOtherUser(data.participants?.find((p: any) => p.username !== myUsername));

            if (isInitial || (isAtBottom && newMessages.length > messages.length)) {
                setTimeout(() => scrollToBottom(isInitial ? "auto" : "smooth"), 60);
            }

            setIsOtherTyping(!!data.lastTypingId && data.lastTypingId !== localStorage.getItem("userId"));
            setError(null);
        } catch (err) { 
            if (isInitial) setError("Connection to node lost.");
        }
    };

    // --- API: FETCH ALL USERS FOR MENTIONS ---
    useEffect(() => {
        async function fetchUsers() {
            try {
                const res = await fetch(`${API}/api/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (Array.isArray(data)) setAllUsers(data);
            } catch (err) { console.error("Mention nodes unavailable"); }
        }
        fetchUsers();
    }, [token]);

    // UI: Outside Click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // POLLING
    useEffect(() => {
        loadChat(true);
        const interval = setInterval(() => loadChat(false), 4000);
        return () => clearInterval(interval);
    }, [id]);



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
            setShowMentions(matches.length > 0);
        } else { setShowMentions(false); }
    };

    const insertMention = (username: string) => {
        const words = input.split(" ");
        words.pop();
        setInput([...words, `@${username} `].join(" "));
        setShowMentions(false);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isSending) return;
        setIsSending(true);

        const optimisticId = Date.now().toString();
        const optimisticMsg = {
            id: optimisticId,
            content: input,
            sender: { username: myUsername },
            createdAt: new Date().toISOString(),
            sending: true
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setInput("");
        setShowEmojiPicker(false);
        setTimeout(() => scrollToBottom("smooth"), 50);

        try {
            const res = await fetch(`${API}/api/chat/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ conversationId: id, content: optimisticMsg.content })
            });
            if (res.ok) {
                const confirmedMsg = await res.json();
                setMessages(prev => prev.map(m => m.id === optimisticId ? confirmedMsg : m));
            }
        } catch (err) { console.error("Transmission failed"); }
        finally { setIsSending(false); }
    };

    if (error) return (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
            <AlertCircle className="w-10 h-10 text-crimson opacity-40" />
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}>{error}</p>
            <button onClick={() => window.location.reload()} className="btn-action">Re-establish Link</button>
        </div>
    );

    if (!otherUser) return (
        <div className="flex items-center justify-center h-[70vh]">
            <Loader2 className="w-6 h-6 text-crimson animate-spin opacity-20" />
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto h-[calc(100vh-80px)] flex flex-col pt-6 px-4 pb-24 md:pb-0 selection:bg-crimson/20 overflow-hidden">
            {/* HEADER */}
            <div className="!p-3 !mb-4 flex items-center gap-4 shrink-0" style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '1.25rem'
            }}>
                <Link to="/messages" className="p-2 rounded-full" style={{ color: 'var(--color-text-muted)' }}>
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

            {/* CHAT THREAD with Drag to Scroll */}
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
                    const postLink = isShare ? `/profile/${m.metadata?.postOwner}/post/${m.metadata?.postId}` : null;

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
                                    
                                    {isShare ? (
                                        <Link to={postLink || "#"} className="block group/share relative pointer-events-auto">
                                            {mediaUrl && (
                                                <div className="relative overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                                                    {mediaType === "video" ? (
                                                        <video src={mediaUrl} className="w-full max-h-64 object-cover" muted playsInline />
                                                    ) : (
                                                        <img src={mediaUrl} alt="broadcast" className="w-full max-h-64 object-cover" referrerPolicy="no-referrer" />
                                                    )}
                                                </div>
                                            )}
                                            <div className="px-4 py-3 font-medium italic opacity-90">{m.content}</div>
                                            <div className="px-4 pb-2 text-[9px] font-black text-center uppercase tracking-widest opacity-40">Inspect Transmission</div>
                                        </Link>
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
                                            <div className="px-4 py-2.5 leading-relaxed font-normal">{m.content}</div>
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

            {/* MESSAGE INPUT */}
            <div className="flex flex-col gap-1 relative shrink-0">
                {/* MENTION SUGGESTIONS */}
                <AnimatePresence>
                    {showMentions && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-full left-0 w-full mb-3 rounded-2xl overflow-hidden z-[120] shadow-2xl" style={{
                            backgroundColor: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border-default)'
                        }}>
                            <div className="p-2.5 border-b" style={{ 
                                backgroundColor: 'var(--color-bg-tertiary)',
                                borderColor: 'var(--color-border-default)'
                            }}>
                                <span className="text-[10px] font-black text-crimson uppercase tracking-widest">Neural Directory</span>
                            </div>
                            {filteredUsers.map((u) => (
                                <button key={u.id} type="button" onClick={() => insertMention(u.username)} className="w-full flex items-center gap-4 p-3.5 transition-colors border-b last:border-0 text-left" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <Avatar src={u.avatar} size="xs" isAi={u.isAi} />
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-tight" style={{ color: 'var(--color-text-primary)' }}>{u.name || u.username}</p>
                                        <p className="text-[10px] italic" style={{ color: 'var(--color-text-muted)' }}>@{u.username}</p>
                                    </div>
                                    {u.isAi && <Cpu size={12} className="ml-auto text-crimson opacity-40" />}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* TYPING INDICATOR */}
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

                {/* INPUT FORM */}
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
                            value={input} 
                            onChange={handleInputChange} 
                            placeholder={isSending ? "Transmitting..." : "Secure transmission..."} 
                            disabled={isSending} 
                            className="w-full rounded-2xl pl-14 pr-4 py-4 text-sm focus:outline-none focus:ring-2 transition-all shadow-sm" 
                            style={{ 
                                backgroundColor: 'var(--color-bg-card)',
                                border: '1px solid var(--color-border-default)',
                                color: 'var(--color-text-primary)'
                            }}
                        />
                    </div>
                    <button type="submit" disabled={isSending || !input.trim()} className="p-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center" style={{
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
    );
}