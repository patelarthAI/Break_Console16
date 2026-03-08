'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Coffee, RotateCcw, Trophy, RefreshCw, Sparkles } from 'lucide-react';
import { get7DayBreakStats, UserBreakStats } from '@/lib/store';
import { formatDuration } from '@/lib/timeUtils';

// Thresholds
const BREAK_LIMIT_MS = 75 * 60 * 1000;  // 1h 15m
const BRB_LIMIT_MS = 10 * 60 * 1000;  // 10m
const DISC_LIMIT_MS = 70 * 60 * 1000; // 1h 10m
const MIN_DAYS = 3;    // must have been active at least 3 days

// Medal tier
function medal(rank: number): { icon: string; color: string; bg: string } {
    if (rank === 0) return { icon: '🥇', color: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/25' };
    if (rank === 1) return { icon: '🥈', color: 'text-slate-300', bg: 'bg-slate-500/10  border-slate-400/20' };
    if (rank === 2) return { icon: '🥉', color: 'text-amber-600', bg: 'bg-amber-800/10  border-amber-600/20' };
    return { icon: '⭐', color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/15' };
}

interface Props {
    clientFilter?: string[];
}

export default function StarPerformers({ clientFilter = [] }: Props) {
    const [stars, setStars] = useState<UserBreakStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function load(showSpinner = false) {
        if (showSpinner) setRefreshing(true);
        try {
            const data = await get7DayBreakStats();
            const performers = data
                .filter(s =>
                    s.daysChecked >= MIN_DAYS &&
                    s.breakViolDays === 0 &&
                    s.brbViolDays === 0 &&
                    s.lateInDays === 0 &&
                    s.earlyOutDays === 0 &&
                    (s.avgBreakMs + s.avgBrbMs) < DISC_LIMIT_MS &&
                    (clientFilter.length === 0 || clientFilter.includes(s.user.clientName))
                )
                .sort((a, b) => (a.avgBreakMs + a.avgBrbMs) - (b.avgBreakMs + b.avgBrbMs))
                .slice(0, 8); // top 8
            setStars(performers);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => { load(); }, [clientFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-yellow-400" />
                    <p className="text-xs font-black text-white tracking-tight">Discipline Board</p>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-full">
                        Last 5 Days
                    </span>
                </div>
                <button onClick={() => load(true)} disabled={refreshing}
                    className="p-1 rounded-md text-slate-600 hover:text-white transition-colors">
                    <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Criteria hint */}
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/[0.12]">
                <Sparkles size={10} className="text-emerald-400 flex-shrink-0" />
                <p className="text-[9px] text-slate-500 font-medium">
                    Strict Compliance · Total Break &lt; <span className="text-emerald-400 font-bold">1h 10m</span> avg · 0 violations
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-4 h-4 border-2 border-slate-800 border-t-yellow-500 rounded-full animate-spin" />
                </div>
            ) : stars.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-700">
                    <Trophy size={22} className="opacity-20" />
                    <p className="text-xs font-bold">Elite Status Pending</p>
                    <p className="text-[10px]">Require 3+ days of perfect compliance records.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <AnimatePresence initial={false}>
                        {stars.map((s, i) => {
                            const m = medal(i);
                            const totalBreakMs = s.avgBreakMs + s.avgBrbMs;
                            const totalPct = Math.min(100, (totalBreakMs / DISC_LIMIT_MS) * 100);
                            
                            return (
                                <motion.div key={s.user.id}
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={`relative group rounded-xl border px-3 py-3 flex items-center gap-4 transition-all duration-300 hover:scale-[1.02] ${m.bg}`}>
                                    
                                    <div className="absolute inset-0 bg-white/[0.01] group-hover:bg-white/[0.03] transition-colors pointer-events-none rounded-xl" />

                                    {/* Rank + Medal */}
                                    <div className="flex flex-col items-center justify-center flex-shrink-0 w-10 h-10 rounded-full bg-black/20 border border-white/5 shadow-inner">
                                        <span className="text-xl leading-none">{m.icon}</span>
                                    </div>

                                    {/* Name + Stats */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-black text-white truncate leading-none">{s.user.name}</p>
                                                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">{s.user.clientName}</p>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <p className="text-[13px] font-black tabular-nums text-emerald-400 leading-none">{formatDuration(totalBreakMs)}</p>
                                                <p className="text-[8px] font-bold text-slate-700 uppercase tracking-tighter mt-1">Total Break Avg</p>
                                            </div>
                                        </div>
                                        
                                        {/* Unified Progress Bar */}
                                        <div className="relative h-1.5 w-full rounded-full bg-black/40 border border-white/5 overflow-hidden">
                                            <div 
                                                className="h-full rounded-full bg-gradient-to-r from-emerald-500/40 via-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-1000"
                                                style={{ width: `${totalPct}%` }}
                                            />
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-1.5 px-0.5">
                                            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">{s.daysChecked}D Compliance</span>
                                            <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-tighter">Peak Performance</span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Footer count line */}
                    <div className="flex items-center gap-3 pt-2">
                        <div className="flex-1 h-px bg-white/5" />
                        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">
                            {stars.length} Elite Performers
                        </p>
                        <div className="flex-1 h-px bg-white/5" />
                    </div>
                </div>
            )}
        </div>
    );
}
