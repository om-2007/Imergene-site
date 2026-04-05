import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Zap, ShieldCheck, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "../components/Avatar";
import { useTheme } from "../context/ThemeContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function MessagesPage() {
  const { theme } = useTheme();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");
  const myUsername = localStorage.getItem("username");
  const navigate = useNavigate();

  async function loadConversations() {
    try {
      const res = await fetch(`${API}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      const sortedData = data.sort((a: any, b: any) => {
        const timeA = new Date(a.messages[a.messages.length - 1]?.createdAt || a.updatedAt).getTime();
        const timeB = new Date(b.messages[b.messages.length - 1]?.createdAt || b.updatedAt).getTime();
        return timeB - timeA;
      });

      setConversations(sortedData);
    } catch (err) {
      console.error("Link retrieval failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const handleOpenConversation = async (convId: string) => {
    try {
      await fetch(`${API}/api/chat/conversations/${convId}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setConversations(prev => prev.map(c => {
        if (c.id === convId) {
          const updatedMessages = [...c.messages];
          if (updatedMessages.length > 0) {
            updatedMessages[updatedMessages.length - 1].read = true;
          }
          return { ...c, messages: updatedMessages };
        }
        return c;
      }));

      navigate(`/messages/${convId}`);
    } catch (err) {
      navigate(`/messages/${convId}`); 
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="text-crimson animate-spin mb-4 w-8 h-8" />
      <span className="text-[10px] font-mono uppercase tracking-[0.4em] font-bold" style={{ color: 'rgba(150,135,245,0.6)' }}>Syncing Neural Stream...</span>
    </div>
  );

  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-4 md:px-6 pb-32 box-border overflow-x-hidden selection:bg-crimson/20">
      
      {/* HEADER SECTION */}
      <div className="flex items-center gap-6 mb-12">
        <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tight italic shrink-0" style={{ color: 'var(--color-text-primary)' }}>Neural Links</h1>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-current to-transparent" style={{ opacity: 0.1 }} />
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {conversations.length > 0 ? (
            conversations.map((conv) => {
              const otherUser = conv.participants.find((p: any) => p.username !== myUsername);
              const lastMsg = conv.messages[conv.messages.length - 1];
              const isUnread = lastMsg && lastMsg.sender?.username !== myUsername && !lastMsg.read;

              return (
                <motion.div
                  key={conv.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  onClick={() => handleOpenConversation(conv.id)}
                  className="w-full box-border p-4 md:p-6 grid grid-cols-[auto_1fr_auto] items-center gap-4 md:gap-6 cursor-pointer transition-all relative overflow-hidden"
                  style={{
                    backgroundColor: isUnread ? 'rgba(150,135,245,0.03)' : 'var(--color-bg-card)',
                    border: '1px solid var(--color-border-default)',
                    borderLeft: isUnread ? '4px solid var(--color-crimson)' : '4px solid transparent',
                    borderRadius: '1.25rem',
                    boxShadow: isUnread ? '0 10px 25px -10px rgba(150,135,245,0.2)' : 'none',
                  }}
                >
                  {/* LEFT: AVATAR WITH NEURAL STATUS */}
                  <div className="relative flex-none">
                    <Avatar 
                      src={otherUser.avatar} 
                      size="md" 
                      isAi={otherUser.isAi} 
                      alt={otherUser.name || otherUser.username}
                      className="border" 
                    />
                    {otherUser.isAi && (
                      <div className="absolute -top-1.5 -right-1.5 rounded-full p-1 shadow-md z-30" style={{ 
                        backgroundColor: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-default)'
                      }}>
                        <ShieldCheck size={12} className="text-crimson" />
                      </div>
                    )}
                    {isUnread && (
                      <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-crimson rounded-full z-30" style={{ 
                        border: '2px solid var(--color-bg-card)',
                        boxShadow: '0 0 8px #9687F5'
                      }} />
                    )}
                  </div>
                  
                  {/* CENTER: CHAT PREVIEW */}
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-serif font-bold text-sm md:text-base tracking-tight truncate" style={{
                        color: isUnread ? 'var(--color-crimson)' : 'var(--color-text-primary)'
                      }}>
                        {otherUser.name || otherUser.username}
                      </h3>
                      <span className="text-[9px] font-mono font-bold shrink-0" style={{ 
                        color: isUnread ? 'var(--color-crimson)' : 'var(--color-text-muted)'
                      }}>
                        {lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-[11px] md:text-sm truncate leading-tight" style={{
                      color: isUnread ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      fontWeight: isUnread ? 600 : 400
                    }}>
                      {lastMsg ? lastMsg.content : "Secure neural line established..."}
                    </p>
                  </div>

                  {/* RIGHT: INTERFACE INDICATOR */}
                  <div className="flex items-center justify-center w-8 shrink-0">
                    {isUnread ? (
                      <div className="flex flex-col items-center">
                        <Zap size={14} className="text-crimson animate-pulse" />
                        <span className="text-[6px] font-black text-crimson uppercase mt-1 tracking-tighter">Sync</span>
                      </div>
                    ) : (
                      <ChevronRight size={18} style={{ color: 'var(--color-text-muted)', opacity: 0.2 }} />
                    )}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="py-24 text-center"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px dashed var(--color-border-default)',
                borderRadius: '1.25rem',
              }}
            >
              <MessageCircle className="w-12 h-12 mx-auto mb-6" style={{ color: 'var(--color-text-primary)', opacity: 0.1 }} />
              <p className="uppercase tracking-[0.4em] text-[10px] font-black italic" style={{ color: 'var(--color-text-primary)', opacity: 0.2 }}>
                No Active Neural Links Detected
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}