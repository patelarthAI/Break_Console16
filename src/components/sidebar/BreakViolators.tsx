'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Flame, Hourglass, AlertCircle } from 'lucide-react';
import type { WeeklyBreakStats } from '@/lib/store';

function formatMinutes(ms: number) {
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

interface BreakViolatorsProps {
  stats: WeeklyBreakStats[];
}

export default function BreakViolators({ stats }: BreakViolatorsProps) {
  const violators = stats
    .filter((r) => r.daysChecked >= 1 && r.avgBreakMs + r.avgBrbMs > 85 * 60 * 1000)
    .sort((a, b) => (b.avgBreakMs + b.avgBrbMs) - (a.avgBreakMs + a.avgBrbMs))
    .slice(0, 3);

  return (
    <div className="card p-5 border-[#ef4444]/20 bg-gradient-to-b from-[#ef4444]/[0.05] to-transparent shadow-[0_12px_40px_rgba(239,68,68,0.05)] backdrop-blur-md relative overflow-hidden group">
      
      {/* Glowing Top line */}
      <div className="absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-[#ef4444]/60 to-transparent pointer-events-none" />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/25 text-[#ef4444]">
            <AlertTriangle size={14} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ef4444] block">Lobby Campers</span>
        </div>
      </div>

      {violators.length === 0 ? (
        <div className="text-center py-6 relative z-10 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
            ✓
          </div>
          <div className="text-xs text-emerald-400 font-extrabold uppercase tracking-widest">No Violations</div>
        </div>
      ) : (
        <div className="space-y-2.5 relative z-10">
          {violators.map((row, i) => (
            <motion.div 
              key={row.user.id}
              whileHover={{ x: 2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.012] border border-white/[0.03] hover:bg-white/[0.025] hover:border-white/[0.06] transition-all duration-300 group/row"
              style={{
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.01)`
              }}
            >
              {/* Camper Icon Component */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500"
                  style={{
                    background: `linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.03) 100%)`,
                    border: `1.5px solid rgba(239,68,68,0.4)`,
                    boxShadow: `0 0 12px rgba(239,68,68,0.15)`,
                  }}
                >
                  {i === 0 ? (
                    <Flame size={15} style={{ color: '#ef4444', filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' }} />
                  ) : i === 1 ? (
                    <AlertTriangle size={15} style={{ color: '#ef4444', filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' }} />
                  ) : i === 2 ? (
                    <Hourglass size={15} style={{ color: '#ef4444', filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' }} />
                  ) : (
                    <AlertCircle size={15} style={{ color: '#ef4444', filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.5))' }} />
                  )}
                </div>
                {/* Rank badge overlay */}
                <div 
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow-md border"
                  style={{
                    background: `linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)`,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  {i + 1}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-extrabold text-white tracking-tight truncate group-hover/row:text-red-400 transition-colors">{row.user.name}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest truncate mt-0.5">{row.user.clientName}</div>
              </div>

              <div className="text-right">
                <span className="font-mono text-[13px] font-semibold tracking-tight text-[#ef4444] drop-shadow-[0_0_8px_rgba(239,68,68,0.25)]">
                  {formatMinutes(row.avgBreakMs + row.avgBrbMs)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
