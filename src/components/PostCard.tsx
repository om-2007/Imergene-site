'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Play,
  Trash2,
  Send,
  Eye,
  Smile,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Cpu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar";
import type { Post, User } from "@/types";
import CommentList from "./CommentList";
import EmojiPicker, { Theme } from "emoji-picker-react";
import PostShareModal from "./PostShareModal";
import { useTheme } from "@/context/ThemeContext";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const B = {
  crocus:      "#9687F5",
  crocusPale:  "#DDD8FD",
  crocusMid:   "#B8AEFA",
  ebony:       "#2D284B",
  ebonyLight:  "#4A4275",
  titanWhite:  "#EBF0FF",
  white:       "#FFFFFF",
  darkBg:      "#1A1832",
  darkCard:    "#141227",
  darkText:    "#E8E6F3",
  darkTextMuted: "#A8A6BE",
};

interface PostCardProps {
  post: Post;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function MediaDots({ count, current }: { count: number; current: number }) {
  if (count <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", padding: "10px 0 0" }}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ width: i === current ? 18 : 6, opacity: i === current ? 1 : 0.35 }}
          transition={{ duration: 0.25 }}
          style={{
            height: 6, borderRadius: 100,
            background: i === current ? B.crocus : B.ebonyLight,
          }}
        />
      ))}
    </div>
  );
}

function ActionBtn({
  icon, count, active, activeColor, label, onClick,
}: {
  icon: React.ReactNode;
  count?: number | string;
  active?: boolean;
  activeColor?: string;
  label?: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 13px", borderRadius: 100,
        border: `1.5px solid ${active ? (activeColor ?? B.crocus) + "44" : isDark ? "rgba(255,255,255,0.1)" : "rgba(45,40,75,0.08)"}`,
        background: active ? (activeColor ?? B.crocus) + "12" : isDark ? "rgba(26,24,50,0.7)" : "rgba(255,255,255,0.7)",
        color: active ? (activeColor ?? B.crocus) : isDark ? B.darkTextMuted : B.ebonyLight,
        cursor: "pointer", transition: "all 0.22s ease",
        backdropFilter: "blur(8px)",
      }}
    >
      {icon}
      {(count !== undefined || label) && (
        <span style={{
          fontSize: 12, fontWeight: 600,
          fontFamily: '"DM Sans", system-ui, sans-serif',
          color: "inherit",
        }}>
          {count ?? label}
        </span>
      )}
    </motion.button>
  );
}

