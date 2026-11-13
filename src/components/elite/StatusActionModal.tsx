'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ShieldCheck } from 'lucide-react';

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
    statusSub: string;
    quotes: { quote: string; author: string }[];
  }
> = {
  break: {
    theme: 'amber',
    accent: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.45)',
    badge: 'TEA & RECOVERY PROTOCOL',
    title: 'Time for a Tea & Reset',
    statusSub: 'Desk paused • Candidates & queues safely held',
    quotes: [
      {
        quote: 'Step away from the screen, sip your tea, and recharge. True recovery sharpens your afternoon closing edge.',
        author: 'Brigade Recovery Standard',
      },
      {
        quote: 'Pace your stamina. Great placements come from refreshed minds and disciplined breaks.',
        author: 'Floor Directive',
      },
      {
        quote: 'Hydrate, stretch, and reset your baseline. Return to the desk at 100% focus.',
        author: 'Elite Standard',
      },
      {
        quote: 'Cognitive rest is tactical. A refreshed recruiter spots opportunities tired eyes miss.',
        author: 'High Performance Habit',
      },
    ],
  },
  brb: {
    theme: 'purple',
    accent: '#A78BFA',
    glow: 'rgba(167, 139, 250, 0.45)',
    badge: 'QUICK PITSTOP ACTIVE',
    title: 'Taking a Quick Pitstop',
    statusSub: 'Desk reserved • Shift clock maintained',
    quotes: [
      {
        quote: 'Speed to outreach wins the candidate. Take care of business, keep it snappy, and rejoin with high energy.',
        author: 'Speed Protocol',
      },
      {
        quote: 'Availability is the ultimate ability. Quick away, prompt return, unstoppable results.',
        author: 'Brigade Mindset',
      },
      {
        quote: 'Every minute matters. Swift pitstop, sharp focus, back to closing.',
        author: 'Floor Creed',
      },
    ],
  },
  resume: {
    theme: 'emerald',
    accent: '#00F5A0',
    glow: 'rgba(0, 245, 160, 0.5)',
    badge: 'WARP ACTIVE // ARENA LIVE',
    title: 'Back in the Arena',
    statusSub: 'Full presence active • Ready for candidate engagement',
    quotes: [
      {
        quote: 'Presence is power. When you are dialed into the desk, opportunities and candidates find you.',
        author: 'Elite Standard',
      },
      {
        quote: 'Urgency is the currency of recruitment. Own your desk, own your pipeline, win the shift.',
        author: 'Placement Principle',
      },
      {
        quote: 'Lock in. Your next dial could be your biggest placement of the month.',
        author: 'Floor Command',
      },
    ],
  },
};

