'use client';

import { CalendarDays, Dot, Sparkles } from 'lucide-react';
import { useClock } from '@/hooks/useClock';

export default function PremiumClock() {
  const now = useClock();

  const hours = now.getHours();
  const h12 = (hours % 12 || 12).toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <section className="surface-card relative overflow-hidden rounded-[2rem] p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-[#67d7ff]/10 blur-3xl" />

      <div className="relative flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="data-pill border border-[#f2d49a]/20 bg-[#f2d49a]/8 text-[#f2d49a]">
            <Sparkles size={14} />
            Live command time
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
            Updated every second
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-3 text-white">
            <span className="mono-numeric text-[clamp(4.25rem,8vw,6.75rem)] font-semibold leading-none tracking-[-0.08em]">
              {h12}
            </span>
            <span className="pb-5 text-[clamp(4rem,7vw,6rem)] leading-none text-white/30">:</span>
            <span className="mono-numeric text-[clamp(4.25rem,8vw,6.75rem)] font-semibold leading-none tracking-[-0.08em]">
              {minutes}
            </span>
            <div className="mb-3 ml-2 flex flex-col items-start gap-1">
              <span className="mono-numeric text-2xl font-semibold text-[#f2d49a]">{ampm}</span>
              <span className="mono-numeric text-lg text-slate-400">{seconds}s</span>
            </div>
          </div>

          <div className="space-y-2 rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              <CalendarDays size={14} />
              Today
            </div>
            <p className="text-base font-medium text-slate-200">{dateStr}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="data-pill">
            <Dot size={18} className="text-[#64d7a6]" />
            Session view in real time
          </div>
          <div className="data-pill">
            <Dot size={18} className="text-[#67d7ff]" />
            Precision tracked
          </div>
        </div>
      </div>
    </section>
  );
}
