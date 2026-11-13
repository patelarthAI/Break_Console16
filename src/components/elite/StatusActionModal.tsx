'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Clock, Zap, Sparkles, CheckCircle2 } from 'lucide-react';

export type StatusModalType = 'break' | 'brb' | 'resume';

interface StatusActionModalProps {
  type: StatusModalType;
  isOpen: boolean;
  onClose: () => void;
}

const HUD_PRESETS: Record<
  StatusModalType,
  {
    theme: string;
    accent: string;
    glow: string;
    badge: string;
    title: string;
    subtitle: string;
    quotes: { text: string; author: string }[];
  }
> = {
  break: {
    theme: 'amber',
    accent: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.45)',
    badge: 'TEA & RECHARGE PROTOCOL',
    title: 'Break Logged',
    subtitle: 'Candidates & desk state safely preserved',
    quotes: [
      {
        text: 'Sip your tea, reset your mind. True recovery sharpens your afternoon closing edge.',
        author: 'Brigade Standard',
      },
      {
        text: 'Step away from the screen and recharge. The strongest recruiters return 100% locked in.',
        author: 'Floor Directive',
      },
      {
        text: 'Hydrate, stretch, and reset your baseline. Great placements come from refreshed minds.',
        author: 'Recovery Creed',
      },
      {
        text: 'Pace your stamina. Sustainable high billing is built on deliberate recovery.',
        author: 'Elite Standard',
      },
    ],
  },
  brb: {
    theme: 'purple',
    accent: '#A78BFA',
    glow: 'rgba(167, 139, 250, 0.45)',
    badge: 'QUICK PITSTOP ACTIVE',
    title: 'BRB Registered',
    subtitle: 'Shift timer paused • Desk reserved for quick return',
    quotes: [
      {
        text: 'Speed to outreach wins the candidate. Take care of business and rejoin with high energy.',
        author: 'Speed Protocol',
      },
      {
        text: 'Every minute matters. Swift pitstop, sharp focus, back to closing.',
        author: 'Floor Creed',
      },
      {
        text: 'Availability is the ultimate ability. Quick away, prompt return, unstoppable results.',
        author: 'Brigade Mindset',
      },
    ],
  },
  resume: {
    theme: 'emerald',
    accent: '#00F5A0',
    glow: 'rgba(0, 245, 160, 0.5)',
    badge: 'WARP ACTIVE // ARENA LIVE',
    title: 'Back on the Floor',
    subtitle: 'Full presence activated • Ready for candidate outreach',
    quotes: [
      {
        text: 'Presence is power. When you are dialed into the desk, placements find you.',
        author: 'Elite Standard',
      },
      {
        text: 'Lock in. Your next dial could be your biggest placement of the month.',
        author: 'Floor Command',
      },
      {
        text: 'Urgency is the currency of recruitment. Own the desk, own the results.',
        author: 'Placement Principle',
      },
    ],
  },
};

