'use client';
import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Star, ShieldCheck, Sparkles, Crown, Zap, UserX, TrendingUp, Info } from 'lucide-react';
import { formatMs } from '@/lib/timeUtils';
import { getWeeklyBreakStats, WeeklyBreakStats, UserStatusRecord } from '@/lib/store';

// ─── Neural Dark Quote Matrix ──────────────────────────────────────────────────
const ANALYTICS_QUOTES = [
    "Efficiency is the silent architect of victory.",
    "Data is the pulse of operational excellence.",
    "Precision is not an act, but a standard.",
    "The rhythm of the unit depends on the discipline of the individual.",
];

interface Props {
    currentUserId: string;
    teamStatus: UserStatusRecord[];
}

export default function EliteRankings({ currentUserId }: Props) {
    const [weeklyStats, setWeeklyStats] = useState<WeeklyBreakStats[]>([]);
    const [quoteIdx] = useState(() => Math.floor(Math.random() * ANALYTICS_QUOTES.length));

    useEffect(() => {
        getWeeklyBreakStats().then(setWeeklyStats);
    }, []);

    const BREAK_THRESHOLD_MS = 85 * 60 * 1000; // 1 hour 25 minutes

    // ── 🏆 Section 1: Aura Leaders (Top Compliance) ──
    const auraLeaders = useMemo(() => {
        if (!Array.isArray(weeklyStats)) return [];
        return [...weeklyStats]
            .filter(s => 
                s.user.workMode !== 'WFH' &&
                s.lateInDays === 0 && 
                s.daysChecked > 0 &&
                (s.totalBreakMs + s.totalBrbMs) / s.daysChecked <= BREAK_THRESHOLD_MS
            )
            .sort((a, b) => {
                const avgA = (a.totalBreakMs + a.totalBrbMs) / a.daysChecked;
                const avgB = (b.totalBreakMs + b.totalBrbMs) / b.daysChecked;
                return avgA - avgB;
            })
            .slice(0, 5);
    }, [weeklyStats]);

    // ── 🏕 Section 2: Lobby Campers (High Breaks) ──
    const lobbyCampers = useMemo(() => {
        if (!Array.isArray(weeklyStats)) return [];
        return [...weeklyStats]
            .filter(s => 
                s.daysChecked > 0 &&
                (s.totalBreakMs + s.totalBrbMs) / s.daysChecked > BREAK_THRESHOLD_MS
            )
            .sort((a, b) => {
                const avgA = (a.totalBreakMs + a.totalBrbMs) / a.daysChecked;
                const avgB = (b.totalBreakMs + b.totalBrbMs) / b.daysChecked;
                return avgB - avgA;
            })
            .slice(0, 5);
    }, [weeklyStats]);

    return (
        <div className="flex flex-col gap-10">
            {/* ── 🏆 Section 1: Aura Leaders ── */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--amber)]/10 border border-[var(--amber)]/20 shadow-[0_0_20px_-5px_var(--amber-glow)]">
                            <Crown size={14} className="text-[var(--amber)]" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">ELITE UNITS</h3>
                            <span className="text-[8px] font-medium text-[var(--amber)]/50 uppercase tracking-[0.1em]">TOP COMPLIANCE</span>
                        </div>
                    </div>
                    <div className="h-px w-24 bg-gradient-to-r from-[var(--amber)]/20 to-transparent" />
                </div>

                <div className="grid gap-3">
                    {auraLeaders.map((m, i) => {
                        const avgBreak = (m.totalBreakMs + m.totalBrbMs) / m.daysChecked;
                        const isMe = m.user.id === currentUserId;
                        
                        return (
                            <motion.div 
                                key={m.user.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className={`relative group p-4 rounded-[var(--r-lg)] border overflow-hidden transition-all duration-500 ${
                                    isMe 
                                        ? 'bg-[var(--amber)]/10 border-[var(--amber)]/30 shadow-[0_0_30px_-10px_var(--amber-glow)]' 
                                        : 'bg-[var(--bg-raised)] border-[var(--border)] hover:border-white/20 hover:bg-[var(--bg-overlay)]'
                                }`}
                            >
                                {/* Background Aura */}
                                <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full -mr-16 -mt-16 transition-opacity duration-500 ${
                                    i === 0 ? 'bg-[var(--amber)]/10 opacity-100' : 'bg-white/5 opacity-0 group-hover:opacity-100'
                                }`} />

                                <div className="relative z-10 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-transform duration-500 group-hover:scale-110 ${
                                                i === 0 ? 'bg-[var(--amber)]/20 border-[var(--amber)]/40 text-[var(--amber)]' : 'bg-white/5 border-white/10 text-white/40'
                                            }`}>
                                                {i === 0 ? <Crown size={16} /> : <span className="text-xs font-black">#{i + 1}</span>}
                                            </div>
                                            {i < 3 && (
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center">
                                                    <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-[var(--amber)]' : i === 1 ? 'bg-slate-300' : 'bg-amber-700'} shadow-[0_0_5px_currentColor]`} />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-black text-white tracking-tight leading-none mb-1.5 group-hover:text-[var(--amber)] transition-colors">
                                                {m.user.name}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.1em]">{m.user.clientName}</span>
                                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                                <div className="flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                                                    <Sparkles size={8} /> PURE
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[14px] font-black font-mono text-white group-hover:text-[var(--amber)] transition-colors tabular-nums">
                                            {formatMs(avgBreak).slice(0, 5)}
                                        </div>
                                        <div className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">AVG / DAY</div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}

                    {auraLeaders.length === 0 && (
                        <div className="py-12 text-center rounded-[var(--r-lg)] bg-[var(--bg-raised)] border border-dashed border-white/5">
                            <UserX size={24} className="mx-auto mb-4 text-white/5" />
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Compliance Void Detected</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── 🏕 Section 2: Lobby Campers ── */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--rose)]/10 border border-[var(--rose)]/20 shadow-[0_0_20px_-5px_var(--rose-glow)]">
                            <Zap size={14} className="text-[var(--rose)]" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">LATENCY OPS</h3>
                            <span className="text-[8px] font-medium text-[var(--rose)]/50 uppercase tracking-[0.1em]">THRESHOLD EXCEEDED</span>
                        </div>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--rose)]/20 to-transparent ml-4" />
                </div>

                <div className="grid gap-2">
                    {lobbyCampers.length > 0 ? (
                        lobbyCampers.map((m, i) => {
                            const avgBreak = (m.totalBreakMs + m.totalBrbMs) / m.daysChecked;
                            const isMe = m.user.id === currentUserId;
                            
                            return (
                                <motion.div 
                                    key={m.user.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    className={`flex items-center justify-between p-3.5 px-4 rounded-[var(--r-md)] border transition-all duration-300 group ${
                                        isMe 
                                            ? 'bg-[var(--rose)]/10 border-[var(--rose)]/30' 
                                            : 'bg-[var(--bg-raised)] border-white/[0.03] hover:bg-[var(--bg-overlay)] hover:border-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:border-[var(--rose)]/30 transition-colors">
                                            <span className="text-[10px] font-black text-white/30 group-hover:text-[var(--rose)]">{m.user.name[0]}</span>
                                        </div>
                                        <div className="truncate">
                                            <div className="text-[12px] font-black text-white/80 group-hover:text-white transition-colors truncate">{m.user.name}</div>
                                            <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">{m.user.clientName}</div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[13px] font-black font-mono text-[var(--rose)]/80 group-hover:text-[var(--rose)] transition-colors tabular-nums">
                                            {formatMs(avgBreak).slice(0, 5)}
                                        </div>
                                        <div className="text-[8px] font-black text-[var(--rose)]/30 uppercase tracking-tighter">SURPLUS</div>
                                    </div>
                                </motion.div>
                            );
                        })
                    ) : (
                        <div className="py-10 text-center rounded-[var(--r-lg)] bg-emerald-500/[0.02] border border-emerald-500/10">
                            <div className="flex items-center justify-center gap-2 text-emerald-400">
                                <Sparkles size={12} />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">All Units Operational</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Neural Motivation Module */}
            <div className="p-5 rounded-[var(--r-lg)] bg-[var(--bg-raised)] border border-[var(--border)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <Info size={12} className="text-white/20" />
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">System Insight</span>
                    </div>
                    <p className="text-[11px] text-white/50 font-medium italic leading-relaxed">
                        &ldquo;{ANALYTICS_QUOTES[quoteIdx]}&rdquo;
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                        <span className="text-[7px] font-black text-white/5 uppercase tracking-[0.4em]">Neural Intelligence Console</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
