'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCw, Coffee, RotateCcw, Briefcase, XCircle,
    AlertTriangle, Clock, Users, Wifi, UserCheck, UserX, Trash2, Calendar,
    TrendingUp, Activity, CheckCircle2, ChevronDown, Search, Filter, Bell, X
} from 'lucide-react';
import {
    getAllUsersStatus, UserStatusRecord, masterOverride,
    getPendingUsers, approveUser, deleteUser, getClients, ClientRow, getLeaves,
    get7DayBreakStats, getLogs, deleteTimeLog, insertLog
} from '@/lib/store';

import { supabase } from '@/lib/supabase';
import { formatDuration, formatTime, dateStr, getTodayKey, generateUUID } from '@/lib/timeUtils';
import { User, LeaveRecord, TimeLog, AppStatus } from '@/types';
import ViolatorsPanel from '@/components/ViolatorsPanel';
import StarPerformers from '@/components/StarPerformers';
import TimelineLog from '@/components/TimelineLog';

// ─── Custom Time Picker ───────────────────────────────────────────────────────
function CustomTimePicker({ value, onChange }: { value: string, onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const options = [];
    for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 60; j += 30) {
            const h = i.toString().padStart(2, '0');
            const m = j.toString().padStart(2, '0');
            options.push(`${h}:${m}`);
        }
    }
    const formatDisplay = (h24: string) => {
        if (!h24) return '--:-- AM';
        const [h, m] = h24.split(':');
        let hr = parseInt(h, 10);
        const ampm = hr >= 12 ? 'PM' : 'AM';
        if (hr > 12) hr -= 12;
        if (hr === 0) hr = 12;
        return `${hr.toString().padStart(2, '0')}:${m} ${ampm}`;
    };
    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all hover:bg-white/[0.06]">
                <span className="font-semibold">{value ? formatDisplay(value) : '--:-- AM'}</span>
                <Clock size={13} className="text-slate-500" />
            </button>
            <AnimatePresence>
                {open && (
                    <>
                        <div className="fixed inset-0 z-[150]" onClick={() => setOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5 }} className="absolute bottom-full mb-1 left-0 right-0 max-h-48 overflow-y-auto bg-[#131326] border border-blue-500/30 rounded-xl shadow-2xl z-[200] scrollbar-thin">
                            <div className="flex flex-col py-1 mt-1 flex-col-reverse"> {/* Reverse layout so popover goes up */}
                                {options.map(opt => (
                                    <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); }} className={`text-left rounded-lg px-3 py-1.5 mx-1 text-[13px] font-semibold transition-colors ${value === opt ? 'bg-blue-500/20 text-blue-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                                        {formatDisplay(opt)}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Activity Notification Toast ──────────────────────────────────────────────
type ActivityNote = { id: string; name: string; event: string; color: string; icon: 'break' | 'brb' | 'back' | 'out'; ts: number };

const EVENT_META: Record<string, { label: string; color: string; icon: ActivityNote['icon'] }> = {
    // Only fire toasts for return/exit events — starts are noise
    break_end: { label: 'returned from break', color: 'emerald', icon: 'back' },
    brb_end: { label: 'returned from BRB', color: 'emerald', icon: 'back' },
    punch_out: { label: 'logged out', color: 'slate', icon: 'out' },
};

const COLOR_MAP: Record<string, string> = {
    amber: 'border-amber-500/40 bg-amber-900/20 shadow-amber-500/10',
    emerald: 'border-emerald-500/40 bg-emerald-900/20 shadow-emerald-500/10',
    blue: 'border-blue-500/40 bg-blue-900/20 shadow-blue-500/10',
    slate: 'border-slate-500/30 bg-slate-900/30 shadow-black/20',
};
const ICON_COLOR: Record<string, string> = {
    amber: 'text-amber-400', emerald: 'text-emerald-400', blue: 'text-blue-400', slate: 'text-slate-400',
};
const IconFor = ({ icon, color }: { icon: ActivityNote['icon']; color: string }) => {
    const cls = `${ICON_COLOR[color]} flex-shrink-0`;
    if (icon === 'break') return <Coffee size={15} className={cls} />;
    if (icon === 'brb') return <RotateCcw size={15} className={cls} />;
    if (icon === 'back') return <CheckCircle2 size={15} className={cls} />;
    return <XCircle size={15} className={cls} />;
};

function ActivityToast({ note, onDismiss }: { note: ActivityNote; onDismiss: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDismiss, 6000);
        return () => clearTimeout(t);
    }, [onDismiss]);
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 60, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl w-72 backdrop-blur-xl cursor-default ${COLOR_MAP[note.color]}`}
        >
            <IconFor icon={note.icon} color={note.color} />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-white truncate">{note.name}</p>
                <p className={`text-[11px] font-semibold ${ICON_COLOR[note.color]}`}>{note.event}</p>
            </div>
            <button onClick={onDismiss} className="text-slate-600 hover:text-white transition-colors mt-0.5 flex-shrink-0">
                <X size={12} />
            </button>
        </motion.div>
    );
}

