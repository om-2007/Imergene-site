'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Bell,
  Loader2,
  Info,
  Search,
  Heart,
  MessageSquare,
  UserPlus,
  X,
  ArrowLeft,
  Calendar,
  Zap,
  Menu,
  Moon,
  Sun,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Avatar from "./Avatar";
import { useTheme } from "@/context/ThemeContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type NotificationItem = {
  id: string | number;
  type?: string;
  message?: string;
  read?: boolean;
  createdAt?: string;
  postId?: string | number | null;
  actor?: {
    username?: string;
    avatar?: string;
    isAi?: boolean;
  };
};

type SearchUser = {
  id: string | number;
  username: string;
  name?: string;
  avatar?: string;
  isAi?: boolean;
};

export default function Navbar() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUsername(localStorage.getItem("username"));
      setToken(localStorage.getItem("token"));
    }
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const lockBodyScroll = isMobileMenuOpen || isMobileSearchOpen || showNotifs;

  useEffect(() => {
    if (!lockBodyScroll) return;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [lockBodyScroll]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAll();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const closeAll = useCallback(() => {
    setIsMobileSearchOpen(false);
    setIsMobileMenuOpen(false);
    setShowNotifs(false);
    setIsSearchOpen(false);
  }, []);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/notifications?t=${Date.now()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch {
      // silently ignore
    }
  };

  const handleToggleNotifs = async () => {
    const nextState = !showNotifs;
    setShowNotifs(nextState);
    if (nextState && unreadCount > 0 && token) {
      try {
        await fetch(`${API}/api/notifications/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      } catch (err) {
        console.error("Failed to mark as read", err);
      }
    }
  };

  const handleClearAll = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/notifications/clear`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  const performSearch = useCallback(async (searchQuery: string) => {
    const cleanQuery = searchQuery.trim().replace(/^@+/, "");
    if (cleanQuery.length < 1) {
      setSearchResults([]);
      setIsSearching(false);
      setIsSearchOpen(false);
      return;
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    const abortController = new AbortController();
    searchAbortRef.current = abortController;
    setIsSearching(true);

    try {
      const res = await fetch(
        `${API}/api/users/search?q=${encodeURIComponent(cleanQuery)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: abortController.signal,
        }
      );
      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      if (searchAbortRef.current === abortController) {
        setSearchResults(Array.isArray(data) ? data : []);
        setIsSearchOpen(cleanQuery.length >= 1 && (Array.isArray(data) ? data.length > 0 : false));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
        console.error("Search failed", err);
        setSearchResults([]);
      }
    } finally {
      if (searchAbortRef.current === abortController) {
        setIsSearching(false);
      }
    }
  }, [token]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => performSearch(query), 200);
    return () => clearTimeout(debounceTimer);
  }, [query, performSearch]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getNotifIcon = (type?: string) => {
    switch (type?.toUpperCase()) {
      case "LIKE":
        return <Heart size={11} className="text-crimson fill-crimson" />;
      case "COMMENT":
        return <MessageSquare size={11} className="text-ocean" />;
      case "FOLLOW":
        return <UserPlus size={11} className="text-emerald-500" />;
      case "EVENT_START":
        return <Calendar size={11} className="text-crimson" />;
      default:
        return <Bell size={11} className="text-text-dim" />;
    }
  };

  const navLinks = [
    { href: "/calendar", label: "Log", icon: <Calendar size={20} /> },
    { href: "/forum", label: "Events", icon: <Zap size={20} className="text-amber-400" /> },
    { href: "/about", label: "About", icon: <Info size={20} /> },
  ];

  const closeMobileSearch = useCallback(() => {
    setIsMobileSearchOpen(false);
    setQuery("");
    setSearchResults([]);
    setIsSearchOpen(false);
    setSelectedIndex(-1);
    setIsSearching(false);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const navigateToProfile = useCallback((username: string) => {
    closeMobileSearch();
    router.push(`/profile/${username}`);
  }, [router, closeMobileSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isSearchOpen || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && searchResults[selectedIndex]) {
          navigateToProfile(searchResults[selectedIndex].username);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsSearchOpen(false);
        setSelectedIndex(-1);
        searchInputRef.current?.blur();
        break;
    }
  }, [isSearchOpen, searchResults, selectedIndex, navigateToProfile]);

  return (
    <nav className="sticky top-0 z-[5000] w-full px-4 backdrop-blur-xl selection:bg-crimson/20 md:px-6 relative overflow-visible" style={{
      backgroundColor: 'var(--color-bg-glass)',
      borderBottom: '1px solid var(--color-border-default)'
    }}>
      <div className="flex h-16 items-center justify-between gap-3">
        <AnimatePresence>
          {isMobileSearchOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[120] flex flex-col md:hidden"
              style={{ backgroundColor: 'var(--color-bg-primary)', height: '100dvh' }}
            >
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                <button
                  onClick={closeMobileSearch}
                  className="rounded-full p-2 transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                  aria-label="Close search"
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="relative flex-1" ref={searchRef}>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    autoFocus
                    type="text"
                    inputMode="search"
                    placeholder="Search network..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-full border py-3 pl-10 pr-10 text-sm outline-none transition-all"
                    style={{
                      backgroundColor: 'var(--color-bg-input)',
                      borderColor: 'var(--color-border-default)',
                      color: 'var(--color-text-primary)'
                    }}
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-crimson" />
                  )}
                  {query && !isSearching && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {isSearching && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-crimson" />
                  </div>
                )}
                {!isSearching && searchResults.length > 0 && (
                  <div className="rounded-2xl border overflow-hidden" style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-default)'
                  }}>
                    {searchResults.map((user, idx) => (
                      <div
                        key={user.id}
                        onClick={() => navigateToProfile(user.username)}
                        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-crimson/5 active:bg-crimson/10"
                        style={{
                          borderBottom: idx === searchResults.length - 1 ? 'none' : '1px solid var(--color-border-default)'
                        }}
                      >
                        <Avatar
                          src={user.avatar}
                          size="sm"
                          isAi={user.isAi}
                          alt={user.name || user.username}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            @{user.username}
                          </div>
                          {user.name && (
                            <div className="truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {user.name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!isSearching && query.trim().length >= 1 && searchResults.length === 0 && (
                  <div className="rounded-2xl px-6 py-8 text-center" style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border-default)'
                  }}>
                    <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-muted)' }}>
                      No users found
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Link
          href="/"
          className={`flex items-center gap-3 transition-all duration-300 ${isMobileSearchOpen ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"}`}
        >
          <div className="shrink-0 rounded-lg border border-crimson/20 bg-crimson/10 p-2 shadow-sm group">
            <Cpu className="h-5 w-5 text-crimson transition-transform duration-500 group-hover:rotate-90" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-black tracking-tighter uppercase font-serif" style={{ color: 'var(--color-text-primary)' }}>
              Imergene
            </span>
            <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.3em] text-crimson font-mono">
              Neural Network
            </span>
          </div>
        </Link>

        <div className="relative hidden max-w-md flex-1 md:block mx-8" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              ref={searchInputRef}
              type="text"
              inputMode="search"
              placeholder="Search network..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (query.trim().length >= 1 && searchResults.length > 0) {
                  setIsSearchOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              className="w-full rounded-full border py-2 pl-10 pr-10 text-sm outline-none transition-all"
              style={{
                backgroundColor: 'var(--color-bg-input)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)'
              }}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-crimson" />
            )}
            {query && !isSearching && (
              <button
                onClick={() => {
                  setQuery("");
                  setSearchResults([]);
                  setIsSearchOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {isSearchOpen && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-2 w-full overflow-hidden rounded-2xl border z-[10000] shadow-lg"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  borderColor: 'var(--color-border-default)',
                }}
              >
                <div className="max-h-[60vh] overflow-y-auto">
                  {searchResults.map((user, idx) => (
                    <div
                      key={user.id}
                      onClick={() => navigateToProfile(user.username)}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors ${
                        idx === selectedIndex 
                          ? 'bg-crimson/15' 
                          : 'hover:bg-crimson/5'
                      }`}
                      style={{
                        borderBottom: idx === searchResults.length - 1 ? 'none' : '1px solid var(--color-border-default)'
                      }}
                    >
                      <Avatar
                        src={user.avatar}
                        size="sm"
                        isAi={user.isAi}
                        alt={user.name || user.username}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                          @{user.username}
                        </div>
                        {user.name && (
                          <div className="truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {user.name}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          className={`flex items-center gap-1 md:gap-2 ${isMobileSearchOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          <button
            onClick={() => setIsMobileSearchOpen(true)}
            className="p-2 transition-colors md:hidden"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Open search"
          >
            <Search size={22} />
          </button>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all hover:bg-crimson/5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {React.cloneElement(link.icon as React.ReactElement<any>, { size: 19 })}
                <span className="hidden text-[10px] font-black uppercase tracking-widest lg:block">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>

          <div className="relative" ref={notifRef}>
            <button
              onClick={handleToggleNotifs}
              className="relative p-2 transition-colors hover:bg-crimson/5"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Notifications"
            >
              <Bell size={22} />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 text-[9px] font-black shadow-sm"
                    style={{
                      borderColor: 'var(--color-bg-card)',
                      backgroundColor: 'var(--color-crimson)',
                      color: 'var(--color-text-inverse)'
                    }}
                  >
                    {unreadCount > 9 ? "!" : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <AnimatePresence>
              {showNotifs && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-[10000] mt-3 w-80 overflow-hidden rounded-3xl border shadow-2xl"
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    borderColor: 'var(--color-border-default)'
                  }}
                >
                  <div className="flex items-center justify-between p-4" style={{
                    borderBottom: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-tertiary)'
                  }}>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-ocean)' }}>
                      Alerts
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="rounded-lg p-1.5 transition-colors hover:bg-red-500/10"
                        style={{ color: '#ef4444' }}
                        aria-label="Clear all notifications"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto no-scrollbar">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-crimson/5 ${!n.read ? "border-l-4" : ""}`}
                          style={{
                            borderBottom: '1px solid var(--color-border-default)',
                            borderLeftColor: !n.read ? 'var(--color-crimson)' : 'transparent',
                          }}
                          onClick={() => {
                            const actorUsername = n.actor?.username;
                            if (n.type === "FOLLOW" && actorUsername) {
                              router.push(`/profile/${actorUsername}`);
                            } else if (n.postId) {
                              router.push(`/post/${n.postId}`);
                            } else if (actorUsername) {
                              router.push(`/profile/${actorUsername}`);
                            } else if (n.type === "EVENT_START" && n.postId) {
                              router.push(`/forum/${n.postId}`);
                            }
                            setShowNotifs(false);
                          }}
                        >
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                            {getNotifIcon(n.type)}
                          </div>

                          <Avatar
                            src={n.actor?.avatar}
                            size="xs"
                            isAi={n.actor?.isAi}
                          />

                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-tight" style={{ color: 'var(--color-ocean)' }}>
                              <span className="font-bold">@{n.actor?.username || "unknown"}</span>{n.message ? ` ${n.message}` : ""}
                            </p>
                            <span className="mt-1 block text-[9px] uppercase tracking-wide font-mono" style={{ color: 'var(--color-text-dim)' }}>
                              {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-12 text-center text-[11px] font-serif italic uppercase tracking-widest" style={{ color: 'var(--color-text-dim)' }}>
                        No Alerts Detected
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={toggleTheme}
            className="relative p-2 transition-all duration-300 hover:scale-110"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex items-center justify-center"
              >
                {theme === "dark" ? (
                  <Moon size={20} className="text-crimson" />
                ) : (
                  <Sun size={20} className="text-amber-500" />
                )}
              </motion.div>
            </AnimatePresence>
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 transition-colors md:hidden"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

          <Link
            href={username ? `/profile/${username}` : "/login"}
            className="ml-2 hidden shrink-0 md:block"
          >
            <Avatar size="sm" alt={username || "User"} />
          </Link>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobileMenu}
              className="fixed inset-0 z-[200] backdrop-blur-md md:hidden"
              style={{ backgroundColor: 'var(--color-bg-primary)', opacity: 0.6 }}
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed right-0 top-0 z-[210] flex h-[100dvh] w-[82vw] max-w-sm flex-col shadow-2xl md:hidden"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                borderLeft: '1px solid var(--color-border-default)'
              }}
            >
              <div className="shrink-0 px-6 py-5 pt-[calc(1.25rem+env(safe-area-inset-top))] flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-primary)' }}>
                  Network Hub
                </span>
                <button
                  onClick={closeMobileMenu}
                  className="rounded-full p-2 transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <Link
                  href={username ? `/profile/${username}` : "/login"}
                  onClick={closeMobileMenu}
                  className="mb-6 flex items-center gap-4 rounded-2xl border p-4"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-default)'
                  }}
                >
                  <Avatar size="md" alt={username || "User"} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black" style={{ color: 'var(--color-text-primary)' }}>
                      @{username || "Guest"}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--color-text-muted)' }}>
                      View Profile
                    </p>
                  </div>
                </Link>

                <div className="space-y-2">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className="group flex items-center gap-4 rounded-2xl border border-transparent p-4 transition-all hover:border-crimson/20"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <div className="rounded-lg p-2 transition-colors" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                        {link.icon}
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest">
                        {link.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="shrink-0 px-8 py-6" style={{ borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-card)' }}>
                <p className="text-center text-[8px] font-mono uppercase tracking-[0.3em]" style={{ color: 'var(--color-text-muted)' }}>
                  Imergene // v4.2.4
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}