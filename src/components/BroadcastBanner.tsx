'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Zap, Coffee, RotateCcw, Sparkles, Flame, Shield, Radio } from 'lucide-react';
import { User, AppNotification } from '@/types';
import { getActiveNotifications } from '@/lib/store';
import { subscribe } from '@/lib/realtime';

interface BroadcastBannerProps {
  user: User;
  status?: string;
  workedMs?: number;
  breakMs?: number;
  className?: string;
}

interface StatusTheme {
  badge: string;
  sub: string;
  accent: string;
  glow: string;
  bgGradient: string;
  borderClass: string;
  Icon: React.ElementType;
  quotes: string[];
}

const STATUS_THEMES: Record<string, StatusTheme> = {
  working: {
    badge: 'FOCUS PROTOCOL',
    sub: 'DEEP WORK',
    accent: '#00F5A0',
    glow: 'rgba(0, 245, 160, 0.35)',
    bgGradient: 'from-[#03150d]/95 via-[#061e14]/90 to-[#03150d]/95',
    borderClass: 'border-emerald-500/30',
    Icon: Zap,
    quotes: [
      'Pipeline is power — every conversation builds tomorrow’s placements.',
      'Precision sourcing outpaces mindless volume every single time.',
      'Presence is power. When you’re at the desk, opportunities find you.',
      'High conviction, relentless execution. The next great hire is one outreach away.',
      'Focus compounds. Small, high-conviction sprints yield outsized results.',
      'Energy follows intention. Keep the rhythm sharp and the standard elite.',
      'Speed to outreach wins the candidate. Stay proactive and dialed in.',
    ],
  },
  on_break: {
    badge: 'RECHARGE CYCLE',
    sub: 'REST MODE',
    accent: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.35)',
    bgGradient: 'from-[#171004]/95 via-[#231705]/90 to-[#171004]/95',
    borderClass: 'border-amber-500/30',
    Icon: Coffee,
    quotes: [
      'Step back, hydrate, and reset your baseline — true recovery sharpens your edge.',
      'Cognitive rest is tactical. A refreshed recruiter closes with clarity.',
      'Disconnect from the screen. Let your energy rebuild for the next sprint.',
      'Pace your stamina. Elite performance is built on deliberate recovery.',
      'Enjoy your downtime. Return when your battery is back at 100%.',
    ],
  },
  on_brb: {
    badge: 'QUICK STEP-AWAY',
    sub: 'DESK RESERVED',
    accent: '#A78BFA',
    glow: 'rgba(167, 139, 250, 0.35)',
    bgGradient: 'from-[#110924]/95 via-[#1a0e36]/90 to-[#110924]/95',
    borderClass: 'border-purple-500/30',
    Icon: RotateCcw,
    quotes: [
      'Quick step-away registered. Take care of business and return dialed in.',
      'Short pause active. Your desk and pipeline are held for your return.',
      'Keep it snappy — the floor is moving and placements are in motion.',
      'Stepping away for a moment. Desk reserved for your return.',
    ],
  },
  punched_out: {
    badge: 'SHIFT CONCLUDED',
    sub: 'OFFLINE',
    accent: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.35)',
    bgGradient: 'from-[#05131f]/95 via-[#091b2c]/90 to-[#05131f]/95',
    borderClass: 'border-sky-500/30',
    Icon: Flame,
    quotes: [
      'Shift complete. Disconnect completely, rest well, and return energized tomorrow.',
      'Great hustle today. Punch in whenever you’re ready to ignite your next shift.',
      'Consistency is the hallmark of top billers. Rest up and reset.',
    ],
  },
  idle: {
    badge: 'CONSOLE STANDBY',
    sub: 'READY',
    accent: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.35)',
    bgGradient: 'from-[#05131f]/95 via-[#091b2c]/90 to-[#05131f]/95',
    borderClass: 'border-sky-500/30',
    Icon: Shield,
    quotes: [
      'Console active. Punch in to begin today’s high-impact recruiting sprint.',
      'Brigade Pulse standing by. Set your focus and make today count.',
    ],
  },
};

