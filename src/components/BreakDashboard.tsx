'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, RotateCcw, Users, Clock, Sparkles } from 'lucide-react';
import { getAllUsersStatus, UserStatusRecord } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/timeUtils';

function LiveTimer({ since }: { since: number }) {
    const [e, setE] = useState(() => Date.now() - since);
    useEffect(() => {
        const id = setInterval(() => setE(Date.now() - since), 1000);
        return () => clearInterval(id);
    }, [since]);
    return <span className="font-mono tabular-nums">{formatDuration(e)}</span>;
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

export default function BreakDashboard({ currentUserId, isMaster, clientName }: Props) {
    const [records, setRecords] = useState<UserStatusRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);
    const [quoteIdx, setQuoteIdx] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 6000);
        return () => clearInterval(id);
    }, []);

    const refresh = useCallback(async () => {
        const data = await getAllUsersStatus();
        if (!mountedRef.current) return;
        // For regular users, filter to only same client
        const filtered = isMaster ? data : data.filter(r => r.user.clientName === clientName);
        setRecords(filtered.filter(r => r.user.id !== currentUserId));
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
    const away = records.filter(r => r.status === 'punched_out' || r.status === 'idle');

    function Avatar({ name, status }: { name: string; status: string }) {
        const colors: Record<string, string> = {
            working: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            on_break: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
            on_brb: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
            punched_out: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
            idle: 'bg-slate-800 text-slate-400 border-slate-700',
        };
        return (
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black border flex-shrink-0 ${colors[status] ?? colors.idle}`}>
                {name[0].toUpperCase()}
            </div>
        );
    }

    function PersonRow({ r, showTimer }: { r: UserStatusRecord; showTimer?: boolean }) {
        const since = r.status === 'on_break' ? r.breakStart : r.status === 'on_brb' ? r.brbStart : undefined;
        const statusText: Record<string, string> = { working: 'Working', on_break: 'On Break', on_brb: 'BRB', punched_out: 'Done', idle: 'Not Started' };
        const textColor: Record<string, string> = { working: 'text-emerald-400', on_break: 'text-amber-400', on_brb: 'text-violet-400', punched_out: 'text-rose-400', idle: 'text-slate-500' };
        return (
            <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-white/[0.03] transition-colors">
                <Avatar name={r.user.name} status={r.status} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{r.user.name}</p>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${textColor[r.status] ?? 'text-slate-500'}`}>
                        {showTimer && since
                            ? <span className="flex items-center gap-1"><Clock size={10} /><LiveTimer since={since} /></span>
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
        <div className="space-y-3">
            {onBreak.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-900/10 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                        <Coffee size={13} className="text-amber-400" />
                        <span className="text-xs font-black tracking-widest uppercase text-amber-400">On Break · {onBreak.length}</span>
                    </div>
                    {onBreak.map(r => <PersonRow key={r.user.id} r={r} showTimer />)}
                </div>
            )}
            {onBrb.length > 0 && (
                <div className="rounded-2xl border border-violet-500/20 bg-violet-900/10 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                        <RotateCcw size={13} className="text-violet-400" />
                        <span className="text-xs font-black tracking-widest uppercase text-violet-400">BRB · {onBrb.length}</span>
                    </div>
                    {onBrb.map(r => <PersonRow key={r.user.id} r={r} showTimer />)}
                </div>
            )}
            {working.length > 0 && (
                <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
                    <div className="px-4 pt-3 pb-1">
                        <span className="text-xs font-black tracking-widest uppercase text-emerald-400/60">Working · {working.length}</span>
                    </div>
                    {working.map(r => <PersonRow key={r.user.id} r={r} />)}
                </div>
            )}
            {away.length > 0 && (
                <div className="rounded-2xl border border-white/5 overflow-hidden">
                    {away.map(r => <PersonRow key={r.user.id} r={r} />)}
                </div>
            )}
            {everyoneWorking && (
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-900/10">
                    <Sparkles size={15} className="text-emerald-400 flex-shrink-0" />
                    <AnimatePresence mode="wait">
                        <motion.p key={quoteIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.4 }}
                            className="text-sm font-semibold text-emerald-300">
                            {QUOTES[quoteIdx]}
                        </motion.p>
                    </AnimatePresence>
                </div>
            )}
            <p className="text-[10px] text-slate-700 text-center pt-1 tracking-wider uppercase">Live via Supabase Realtime</p>
        </div>
    );
}