// Break/BRB duration thresholds (ms)
const WARN_MS = 15 * 60 * 1000; // amber at 15m
const DANGER_MS = 30 * 60 * 1000; // red at 30m

function LiveTimer({ since, isBreakOrBrb = false }: { since: number; isBreakOrBrb?: boolean }) {
    const [e, setE] = useState(Math.max(0, Date.now() - since));
    useEffect(() => { const id = setInterval(() => setE(Math.max(0, Date.now() - since)), 1000); return () => clearInterval(id); }, [since]);
    const color = isBreakOrBrb
        ? (e >= DANGER_MS ? 'text-rose-400' : e >= WARN_MS ? 'text-amber-400' : 'text-emerald-400')
        : 'text-emerald-400';
    const prefix = isBreakOrBrb && e >= DANGER_MS ? '⚠ ' : '';
    return <span className={`font-mono font-bold tabular-nums ${color}`}>{prefix}{formatDuration(e)}</span>;
}

const STATUS = {
    idle: { label: 'Offline', dot: 'bg-slate-500', ring: 'ring-slate-500/0', text: 'text-slate-400', cardBg: 'bg-[#0a0a18] border-white/5 hover:bg-white/[0.04]', badgeBg: 'bg-slate-800/80 border-slate-700/50 text-slate-400' },
    working: { label: 'Working', dot: 'bg-emerald-400 animate-pulse drop-shadow-[0_0_5px_currentColor]', ring: 'ring-emerald-400/30', text: 'text-emerald-400', cardBg: 'bg-emerald-950/10 border-emerald-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_0_15px_rgba(16,185,129,0.05)] hover:bg-emerald-900/30 hover:border-emerald-500/40', badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' },
    on_break: { label: 'On Break', dot: 'bg-amber-400 animate-pulse drop-shadow-[0_0_5px_currentColor]', ring: 'ring-amber-400/30', text: 'text-amber-400', cardBg: 'bg-amber-950/10 border-amber-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_0_15px_rgba(245,158,11,0.05)] hover:bg-amber-900/30 hover:border-amber-500/40', badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
    on_brb: { label: 'BRB', dot: 'bg-blue-400 animate-pulse drop-shadow-[0_0_5px_currentColor]', ring: 'ring-blue-400/30', text: 'text-blue-400', cardBg: 'bg-blue-950/10 border-blue-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_0_15px_rgba(59,130,246,0.05)] hover:bg-blue-900/30 hover:border-blue-500/40', badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-300' },
    punched_out: { label: 'Logged Out', dot: 'bg-slate-500', ring: 'ring-slate-400/0', text: 'text-slate-500', cardBg: 'bg-slate-900/20 border-slate-700/40 hover:bg-slate-800/40', badgeBg: 'bg-slate-800/80 border-slate-700/50 text-slate-400' },
    on_leave: { label: 'On Leave', dot: 'bg-violet-400', ring: 'ring-violet-400/30', text: 'text-violet-400', cardBg: 'bg-violet-950/10 border-violet-500/20', badgeBg: 'bg-violet-500/15 border-violet-500/30 text-violet-300' },
};

function EmployeeRow({ r, isMaster, isClean, onEndBreak, onEndBrb, onPunchOut, confirmingEnd, onConfirmEnd, onCancelEnd, confirmingDelete, onConfirmDelete, onCancelDelete, onDeleteRequest, onClickRow }: any) {
    const cfg = STATUS[r.status as keyof typeof STATUS] ?? STATUS.idle;
    const isDone = r.status === 'punched_out' || r.status === 'idle';
    const isLeave = r.status === 'on_leave';
    const isBreak = r.status === 'on_break';
    const isBrb = r.status === 'on_brb';
    const isWorking = r.status === 'working';
    // workedMs from store (pure work time, no breaks/BRB). Fallback for legacy records.
    const workedMs = r.workedMs ?? (r.punchIn && r.punchOut ? r.punchOut - r.punchIn : 0);

    return (
        <div onClick={onClickRow} className={`flex items-center p-3 rounded-xl border border-white/5 ${cfg.cardBg} group transition-all duration-300 hover:border-white/20 cursor-pointer`}>
            {/* Left: Avatar + Info */}
            <div className="flex items-center gap-4 min-w-[200px] w-1/4">
                <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-[15px] font-black shrink-0 ${isDone || isLeave ? 'bg-slate-800 text-slate-400 border border-slate-700/50' : cfg.text.replace('text-', 'bg-').replace('-400', '-500/15') + ' border border-current shadow-[0_0_12px_currentColor] drop-shadow-lg ' + cfg.text}`}>
                    {r.user.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h3 className={`text-[14px] font-bold tracking-tight truncate ${isDone ? 'text-slate-400' : 'text-slate-100'}`}>{r.user.name}</h3>
                        {isClean && <span className="text-[9px] bg-yellow-500/15 text-yellow-400 px-1 py-0.5 rounded border border-yellow-500/30 flex-shrink-0" title="Perfect 7-day compliance">⭐</span>}
                    </div>
                </div>
            </div>

            {/* Middle: Status Badge */}
            <div className="min-w-[120px] w-1/6">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-widest ${cfg.badgeBg}`}>
                    {(!isDone && !isLeave) && <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                    {cfg.label}
                </div>
            </div>

            {/* Middle: Timer section */}
            <div className="min-w-[150px] w-1/4 flex items-center">
                {isLeave && <p className="text-sm font-semibold text-violet-400/80">Scheduled Leave</p>}
                {isDone && workedMs > 0 && (
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Worked:</p>
                        <span className="font-mono text-slate-300 font-bold text-sm">{formatDuration(workedMs)}</span>
                    </div>
                )}
                {isDone && !workedMs && !isLeave && <p className="text-xs text-slate-600 font-medium whitespace-nowrap">No activity recorded</p>}
                {!isLeave && !isDone && (
                    <div className="flex items-center gap-2 w-full">
                        {isWorking && r.workStart && (
                            <>
                                <span className="text-xs text-emerald-500/70 uppercase tracking-widest font-bold">Working:</span>
                                <div className="text-lg tracking-tight text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"><LiveTimer since={r.workStart} /></div>
                            </>
                        )}
                        {isBreak && r.breakStart && (
                            <>
                                <span className="text-xs text-amber-500/70 uppercase tracking-widest font-bold">Break:</span>
                                <div className="text-lg tracking-tight text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]"><LiveTimer since={r.breakStart} isBreakOrBrb /></div>
                            </>
                        )}
                        {isBrb && r.brbStart && (
                            <>
                                <span className="text-xs text-blue-500/70 uppercase tracking-widest font-bold">BRB:</span>
                                <div className="text-lg tracking-tight text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.3)]"><LiveTimer since={r.brbStart} isBreakOrBrb /></div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            {isMaster ? (
                <div className="flex items-center justify-end gap-2 min-w-[200px] flex-1" onClick={e => e.stopPropagation()}>
                    {isBreak && !confirmingEnd && (
                        <button onClick={onEndBreak} className="px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg bg-amber-500 text-amber-950 hover:bg-amber-400 transition-all shadow-[0_2px_10px_rgba(245,158,11,0.2)]">End Break</button>
                    )}
                    {isBrb && !confirmingEnd && (
                        <button onClick={onEndBrb} className="px-4 py-2 text-xs uppercase tracking-wider font-bold rounded-lg bg-blue-500 text-blue-950 hover:bg-blue-400 transition-all shadow-[0_2px_10px_rgba(59,130,246,0.2)]">End BRB</button>
                    )}
                    {!['idle', 'punched_out', 'on_leave'].includes(r.status) && (
                        confirmingEnd
                            ? <div className="flex items-center gap-2">
                                <button onClick={onConfirmEnd} className="px-4 py-2 text-xs font-bold shadow-inner rounded-lg bg-rose-500 text-white hover:bg-rose-400 uppercase tracking-wider">Yes, Out</button>
                                <button onClick={onCancelEnd} className="px-4 py-2 text-xs font-bold rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 uppercase tracking-wider border border-white/5">Cancel</button>
                            </div>
                            : (!isBreak && !isBrb) && <button onClick={onPunchOut} className="px-4 py-2 text-xs rounded-lg bg-transparent text-slate-400 border border-slate-700 hover:bg-white/5 hover:text-white transition-all opacity-0 group-hover:opacity-100 uppercase tracking-widest font-bold">Clock Out</button>
                    )}

                    <div className="ml-2 pl-2 flex items-center">
                        {confirmingDelete
                            ? <div className="flex items-center gap-2 bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20">
                                <button onClick={onConfirmDelete} className="text-xs font-bold px-3 py-1.5 rounded bg-rose-600 text-white hover:bg-rose-500">Delete</button>
                                <button onClick={onCancelDelete} className="text-xs font-bold px-3 py-1.5 rounded bg-white/10 text-slate-300 hover:bg-white/20">Cancel</button>
                            </div>
                            : <button onClick={onDeleteRequest} className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                        }
                    </div>
                </div>
            ) : <div className="w-[30%]" />}
        </div>
    );
}

// ── Week Leave Calendar ────────────────────────────────────────────────────────
function WeekLeaveCalendar({ leaves, selectedClients }: { leaves: LeaveRecord[], selectedClients: string[] }) {
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
    });

    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-1">
                {days.map((d, i) => {
                    const ds = dateStr(d);
                    const dayLeaves = leaves.filter(l => l.date === ds && (selectedClients.length === 0 || selectedClients.includes(l.client_name)));
                    const count = dayLeaves.length;
                    const isToday = i === 0;
                    const isExpanded = expandedDay === ds;
                    return (
                        <div key={ds} className="flex flex-col items-center gap-1 flex-1">
                            <span className={`text-[9px] font-bold uppercase ${isToday ? 'text-violet-400' : 'text-slate-500'}`}>
                                {d.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                            <button
                                onClick={() => count > 0 && setExpandedDay(isExpanded ? null : ds)}
                                className={`w-full py-1.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all ${count > 0
                                    ? (isToday ? 'bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30 cursor-pointer' : 'bg-slate-700/50 text-white border-slate-600 hover:bg-slate-600/60 cursor-pointer')
                                    : 'bg-white/[0.02] text-slate-600 border-white/5 cursor-default'
                                    } ${isExpanded ? 'ring-1 ring-violet-500/50' : ''}`}
                            >
                                <span className={`text-[12px] leading-none ${count > 0 ? 'font-black' : 'font-medium'}`}>{d.getDate()}</span>
                                {count > 0 && (
                                    <div className="w-1 h-1 rounded-full bg-violet-400 shadow-[0_0_5px_theme(colors.violet.400)]" />
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
            {/* Expanded day names */}
            {expandedDay && (() => {
                const dayLeaves = leaves.filter(l => l.date === expandedDay && (selectedClients.length === 0 || selectedClients.includes(l.client_name)));
                if (dayLeaves.length === 0) return null;
                const expandedDate = new Date(expandedDay + 'T00:00:00');
                return (
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 space-y-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-violet-400 mb-2">
                            {expandedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} — {dayLeaves.length} on leave
                        </p>
                        {dayLeaves.map((l, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center text-[9px] font-black text-violet-300 flex-shrink-0">
                                        {l.employee_name[0]?.toUpperCase()}
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-200 leading-tight">{l.employee_name}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-[9px] text-slate-500 font-medium">{l.client_name}</span>
                                    <span className="text-[8px] font-bold uppercase text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">{l.leave_type}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MasterConsole({ currentUserId, isMaster }: { currentUserId: string, isMaster: boolean }) {
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
    const filterDropdownRef = useRef<HTMLDivElement>(null);
    const recordsRef = useRef<UserStatusRecord[]>([]); // always mirrors records state
    const [notifications, setNotifications] = useState<ActivityNote[]>([]);
    const [cleanIds, setCleanIds] = useState<Set<string>>(new Set());

    // Admin Details Slider State
    const [selectedUserDetail, setSelectedUserDetail] = useState<UserStatusRecord | null>(null);
    const [detailLogs, setDetailLogs] = useState<TimeLog[]>([]);
    const [addLogType, setAddLogType] = useState('punch_in');
    const [addLogTime, setAddLogTime] = useState('08:00 AM');
    const [addLogDate, setAddLogDate] = useState(getTodayKey());

    // Subscribe to detail logs when admin opens slide-over
    useEffect(() => {
        if (selectedUserDetail) {
            getLogs(selectedUserDetail.user.id, dateStr(new Date())).then(setDetailLogs);
        }
    }, [selectedUserDetail]);

    async function handleAdminDeleteLog(id: string) {
        if (!confirm('Permanently delete this timeline action?')) return;
        try {
            await deleteTimeLog(id);
            setDetailLogs(prev => prev.filter(l => l.id !== id));
        } catch (e: any) { alert(e.message); }
    }

    async function handleAdminAddLog(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedUserDetail) return;
        // Parse the selected date and time strings to create absolute timestamp in local time
        const [datePart] = addLogDate.split('T');
        const d = new Date(`${datePart}T00:00:00`);
        const isPM = addLogTime.includes('PM');
        let [hStr, mStr] = addLogTime.replace(/ [AP]M/, '').split(':');
        let h = parseInt(hStr, 10);
        if (isPM && h !== 12) h += 12;
        if (!isPM && h === 12) h = 0;
        d.setHours(h, parseInt(mStr, 10), 0, 0);

        const newLog: TimeLog = {
            id: generateUUID(),
            eventType: addLogType as TimeLog['eventType'],
            timestamp: d.getTime(), // Use the constructed Date's timestamp
            date: addLogDate,       // Use the selected date string
            addedBy: currentUserId
        };
        try {
            await insertLog(selectedUserDetail.user.id, newLog);
            const latest = await getLogs(selectedUserDetail.user.id, dateStr(d)); // Use 'd' for dateStr
            setDetailLogs(latest);
        } catch (e: any) { alert(e.message); }
    }

    const dismissNote = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        if (!clientFilterOpen) return;
        function handleOutside(e: MouseEvent) {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
                setClientFilterOpen(false);
            }
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [clientFilterOpen]);

    // ── Popup channel — separate from the main refresh channel ──────────────
    useEffect(() => {
        const ch = supabase
            .channel('mc_activity_popups')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'time_logs' }, (payload) => {
                const { user_id, event_type } = payload.new as { user_id: string; event_type: string };
                const meta = EVENT_META[event_type];
                if (!meta) return;
                // Read from ref — no state updater side-effects, never runs twice
                const rec = recordsRef.current.find(r => r.user.id === user_id);
                if (!rec) return;
                const note: ActivityNote = {
                    id: `${user_id}-${event_type}-${Date.now()}`,
                    name: rec.user.name,
                    event: meta.label,
                    color: meta.color,
                    icon: meta.icon,
                    ts: Date.now(),
                };
                setNotifications(p => [note, ...p].slice(0, 5));
            })
            .subscribe();
        return () => { ch.unsubscribe(); };
    }, []);

    const refresh = useCallback(async () => {
        const [data, pData, clientsData, leavesData] = await Promise.all([
            getAllUsersStatus(), getPendingUsers(), getClients(), getLeaves()
        ]);
        if (!mountedRef.current) return;
        setRecords(data);
        recordsRef.current = data;
        setPending(pData);
        setClients(clientsData);
        setLeaves(leavesData);
        setLoading(false);
        // Load discipline IDs in background (non-blocking)
        get7DayBreakStats().then(stats => {
            const ids = new Set(
                stats
                    .filter(s =>
                        s.daysChecked >= 3 &&
                        s.breakViolDays === 0 &&
                        s.brbViolDays === 0 &&
                        s.avgBreakMs < 75 * 60 * 1000 * 0.80
                    )
                    .map(s => s.user.id)
            );
            if (mountedRef.current) setCleanIds(ids);
        }).catch(() => { });
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
        idle: augmented.filter(r => r.status === 'idle').length,
    }), [augmented]);


    return (
        <>

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


            {/* ── MAIN GRID: People Table + Week Calendar ────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 min-h-0 items-start">

                {/* LEFT: Dashboard Data Map */}
                <div className="xl:col-span-3 flex flex-col gap-6 min-h-0">

                    {/* MANAGER OVERVIEW PANEL / FILTERS */}
                    {!loading && (() => {
                        const total = augmented.length || 1;
                        const tiles = [
                            { label: 'All', k: null, val: total, color: 'text-slate-200', bg: 'bg-[#11111a] border-white/10 hover:bg-white/5', acc: 'bg-slate-500' },
                            { label: 'Working', k: 'working', val: stats.working, color: 'text-emerald-400', bg: 'bg-[#0a0a1a] border-white/5 hover:bg-emerald-950/40', acc: 'bg-emerald-500' },
                            { label: 'On Break', k: 'on_break', val: stats.onBreak, color: 'text-amber-400', bg: 'bg-[#0a0a1a] border-white/5 hover:bg-amber-950/40', acc: 'bg-amber-500' },
                            { label: 'BRB', k: 'on_brb', val: stats.onBrb, color: 'text-indigo-400', bg: 'bg-[#0a0a1a] border-white/5 hover:bg-indigo-950/40', acc: 'bg-indigo-500' },
                            { label: 'On Leave', k: 'on_leave', val: stats.onLeave, color: 'text-violet-400', bg: 'bg-[#0a0a1a] border-white/5 hover:bg-violet-950/40', acc: 'bg-violet-500' },
                            { label: 'Logged Out', k: 'punched_out', val: stats.done + stats.idle, color: 'text-slate-400', bg: 'bg-[#0a0a1a] border-white/5 hover:bg-slate-900/50', acc: 'bg-slate-600' },
                        ];
                        return (
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-2">
                                {tiles.map(s => (
                                    <button
                                        key={s.label}
                                        onClick={() => setStatusFilter(s.k)}
                                        className={`p-4 rounded-xl flex flex-col text-left border relative overflow-hidden group transition-all duration-300 ${s.bg} ${statusFilter === s.k ? 'ring-2 ring-white/20 scale-[1.02] shadow-lg' : ''}`}
                                    >
                                        <div className={`absolute top-0 left-0 right-0 h-1 ${s.acc} shadow-[0_0_10px_currentColor]`} />
                                        <p className={`text-3xl font-black tabular-nums tracking-tighter leading-none mt-2 ${s.color}`}>{s.val}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-2">{s.label}</p>
                                    </button>
                                ))}
                            </div>
                        );
                    })()}

                    {/* Filter row */}
                    <div className="flex z-10 items-center justify-between bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg relative">
                        <div className="flex items-center gap-3 flex-1 flex-wrap">
                            <Wifi size={16} className="text-emerald-400 animate-pulse flex-shrink-0 ml-1 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                            <span className="text-[12px] font-black uppercase tracking-[0.2em] text-emerald-400">Live</span>

                            <div className="w-px h-6 bg-white/10 mx-2" />

                            {/* Search */}
                            <div className="relative flex-1 max-w-sm ml-auto mr-4">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                <input type="text" placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20 transition-all font-semibold" />
                                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"><XCircle size={16} /></button>}
                            </div>

                            <div className="w-px h-6 bg-white/10 mx-1" />

                            {/* Multi-select Client Filter */}
                            <div className="relative" ref={filterDropdownRef}>
                                <button type="button" onClick={() => setClientFilterOpen(!clientFilterOpen)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-transparent hover:bg-white/[0.04] rounded-xl transition-colors text-[13px] font-bold text-slate-300">
                                    <Filter size={14} className="text-slate-500" />
                                    {selectedClients.length === 0 ? 'All Teams' : `${selectedClients.length} Teams`}
                                    <ChevronDown size={14} className={`text-slate-500 transition-transform ${clientFilterOpen ? 'rotate-180' : ''}`} />
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

                    {/* ── INSIGHTS STRIP ────────────────────────────── */}
                    {!loading && (() => {
                        const now = Date.now();
                        const overdueBreak = augmented.filter(r =>
                            r.status === 'on_break' && r.breakStart && (now - r.breakStart) > DANGER_MS
                        );
                        if (overdueBreak.length === 0) return null;
                        return (
                            <div className="flex flex-col gap-1.5 mb-2 shadow-lg">
                                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-[13px] font-bold text-rose-400 border-rose-500/30 bg-rose-900/20 shadow-[0_4px_20px_rgba(225,29,72,0.15)]">
                                    <AlertTriangle size={15} className="flex-shrink-0 animate-pulse" />
                                    {overdueBreak.map(r => r.user.name.split(' ')[0]).join(', ')} {overdueBreak.length === 1 ? 'has' : 'have'} been on break &gt;30m
                                </div>
                            </div>
                        );
                    })()}


                    {/* ── CARD GRID RENDERING ────────────────────────────── */}
                    {!loading && sorted.length > 0 && (() => {
                        // 1. Group by client (Team)
                        const groups = sorted.reduce((acc, r) => {
                            if (!acc[r.user.clientName]) acc[r.user.clientName] = [];
                            acc[r.user.clientName].push(r);
                            return acc;
                        }, {} as Record<string, typeof sorted>);

                        const clientNames = selectedClients.length > 0
                            ? selectedClients.filter(c => groups[c])
                            : Object.keys(groups).sort();

                        return clientNames.map(cName => {
                            const groupRows = groups[cName];
                            if (!groupRows || groupRows.length === 0) return null;
                            const total = groupRows.length;
                            const gWorking = groupRows.filter(x => x.status === 'working').length;
                            const gBreak = groupRows.filter(x => x.status === 'on_break').length;
                            const gOffline = groupRows.filter(x => x.status === 'punched_out' || x.status === 'idle').length;
                            const gViol = groupRows.filter(x => (x.status === 'on_break' && x.breakStart && Date.now() - x.breakStart > DANGER_MS) || (x.status === 'on_brb' && x.brbStart && Date.now() - x.brbStart > DANGER_MS)).length;

                            // Calculate avg break across group for currently active (break/brb) people
                            const gOnBreak = groupRows.filter(x => x.status === 'on_break' && x.breakStart);
                            const gOnBrb = groupRows.filter(x => x.status === 'on_brb' && x.brbStart);
                            const gAvgBreakMs = gOnBreak.length > 0 ? gOnBreak.reduce((s, x) => s + (Date.now() - (x.breakStart || 0)), 0) / gOnBreak.length : 0;
                            const gAvgBrbMs = gOnBrb.length > 0 ? gOnBrb.reduce((s, x) => s + (Date.now() - (x.brbStart || 0)), 0) / gOnBrb.length : 0;
                            return (
                                <div key={cName} className="mb-6 last:mb-0 bg-white/[0.01] border border-white/[0.03] p-5 rounded-[1.5rem]">
                                    {/* Team Header */}
                                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                        <div className="flex flex-wrap items-center gap-4">
                                            <h2 className="text-[15px] font-black text-white uppercase tracking-[0.2em]">{cName}</h2>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">{total} Reps</span>
                                                {gWorking > 0 && <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">{gWorking} Active</span>}
                                                {gBreak > 0 && <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">{gBreak} Break</span>}
                                                {gOffline > 0 && <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-500/10 px-2.5 py-1 rounded-full border border-slate-500/20">{gOffline} Offline</span>}
                                                {gViol > 0 && <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 animate-pulse">⚠ {gViol} Overdue</span>}
                                            </div>
                                        </div>
                                        {/* Team avg break/brb stats */}
                                        {(gOnBreak.length > 0 || gOnBrb.length > 0) && (
                                            <div className="flex items-center gap-3 text-[9px] font-bold">
                                                {gOnBreak.length > 0 && (
                                                    <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                                                        <Coffee size={9} className="flex-shrink-0" />
                                                        <span>Avg Break: {formatDuration(gAvgBreakMs)}</span>
                                                    </div>
                                                )}
                                                {gOnBrb.length > 0 && (
                                                    <div className="flex items-center gap-1 text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                                                        <RotateCcw size={9} className="flex-shrink-0" />
                                                        <span>Avg BRB: {formatDuration(gAvgBrbMs)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Employee List  (Rows replacing Grid) */}
                                    <div className="flex flex-col gap-2">
                                        {groupRows.map(r => (
                                            <EmployeeRow
                                                key={r.user.id}
                                                r={r}
                                                isMaster={isMaster}
                                                isClean={cleanIds.has(r.user.id)}
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
                                                onClickRow={() => setSelectedUserDetail(r)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div> {/* End Left Col */}

                {/* RIGHT: Weekly Leave Calendar + Violators */}
                <div className="flex flex-col gap-4">

                    {/* Leave Calendar — compact 7-day number bar */}
                    <div className="rounded-2xl border border-white/8 bg-[#0a0a18] p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-indigo-400" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Leave · Next 7 Days</p>
                            </div>
                            {(() => {
                                const todayCount = weekLeaves.filter(l =>
                                    l.date === dateStr(new Date()) &&
                                    (selectedClients.length === 0 || selectedClients.includes(l.client_name))
                                ).length;
                                return todayCount > 0
                                    ? <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">{todayCount} today</span>
                                    : <span className="text-[10px] text-slate-700 font-semibold">All clear today</span>;
                            })()}
                        </div>
                        <WeekLeaveCalendar leaves={weekLeaves} selectedClients={selectedClients} />
                    </div>

                    {/* Star Performers */}
                    <div className="rounded-2xl border border-white/8 bg-[#0a0a18] p-4">
                        <StarPerformers clientFilter={selectedClients} />
                    </div>

                    {/* Break Violators Panel */}
                    <div className="rounded-2xl border border-white/8 bg-[#0a0a18] p-4">
                        <ViolatorsPanel clientFilter={selectedClients} />
                    </div>
                </div>
            </div> {/* End Main Grid */}

            <p className="text-[10px] text-slate-700 text-center tracking-wider uppercase mt-4">Live via Supabase Realtime</p>

            {/* ── Activity Notification Toast Stack ──── */}
            <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
                <AnimatePresence mode="popLayout">
                    {notifications.map(n => (
                        <div key={n.id} className="pointer-events-auto">
                            <ActivityToast note={n} onDismiss={() => dismissNote(n.id)} />
                        </div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Admin Details Modal Slide-over */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {selectedUserDetail && (
                        <>
                            {/* Backdrop */}
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedUserDetail(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />

                            {/* Slide Panel */}
                            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0a0a1a] border-l border-white/10 shadow-2xl z-[150] flex flex-col">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{selectedUserDetail.user.name}</h2>
                                        <p className="text-sm text-slate-500">{selectedUserDetail.user.clientName} · {selectedUserDetail.user.shiftStart} to {selectedUserDetail.user.shiftEnd}</p>
                                    </div>
                                    <button onClick={() => setSelectedUserDetail(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-8">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Timeline Editor</h3>
                                            <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Admin Override Active</span>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                            <TimelineLog logs={detailLogs} isAdmin={true} onDeleteLog={handleAdminDeleteLog} />
                                        </div>
                                    </div>

                                    <div className="border-t border-white/5 pt-8">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Add Missing Log Event</h3>
                                        <form onSubmit={handleAdminAddLog} className="space-y-4">
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Event Type</label>
                                                    <div className="relative">
                                                        <select value={addLogType} onChange={e => setAddLogType(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 pl-3 pr-8 text-sm font-semibold text-white appearance-none focus:outline-none focus:border-blue-500/50">
                                                            <option value="punch_in" className="bg-slate-900">Punch In</option>
                                                            <option value="punch_out" className="bg-slate-900">Punch Out</option>
                                                            <option value="break_start" className="bg-slate-900">Break Start</option>
                                                            <option value="break_end" className="bg-slate-900">Break End</option>
                                                            <option value="brb_start" className="bg-slate-900">BRB Start</option>
                                                            <option value="brb_end" className="bg-slate-900">BRB End</option>
                                                        </select>
                                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Date</label>
                                                    <input
                                                        type="date"
                                                        value={addLogDate}
                                                        onChange={e => setAddLogDate(e.target.value)}
                                                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 pl-3 pr-3 text-sm font-semibold text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Time</label>
                                                    <CustomTimePicker value={addLogTime} onChange={setAddLogTime} />
                                                </div>
                                            </div>
                                            <button type="submit" className="w-full py-3 mt-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-black text-xs font-black uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_20px_rgba(59,130,246,0.2)] transition-all">
                                                Insert Timeline Event
                                            </button>
                                            <p className="text-[10px] text-slate-500 text-center px-4 leading-tight">This will permanently mutate the employee's timeline. Refresh the main console after inserting/deleting events to recalculate their status.</p>
                                        </form>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
