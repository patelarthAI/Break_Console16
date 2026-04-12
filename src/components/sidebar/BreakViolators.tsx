'use client';

import { AlertTriangle } from 'lucide-react';
import type { UserBreakStats } from '@/lib/store';

function formatMinutes(ms: number) {
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

interface BreakViolatorsProps {
  stats: UserBreakStats[];
}

export default function BreakViolators({ stats }: BreakViolatorsProps) {
  const violators = stats
    .filter((r) => r.daysChecked >= 1 && r.avgBreakMs + r.avgBrbMs > 85 * 60 * 1000)
    .sort((a, b) => (b.avgBreakMs + b.avgBrbMs) - (a.avgBreakMs + a.avgBrbMs))
    .slice(0, 4);

  return (
    <div className="card p-5 border-[#ef4444]/20 bg-gradient-to-b from-[#ef4444]/[0.05] to-transparent shadow-[0_4px_32px_rgba(239,68,68,0.05)] backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#ef4444]" />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-[#ef4444]">Lobby Campers</span>
        </div>
        <span className="px-2 py-0.5 rounded-full border border-[#ef4444]/30 bg-[#ef4444]/10 text-[9px] font-bold text-[#ef4444] tracking-wider shadow-[0_0_8px_rgba(239,68,68,0.2)]">LAST 5 DAYS</span>
      </div>

      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-5 flex items-center justify-between border-b border-white/[0.04] pb-2">
        <span>Break + BRB Limit</span>
        <span className="font-mono text-slate-400">1h 25m / day</span>
      </div>

      {violators.length === 0 ? (
        <div className="text-center py-5">
          <div className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] text-2xl mb-2">✓</div>
          <div className="text-xs text-emerald-400 font-black uppercase tracking-widest">No Violations</div>
          <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">The team is crushing it 💪</div>
        </div>
      ) : (
        <div className="space-y-4">
          {violators.map((row, i) => (
            <div key={row.user.id} className="flex items-center gap-3 group">
              <div className="w-6 h-6 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-sm shadow-sm group-hover:scale-110 transition-transform">
                <span className="font-black text-[#ef4444] text-[10px]">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-white tracking-tight truncate">{row.user.name}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest truncate">{row.user.clientName}</div>
              </div>
              <div className="text-right">
                <span className="font-mono text-[13px] font-black tracking-tight text-[#ef4444] drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                  {formatMinutes(row.avgBreakMs + row.avgBrbMs)}
                </span>
                <div className="text-[8px] text-[#ef4444]/50 uppercase tracking-widest font-bold">AVG/DAY</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
