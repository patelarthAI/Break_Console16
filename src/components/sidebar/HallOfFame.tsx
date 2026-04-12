'use client';

import type { UserBreakStats } from '@/lib/store';

function formatMinutes(ms: number) {
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

interface HallOfFameProps {
  stats: UserBreakStats[];
}

export default function HallOfFame({ stats }: HallOfFameProps) {
  const ranked = stats
    .filter((r) => r.daysChecked > 0 && r.user.workMode === 'WFO')
    .sort((a, b) => (a.avgBreakMs + a.avgBrbMs) - (b.avgBreakMs + b.avgBrbMs))
    .slice(0, 3);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="card p-5 border-[#f59e0b]/20 bg-gradient-to-b from-[#f59e0b]/[0.05] to-transparent shadow-[0_4px_32px_rgba(245,158,11,0.05)] backdrop-blur-md">
      <div className="flex items-center justify-between mb-5">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-[#f59e0b]">⭐ Aura Maxers</div>
        <span className="px-2 py-0.5 rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[9px] font-bold text-[#f59e0b] tracking-wider shadow-[0_0_8px_rgba(245,158,11,0.2)]">WEEKLY</span>
      </div>

      {ranked.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-2xl mb-2 opacity-50">🏆</div>
          <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">Rankings resetting</div>
          <div className="text-[10px] text-slate-600 mt-1">First activity claims top spot</div>
        </div>
      ) : (
        <div className="space-y-4">
          {ranked.map((row, i) => (
            <div key={row.user.id} className="flex items-center gap-3 group">
              <div className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm shadow-sm group-hover:scale-110 transition-transform">
                {medals[i]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-white tracking-tight truncate">{row.user.name}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest truncate">{row.user.clientName}</div>
              </div>
              <div className="text-right">
                <span className="font-mono text-[13px] font-black tracking-tight text-[#f59e0b] drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                  {formatMinutes(row.avgBreakMs + row.avgBrbMs)}
                </span>
                <div className="text-[8px] text-[#f59e0b]/50 uppercase tracking-widest font-bold">AVG</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
