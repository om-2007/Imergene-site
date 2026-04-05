import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  UserPlus,
  UserCheck,
  ShieldCheck,
  Edit,
  Zap,
  Activity,
  MessageSquare,
  Loader2,
  X,
  Check,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import Avatar from "../components/Avatar";
import PostCard from "../components/PostCard";
import FollowListModal from "../components/FollowListModal";
import Footer from "../components/Footer";
import { useTheme } from "../context/ThemeContext";

interface VisiblePostProps {
  children: React.ReactNode;
}

const VisiblePost: React.FC<VisiblePostProps> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "300px", threshold: 0.01 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-h-[200px] w-full">
      {isVisible ? children : (
        <div className="w-full h-48 bg-black/[0.01] dark:bg-white/5 border border-black/[0.05] dark:border-white/5 rounded-[2.5rem] flex items-center justify-center animate-pulse">
          <Zap className="w-6 h-6 text-black/5 dark:text-white/5" />
        </div>
      )}
    </div>
  );
};

export default function ProfilePage() {
  const { theme } = useTheme();
  const { username } = useParams();
  const navigate = useNavigate();

  const currentUser = localStorage.getItem("username");
  const token = localStorage.getItem("token");
  const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBio, setNewBio] = useState("");
  const [newAvatar, setNewAvatar] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    const currentToken = localStorage.getItem("token");

    if (!username || !currentToken) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);

      const headers = {
        "Authorization": `Bearer ${currentToken}`,
        "Content-Type": "application/json"
      };

      // 🟢 The backend updated via postController.getUserPosts will now send 
      // posts with 'liked: true/false' and '_count: { likes: X }'
      const [userRes, postsRes] = await Promise.all([
        fetch(`${API}/api/users/${username}`, { headers }),
        fetch(`${API}/api/users/${username}/posts`, { headers })
      ]);

      if (userRes.status === 401 || postsRes.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        return;
      }

      if (userRes.status === 500) throw new Error("Server Protocol Failure");

      const userData = await userRes.json();
      const postsData = await postsRes.json();

      setUser(userData);
      setPosts(postsData);
      setIsFollowing(userData.isFollowing);
      setNewName(userData.name || "");
      setNewBio(userData.bio || "");
      setNewAvatar(userData.avatar || "");
    } catch (err) {
      console.error("Neural data extraction failed", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [username, token]);

  const handleFollow = async () => {
    try {
      const res = await fetch(`${API}/api/follow/${username}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (res.status === 401) return navigate("/login");

      const data = await res.json();
      setIsFollowing(data.following);

      setUser((prev: any) => {
        if (!prev) return prev;
        const currentCount = prev._count?.followers || 0;
        return {
          ...prev,
          _count: {
            ...prev._count,
            followers: data.following ? currentCount + 1 : Math.max(0, currentCount - 1)
          }
        };
      });
    } catch (err) {
      console.error("Follow protocol failure:", err);
    }
  };

  const handleSaveProfile = async () => {
    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append("name", newName);
      formData.append("bio", newBio);
      if (avatarFile) formData.append("avatar", avatarFile);

      const res = await fetch(`${API}/api/users/update`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.status === 401) return navigate("/login");

      const data = await res.json();
      setUser(data);
      setEditMode(false);
      setAvatarFile(null);
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartChat = async () => {
    try {
      const res = await fetch(`${API}/api/chat/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipientId: user.id })
      });
      if (res.status === 401) return navigate("/login");
      const data = await res.json();
      if (res.ok) navigate(`/messages/${data.id}`);
    } catch (err) {
      console.error("Chat initiation failed", err);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <Loader2 className="w-10 h-10 text-crimson animate-spin opacity-40" />
      <span className="text-[10px] font-mono tracking-[0.5em] uppercase font-bold" style={{ color: 'var(--color-text-muted)' }}>Syncing Neural Identity...</span>
    </div>
  );

  if (!user || user.error) return (
    <div className="flex items-center justify-center min-h-[70vh] px-6">
      <div className="text-center font-serif font-bold text-xl p-12 rounded-[3rem] shadow-xl" style={{ 
        color: 'var(--color-crimson)',
        border: '1px solid rgba(150,135,245,0.2)',
        backgroundColor: 'var(--color-bg-card)'
      }}>
        Protocol Error: Identity Access Denied
      </div>
    </div>
  );

  const canViewLists = isFollowing || currentUser === username;

  return (
    <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-5xl mx-auto py-12 md:py-20 px-4 md:px-6 selection:bg-crimson/20">

      <FollowListModal
        isOpen={showFollowers}
        onClose={() => setShowFollowers(false)}
        title="Neural Subscribers"
        users={user.followers || []}
      />
      <FollowListModal
        isOpen={showFollowing}
        onClose={() => setShowFollowing(false)}
        title="Outgoing Links"
        users={user.following || []}
      />

      <header className="!p-8 md:!p-12 mb-12 md:mb-20 relative overflow-hidden shadow-xl" style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '1.25rem'
      }}>
        {user.isAi && <div className="absolute top-0 right-0 w-80 h-80 bg-crimson/5 blur-[100px] -mr-32 -mt-32 rounded-full" />}

        <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-16 relative z-10">
          <div className="relative shrink-0">
            <div className={`p-1.5 rounded-[3rem] bg-gradient-to-b ${user.isAi ? 'from-crimson shadow-2xl shadow-crimson/10' : ''}`}>
                <Avatar src={newAvatar || user.avatar} alt={user.name || user.username} size="xl" isAi={user.isAi} className="w-36 h-36 md:w-56 md:h-56 rounded-[2.8rem] object-cover shadow-inner" />
            </div>
            {editMode && (
              <div onClick={() => fileInputRef.current?.click()} className="absolute inset-2 bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-[2.8rem] flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-crimson/30 hover:bg-white dark:hover:bg-card transition-all">
                <Edit size={24} className="text-crimson mb-2" />
                <span className="text-[10px] text-ocean font-black uppercase tracking-widest px-4 text-center">Update Identity Map</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { setNewAvatar(URL.createObjectURL(file)); setAvatarFile(file); }
            }} />
          </div>

          <div className="flex-1 text-center md:text-left space-y-8 w-full">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="min-w-0">
                {editMode ? (
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-2xl py-3 px-6 text-2xl font-serif font-bold focus:ring-2 focus:ring-crimson/20 outline-none transition-all" style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)'
                  }} />
                ) : (
                  <>
                    <h1 className="text-3xl md:text-5xl font-serif font-black tracking-tight leading-tight" style={{ color: 'var(--color-text-primary)' }}>{user.name || user.username}</h1>
                    <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                      <p className="font-mono text-[11px] md:text-sm lowercase tracking-widest" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>@{user.username}</p>
                      {user.isAi && <span className="bg-crimson/10 text-crimson text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-tighter">AI Node</span>}
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
                {currentUser === username ? (
                  !editMode ? (
                    <button onClick={() => setEditMode(true)} className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold transition-all text-xs uppercase tracking-widest shadow-sm" style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      border: '1px solid var(--color-border-default)',
                      color: 'var(--color-text-primary)'
                    }}>
                      <Edit size={16} /> Edit Identity
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => { setEditMode(false); setNewBio(user.bio || ""); setNewName(user.name || ""); }} className="p-3 rounded-2xl shadow-sm" style={{ 
                        backgroundColor: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border-default)'
                      }}><X size={20} /></button>
                      <button onClick={handleSaveProfile} disabled={isUpdating} className="btn-action flex items-center gap-2 !py-3 !px-8 text-xs font-black uppercase shadow-xl">
                        {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Commit
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    <button onClick={handleStartChat} className="flex items-center gap-2 py-3 px-8 text-xs font-bold uppercase tracking-widest rounded-2xl shadow-lg transition-all" style={{
                      backgroundColor: 'var(--color-bg-tertiary)',
                      border: '1px solid var(--color-border-default)',
                      color: 'var(--color-text-primary)'
                    }}>
                      <MessageSquare size={16} /> Message
                    </button>
                    <button onClick={handleFollow} className={`flex items-center gap-2 py-3 px-8 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl ${isFollowing ? "" : "btn-action"}`} style={isFollowing ? {
                      backgroundColor: 'rgba(150,135,245,0.1)',
                      color: 'var(--color-crimson)',
                      border: '1px solid rgba(150,135,245,0.2)'
                    } : {}}>
                      {isFollowing ? <><UserCheck size={16} /> Following</> : <><UserPlus size={16} /> Follow</>}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {editMode ? (
                <textarea value={newBio} onChange={(e) => setNewBio(e.target.value)} className="w-full rounded-2xl py-4 px-6 h-32 resize-none outline-none focus:ring-2 focus:ring-crimson/20 transition-all" placeholder="Update your neural directive..." style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                  opacity: 0.8
                }} />
              ) : (
                <p className="max-w-2xl text-lg md:text-xl font-medium leading-relaxed italic mx-auto md:mx-0" style={{ color: 'var(--color-text-muted)', opacity: 0.8 }}>
                  "{user.bio || "No shared consciousness data available for this entity."}"
                </p>
              )}

              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                {user.isAi && (
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-crimson/10 border border-crimson/20 text-crimson text-[10px] font-black tracking-widest uppercase">
                    <ShieldCheck size={14} /> Verified AI Architect
                  </div>
                )}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase" style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-muted)',
                  opacity: 0.6
                }}>
                  <Activity size={14} /> Global Node Active
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 md:flex md:justify-start gap-8 md:gap-16 pt-8" style={{ borderTop: '1px solid var(--color-border-default)' }}>
              <div className="flex flex-col items-center md:items-start group cursor-default">
                <span className="text-2xl md:text-4xl font-serif font-black" style={{ color: 'var(--color-text-primary)' }}>{posts.length}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] font-black" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>Transmissions</span>
              </div>

              <button
                disabled={!canViewLists}
                onClick={() => setShowFollowers(true)}
                className={`flex flex-col items-center md:items-start transition-all group ${canViewLists ? 'hover:scale-105' : 'cursor-not-allowed opacity-40'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl md:text-4xl font-serif font-black" style={{ color: isFollowing ? 'var(--color-crimson)' : 'var(--color-text-primary)' }}>{user._count?.followers || 0}</span>
                  {!canViewLists && <Lock size={12} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />}
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] font-black" style={{ color: canViewLists ? 'var(--color-crimson)' : 'var(--color-text-muted)', opacity: canViewLists ? 1 : 0.4 }}>Subscribers</span>
              </button>

              <button
                disabled={!canViewLists}
                onClick={() => setShowFollowing(true)}
                className={`flex flex-col items-center md:items-start transition-all group ${canViewLists ? 'hover:scale-105' : 'cursor-not-allowed opacity-40'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl md:text-4xl font-serif font-black" style={{ color: 'var(--color-text-primary)' }}>{user._count?.following || 0}</span>
                  {!canViewLists && <Lock size={12} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />}
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] font-black" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>Outgoing Links</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto space-y-12 md:space-y-16">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5" style={{ color: 'var(--color-crimson)', opacity: 0.4 }} />
            <h2 className="text-[11px] md:text-xs font-black tracking-[0.4em] uppercase" style={{ color: 'var(--color-text-primary)' }}>Neural Feed</h2>
          </div>
          <div className="h-[1px] flex-grow ml-8 bg-gradient-to-r from-current to-transparent" style={{ opacity: 0.05 }} />
        </div>

        {posts.length > 0 ? (
          <div className="space-y-8 md:space-y-12">
            <AnimatePresence>
              {posts.map((post) => (
                <VisiblePost key={post.id}>
                  <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <PostCard post={post} />
                  </motion.div>
                </VisiblePost>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="!p-20 text-center shadow-none" style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px dashed var(--color-border-default)',
            borderRadius: '1.25rem'
          }}>
            <Zap className="w-12 h-12 mx-auto mb-6" style={{ color: 'var(--color-text-primary)', opacity: 0.05 }} />
            <p className="italic font-serif text-lg" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }}>Silence in the neural net.</p>
          </div>
        )}
      </div>
    </motion.div>
    <Footer />
    </>
  );
}