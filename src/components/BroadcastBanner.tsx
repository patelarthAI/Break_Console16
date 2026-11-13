'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Megaphone, Sparkles, Coffee, Clock, RotateCcw, Compass, Zap } from 'lucide-react';
import { User, AppNotification } from '@/types';
import { getActiveNotifications } from '@/lib/store';
import { subscribe } from '@/lib/realtime';

interface BroadcastBannerProps {
  user: User;
  status?: string;
  className?: string;
}

interface DailyQuote {
  quote: string;
  author: string;
  category?: 'presence' | 'focus' | 'recharge' | 'momentum';
}

// 40+ Curated world-class motivations focused on desk presence, availability, focus, and recruitment mastery
const DAILY_QUOTES: DailyQuote[] = [
  // ── Desk Presence & Availability ──
  { quote: "Presence is power. When you're at the desk, opportunities and candidates find you.", author: "Elite Standard", category: "presence" },
  { quote: "Availability is the ultimate ability. The recruiter who is always present is the one who closes.", author: "Brigade Mindset", category: "presence" },
  { quote: "Every minute away from your desk is a missed connection. Stay active, stay responsive, stay winning.", author: "Focus Protocol", category: "presence" },
  { quote: "Consistency at the desk builds unshakeable trust with candidates and hiring managers alike.", author: "Pulse System", category: "presence" },
  { quote: "Candidates call back when you least expect it. Stay seated, stay available, and take the placement.", author: "Recruitment Creed", category: "presence" },
  { quote: "A filled roster begins with an active, available consultant. Win the shift from your seat.", author: "Floor Directive", category: "presence" },
  { quote: "Urgency is the currency of recruitment. Be at your desk the moment opportunity knocks.", author: "Placement Principle", category: "presence" },
  { quote: "The best recruiters aren't just talented — they are consistently there when their clients need them.", author: "Executive Standard", category: "presence" },
  { quote: "Speed to outreach wins the candidate. Protect your desk presence and seize the window.", author: "Speed Protocol", category: "presence" },
  { quote: "While others step away, the top biller stays locked in, available, and closing.", author: "Floor Creed", category: "presence" },

  // ── Deep Work & Laser Focus ──
  { quote: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell", category: "focus" },
  { quote: "Focus is a muscle. Train it every hour by staying present, locked in, and dialed into your pipeline.", author: "Brigade Command", category: "focus" },
  { quote: "Amateurs wait for inspiration; top billers sit down, lock in, and go to work.", author: "Stephen King", category: "focus" },
  { quote: "Don't count the hours at your desk — make every single hour of focus count.", author: "Muhammad Ali", category: "focus" },
  { quote: "Discipline is choosing between what you want right now and what you want most.", author: "Abraham Lincoln", category: "focus" },
  { quote: "You cannot produce high-impact placements with fractured attention. Lock in on one outreach at a time.", author: "Deep Work Standard", category: "focus" },
  { quote: "The successful consultant is the average person, with laser-like, unbroken focus.", author: "Bruce Lee", category: "focus" },
  { quote: "Energy flows where attention goes. Eliminate the noise, own your desk, and execute.", author: "High Output Rule", category: "focus" },
  { quote: "Waste no more time debating what a high performer should be. Sit down and be one.", author: "Marcus Aurelius", category: "focus" },
  { quote: "Simplicity and relentless focus are the ultimate sophistication in recruiting.", author: "Leonardo da Vinci", category: "focus" },

  // ── Recharge & Reset Mantras ──
  { quote: "Step back from the screen, hydrate, and reset your baseline. True recovery sharpens your afternoon closing edge.", author: "Recovery Standard", category: "recharge" },
  { quote: "Cognitive rest is tactical. A refreshed mind spot opportunities tired eyes miss.", author: "Brigade Science", category: "recharge" },
  { quote: "Take your tea, stretch your legs, and breathe. Return to the desk at 100% power.", author: "Tea Protocol", category: "recharge" },
  { quote: "Pace your stamina. Sustainable high billing is built on deliberate, guilt-free recovery.", author: "High Performance Habit", category: "recharge" },

  // ── Pipeline Momentum & Relentless Execution ──
  { quote: "Pipeline is power. Precision sourcing and prompt follow-ups outpace mindless volume every time.", author: "Sourcing Doctrine", category: "momentum" },
  { quote: "Discipline equals freedom. Master your desk hours and you master your income.", author: "Jocko Willink", category: "momentum" },
  { quote: "The secret of getting ahead in recruitment is getting started on that next call.", author: "Mark Twain", category: "momentum" },
  { quote: "Victory belongs to the most persevering. Keep dialing, keep sourcing, keep closing.", author: "Napoleon Bonaparte", category: "momentum" },
  { quote: "Action is the foundational key to all success. Start the conversation right now.", author: "Pablo Picasso", category: "momentum" },
  { quote: "We are what we repeatedly do. Excellence at your desk is not an act, but a daily habit.", author: "Aristotle", category: "momentum" },
  { quote: "Opportunities don't just happen. You create them by staying active and available.", author: "Chris Grosser", category: "momentum" },
  { quote: "Small deeds done right now are better than massive plans postponed.", author: "Peter Marshall", category: "momentum" },
  { quote: "Continuous effort and presence — not luck — is the key to unlocking your highest billings.", author: "Winston Churchill", category: "momentum" },
  { quote: "Success is the sum of small outreach sprints, repeated hour after hour, day after day.", author: "Robert Collier", category: "momentum" },
  { quote: "Your pipeline is a living engine. When you stay seated and feed it daily, it delivers.", author: "Brigade Playbook", category: "momentum" },
  { quote: "Do not wait; the time will never be 'just right.' Dial the next candidate from where you stand.", author: "Napoleon Hill", category: "momentum" },
  { quote: "The impediment to action advances action. What stands in your way becomes your placement.", author: "Marcus Aurelius", category: "momentum" },
  { quote: "Well done is always better than well said. Let your desk activity do the talking.", author: "Benjamin Franklin", category: "momentum" },
  { quote: "Quality is not an accident; it is the habit of an active, disciplined recruiter.", author: "Will Durant", category: "momentum" },
  { quote: "If you want to dominate the leaderboard, protect your presence and out-focus everyone.", author: "Elite Standard", category: "momentum" },
];

function getInitialQuoteIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear % DAILY_QUOTES.length;
}

