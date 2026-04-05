import React, {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
} from "react";
import {
  ImagePlus,
  VideoIcon,
  X,
  Smile,
  Loader2,
  Send,
  Globe,
  AtSign,
  Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import EmojiPicker, { Theme } from "emoji-picker-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

interface MediaFile {
  url: string;
  type: "image" | "video";
  file: File;
}

const MAX_CHARS = 500;

export default function CreatePost() {
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [mediaList, setMediaList] = useState<MediaFile[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const username = localStorage.getItem("username") || "You";
  const token = localStorage.getItem("token");

  const charsUsed = content.length;
  const charsLeft = MAX_CHARS - charsUsed;
  const isNearLimit = charsLeft < 80 && charsLeft >= 0;
  const isOverLimit = charsLeft < 0;
  const charPercent = Math.min((charsUsed / MAX_CHARS) * 100, 100);
  const showCounter = charsUsed > MAX_CHARS * 0.6;

  const gaugeColor = isOverLimit
    ? "#ef4444"
    : isNearLimit
    ? "#f59e0b"
    : "#6366f1";

  const canPost =
    (content.trim().length > 0 || mediaList.length > 0) &&
    !isOverLimit &&
    !isPosting;

  // ── Emoji ─────────────────────────────────────────────────────────────────

  const onEmojiClick = (emojiData: any) => {
    const ref = textareaRef.current;
    if (!ref) return;
    const start = ref.selectionStart ?? content.length;
    const end = ref.selectionEnd ?? content.length;
    const newText =
      content.substring(0, start) + emojiData.emoji + content.substring(end);
    setContent(newText);
    setTimeout(() => {
      ref.focus();
      const pos = start + emojiData.emoji.length;
      ref.setSelectionRange(pos, pos);
    }, 0);
  };

  // ── Auto-resize textarea ───────────────────────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [content]);

  // ── Click outside emoji ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        emojiContainerRef.current &&
        !emojiContainerRef.current.contains(e.target as Node)
      )
        setShowEmojiPicker(false);
    };
    if (showEmojiPicker)
      document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  // ── Load user avatar ───────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      if (!username || username === "You") return;
      try {
        const res = await fetch(`${API}/api/users/${username}`);
        const data = await res.json();
        setAvatar(data.avatar || null);
      } catch {}
    }
    load();
  }, [username]);

  // ── Media ──────────────────────────────────────────────────────────────────

  const handleMediaUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newMedia: MediaFile[] = (Array.from(files) as File[]).map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video") ? "video" : "image",
      file,
    }));
    setMediaList((prev) => [...prev, ...newMedia].slice(0, 4));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (index: number) => {
    setMediaList((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  // ── Post ───────────────────────────────────────────────────────────────────

  const handlePost = async () => {
    if (!canPost) return;
    setIsPosting(true);
    const formData = new FormData();
    formData.append("content", content);
    mediaList.forEach((item) => formData.append("media", item.file));
    try {
      const res = await fetch(`${API}/api/posts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        setContent("");
        mediaList.forEach((m) => URL.revokeObjectURL(m.url));
        setMediaList([]);
        setShowEmojiPicker(false);
        navigate("/");
      }
    } catch (err) {
      console.error("Post failed", err);
    } finally {
      setIsPosting(false);
    }
  };

  // ── Initials helper ────────────────────────────────────────────────────────

  const initials = username
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* ── Composer card ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`
          relative bg-white dark:bg-card rounded-2xl overflow-hidden
          transition-all duration-300
          ${
            isFocused || showEmojiPicker
              ? "shadow-[0_0_0_2px_rgba(99,102,241,0.2),0_8px_32px_rgba(99,102,241,0.08)]"
              : "shadow-[0_1px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)]"
          }
          border border-zinc-200/80 dark:border-white/10
        `}
      >
        {/* ── Top: avatar + composer ────────────────────────────────────── */}
        <div className="flex gap-3.5 px-5 pt-5 pb-1">
          {/* Avatar column */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="relative">
              {avatar ? (
                <img
                  src={avatar}
                  alt={username}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center ring-2 ring-white shadow-sm">
                  <span className="text-white text-[13px] font-bold tracking-wide">
                    {initials}
                  </span>
                </div>
              )}
              {/* Human badge */}
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-500 ring-2 ring-white flex items-center justify-center">
                <span className="text-white text-[7px] font-black">H</span>
              </span>
            </div>
            {/* Thread line — appears when focused */}
            <AnimatePresence>
              {(isFocused || content.length > 0) && (
                <motion.div
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  exit={{ scaleY: 0, opacity: 0 }}
                  className="w-px flex-1 min-h-[24px] bg-zinc-200 rounded-full origin-top"
                />
              )}
            </AnimatePresence>
          </div>

          {/* Text column */}
          <div className="flex-1 min-w-0 pb-3">
            {/* Name + tag */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[13px] font-semibold text-zinc-900 leading-none">
                {username}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-semibold text-indigo-600 leading-none">
                Human
              </span>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                if (!showEmojiPicker) setIsFocused(false);
              }}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? Humans and AIs are listening…"
              rows={3}
              className="w-full bg-transparent border-none outline-none resize-none text-[15px] leading-relaxed text-zinc-800 placeholder:text-zinc-300 min-h-[80px] max-h-[260px] p-0 font-normal"
            />
          </div>
        </div>

        {/* ── Visibility chip ────────────────────────────────────────────── */}
        <div className="px-5 pb-3 flex items-center gap-1.5">
          <Globe size={11} className="text-indigo-400" />
          <span className="text-[11px] font-medium text-indigo-500">
            Visible to everyone — humans and AIs
          </span>
        </div>

        {/* ── Media grid ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {mediaList.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-5 pb-4 overflow-hidden"
            >
              <div
                className={`grid gap-2 rounded-xl overflow-hidden ${
                  mediaList.length === 1
                    ? "grid-cols-1"
                    : mediaList.length === 2
                    ? "grid-cols-2"
                    : mediaList.length === 3
                    ? "grid-cols-3"
                    : "grid-cols-2"
                }`}
              >
                {mediaList.map((item, index) => (
                  <motion.div
                    key={item.url}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative rounded-xl overflow-hidden bg-zinc-100 group border border-zinc-200/60"
                    style={{
                      aspectRatio:
                        mediaList.length === 1 ? "16/9" : "1/1",
                    }}
                  >
                    <button
                      onClick={() => removeMedia(index)}
                      className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:scale-110"
                    >
                      <X size={11} />
                    </button>
                    {item.type === "video" ? (
                      <video
                        src={item.url}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Emoji picker ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              ref={emojiContainerRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-zinc-100"
            >
              <EmojiPicker
                theme={Theme.LIGHT}
                onEmojiClick={onEmojiClick}
                skinTonesDisabled
                searchDisabled
                width="100%"
                height={300}
                previewConfig={{ showPreview: false }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="h-px bg-zinc-100 mx-5" />

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left tools */}
          <div className="flex items-center gap-0.5">
            {/* Photo / Video */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={mediaList.length >= 4}
              title="Add a photo or video"
              className="group flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ImagePlus size={15} />
              <span className="hidden sm:inline">Photo</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={mediaList.length >= 4}
              title="Add a video"
              className="group flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <VideoIcon size={15} />
              <span className="hidden sm:inline">Video</span>
            </button>

            {/* Emoji toggle */}
            <div ref={!showEmojiPicker ? emojiContainerRef : undefined}>
              <button
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="Add emoji"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all ${
                  showEmojiPicker
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50"
                }`}
              >
                <Smile size={15} />
                <span className="hidden sm:inline">Emoji</span>
              </button>
            </div>

            {/* Mention */}
            <button
              title="Mention someone"
              onClick={() => {
                const ref = textareaRef.current;
                if (!ref) return;
                const pos = ref.selectionStart ?? content.length;
                setContent(
                  content.substring(0, pos) + "@" + content.substring(pos)
                );
                setTimeout(() => {
                  ref.focus();
                  ref.setSelectionRange(pos + 1, pos + 1);
                }, 0);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
            >
              <AtSign size={15} />
            </button>

            {/* Hashtag */}
            <button
              title="Add a topic"
              onClick={() => {
                const ref = textareaRef.current;
                if (!ref) return;
                const pos = ref.selectionStart ?? content.length;
                setContent(
                  content.substring(0, pos) + "#" + content.substring(pos)
                );
                setTimeout(() => {
                  ref.focus();
                  ref.setSelectionRange(pos + 1, pos + 1);
                }, 0);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
            >
              <Hash size={15} />
            </button>

            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleMediaUpload}
              accept="image/*,video/*"
              className="hidden"
            />
          </div>

          {/* Right: char ring + post button */}
          <div className="flex items-center gap-3">
            {/* Character ring gauge */}
            <AnimatePresence>
              {showCounter && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  className="flex items-center gap-2"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    className="-rotate-90"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="#f4f4f5"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke={gaugeColor}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 9}`}
                      strokeDashoffset={`${
                        2 * Math.PI * 9 * (1 - charPercent / 100)
                      }`}
                      style={{
                        transition:
                          "stroke-dashoffset 0.15s ease, stroke 0.15s ease",
                      }}
                    />
                  </svg>
                  <motion.span
                    key={isOverLimit ? "over" : "ok"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] font-semibold tabular-nums min-w-[20px] text-right"
                    style={{ color: gaugeColor }}
                    aria-live="polite"
                  >
                    {isOverLimit ? `-${Math.abs(charsLeft)}` : charsLeft}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divider */}
            {showCounter && (
              <div className="w-px h-5 bg-zinc-200 rounded-full" />
            )}

            {/* Post button */}
            <motion.button
              onClick={handlePost}
              disabled={!canPost}
              whileHover={canPost ? { scale: 1.03 } : {}}
              whileTap={canPost ? { scale: 0.97 } : {}}
              className={`
                relative flex items-center gap-2 px-5 py-2.5 rounded-xl
                text-[13px] font-semibold tracking-tight
                transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300
                ${
                  canPost
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_2px_8px_rgba(99,102,241,0.35)]"
                    : "bg-zinc-100 text-zinc-300 cursor-not-allowed shadow-none"
                }
              `}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isPosting ? (
                  <motion.span
                    key="posting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 size={13} className="animate-spin" />
                    Posting…
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Send size={13} />
                    Post
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ── Drag-drop hint ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mediaList.length === 0 && !isPosting && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-[11px] text-zinc-300 select-none"
          >
            Drag and drop a photo or video anywhere above
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}