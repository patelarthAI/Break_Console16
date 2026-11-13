'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Radio, Sparkles, Volume2 } from 'lucide-react';
import { User, AppNotification } from '@/types';
import { getActiveNotifications } from '@/lib/store';
import { subscribe } from '@/lib/realtime';

interface BroadcastBannerProps {
  user: User;
  className?: string;
}

export default function BroadcastBanner({ user, className = '' }: BroadcastBannerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const prevCountRef = useRef(0);
  const [hasNewArrival, setHasNewArrival] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const active = await getActiveNotifications(user.id);
      setNotifications(prev => {
        if (active.length > prevCountRef.current && prevCountRef.current > 0) {
          setHasNewArrival(true);
          setTimeout(() => setHasNewArrival(false), 4000);
        }
        prevCountRef.current = active.length;
        return active;
      });
    } catch (e) {
      console.warn('[BroadcastBanner] Failed to fetch broadcasts:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadNotifications();

    // Instant real-time updates from Supabase
    const unsub = subscribe('notifications', '*', () => {
      void loadNotifications();
    });

    // 15s fallback poll
    const interval = setInterval(() => {
      void loadNotifications();
    }, 15000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadNotifications]);

  if (loading || notifications.length === 0) {
    return null;
  }

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? timeStr : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
    } catch {
      return '';
    }
  };

  // Build repeated items for an uninterrupted, seamless infinite marquee
  // Duplicate sufficiently so the scroll track always spans wider than standard monitors
  const baseItems = notifications;
  const loopCount = baseItems.length === 1 ? 4 : baseItems.length < 3 ? 3 : 2;
  const tickerItems = Array.from({ length: loopCount * 2 }, (_, i) => baseItems[i % baseItems.length]);

  // Adjust scroll speed dynamically based on total text length (comfortable reading pace ~30-50s)
  const totalLength = baseItems.reduce((acc, curr) => acc + (curr.message?.length || 0), 0);
  const animationDuration = Math.max(26, Math.min(65, Math.round(totalLength * 0.45) + (baseItems.length * 10)));

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="Official Broadcast Ticker"
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className={`w-full px-3 pt-2 pb-1.5 flex-shrink-0 relative z-40 select-none ${className}`}
      >
        {/* Dynamic Keyframes for Ultra-Smooth Infinite Marquee */}
        <style>{`
          @keyframes infinite-marquee {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
          @keyframes radar-pulse {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.15); opacity: 0.3; }
            100% { transform: scale(0.95); opacity: 0.8; }
          }
          @keyframes ambient-border {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .marquee-track {
            display: flex;
            width: max-content;
            animation: infinite-marquee ${animationDuration}s linear infinite;
            will-change: transform;
          }
          .marquee-track.is-paused {
            animation-play-state: paused !important;
          }
        `}</style>

        {/* Chassis Container with 2026 Cyber Glassmorphic styling */}
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className={`relative overflow-hidden rounded-2xl border transition-all duration-500 backdrop-blur-2xl ${
            hasNewArrival
              ? 'border-amber-400 bg-gradient-to-r from-amber-500/25 via-purple-600/25 to-amber-500/25 shadow-[0_0_35px_rgba(245,158,11,0.5)]'
              : 'border-amber-500/30 bg-gradient-to-r from-[#140e04]/95 via-[#0e0821]/95 to-[#140e04]/95 shadow-[0_12px_36px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(245,158,11,0.25)]'
          }`}
        >
          {/* Top Edge Neon Laser Highlight */}
          <div
            className="absolute top-0 left-0 right-0 h-[1.5px] pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.9) 30%, rgba(168, 85, 247, 0.9) 70%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'ambient-border 6s ease infinite',
            }}
          />

          <div className="flex items-center h-10 px-3 gap-3 overflow-hidden">
            {/* ── LEFT ANCHOR: Fixed Command / Dispatch Badge ── */}
            <div className="flex items-center gap-2 shrink-0 z-10 py-1 pr-2 border-r border-amber-500/20">
              <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500/30 to-purple-600/30 border border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.35)]">
                <Megaphone size={13} className="text-amber-300 animate-pulse" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] font-black uppercase tracking-widest text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Broadcast
                </span>
              </div>
            </div>

            {/* ── CENTER: Smooth Infinite Marquee Chamber with Edge Fades ── */}
            <div
              className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
              style={{
                maskImage: 'linear-gradient(90deg, transparent 0%, black 24px, black calc(100% - 24px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 24px, black calc(100% - 24px), transparent 100%)',
              }}
              title="Hover to pause ticker"
            >
              <div className={`marquee-track ${isPaused ? 'is-paused' : ''}`}>
                {tickerItems.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="inline-flex items-center gap-3 px-6 shrink-0"
                  >
                    {/* Glowing Separator Symbol */}
                    <span className="text-amber-400/80 text-[10px] drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] select-none">
                      ✦
                    </span>

                    {/* Announcement Message */}
                    <span className="text-xs sm:text-[13px] font-semibold text-slate-100 tracking-wide hover:text-amber-200 transition-colors">
                      {item.message}
                    </span>

                    {/* Timestamp Pill */}
                    {item.createdAt && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-white/[0.06] border border-white/10 text-[10px] font-mono font-medium text-slate-400">
                        {formatTime(item.createdAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT ANCHOR: Live Signal Indicator & Pause Notice ── */}
            <div className="flex items-center gap-2 shrink-0 z-10 pl-2 border-l border-amber-500/20">
              {notifications.length > 1 && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-[9px] font-mono font-bold text-purple-300">
                  {notifications.length} Bulletins
                </span>
              )}

              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider text-emerald-400"
                title={isPaused ? 'Ticker paused on hover' : 'Continuous Live Dispatch'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
                <span>{isPaused ? 'PAUSED' : 'LIVE'}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
