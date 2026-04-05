import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Bot, ShieldCheck, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarUrl(avatarPath?: string): string {
    if (!avatarPath) return "";
    if (avatarPath.startsWith("http")) return avatarPath;
    return `${API}${avatarPath.startsWith("/") ? "" : "/"}${avatarPath}`;
}

function AvatarFallback({ name, username, isAi }: { name?: string, username: string, isAi: boolean }) {
    const displayValue = name || username;
    const initials = displayValue
        .split(/[._ ]/)
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

    const colors = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-indigo-500"];
    const colorIndex = username.length % colors.length;

    return (
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[10px] font-black tracking-tighter shadow-inner ${isAi ? 'bg-crimson' : colors[colorIndex]}`}>
            {initials}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Suggestions() {
    const { theme } = useTheme();
    const [people, setPeople] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchSuggestions = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/api/users/suggestions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setPeople(data);
            } else {
                setPeople([]);
            }
        } catch (err) {
            console.error("Neural sync failed:", err);
            setPeople([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

    return (
        <div className="border rounded-[2rem] p-6 shadow-sm" style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border-default)'
        }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-primary)' }}>Suggestions</h3>
                    <p className="text-[9px] font-bold uppercase mt-1" style={{ color: 'var(--color-text-muted)' }}>People you may know</p>
                </div>
                <button
                    onClick={fetchSuggestions}
                    className={`p-2 rounded-full transition-all ${loading ? 'animate-spin' : 'opacity-40 hover:opacity-100'}`}
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* List */}
            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {people.map((person, index) => {
                        const avatarUrl = getAvatarUrl(person.avatar);
                        const displayName = person.name || person.username;

                        return (
                            <motion.div
                                key={person.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-center justify-between group"
                            >
                                <Link to={`/profile/${person.username}`} className="flex items-center gap-3 min-w-0">
                                    <div className="relative shrink-0">
                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                className="w-10 h-10 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all"
                                                style={{ border: '1px solid var(--color-border-default)' }}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                        ) : (
                                            <AvatarFallback name={person.name} username={person.username} isAi={person.isAi} />
                                        )}
                                        
                                        {person.isAi && (
                                            <div className="absolute -bottom-1 -right-1 bg-crimson p-1 rounded-full border-2 shadow-sm" style={{ borderColor: 'var(--color-bg-card)' }}>
                                                <Bot size={8} className="text-white" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-xs font-black flex items-center gap-1.5 truncate" style={{ color: 'var(--color-text-primary)' }}>
                                            {displayName}
                                            {!person.isAi && <ShieldCheck size={10} className="text-blue-500 shrink-0" />}
                                        </p>
                                        <p className="text-[9px] font-bold uppercase tracking-tighter" style={{ color: 'var(--color-text-muted)' }}>
                                            {person.isAi ? "Synthetic Entity" : "Verified Human"}
                                        </p>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {!loading && people.length === 0 && (
                    <div className="py-6 text-center">
                        <Users size={20} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
                        <p className="text-[9px] font-black uppercase" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }}>No nodes found</p>
                    </div>
                )}
            </div>
        </div>
    );
}