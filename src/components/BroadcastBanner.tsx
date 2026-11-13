'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone,
  Sparkles,
  Zap,
  Coffee,
  RotateCcw,
  Compass,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  Activity,
  Flame,
} from 'lucide-react';
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

// 31 Curated world-class executive directives (1 per calendar day)
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
    label: 'FOCUS PROTOCOL',
    color: '#00F5A0',
    border: 'border-emerald-500/35',
    bg: 'from-[#04160e]/95 via-[#071f15]/90 to-[#04160e]/95',
    Icon: Zap,
  },
  on_break: {
    label: 'RECHARGE CYCLE',
    color: '#F59E0B',
    border: 'border-amber-500/35',
    bg: 'from-[#191105]/95 via-[#231707]/90 to-[#191105]/95',
    Icon: Coffee,
  },
  on_brb: {
    label: 'STEPPED AWAY',
    color: '#A78BFA',
    border: 'border-purple-500/35',
    bg: 'from-[#130928]/95 via-[#1d0e3a]/90 to-[#130928]/95',
    Icon: RotateCcw,
  },
  punched_out: {
    label: 'SHIFT CONCLUDED',
    color: '#38BDF8',
    border: 'border-sky-500/35',
    bg: 'from-[#051423]/95 via-[#091b2e]/90 to-[#051423]/95',
    Icon: Compass,
  },
  idle: {
    label: 'CONSOLE READY',
    color: '#38BDF8',
    border: 'border-sky-500/35',
    bg: 'from-[#051423]/95 via-[#091b2e]/90 to-[#051423]/95',
    Icon: Compass,
  },
};

