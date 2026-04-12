'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tent, AlertTriangle, RefreshCw, Skull, TrendingUp, Clock } from 'lucide-react';
import { getWeeklyBreakStats, WeeklyBreakStats } from '@/lib/store';
import { formatDuration } from '@/lib/timeUtils';

const COMBINED_LIMIT_MS = 85 * 60 * 1000; // 1h 25m

// ── Rank Config (matching Aura Maxxers structure but danger-themed) ──────────
const RANKS = [
    {
        icon: Skull,
        label: '1st',
        ringColor: 'ring-rose-400/60 shadow-[0_0_20px_rgba(244,63,94,0.4)]',
        avatarBg: 'bg-gradient-to-br from-rose-400/25 to-rose-600/15 text-rose-300',
        numColor: 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]',
        iconColor: 'text-rose-400',
        rowBg: 'bg-gradient-to-r from-rose-500/[0.06] via-transparent to-transparent border-rose-500/15',
        glowLine: 'from-rose-500/40 via-rose-500/10 to-transparent',
        timeColor: 'text-rose-400',
    },
    {
        icon: AlertTriangle,
        label: '2nd',
        ringColor: 'ring-orange-400/40 shadow-[0_0_14px_rgba(251,146,60,0.25)]',
        avatarBg: 'bg-gradient-to-br from-orange-400/20 to-orange-600/10 text-orange-300',
        numColor: 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]',
        iconColor: 'text-orange-400',
        rowBg: 'bg-gradient-to-r from-orange-500/[0.04] via-transparent to-transparent border-orange-500/10',
        glowLine: 'from-orange-400/30 via-orange-400/5 to-transparent',
        timeColor: 'text-orange-400',
    },
    {
        icon: AlertTriangle,
        label: '3rd',
        ringColor: 'ring-amber-400/40 shadow-[0_0_14px_rgba(251,191,36,0.2)]',
        avatarBg: 'bg-gradient-to-br from-amber-400/15 to-amber-600/10 text-amber-300',
        numColor: 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]',
        iconColor: 'text-amber-400',
        rowBg: 'bg-gradient-to-r from-amber-500/[0.03] via-transparent to-transparent border-amber-500/10',
        glowLine: 'from-amber-400/25 via-amber-400/5 to-transparent',
        timeColor: 'text-amber-400',
    },
];

interface Props {
    clientName?: string;
}

export default function ViolatorsPanel({ clientName }: Props) {
    const [campers, setCampers] = useState<WeeklyBreakStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isLastWeek, setIsLastWeek] = useState(false);

    async function load(showSpinner = false) {
        if (showSpinner) setRefreshing(true);
        try {
            const data = await getWeeklyBreakStats(clientName, showSpinner);
            // Lobby Campers criteria:
            // 1. At least 1 day of data
            // 2. Avg combined Break + BRB exceeds COMBINED_LIMIT
            // 3. No absent-day removal (avg from days they logged in)
            // 4. No client filter — global
            // 5. Sort by worst offender first
            // 6. Top 3 only
            const violators = data
                .filter(s => s.daysChecked >= 1 && s.user.workMode === 'WFO' && (s.avgBreakMs + s.avgBrbMs) > COMBINED_LIMIT_MS)
                .sort((a, b) => (b.avgBreakMs + b.avgBrbMs) - (a.avgBreakMs + a.avgBrbMs))
                .slice(0, 3);
            setCampers(violators);
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
                        <Tent size={18} className="text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.6)]" />
                    </div>
                    <div>
                        <h2 className="text-[13px] font-black text-white uppercase tracking-wider leading-none">Lobby Campers</h2>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60">
                            {isLastWeek ? 'Last Week' : 'This Week'} • Break Limit: {formatDuration(COMBINED_LIMIT_MS)}/day
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
                    <div className="w-4 h-4 border-2 border-slate-800 border-t-rose-500 rounded-full animate-spin" />
                </div>
            ) : campers.length === 0 ? (
                <div className="py-8 bg-white/[0.02] border border-dashed border-white/5 rounded-2xl text-center">
                    <TrendingUp size={20} className="mx-auto text-emerald-500/30 mb-2" />
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        No violations this week. The team is crushing it! 🎉
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                        {campers.map((s, i) => {
                            const rank = RANKS[i];
                            const RankIcon = rank.icon;
                            const combinedAvg = s.avgBreakMs + s.avgBrbMs;
                            const excessMs = combinedAvg - COMBINED_LIMIT_MS;

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

                                    {/* Rank Number + Icon */}
                                    <div className="flex flex-col items-center gap-0.5 w-8 flex-shrink-0">
                                        <RankIcon size={i === 0 ? 16 : 14} className={rank.iconColor} />
                                        <span className={`text-lg font-black tabular-nums ${rank.numColor}`}>{i + 1}</span>
                                    </div>

                                    {/* Name + Client */}
                                    <div className="flex-1">
                                        <p className="text-[13px] font-bold text-white/90 tracking-tight whitespace-normal">{s.user.name}</p>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 opacity-60 whitespace-normal">{s.user.clientName}</p>
                                    </div>

                                    {/* Avg Break + Excess */}
                                    <div className="text-right flex-shrink-0">
                                        <p className={`text-[12px] font-black tabular-nums tracking-tight ${rank.timeColor}`}>{formatDuration(combinedAvg)}</p>
                                        <p className="text-[7px] font-black text-rose-500/80 uppercase tracking-widest leading-none mt-0.5">
                                            +{Math.round(excessMs / 60000)}m over
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Days tracked info */}
                    <p className="text-[8px] text-slate-700 text-center mt-1 uppercase tracking-widest">
                        {isLastWeek ? 'Last week results' : 'Updates daily'} • Limit: {formatDuration(COMBINED_LIMIT_MS)}/day
                    </p>
                </div>
            )}
        </div>
    );
}
