'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Coffee, Clock, Zap, X, ArrowRight, ShieldCheck } from 'lucide-react';

export type StatusModalType = 'break' | 'brb' | 'resume';

interface StatusActionModalProps {
  type: StatusModalType;
  isOpen: boolean;
  onClose: () => void;
}

const MODAL_CONFIGS: Record<
  StatusModalType,
  {
    theme: string;
    accent: string;
    glow: string;
    badge: string;
    title: string;
    subtitle: string;
    quote: string;
    author: string;
    hint: string;
    buttonText: string;
  }
> = {
  break: {
    theme: 'amber',
    accent: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.4)',
    badge: 'RECHARGE PROTOCOL ENGAGED',
    title: 'Time for a Tea & Reset',
    subtitle: 'Desk status paused • Candidates & queues safely held',
    quote:
      'Step back from the screen, hydrate, and reset your baseline. True recovery sharpens your afternoon closing edge.',
    author: 'Brigade Recovery Standard',
    hint: 'Target: 15–30 min. Take a breather, stretch, and return at 100%.',
    buttonText: 'Enjoy Break',
  },
  brb: {
    theme: 'purple',
    accent: '#A78BFA',
    glow: 'rgba(167, 139, 250, 0.4)',
    badge: 'QUICK STEP-AWAY REGISTERED',
    title: 'Taking a Quick Pitstop',
    subtitle: 'Desk reserved • Shift clock maintained',
    quote:
      'Speed to outreach wins the candidate. Take care of business, keep it snappy, and rejoin the floor with high energy.',
    author: 'Speed Protocol',
    hint: 'Quick away mode active. Re-engage as soon as you return.',
    buttonText: 'Got It',
  },
  resume: {
    theme: 'emerald',
    accent: '#00F5A0',
    glow: 'rgba(0, 245, 160, 0.45)',
    badge: 'FOCUS PROTOCOL INITIATED',
    title: 'Back in the Arena',
    subtitle: 'Full presence active • Ready for candidate engagement',
    quote:
      'Presence is power. When you’re at the desk, opportunities and candidates find you. Own this hour!',
    author: 'Elite Standard',
    hint: 'You are now live on the floor. Let’s make placements happen.',
    buttonText: 'Lock In',
  },
};

