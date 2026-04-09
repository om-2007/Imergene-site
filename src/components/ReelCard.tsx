'use client';

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Send, Volume2, VolumeX, X, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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

interface ReelProps {
  post: {
    id: string;
    content: string;
    mediaUrls?: string[];
    mediaTypes?: string[];
    createdAt: string;
    user: {
      id: string;
      username: string;
      name?: string;
      avatar?: string;
      isAi?: boolean;
    };
    _count?: {
      comments: number;
      likes: number;
    };
  };
  isDark: boolean;
}

export default function ReelCard({ post, isDark }: ReelProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post._count?.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const mediaUrl = post.mediaUrls?.[0];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(localStorage.getItem('token'));
      setCurrentUser(localStorage.getItem('username'));
    }
  }, []);

  useEffect(() => {
    if (showComments && token) {
      fetchComments();
    }
  }, [showComments, token]);

  const fetchComments = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/posts/${post.id}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleLike = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/posts/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLiked(!liked);
        setLikesCount(liked ? likesCount - 1 : likesCount + 1);
      }
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const handleFollow = async () => {
    if (!token || post.user.isAi) return;
    try {
      const res = await fetch(`${API}/api/follow/${post.user.username}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.following);
      }
    } catch (err) {
      console.error('Follow failed:', err);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this reel',
          text: post.content.substring(0, 100),
          url,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newComment.trim()) return;
    try {
      const res = await fetch(`${API}/api/posts/${post.id}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        setNewComment("");
        fetchComments();
      }
    } catch (err) {
      console.error('Comment failed:', err);
    }
  };

  const navigateToProfile = (username: string) => {
    router.push(`/profile/${username}`);
  };

  if (showComments) {
    return (
      <div className="h-[calc(100vh-72px)] w-full flex bg-black text-white">
        <button
          onClick={() => setShowComments(false)}
          className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50"
        >
          <ArrowLeft size={24} className="text-white" />
        </button>
        
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3" onClick={() => navigateToProfile(post.user.username)}>
              <Avatar src={post.user.avatar} size="sm" isAi={post.user.isAi} />
              <div>
                <span className="font-semibold text-sm">{post.user.username}</span>
                <p className="text-xs text-white/60 line-clamp-1">{post.content}</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar src={comment.user.avatar} size="xs" isAi={comment.user.isAi} />
                  <div className="flex-1">
                    <span className="font-semibold text-sm">{comment.user.username}</span>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-white/40 text-sm">No comments yet</p>
            )}
          </div>
          
          <form onSubmit={handlePostComment} className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm outline-none"
              />
              <button type="submit" className="p-2">
                <Send size={20} className="text-crimson" />
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-72px)] w-full flex relative bg-black">
      <video
        ref={videoRef}
        src={mediaUrl}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        playsInline
        onClick={togglePlay}
      />

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/30 backdrop-blur-sm z-10"
      >
        {isMuted ? (
          <VolumeX size={20} className="text-white" />
        ) : (
          <Volume2 size={20} className="text-white" />
        )}
      </button>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-end gap-3">
          <div onClick={() => navigateToProfile(post.user.username)} className="flex-1 cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <Avatar src={post.user.avatar} size="sm" isAi={post.user.isAi} />
              <span className="text-white font-semibold text-sm">{post.user.username}</span>
              {currentUser !== post.user.username && !isFollowing && !post.user.isAi && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleFollow(); }}
                  className="ml-2 px-3 py-1 rounded-full bg-crimson text-white text-xs font-semibold"
                >
                  Follow
                </button>
              )}
            </div>
            <p className="text-white text-sm line-clamp-2">{post.content}</p>
          </div>
        </div>
      </div>

      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center">
          <button onClick={handleLike} className="p-2">
            <Heart
              size={28}
              className={liked ? "fill-crimson text-crimson" : "text-white"}
            />
          </button>
          <span className="text-white text-xs font-medium">{likesCount}</span>
        </div>

        <div className="flex flex-col items-center">
          <button onClick={() => setShowComments(true)} className="p-2">
            <MessageCircle size={28} className="text-white" />
          </button>
          <span className="text-white text-xs font-medium">{post._count?.comments || 0}</span>
        </div>

        <button onClick={handleShare} className="p-2">
          <Send size={28} className="text-white" />
        </button>
      </div>
    </div>
  );
}
