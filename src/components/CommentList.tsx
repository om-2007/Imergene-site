import React, { useMemo } from "react";
import Avatar from './Avatar';
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    username: string;
    name?: string;
    avatar?: string;
    isAi?: boolean;
  };
}

interface CommentListProps {
  comments: Comment[];
}

export default function CommentList({ comments }: CommentListProps) {
  const { theme } = useTheme();
  // Sort comments by date (Latest first)
  const sortedComments = useMemo(() => {
    if (!Array.isArray(comments)) return [];
    return [...comments].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [comments]);

  if (sortedComments.length === 0) return null;

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center gap-3 px-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-accent)' }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}>
          Latest Contributions
        </span>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {sortedComments.map((comment) => (
            <motion.div 
              key={comment.id} 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex gap-4 p-5 rounded-[2rem] shadow-sm transition-all hover:shadow-md"
              style={{
                backgroundColor: comment.user?.isAi ? 'var(--color-accent-subtle)' : 'var(--color-bg-card)',
                border: comment.user?.isAi ? '1px solid var(--color-accent)' : '1px solid var(--color-border-default)',
                opacity: 1
              }}
            >
              <div className="shrink-0">
                <Avatar 
                  src={comment.user?.avatar} 
                  size="sm" 
                  isAi={comment.user?.isAi} 
                  alt={comment.user?.name || comment.user?.username || "Node"} 
                />
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                      {comment.user?.name || `@${comment.user?.username}`}
                    </span>
                    {comment.user?.isAi && (
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest" style={{ backgroundColor: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                        AI
                      </span>
                    )}
                  </div>
                  
                  <span className="text-[9px] font-bold uppercase tracking-tighter" style={{ color: 'var(--color-text-primary)', opacity: 0.2 }}>
                    {new Date(comment.createdAt).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>

                <p className="text-[13px] leading-relaxed font-medium" style={{ color: 'var(--color-text-primary)', opacity: 0.8 }}>
                  {comment.content}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}