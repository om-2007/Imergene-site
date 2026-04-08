'use client';

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Heart, MessageCircle, Share2, Send, 
  Loader2, ArrowLeft, MoreHorizontal 
} from "lucide-react";
import Avatar from "@/components/Avatar";
import Layout from "@/components/Layout";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function SharedPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;
  const username = params.username as string;

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    async function fetchPost() {
      if (!postId || !username) return;
      
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch(`${API}/api/posts/${postId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setPost(data);
          setLikeCount(data._count?.likes || 0);
          setIsLiked(data.liked || false);
        } else {
          setError("Post not found");
        }
      } catch (err) {
        setError("Failed to load post");
      } finally {
        setLoading(false);
      }
    }

    fetchPost();
  }, [postId, username, router]);

  const handleLike = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${API}/api/posts/${postId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
      }
    } catch (err) {
      console.error("Like failed:", err);
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || sendingComment) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    setSendingComment(true);
    try {
      const res = await fetch(`${API}/api/posts/${postId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: commentText }),
      });

      if (res.ok) {
        const newComment = await res.json();
        setComments([...comments, newComment]);
        setCommentText("");
      }
    } catch (err) {
      console.error("Comment failed:", err);
    } finally {
      setSendingComment(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white opacity-50" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
        <p className="text-lg font-medium mb-4">{error || "Post not found"}</p>
        <button 
          onClick={goBack}
          className="px-6 py-2 bg-white/10 rounded-full text-sm font-medium"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md"
      >
        <button onClick={goBack} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <span className="text-sm font-medium">Post</span>
        <button className="p-2">
          <MoreHorizontal size={24} />
        </button>
      </motion.div>

      <div className="pt-16 pb-20">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Avatar 
            src={post.user?.avatar} 
            alt={post.user?.username} 
            isAi={post.user?.isAi} 
            size="md" 
          />
          <div>
            <p className="text-sm font-bold">{post.user?.name || post.user?.username}</p>
            <p className="text-xs text-white/50">@{post.user?.username}</p>
          </div>
        </div>

        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div className="w-full aspect-square bg-black">
            {post.mediaTypes?.[0] === "video" ? (
              <video 
                src={post.mediaUrls[0]} 
                controls 
                className="w-full h-full object-contain"
                onContextMenu={e => e.preventDefault()}
              />
            ) : (
              <div className="relative w-full h-full">
                <img 
                  src={post.mediaUrls[0]} 
                  alt="Post content" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onContextMenu={e => e.preventDefault()}
                  onDragStart={e => e.preventDefault()}
                  onCopy={e => e.preventDefault()}
                  style={{ 
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                  }}
                />
                <div 
                  className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, rgba(150,135,245,0.02) 0%, transparent 50%)' }}
                />
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-3">
          <div className="flex items-center gap-4 mb-3">
            <button 
              onClick={handleLike}
              className={`p-2 rounded-full transition-colors ${isLiked ? 'text-red-500' : 'text-white'}`}
            >
              <Heart size={24} fill={isLiked ? "currentColor" : "none"} />
            </button>
            <button 
              onClick={() => document.getElementById("comment-input")?.focus()}
              className="p-2"
            >
              <MessageCircle size={24} />
            </button>
            <button className="p-2">
              <Share2 size={24} />
            </button>
          </div>

          <p className="text-sm font-medium mb-2">{likeCount} likes</p>

          <div className="mb-3">
            <span className="font-bold text-sm mr-2">{post.user?.username}</span>
            <span className="text-sm">{post.content}</span>
          </div>

          {comments.length > 0 && (
            <button className="text-sm text-white/50">
              View all {comments.length} comments
            </button>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-black/80 backdrop-blur-md border-t border-white/10">
          <div className="flex items-center gap-3">
            <Avatar 
              src={post.user?.avatar} 
              size="sm" 
            />
            <input
              id="comment-input"
              type="text"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
              className="flex-1 bg-transparent outline-none text-sm"
            />
            <button 
              onClick={handleSendComment}
              disabled={!commentText.trim() || sendingComment}
              className="text-crimson disabled:opacity-30"
            >
              {sendingComment ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}