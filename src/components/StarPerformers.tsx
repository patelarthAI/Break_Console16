'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, Medal, RefreshCw, Flame, Zap } from 'lucide-react';
import { getWeeklyBreakStats, WeeklyBreakStats } from '@/lib/store';
import { formatDuration } from '@/lib/timeUtils';

// ── Rank Config ──────────────────────────────────────────────────────────────
const RANKS = [
    {
        trophy: Crown,
        label: '1st',
        ringColor: 'ring-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.4)]',
        avatarBg: 'bg-gradient-to-br from-amber-400/25 to-amber-600/15 text-amber-300',
        numColor: 'text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]',
        trophyColor: 'text-amber-400',
        rowBg: 'bg-gradient-to-r from-amber-500/[0.06] via-transparent to-transparent border-amber-500/15',
        glowLine: 'from-amber-500/40 via-amber-500/10 to-transparent',
    },
    {
        trophy: Medal,
        label: '2nd',
        ringColor: 'ring-slate-300/40 shadow-[0_0_14px_rgba(203,213,225,0.25)]',
        avatarBg: 'bg-gradient-to-br from-slate-300/20 to-slate-500/10 text-slate-300',
        numColor: 'text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.5)]',
        trophyColor: 'text-slate-300',
        rowBg: 'bg-gradient-to-r from-slate-400/[0.04] via-transparent to-transparent border-white/[0.06]',
        glowLine: 'from-slate-400/30 via-slate-400/5 to-transparent',
    },
    {
        trophy: Medal,
        label: '3rd',
        ringColor: 'ring-orange-400/40 shadow-[0_0_14px_rgba(251,146,60,0.25)]',
        avatarBg: 'bg-gradient-to-br from-orange-400/20 to-orange-600/10 text-orange-300',
        numColor: 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]',
        trophyColor: 'text-orange-400',
        rowBg: 'bg-gradient-to-r from-orange-500/[0.04] via-transparent to-transparent border-white/[0.06]',
        glowLine: 'from-orange-400/25 via-orange-400/5 to-transparent',
    },
];

interface Props {
    clientName?: string;
}

export default function StarPerformers({ clientName }: Props) {
    const [stars, setStars] = useState<WeeklyBreakStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isLastWeek, setIsLastWeek] = useState(false);

    async function load(showSpinner = false) {
        if (showSpinner) setRefreshing(true);
        try {
            const data = await getWeeklyBreakStats(clientName, showSpinner);
            // Aura Maxxers criteria:
            // 1. WFO only
            // 2. Logged in every elapsed weekday (daysChecked === expectedDays)
            // 3. No late in, no early out
            // 4. No break/BRB violations
            // 5. Sort by lowest avg total break (BRK + BRB)
            // 6. Top 3 only
            const performers = data
                .filter(s =>
                    s.user.workMode === 'WFO' &&
                    s.daysChecked >= 1 &&
                    s.daysChecked === s.expectedDays &&
                    s.lateInDays === 0 &&
                    s.earlyOutDays === 0 &&
                    s.breakViolDays === 0 &&
                    s.brbViolDays === 0
                )
                .sort((a, b) => (a.avgBreakMs + a.avgBrbMs) - (b.avgBreakMs + b.avgBrbMs))
                .slice(0, 3);
            setStars(performers);
            setIsLastWeek(data[0]?.isLastWeek ?? false);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        load();
        const id = window.setInterval(() => { void load(); }, 5 * 60 * 1000);
        return () => window.clearInterval(id);
    }, [clientName]);

    return (
        <div className="flex flex-col gap-3">
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <Flame size={18} className="text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
                        <Zap size={8} className="absolute -top-0.5 -right-0.5 text-cyan-400 animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-[13px] font-black text-white uppercase tracking-wider leading-none">Aura Maxxers</h2>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60">
                            {isLastWeek ? 'Last Week' : 'This Week'} • Weekly Race
                        </p>
                    </div>
                </div>
                <button onClick={() => load(true)} disabled={refreshing} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5 transition-colors">
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* ── Content ────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-4 h-4 border-2 border-slate-800 border-t-amber-500 rounded-full animate-spin" />
                </div>
            ) : stars.length === 0 ? (
                <div className="py-8 bg-white/[0.02] border border-dashed border-white/5 rounded-2xl text-center">
                    <Trophy size={20} className="mx-auto text-amber-500/30 mb-2" />
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        {isLastWeek ? 'No champions crowned last week' : 'Fresh start for the week. Earn your spot!'}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                        {stars.map((s, i) => {
                            const rank = RANKS[i];
                            const TrophyIcon = rank.trophy;
                            const combinedAvg = s.avgBreakMs + s.avgBrbMs;

                            return (
                                <motion.div
                                    key={s.user.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
                                    className={`relative flex items-center gap-3 px-3 py-3 rounded-xl border overflow-hidden transition-all hover:scale-[1.01] ${rank.rowBg}`}
                                >
                                    {/* Glow line at top */}
                                    <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r ${rank.glowLine}`} />

                                    {/* Rank Number + Trophy */}
                                    <div className="flex flex-col items-center gap-0.5 w-8 flex-shrink-0">
                                        <TrophyIcon size={i === 0 ? 16 : 14} className={rank.trophyColor} />
                                        <span className={`text-lg font-black tabular-nums ${rank.numColor}`}>{i + 1}</span>
                                    </div>

                                    {/* Name + Client */}
                                    <div className="flex-1">
                                        <p className="text-[13px] font-bold text-white/90 tracking-tight whitespace-normal">{s.user.name}</p>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 opacity-60 whitespace-normal">{s.user.clientName}</p>
                                    </div>

                                    {/* Avg Break */}
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-[12px] font-black text-emerald-400 tabular-nums tracking-tight">{formatDuration(combinedAvg)}</p>
                                        <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest leading-none mt-0.5">Avg Break</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Days tracked info */}
                    <p className="text-[8px] text-slate-700 text-center mt-1 uppercase tracking-widest">
                        {stars[0]?.expectedDays ?? 0}/5 days tracked • {isLastWeek ? 'Last week results' : 'Updates daily'}
                    </p>
                </div>
            )}
        </div>
    );
}
