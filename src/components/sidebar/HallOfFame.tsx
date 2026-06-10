'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Trophy, Medal } from 'lucide-react';
import type { UserBreakStats } from '@/lib/store';

function formatMinutes(ms: number) {
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

interface HallOfFameProps {
  stats: UserBreakStats[];
}

export default function HallOfFame({ stats }: HallOfFameProps) {
  const ranked = stats
    .filter((r) => r.daysChecked > 0 && r.user.workMode === 'WFO')
    .sort((a, b) => (a.avgBreakMs + a.avgBrbMs) - (b.avgBreakMs + b.avgBrbMs))
    .slice(0, 3);

  // Gold, Silver, Bronze theme definitions
  const rankColors = [
    { light: '#fbbf24', dark: '#d97706', glow: 'rgba(251,191,36,0.3)' }, // 1st: Gold
    { light: '#e2e8f0', dark: '#94a3b8', glow: 'rgba(226,232,240,0.3)' }, // 2nd: Silver
    { light: '#f97316', dark: '#c2410c', glow: 'rgba(249,115,22,0.2)' },  // 3rd: Bronze
  ];

  return (
    <div className="card p-5 border-[#f59e0b]/20 bg-gradient-to-b from-[#f59e0b]/[0.05] to-transparent shadow-[0_12px_40px_rgba(245,158,11,0.05)] backdrop-blur-md relative overflow-hidden group">
      
      {/* Glowing Top line */}
      <div className="absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-[#f59e0b]/60 to-transparent pointer-events-none" />

      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/25 text-[#f59e0b]">
            <Trophy size={14} />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f59e0b] block">Aura Maxers</span>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 block">WFO Roster Rankings</span>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[9px] font-bold text-[#f59e0b] tracking-wider shadow-[0_0_8px_rgba(245,158,11,0.2)]">WEEKLY</span>
      </div>

      {ranked.length === 0 ? (
        <div className="text-center py-6 relative z-10">
          <div className="text-2xl mb-2 opacity-50">🏆</div>
          <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">Rankings resetting</div>
          <div className="text-[10px] text-slate-600 mt-1">First activity claims top spot</div>
        </div>
      ) : (
        <div className="space-y-2.5 relative z-10">
          {ranked.map((row, i) => {
            const colors = rankColors[i] || rankColors[2];
            return (
              <motion.div 
                key={row.user.id} 
                whileHover={{ x: 2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.012] border border-white/[0.03] hover:bg-white/[0.025] hover:border-white/[0.06] transition-all duration-300 group/row"
                style={{
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.01)`
                }}
              >
                {/* Ranked Icon Component */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500"
                    style={{
                      background: `linear-gradient(135deg, ${colors.light}22 0%, ${colors.light}05 100%)`,
                      border: `1.5px solid ${colors.light}55`,
                      boxShadow: `0 0 12px ${colors.glow}`,
                    }}
                  >
                    {i === 0 ? (
                      <Crown size={15} style={{ color: colors.light, filter: `drop-shadow(0 0 4px ${colors.light}80)` }} />
                    ) : i === 1 ? (
                      <Trophy size={15} style={{ color: colors.light, filter: `drop-shadow(0 0 4px ${colors.light}80)` }} />
                    ) : (
                      <Medal size={15} style={{ color: colors.light, filter: `drop-shadow(0 0 4px ${colors.light}80)` }} />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold text-white tracking-tight truncate group-hover/row:text-[#fbbf24] transition-colors">{row.user.name}</div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest truncate mt-0.5">{row.user.clientName}</div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-[13px] font-semibold tracking-tight text-[#f59e0b] drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]">
                    {formatMinutes(row.avgBreakMs + row.avgBrbMs)}
                  </span>
                  <div className="text-[8px] text-[#f59e0b]/50 uppercase tracking-widest font-bold mt-0.5">AVG</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
