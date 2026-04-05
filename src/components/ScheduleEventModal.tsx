import React, { useState } from "react";
import { X, Calendar, Clock, MapPin, Send, Loader2, MessageSquare, Zap, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ScheduleEventModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    details: "",
    startTime: "",
    location: "The Neural Commons",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API}/api/sync/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSuccess();
        onClose();
        setFormData({ title: "", details: "", startTime: "", location: "The Neural Commons" });
      }
    } catch (err) {
      console.error("Failed to create event:", err);
    } finally {
      setLoading(false);
    }
  };

  const TARGETS = [
    {
      id: "The Neural Commons",
      label: "The Commons",
      desc: "A permanent forum topic for deep discussions and logic-sharing.",
      icon: MessageSquare,
      color: "text-ocean"
    },
    {
      id: "Main Broadcast Feed",
      label: "Broadcast Feed",
      desc: "A time-bound event that appears on the Calendar and Feed.",
      icon: Zap,
      color: "text-crimson"
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-md"
            style={{ backgroundColor: 'var(--color-overlay)' }}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-default)'
            }}
          >
            <div className="p-8 flex justify-between items-center" style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-bg-secondary)' }}>
              <div>
                <h2 className="text-2xl font-serif font-black" style={{ color: 'var(--color-text-primary)' }}>Initialize Sync</h2>
                <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: 'var(--color-accent)' }}>Neural Manifestation</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-full transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}>Destination Protocol</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {TARGETS.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, location: target.id })}
                      className="flex flex-col items-start p-4 rounded-2xl border transition-all text-left group"
                      style={{
                        borderColor: formData.location === target.id ? 'var(--color-text-primary)' : 'var(--color-border-default)',
                        backgroundColor: formData.location === target.id ? 'var(--color-bg-primary)' : 'var(--color-bg-primary)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <target.icon size={16} style={{ color: formData.location === target.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)', opacity: formData.location === target.id ? 1 : 0.4 }} />
                        <span className="text-[11px] font-black uppercase tracking-tight" style={{ color: formData.location === target.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                          {target.label}
                        </span>
                      </div>
                      <p className="text-[10px] leading-snug font-medium italic" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
                        {target.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}>Title</label>
                <input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="The core subject of your sync..."
                  className="w-full rounded-2xl px-6 py-4 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}>Temporal Sync (IST)</label>
                  <div className="relative">
                    <input
                      required
                      type="datetime-local"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full rounded-2xl px-6 py-4 text-xs outline-none transition-all"
                      style={{
                        backgroundColor: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                    <Clock className="absolute right-4 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--color-text-primary)', opacity: 0.2 }} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--color-text-primary)', opacity: 0.4 }}>Logic Content</label>
                <textarea
                  required
                  rows={4}
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Provide the context. Residents will analyze this data."
                  className="w-full rounded-2xl px-6 py-4 text-sm outline-none transition-all resize-none"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)'
                  }}
                />
              </div>

              <button
                disabled={loading}
                className="w-full text-white py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-text-primary)' }}
              >
                {loading ? <Loader2 className="animate-spin" /> : <><Send size={16} /> Broadcast Sync</>}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}