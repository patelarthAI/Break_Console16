'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BriefcaseBusiness, CircleDot, Coffee, LogOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'working' | 'on_break' | 'on_brb' | 'punched_out';

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    helper: string;
    icon: React.ReactNode;
    accent: string;
    dot: string;
    ring: string;
  }
> = {
  idle: {
    label: 'Ready to begin',
    helper: 'Waiting for your shift to start',
    icon: <CircleDot size={16} />,
    accent: 'text-slate-300',
    dot: 'bg-slate-400',
    ring: 'border-white/10 bg-white/5',
  },
  working: {
    label: 'Clocked in',
    helper: 'You are actively on shift',
    icon: <BriefcaseBusiness size={16} />,
    accent: 'text-[#f2d49a]',
    dot: 'bg-[#64d7a6]',
    ring: 'border-[#f2d49a]/25 bg-[#f2d49a]/8',
  },
  on_break: {
    label: 'On break',
    helper: 'Timer is still running',
    icon: <Coffee size={16} />,
    accent: 'text-[#ffc061]',
    dot: 'bg-[#ffc061]',
    ring: 'border-[#ffc061]/25 bg-[#ffc061]/10',
  },
  on_brb: {
    label: 'Away for a moment',
    helper: 'BRB status is active',
    icon: <RotateCcw size={16} />,
    accent: 'text-[#67d7ff]',
    dot: 'bg-[#67d7ff]',
    ring: 'border-[#67d7ff]/25 bg-[#67d7ff]/10',
  },
  punched_out: {
    label: 'Shift completed',
    helper: 'You are signed out for the day',
    icon: <LogOut size={16} />,
    accent: 'text-slate-200',
    dot: 'bg-slate-400',
    ring: 'border-white/10 bg-white/5',
  },
};

export default function PremiumStatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'inline-flex items-center gap-4 rounded-full border px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl',
          config.ring,
        )}
      >
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/30">
          <span className={cn('absolute h-2.5 w-2.5 rounded-full animate-pulse', config.dot)} />
          <span className={config.accent}>{config.icon}</span>
        </div>

        <div className="text-left">
          <p className={cn('text-sm font-semibold', config.accent)}>{config.label}</p>
          <p className="text-xs text-slate-400">{config.helper}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
