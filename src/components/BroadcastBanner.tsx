'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Sparkles, Users } from 'lucide-react';
import { User, AppNotification } from '@/types';
import { getActiveNotifications } from '@/lib/store';
import { subscribe } from '@/lib/realtime';

interface BroadcastBannerProps {
  user: User;
  status?: string;
  workedMs?: number;
  breakMs?: number;
  brbMs?: number;
  teamStatus?: any[];
  className?: string;
}

interface DailyQuote {
  quote: string;
  author: string;
}

// 31 Curated world-class executive quotes (1 per calendar day)
const DAILY_QUOTES: DailyQuote[] = [
  { quote: "Waste no more time arguing about what a good person should be. Be one.", author: "Marcus Aurelius" },
  { quote: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { quote: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { quote: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
  { quote: "Amateurs sit and wait for inspiration; the rest of us just get up and go to work.", author: "Stephen King" },
  { quote: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { quote: "I fear not the man who has practiced 10,000 kicks once, but the man who has practiced one kick 10,000 times.", author: "Bruce Lee" },
  { quote: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "Victory belongs to the most persevering.", author: "Napoleon Bonaparte" },
  { quote: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { quote: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { quote: "Discipline equals freedom.", author: "Jocko Willink" },
  { quote: "Continuous effort — not strength or intelligence — is the key to unlocking our potential.", author: "Winston Churchill" },
  { quote: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
  { quote: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { quote: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Well done is better than well said.", author: "Benjamin Franklin" },
  { quote: "Quality is not an act, it is a habit.", author: "Will Durant" },
  { quote: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { quote: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { quote: "Do not wait; the time will never be 'just right.' Start where you stand.", author: "Napoleon Hill" },
  { quote: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { quote: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { quote: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupéry" },
  { quote: "The mind is everything. What you think you become.", author: "Buddha" },
  { quote: "If you are going through hell, keep going.", author: "Winston Churchill" },
  { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
];

function getDailyQuote(): DailyQuote {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

export default function BroadcastBanner({
  user,
  teamStatus = [],
  className = '',
}: BroadcastBannerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'quote' | 'team'>('quote');
  const [isPaused, setIsPaused] = useState(false);
  const prevCountRef = useRef(0);
  const [hasNewArrival, setHasNewArrival] = useState(false);

  // 1 Curated Daily Quote (deterministic for today)
  const todayQuote = useMemo(() => getDailyQuote(), []);

  // Fetch admin broadcast notifications
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
    const unsub = subscribe('notifications', '*', () => void loadNotifications());
    const interval = setInterval(() => void loadNotifications(), 15000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadNotifications]);

  const hasBroadcast = notifications.length > 0;

  // Compile clean Team Status Changes
  const teamStatusText = useMemo(() => {
    if (!teamStatus || !Array.isArray(teamStatus) || teamStatus.length === 0) {
      return 'All teammates active on the floor';
    }

    // Filter by client if available
    const relevant = teamStatus.filter(t => !user?.clientName || t.user?.clientName === user?.clientName);
    const onBreak = relevant.filter(t => t.status === 'on_break');
    const onBrb = relevant.filter(t => t.status === 'on_brb');
    const working = relevant.filter(t => t.status === 'working');

    const parts: string[] = [];
    if (onBreak.length > 0) {
      const names = onBreak.map(t => t.user?.name || 'Teammate').join(', ');
      parts.push(`☕ Break: ${names}`);
    }
    if (onBrb.length > 0) {
      const names = onBrb.map(t => t.user?.name || 'Teammate').join(', ');
      parts.push(`⏱ BRB: ${names}`);
    }

    if (parts.length > 0) {
      return `${parts.join('   •   ')}   •   🟢 ${working.length} active at desks`;
    }

    const clientPrefix = user?.clientName ? `${user.clientName} ` : '';
    return `🟢 All ${relevant.length > 0 ? relevant.length + ' ' : ''}${clientPrefix}teammates are active on the floor`;
  }, [teamStatus, user?.clientName]);

  // Alternate smoothly between the Quote and Team Status every 8 seconds
  useEffect(() => {
    if (hasBroadcast || isPaused) return;
    const timer = setInterval(() => {
      setActiveTab(prev => (prev === 'quote' ? 'team' : 'quote'));
    }, 8000);
    return () => clearInterval(timer);
  }, [hasBroadcast, isPaused]);

  // Broadcast Marquee Items (clean, NO timestamps)
  const broadcastMessages = useMemo(() => {
    return notifications.map(n => n.message.trim()).filter(Boolean);
  }, [notifications]);

  const loopCount = broadcastMessages.length === 1 ? 4 : 2;
  const tickerItems = useMemo(() => {
    if (!hasBroadcast) return [];
    return Array.from({ length: loopCount * 2 }, (_, i) => broadcastMessages[i % broadcastMessages.length]);
  }, [broadcastMessages, loopCount, hasBroadcast]);

  const totalLength = broadcastMessages.reduce((sum, msg) => sum + msg.length, 0);
  const animationDuration = Math.max(26, Math.min(65, Math.round(totalLength * 0.45) + broadcastMessages.length * 8));

  return (
    <aside
      aria-label="Daily Quote & Team Status Strip"
      className={`w-full px-3 pt-2 pb-1.5 flex-shrink-0 relative z-40 select-none ${className}`}
    >
      <style>{`
        @keyframes broadcast-scroll {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes laser-sweep {
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

      {/* Clean Glassmorphic Chassis (No Clutter) */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={`relative overflow-hidden rounded-2xl border transition-all duration-500 backdrop-blur-2xl ${
          hasNewArrival
            ? 'border-amber-400 bg-gradient-to-r from-amber-500/25 via-purple-600/25 to-amber-500/25 shadow-[0_0_35px_rgba(245,158,11,0.5)]'
            : hasBroadcast
            ? 'border-amber-500/40 bg-gradient-to-r from-[#170f03]/95 via-[#110826]/95 to-[#170f03]/95 shadow-[0_12px_36px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(245,158,11,0.3)]'
            : 'border-white/10 bg-gradient-to-r from-[#0c081c]/95 via-[#080614]/95 to-[#0c081c]/95 shadow-[0_12px_36px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)]'
        }`}
      >
        {/* Subtle Top Accent Laser */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
          style={{
            background: hasBroadcast
              ? 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.9) 30%, rgba(168, 85, 247, 0.9) 70%, transparent 100%)'
              : activeTab === 'quote'
              ? 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.7) 40%, rgba(255, 255, 255, 0.6) 50%, rgba(245, 158, 11, 0.7) 60%, transparent 100%)'
              : 'linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.7) 40%, rgba(0, 245, 160, 0.7) 60%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'laser-sweep 7s ease infinite',
          }}
        />

        <div className="flex items-center h-10 px-3.5 gap-3 overflow-hidden">
          {/* ═════════ LEFT BADGE ═════════ */}
          <div className="flex items-center gap-2 shrink-0 z-10 py-1 pr-3 border-r border-white/10">
            {hasBroadcast ? (
              <div className="flex items-center gap-1.5">
                <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.3)]">
                  <Megaphone size={13} className="animate-pulse" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] font-black uppercase tracking-widest text-amber-300">
                  Broadcast
                </span>
              </div>
            ) : activeTab === 'quote' ? (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                  <Sparkles size={13} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-[9px] font-black uppercase tracking-widest text-amber-300">
                  Daily Directive
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                  <Users size={13} />
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/35 text-[9px] font-black uppercase tracking-widest text-sky-300">
                  Team Status
                </span>
              </div>
            )}
          </div>

          {/* ═════════ CENTER CONTENT (ELEGANT & SPACIOUS) ═════════ */}
          {hasBroadcast ? (
            /* Admin Broadcast Ticker */
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
                    <span className="text-amber-400 text-[10px] select-none">✦</span>
                    <span className="text-xs sm:text-[13px] font-semibold text-slate-100 tracking-wide hover:text-white transition-colors">
                      {msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Clean Alternation: The Best Quote OR Team Status */
            <div className="flex-1 overflow-hidden flex items-center justify-center px-4">
              <AnimatePresence mode="wait">
                {activeTab === 'quote' ? (
                  <motion.div
                    key="quote-card"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="flex items-center justify-center gap-2 truncate text-center max-w-full"
                  >
                    <span className="text-amber-400 text-sm font-serif select-none">“</span>
                    <span className="text-xs sm:text-[13px] font-medium text-slate-100 tracking-wide truncate">
                      {todayQuote.quote}
                    </span>
                    <span className="text-amber-400 text-sm font-serif select-none">”</span>
                    <span className="text-[11px] font-semibold text-amber-300/90 pl-1 shrink-0 font-mono">
                      — {todayQuote.author}
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="team-card"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="flex items-center justify-center gap-2 truncate text-center max-w-full"
                  >
                    <span className="text-xs sm:text-[13px] font-medium text-slate-100 tracking-wide truncate">
                      {teamStatusText}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ═════════ RIGHT BADGE: MINIMALIST LIVE SIGNAL ═════════ */}
          <div className="flex items-center gap-2 shrink-0 z-10 pl-3 border-l border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab(prev => (prev === 'quote' ? 'team' : 'quote'))}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[9px] font-black uppercase tracking-wider text-slate-300 transition-colors cursor-pointer"
              title="Click to toggle between Daily Quote & Team Status"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
