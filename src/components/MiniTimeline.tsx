'use client';

import { useMemo } from 'react';
import { TimeLog } from '@/types';
import { computeSession } from '@/lib/timeUtils';
import { cn } from '@/lib/utils';

interface MiniTimelineProps {
  logs: TimeLog[];
  date: string;
  className?: string;
}

export default function MiniTimeline({ logs, date, className }: MiniTimelineProps) {
  const segments = useMemo(() => {
    if (!logs.length) return [];

    const session = computeSession(logs);
    const startOfDay = new Date(`${date}T00:00:00`).getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    const toPct = (ts: number) => {
      const offset = ts - startOfDay;
      return Math.max(0, Math.min(100, (offset / dayMs) * 100));
    };

    const results: { type: 'work' | 'break' | 'brb'; start: number; end: number }[] = [];

    if (session.punchIn) {
      const endTime = session.punchOut ?? Date.now();
      
      // Add the main work block
      results.push({ type: 'work', start: toPct(session.punchIn), end: toPct(endTime) });

      // Add breaks on top
      session.breaks.forEach(b => {
        results.push({ type: 'break', start: toPct(b.start), end: toPct(b.end ?? endTime) });
      });

      // Add brbs on top
      session.brbs.forEach(b => {
        results.push({ type: 'brb', start: toPct(b.start), end: toPct(b.end ?? endTime) });
      });
    }

    return results;
  }, [logs, date]);

  if (!logs.length) {
    return (
      <div className={cn("relative h-2 w-32 overflow-hidden rounded-full bg-black/40 border border-white/5 flex items-center justify-center", className)}>
        <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">No Logs</span>
      </div>
    );
  }

  return (
    <div className={cn("relative h-2 w-32 overflow-hidden rounded-full bg-black/40 border border-white/5", className)}>
      {segments.map((seg, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-y-0 transition-all",
            seg.type === 'work' && "bg-emerald-500/60 z-10",
            seg.type === 'break' && "bg-amber-400 z-20",
            seg.type === 'brb' && "bg-sky-400 z-30"
          )}
          style={{
            left: `${seg.start}%`,
            width: `${Math.max(0.5, seg.end - seg.start)}%`
          }}
        />
      ))}
    </div>
  );
}
