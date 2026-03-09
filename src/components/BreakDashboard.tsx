'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, RotateCcw, Users, Clock, Sparkles } from 'lucide-react';
import { getAllUsersStatus, UserStatusRecord, getLeaves } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/timeUtils';
import StarPerformers from './StarPerformers';
import { MonthlyLeaveCalendar } from './MasterConsole';
import { LeaveRecord } from '@/types';

function LiveTimer({ since, alertThresholdMs }: { since: number, alertThresholdMs?: number }) {
    const [e, setE] = useState(() => Date.now() - since);
    useEffect(() => {
        const id = setInterval(() => setE(Date.now() - since), 1000);
        return () => clearInterval(id);
    }, [since]);
    const isAlert = alertThresholdMs && e > alertThresholdMs;
    return <span className={`font-mono tabular-nums transition-colors duration-500 ${isAlert ? 'text-red-400 font-extrabold animate-pulse drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]' : ''}`}>{formatDuration(e)}</span>;
}

interface Props { currentUserId: string; isMaster: boolean; clientName?: string; }

const QUOTES = [
    "Great work everyone – all systems go! 🚀",
    "The whole team is locked in. Keep crushing it! 💪",
    "100% productivity mode. Absolutely legendary! ⚡",
    "Everyone is focused and on track. Love to see it! 🔥",
    "No distractions, pure momentum. That's our team! 🎯",
    "Every recruiter is working. That's winning energy! 🏆",
];

const STRETCH_QUOTES = [
    "You're on fire! Remember to hydrate and stretch those legs.",
    "Unstoppable momentum! 🌟 Take a quick 5 to rest your eyes.",
    "Incredible focus! But even champions need to hydrate. 💧",
    "You've been crushing it for hours. Your health matters too! 🧘",
    "Elite productivity! Give your eyes a 20-second screen break. 👀",
];

