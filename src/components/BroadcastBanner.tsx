'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Megaphone, Sparkles, Zap, Coffee, RotateCcw, Compass, Calendar } from 'lucide-react';
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

interface DailyQuote {
  quote: string;
  author: string;
}

// Curated world-class quotes for each day of the year
const DAILY_QUOTES: DailyQuote[] = [
  { quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { quote: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { quote: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { quote: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
  { quote: "Amateurs sit and wait for inspiration; the rest of us just get up and go to work.", author: "Stephen King" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { quote: "Waste no more time arguing about what a good person should be. Be one.", author: "Marcus Aurelius" },
  { quote: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { quote: "I fear not the man who has practiced 10,000 kicks once, but the man who has practiced one kick 10,000 times.", author: "Bruce Lee" },
  { quote: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { quote: "Victory belongs to the most persevering.", author: "Napoleon Bonaparte" },
  { quote: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { quote: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { quote: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { quote: "Quality is not an act, it is a habit.", author: "Will Durant" },
  { quote: "Well done is better than well said.", author: "Benjamin Franklin" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { quote: "Do not wait; the time will never be 'just right.' Start where you stand.", author: "Napoleon Hill" },
  { quote: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { quote: "Discipline equals freedom.", author: "Jocko Willink" },
  { quote: "Continuous effort — not strength or intelligence — is the key to unlocking our potential.", author: "Winston Churchill" },
  { quote: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
  { quote: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { quote: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { quote: "If you are going through hell, keep going.", author: "Winston Churchill" },
  { quote: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
  { quote: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { quote: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupéry" },
];

function getDailyQuote(): { quote: DailyQuote; dateLabel: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const quote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
  const dateLabel = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { quote, dateLabel };
}

const STATUS_CONFIGS: Record<string, { label: string; color: string; border: string; bg: string; Icon: React.ElementType }> = {
  working: {
    label: 'FOCUS MODE',
    color: '#00F5A0',
    border: 'border-emerald-500/30',
    bg: 'from-[#03150d]/95 via-[#061e14]/90 to-[#03150d]/95',
    Icon: Zap,
  },
  on_break: {
    label: 'ON BREAK',
    color: '#F59E0B',
    border: 'border-amber-500/30',
    bg: 'from-[#171004]/95 via-[#231705]/90 to-[#171004]/95',
    Icon: Coffee,
  },
  on_brb: {
    label: 'STEPPED AWAY',
    color: '#A78BFA',
    border: 'border-purple-500/30',
    bg: 'from-[#110924]/95 via-[#1a0e36]/90 to-[#110924]/95',
    Icon: RotateCcw,
  },
  punched_out: {
    label: 'STANDBY',
    color: '#38BDF8',
    border: 'border-sky-500/30',
    bg: 'from-[#05131f]/95 via-[#091b2c]/90 to-[#05131f]/95',
    Icon: Compass,
  },
  idle: {
    label: 'STANDBY',
    color: '#38BDF8',
    border: 'border-sky-500/30',
    bg: 'from-[#05131f]/95 via-[#091b2c]/90 to-[#05131f]/95',
    Icon: Compass,
  },
};

export default function BroadcastBanner({
  user,
  status = 'working',
  className = '',
}: BroadcastBannerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const prevCountRef = useRef(0);
  const [hasNewArrival, setHasNewArrival] = useState(false);

  // 1 New Curated Daily Quote (deterministic for today)
  const { quote: todayQuote, dateLabel } = useMemo(() => getDailyQuote(), []);

  // Status configuration
  const currentStatus = (status in STATUS_CONFIGS ? status : 'working') as keyof typeof STATUS_CONFIGS;
  const statusCfg = STATUS_CONFIGS[currentStatus];

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

  // Broadcast Marquee Items (clean messages only, NO timestamps)
  const broadcastMessages = useMemo(() => {
    return notifications.map(n => n.message.trim()).filter(Boolean);
  }, [notifications]);

  const loopCount = broadcastMessages.length === 1 ? 4 : broadcastMessages.length < 3 ? 3 : 2;
  const tickerItems = useMemo(() => {
    if (!hasBroadcast) return [];
    return Array.from({ length: loopCount * 2 }, (_, i) => broadcastMessages[i % broadcastMessages.length]);
  }, [broadcastMessages, loopCount, hasBroadcast]);

  const totalLength = broadcastMessages.reduce((sum, msg) => sum + msg.length, 0);
  const animationDuration = Math.max(26, Math.min(65, Math.round(totalLength * 0.45) + broadcastMessages.length * 8));

  const accentColor = hasBroadcast ? '#F59E0B' : statusCfg.color;

  return (
    <aside
      aria-label="Daily Directive & Broadcast Strip"
      className={`w-full px-3 pt-2 pb-1.5 flex-shrink-0 relative z-40 select-none ${className}`}
    >
      <style>{`
        @keyframes broadcast-scroll {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes laser-glow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .broadcast-track {
          display: flex;
          width: max-content;
          animation: broadcast-scroll ${animationDuration}s linear infinite;
          will-change: transform;
        }
        .broadcast-track.is-paused {
          animation-play-state: paused !important;
        }
      `}</style>

      {/* Cyber Chassis */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={`relative overflow-hidden rounded-2xl border transition-all duration-500 backdrop-blur-2xl ${
          hasNewArrival
            ? 'border-amber-400 bg-gradient-to-r from-amber-500/25 via-purple-600/25 to-amber-500/25 shadow-[0_0_35px_rgba(245,158,11,0.5)]'
            : hasBroadcast
            ? 'border-amber-500/30 bg-gradient-to-r from-[#140e04]/95 via-[#0e0821]/95 to-[#140e04]/95 shadow-[0_12px_36px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(245,158,11,0.25)]'
            : `${statusCfg.border} bg-gradient-to-r ${statusCfg.bg} shadow-[0_12px_36px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]`
        }`}
      >
        {/* Top Edge Neon Highlight */}
        <div
          className="absolute top-0 left-0 right-0 h-[1.5px] pointer-events-none"
          style={{
            background: hasBroadcast
              ? 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.9) 30%, rgba(168, 85, 247, 0.9) 70%, transparent 100%)'
              : `linear-gradient(90deg, transparent 0%, ${accentColor}cc 35%, rgba(255,255,255,0.5) 50%, ${accentColor}cc 65%, transparent 100%)`,
            backgroundSize: '200% 100%',
            animation: 'laser-glow 6s ease infinite',
          }}
        />

        <div className="flex items-center h-10 px-3.5 gap-3 overflow-hidden">
          {/* ── LEFT BADGE ── */}
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
              {hasBroadcast ? (
                <>
                  <Megaphone size={13} className="animate-pulse" />
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping"
                    style={{ backgroundColor: accentColor }}
                  />
                </>
              ) : (
                <Sparkles size={13} />
              )}
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
                {hasBroadcast ? 'BROADCAST' : 'DAILY DIRECTIVE'}
              </span>

              {!hasBroadcast && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/10 text-[9px] font-mono font-bold text-slate-400">
                  {dateLabel}
                </span>
              )}
            </div>
          </div>

          {/* ── CENTER: Admin Broadcast Marquee OR Daily Executive Quote ── */}
          {hasBroadcast ? (
            /* Broadcast Active: Smooth Scrolling Marquee (No Timestamps) */
            <div
              className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
              style={{
                maskImage: 'linear-gradient(90deg, transparent 0%, black 28px, black calc(100% - 28px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 28px, black calc(100% - 28px), transparent 100%)',
              }}
              title="Hover to pause ticker"
            >
              <div className={`broadcast-track ${isPaused ? 'is-paused' : ''}`}>
                {tickerItems.map((msg, idx) => (
                  <div
                    key={`${idx}-${msg.slice(0, 10)}`}
                    className="inline-flex items-center gap-3 px-8 shrink-0"
                  >
                    <span
                      className="text-[10px] select-none"
                      style={{ color: accentColor, textShadow: `0 0 8px ${accentColor}` }}
                    >
                      ✦
                    </span>
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
          ) : (
            /* Daily Directive Mode: 1 Curated Daily Quote (Clean & Executive) */
            <div className="flex-1 overflow-hidden flex items-center justify-center px-2">
              <div className="flex items-center gap-2 truncate">
                <span className="text-amber-400/80 text-sm font-serif select-none">“</span>
                <span className="text-xs sm:text-[13px] font-medium text-slate-200 tracking-wide truncate">
                  {todayQuote.quote}
                </span>
                <span className="text-amber-400/80 text-sm font-serif select-none">”</span>
                <span
                  className="text-[11px] font-semibold pl-1 shrink-0 font-mono"
                  style={{ color: `${accentColor}ee` }}
                >
                  — {todayQuote.author}
                </span>
              </div>
            </div>
          )}

          {/* ── RIGHT ANCHOR: Live Status Capsule ── */}
          <div
            className="flex items-center gap-2 shrink-0 z-10 pl-3"
            style={{ borderLeft: `1px solid ${accentColor}33` }}
          >
            {hasBroadcast && notifications.length > 1 && (
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-[9px] font-mono font-bold text-purple-300">
                {notifications.length} Bulletins
              </span>
            )}

            <div
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all duration-300"
              style={{
                backgroundColor: hasBroadcast
                  ? isPaused
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(245, 158, 11, 0.2)'
                  : `${statusCfg.color}18`,
                borderColor: hasBroadcast
                  ? 'rgba(245, 158, 11, 0.4)'
                  : `${statusCfg.color}44`,
                color: hasBroadcast ? '#F59E0B' : statusCfg.color,
              }}
              title={hasBroadcast ? (isPaused ? 'Ticker paused' : 'Active admin broadcast') : `Current state: ${statusCfg.label}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasBroadcast && !isPaused ? 'animate-ping' : status === 'working' ? 'animate-pulse' : ''
                }`}
                style={{ backgroundColor: hasBroadcast ? '#F59E0B' : statusCfg.color }}
              />
              <span>{hasBroadcast ? (isPaused ? 'PAUSED' : 'DISPATCH') : statusCfg.label}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
