'use client';

import { motion } from 'framer-motion';
import {
  Clock3,
  Coffee,
  LogIn,
  LogOut,
  PlayCircle,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { TimeLog } from '@/types';
import { formatTime } from '@/lib/timeUtils';
import { cn } from '@/lib/utils';

const eventConfig = {
  punch_in: {
    label: 'Punch in',
    icon: <LogIn size={15} />,
    tone: 'text-[#64d7a6]',
    ring: 'border-[#64d7a6]/20 bg-[#64d7a6]/10',
  },
  punch_out: {
    label: 'Punch out',
    icon: <LogOut size={15} />,
    tone: 'text-[#ff9b70]',
    ring: 'border-[#ff9b70]/20 bg-[#ff9b70]/10',
  },
  break_start: {
    label: 'Break start',
    icon: <Coffee size={15} />,
    tone: 'text-[#ffc061]',
    ring: 'border-[#ffc061]/20 bg-[#ffc061]/10',
  },
  break_end: {
    label: 'Break end',
    icon: <PlayCircle size={15} />,
    tone: 'text-[#67d7ff]',
    ring: 'border-[#67d7ff]/20 bg-[#67d7ff]/10',
  },
  brb_start: {
    label: 'BRB start',
    icon: <RotateCcw size={15} />,
    tone: 'text-[#67d7ff]',
    ring: 'border-[#67d7ff]/20 bg-[#67d7ff]/10',
  },
  brb_end: {
    label: 'BRB end',
    icon: <RotateCw size={15} />,
    tone: 'text-[#f2d49a]',
    ring: 'border-[#f2d49a]/20 bg-[#f2d49a]/10',
  },
  auto_logout: {
    label: 'Auto logout',
    icon: <Clock3 size={15} />,
    tone: 'text-rose-400',
    ring: 'border-rose-400/20 bg-rose-400/10',
  },
};

export default function PremiumTimelineLog({
  logs,
  isAdmin,
  onDeleteLog,
}: {
  logs: TimeLog[];
  isAdmin?: boolean;
  onDeleteLog?: (id: string) => void;
}) {
  if (!logs.length) {
    return (
      <div className="rounded-[1.7rem] border border-dashed border-white/10 bg-black/10 px-5 py-10 text-center">
        <Clock3 size={24} className="mx-auto mb-3 text-slate-500" />
        <p className="text-sm text-slate-400">No events recorded yet today.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-3 before:absolute before:bottom-4 before:left-[1.35rem] before:top-4 before:w-px before:bg-gradient-to-b before:from-white/15 before:via-white/8 before:to-transparent">
      {[...logs].reverse().map((log, index) => {
        const config = eventConfig[log.eventType] ?? {
          label: log.eventType,
          icon: <Clock3 size={15} />,
          tone: 'text-slate-300',
          ring: 'border-white/10 bg-white/5',
        };

        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: index * 0.02 }}
            className="relative flex items-start gap-4 rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4"
          >
            <div
              className={cn(
                'relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-white',
                config.ring,
              )}
            >
              <span className={config.tone}>{config.icon}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{config.label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="mono-numeric rounded-full border border-white/8 bg-white/5 px-2.5 py-1">
                      {formatTime(log.timestamp)}
                    </span>
                    {log.addedBy && (
                      <span className="rounded-full border border-[#f2d49a]/20 bg-[#f2d49a]/10 px-2.5 py-1 text-[#f2d49a]">
                        Added by admin
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && onDeleteLog && (
                  <button
                    type="button"
                    onClick={() => onDeleteLog(log.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-300 transition-colors hover:bg-rose-500/20"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
