'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RefreshCw, Sparkles } from 'lucide-react';
import { get7DayBreakStats, UserBreakStats } from '@/lib/store';
import { formatDuration } from '@/lib/timeUtils';

// Constants
const DISC_LIMIT_MS = 70 * 60 * 1000; // 1h 10m
const MIN_DAYS = 1; // Lowered for the fresh start week

interface Props { clientFilter?: string[]; }

const RANK_COLORS: Record<number, string> = {
    0: 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]',   // Diamond/Rank 1
    1: 'text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]', // Platinum/Rank 2
    2: 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]',   // Gold/Rank 3
};

const DEFAULT_COLOR = 'text-slate-500';

export default function StarPerformers({ clientFilter = [] }: Props) {
    const [stars, setStars] = useState<UserBreakStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function load(showSpinner = false) {
        if (showSpinner) setRefreshing(true);
        try {
            const data = await get7DayBreakStats();
            // Filter: 1+ days (since it's Monday), no violations, low break time
            const performers = data
                .filter(s =>
                    s.daysChecked >= MIN_DAYS &&
                    s.breakViolDays === 0 &&
                    s.brbViolDays === 0 &&
                    s.lateInDays === 0 &&
                    s.earlyOutDays === 0 &&
                    (s.avgBreakMs + s.avgBrbMs) < DISC_LIMIT_MS
                )
                .sort((a, b) => (a.avgBreakMs + a.avgBrbMs) - (b.avgBreakMs + b.avgBrbMs))
                .slice(0, 10);
            setStars(performers);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => { load(); }, []);

    return (
        <div className="flex flex-col gap-3">
            {/* Compact Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                    <Trophy size={16} className="text-amber-400" />
                    <div>
                        <h2 className="text-[13px] font-black text-white uppercase tracking-wider leading-none">Elite Hall of Fame</h2>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60">Global Ranking • Weekly Race</p>
                    </div>
                </div>
                <button onClick={() => load(true)} disabled={refreshing} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5 transition-colors">
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-4 h-4 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin" />
                </div>
            ) : stars.length === 0 ? (
                <div className="py-8 bg-white/[0.02] border border-dashed border-white/5 rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Fresh start for the week. Join the ranks!</p>
                </div>
            ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                    <AnimatePresence mode="popLayout">
                        {stars.map((s, i) => (
                            <motion.div key={s.user.id}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group">
                                
                                <Trophy size={14} className={`${RANK_COLORS[i] || DEFAULT_COLOR} flex-shrink-0`} />
                                
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-white/90 truncate tracking-tight group-hover:text-white transition-colors">{s.user.name}</p>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 opacity-60">{s.user.clientName}</p>
                                </div>

                                <div className="text-right">
                                    <p className="text-[11px] font-black text-emerald-400 tabular-nums tracking-tighter">{formatDuration(s.avgBreakMs + s.avgBrbMs)}</p>
                                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest leading-none mt-0.5">Avg Break</p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