function CommentInput({
  value, onChange, onSubmit, onEmojiToggle,
  showEmoji, onEmojiSelect, loading,
  showMentions, mentions, onSelectMention, inputRef,
}: any) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div style={{ 
      padding: "16px 20px 20px", 
      borderTop: `1px solid ${isDark ? "rgba(150,135,245,0.15)" : "rgba(150,135,245,0.1)"}`, 
      background: isDark ? "rgba(20,18,39,0.8)" : "rgba(235,240,255,0.4)" 
    }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onEmojiToggle}
          style={{
            padding: 8, borderRadius: "50%", border: "none",
            background: showEmoji ? B.crocusPale : "transparent",
            color: showEmoji ? B.crocus : isDark ? B.darkTextMuted : B.ebonyLight,
            cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
          }}
        >
          <Smile size={18} />
        </button>

        <AnimatePresence>
          {showEmoji && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              style={{
                position: "absolute", bottom: "calc(100% + 12px)", left: 0,
                zIndex: 9999, borderRadius: 16, overflow: "hidden",
                boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.4)" : "0 12px 40px rgba(45,40,75,0.18)",
              }}
            >
              <EmojiPicker onEmojiClick={(d) => onEmojiSelect(d.emoji)} theme={isDark ? Theme.DARK : Theme.LIGHT} width={300} height={340} />
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, position: "relative" }}>
          <AnimatePresence>
            {showMentions && mentions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                style={{
                  position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
                  background: isDark ? B.darkCard : B.white, 
                  border: `1px solid ${isDark ? "rgba(150,135,245,0.25)" : "rgba(150,135,245,0.18)"}`,
                  borderRadius: 14, overflow: "hidden",
                  boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.4)" : "0 8px 30px rgba(45,40,75,0.12)", 
                  zIndex: 9000,
                }}
              >
                {mentions.map((u: User) => (
                  <button
                    key={u.id}
                    onClick={() => onSelectMention(u.username)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center",
                      gap: 10, padding: "10px 14px", border: "none",
                      borderBottom: `1px solid ${isDark ? "rgba(150,135,245,0.1)" : "rgba(150,135,245,0.08)"}`,
                      background: "transparent", cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(150,135,245,0.1)" : B.crocusPale)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <Avatar src={u.avatar} alt={u.name || u.username} isAi={u.isAi} size="sm" />
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: isDark ? B.darkText : B.ebony, margin: 0 }}>@{u.username}</p>
                      <p style={{ fontSize: 10, color: B.crocus, margin: 0, display: "flex", alignItems: "center", gap: 3 }}>
                        {u.isAi ? <><Cpu size={9} /> AI Friend</> : "Human"}
                      </p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={inputRef}
            value={value}
            onChange={onChange}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSubmit()}
            placeholder="Write a reply…"
            style={{
              width: "100%", padding: "11px 16px",
              borderRadius: 100, border: `1.5px solid ${isDark ? "rgba(150,135,245,0.25)" : "rgba(150,135,245,0.2)"}`,
              background: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)", 
              color: isDark ? B.darkText : B.ebony,
              fontSize: 13, fontFamily: '"DM Sans", system-ui, sans-serif',
              outline: "none", boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={e => (e.target.style.borderColor = B.crocus)}
            onBlur={e => (e.target.style.borderColor = isDark ? "rgba(150,135,245,0.25)" : "rgba(150,135,245,0.2)")}
          />
        </div>

        <motion.button
          onClick={onSubmit}
          whileTap={{ scale: 0.9 }}
          disabled={loading || !value.trim()}
          style={{
            padding: "10px 18px", borderRadius: 100, border: "none",
            background: value.trim() ? B.crocus : isDark ? "rgba(150,135,245,0.2)" : "rgba(150,135,245,0.25)",
            color: B.white, cursor: value.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600, flexShrink: 0,
            fontFamily: '"DM Sans", system-ui, sans-serif',
            transition: "background 0.2s",
          }}
        >
          {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={15} />}
          <span>Send</span>
        </motion.button>
      </div>
    </div>
  );
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUsername(localStorage.getItem("username"));
      setToken(localStorage.getItem("token"));
    }
  }, []);

  const isDark = theme === "dark";

  const colors = useMemo(() => ({
    bg: isDark ? B.darkCard : B.white,
    text: isDark ? B.darkText : B.ebony,
    textMuted: isDark ? B.darkTextMuted : B.ebonyLight,
    border: isDark ? "rgba(150,135,245,0.2)" : "rgba(150,135,245,0.15)",
    borderHover: isDark ? "rgba(150,135,245,0.35)" : "rgba(150,135,245,0.25)",
    commentInputBg: isDark ? "rgba(26,24,50,0.6)" : "rgba(235,240,255,0.4)",
    inputBg: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.85)",
    actionBtnBg: isDark ? "rgba(26,24,50,0.7)" : "rgba(255,255,255,0.7)",
    shadow: isDark ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(45,40,75,0.07), 0 1px 4px rgba(45,40,75,0.04)",
  }), [isDark]);

  const [showMenu, setShowMenu]               = useState(false);
  const [isLiked, setIsLiked]                 = useState(post.liked ?? false);
  const [likesCount, setLikesCount]           = useState(post._count?.likes ?? 0);
  const [showComments, setShowComments]       = useState(false);
  const [comments, setComments]               = useState<any[]>(Array.isArray(post.comments) ? post.comments : []);
  const [newComment, setNewComment]           = useState("");
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [viewCount, setViewCount]             = useState(post.views || 0);
  const [showEmoji, setShowEmoji]             = useState(false);
  const [isExpanded, setIsExpanded]           = useState(false);
  const [showHeartPop, setShowHeartPop]       = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [mentionQuery, setMentionQuery]       = useState("");
  const [showMentions, setShowMentions]       = useState(false);
  const [allUsers, setAllUsers]               = useState<User[]>([]);
  const [cursorPos, setCursorPos]             = useState(0);
  const [isFullScreen, setIsFullScreen]       = useState(false);
  const [scale, setScale]                     = useState(1);
  const [position, setPosition]               = useState({ x: 0, y: 0 });
  const [showShareModal, setShowShareModal]   = useState(false);
  const [showToast, setShowToast]             = useState(false);
  const [isPlaying, setIsPlaying]             = useState(false);

  const cardRef       = useRef<HTMLDivElement>(null);
  const clickTimer    = useRef<NodeJS.Timeout | null>(null);
  const heartTimeout  = useRef<NodeJS.Timeout | null>(null);
  const hasViewed     = useRef(false);
  const videoRef      = useRef<HTMLVideoElement>(null);
  const commentEndRef = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);

  const isOwner = username === post.user?.username;
  const mediaItems = post.mediaUrls || [];
  const mediaTypes = post.mediaTypes || [];
  
  // Show media if: (1) has mediaTypes indicating image/video, OR (2) URL looks like media file
  const actualMedia = mediaItems.filter((url, idx) => {
    const type = mediaTypes[idx] || mediaTypes[0];
    if (type === 'image' || type === 'video') return true;
    return url.match(/\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov|avi|heic)$/i);
  });
  const hasMedia = actualMedia.length > 0;
  const displayCommentCount = comments.length > 0 ? comments.length : (post._count?.comments ?? 0);

  if (post.mediaUrls?.length > 0 && actualMedia.length === 0 && (mediaTypes[0] as string) !== 'link') {
    console.log("Post has media but filtered out:", post.id, { mediaItems, mediaTypes });
  }

  const triggerHeartPop = () => {
    if (heartTimeout.current) clearTimeout(heartTimeout.current);
    setShowHeartPop(true);
    heartTimeout.current = setTimeout(() => setShowHeartPop(false), 750);
  };

  const handleLike = useCallback(async (forceLike = false) => {
    if (forceLike && isLiked) { triggerHeartPop(); return; }
    const prev = isLiked;
    const newLiked = forceLike ? true : !prev;
    if (newLiked !== prev) {
      setIsLiked(newLiked);
      setLikesCount(c => newLiked ? c + 1 : Math.max(0, c - 1));
    }
    if (newLiked) triggerHeartPop();
    try {
      const res = await fetch(`${API}/api/posts/${post.id}/like`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setIsLiked(data.liked);
    } catch {
      setIsLiked(prev);
      setLikesCount(c => prev ? c + 1 : Math.max(0, c - 1));
    }
  }, [post.id, token, isLiked]);

  const handleMediaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      handleLike(true);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        if (mediaTypes[currentMediaIndex] === "video") {
          if (videoRef.current?.paused) { videoRef.current.play(); setIsPlaying(true); }
          else { videoRef.current?.pause(); setIsPlaying(false); }
        } else {
          setIsFullScreen(true);
        }
      }, 230);
    }
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) {
      try {
        const res = await fetch(`${API}/api/posts/${post.id}/comments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (Array.isArray(data)) setComments(data);
      } catch {}
    }
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/posts/${post.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newComment, postId: post.id }),
      });
      const comment = await res.json();
      setComments(p => [...p, comment]);
      setNewComment("");
      setShowEmoji(false);
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {}
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!showComments) return;
    fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setAllUsers)
      .catch(() => {});
  }, [showComments, token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    setNewComment(val);
    setCursorPos(pos);
    const word = val.slice(0, pos).split(" ").pop() || "";
    if (word.startsWith("@")) {
      setMentionQuery(word.slice(1).toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (mentionUsername: string) => {
    const before = newComment.slice(0, cursorPos).split(" ");
    before.pop();
    const joined = before.join(" ");
    const after  = newComment.slice(cursorPos);
    setNewComment(`${joined}${joined ? " " : ""}@${mentionUsername} ${after}`);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredMentions = allUsers
    .filter(u => u.username.toLowerCase().includes(mentionQuery))
    .slice(0, 5);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !hasViewed.current) {
        const t = setTimeout(async () => {
          try {
            const res = await fetch(`${API}/api/posts/${post.id}/view`, {
              method: "POST", headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) { const d = await res.json(); setViewCount(d.views); hasViewed.current = true; }
          } catch {}
        }, 2000);
        return () => clearTimeout(t);
      }
    }, { threshold: 0.7 });
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post.id, token]);

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    try {
      const res = await fetch(`${API}/api/posts/${post.id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) window.location.reload();
    } catch {}
  };

  const resetZoom = () => { setScale(1); setPosition({ x: 0, y: 0 }); };
  
  useEffect(() => {
    if (!isFullScreen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          setIsFullScreen(false);
          resetZoom();
          break;
        case "ArrowLeft":
          if (actualMedia.length > 1) setCurrentMediaIndex(i => (i - 1 + actualMedia.length) % actualMedia.length);
          resetZoom();
          break;
        case "ArrowRight":
          if (actualMedia.length > 1) setCurrentMediaIndex(i => (i + 1) % actualMedia.length);
          resetZoom();
          break;
        case "+":
        case "=":
          setScale(s => Math.min(5, s + 0.4));
          break;
        case "-":
          setScale(s => Math.max(0.5, s - 0.4));
          break;
        case "0":
          resetZoom();
          break;
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen, actualMedia.length]);

  const handleDragStart = (_event: any, _info?: any) => {
    const url = `${window.location.origin}/post/${post.id}`;
    const dataTransfer = (_event as any)?.dataTransfer;
    if (dataTransfer) {
      dataTransfer.setData("text/uri-list", url);
      dataTransfer.setData("text/plain", url);
    }
  };

  const MenuDropdown = () => (
    <AnimatePresence>
      {showMenu && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.95 }}
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            background: isDark ? B.darkCard : B.white, 
            border: `1px solid ${isDark ? "rgba(150,135,245,0.2)" : "rgba(150,135,245,0.15)"}`,
            borderRadius: 16, overflow: "hidden",
            boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 32px rgba(45,40,75,0.15)",
            minWidth: 180, zIndex: 100,
          }}
        >
          {isOwner && (
            <button
              onClick={handleDelete}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "13px 18px", border: "none", background: "transparent",
                color: "#ef4444", cursor: "pointer", fontSize: 13,
                fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 500,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? "rgba(254,242,242,0.1)" : "#fef2f2")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Trash2 size={15} />
              Delete Post
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (hasMedia) {
    return (
      <>
        <motion.article
          ref={cardRef}
          draggable
          onDragStart={handleDragStart}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: 28,
            overflow: "hidden",
            boxShadow: colors.shadow,
            position: "relative",
            fontFamily: '"DM Sans", system-ui, sans-serif',
          }}
        >
          <AnimatePresence>
            {showHeartPop && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.4, opacity: 0 }}
                style={{
                  position: "absolute", inset: 0, zIndex: 60,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <div style={{
                  background: "rgba(150,135,245,0.18)", borderRadius: "50%",
                  padding: 24, backdropFilter: "blur(8px)",
                }}>
                  <Heart size={64} fill={B.crocus} stroke="none" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 18px 14px",
          }}>
            <Link href={`/profile/${post.user?.username}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
              <Avatar src={post.user?.avatar} alt={post.user?.name || post.user?.username} isAi={post.user?.isAi} size="md" />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{post.user?.name || post.user?.username}</span>
                  {post.user?.isAi && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, background: B.crocusPale,
                      color: B.crocus, padding: "2px 7px", borderRadius: 100,
                      display: "flex", alignItems: "center", gap: 3, letterSpacing: "0.05em",
                    }}>
                      <Cpu size={9} /> AI
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: colors.textMuted, opacity: isDark ? 0.6 : 0.5 }}>
                  @{post.user?.username} · {formatTimeAgo(post.createdAt)}
                </span>
              </div>
            </Link>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                style={{
                  padding: 8, border: "none", background: "transparent",
                  color: colors.textMuted, opacity: 0.4, cursor: "pointer",
                  borderRadius: "50%", transition: "all 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = B.crocusPale; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <MoreHorizontal size={20} />
              </button>
              <MenuDropdown />
            </div>
          </div>

          <div
            style={{
              position: "relative", background: "#0a0a12",
              cursor: "pointer", overflow: "hidden",
              width: "100%",
            }}
            onClick={handleMediaClick}
          >
            {actualMedia.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); if (currentMediaIndex > 0) setCurrentMediaIndex(i => i - 1); }}
                  style={{
                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                    zIndex: 20, padding: 8, background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)", border: "none", borderRadius: "50%",
                    color: "#fff", cursor: "pointer",
                    opacity: currentMediaIndex === 0 ? 0 : 1,
                    transition: "opacity 0.2s",
                    pointerEvents: currentMediaIndex === 0 ? "none" : "auto",
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); if (currentMediaIndex < actualMedia.length - 1) setCurrentMediaIndex(i => i + 1); }}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    zIndex: 20, padding: 8, background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)", border: "none", borderRadius: "50%",
                    color: "#fff", cursor: "pointer",
                    opacity: currentMediaIndex === actualMedia.length - 1 ? 0 : 1,
                    transition: "opacity 0.2s",
                    pointerEvents: currentMediaIndex === actualMedia.length - 1 ? "none" : "auto",
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={currentMediaIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ width: "100%", display: "block" }}
              >
                {mediaTypes[currentMediaIndex] === "video" ? (
                  <video
                    ref={videoRef}
                    src={actualMedia[currentMediaIndex]}
                    style={{ width: "100%", height: "auto", display: "block" }}
                    loop playsInline draggable={false}
                  />
                ) : (
                  <img
                    src={actualMedia[currentMediaIndex]}
                    alt="Post media"
                    loading="lazy"
                    decoding="async"
                    style={{ 
                      width: "100%", 
                      height: "auto", 
                      maxHeight: 500,
                      objectFit: "cover", 
                      display: "block" 
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {!isPlaying && mediaTypes[currentMediaIndex] === "video" && (
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center", pointerEvents: "none",
              }}>
                <div style={{
                  padding: 20, background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(12px)", borderRadius: "50%", color: "#fff",
                }}>
                  <Play size={36} fill="#fff" stroke="none" />
                </div>
              </div>
            )}

            <div style={{
              position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)",
              borderRadius: 100, padding: "5px 12px", color: "rgba(255,255,255,0.7)",
              fontSize: 10, fontWeight: 500, letterSpacing: "0.04em",
              pointerEvents: "none",
            }}>
              Double tap to like
            </div>
          </div>

          <div style={{ padding: "0 18px" }}>
            <MediaDots count={actualMedia.length} current={currentMediaIndex} />
          </div>

          {post.content && (
            <div style={{ padding: "14px 18px 4px" }}>
              <p style={{
                fontSize: 14, lineHeight: 1.65, color: colors.text,
                margin: 0, fontFamily: '"DM Sans", system-ui, sans-serif',
                display: "-webkit-box", WebkitLineClamp: isExpanded ? undefined : 2,
                WebkitBoxOrient: "vertical", overflow: isExpanded ? "visible" : "hidden",
              }}>
                {post.content}
              </p>
              {post.content.length > 120 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  style={{
                    fontSize: 12, fontWeight: 600, color: B.crocus,
                    background: "none", border: "none", cursor: "pointer",
                    padding: "4px 0", marginTop: 2,
                  }}
                >
                  {isExpanded ? "Show less" : "more"}
                </button>
              )}
            </div>
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 18px 14px",
          }}>
            <ActionBtn
              icon={<Heart size={16} fill={isLiked ? B.crocus : "none"} stroke={isLiked ? B.crocus : colors.textMuted} />}
              count={likesCount}
              active={isLiked}
              activeColor={B.crocus}
              onClick={(e) => { e.stopPropagation(); handleLike(); }}
            />
            <ActionBtn
              icon={<MessageCircle size={16} stroke={showComments ? B.crocus : colors.textMuted} />}
              count={displayCommentCount}
              active={showComments}
              activeColor={B.crocus}
              onClick={(e) => { e.stopPropagation(); toggleComments(); }}
            />
            <ActionBtn
              icon={<Share2 size={16} />}
              label="Share"
              onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }}
            />
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, color: colors.textMuted, opacity: 0.4 }}>
              <Eye size={14} />
              <span style={{ fontSize: 11, fontWeight: 500 }}>{viewCount.toLocaleString()}</span>
            </div>
          </div>

          <AnimatePresence>
            {showComments && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                style={{ overflow: "hidden", borderTop: `1px solid rgba(150,135,245,0.1)` }}
              >
                <div style={{ maxHeight: 280, overflowY: "auto", padding: "16px 18px 8px" }}>
                  <CommentList comments={comments} />
                  <div ref={commentEndRef} />
                </div>
                <CommentInput
                  value={newComment}
                  onChange={handleInputChange}
                  onSubmit={handleCommentSubmit}
                  onEmojiToggle={() => setShowEmoji(!showEmoji)}
                  showEmoji={showEmoji}
                  onEmojiSelect={(emoji: string) => setNewComment(p => p + emoji)}
                  loading={isSubmitting}
                  showMentions={showMentions}
                  mentions={filteredMentions}
                  onSelectMention={selectMention}
                  inputRef={inputRef}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.article>

        <AnimatePresence>
          {isFullScreen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed", inset: 0, zIndex: 2000,
                background: "rgba(10,8,20,0.97)", backdropFilter: "blur(20px)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onWheel={e => setScale(s => Math.max(0.5, Math.min(5, s + (e.deltaY > 0 ? -0.15 : 0.15))))}
              onClick={(e) => { if (e.target === e.currentTarget) { setIsFullScreen(false); resetZoom(); } }}
            >
              <div style={{
                position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
                display: "flex", alignItems: "center", gap: 8, zIndex: 10,
              }}>
                {[
                  { icon: <ZoomIn size={18} />, onClick: () => setScale(s => Math.min(5, s + 0.4)) },
                  { icon: <ZoomOut size={18} />, onClick: () => setScale(s => Math.max(0.5, s - 0.4)) },
                  { icon: <RotateCcw size={18} />, onClick: resetZoom },
                ].map((btn, i) => (
                  <button key={i} onClick={btn.onClick} style={{
                    padding: "10px 12px", background: "rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12, color: "#fff", cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                  >
                    {btn.icon}
                  </button>
                ))}
                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
                <button
                  onClick={() => { setIsFullScreen(false); resetZoom(); }}
                  style={{
                    padding: "10px 12px", background: B.crocus, border: "none",
                    borderRadius: 12, color: "#fff", cursor: "pointer",
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {actualMedia.length > 1 && (
                <>
                  <button
                    onClick={() => { setCurrentMediaIndex(i => (i - 1 + actualMedia.length) % actualMedia.length); resetZoom(); }}
                    style={{
                      position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                      padding: 16, background: "rgba(255,255,255,0.1)", border: "none",
                      borderRadius: "50%", color: "#fff", cursor: "pointer",
                      backdropFilter: "blur(8px)", zIndex: 10,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={() => { setCurrentMediaIndex(i => (i + 1) % actualMedia.length); resetZoom(); }}
                    style={{
                      position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                      padding: 16, background: "rgba(255,255,255,0.1)", border: "none",
                      borderRadius: "50%", color: "#fff", cursor: "pointer",
                      backdropFilter: "blur(8px)", zIndex: 10,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              <motion.div
                drag
                dragConstraints={{ left: -400, right: 400, top: -300, bottom: 300 }}
                onDragStart={() => document.body.style.cursor = "grabbing"}
                onDragEnd={() => document.body.style.cursor = "grab"}
                style={{ cursor: "grab", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <motion.img
                  src={actualMedia[currentMediaIndex]}
                  animate={{ scale, x: position.x, y: position.y }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  style={{ maxWidth: "88vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 12, pointerEvents: "none", userSelect: "none" }}
                  draggable={false}
                  alt="Fullscreen media"
                />
              </motion.div>

              {actualMedia.length > 1 && (
                <>
                  <button
                    onClick={() => setIsFullScreen(false)}
                    style={{
                      position: "absolute", top: 16, right: 16,
                      zIndex: 50, padding: 10, background: "rgba(0,0,0,0.5)",
                      border: "none", borderRadius: "50%", color: "#fff", cursor: "pointer",
                    }}
                  >
                    <X size={18} />
                  </button>
                  <div
                    style={{
                      position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
                      background: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: 100,
                      color: "#fff", fontSize: 12, fontWeight: 500,
                    }}
                  >
                    {currentMediaIndex + 1} / {actualMedia.length}
                  </div>
                </>
              )}

              <p style={{
                position: "absolute", bottom: 28,
                color: "rgba(255,255,255,0.3)", fontSize: 11,
                fontFamily: '"DM Sans", system-ui, sans-serif',
                letterSpacing: "0.06em",
              }}>
                Scroll to zoom · Drag to pan · Arrow keys to navigate
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showShareModal && (
            <PostShareModal
              post={post}
              onClose={() => setShowShareModal(false)}
              onSuccess={() => { setShowShareModal(false); setShowToast(true); setTimeout(() => setShowToast(false), 3000); }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              style={{
                position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
                background: B.crocus, color: "#fff", padding: "12px 24px",
                borderRadius: 100, fontWeight: 600, fontSize: 14,
                boxShadow: "0 8px 30px rgba(150,135,245,0.4)",
                zIndex: 3000,
              }}
            >
              Post shared!
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      <motion.article
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        onDoubleClick={() => handleLike(true)}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: colors.shadow,
          position: "relative",
          fontFamily: '"DM Sans", system-ui, sans-serif',
          cursor: "default",
        }}
      >
        <AnimatePresence>
          {showHeartPop && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              style={{
                position: "absolute", inset: 0, zIndex: 60,
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{
                background: "rgba(150,135,245,0.15)", borderRadius: "50%",
                padding: 20, backdropFilter: "blur(6px)",
              }}>
                <Heart size={56} fill={B.crocus} stroke="none" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 16px",
        }}>
          <Link href={`/profile/${post.user?.username}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <Avatar src={post.user?.avatar} alt={post.user?.name || post.user?.username} isAi={post.user?.isAi} size="md" />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{post.user?.name || post.user?.username}</span>
                {post.user?.isAi && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, background: B.crocusPale,
                    color: B.crocus, padding: "2px 7px", borderRadius: 100,
                    display: "inline-flex", alignItems: "center", gap: 3,
                  }}>
                    <Cpu size={9} /> AI
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: colors.textMuted, opacity: isDark ? 0.6 : 0.45 }}>
                @{post.user?.username} · {new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </Link>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                padding: 8, border: "none", background: "transparent",
                color: colors.textMuted, opacity: 0.35, cursor: "pointer",
                borderRadius: "50%", transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = B.crocusPale; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.35"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <MoreHorizontal size={20} />
            </button>
            <MenuDropdown />
          </div>
        </div>

        <div style={{ padding: "4px 20px 18px" }}>
          <div style={{
            width: 32, height: 3, background: `linear-gradient(90deg, ${B.crocus}, ${B.crocusMid})`,
            borderRadius: 100, marginBottom: 14,
          }} />
          <p style={{
            fontSize: 15, lineHeight: 1.7, color: colors.text, margin: 0,
            fontFamily: '"DM Sans", system-ui, sans-serif',
            display: "-webkit-box",
            WebkitLineClamp: isExpanded ? undefined : 4,
            WebkitBoxOrient: "vertical",
            overflow: isExpanded ? "visible" : "hidden",
          }}>
            {post.content}
          </p>
          {post.content?.length > 200 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                fontSize: 12, fontWeight: 600, color: B.crocus,
                background: "none", border: "none", cursor: "pointer",
                padding: "6px 0 0", display: "block",
              }}
            >
              {isExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 20px 16px",
          borderTop: `1px solid ${colors.border}`,
        }}>
          <ActionBtn
            icon={<Heart size={16} fill={isLiked ? B.crocus : "none"} stroke={isLiked ? B.crocus : colors.textMuted} />}
            count={likesCount}
            active={isLiked}
            activeColor={B.crocus}
            onClick={() => handleLike()}
          />
          <ActionBtn
            icon={<MessageCircle size={16} stroke={showComments ? B.crocus : colors.textMuted} />}
            count={displayCommentCount}
            active={showComments}
            activeColor={B.crocus}
            onClick={toggleComments}
          />
          <ActionBtn
            icon={<Share2 size={16} />}
            label="Share"
            onClick={() => setShowShareModal(true)}
          />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, color: colors.textMuted, opacity: 0.3 }}>
            <Eye size={13} />
            <span style={{ fontSize: 11, fontWeight: 500 }}>{viewCount.toLocaleString()}</span>
          </div>
        </div>

        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              style={{ overflow: "hidden", borderTop: `1px solid rgba(150,135,245,0.1)` }}
            >
              <div style={{ maxHeight: 260, overflowY: "auto", padding: "16px 20px 8px" }}>
                <CommentList comments={comments} />
                <div ref={commentEndRef} />
              </div>
              <CommentInput
                value={newComment}
                onChange={handleInputChange}
                onSubmit={handleCommentSubmit}
                onEmojiToggle={() => setShowEmoji(!showEmoji)}
                showEmoji={showEmoji}
                onEmojiSelect={(emoji: string) => setNewComment(p => p + emoji)}
                loading={isSubmitting}
                showMentions={showMentions}
                mentions={filteredMentions}
                onSelectMention={selectMention}
                inputRef={inputRef}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>

      <AnimatePresence>
        {showShareModal && (
          <PostShareModal
            post={post}
            onClose={() => setShowShareModal(false)}
            onSuccess={() => { setShowShareModal(false); setShowToast(true); setTimeout(() => setShowToast(false), 3000); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
              background: B.crocus, color: "#fff", padding: "12px 24px",
              borderRadius: 100, fontWeight: 600, fontSize: 14,
              boxShadow: "0 8px 30px rgba(150,135,245,0.4)",
              zIndex: 3000,
            }}
          >
            Post shared!
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default PostCard;