export default function StatusActionModal({ type, isOpen, onClose }: StatusActionModalProps) {
  const [randomQuoteIdx, setRandomQuoteIdx] = useState(0);

  // Pick a fresh quote whenever HUD opens
  useEffect(() => {
    if (isOpen) {
      const preset = HUD_PRESETS[type] || HUD_PRESETS.break;
      const idx = Math.floor(Math.random() * preset.quotes.length);
      setRandomQuoteIdx(idx);
    }
  }, [isOpen, type]);

  // Auto-dismiss smoothly after 3.4 seconds — ZERO CLICKS REQUIRED
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3400);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  const config = HUD_PRESETS[type] || HUD_PRESETS.break;
  const quote = config.quotes[randomQuoteIdx] || config.quotes[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Futuristic CSS for Animated Steaming Vapor & Laser Sweep */}
          <style>{`
            @keyframes steam-drift-1 {
              0% { transform: translateY(0) scaleX(1); opacity: 0; }
              25% { opacity: 0.9; }
              75% { opacity: 0.5; }
              100% { transform: translateY(-18px) scaleX(1.6); opacity: 0; }
            }
            @keyframes steam-drift-2 {
              0% { transform: translateY(0) scaleX(1); opacity: 0; }
              35% { opacity: 1; }
              80% { opacity: 0.6; }
              100% { transform: translateY(-22px) scaleX(1.8); opacity: 0; }
            }
            @keyframes steam-drift-3 {
              0% { transform: translateY(0) scaleX(1); opacity: 0; }
              20% { opacity: 0.85; }
              70% { opacity: 0.4; }
              100% { transform: translateY(-16px) scaleX(1.4); opacity: 0; }
            }
            .steam-puff-1 { animation: steam-drift-1 2.2s ease-out infinite; }
            .steam-puff-2 { animation: steam-drift-2 2.6s ease-out 0.35s infinite; }
            .steam-puff-3 { animation: steam-drift-3 2.0s ease-out 0.7s infinite; }

            @keyframes hud-sheen {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
            .hud-laser-sheen {
              animation: hud-sheen 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }

            @keyframes ring-expand {
              0% { transform: scale(0.85); opacity: 0.9; }
              50% { transform: scale(1.18); opacity: 0.2; }
              100% { transform: scale(0.85); opacity: 0.9; }
            }
            .ring-pulse-aura {
              animation: ring-expand 2s ease-in-out infinite;
            }
          `}</style>

          {/* 
            NON-BLOCKING CONTAINER:
            pointer-events-none ensures user can click anywhere on the dashboard,
            move around, or do work without interruption.
          */}
          <div className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none max-w-2xl w-[94%] sm:w-auto">
            {/* Dynamic Island Cyber Capsule */}
            <motion.div
              initial={{ opacity: 0, y: -45, scale: 0.88, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -25, scale: 0.92, filter: 'blur(8px)' }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
                mass: 0.8,
              }}
              onClick={onClose}
              title="Click anywhere to dismiss instantly"
              className="pointer-events-auto cursor-pointer relative overflow-hidden rounded-full border px-4 py-2.5 sm:px-5 sm:py-3 shadow-2xl backdrop-blur-2xl transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(14, 11, 26, 0.95) 0%, rgba(7, 5, 15, 0.98) 100%)',
                borderColor: `${config.accent}66`,
                boxShadow: `0 16px 40px -10px rgba(0,0,0,0.85), 0 0 28px ${config.glow}, inset 0 1px 0 rgba(255,255,255,0.2)`,
              }}
            >
              {/* Running Laser Sheen Glint across top rim */}
              <div
                className="absolute inset-y-0 -left-1/2 w-1/3 pointer-events-none hud-laser-sheen"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${config.accent}30 50%, transparent 100%)`,
                }}
              />

              <div className="flex items-center gap-3.5 sm:gap-4">
                {/* ── Left Animated Icon Sphere ── */}
                <div className="relative shrink-0 flex items-center justify-center">
                  {/* Glowing ambient ring */}
                  <div
                    className="absolute w-12 h-12 rounded-full blur-md ring-pulse-aura pointer-events-none"
                    style={{ background: config.glow }}
                  />

                  {/* Icon Chamber */}
                  <div
                    className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full border shadow-inner transition-transform group-hover:rotate-6"
                    style={{
                      background: `linear-gradient(145deg, ${config.accent}33, rgba(0,0,0,0.85))`,
                      borderColor: `${config.accent}88`,
                      boxShadow: `0 0 14px ${config.glow}`,
                    }}
                  >
                    {type === 'break' ? (
                      <div className="relative flex flex-col items-center justify-center">
                        {/* Realistic Micro-Steam Vapor Wisps */}
                        <div className="absolute -top-3.5 flex gap-1 pointer-events-none">
                          <span className="w-1 h-3 rounded-full bg-amber-300/80 blur-[0.4px] steam-puff-1" />
                          <span className="w-1.5 h-3.5 rounded-full bg-amber-200/90 blur-[0.4px] steam-puff-2" />
                          <span className="w-1 h-3 rounded-full bg-amber-300/80 blur-[0.4px] steam-puff-3" />
                        </div>
                        <Coffee
                          size={20}
                          className="text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]"
                        />
                      </div>
                    ) : type === 'brb' ? (
                      <Clock
                        size={20}
                        className="text-purple-400 animate-pulse drop-shadow-[0_0_8px_rgba(167,139,250,0.9)]"
                      />
                    ) : (
                      <Zap
                        size={20}
                        className="text-emerald-400 drop-shadow-[0_0_8px_rgba(0,245,160,0.95)]"
                      />
                    )}
                  </div>
                </div>

                {/* ── Center Content: Telemetry Badge + Curated Quote ── */}
                <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
                  {/* Micro Top Telemetry Line */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="px-2 py-0.5 rounded-full border text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider shrink-0"
                      style={{
                        backgroundColor: `${config.accent}20`,
                        borderColor: `${config.accent}66`,
                        color: config.accent,
                      }}
                    >
                      {config.badge}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono truncate">
                      <CheckCircle2 size={10} style={{ color: config.accent }} />
                      <span>{config.subtitle}</span>
                    </span>
                  </div>

                  {/* Punchy Motivation Quote */}
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="text-xs sm:text-[13px] font-medium text-slate-100 tracking-tight truncate"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                    >
                      “{quote.text}”
                    </span>
                    <span
                      className="hidden md:inline text-[10px] font-bold font-mono shrink-0 pl-1"
                      style={{ color: `${config.accent}dd` }}
                    >
                      — {quote.author}
                    </span>
                  </div>
                </div>

                {/* ── Right Dismiss Cue ── */}
                <div className="shrink-0 pl-1 flex items-center justify-center">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center border text-[9px] font-mono text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity"
                    style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                  >
                    ✕
                  </div>
                </div>
              </div>

              {/* Bottom Auto-Deplete Progress Laser Line */}
              <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-white/5 rounded-full overflow-hidden pointer-events-none">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 3.4, ease: 'linear' }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: config.accent,
                    boxShadow: `0 0 8px ${config.glow}`,
                  }}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