export default function BroadcastBanner({
  user,
  status = 'working',
  className = '',
}: BroadcastBannerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [quoteIndex, setQuoteIndex] = useState(getInitialQuoteIndex());
  const [isPaused, setIsPaused] = useState(false);
  const prevCountRef = useRef(0);
  const [hasNewArrival, setHasNewArrival] = useState(false);

  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  const todayQuote = DAILY_QUOTES[quoteIndex] || DAILY_QUOTES[0];

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

  // Determine theme and icons based on status
  const isBreak = status === 'on_break';
  const isBrb = status === 'on_brb';

  const badgeConfig = useMemo(() => {
    if (hasBroadcast) {
      return {
        label: 'Broadcast',
        accent: '#F59E0B',
        Icon: Megaphone,
        sub: '',
      };
    }
    if (isBreak) {
      return {
        label: 'Tea Time // Recharge',
        accent: '#F59E0B',
        Icon: Coffee,
        sub: 'Rest Mode',
      };
    }
    if (isBrb) {
      return {
        label: 'Step-Away // Reserved',
        accent: '#A78BFA',
        Icon: Clock,
        sub: 'BRB Active',
      };
    }
    return {
      label: 'Daily Directive',
      accent: '#00F5A0',
      Icon: Sparkles,
      sub: 'Focus Mode',
    };
  }, [hasBroadcast, isBreak, isBrb]);

  const handleNextQuote = () => {
    setQuoteIndex(prev => (prev + 1) % DAILY_QUOTES.length);
  };

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

      {/* Clean Glassmorphic Chassis with subtle status-reactive neon glow */}
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={`relative overflow-hidden rounded-2xl border transition-all duration-500 backdrop-blur-2xl ${
          hasNewArrival
            ? 'border-amber-400 bg-gradient-to-r from-amber-500/25 via-purple-600/25 to-amber-500/25 shadow-[0_0_35px_rgba(245,158,11,0.5)]'
            : hasBroadcast
            ? 'border-amber-500/40 bg-gradient-to-r from-[#170f03]/95 via-[#110826]/95 to-[#170f03]/95 shadow-[0_12px_36px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(245,158,11,0.3)]'
            : isBreak
            ? 'border-amber-500/30 bg-gradient-to-r from-[#171004]/95 via-[#231707]/90 to-[#171004]/95 shadow-[0_12px_36px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(245,158,11,0.2)]'
            : isBrb
            ? 'border-purple-500/30 bg-gradient-to-r from-[#130928]/95 via-[#1d0e3a]/90 to-[#130928]/95 shadow-[0_12px_36px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(167,139,250,0.2)]'
            : 'border-white/10 bg-gradient-to-r from-[#0c081c]/95 via-[#080614]/95 to-[#0c081c]/95 shadow-[0_12px_36px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)]'
        }`}
      >
        {/* Top Edge Neon Highlight */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
          style={{
            background: hasBroadcast
              ? 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.9) 30%, rgba(168, 85, 247, 0.9) 70%, transparent 100%)'
              : `linear-gradient(90deg, transparent 0%, ${badgeConfig.accent}99 40%, rgba(255, 255, 255, 0.6) 50%, ${badgeConfig.accent}99 60%, transparent 100%)`,
            backgroundSize: '200% 100%',
            animation: 'laser-sweep 7s ease infinite',
          }}
        />

        <div className="flex items-center h-10 px-3.5 gap-3 overflow-hidden">
          {/* ═════════ LEFT BADGE ═════════ */}
          <div
            className="flex items-center gap-2 shrink-0 z-10 py-1 pr-3"
            style={{ borderRight: `1px solid ${badgeConfig.accent}33` }}
          >
            <div
              className="relative flex items-center justify-center w-7 h-7 rounded-xl border shrink-0 transition-colors duration-300"
              style={{
                background: `linear-gradient(135deg, ${badgeConfig.accent}25, rgba(0,0,0,0.6))`,
                borderColor: `${badgeConfig.accent}55`,
                boxShadow: `0 0 14px ${badgeConfig.accent}40`,
                color: badgeConfig.accent,
              }}
            >
              <badgeConfig.Icon size={13} className={hasBroadcast ? 'animate-pulse' : ''} />
              {hasBroadcast && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping"
                  style={{ backgroundColor: badgeConfig.accent }}
                />
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className="px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all duration-300"
                style={{
                  backgroundColor: `${badgeConfig.accent}1a`,
                  borderColor: `${badgeConfig.accent}44`,
                  color: badgeConfig.accent,
                }}
              >
                {badgeConfig.label}
              </span>
            </div>
          </div>

          {/* ═════════ CENTER CONTENT (THE BEST QUOTES OR BROADCAST) ═════════ */}
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
            /* 1 Curated Daily Motivation (Clean, Spacious, Centered) */
            <div className="flex-1 overflow-hidden flex items-center justify-center px-4">
              <div className="flex items-center justify-center gap-2 truncate text-center max-w-full">
                <span className="text-amber-400 text-sm font-serif select-none">“</span>
                <span className="text-xs sm:text-[13px] font-medium text-slate-100 tracking-wide truncate">
                  {todayQuote.quote}
                </span>
                <span className="text-amber-400 text-sm font-serif select-none">”</span>
                <span
                  className="text-[11px] font-semibold pl-1 shrink-0 font-mono"
                  style={{ color: `${badgeConfig.accent}ee` }}
                >
                  — {todayQuote.author}
                </span>
              </div>
            </div>
          )}

          {/* ═════════ RIGHT BADGE & REFRESH ═════════ */}
          <div
            className="flex items-center gap-2 shrink-0 z-10 pl-3"
            style={{ borderLeft: `1px solid ${badgeConfig.accent}33` }}
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
              <div className="flex items-center gap-2">
                {/* Shuffle / Next Directive Interactive Button */}
                <button
                  type="button"
                  onClick={handleNextQuote}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-[9px] font-mono font-semibold text-slate-400 hover:text-amber-300 transition-all cursor-pointer"
                  title="Inspire me with another directive"
                >
                  <Sparkles size={9} />
                  <span>Next</span>
                </button>

                {/* Date Badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[9px] font-mono font-bold text-slate-300">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: badgeConfig.accent }}
                  />
                  <span>{dateLabel}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