export default function BreakDashboard({ currentUserId, isMaster, clientName }: Props) {
    const [records, setRecords] = useState<UserStatusRecord[]>([]);
    const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);
    const [quoteIdx, setQuoteIdx] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 6000);
        return () => clearInterval(id);
    }, []);

    const refresh = useCallback(async () => {
        const [data, leavesData] = await Promise.all([
            getAllUsersStatus(),
            getLeaves()
        ]);
        if (!mountedRef.current) return;
        // For regular users, filter to only same client
        const filtered = isMaster ? data : data.filter(r => r.user.clientName === clientName);
        setRecords(filtered.filter(r => r.user.id !== currentUserId));
        setLeaves(leavesData);
        setLoading(false);
    }, [isMaster, clientName, currentUserId]);

    useEffect(() => {
        mountedRef.current = true;
        refresh();
        const channel = supabase
            .channel(`team_status_${currentUserId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'time_logs' }, refresh)
            .subscribe();
        return () => { mountedRef.current = false; channel.unsubscribe(); };
    }, [refresh, currentUserId]);

    const onBreak = records.filter(r => r.status === 'on_break');
    const onBrb = records.filter(r => r.status === 'on_brb');
    const working = records.filter(r => r.status === 'working');
    const now = Date.now();
    // Use the 6-second render cycle from quoteIdx to keep this live updated
    const needsStretch = working.filter(r => r.workStart && (now - r.workStart > 180 * 60 * 1000));

    function Avatar({ name, status }: { name: string; status: string }) {
        const colors: Record<string, string> = {
            working: 'from-emerald-600/40 to-emerald-900/40 text-emerald-300 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
            on_break: 'from-amber-600/40 to-amber-900/40 text-amber-300 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
            on_brb: 'from-violet-600/40 to-violet-900/40 text-violet-300 border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.2)]',
            punched_out: 'from-rose-600/20 to-rose-900/20 text-rose-300 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]',
            idle: 'from-slate-800 to-slate-900 text-slate-400 border-slate-700/50',
        };
        return (
            <div className={`w-11 h-11 rounded-[1.1rem] flex items-center justify-center text-[18px] font-black border bg-gradient-to-br flex-shrink-0 backdrop-blur-sm ${colors[status] ?? colors.idle}`}>
                {name[0].toUpperCase()}
            </div>
        );
    }

    function PersonRow({ r, showTimer, alertThresholdMs }: { r: UserStatusRecord; showTimer?: boolean; alertThresholdMs?: number }) {
        const since = r.status === 'working' ? r.workStart : r.status === 'on_break' ? r.breakStart : r.status === 'on_brb' ? r.brbStart : undefined;
        const statusText: Record<string, string> = { working: 'Working', on_break: 'On Break', on_brb: 'BRB', punched_out: 'Done', idle: 'Not Started' };
        const textColor: Record<string, string> = { working: 'text-emerald-400', on_break: 'text-amber-400', on_brb: 'text-violet-400', punched_out: 'text-rose-400', idle: 'text-slate-500' };
        return (
            <div className="flex items-center gap-4 py-3.5 px-5 hover:bg-white/[0.04] transition-colors border-b border-white/5 last:border-0 group">
                <Avatar name={r.user.name} status={r.status} />
                <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-black text-white/90 truncate tracking-wide group-hover:text-white transition-colors">{r.user.name}</p>
                    <div className={`flex items-center gap-1.5 mt-0.5 text-[11px] font-bold uppercase tracking-wider ${textColor[r.status] ?? 'text-slate-500'}`}>
                        {showTimer && since
                            ? <span className="flex items-center gap-1.5 opacity-90 backdrop-blur-sm bg-black/20 px-2 py-0.5 rounded-md border border-white/5 shadow-inner"><Clock size={11} className="drop-shadow-[0_0_5px_currentColor]" /><LiveTimer since={since} alertThresholdMs={alertThresholdMs} /></span>
                            : <span>{statusText[r.status] ?? r.status}</span>
                        }
                    </div>
                </div>
            </div>
        );
    }

    const everyoneWorking = !loading && records.length > 0 && onBreak.length === 0 && onBrb.length === 0;

    if (loading) return (
        <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-slate-700 border-t-blue-400 rounded-full animate-spin" />
        </div>
    );

    if (records.length === 0) return (
        <div className="flex flex-col items-center gap-3 py-12 text-slate-600">
            <Users size={28} className="opacity-40" />
            <p className="text-sm">{isMaster ? 'No team members online.' : `No other ${clientName ?? 'team'} members yet.`}</p>
        </div>
    );

    return (
        <div className="space-y-4 pt-2">
            {needsStretch.length > 0 && (
                <div className="rounded-[1.5rem] bg-gradient-to-br from-sky-900/30 via-sky-950/20 to-[#0a0a14]/80 backdrop-blur-xl border border-sky-500/20 shadow-[0_8px_32px_rgba(14,165,233,0.15)] overflow-hidden relative group">
                    <div className="absolute inset-0 bg-sky-500/5 group-hover:bg-sky-500/10 transition-colors duration-500 pointer-events-none" />
                    <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5 bg-sky-500/10 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-[150%] animate-[shimmer_3s_infinite]" />
                        <div className="flex items-center gap-2.5 relative z-10">
                            <div className="p-1.5 rounded-lg bg-sky-500/20 border border-sky-500/30">
                                <Sparkles size={14} className="text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)] animate-pulse" />
                            </div>
                            <span className="text-[11px] font-black tracking-[0.2em] uppercase text-sky-400">Time to Stretch! &bull; {needsStretch.length}</span>
                        </div>
                        <span className="text-[9px] text-sky-300/60 font-black uppercase tracking-widest relative z-10 border border-sky-500/20 px-2 py-0.5 rounded-full bg-sky-950/50">&gt; 3 Hours Focus</span>
                    </div>

                    {/* Motivational Quote for Stretchers */}
                    <div className="px-6 py-2.5 bg-sky-950/40 border-b border-white/5 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                            <motion.p key={quoteIdx} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.4 }}
                                className="text-[12px] font-bold text-sky-200/80 tracking-wide text-center">
                                {STRETCH_QUOTES[quoteIdx % STRETCH_QUOTES.length]}
                            </motion.p>
                        </AnimatePresence>
                    </div>

                    <div className="pb-1 pt-1">
                        {needsStretch.map(r => <PersonRow key={r.user.id} r={r} showTimer />)}
                    </div>
                </div>
            )}
            {onBreak.length > 0 && (
                <div className="rounded-[1.5rem] bg-gradient-to-b from-[#0a0a14]/80 to-[#05050f]/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden relative group">
                    <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors duration-500 pointer-events-none" />
                    <div className="flex items-center gap-2.5 px-6 pt-5 pb-3 border-b border-white/5 bg-amber-500/5">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                            <Coffee size={14} className="text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                        </div>
                        <span className="text-[11px] font-black tracking-[0.2em] uppercase text-amber-400/90">On Break &bull; {onBreak.length}</span>
                    </div>
                    <div className="pb-1">
                        {onBreak.map(r => <PersonRow key={r.user.id} r={r} showTimer alertThresholdMs={45 * 60 * 1000} />)}
                    </div>
                </div>
            )}
            {onBrb.length > 0 && (
                <div className="rounded-[1.5rem] bg-gradient-to-b from-[#0a0a14]/80 to-[#05050f]/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden relative group">
                    <div className="absolute inset-0 bg-violet-500/5 group-hover:bg-violet-500/10 transition-colors duration-500 pointer-events-none" />
                    <div className="flex items-center gap-2.5 px-6 pt-5 pb-3 border-b border-white/5 bg-violet-500/5">
                        <div className="p-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30">
                            <RotateCcw size={14} className="text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
                        </div>
                        <span className="text-[11px] font-black tracking-[0.2em] uppercase text-violet-400/90">Be Right Back &bull; {onBrb.length}</span>
                    </div>
                    <div className="pb-1">
                        {onBrb.map(r => <PersonRow key={r.user.id} r={r} showTimer alertThresholdMs={5 * 60 * 1000} />)}
                    </div>
                </div>
            )}
            {onBreak.length === 0 && onBrb.length === 0 && needsStretch.length === 0 && (
                <div className="flex items-center gap-4 px-6 py-5 rounded-[1.5rem] bg-gradient-to-b from-emerald-900/20 to-emerald-950/20 backdrop-blur-xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(16,185,129,0.1)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/5 animate-pulse pointer-events-none" />
                    <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <Sparkles size={18} className="text-emerald-400 flex-shrink-0 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.p key={quoteIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.4 }}
                            className="text-sm font-bold tracking-wide text-emerald-300 drop-shadow-md">
                            {QUOTES[quoteIdx]}
                        </motion.p>
                    </AnimatePresence>
                </div>
            )}
            {/* 2026 Monthly Calendar — Only visible to admins */}
            {isMaster && (
                <div className="rounded-[1.5rem] bg-gradient-to-b from-[#0a0a14]/80 to-[#05050f]/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden relative group">
                    <div className="absolute inset-0 bg-violet-500/[0.02] group-hover:bg-violet-500/[0.05] transition-colors pointer-events-none" />
                    <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30">
                                <Clock size={14} className="text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                            </div>
                            <span className="text-[11px] font-black tracking-[0.2em] uppercase text-violet-400/90">2026 Leave Calendar</span>
                        </div>
                    </div>
                    <div className="p-4">
                        <MonthlyLeaveCalendar leaves={leaves} selectedClients={clientName ? [clientName] : []} />
                    </div>
                </div>
            )}

            {/* Top Performers / Discipline Board — Now visible to recruiters too — GLOBAL RANKING */}
            <div className="rounded-[2.5rem] bg-gradient-to-b from-[#0a0a14]/80 to-[#05050f]/80 backdrop-blur-3xl border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden relative group">
                <div className="absolute inset-0 bg-emerald-500/[0.02] group-hover:bg-emerald-500/[0.04] transition-colors pointer-events-none" />
                <div className="p-6">
                    <StarPerformers />
                </div>
            </div>
        </div>
    );
}