export default function BroadcastBanner({
  user,
  status = 'working',
  workedMs,
  breakMs,
  className = '',
}: BroadcastBannerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const prevCountRef = useRef(0);
  const [hasNewArrival, setHasNewArrival] = useState(false);

  // Active theme based on status or admin role
  const normalizedStatus = (status in STATUS_THEMES ? status : 'working') as keyof typeof STATUS_THEMES;
  const currentTheme = STATUS_THEMES[normalizedStatus];

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
    }
  }, [user?.id]);

  useEffect(() => {
    void loadNotifications();

    const unsub = subscribe('notifications', '*', () => {
      void loadNotifications();
    });

    const interval = setInterval(() => {
      void loadNotifications();
    }, 15000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadNotifications]);

  const hasBroadcast = notifications.length > 0;

  // Build the array of messages to scroll
  const rawMessages = useMemo(() => {
    if (hasBroadcast) {
      // Clean messages only — NO timestamps
      return notifications.map(n => n.message.trim()).filter(Boolean);
    }
    // Dynamic status quotes when no broadcast is present
    return currentTheme.quotes;
  }, [hasBroadcast, notifications, currentTheme.quotes]);

  // Build duplicated items for a continuous, seamless loop
  const loopCount = rawMessages.length === 1 ? 4 : rawMessages.length < 3 ? 3 : 2;
  const tickerItems = useMemo(() => {
    return Array.from({ length: loopCount * 2 }, (_, i) => rawMessages[i % rawMessages.length]);
  }, [rawMessages, loopCount]);

  // Dynamic animation duration based on total length for comfortable reading
  const totalLength = rawMessages.reduce((sum, msg) => sum + msg.length, 0);
  const animationDuration = Math.max(28, Math.min(70, Math.round(totalLength * 0.42) + rawMessages.length * 8));

  // Determine appearance styles
  const isAlertMode = hasBroadcast;
  const accentColor = isAlertMode ? '#F59E0B' : currentTheme.accent;
  const BadgeIcon = isAlertMode ? Megaphone : currentTheme.Icon;
  const badgeLabel = isAlertMode ? 'BROADCAST' : currentTheme.badge;

  return (
    <aside
      aria-label="Intelligence Ticker"
      className={`w-full px-3 pt-2 pb-1.5 flex-shrink-0 relative z-40 select-none ${className}`}
    >
      {/* Dynamic Keyframes */}
      <style>{`
        @keyframes ticker-slide {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes laser-sweep {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ticker-strip {
          display: flex;
          width: max-content;
          animation: ticker-slide ${animationDuration}s linear infinite;
          will-change: transform;
        }
        .ticker-strip.paused {
          animation-play-state: paused !important;
        }
      `}</style>

      {/* Cyber Glassmorphic Chassis */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={`relative overflow-hidden rounded-2xl border transition-all duration-500 backdrop-blur-2xl ${
          hasNewArrival
            ? 'border-amber-400 bg-gradient-to-r from-amber-500/25 via-purple-600/25 to-amber-500/25 shadow-[0_0_35px_rgba(245,158,11,0.5)]'
            : isAlertMode
            ? 'border-amber-500/30 bg-gradient-to-r from-[#140e04]/95 via-[#0e0821]/95 to-[#140e04]/95 shadow-[0_12px_36px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(245,158,11,0.25)]'
            : `${currentTheme.borderClass} bg-gradient-to-r ${currentTheme.bgGradient} shadow-[0_12px_36px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]`
        }`}
      >
        {/* Top Edge Neon Laser Highlight */}
        <div
          className="absolute top-0 left-0 right-0 h-[1.5px] pointer-events-none"
          style={{
            background: isAlertMode
              ? 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.9) 30%, rgba(168, 85, 247, 0.9) 70%, transparent 100%)'
              : `linear-gradient(90deg, transparent 0%, ${accentColor}dd 40%, rgba(255,255,255,0.4) 50%, ${accentColor}dd 60%, transparent 100%)`,
            backgroundSize: '200% 100%',
            animation: 'laser-sweep 7s ease infinite',
          }}
        />

        <div className="flex items-center h-10 px-3 gap-3 overflow-hidden">
          {/* ── LEFT ANCHOR: Status / Broadcast Badge ── */}
          <div
            className="flex items-center gap-2 shrink-0 z-10 py-1 pr-3"
            style={{ borderRight: `1px solid ${accentColor}33` }}
          >
            <div
              className="relative flex items-center justify-center w-7 h-7 rounded-xl border shrink-0 transition-colors duration-300"
              style={{
                background: `linear-gradient(135deg, ${accentColor}25, rgba(0,0,0,0.5))`,
                borderColor: `${accentColor}55`,
                boxShadow: `0 0 16px ${accentColor}40`,
                color: accentColor,
              }}
            >
              <BadgeIcon size={13} className={isAlertMode ? 'animate-pulse' : ''} />
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping"
                style={{ backgroundColor: accentColor }}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all duration-300"
                style={{
                  backgroundColor: `${accentColor}1a`,
                  borderColor: `${accentColor}44`,
                  color: accentColor,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: accentColor }}
                />
                {badgeLabel}
              </span>
            </div>
          </div>

          {/* ── CENTER: Smooth Marquee Chamber (No Timestamps) ── */}
          <div
            className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
            style={{
              maskImage: 'linear-gradient(90deg, transparent 0%, black 28px, black calc(100% - 28px), transparent 100%)',
              WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 28px, black calc(100% - 28px), transparent 100%)',
            }}
            title="Hover to pause scrolling"
          >
            <div className={`ticker-strip ${isPaused ? 'paused' : ''}`}>
              {tickerItems.map((msg, idx) => (
                <div
                  key={`${idx}-${msg.slice(0, 10)}`}
                  className="inline-flex items-center gap-3 px-8 shrink-0"
                >
                  {/* Glowing Separator Symbol */}
                  <span
                    className="text-[10px] select-none transition-colors"
                    style={{
                      color: accentColor,
                      textShadow: `0 0 8px ${accentColor}`,
                    }}
                  >
                    ✦
                  </span>

                  {/* Clean Message (No Timestamps) */}
                  <span
                    className="text-xs sm:text-[13px] font-semibold text-slate-100 tracking-wide hover:text-white transition-colors"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                  >
                    {msg}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT ANCHOR: State & Pause Indicator ── */}
          <div
            className="flex items-center gap-2 shrink-0 z-10 pl-3"
            style={{ borderLeft: `1px solid ${accentColor}33` }}
          >
            {isAlertMode && notifications.length > 1 && (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-[9px] font-mono font-bold text-purple-300">
                {notifications.length} Bulletins
              </span>
            )}

            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all duration-300"
              style={{
                backgroundColor: isPaused ? 'rgba(245, 158, 11, 0.15)' : `${accentColor}18`,
                borderColor: isPaused ? 'rgba(245, 158, 11, 0.4)' : `${accentColor}44`,
                color: isPaused ? '#F59E0B' : accentColor,
              }}
              title={isPaused ? 'Ticker paused on hover' : 'Continuous Live Pulse'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPaused ? 'bg-amber-400' : 'animate-ping'
                }`}
                style={{ backgroundColor: isPaused ? '#F59E0B' : accentColor }}
              />
              <span>{isPaused ? 'PAUSED' : isAlertMode ? 'DISPATCH' : 'LIVE'}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
