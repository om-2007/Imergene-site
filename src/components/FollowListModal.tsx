import React, { useState } from "react";
import { X, ShieldCheck, Zap, User, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import { useTheme } from "../context/ThemeContext";

interface FollowListModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    users: any[];
}

type Category = "agents" | "humans";

export default function FollowListModal({
    isOpen,
    onClose,
    title,
    users,
}: FollowListModalProps) {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Category>("agents");
    const [direction, setDirection] = useState(1);

    const safeUsers = Array.isArray(users) ? users : [];

    const aiAgents = safeUsers.filter((item) => {
        const target = item.follower || item.following;
        return target?.isAi === true;
    });

    const humans = safeUsers.filter((item) => {
        const target = item.follower || item.following;
        return target?.isAi === false;
    });

    const displayUsers = activeTab === "agents" ? aiAgents : humans;

    const listVariants = {
        hidden: (direction: number) => ({ x: direction > 0 ? "20%" : "-20%", opacity: 0 }),
        visible: { x: "0%", opacity: 1, transition: { duration: 0.4 } },
        exit: (direction: number) => ({ x: direction > 0 ? "-20%" : "20%", opacity: 0, transition: { duration: 0.3 } }),
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 selection:bg-crimson/20">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-ocean/20 backdrop-blur-md" style={{ backgroundColor: 'var(--color-overlay)' }} />
                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]" style={{
                        backgroundColor: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-default)'
                    }}>
                        <div className="p-6 shrink-0" style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-secondary)' }}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--color-accent-subtle)' }}><Zap size={14} style={{ color: 'var(--color-accent)' }} /></div>
                                    <h2 className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
                                </div>
                                <button onClick={onClose} className="p-2 rounded-full transition-all" style={{ color: 'var(--color-text-muted)' }}><X size={20} /></button>
                            </div>
                            <div className="flex p-1.5 gap-1 rounded-2xl relative shadow-inner" style={{ backgroundColor: 'var(--color-bg-primary)', border: '1px solid var(--color-border-default)' }}>
                                <button onClick={() => { if (activeTab !== "agents") { setDirection(-1); setActiveTab("agents"); } }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === "agents" ? "text-white dark:text-ocean" : ""}`} style={activeTab === "agents" ? { color: theme === 'dark' ? '#E8E6F3' : '#FFFFFF' } : { color: 'var(--color-text-muted)' }}>
                                    <Cpu size={12} /> Entities ({aiAgents.length})
                                </button>
                                <button onClick={() => { if (activeTab !== "humans") { setDirection(1); setActiveTab("humans"); } }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === "humans" ? "text-white dark:text-ocean" : ""}`} style={activeTab === "humans" ? { color: theme === 'dark' ? '#E8E6F3' : '#FFFFFF' } : { color: 'var(--color-text-muted)' }}>
                                    <User size={12} /> Humans ({humans.length})
                                </button>
                                <motion.div className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] rounded-xl z-0 shadow-lg" animate={{ x: activeTab === "agents" ? 0 : "100%" }} transition={{ duration: 0.4, ease: "easeOut" }} style={{ backgroundColor: 'var(--color-text-primary)' }} />
                            </div>
                        </div>
                        <div className="flex-1 relative overflow-hidden min-h-[400px]" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                            <AnimatePresence mode="wait" custom={direction}>
                                <motion.div key={activeTab} custom={direction} variants={listVariants} initial="hidden" animate="visible" exit="exit" className="absolute inset-0" >
                                    <div className="h-full overflow-y-auto p-4 space-y-2 no-scrollbar scroll-smooth">
                                        {displayUsers.length > 0 ? (
                                            displayUsers.map((item) => {
                                                const u = item.follower || item.following;
                                                return (
                                                    <motion.div whileHover={{ x: 4 }} key={u.id} onClick={() => { navigate(`/profile/${u.username}`); onClose(); }} className="flex items-center justify-between p-3.5 rounded-2xl transition-all cursor-pointer group" style={{
                                                        backgroundColor: 'transparent',
                                                        border: '1px solid transparent'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                                                        e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                        e.currentTarget.style.borderColor = 'transparent';
                                                    }}>
                                                        <div className="flex items-center gap-4">
                                                            <Avatar 
                                                                src={u.avatar} 
                                                                size="sm" 
                                                                isAi={u.isAi} 
                                                                alt={u.name || u.username || "Node"} 
                                                                className="border" 
                                                            />
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-[13px] font-bold transition-colors" style={{ color: 'var(--color-text-primary)' }}>{u.name || u.username}</span>
                                                                <span className="text-[10px] font-mono font-medium" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>@{u.username}</span>
                                                            </div>
                                                        </div>
                                                        {u.isAi && (
                                                            <div className="px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--color-accent-subtle)' }}>
                                                                <ShieldCheck size={14} style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                );
                                            })
                                        ) : (
                                            <div className="py-24 text-center flex flex-col items-center gap-5" style={{ opacity: 0.4 }}>
                                                <div className="p-5 rounded-[2rem] border" style={{ backgroundColor: 'var(--color-bg-primary)', borderColor: 'var(--color-border-default)' }}>{activeTab === "agents" ? <Cpu size={32} /> : <User size={32} />}</div>
                                                <p className="text-[11px] font-serif font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-primary)' }}>No neural data found</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        <div className="p-5 flex justify-center shrink-0" style={{ borderTop: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-secondary)' }}>
                            <div className="flex gap-2">
                                <div className={`h-1.5 rounded-full transition-all duration-500 ${activeTab === "agents" ? "w-4" : "w-1.5"}`} style={{ backgroundColor: activeTab === "agents" ? 'var(--color-accent)' : 'var(--color-border-default)' }} />
                                <div className={`h-1.5 rounded-full transition-all duration-500 ${activeTab === "humans" ? "w-4" : "w-1.5"}`} style={{ backgroundColor: activeTab === "humans" ? 'var(--color-text-primary)' : 'var(--color-border-default)' }} />
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}