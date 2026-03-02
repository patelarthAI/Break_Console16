'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCw, Coffee, RotateCcw, Briefcase, XCircle,
    AlertTriangle, Clock, Users, Wifi, UserCheck, UserX, Trash2, Calendar,
    TrendingUp, Activity, CheckCircle2, ChevronDown, Search, Filter
} from 'lucide-react';
import {
    getAllUsersStatus, UserStatusRecord, masterOverride,
    getPendingUsers, approveUser, deleteUser, getClients, ClientRow, getLeaves
} from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatDuration, formatTime, dateStr } from '@/lib/timeUtils';
import { User, LeaveRecord } from '@/types';
import ViolatorsPanel from '@/components/ViolatorsPanel';

function LiveTimer({ since, color }: { since: number; color: string }) {
    const [e, setE] = useState(Math.max(0, Date.now() - since));
    useEffect(() => { const id = setInterval(() => setE(Math.max(0, Date.now() - since)), 1000); return () => clearInterval(id); }, [since]);
    return <span className={`font-mono font-bold tabular-nums ${color}`}>{formatDuration(e)}</span>;
}

const STATUS = {
    idle: { label: 'Not Started', dot: 'bg-slate-600', ring: 'ring-slate-600/0', text: 'text-slate-400', rowBg: 'bg-slate-900/20 border-slate-700/20', badge: 'bg-slate-800/60 border-slate-700/40' },
    working: { label: 'Working', dot: 'bg-emerald-400 animate-pulse', ring: 'ring-emerald-400/30', text: 'text-emerald-400', rowBg: 'bg-emerald-900/10 border-emerald-500/20', badge: 'bg-emerald-900/20 border-emerald-500/30' },
    on_break: { label: 'On Break', dot: 'bg-amber-400 animate-pulse', ring: 'ring-amber-400/30', text: 'text-amber-400', rowBg: 'bg-amber-900/10 border-amber-500/20', badge: 'bg-amber-900/20 border-amber-500/30' },
    on_brb: { label: 'BRB', dot: 'bg-blue-400 animate-pulse', ring: 'ring-blue-400/30', text: 'text-blue-400', rowBg: 'bg-blue-900/10 border-blue-500/20', badge: 'bg-blue-900/20 border-blue-500/30' },
    punched_out: { label: 'Logged Out', dot: 'bg-slate-500', ring: 'ring-slate-400/0', text: 'text-slate-500', rowBg: 'bg-slate-900/10 border-slate-700/10', badge: 'bg-slate-900/40 border-slate-700/20' },
    on_leave: { label: 'On Leave', dot: 'bg-violet-400', ring: 'ring-violet-400/30', text: 'text-violet-400', rowBg: 'bg-violet-900/10 border-violet-500/20', badge: 'bg-violet-900/20 border-violet-500/30' },
};

interface Props { currentUserId: string; isMaster: boolean; }