export default function StatusActionModal({ type, isOpen, onClose }: StatusActionModalProps) {
  const config = MODAL_CONFIGS[type] || MODAL_CONFIGS.break;

  // Auto-dismiss after 6.5s if not manually clicked
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 6500);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Backdrop with cyber blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Steaming Vapor CSS Animation for Tea/Coffee */}
          <style>{`
            @keyframes steam-rise-1 {
              0% { transform: translateY(0) scaleX(1); opacity: 0; }
              30% { opacity: 0.8; }
              100% { transform: translateY(-22px) scaleX(1.4); opacity: 0; }
            }
            @keyframes steam-rise-2 {
              0% { transform: translateY(0) scaleX(1); opacity: 0; }
              40% { opacity: 0.9; }
              100% { transform: translateY(-26px) scaleX(1.6); opacity: 0; }
            }
            @keyframes steam-rise-3 {
              0% { transform: translateY(0) scaleX(1); opacity: 0; }
              20% { opacity: 0.7; }
              100% { transform: translateY(-20px) scaleX(1.3); opacity: 0; }
            }
            .steam-1 { animation: steam-rise-1 2.4s ease-out infinite; }
            .steam-2 { animation: steam-rise-2 2.8s ease-out 0.4s infinite; }
            .steam-3 { animation: steam-rise-3 2.1s ease-out 0.8s infinite; }
            @keyframes border-laser {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes pulse-ring {
              0% { transform: scale(0.95); opacity: 0.8; }
              50% { transform: scale(1.15); opacity: 0.2; }
              100% { transform: scale(0.95); opacity: 0.8; }
            }
          `}</style>

          {/* Holographic Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border p-7 shadow-2xl backdrop-blur-2xl"
            style={{
              background: 'linear-gradient(145deg, rgba(16, 12, 30, 0.96) 0%, rgba(8, 6, 16, 0.98) 100%)',
              borderColor: `${config.accent}40`,
              boxShadow: `0 0 50px ${config.glow}, 0 24px 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.15)`,
            }}
          >
            {/* Top Running Laser Beam */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${config.accent} 50%, transparent 100%)`,
                backgroundSize: '200% 100%',
                animation: 'border-laser 4s ease infinite',
              }}
            />

            {/* Corner Decorative Tech Brackets */}
            <div
              className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 pointer-events-none"
              style={{ borderColor: config.accent }}
            />
            <div
              className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 pointer-events-none"
              style={{ borderColor: config.accent }}
            />
            <div
              className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 pointer-events-none"
              style={{ borderColor: config.accent }}
            />
            <div
              className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 pointer-events-none"
              style={{ borderColor: config.accent }}
            />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={16} />
            </button>

            {/* Content Container */}
            <div className="flex flex-col items-center text-center">
              {/* Animated Futuristic Icon Chamber */}
              <div className="relative mb-5 flex items-center justify-center">
                {/* Ambient glowing aura ring */}
                <div
                  className="absolute w-24 h-24 rounded-full blur-xl pointer-events-none"
                  style={{ background: config.glow }}
                />

                {/* Central icon sphere */}
                <div
                  className="relative flex items-center justify-center w-18 h-18 rounded-2xl border transition-all duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${config.accent}25, rgba(0,0,0,0.7))`,
                    borderColor: `${config.accent}66`,
                    boxShadow: `0 0 25px ${config.glow}`,
                  }}
                >
                  {type === 'break' ? (
                    /* Custom Cyber Steaming Tea / Coffee Mug with animated steam */
                    <div className="relative flex flex-col items-center justify-center">
                      {/* 3 Steam Vapor trails drifting up */}
                      <div className="absolute -top-4 flex gap-1.5">
                        <span className="w-1 h-3 rounded-full bg-amber-300/80 blur-[0.5px] steam-1" />
                        <span className="w-1.5 h-4 rounded-full bg-amber-200/90 blur-[0.5px] steam-2" />
                        <span className="w-1 h-3 rounded-full bg-amber-300/80 blur-[0.5px] steam-3" />
                      </div>
                      <Coffee size={32} className="text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                    </div>
                  ) : type === 'brb' ? (
                    <Clock size={32} className="text-purple-400 animate-pulse drop-shadow-[0_0_12px_rgba(167,139,250,0.8)]" />
                  ) : (
                    <Zap size={32} className="text-emerald-400 drop-shadow-[0_0_12px_rgba(0,245,160,0.8)]" />
                  )}
                </div>
              </div>

              {/* Protocol Badge */}
              <div className="mb-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm"
                  style={{
                    backgroundColor: `${config.accent}1a`,
                    borderColor: `${config.accent}55`,
                    color: config.accent,
                  }}
                >
                  <Sparkles size={10} />
                  {config.badge}
                </span>
              </div>

              {/* Title & Subtitle */}
              <h3 className="text-xl font-black text-slate-100 tracking-tight mb-1">
                {config.title}
              </h3>
              <p className="text-xs text-slate-400 font-medium mb-5">
                {config.subtitle}
              </p>

              {/* Curated 2026 Quote Chamber */}
              <div
                className="w-full relative rounded-2xl p-4 mb-4 text-left border"
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderColor: 'rgba(255, 255, 255, 0.07)',
                }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="text-lg font-serif leading-none select-none"
                    style={{ color: config.accent }}
                  >
                    “
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-200 leading-relaxed italic">
                      {config.quote}
                    </p>
                    <p
                      className="text-[10px] font-bold font-mono text-right mt-2"
                      style={{ color: config.accent }}
                    >
                      — {config.author}
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Hint pill */}
              <div className="w-full flex items-center justify-center gap-1.5 mb-5 text-[10px] text-slate-400 font-mono">
                <ShieldCheck size={12} style={{ color: config.accent }} />
                <span>{config.hint}</span>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-lg active:scale-98"
                style={{
                  background: `linear-gradient(135deg, ${config.accent}, ${config.accent}cc)`,
                  color: '#07060e',
                  boxShadow: `0 4px 20px ${config.glow}`,
                }}
              >
                <span>{config.buttonText}</span>
                <ArrowRight size={14} />
              </button>

              {/* Auto-closing progress line indicator */}
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-4">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 6.5, ease: 'linear' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: config.accent }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
