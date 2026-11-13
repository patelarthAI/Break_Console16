'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Clock3, Zap } from 'lucide-react';

export type StatusModalType = 'break' | 'brb' | 'resume';

interface StatusActionModalProps {
  type: StatusModalType;
  isOpen: boolean;
  onClose: () => void;
}

const HUD_CONFIG: Record<
  StatusModalType,
  {
    accent: string;
    glow: string;
    border: string;
    title: string;
    hint: string;
    Icon: typeof Coffee;
  }
> = {
  break: {
    accent: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.45)',
    border: 'rgba(245, 158, 11, 0.5)',
    title: 'Break Started',
    hint: 'Desk Paused',
    Icon: Coffee,
  },
  brb: {
    accent: '#A78BFA',
    glow: 'rgba(167, 139, 250, 0.45)',
    border: 'rgba(167, 139, 250, 0.5)',
    title: 'BRB Active',
    hint: 'Shift Reserved',
    Icon: Clock3,
  },
  resume: {
    accent: '#00F5A0',
    glow: 'rgba(0, 245, 160, 0.5)',
    border: 'rgba(0, 245, 160, 0.55)',
    title: 'Back on Floor',
    hint: 'Desk Live',
    Icon: Zap,
  },
};

export default function StatusActionModal({ type, isOpen, onClose }: StatusActionModalProps) {
  // Ultra-fast auto-dismiss (1.4 seconds) — confirms action instantly, never lingers
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 1400);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  const cfg = HUD_CONFIG[type] || HUD_CONFIG.break;
  const Icon = cfg.Icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] pointer-events-none select-none">
          <motion.div
            initial={{ opacity: 0, y: -28, scale: 0.9, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, scale: 0.92, filter: 'blur(6px)' }}
            transition={{
              type: 'spring',
              stiffness: 450,
              damping: 26,
              mass: 0.6,
            }}
            className="relative flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-2xl border shadow-2xl overflow-hidden pointer-events-auto cursor-pointer"
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, rgba(16, 12, 28, 0.94) 0%, rgba(8, 6, 16, 0.98) 100%)',
              borderColor: cfg.border,
              boxShadow: `0 8px 32px rgba(0, 0, 0, 0.8), 0 0 20px ${cfg.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.25)`,
            }}
          >
            {/* Glowing Icon Chamber */}
            <div
              className="relative flex items-center justify-center w-7 h-7 rounded-full shrink-0 border"
              style={{
                background: `linear-gradient(135deg, ${cfg.accent}33, rgba(0,0,0,0.6))`,
                borderColor: `${cfg.accent}88`,
                boxShadow: `0 0 10px ${cfg.glow}`,
              }}
            >
              <Icon size={14} style={{ color: cfg.accent }} />
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-60"
                style={{ backgroundColor: cfg.accent }}
              />
            </div>

            {/* Micro Kinetic Label */}
            <div className="flex items-center gap-2 pr-2">
              <span className="text-xs font-black tracking-tight text-white uppercase font-mono">
                {cfg.title}
              </span>
              <span className="text-slate-500 text-[10px] select-none">•</span>
              <span
                className="text-[10px] font-bold tracking-wider uppercase font-mono"
                style={{ color: cfg.accent }}
              >
                {cfg.hint}
              </span>
            </div>

            {/* Bottom 1.4s Fast Laser Line */}
            <div className="absolute bottom-0 left-3 right-3 h-[1.5px] bg-white/10 rounded-full overflow-hidden pointer-events-none">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 1.4, ease: 'linear' }}
                className="h-full rounded-full"
                style={{
                  backgroundColor: cfg.accent,
                  boxShadow: `0 0 6px ${cfg.glow}`,
                }}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