// ── Interactive 7-Day Leave Calendar ─────────────────────────────────
function WeekLeaveCalendar({ leaves, selectedClients }: { leaves: LeaveRecord[]; selectedClients: string[] }) {
    const today = new Date();
    const [selectedIdx, setSelectedIdx] = useState<number | null>(0);

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
    });

    const filtered = leaves.filter(l =>
        selectedClients.length === 0 || selectedClients.includes(l.client_name)
    );

    const dayLeaves = (d: Date) => filtered.filter(l => l.date === dateStr(d));
    const selectedLeaves = selectedIdx !== null ? dayLeaves(days[selectedIdx]) : [];
    const selectedDay = selectedIdx !== null ? days[selectedIdx] : null;

    // Client color map for badges
    const CLIENT_COLORS = [
        'bg-blue-500/20 text-blue-300 border-blue-500/30',
        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        'bg-amber-500/20 text-amber-300 border-amber-500/30',
        'bg-rose-500/20 text-rose-300 border-rose-500/30',
        'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        'bg-purple-500/20 text-purple-300 border-purple-500/30',
    ];
    const clientColorCache = useRef<Record<string, string>>({});
    const getClientColor = (client: string) => {
        if (!clientColorCache.current[client]) {
            const keys = Object.keys(clientColorCache.current);
            clientColorCache.current[client] = CLIENT_COLORS[keys.length % CLIENT_COLORS.length];
        }
        return clientColorCache.current[client];
    };

    return (
        <div className="space-y-3">
            {/* Day strip */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((d, i) => {
                    const leaveList = dayLeaves(d);
                    const isToday = i === 0;
                    const isSelected = selectedIdx === i;
                    const hasLeaves = leaveList.length > 0;
                    return (
                        <button key={i}
                            onClick={() => setSelectedIdx(isSelected ? null : i)}
                            className={`relative rounded-xl p-2 min-h-[76px] border text-left transition-all hover:brightness-110 focus:outline-none
                                ${isSelected
                                    ? 'border-amber-500/60 bg-amber-900/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                    : isToday
                                        ? 'border-amber-500/30 bg-amber-900/8'
                                        : hasLeaves
                                            ? 'border-violet-500/30 bg-violet-900/10 hover:border-violet-500/50'
                                            : 'border-white/5 bg-white/[0.01] hover:border-white/10'}`}>
                            {/* Day label */}
                            <p className={`text-[8px] font-black uppercase tracking-widest
                                ${isSelected || isToday ? 'text-amber-400' : 'text-slate-600'}`}>
                                {d.toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                            <p className={`text-lg font-black leading-tight
                                ${isSelected ? 'text-amber-300' : isToday ? 'text-amber-400/80' : 'text-slate-400'}`}>
                                {d.getDate()}
                            </p>
                            {/* Leave count dot or avatars */}
                            {hasLeaves && (
                                <div className="mt-1 flex flex-col gap-0.5">
                                    {leaveList.slice(0, 2).map((l, li) => (
                                        <div key={li} className="text-[7px] font-bold bg-violet-500/25 text-violet-300 rounded px-1 py-0.5 truncate border border-violet-500/20">
                                            {l.employee_name.split(' ')[0]}
                                        </div>
                                    ))}
                                    {leaveList.length > 2 && (
                                        <p className="text-[7px] text-violet-400/70 font-bold">+{leaveList.length - 2}</p>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Detail panel — appears when a day is selected */}
            <AnimatePresence>
                {selectedIdx !== null && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden">
                        <div className="rounded-xl border border-white/8 bg-black/30 p-3 space-y-2">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {selectedDay?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </p>
                                <span className={`text-[10px] font-black ${selectedLeaves.length > 0 ? 'text-violet-400' : 'text-slate-700'}`}>
                                    {selectedLeaves.length} on leave
                                </span>
                            </div>

                            {selectedLeaves.length === 0 ? (
                                <p className="text-xs text-slate-700 py-2 text-center">✓ No leaves scheduled</p>
                            ) : (
                                selectedLeaves.map((l, i) => (
                                    <div key={i} className="flex items-center gap-2.5 bg-white/[0.02] rounded-lg px-2.5 py-2 border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[11px] font-black text-violet-300 flex-shrink-0">
                                            {l.employee_name[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{l.employee_name}</p>
                                            <p className="text-[9px] text-slate-500">{l.leave_type} · {l.day_count === 1 ? 'Full Day' : 'Half Day'}</p>
                                        </div>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border flex-shrink-0 ${getClientColor(l.client_name)}`}>
                                            {l.client_name}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Single recruiter row ──────────────────────────────────────────────────────
function RecruiterRow({ r, isMaster, onEndBreak, onEndBrb, onPunchOut, confirmingEnd, onConfirmEnd, onCancelEnd, confirmingDelete, onConfirmDelete, onCancelDelete, onDeleteRequest }: {
    r: UserStatusRecord; isMaster: boolean;
    onEndBreak: () => void; onEndBrb: () => void; onPunchOut: () => void;
    confirmingEnd: boolean; onConfirmEnd: () => void; onCancelEnd: () => void;
    confirmingDelete: boolean; onConfirmDelete: () => void; onCancelDelete: () => void; onDeleteRequest: () => void;
}) {
    const cfg = STATUS[r.status as keyof typeof STATUS] ?? STATUS.idle;
    const isDone = r.status === 'punched_out';
    const isLeave = r.status === 'on_leave';
    const isBreak = r.status === 'on_break';
    const isBrb = r.status === 'on_brb';
    const isWorking = r.status === 'working';

    // Duration label — what to show next to status
    const durationLabel = isLeave ? null
        : isDone ? null
            : isBreak ? 'Break for'
                : isBrb ? 'BRB for'
                    : isWorking ? 'Working for'
                        : null;

    // Worked total for done users
    const doneMs = isDone && r.punchIn && r.punchOut ? r.punchOut - r.punchIn : 0;

    return (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all group ${cfg.rowBg}`}>
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ring-2 ${cfg.ring} ${isDone || isLeave ? 'bg-white/5 text-slate-400' : cfg.text.replace('text-', 'bg-').replace('-400', '-500/15') + ' ' + cfg.text}`}>
                {r.user.name[0].toUpperCase()}
            </div>
            {/* Name */}
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${isDone ? 'text-slate-500' : 'text-white'}`}>{r.user.name}</p>
            </div>
            {/* Status badge */}
            <span className={`text-[10px] font-black tracking-widest uppercase flex-shrink-0 ${cfg.text}`}>{cfg.label}</span>
            {/* Duration / time info */}
            <div className="flex-shrink-0 text-right min-w-[120px]">
                {isLeave && (
                    <span className="text-[11px] font-bold text-violet-400">On Leave Today</span>
                )}
                {isDone && doneMs > 0 && (
                    <div>
                        <p className="text-[9px] text-slate-700 uppercase tracking-wider font-bold">Total Worked</p>
                        <span className="font-mono text-slate-400 font-bold text-[12px]">{formatDuration(doneMs)}</span>
                    </div>
                )}
                {isDone && !doneMs && (
                    <span className="text-[11px] text-slate-700">—</span>
                )}
                {!isLeave && !isDone && durationLabel && (
                    <div>
                        <p className="text-[9px] text-slate-600 uppercase tracking-wider font-bold">{durationLabel}</p>
                        {isBreak && r.breakStart && <LiveTimer since={r.breakStart} color={cfg.text} />}
                        {isBrb && r.brbStart && <LiveTimer since={r.brbStart} color={cfg.text} />}
                        {isWorking && r.punchIn && <LiveTimer since={r.punchIn} color={cfg.text} />}
                    </div>
                )}
                {!isLeave && !isDone && !durationLabel && (
                    <span className="text-[11px] text-slate-700">—</span>
                )}
            </div>
            {/* Master actions */}
            {isMaster && (
                <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isBreak && !confirmingEnd && (
                        <button onClick={onEndBreak} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-all">End Break</button>
                    )}
                    {isBrb && !confirmingEnd && (
                        <button onClick={onEndBrb} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-all">End BRB</button>
                    )}
                    {!['idle', 'punched_out', 'on_leave'].includes(r.status) && (
                        confirmingEnd
                            ? <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-rose-400 font-bold">Log out?</span>
                                <button onClick={onConfirmEnd} className="text-[10px] font-bold px-2 py-1 rounded bg-rose-500 text-white hover:bg-rose-400">Yes</button>
                                <button onClick={onCancelEnd} className="text-[10px] font-bold px-2 py-1 rounded bg-white/10 text-slate-400">No</button>
                            </div>
                            : <button onClick={onPunchOut} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all">Log Out</button>
                    )}
                    {confirmingDelete
                        ? <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-rose-400 font-bold">Delete?</span>
                            <button onClick={onConfirmDelete} className="text-[10px] font-bold px-2 py-1 rounded bg-rose-600 text-white">Yes</button>
                            <button onClick={onCancelDelete} className="text-[10px] font-bold px-2 py-1 rounded bg-white/10 text-slate-400">No</button>
                        </div>
                        : <button onClick={onDeleteRequest} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"><Trash2 size={12} /></button>
                    }
                </div>
            )}
        </motion.div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MasterConsole({ currentUserId, isMaster }: Props) {
    const [records, setRecords] = useState<UserStatusRecord[]>([]);
    const [pending, setPending] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [clientFilterOpen, setClientFilterOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
    const [confirmEnd, setConfirmEnd] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const mountedRef = useRef(true);

    const refresh = useCallback(async () => {
        const [data, pData, clientsData, leavesData] = await Promise.all([
            getAllUsersStatus(), getPendingUsers(), getClients(), getLeaves()
        ]);
        if (!mountedRef.current) return;
        setRecords(data);
        setPending(pData);
        setClients(clientsData);
        setLeaves(leavesData);
        setLoading(false);
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        refresh();
        const channel = supabase
            .channel('mc_rt')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'time_logs' }, refresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, refresh)
            .subscribe();
        return () => { mountedRef.current = false; channel.unsubscribe(); };
    }, [refresh]);

    const doOverride = async (userId: string, action: 'break_end' | 'brb_end' | 'punch_out') => {
        await masterOverride(userId, action, currentUserId);
        setConfirmEnd(null);
        await refresh();
    };

    const doApprove = async (userId: string) => { await approveUser(userId); await refresh(); };
    const doDelete = async (userId: string) => { await deleteUser(userId); setConfirmDelete(null); await refresh(); };

    const todayStr = useMemo(() => dateStr(new Date()), []);

    const todayLeaves = useMemo(() => leaves.filter(l => l.date === todayStr), [leaves, todayStr]);
    const weekLeaves = useMemo(() => leaves.filter(l => {
        const d = new Date(); const end = new Date(d); end.setDate(d.getDate() + 7);
        return l.date >= todayStr && l.date <= dateStr(end);
    }), [leaves, todayStr]);

    const filteredRecords = useMemo(() => {
        let f = records;
        if (selectedClients.length > 0) {
            f = f.filter(r => selectedClients.includes(r.user.clientName));
        }
        if (search) {
            const q = search.toLowerCase();
            f = f.filter(r => r.user.name.toLowerCase().includes(q) || r.user.clientName.toLowerCase().includes(q));
        }
        return f;
    }, [records, selectedClients, search]);

    const augmented = useMemo(() => filteredRecords.map(r => {
        const leave = todayLeaves.find(l => l.employee_name === r.user.name && l.client_name === r.user.clientName);
        return leave ? { ...r, status: 'on_leave' as any, punchIn: undefined, punchOut: undefined } : r;
    }), [filteredRecords, todayLeaves]);

    const sorted = useMemo(() => {
        const order = ['on_break', 'on_brb', 'working', 'idle', 'punched_out', 'on_leave'];
        let list = [...augmented];
        if (statusFilter) {
            list = list.filter(r => r.status === statusFilter);
        }
        return list.sort((a, b) => {
            if (selectedClients.length === 0 && a.user.clientName !== b.user.clientName)
                return a.user.clientName.localeCompare(b.user.clientName);
            return order.indexOf(a.status) - order.indexOf(b.status);
        });
    }, [augmented, selectedClients, statusFilter]);

    const stats = useMemo(() => ({
        working: augmented.filter(r => r.status === 'working').length,
        onBreak: augmented.filter(r => r.status === 'on_break').length,
        onBrb: augmented.filter(r => r.status === 'on_brb').length,
        onLeave: augmented.filter(r => r.status === 'on_leave').length,
        done: augmented.filter(r => r.status === 'punched_out').length,
    }), [augmented]);

    return (
        <div className="flex flex-col gap-6">

            {/* ── PENDING APPROVALS ─────────────────────────────────────────── */}
            <AnimatePresence>
                {pending.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                        className="rounded-2xl border border-blue-500/30 bg-blue-900/10 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <UserCheck size={15} className="text-blue-400" />
                            <p className="text-sm font-black text-blue-400 tracking-wide">Pending Approval · {pending.length}</p>
                        </div>
                        {pending.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-3 border border-blue-500/10">
                                <div>
                                    <p className="text-sm font-bold text-white">{p.name}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{p.clientName}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => doApprove(p.id)} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-400 transition-colors">Approve</button>
                                    <button onClick={() => doDelete(p.id)} className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20 hover:bg-rose-500/20 transition-colors">Reject</button>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── STATS BAR (clickable filter buttons) ─────────────────────── */}
            <div className="grid grid-cols-5 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/8">
                {[
                    { label: 'Working', val: stats.working, key: 'working', color: 'text-emerald-400', activeBg: 'bg-emerald-900/20' },
                    { label: 'On Break', val: stats.onBreak, key: 'on_break', color: 'text-amber-400', activeBg: 'bg-amber-900/20' },
                    { label: 'BRB', val: stats.onBrb, key: 'on_brb', color: 'text-blue-400', activeBg: 'bg-blue-900/20' },
                    { label: 'On Leave', val: stats.onLeave, key: 'on_leave', color: 'text-violet-400', activeBg: 'bg-violet-900/20' },
                    { label: 'Logged Out', val: stats.done, key: 'punched_out', color: 'text-slate-400', activeBg: 'bg-slate-900/30' },
                ].map(s => {
                    const isActive = statusFilter === s.key;
                    return (
                        <button key={s.label}
                            onClick={() => setStatusFilter(isActive ? null : s.key)}
                            className={`px-5 py-4 flex flex-col gap-1 text-left transition-all hover:brightness-110 relative
                                ${isActive ? s.activeBg : 'bg-[#0a0a18] hover:bg-white/[0.03]'}`}>
                            {isActive && <div className={`absolute top-0 inset-x-0 h-0.5 ${s.color.replace('text-', 'bg-')}`} />}
                            <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.val}</p>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? s.color : 'text-slate-600'}`}>{s.label}</p>
                        </button>
                    );
                })}
            </div>

            {/* ── MAIN GRID: People Table + Week Calendar ────────────────────── */}
            <div className="grid grid-cols-[1fr_280px] gap-5 items-start">

                {/* LEFT: Recruiter List */}
                <div className="flex flex-col gap-3">
                    {/* Filter row */}
                    <div className="flex z-10 items-center justify-between bg-[#0A0A0A] p-2.5 rounded-xl border border-white/[0.06] shadow-lg relative">
                        <div className="flex items-center gap-3 flex-1">
                            <Wifi size={14} className="text-emerald-400 animate-pulse flex-shrink-0 ml-1" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Live</span>

                            <div className="w-px h-5 bg-white/10 mx-1" />

                            {/* Search */}
                            <div className="relative flex-1 max-w-xs">
                                <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                <input type="text" placeholder="Search recruiters…" value={search} onChange={e => setSearch(e.target.value)}
                                    className="w-full bg-transparent border-none py-1.5 pl-7 pr-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all" />
                                {search && <button onClick={() => setSearch('')} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"><XCircle size={14} /></button>}
                            </div>

                            <div className="w-px h-5 bg-white/10" />

                            {/* Multi-select Client Filter */}
                            <div className="relative">
                                <button type="button" onClick={() => setClientFilterOpen(!clientFilterOpen)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent hover:bg-white/[0.04] rounded-lg transition-colors text-sm font-semibold text-slate-300">
                                    <Filter size={13} className="text-slate-500" />
                                    {selectedClients.length === 0 ? 'All Clients' : `${selectedClients.length} Selected`}
                                    <ChevronDown size={12} className={`text-slate-500 transition-transform ${clientFilterOpen ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {clientFilterOpen && (
                                        <motion.div initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                            className="absolute top-full left-0 mt-2 w-56 bg-[#0C0C14] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] overflow-hidden z-[100] py-1">

                                            <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                                                <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Filter Clients</span>
                                                {selectedClients.length > 0 && (
                                                    <button onClick={() => setSelectedClients([])} className="text-[10px] font-bold text-slate-400 hover:text-white">Clear</button>
                                                )}
                                            </div>

                                            <div className="max-h-64 overflow-y-auto overflow-x-hidden custom-scrollbar">
                                                <label className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors">
                                                    <input type="checkbox" className="hidden"
                                                        checked={selectedClients.length === 0}
                                                        onChange={() => setSelectedClients([])}
                                                    />
                                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${selectedClients.length === 0 ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 bg-transparent'}`}>
                                                        {selectedClients.length === 0 && <CheckCircle2 size={12} className="text-black" />}
                                                    </div>
                                                    <span className={`text-sm ${selectedClients.length === 0 ? 'text-white font-bold' : 'text-slate-300 font-medium'}`}>All Clients</span>
                                                </label>
                                                {clients.map(c => {
                                                    const isSel = selectedClients.includes(c.name);
                                                    return (
                                                        <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors">
                                                            <input type="checkbox" className="hidden"
                                                                checked={isSel}
                                                                onChange={() => {
                                                                    if (isSel) setSelectedClients(prev => prev.filter(x => x !== c.name));
                                                                    else setSelectedClients(prev => [...prev, c.name]);
                                                                }}
                                                            />
                                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${isSel ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 bg-transparent'}`}>
                                                                {isSel && <CheckCircle2 size={12} className="text-black" />}
                                                            </div>
                                                            <span className={`text-sm ${isSel ? 'text-white font-bold' : 'text-slate-300 font-medium'}`}>{c.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pr-2 pl-4 border-l border-white/10">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                {filteredRecords.length} Match{filteredRecords.length !== 1 ? 'es' : ''}
                            </span>
                            <button onClick={refresh} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>

                    {loading && (
                        <div className="flex justify-center py-12">
                            <div className="w-6 h-6 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
                        </div>
                    )}

                    {!loading && sorted.length === 0 && (
                        <div className="flex flex-col items-center gap-3 py-16 text-slate-600">
                            <Users size={32} className="opacity-40" />
                            <p className="text-sm">No recruiters found.</p>
                        </div>
                    )}

                    {!loading && sorted.length > 0 && (() => {
                        let lastClient = '';
                        return sorted.map(r => {
                            const showHeader = selectedClients.length === 0 && r.user.clientName !== lastClient;
                            if (showHeader) lastClient = r.user.clientName;
                            return (
                                <div key={r.user.id}>
                                    {showHeader && (
                                        <div className="flex items-center gap-2 pt-2 pb-1">
                                            <div className="h-px flex-1 bg-white/5" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3">{r.user.clientName}</span>
                                            <div className="h-px flex-1 bg-white/5" />
                                        </div>
                                    )}
                                    <RecruiterRow r={r} isMaster={isMaster}
                                        onEndBreak={() => doOverride(r.user.id, 'break_end')}
                                        onEndBrb={() => doOverride(r.user.id, 'brb_end')}
                                        onPunchOut={() => setConfirmEnd(r.user.id)}
                                        confirmingEnd={confirmEnd === r.user.id}
                                        onConfirmEnd={() => doOverride(r.user.id, 'punch_out')}
                                        onCancelEnd={() => setConfirmEnd(null)}
                                        confirmingDelete={confirmDelete === r.user.id}
                                        onConfirmDelete={() => doDelete(r.user.id)}
                                        onCancelDelete={() => setConfirmDelete(null)}
                                        onDeleteRequest={() => setConfirmDelete(r.user.id)}
                                    />
                                </div>
                            );
                        });
                    })()}
                </div>

                {/* RIGHT: Weekly Leave Calendar + Today's leaves */}
                <div className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-white/8 bg-[#0a0a18] p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar size={14} className="text-violet-400" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">7-Day Leave View</p>
                        </div>
                        <WeekLeaveCalendar leaves={weekLeaves} selectedClients={selectedClients} />
                    </div>

                    {/* Today on leave */}
                    {todayLeaves.length > 0 && (
                        <div className="rounded-2xl border border-violet-500/20 bg-violet-900/10 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-3">On Leave Today · {todayLeaves.length}</p>
                            <div className="flex flex-col gap-2">
                                {todayLeaves.filter(l => selectedClients.length === 0 || selectedClients.includes(l.client_name)).map(l => (
                                    <div key={l.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-black/30 border border-violet-500/10">
                                        <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm font-black text-violet-300 flex-shrink-0">
                                            {l.employee_name[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{l.employee_name}</p>
                                            <p className="text-[9px] text-slate-500 truncate">{l.leave_type} · {l.day_count === 1 ? 'Full' : 'Half'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Violators Panel */}
                    <div className="rounded-2xl border border-white/8 bg-[#0a0a18] p-4">
                        <ViolatorsPanel clientFilter={selectedClients} />
                    </div>
                </div>
            </div>

            <p className="text-[10px] text-slate-700 text-center tracking-wider uppercase">Live via Supabase Realtime</p>
        </div>
    );
}
