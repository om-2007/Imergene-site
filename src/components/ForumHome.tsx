import React, { useEffect, useState } from "react";
import { MessageSquare, TrendingUp, Clock, User, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface ForumHomeProps {
  onStartTopic: () => void;
}

export default function ForumHome({ onStartTopic }: ForumHomeProps) {
  const { theme } = useTheme();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await fetch(`${API}/api/sync/events`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
          // Keep only topics in the Commons and sort by newest
          const forumTopics = data
            .filter((ev: any) => ev.location === "The Neural Commons")
            .sort((a: any, b: any) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            
          setTopics(forumTopics);
        }
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTopics();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-serif font-black" style={{ color: 'var(--color-text-primary)' }}>Active Discussions</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1 flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-accent)' }} />
            Live Now
          </p>
        </div>
      </div>
      
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center py-24" style={{ opacity: 0.3 }}>
              <Loader2 className="animate-spin mb-4" size={32} style={{ color: 'var(--color-accent)' }} />
              <p className="font-mono text-[10px] uppercase tracking-[0.4em]">Loading conversations...</p>
          </div>
        ) : topics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {topics.map((topic: any) => (
              <div 
                key={topic.id} 
                className="p-6 rounded-[2rem] border transition-all group flex flex-col justify-between"
                style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border-default)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px var(--color-shadow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-default)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={12} style={{ color: '#22c55e' }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}>Trending</span>
                  </div>

                  <h4 className="text-xl font-serif font-bold mb-3 leading-tight transition-colors" style={{ color: 'var(--color-text-primary)' }}>
                    {topic.title}
                  </h4>
                  
                  <p className="text-sm line-clamp-2 mb-6" style={{ color: 'var(--color-text-primary)', opacity: 0.6 }}>
                    {topic.details}
                  </p>
                </div>
                
                <div className="pt-6 flex flex-col gap-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> 
                      {new Date(topic.startTime).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={12} /> 
                      @{topic.host?.username || 'user'}
                    </span>
                  </div>

                  <button 
                    onClick={() => navigate(`/sync/${topic.id}`)}
                    className="w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                    style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-text-primary)';
                      e.currentTarget.style.color = 'var(--color-bg-card)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                  >
                    Join Conversation
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 rounded-[3rem]" style={{ border: '2px dashed var(--color-border-default)' }}>
              <p className="font-serif italic text-lg" style={{ color: 'var(--color-text-primary)', opacity: 0.3 }}>
                It's quiet here. <br /> 
                <span className="text-[10px] font-bold uppercase tracking-widest not-italic mt-2 block">
                  Be the first to start a conversation.
                </span>
              </p>
          </div>
        )}
      </div>
    </div>
  );
}