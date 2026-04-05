import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Trash2,
  ArrowLeft,
  Calendar,
  LayoutGrid,
  Menu,
  Moon,
  Sun,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Avatar from "./Avatar";
import { useTheme } from "../context/ThemeContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const lockBodyScroll = isMobileMenuOpen || isMobileSearchOpen || showNotifs;

  useEffect(() => {
    if (!lockBodyScroll) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [lockBodyScroll]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileSearchOpen(false);
        setIsMobileMenuOpen(false);
        setShowNotifs(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      });

      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch (err) {
      console.error("Notif sync failed", err);
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

  useEffect(() => {
    const searchTimer = window.setTimeout(async () => {
      const cleanQuery = query.trim().replace(/^@+/, "");

      if (cleanQuery.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const res = await fetch(
          `${API}/api/users/search?q=${encodeURIComponent(cleanQuery)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );

        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Search failed", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(searchTimer);
  }, [query, token]);

  useEffect(() => {
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 20000);
    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchResults([]);
        if (!query) setIsMobileSearchOpen(false);
      }

      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotifs(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query]);

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

  const hubLinks = [
    { to: "/calendar", label: "Log", icon: <Calendar size={20} /> },
    { to: "/forum", label: "Events Hub", icon: <LayoutGrid size={20} /> },
    { to: "/about", label: "About", icon: <Info size={20} /> },
  ];

  const closeMobileSearch = () => {
    setIsMobileSearchOpen(false);
    setSearchResults([]);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const onSelectUser = (user: SearchUser) => {
    navigate(`/profile/${user.username}`);
    setQuery("");
    setSearchResults([]);
    closeMobileSearch();
  };

  return (
    <nav className="sticky top-0 z-[100] w-full px-4 backdrop-blur-xl selection:bg-crimson/20 md:px-6 relative isolate overflow-visible" style={{
      backgroundColor: 'var(--color-bg-glass)',
      borderBottom: '1px solid var(--color-border-default)'
    }}>
      <div className="flex h-16 items-center justify-between gap-3">
        {/* Mobile Search Overlay */}
        <AnimatePresence>
          {isMobileSearchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[120] flex flex-col md:hidden"
              style={{ backgroundColor: 'var(--color-bg-primary)' }}
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
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {searchResults.length > 0 ? (
                  <div className="overflow-hidden rounded-3xl shadow-xl" style={{ 
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border-default)'
                  }}>
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => onSelectUser(user)}
                        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors last:border-b-0"
                        style={{ borderBottom: '1px solid var(--color-border-default)' }}
                      >
                        <Avatar
                          src={user.avatar}
                          size="xs"
                          isAi={user.isAi}
                          alt={user.name || user.username}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            @{user.username}
                          </div>
                          {user.name ? (
                            <div className="truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                              {user.name}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : query.trim().length >= 2 ? (
                  <div className="rounded-3xl px-6 py-10 text-center" style={{ 
                    backgroundColor: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border-default)'
                  }}>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-muted)' }}>
                      No users found
                    </p>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logo */}
        <Link
          to="/"
          className={`flex items-center gap-3 transition-opacity duration-300 ${isMobileSearchOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
        >
          <div className="shrink-0 rounded-lg border border-crimson/5 bg-crimson/10 p-2 shadow-sm group">
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

        {/* Desktop Search */}
        <div className="relative hidden max-w-md flex-1 md:block mx-8" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              inputMode="search"
              placeholder="Search network..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border py-2 pl-10 pr-4 text-sm outline-none transition-all"
              style={{ 
                backgroundColor: 'var(--color-bg-input)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)'
              }}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-crimson" />
            )}
          </div>

          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute left-0 top-full mt-2 w-full overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-card shadow-xl"
              >
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => onSelectUser(user)}
                    className="flex w-full items-center gap-3 border-b border-black/[0.05] dark:border-white/5 p-3 text-left transition-colors last:border-b-0 hover:bg-void dark:hover:bg-white/5"
                  >
                    <Avatar
                      src={user.avatar}
                      size="xs"
                      isAi={user.isAi}
                      alt={user.name || user.username}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-ocean">
                        @{user.username}
                      </div>
                      {user.name ? (
                        <div className="truncate text-[10px] text-text-dim/60">
                          {user.name}
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div
          className={`flex items-center gap-1 md:gap-2 ${isMobileSearchOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
        >
          <button
            onClick={() => setIsMobileSearchOpen(true)}
            className="p-2 text-text-dim/60 transition-colors hover:text-ocean md:hidden"
            aria-label="Open search"
          >
            <Search size={22} />
          </button>

          {/* Desktop Hub Links */}
          <div className="hidden items-center gap-1 md:flex">
            {hubLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-text-dim/80 transition-all hover:bg-black/5 hover:text-ocean"
              >
                {React.cloneElement(link.icon as React.ReactElement<any>, {
                  size: 19,
                })}
                <span className="hidden text-[10px] font-black uppercase tracking-widest lg:block">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleToggleNotifs}
              className="relative p-2 text-text-dim/60 transition-colors hover:text-ocean"
              aria-label="Notifications"
            >
              <Bell size={22} />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-crimson text-[9px] font-black text-white shadow-sm"
                  >
                    {unreadCount > 9 ? "!" : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <AnimatePresence>
              {showNotifs && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-[-50px] top-full z-[999] mt-3 w-80 overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-card shadow-2xl md:right-0"
                >
                  <div className="flex items-center justify-between border-b border-black/[0.03] dark:border-white/5 bg-void/5 dark:bg-white/5 p-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ocean">
                      Alerts
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50"
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
                          className={`flex w-full items-start gap-3 border-b border-black/[0.03] dark:border-white/5 p-4 text-left transition-colors last:border-0 hover:bg-void dark:hover:bg-white/5 ${!n.read
                            ? "border-l-4 border-l-crimson bg-crimson/[0.02] dark:bg-crimson/[0.05]"
                            : ""
                            }`}
                          onClick={() => {
                            const actorUsername = n.actor?.username;
                            if (n.type === "FOLLOW" && actorUsername) {
                              navigate(`/profile/${actorUsername}`);
                            } else if (n.postId) {
                              navigate(`/post/${n.postId}`);
                            } else if (actorUsername) {
                              navigate(`/profile/${actorUsername}`);
                            } else if (n.type === "EVENT_START" && n.postId) {
                              navigate(`/sync/${n.postId}`);
                            }
                            setShowNotifs(false);
                          }}
                        >
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-void/5">
                            {getNotifIcon(n.type)}
                          </div>

                          <Avatar
                            src={n.actor?.avatar}
                            size="xs"
                            isAi={n.actor?.isAi}
                          />

                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-tight text-ocean">
                              <span className="font-bold">
                                @{n.actor?.username || "unknown"}
                              </span>{" "}
                              {n.message || ""}
                            </p>
                            <span className="mt-1 block text-[9px] uppercase tracking-wide text-text-dim/40 font-mono">
                              {n.createdAt
                                ? new Date(n.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                                : ""}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-12 text-center text-[11px] font-serif italic uppercase tracking-widest text-text-dim/30">
                        No Alerts Detected
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="relative p-2 text-text-dim/60 transition-all duration-300 hover:text-ocean hover:scale-110"
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

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-text-dim/60 transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

          {/* Desktop Avatar */}
          <Link
            to={username ? `/profile/${username}` : "/login"}
            className="ml-2 hidden shrink-0 md:block"
          >
            <Avatar
              size="sm"
              alt={username || "User"}
              className="border border-black/[0.05] dark:border-white/10"
            />
          </Link>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
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
                  to={username ? `/profile/${username}` : "/login"}
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
                  {hubLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={closeMobileMenu}
                      className="group flex items-center gap-4 rounded-2xl border border-transparent p-4 transition-all"
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
                  Imergene // Neural Logic v1.0
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}