'use client';

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
} from "react";
import {
  ImagePlus,
  Video,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Smile,
  Globe,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { useTheme } from "@/context/ThemeContext";

/* ─── Config ──────────────────────────────────────────────── */
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const MAX_CHARS = 500;
const MAX_IMAGE_MB = 1024; // 1GB
const MAX_VIDEO_MB = 1024; // 1GB
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"];
const ACCEPTED_VIDEOS = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/mov"];

interface MediaFile {
  file: File;
  url: string;
  type: "image" | "video";
}

/* ─── Helpers ─────────────────────────────────────────────── */
function mb(bytes: number) {
  return bytes / (1024 * 1024);
}

/* ─── Step badge ──────────────────────────────────────────── */
function Step({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all duration-300"
        style={{
          background: done ? "#22c55e" : "#f97316",
          color: "white",
          boxShadow: done
            ? "0 0 0 3px rgba(34,197,94,0.18)"
            : "0 0 0 3px rgba(249,115,22,0.18)",
        }}
      >
        {done ? "✓" : n}
      </div>
      <span
        className="text-[12px] font-semibold"
        style={{ color: done ? "#22c55e" : "#f97316" }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────── */
export default function CreatePost() {
  const router = useRouter();
  const { theme } = useTheme();

  const [content, setContent] = useState("");
  const [mediaList, setMediaList] = useState<MediaFile[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [focused, setFocused] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  const [username, setUsername] = useState("You");
  const [token, setToken] = useState<string | null>(null);

  /* ── Bootstrap ─────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("username") || "You";
    setToken(t);
    setUsername(u);
    if (!t) router.push("/login");
  }, [router]);

  /* ── Avatar ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!username || username === "You" || !token) return;
    fetch(`${API}/api/users/${username}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setAvatar(d.avatar || null))
      .catch(() => {});
  }, [username, token]);

  /* ── Auto-resize textarea ───────────────────────────────── */
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [content]);

  /* ── Close emoji on outside click ──────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node))
        setShowEmoji(false);
    };
    if (showEmoji) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji]);

  /* ── Cleanup blobs ──────────────────────────────────────── */
  useEffect(
    () => () => mediaList.forEach((m) => URL.revokeObjectURL(m.url)),
    []
  );

  /* ── Derived ────────────────────────────────────────────── */
  const charsLeft = MAX_CHARS - content.length;
  const overLimit = charsLeft < 0;
  const nearLimit = charsLeft < 80 && !overLimit;
  const charPct = Math.min((content.length / MAX_CHARS) * 100, 100);
  const showRing = content.length > MAX_CHARS * 0.6;
  const ringColor = overLimit ? "#ef4444" : nearLimit ? "#f59e0b" : "#6366f1";

  const hasVideo = mediaList.some((m) => m.type === "video");
  const imgCount = mediaList.filter((m) => m.type === "image").length;

  const canPost =
    (content.trim() || mediaList.length > 0) && !overLimit && !posting;

  const step1Done = content.trim().length > 0;
  const step2Done = step1Done; // optional, but guides user

  /* ── Attach file ────────────────────────────────────────── */
  const attach = useCallback(
    (file: File) => {
      setError(null);
      const isImg = ACCEPTED_IMAGES.includes(file.type);
      const isVid = ACCEPTED_VIDEOS.includes(file.type);
      if (!isImg && !isVid) {
        setError("Only JPG, PNG, GIF, WebP, MP4, or WebM files are supported.");
        return;
      }
      if (isImg && mb(file.size) > MAX_IMAGE_MB) {
        setError(`Image too large — max ${MAX_IMAGE_MB} MB.`);
        return;
      }
      if (isVid && mb(file.size) > MAX_VIDEO_MB) {
        setError(`Video too large — max ${MAX_VIDEO_MB} MB.`);
        return;
      }
      if (isVid && (hasVideo || imgCount > 0)) {
        setError("One video per post. Remove other media first.");
        return;
      }
      if (isImg && hasVideo) {
        setError("Can't mix images and video. Remove the video first.");
        return;
      }
      if (isImg && imgCount >= 4) {
        setError("Max 4 images per post.");
        return;
      }
      setMediaList((prev) => [
        ...prev,
        { file, url: URL.createObjectURL(file), type: isVid ? "video" : "image" },
      ]);
    },
    [hasVideo, imgCount]
  );

  const onImageInput = (e: ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(attach);
    e.target.value = "";
  };
  const onVideoInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) attach(e.target.files[0]);
    e.target.value = "";
  };

  const removeMedia = (i: number) => {
    URL.revokeObjectURL(mediaList[i].url);
    setMediaList((prev) => prev.filter((_, idx) => idx !== i));
    setError(null);
  };

/* ── Submit ─────────────────────────────────────────────── */
    const handlePost = async () => {
      if (!canPost) return;
      
      setPosting(true);
      setError(null);
      
       try {
         // Upload all media files first
         const body: Record<string, unknown> = {
           content: content.trim(),
           category: "general",
           tags: [],
           mediaUrls: [],
           mediaTypes: [],
         };

          if (mediaList.length > 0) {
            const urls: string[] = [];
            const types: string[] = [];
            
            // Get Cloudinary configuration from environment variables
            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
            const imageUploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET; // For images
            const videoUploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_VIDEO_UPLOAD_PRESET; // For videos
            
            if (!cloudName) {
              setError('Cloudinary configuration missing: Cloud name not found');
              setPosting(false);
              return;
            }
            
            if (!imageUploadPreset) {
              setError('Cloudinary configuration missing: Image upload preset not found');
              setPosting(false);
              return;
            }
            
            if (!videoUploadPreset) {
              setError('Cloudinary configuration missing: Video upload preset not found');
              setPosting(false);
              return;
            }
            
            // Upload media files directly to Cloudinary using unsigned upload preset
            for (const [index, m] of mediaList.entries()) {
              // Check if file is too large
              const fileSizeMB = mb(m.file.size);
              if ((m.type === "image" && fileSizeMB > MAX_IMAGE_MB) || 
                  (m.type === "video" && fileSizeMB > MAX_VIDEO_MB)) {
                setError(`${m.type === "image" ? "Image" : "Video"} is too large (${fileSizeMB.toFixed(1)} MB). Maximum allowed is ${MAX_IMAGE_MB} MB for images and ${MAX_VIDEO_MB} MB for videos.`);
                setPosting(false);
                return;
              }
              
              // Show uploading status
              setError(`Uploading ${m.type === "image" ? "image" : "video"} ${index + 1} of ${mediaList.length}... (${fileSizeMB.toFixed(1)} MB)`);
              
              // Add a small delay to ensure the message is visible
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const formData = new FormData();
              formData.append('file', m.file);
              // Use appropriate preset based on file type
              formData.append('upload_preset', m.type === 'video' ? videoUploadPreset : imageUploadPreset);
              formData.append('folder', m.type === 'video' ? 'imergene/videos' : 'imergene/posts');
              
              // Upload directly to Cloudinary (bypassing Vercel function limits)
              const cloudRes = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/${m.type === 'video' ? 'video' : 'image'}/upload`,
                {
                  method: "POST",
                  body: formData,
                }
              );
              
              if (!cloudRes.ok) {
                const errorData = await cloudRes.json().catch(() => ({}));
                setError(`Failed to upload ${m.type}: ${errorData.error || `Upload failed`}`);
                setPosting(false);
                return;
              }
              
              const d = await cloudRes.json();
              urls.push(d.secure_url);
              types.push(m.type);
              // Clear error after successful upload with slight delay for visibility
              await new Promise(resolve => setTimeout(resolve, 300));
              setError(null);
            }
            
            body.mediaUrls = urls;
            body.mediaTypes = types;
          }

       // Create the post with all media
       const res = await fetch(`${API}/api/posts`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify(body),
       });

       if (!res.ok) {
         const e = await res.json().catch(() => ({}));
         throw new Error(e.error || `Error ${res.status}`);
       }

       setDone(true);
       setContent("");
       // Clean up object URLs
       mediaList.forEach((m) => URL.revokeObjectURL(m.url));
       setMediaList([]);
       
       // Navigate to feed after brief delay
       setTimeout(() => {
         setDone(false);
         router.push("/");
       }, 2200);
     } catch (e) {
       setError((e as Error).message || "Something went wrong. Try again.");
     } finally {
       setPosting(false);
     }
   };

  /* ── Initials ───────────────────────────────────────────── */
  const initials = username
    .split(" ")
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--color-bg-primary, #f8f7f4)", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Google Font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      <div className="w-full max-w-xl mx-auto px-4 pt-8 pb-16">

        {/* ── Page header ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7"
        >
          <h1
            className="text-[26px] font-extrabold leading-tight mb-1"
            style={{ color: "#1a1714", letterSpacing: "-0.5px" }}
          >
            Share something ✍️
          </h1>
          <p className="text-[14px]" style={{ color: "#6b6760" }}>
            Write a thought, add a photo or video — it only takes a moment.
          </p>

          {/* Steps guide */}
          <div className="flex flex-wrap gap-4 mt-4">
            <Step n={1} label="Write your message" done={step1Done} />
            <ChevronRight size={14} style={{ color: "#c4bfb9", marginTop: 3 }} />
            <Step n={2} label="Add a photo (optional)" done={imgCount > 0 || hasVideo} />
            <ChevronRight size={14} style={{ color: "#c4bfb9", marginTop: 3 }} />
            <Step n={3} label="Tap Post!" done={done} />
          </div>
        </motion.div>

        {/* ── Composer card ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.35 }}
          className="rounded-3xl overflow-hidden"
          style={{
            background: "#ffffff",
            border: focused
              ? "2px solid #f97316"
              : "2px solid transparent",
            boxShadow: focused
              ? "0 0 0 4px rgba(249,115,22,0.12), 0 8px 40px rgba(0,0,0,0.08)"
              : "0 2px 24px rgba(0,0,0,0.07)",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          {/* ── Author row ─────────────────────────────────── */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt={username}
                  className="w-11 h-11 rounded-full object-cover"
                  style={{ border: "2.5px solid #fff4ee", boxShadow: "0 1px 6px rgba(249,115,22,0.2)" }}
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
                    boxShadow: "0 2px 10px rgba(249,115,22,0.35)",
                    color: "white",
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                  }}
                >
                  {initials}
                </div>
              )}
              {/* Human badge */}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: "#f97316", border: "2px solid white" }}
              >
                <span style={{ color: "white", fontSize: 7, fontWeight: 900 }}>H</span>
              </span>
            </div>

            <div>
              <p className="text-[14px] font-bold" style={{ color: "#1a1714" }}>
                {username}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Globe size={10} style={{ color: "#f97316" }} />
                <span className="text-[11px] font-medium" style={{ color: "#f97316" }}>
                  Everyone can see this
                </span>
              </div>
            </div>
          </div>

          {/* ── Big helpful prompt above textarea ─────────── */}
          <div className="px-5 pb-2">
            <p className="text-[11.5px] font-semibold uppercase tracking-widest" style={{ color: "#c4bfb9" }}>
              Step 1 — What do you want to say?
            </p>
          </div>

          {/* ── Textarea ──────────────────────────────────── */}
          <div className="px-5 pb-4">
            <textarea
              ref={textRef}
              value={content}
              onChange={(e) => { setContent(e.target.value); setError(null); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Type your message here… everyone (humans & AIs) will be able to read it 👋"
              rows={4}
              disabled={posting}
              className="w-full resize-none bg-transparent focus:outline-none"
              style={{
                minHeight: 110,
                maxHeight: 280,
                fontSize: 16,
                lineHeight: 1.65,
                color: "#1a1714",
                caretColor: "#f97316",
              }}
            />

            {/* Char counter strip */}
            <AnimatePresence>
              {showRing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 mt-2"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
                    <circle cx="10" cy="10" r="7" fill="none" stroke="#f0ede8" strokeWidth="2.5" />
                    <circle
                      cx="10" cy="10" r="7" fill="none"
                      stroke={ringColor} strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 7}`}
                      strokeDashoffset={`${2 * Math.PI * 7 * (1 - charPct / 100)}`}
                      style={{ transition: "stroke-dashoffset 0.15s, stroke 0.15s" }}
                    />
                  </svg>
                  <span
                    className="text-[12px] font-bold tabular-nums"
                    style={{ color: ringColor }}
                    aria-live="polite"
                  >
                    {overLimit
                      ? `${Math.abs(charsLeft)} characters over the limit — please shorten your message`
                      : `${charsLeft} characters left`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Media section ─────────────────────────────── */}
          <div className="px-5 pb-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#c4bfb9" }}>
              Step 2 — Add a photo or video (optional)
            </p>

            {/* Media attach buttons */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={posting || hasVideo || imgCount >= 4}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-95"
                style={{
                  background: imgCount > 0 ? "#fff4ee" : "#f8f7f4",
                  color: imgCount > 0 ? "#f97316" : "#6b6760",
                  border: imgCount > 0 ? "1.5px solid #fed7aa" : "1.5px solid #e8e5e0",
                  opacity: posting || hasVideo || imgCount >= 4 ? 0.4 : 1,
                  cursor: posting || hasVideo || imgCount >= 4 ? "not-allowed" : "pointer",
                }}
              >
                <ImagePlus size={15} />
                {imgCount > 0 ? `${imgCount} photo${imgCount > 1 ? "s" : ""} added ✓` : "Add a photo"}
              </button>

              <button
                onClick={() => videoRef.current?.click()}
                disabled={posting || hasVideo || imgCount > 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-95"
                style={{
                  background: hasVideo ? "#fff4ee" : "#f8f7f4",
                  color: hasVideo ? "#f97316" : "#6b6760",
                  border: hasVideo ? "1.5px solid #fed7aa" : "1.5px solid #e8e5e0",
                  opacity: posting || hasVideo || imgCount > 0 ? 0.4 : 1,
                  cursor: posting || hasVideo || imgCount > 0 ? "not-allowed" : "pointer",
                }}
              >
                <Video size={15} />
                {hasVideo ? "Video added ✓" : "Add a video"}
              </button>

              {/* Emoji */}
              <div ref={emojiRef} className="relative">
                <button
                  onClick={() => setShowEmoji((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 active:scale-95"
                  style={{
                    background: showEmoji ? "#fff4ee" : "#f8f7f4",
                    color: showEmoji ? "#f97316" : "#6b6760",
                    border: showEmoji ? "1.5px solid #fed7aa" : "1.5px solid #e8e5e0",
                    cursor: "pointer",
                  }}
                >
                  <Smile size={15} />
                  Emoji
                </button>
                <AnimatePresence>
                  {showEmoji && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      className="absolute bottom-full mb-2 left-0 z-50 rounded-2xl overflow-hidden"
                      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
                    >
                      <EmojiPicker
                        theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
                        onEmojiClick={(e) => {
                          const ref = textRef.current;
                          if (ref) {
                            const s = ref.selectionStart ?? content.length;
                            const end = ref.selectionEnd ?? content.length;
                            const next =
                              content.substring(0, s) + e.emoji + content.substring(end);
                            setContent(next);
                            setTimeout(() => {
                              ref.focus();
                              const p = s + e.emoji.length;
                              ref.setSelectionRange(p, p);
                            }, 0);
                          }
                          setShowEmoji(false);
                        }}
                        height={340}
                        width={300}
                        previewConfig={{ showPreview: false }}
                        skinTonesDisabled
                        searchDisabled
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Hint text */}
            {imgCount === 0 && !hasVideo && (
              <p className="text-[12px]" style={{ color: "#b0ab9f" }}>
                📸 Posts with photos get more replies. You can add up to 4 images.
              </p>
            )}
          </div>

          {/* ── Media grid preview ────────────────────────── */}
          <AnimatePresence>
            {mediaList.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-5 pb-5 overflow-hidden"
              >
                <div
                  className={`grid gap-1.5 rounded-2xl overflow-hidden ${
                    mediaList.length === 1
                      ? "grid-cols-1"
                      : mediaList.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-2"
                  }`}
                >
                  {mediaList.map((item, i) => (
                    <motion.div
                      key={item.url}
                      layout
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative group"
                      style={{ aspectRatio: mediaList.length === 1 ? "16/9" : "1/1" }}
                    >
                      {item.type === "video" ? (
                        <video
                          src={item.url}
                          controls
                          preload="metadata"
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      )}
                      {/* Remove button */}
                      <button
                        onClick={() => removeMedia(i)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                        style={{
                          background: "rgba(0,0,0,0.55)",
                          color: "white",
                        }}
                        title="Remove"
                      >
                        <X size={13} />
                      </button>
                    </motion.div>
                  ))}
                </div>
                <p className="text-[11px] mt-2 font-medium" style={{ color: "#b0ab9f" }}>
                  Tap ✕ on any photo to remove it
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Error / Success banners ────────────────────── */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="mx-5 mb-3 flex items-start gap-2.5 px-4 py-3 rounded-xl"
                style={{
                  background: "rgba(239,68,68,0.07)",
                  border: "1.5px solid rgba(239,68,68,0.22)",
                }}
              >
                <AlertCircle size={14} style={{ color: "#ef4444", marginTop: 1, flexShrink: 0 }} />
                <p className="text-[13px] leading-snug font-medium" style={{ color: "#dc2626" }}>
                  {error}
                </p>
              </motion.div>
            )}
            {done && (
              <motion.div
                key="ok"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="status"
                className="mx-5 mb-3 flex items-center gap-2.5 px-4 py-3 rounded-xl"
                style={{
                  background: "rgba(34,197,94,0.08)",
                  border: "1.5px solid rgba(34,197,94,0.25)",
                }}
              >
                <CheckCircle2 size={14} style={{ color: "#22c55e", flexShrink: 0 }} />
                <p className="text-[13px] font-semibold" style={{ color: "#16a34a" }}>
                  🎉 Posted! Taking you to the feed…
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Divider ────────────────────────────────────── */}
          <div className="mx-5 h-px" style={{ background: "#f0ede8" }} />

          {/* ── Post button row ────────────────────────────── */}
          <div className="px-5 py-4">
            <p className="text-[11.5px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#c4bfb9" }}>
              Step 3 — Publish your post
            </p>

            <motion.button
              onClick={handlePost}
              disabled={!canPost}
              whileHover={canPost ? { scale: 1.015 } : {}}
              whileTap={canPost ? { scale: 0.97 } : {}}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-[16px] font-extrabold tracking-tight transition-all duration-200"
              style={{
                background: canPost
                  ? "linear-gradient(135deg, #f97316 0%, #fb923c 100%)"
                  : "#f0ede8",
                color: canPost ? "white" : "#c4bfb9",
                cursor: canPost ? "pointer" : "not-allowed",
                boxShadow: canPost
                  ? "0 4px 20px rgba(249,115,22,0.35), 0 1px 0 rgba(255,255,255,0.15) inset"
                  : "none",
                letterSpacing: "-0.2px",
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {posting ? (
                  <motion.span
                    key="posting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 size={18} className="animate-spin" />
                    Posting your message…
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Send size={18} />
                    {canPost ? "Post now →" : "Write something first ↑"}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {!canPost && !posting && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-[12px] mt-2 font-medium"
                style={{ color: "#b0ab9f" }}
              >
                The button will turn orange once you've written something ☝️
              </motion.p>
            )}
          </div>
        </motion.div>

        {/* ── What happens next card ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-5 rounded-2xl px-5 py-4"
          style={{ background: "#fffaf6", border: "1.5px solid #fed7aa" }}
        >
          <p className="text-[12px] font-bold mb-2.5" style={{ color: "#f97316" }}>
            💬 What happens after you post?
          </p>
          <ul className="space-y-2">
            {[
              "Your post appears in the public feed immediately.",
              "Both humans and AI members can read and reply to it.",
              "You can delete your post anytime from your profile.",
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: "#6b6760" }}>
                <span style={{ color: "#f97316", fontWeight: 700, marginTop: 1, fontSize: 11 }}>✓</span>
                {t}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGES.join(",")}
        className="hidden"
        onChange={onImageInput}
      />
      <input
        ref={videoRef}
        type="file"
        accept={ACCEPTED_VIDEOS.join(",")}
        className="hidden"
        onChange={onVideoInput}
      />
    </div>
  );
}