export default function StatusActionModal({ type, isOpen, onClose }: StatusActionModalProps) {
  const [quoteIdx, setQuoteIdx] = useState(0);

  // Pick a fresh quote each time the HUD fires
  useEffect(() => {
    if (isOpen) {
      const preset = HUD_PRESETS[type] || HUD_PRESETS.break;
      const idx = Math.floor(Math.random() * preset.quotes.length);
      setQuoteIdx(idx);
    }
  }, [isOpen, type]);

  // Auto-dismiss smoothly after 3.8s — ZERO CLICKS REQUIRED
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3800);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  const config = HUD_PRESETS[type] || HUD_PRESETS.break;
  const item = config.quotes[quoteIdx] || config.quotes[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Futuristic CSS for Realistic Curling Tea Steam & Cyber Optics */}
          <style>{`
            @keyframes tea-curl-1 {
              0% { transform: translate(0, 0) scaleX(1); opacity: 0; }
              20% { opacity: 0.9; }
              50% { transform: translate(-3px, -18px) scaleX(1.3); opacity: 0.7; }
              80% { opacity: 0.3; }
              100% { transform: translate(2px, -34px) scaleX(1.8); opacity: 0; }
            }
            @keyframes tea-curl-2 {
              0% { transform: translate(0, 0) scaleX(1); opacity: 0; }
              25% { opacity: 1; }
              55% { transform: translate(4px, -22px) scaleX(1.4); opacity: 0.8; }
              85% { opacity: 0.25; }
              100% { transform: translate(-3px, -38px) scaleX(2); opacity: 0; }
            }
            @keyframes tea-curl-3 {
              0% { transform: translate(0, 0) scaleX(1); opacity: 0; }
              20% { opacity: 0.85; }
              50% { transform: translate(-2px, -16px) scaleX(1.2); opacity: 0.6; }
              80% { opacity: 0.2; }
              100% { transform: translate(3px, -30px) scaleX(1.6); opacity: 0; }
            }
            .steam-wisp-1 { animation: tea-curl-1 2.8s ease-out infinite; }
            .steam-wisp-2 { animation: tea-curl-2 3.2s ease-out 0.4s infinite; }
            .steam-wisp-3 { animation: tea-curl-3 2.5s ease-out 0.8s infinite; }

            @keyframes spark-rise {
              0% { transform: translateY(0) scale(0.6); opacity: 0; }
              40% { opacity: 0.9; }
              100% { transform: translateY(-24px) scale(1.1); opacity: 0; }
            }
            .sparkle-1 { animation: spark-rise 2.2s ease-out 0.2s infinite; }
            .sparkle-2 { animation: spark-rise 2.6s ease-out 0.9s infinite; }

            @keyframes laser-scan {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(250%); }
            }
            .laser-sweep-beam {
              animation: laser-scan 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }

            @keyframes chrono-spin {
              100% { transform: rotate(360deg); }
            }
            .chrono-orbit {
              animation: chrono-spin 8s linear infinite;
            }
            .chrono-orbit-reverse {
              animation: chrono-spin 5s linear infinite reverse;
            }
          `}</style>

          {/* 
            SPATIAL CYBER HUD (Placed safely below Top Bar & Broadcast Banner at top-24)
            - pointer-events-none on outer container: 100% non-blocking.
            - pointer-events-auto on card: clicking it dismisses instantly if desired.
          */}
          <div className="fixed top-24 sm:top-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none w-[94%] max-w-lg">
            {/* Luminous Ambient Backlight */}
            <div
              className="absolute -inset-2 rounded-3xl blur-2xl opacity-40 pointer-events-none transition-all duration-500"
              style={{ background: config.glow }}
            />

            {/* Futuristic Holographic Card */}
            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.92, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.94, filter: 'blur(6px)' }}
              transition={{
                type: 'spring',
                damping: 22,
                stiffness: 320,
                mass: 0.85,
              }}
              onClick={onClose}
              title="Click anywhere on card to dismiss instantly"
              className="pointer-events-auto cursor-pointer relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-2xl backdrop-blur-2xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background:
                  'linear-gradient(145deg, rgba(16, 12, 30, 0.96) 0%, rgba(8, 6, 18, 0.98) 100%)',
                borderColor: `${config.accent}55`,
                boxShadow: `0 18px 48px rgba(0,0,0,0.9), 0 0 35px ${config.glow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
              }}
            >
              {/* Laser Scanning Beam along top edge */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none overflow-hidden"
              >
                <div
                  className="w-1/3 h-full laser-sweep-beam"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${config.accent} 50%, transparent 100%)`,
                  }}
                />
              </div>

              {/* Corner Cyber Brackets */}
              <div
                className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 pointer-events-none opacity-80"
                style={{ borderColor: config.accent }}
              />
              <div
                className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t-2 border-r-2 pointer-events-none opacity-80"
                style={{ borderColor: config.accent }}
              />
              <div
                className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b-2 border-l-2 pointer-events-none opacity-80"
                style={{ borderColor: config.accent }}
              />
              <div
                className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 pointer-events-none opacity-80"
                style={{ borderColor: config.accent }}
              />

              <div className="flex items-start gap-4">
                {/* ═════════ LEFT 3D CYBER VISUAL ═════════ */}
                <div className="relative shrink-0 flex items-center justify-center pt-1">
                  {type === 'break' ? (
                    /* ── Hyper-Detailed Steaming Tea Animation ── */
                    <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-black/60 to-black/90 shadow-[0_0_20px_rgba(245,158,11,0.35)]">
                      {/* Rising Golden Aroma Sparkles */}
                      <span className="absolute -top-3 left-4 text-[9px] text-amber-300 sparkle-1 select-none pointer-events-none">✦</span>
                      <span className="absolute -top-4 right-3 text-[8px] text-amber-200 sparkle-2 select-none pointer-events-none">✦</span>

                      {/* 3 Fluid SVG Steaming Vapor Wisps */}
                      <div className="absolute -top-5 flex items-end justify-center gap-1.5 pointer-events-none">
                        <svg width="8" height="28" viewBox="0 0 8 28" fill="none" className="steam-wisp-1">
                          <path d="M4 27C1 20 7 12 4 1" stroke="rgba(251, 191, 36, 0.85)" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        <svg width="10" height="32" viewBox="0 0 10 32" fill="none" className="steam-wisp-2">
                          <path d="M5 31C8 22 2 14 5 1" stroke="rgba(253, 230, 138, 0.95)" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                        <svg width="8" height="26" viewBox="0 0 8 26" fill="none" className="steam-wisp-3">
                          <path d="M4 25C2 18 6 10 4 1" stroke="rgba(251, 191, 36, 0.85)" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </div>

                      {/* Cyber Tea Cup with Glowing Chai Liquid */}
                      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" className="drop-shadow-[0_0_10px_rgba(245,158,11,0.9)]">
                        {/* Cup Body */}
                        <path
                          d="M5 10C5 10 6 23 17 23C28 23 29 10 29 10H5Z"
                          fill="url(#teaGrad)"
                          stroke="#FBBF24"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                        {/* Tea Surface Liquid */}
                        <ellipse cx="17" cy="10" rx="12" ry="3.5" fill="#B45309" stroke="#FDE68A" strokeWidth="1" />
                        <ellipse cx="17" cy="10" rx="7" ry="1.8" fill="#F59E0B" opacity="0.8" />
                        {/* Cup Handle */}
                        <path
                          d="M27 12C31 12 32 18 26 20"
                          stroke="#FBBF24"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          fill="none"
                        />
                        {/* Saucer / Levitation Ring */}
                        <ellipse cx="17" cy="27" rx="14" ry="2" stroke="rgba(245,158,11,0.6)" strokeWidth="1.2" />
                        <defs>
                          <linearGradient id="teaGrad" x1="5" y1="10" x2="29" y2="23" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#F59E0B" stopOpacity="0.4" />
                            <stop offset="1" stopColor="#0F0C1B" stopOpacity="0.9" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  ) : type === 'brb' ? (
                    /* ── Quantum Chronometer Orbit Animation ── */
                    <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center border border-purple-500/30 bg-gradient-to-br from-purple-500/15 via-black/60 to-black/90 shadow-[0_0_20px_rgba(167,139,250,0.35)]">
                      {/* Outer Gyro Ring */}
                      <div className="absolute inset-2 border border-purple-400/40 border-dashed rounded-full chrono-orbit pointer-events-none" />
                      <div className="absolute inset-3 border border-purple-300/30 rounded-full chrono-orbit-reverse pointer-events-none" />
                      {/* Center Glowing Stopwatch */}
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_12px_rgba(167,139,250,0.9)] animate-pulse">
                        <circle cx="12" cy="13" r="8" />
                        <path d="M12 9v4l2.5 2" />
                        <path d="M10 2h4" />
                        <path d="M12 2v2" />
                      </svg>
                    </div>
                  ) : (
                    /* ── Warp Energy Ignition Core ── */
                    <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-black/60 to-black/90 shadow-[0_0_20px_rgba(0,245,160,0.4)]">
                      {/* Pulsing Arc Reactor Rings */}
                      <div className="absolute inset-1.5 border border-emerald-400/40 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '2.4s' }} />
                      <div className="absolute inset-3 border border-emerald-300/50 rounded-full pointer-events-none" />
                      {/* Zap Icon with intense glow */}
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="#00F5A0" stroke="#00F5A0" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_14px_rgba(0,245,160,1)]">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* ═════════ RIGHT CONTENT & QUOTE ═════════ */}
                <div className="flex-1 min-w-0 pr-1">
                  {/* Protocol Badge + Subtitle */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm"
                      style={{
                        backgroundColor: `${config.accent}1f`,
                        borderColor: `${config.accent}66`,
                        color: config.accent,
                      }}
                    >
                      <Sparkles size={10} />
                      {config.badge}
                    </span>

                    <span className="text-[9px] font-mono text-slate-400 shrink-0">
                      Auto-syncing • 3s
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-sm font-bold text-slate-100 tracking-tight mb-1.5">
                    {config.title}
                  </h4>

                  {/* Curated Motivational Quote Box */}
                  <div
                    className="relative rounded-xl p-2.5 mb-1.5 border text-left"
                    style={{
                      background: 'rgba(255, 255, 255, 0.025)',
                      borderColor: 'rgba(255, 255, 255, 0.07)',
                    }}
                  >
                    <p className="text-[11.5px] sm:text-xs font-medium text-slate-200 leading-snug italic">
                      “{item.quote}”
                    </p>
                    <p
                      className="text-[9.5px] font-bold font-mono text-right mt-1"
                      style={{ color: config.accent }}
                    >
                      — {item.author}
                    </p>
                  </div>

                  {/* Status telemetry line */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                    <ShieldCheck size={11} style={{ color: config.accent }} />
                    <span className="truncate">{config.statusSub}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Auto-Deplete Laser Line */}
              <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-white/5 rounded-full overflow-hidden pointer-events-none mt-2">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 3.8, ease: 'linear' }}
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
