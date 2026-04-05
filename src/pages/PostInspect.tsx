import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Loader2, Zap, Activity } from "lucide-react";
import { motion } from "framer-motion";
import PostCard from "../components/PostCard";
import { useTheme } from "../context/ThemeContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function PostInspect() {
  const { theme } = useTheme();
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");

  useEffect(() => {
    async function reconstructBroadcast() {
      if (!postId) return;
      
      try {
        setLoading(true);
        const res = await fetch(`${API}/api/posts/${postId}`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        
        const data = await res.json();
        
        if (res.ok) {
          setPost(data);
        } else {
          console.error("Broadcast not found in database");
        }
      } catch (err) {
        console.error("Neural reconstruction failed", err);
      } finally {
        setLoading(false);
      }
    }

    reconstructBroadcast();
  }, [postId, token]);

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-void dark:bg-void pb-20 selection:bg-crimson/20">
      {/* PERSISTENT HEADER (OPAL GLASS) */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-card/80 backdrop-blur-xl border-b border-black/[0.05] dark:border-white/5 px-6 h-20 flex items-center justify-between shadow-sm">
        <button 
          onClick={handleBack}
          className="flex items-center gap-4 text-text-dim hover:text-crimson transition-all group"
        >
          <div className="p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/5 border border-black/[0.05] dark:border-white/10 group-hover:border-crimson/30 transition-colors">
            <ChevronLeft size={20} />
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-[11px] font-black uppercase tracking-widest text-ocean">Back</span>
            <span className="text-[9px] font-medium text-text-dim/60 uppercase tracking-tighter group-hover:text-crimson/60">
              Return to neural stream
            </span>
          </div>
        </button>

        <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-crimson/5 border border-crimson/10 shadow-sm">
          <Activity size={14} className="text-crimson animate-pulse" />
          <span className="text-[10px] font-black text-crimson uppercase tracking-[0.2em]">
            Post Trace Active
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto pt-12 px-4 md:px-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-8">
            <div className="relative">
               <div className="absolute inset-0 bg-crimson/10 blur-[60px] rounded-full animate-pulse" />
               <Loader2 className="w-12 h-12 text-crimson animate-spin relative z-10 opacity-40" />
            </div>
            <p className="text-text-dim/40 font-mono text-[11px] uppercase tracking-[0.6em] animate-pulse text-center font-bold">
              Reconstructing Neural Data...
            </p>
          </div>
        ) : post ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* The PostCard component will now inherit the light-mode social-card styles */}
            <PostCard post={{
                ...post,
                user: {
                    ...post.user,
                    displayName: post.user.name || post.user.username,
                    is_ai: post.user.isAi
                }
            }} />
            
            {/* END OF SEQUENCE MARKER */}
            <div className="mt-16 p-12 rounded-[3.5rem] border-2 border-dashed border-black/[0.03] dark:border-white/5 text-center bg-white/30 dark:bg-white/5">
                <Zap size={24} className="mx-auto mb-4 text-crimson opacity-20" />
                <p className="text-[11px] font-black text-text-dim/30 uppercase tracking-[0.5em] italic">
                  End of Transmission Sequence
                </p>
            </div>
          </motion.div>
        ) : (
          <div className="text-center py-40 px-6">
             <div className="inline-block p-5 rounded-[2.5rem] bg-ocean/5 border border-ocean/10 mb-8 shadow-inner">
                <Zap className="w-10 h-10 text-ocean/30 rotate-180" />
             </div>
             <h2 className="text-ocean font-serif font-bold text-2xl tracking-tight mb-4">Protocol Interrupted</h2>
             <p className="text-text-dim text-[13px] uppercase tracking-widest max-w-xs mx-auto leading-relaxed font-medium">
                The requested transmission has been purged from the network or moved to a restricted node.
             </p>
             <button 
                onClick={handleBack}
                className="mt-10 px-10 py-3 rounded-2xl bg-ocean text-white text-[11px] font-black uppercase hover:bg-crimson transition-all shadow-xl shadow-ocean/10"
             >
                Return to Network
             </button>
          </div>
        )}
      </main>
    </div>
  );
}