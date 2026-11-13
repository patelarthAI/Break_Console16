'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, X, ChevronLeft, ChevronRight, Bell, Sparkles } from 'lucide-react';
import { User, AppNotification } from '@/types';
import { getActiveNotifications, dismissNotification } from '@/lib/store';
import { subscribe } from '@/lib/realtime';

interface BroadcastBannerProps {
  user: User;
  className?: string;
}

export default function BroadcastBanner({ user, className = '' }: BroadcastBannerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const prevCountRef = useRef(0);
  const [hasNewArrival, setHasNewArrival] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const active = await getActiveNotifications(user.id);
      setNotifications(prev => {
        // Trigger subtle flash if a new broadcast arrived
        if (active.length > prevCountRef.current && prevCountRef.current > 0) {
          setHasNewArrival(true);
          setTimeout(() => setHasNewArrival(false), 3000);
        }
        prevCountRef.current = active.length;
        return active;
      });
      // Keep index within bounds
      setCurrentIndex(prev => (prev >= active.length ? Math.max(0, active.length - 1) : prev));
    } catch (e) {
      console.warn('[BroadcastBanner] Failed to fetch broadcasts:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadNotifications();

    // Subscribe to realtime changes on notifications table
    const unsub = subscribe('notifications', '*', () => {
      void loadNotifications();
    });

    // Also poll every 15s in case websocket is disconnected
    const interval = setInterval(() => {
      void loadNotifications();
    }, 15000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadNotifications]);

  const handleDismiss = async (id: string) => {
    setDismissingId(id);
    try {
      await dismissNotification(id, user.id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : 0));
    } catch (err) {
      console.error('[BroadcastBanner] Dismiss error:', err);
    } finally {
      setDismissingId(null);
    }
  };

  if (loading || notifications.length === 0) {
    return null;
  }

  const current = notifications[currentIndex] || notifications[0];
  if (!current) return null;

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? `Today at ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return '';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key={current.id}
        initial={{ opacity: 0, y: -12, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -12, height: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className={`w-full px-3 pt-2 pb-1.5 flex-shrink-0 relative z-40 select-none ${className}`}
      >
        <div
          className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
            hasNewArrival
              ? 'border-amber-400 bg-gradient-to-r from-amber-500/20 via-purple-600/20 to-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.4)]'
              : 'border-amber-500/30 bg-gradient-to-r from-[#171206]/95 via-[#130d24]/95 to-[#171206]/95 shadow-[0_12px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(245,158,11,0.2)]'
          }`}
          style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        >
          {/* Subtle top amber highlight beam */}
          <div
            className="absolute top-0 left-1/4 right-1/4 h-[1px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.7), transparent)',
            }}
          />

          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            {/* Left: Megaphone Badge */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/25 to-purple-600/25 border border-amber-500/40 text-amber-300 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                <Megaphone size={14} className="animate-pulse" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </div>

              <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] font-black uppercase tracking-widest text-amber-300 shrink-0">
                  <Sparkles size={9} /> Broadcast
                </span>

                <p className="text-xs sm:text-[13px] font-medium text-slate-100 tracking-wide line-clamp-2 leading-snug">
                  {current.message}
                </p>
              </div>
            </div>

            {/* Right: Timestamp + Pagination + Dismiss */}
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {current.createdAt && (
                <span className="hidden md:inline-block text-[10px] font-mono font-semibold text-slate-400">
                  {formatTime(current.createdAt)}
                </span>
              )}

              {/* If multiple broadcasts, allow paging */}
              {notifications.length > 1 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-black/40 border border-white/5 text-[10px] font-mono text-slate-300">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(i => (i > 0 ? i - 1 : notifications.length - 1))}
                    className="p-0.5 hover:text-white transition-colors cursor-pointer"
                    title="Previous broadcast"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <span className="px-1 text-[9px] font-bold">
                    {currentIndex + 1}/{notifications.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(i => (i < notifications.length - 1 ? i + 1 : 0))}
                    className="p-0.5 hover:text-white transition-colors cursor-pointer"
                    title="Next broadcast"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}

              {/* Dismiss button */}
              <button
                type="button"
                onClick={() => void handleDismiss(current.id)}
                disabled={dismissingId === current.id}
                title="Dismiss this broadcast"
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/[0.05] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-slate-300 hover:text-rose-200 transition-all text-[11px] font-semibold cursor-pointer disabled:opacity-50"
              >
                <X size={12} />
                <span className="hidden sm:inline text-[10px] uppercase tracking-wider font-bold">Dismiss</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
