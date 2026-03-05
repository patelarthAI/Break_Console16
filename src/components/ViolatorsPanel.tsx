'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Coffee, RotateCcw, TrendingUp, ChevronDown, RefreshCw, ShieldAlert, Clock } from 'lucide-react';
import { get7DayBreakStats, UserBreakStats } from '@/lib/store';
import { formatDuration } from '@/lib/timeUtils';

const BREAK_LIMIT_MS = 75 * 60 * 1000;   // 1h 15m
const BRB_LIMIT_MS = 10 * 60 * 1000;   // 10m
const COMBINED_LIMIT_MS = 85 * 60 * 1000; // 1h 25m

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
    return (
        <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

function StatCell({ label, value, viol, color }: { label: string; value: string; viol: boolean; color: string }) {
    return (
        <div className={`flex flex-col gap-0.5 px-2.5 py-2 rounded-lg border ${viol ? 'border-rose-500/20 bg-rose-500/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">{label}</p>
            <p className={`text-sm font-black tabular-nums ${viol ? 'text-rose-400' : color}`}>{value}</p>
        </div>
    );
}

interface Props {
    clientFilter?: string[];
}

export default function ViolatorsPanel({ clientFilter = [] }: Props) {
    const [stats, setStats] = useState<UserBreakStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    async function load(showSpinner = false) {
        if (showSpinner) setRefreshing(true);
        try {
            const data = await get7DayBreakStats();
            const active = data
                .filter(s => s.daysChecked > 0 && s.combinedViolDays > 0)
                .filter(s => clientFilter.length === 0 || clientFilter.includes(s.user.clientName))
                .sort((a, b) => {
                    if (b.combinedViolDays !== a.combinedViolDays) return b.combinedViolDays - a.combinedViolDays;
                    const aExcess = Math.max(0, (a.avgBreakMs + a.avgBrbMs) - COMBINED_LIMIT_MS);
                    const bExcess = Math.max(0, (b.avgBreakMs + b.avgBrbMs) - COMBINED_LIMIT_MS);
                    return bExcess - aExcess;
                });
            setStats(active);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => { load(); }, [clientFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const maxBreak = Math.max(BREAK_LIMIT_MS * 1.5, ...stats.map(s => s.avgBreakMs));
    const maxBrb = Math.max(BRB_LIMIT_MS * 1.5, ...stats.map(s => s.avgBrbMs));

    if (loading) return (
        <div className="flex items-center justify-center py-10">
            <div className="w-4 h-4 border-2 border-slate-800 border-t-amber-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="flex flex-col gap-3">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-rose-400" />
                    <p className="text-xs font-black text-white tracking-tight">Break Violators</p>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-full">
                        Last 5 Days
                    </span>
                </div>
                <button
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="p-1 rounded-md text-slate-600 hover:text-white transition-colors"
                >
                    <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* ── Threshold pill ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-500/5 border border-rose-500/10 rounded-xl mb-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/[0.03] to-rose-500/0 animate-[shimmer_3s_infinite]" />
                <Clock size={12} className="text-rose-400 shrink-0" />
                <p className="text-[10px] text-slate-400 font-medium z-10">
                    Break + BRB total limit: <span className="font-bold text-rose-400">{formatDuration(COMBINED_LIMIT_MS)}/day</span>
                </p>
            </div>

            {/* ── List / Empty State ─────────────────────────────────────── */}
            {stats.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <TrendingUp size={24} className="text-emerald-500/40" />
                    <p className="text-xs text-slate-600 font-medium">No violations in the last 5 days</p>
                    <p className="text-[10px] text-slate-700">The team is crushing it 🎉</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <AnimatePresence initial={false}>
                        {stats.map((s, i) => {
                            const isExpanded = expanded === s.user.id;
                            const combinedAvg = s.avgBreakMs + s.avgBrbMs;
                            const anyViol = combinedAvg > COMBINED_LIMIT_MS;
                            const violDays = s.combinedViolDays;

                            return (
                                <motion.div
                                    key={s.user.id}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className={`rounded-xl border overflow-hidden transition-all ${anyViol
                                        ? 'border-rose-500/20 bg-rose-500/[0.04]'
                                        : 'border-amber-500/15 bg-amber-500/[0.03]'
                                        }`}
                                >
                                    {/* ── Collapsed row ───────────────────── */}
                                    <button
                                        className="w-full flex flex-col gap-2 px-3 py-2.5 text-left"
                                        onClick={() => setExpanded(isExpanded ? null : s.user.id)}
                                    >
                                        {/* TOP ROW: avatar + name + chevron */}
                                        <div className="flex items-center gap-2.5 w-full">
                                            {/* Avatar with viol-day badge */}
                                            <div className="relative flex-shrink-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${anyViol
                                                    ? 'bg-rose-500/15 text-rose-400'
                                                    : 'bg-amber-500/15 text-amber-400'
                                                    }`}>
                                                    {s.user.name[0].toUpperCase()}
                                                </div>
                                                {violDays > 0 && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[8px] font-black text-white">
                                                        {violDays}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Name + client — full width, no truncation */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold text-white leading-snug">
                                                    {s.user.name}
                                                </p>
                                                <span className="text-[9px] text-slate-500 font-medium leading-none">
                                                    {s.user.clientName}
                                                </span>
                                            </div>

                                            {/* Chevron */}
                                            <ChevronDown
                                                size={12}
                                                className={`text-slate-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                                            />
                                        </div>

                                        {/* BOTTOM ROW: Total Avg */}
                                        <div className="flex items-center gap-3 w-full pl-[2.625rem]">
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                                                <Clock size={10} className="text-rose-400 flex-shrink-0" />
                                                <span className="text-[11px] font-black tabular-nums text-rose-400 tracking-wide">
                                                    {formatDuration(combinedAvg)} <span className="text-[9px] opacity-70 uppercase">Avg</span>
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1 flex-1">
                                                <MiniBar value={combinedAvg} max={COMBINED_LIMIT_MS * 1.5} color="bg-rose-500" />
                                            </div>
                                        </div>
                                    </button>

                                    {/* ── Expanded detail ─────────────────── */}
                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-3 pb-3 pt-2 border-t border-white/[0.05] space-y-3">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <StatCell label="Avg Break/Day" value={formatDuration(s.avgBreakMs)} viol={false} color="text-amber-400" />
                                                        <StatCell label="Avg BRB/Day" value={formatDuration(s.avgBrbMs)} viol={false} color="text-blue-400" />
                                                        <StatCell label="Total Avg/Day" value={formatDuration(combinedAvg)} viol={anyViol} color={anyViol ? 'text-rose-400' : 'text-emerald-400'} />
                                                        <StatCell label="Violated Days" value={`${s.combinedViolDays} / ${s.daysChecked}`} viol={s.combinedViolDays > 0} color="text-slate-300" />
                                                    </div>

                                                    {anyViol && (
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-md">
                                                            <AlertTriangle size={9} /> Total Limit Exceeded
                                                        </span>
                                                    )}

                                                    <p className="text-[9px] text-slate-700">
                                                        Active {s.daysChecked}/5 days {'·'} Total break: {formatDuration(s.totalBreakMs)} {'·'} Total BRB: {formatDuration(s.totalBrbMs)}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}