function formatDurationHhMm(ms: number): string {
  const totalMins = Math.floor(Math.max(0, ms) / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  return `${mins}m`;
}

export default function BroadcastBanner({
  user,
  status = 'working',
  workedMs = 0,
  breakMs = 0,
  brbMs = 0,
  teamStatus = [],
  className = '',
}: BroadcastBannerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const prevCountRef = useRef(0);
  const [hasNewArrival, setHasNewArrival] = useState(false);

  // Today's 1 Curated Daily Directive
  const { quote: todayQuote, dateLabel } = useMemo(() => getDailyQuote(), []);

  // Status configuration
  const currentStatus = (status in STATUS_CONFIGS ? status : 'working') as keyof typeof STATUS_CONFIGS;
  const statusCfg = STATUS_CONFIGS[currentStatus];

  // Real-time notifications
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

  // Compute Floor status from teamStatus prop
  const floorIntel = useMemo(() => {
    if (!teamStatus || !Array.isArray(teamStatus) || teamStatus.length === 0) {
      return 'Brigade Floor Synchronized • Active Deployment';
    }
    const onBreakTeammates = teamStatus.filter(
      t => (t.status === 'on_break' || t.status === 'on_brb') && t.user?.id !== user?.id
    );
    const activeTeammates = teamStatus.filter(
      t => t.status === 'working' && t.user?.id !== user?.id
    );

    if (onBreakTeammates.length > 0) {
      const names = onBreakTeammates.slice(0, 2).map(t => t.user?.name?.split(' ')[0] || 'Teammate').join(' & ');
      const extra = onBreakTeammates.length > 2 ? ` +${onBreakTeammates.length - 2}` : '';
      return `${names}${extra} currently on break • ${activeTeammates.length} consultants on floor`;
    }
    return `All ${teamStatus.length} consultants active on floor • Full Brigade deployed`;
  }, [teamStatus, user?.id]);

  // Compute Shift Telemetry
  const shiftTelemetry = useMemo(() => {
    const workedStr = formatDurationHhMm(workedMs);
    const breakStr = formatDurationHhMm(breakMs);
    const isExceeded = breakMs > 60 * 60 * 1000;
    if (isExceeded) {
      return `⚠️ Break limit exceeded (${breakStr} logged) • Please resume desk focus`;
    }
    return `Logged: ${workedStr} active shift • ${breakStr} breaks used • 100% compliant`;
  }, [workedMs, breakMs]);

  // Build Intelligence Carousel Slides
  const slides = useMemo(() => {
    return [
      {
        id: 'daily-directive',
        tag: `DIRECTIVE // ${dateLabel}`,
        icon: Sparkles,
        tagColor: '#F59E0B',
        content: `“${todayQuote.quote}”`,
        subtext: `— ${todayQuote.author}`,
      },
      {
        id: 'shift-telemetry',
        tag: 'SHIFT TELEMETRY',
        icon: Activity,
        tagColor: statusCfg.color,
        content: shiftTelemetry,
        subtext: status === 'working' ? 'High Focus' : 'Desk Paused',
      },
      {
        id: 'floor-radar',
        tag: 'FLOOR RADAR',
        icon: Users,
        tagColor: '#38BDF8',
        content: floorIntel,
        subtext: 'Live Sync',
      },
      {
        id: 'execution-mindset',
        tag: 'HIGH CONVICTION',
        icon: Flame,
        tagColor: '#A78BFA',
        content: '“Pipeline is momentum. Precision sourcing outpaces mindless volume every single time.”',
        subtext: '— Elite Standard',
      },
    ];
  }, [dateLabel, todayQuote, shiftTelemetry, floorIntel, statusCfg.color, status]);

  // Auto-cycle slides every 7 seconds when not paused
  useEffect(() => {
    if (hasBroadcast || isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % slides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [hasBroadcast, isPaused, slides.length]);

  // Broadcast Marquee Setup
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

  // Break Gauge calculation (max 60m allowance)
  const breakMins = Math.floor(breakMs / 60000);
  const breakGaugePct = Math.min(100, Math.round((breakMs / (60 * 60 * 1000)) * 100));
  const breakGaugeColor = breakMins > 60 ? '#FF3B5C' : breakMins >= 45 ? '#F59E0B' : '#00F5A0';

  const accentColor = hasBroadcast ? '#F59E0B' : statusCfg.color;
  const currentSlideData = slides[activeSlide] || slides[0];
  const SlideIcon = currentSlideData.icon;

  return (
    <aside
      aria-label="Intelligence HUD & Broadcast Strip"
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
        @keyframes bar-bounce-1 { 0%, 100% { height: 4px; } 50% { height: 14px; } }
        @keyframes bar-bounce-2 { 0%, 100% { height: 12px; } 50% { height: 5px; } }
        @keyframes bar-bounce-3 { 0%, 100% { height: 7px; } 50% { height: 15px; } }
        @keyframes bar-bounce-4 { 0%, 100% { height: 14px; } 50% { height: 6px; } }
        .eq-bar-1 { animation: bar-bounce-1 0.9s ease-in-out infinite; }
        .eq-bar-2 { animation: bar-bounce-2 1.1s ease-in-out infinite; }
        .eq-bar-3 { animation: bar-bounce-3 0.8s ease-in-out infinite; }
        .eq-bar-4 { animation: bar-bounce-4 1.2s ease-in-out infinite; }
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

      {/* Cyber Glassmorphic Chassis */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={`relative overflow-hidden rounded-2xl border transition-all duration-500 backdrop-blur-2xl ${
          hasNewArrival
            ? 'border-amber-400 bg-gradient-to-r from-amber-500/25 via-purple-600/25 to-amber-500/25 shadow-[0_0_35px_rgba(245,158,11,0.5)]'
            : hasBroadcast
            ? 'border-amber-500/40 bg-gradient-to-r from-[#170f03]/95 via-[#110826]/95 to-[#170f03]/95 shadow-[0_12px_36px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(245,158,11,0.3)]'
            : `${statusCfg.border} bg-gradient-to-r ${statusCfg.bg} shadow-[0_12px_36px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]`
        }`}
      >
        {/* Animated Top Neon Laser Line */}
        <div
          className="absolute top-0 left-0 right-0 h-[1.5px] pointer-events-none"
          style={{
            background: hasBroadcast
              ? 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.9) 30%, rgba(168, 85, 247, 0.9) 70%, transparent 100%)'
              : `linear-gradient(90deg, transparent 0%, ${accentColor}cc 30%, rgba(255,255,255,0.7) 50%, ${accentColor}cc 70%, transparent 100%)`,
            backgroundSize: '200% 100%',
            animation: 'laser-glow 6s ease infinite',
          }}
        />

        <div className="flex items-center h-10 px-3 gap-3 overflow-hidden">
          {/* ═════════ LEFT ZONE: LIVE STATUS & EQUALIZER CAPSULE ═════════ */}
          <div
            className="flex items-center gap-2.5 shrink-0 z-10 py-1 pr-3"
            style={{ borderRight: `1px solid ${accentColor}33` }}
          >
            {/* Status Icon Box with Animated Equalizer or Megaphone */}
            <div
              className="relative flex items-center justify-center w-7 h-7 rounded-xl border shrink-0 transition-colors duration-300"
              style={{
                background: `linear-gradient(135deg, ${accentColor}25, rgba(0,0,0,0.6))`,
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
              ) : status === 'working' ? (
                /* 4-bar Audio / Activity Equalizer bouncing in sync */
                <div className="flex items-end gap-[2px] h-3.5">
                  <span className="w-[2px] bg-emerald-400 rounded-full eq-bar-1" />
                  <span className="w-[2px] bg-emerald-400 rounded-full eq-bar-2" />
                  <span className="w-[2px] bg-emerald-400 rounded-full eq-bar-3" />
                  <span className="w-[2px] bg-emerald-400 rounded-full eq-bar-4" />
                </div>
              ) : (
                <statusCfg.Icon size={13} />
              )}
            </div>

            {/* Status Pill Badge */}
            <div className="flex items-center gap-2">
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
                {hasBroadcast ? 'BROADCAST' : statusCfg.label}
              </span>

              {/* Shift counter pill */}
              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[9px] font-mono font-bold text-slate-300">
                {formatDurationHhMm(workedMs)}
              </span>
            </div>
          </div>

          {/* ═════════ CENTER ZONE: DYNAMIC CAROUSEL OR BROADCAST MARQUEE ═════════ */}
          {hasBroadcast ? (
            /* Broadcast Active: Continuous Scrolling Marquee */
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
            /* Dynamic Intelligence HUD: Animated Slides with Micro-Navigation */
            <div className="flex-1 overflow-hidden flex items-center justify-between gap-3 px-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlideData.id}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -7 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="flex items-center gap-2.5 min-w-0 flex-1 truncate"
                >
                  {/* Category Pill Tag */}
                  <span
                    className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider shrink-0"
                    style={{
                      backgroundColor: `${currentSlideData.tagColor}1a`,
                      borderColor: `${currentSlideData.tagColor}44`,
                      color: currentSlideData.tagColor,
                    }}
                  >
                    <SlideIcon size={10} />
                    {currentSlideData.tag}
                  </span>

                  {/* Main Dynamic Intel Text */}
                  <span className="text-xs sm:text-[13px] font-medium text-slate-100 tracking-wide truncate">
                    {currentSlideData.content}
                  </span>

                  {/* Subtext / Author */}
                  {currentSlideData.subtext && (
                    <span
                      className="text-[11px] font-semibold shrink-0 font-mono hidden lg:inline"
                      style={{ color: `${currentSlideData.tagColor}ee` }}
                    >
                      {currentSlideData.subtext}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Center Micro-Dots & Nav Controls */}
              <div className="flex items-center gap-1.5 shrink-0 select-none pl-2">
                <button
                  type="button"
                  onClick={() => setActiveSlide(prev => (prev > 0 ? prev - 1 : slides.length - 1))}
                  className="p-1 text-slate-500 hover:text-slate-200 transition-colors cursor-pointer rounded hover:bg-white/[0.05]"
                  title="Previous insight"
                >
                  <ChevronLeft size={12} />
                </button>

                <div className="flex items-center gap-1">
                  {slides.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSlide(idx)}
                      aria-label={`Jump to ${s.tag}`}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                        activeSlide === idx
                          ? 'w-4'
                          : 'w-1.5 bg-white/20 hover:bg-white/40'
                      }`}
                      style={{
                        backgroundColor: activeSlide === idx ? accentColor : undefined,
                        boxShadow: activeSlide === idx ? `0 0 6px ${accentColor}` : undefined,
                      }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSlide(prev => (prev < slides.length - 1 ? prev + 1 : 0))}
                  className="p-1 text-slate-500 hover:text-slate-200 transition-colors cursor-pointer rounded hover:bg-white/[0.05]"
                  title="Next insight"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}

          {/* ═════════ RIGHT ZONE: TELEMETRY & BREAK GAUGE ═════════ */}
          <div
            className="flex items-center gap-2.5 shrink-0 z-10 pl-3"
            style={{ borderLeft: `1px solid ${accentColor}33` }}
          >
            {hasBroadcast ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider"
                style={{
                  backgroundColor: isPaused ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.25)',
                  borderColor: 'rgba(245, 158, 11, 0.5)',
                  color: '#F59E0B',
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'animate-ping bg-amber-400'}`} />
                <span>{isPaused ? 'PAUSED' : 'DISPATCH'}</span>
              </div>
            ) : (
              <>
                {/* Break Gauge Pill with Mini Progress Bar */}
                <div
                  className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/40 border border-white/5"
                  title={`Break Usage: ${breakMins}m used of 60m standard daily allowance`}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[8px] font-mono font-bold text-slate-400 leading-none gap-2">
                      <span>BREAK USAGE</span>
                      <span style={{ color: breakGaugeColor }}>{breakMins}m / 60m</span>
                    </div>
                    {/* Micro gauge track */}
                    <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${breakGaugePct}%`,
                          backgroundColor: breakGaugeColor,
                          boxShadow: `0 0 6px ${breakGaugeColor}aa`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Live Floor Health Tag */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all duration-300"
                  style={{
                    backgroundColor: `${statusCfg.color}15`,
                    borderColor: `${statusCfg.color}40`,
                    color: statusCfg.color,
                  }}
                  title={isPaused ? 'Carousel paused on hover' : 'Continuous Intelligence Sync'}
                >
                  <ShieldCheck size={11} />
                  <span className="hidden sm:inline">{isPaused ? 'PAUSED' : 'LIVE PULSE'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
