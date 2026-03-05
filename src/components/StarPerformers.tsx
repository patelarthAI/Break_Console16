'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Coffee, RotateCcw, Trophy, RefreshCw, Sparkles } from 'lucide-react';
import { get7DayBreakStats, UserBreakStats } from '@/lib/store';
import { formatDuration } from '@/lib/timeUtils';

// Thresholds
const BREAK_LIMIT_MS = 75 * 60 * 1000;  // 1h 15m
const BRB_LIMIT_MS = 10 * 60 * 1000;  // 10m
const BREAK_GOOD_PCT = 0.80; // avg break < 80% of limit = genuinely disciplined
const MIN_DAYS = 3;    // must have been active at least 3 days

// Compute a star score: lower avg break/BRB + more clean days = higher score
function starScore(s: UserBreakStats): number {
    const breakPct = s.avgBreakMs / BREAK_LIMIT_MS;   // 0–1
    const brbPct = s.avgBrbMs / BRB_LIMIT_MS;     // 0–1
    const dayBonus = s.daysChecked / 5;
    return dayBonus - (breakPct * 0.5 + brbPct * 0.3);
}

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
                    s.avgBreakMs < BREAK_LIMIT_MS * BREAK_GOOD_PCT &&
                    (clientFilter.length === 0 || clientFilter.includes(s.user.clientName))
                )
                .sort((a, b) => starScore(b) - starScore(a))
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
                    On time · Break &lt; <span className="text-emerald-400 font-bold">1h</span> avg · BRB &lt; <span className="text-emerald-400 font-bold">8m</span> avg · 0 violations
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-4 h-4 border-2 border-slate-800 border-t-yellow-500 rounded-full animate-spin" />
                </div>
            ) : stars.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Trophy size={22} className="text-slate-700" />
                    <p className="text-xs text-slate-600 font-medium">Not enough data yet</p>
                    <p className="text-[10px] text-slate-700">Check back after 3+ work days of clean records</p>
                </div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    <AnimatePresence initial={false}>
                        {stars.map((s, i) => {
                            const m = medal(i);
                            const breakPct = Math.min(100, (s.avgBreakMs / BREAK_LIMIT_MS) * 100);
                            const brbPct = Math.min(100, (s.avgBrbMs / BRB_LIMIT_MS) * 100);
                            return (
                                <motion.div key={s.user.id}
                                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${m.bg}`}>

                                    {/* Rank + avatar */}
                                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-7">
                                        <span className="text-base leading-none">{m.icon}</span>
                                        <span className={`text-[8px] font-black ${m.color}`}>#{i + 1}</span>
                                    </div>

                                    {/* Name + client + mini bars */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col">
                                            <p className="text-[13px] font-bold text-white leading-snug">{s.user.name}</p>
                                            <span className="text-[9px] text-slate-500 font-medium leading-none">{s.user.clientName}</span>
                                        </div>
                                        {/* Utilisation bars */}
                                        <div className="flex flex-col gap-0.5 mt-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <Coffee size={7} className="text-emerald-500/60 flex-shrink-0" />
                                                <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                                                    <div className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
                                                        style={{ width: `${breakPct}%` }} />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <RotateCcw size={7} className="text-sky-500/60 flex-shrink-0" />
                                                <div className="flex-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                                                    <div className="h-full rounded-full bg-sky-500/60 transition-all duration-500"
                                                        style={{ width: `${brbPct}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Avg stats */}
                                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        <div className="flex items-center gap-1">
                                            <Coffee size={8} className="text-emerald-400/70" />
                                            <span className="text-[10px] font-bold tabular-nums text-emerald-400">
                                                {formatDuration(s.avgBreakMs)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <RotateCcw size={8} className="text-sky-400/70" />
                                            <span className="text-[10px] font-bold tabular-nums text-sky-400">
                                                {formatDuration(s.avgBrbMs)}
                                            </span>
                                        </div>
                                        <span className="text-[8px] text-slate-600 mt-0.5">
                                            {s.daysChecked}d clean
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Footer count line */}
                    <p className="text-[9px] text-slate-700 text-center pt-1">
                        {stars.length} recruiter{stars.length !== 1 ? 's' : ''} with perfect 5-day records
                    </p>
                </div>
            )}
        </div>
    );
}
