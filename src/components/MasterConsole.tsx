'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCw, Coffee, RotateCcw, Briefcase, XCircle,
    AlertTriangle, Clock, Users, Wifi, UserCheck, UserX, Trash2, Calendar,
    TrendingUp, Activity, CheckCircle2, ChevronDown, Search, Filter, Bell, X, Pencil, Save
} from 'lucide-react';
import {
    getAllUsersStatus, getPendingUsers, approveUser, deleteUser,
    masterOverride, deleteUserLogsForToday, get7DayBreakStats,
    getLogs, insertLog, deleteTimeLog, getLeaves, updateUser,
    UserStatusRecord, ClientRow, getClients
} from '@/lib/store';
import { User, TimeLog, LeaveRecord } from '@/types';
import { formatDuration, generateUUID, getTodayKey, dateStr } from '@/lib/timeUtils';
import StarPerformers from './StarPerformers';
import ViolatorsPanel from './ViolatorsPanel';
import TimelineLog from './TimelineLog';
import { subscribe } from '@/lib/realtime';
import CustomSelect from './ui/CustomSelect';

// UI Specific Constants & Types
const DANGER_MS = 30 * 60 * 1000; // 30 minutes
const WARN_MS = 15 * 60 * 1000;  // 15 minutes

export interface ActivityNote {
    id: string;
    name: string;
    event: string;
    color: string;
    icon: any;
    ts: number;
}

const EVENT_META: Record<string, { label: string, color: string, icon: any }> = {
    punch_in: { label: 'Clock In', color: 'text-emerald-400', icon: Clock },
    punch_out: { label: 'Clock Out', color: 'text-rose-400', icon: XCircle },
    break_start: { label: 'Break Start', color: 'text-amber-400', icon: Coffee },
    break_end: { label: 'Break End', color: 'text-emerald-400', icon: Clock },
    brb_start: { label: 'BRB Start', color: 'text-indigo-400', icon: RotateCcw },
    brb_end: { label: 'BRB End', color: 'text-emerald-400', icon: Clock },
};

function ActivityToast({ note, onDismiss }: { note: ActivityNote, onDismiss: () => void }) {
    useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t); }, [onDismiss]);
    return (
        <motion.div initial={{ opacity: 0, x: 20, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className="flex items-center gap-3 bg-[#0c0c14]/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-2xl min-w-[280px]">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 ${note.color}`}>
                <note.icon size={20} />
            </div>
            <div className="flex-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{note.event}</p>
                <p className="text-sm font-bold text-white">{note.name}</p>
            </div>
            <button onClick={onDismiss} className="p-1 hover:bg-white/5 rounded-full text-slate-600 transition-colors"><X size={14} /></button>
        </motion.div>
    );
}

function LiveTimer({ since, isBreakOrBrb }: { since: number, isBreakOrBrb?: boolean }) {
    const [e, setE] = useState(Math.max(0, Date.now() - since));
    useEffect(() => { const id = setInterval(() => setE(Math.max(0, Date.now() - since)), 1000); return () => clearInterval(id); }, [since]);
    const color = isBreakOrBrb
        ? (e >= DANGER_MS ? 'text-rose-400' : e >= WARN_MS ? 'text-amber-400' : 'text-emerald-400')
        : 'text-emerald-400';
    const prefix = isBreakOrBrb && e >= DANGER_MS ? '⚠ ' : '';
    return <span className={`font-mono font-bold tabular-nums ${color}`}>{prefix}{formatDuration(e)}</span>;
}

const STATUS = {
    idle: { 
        label: 'Offline', 
        dot: 'bg-slate-500', 
        ring: 'ring-slate-500/0', 
        text: 'text-slate-400', 
        cardBg: 'bg-[linear-gradient(145deg,rgba(10,10,24,0.6),rgba(5,5,15,0.9))] border-white/5 hover:bg-white/[0.04] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.02)]', 
        badgeBg: 'bg-slate-800/80 border-slate-700/50 text-slate-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_2px_6px_rgba(0,0,0,0.6)]',
        aura: 'from-slate-500/0 to-slate-500/0' 
    },
    working: { 
        label: 'Flow State', 
        dot: 'bg-emerald-400 animate-pulse drop-shadow-[0_0_8px_#10b981]', 
        ring: 'ring-emerald-400/30', 
        text: 'text-emerald-400', 
        cardBg: 'bg-[margin-box,border-box] bg-[linear-gradient(120deg,rgba(16,185,129,0.15),rgba(4,4,15,0.8))] border-emerald-500/20 shadow-[-4px_-4px_10px_rgba(255,255,255,0.01),8px_8px_20px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] hover:brightness-110 font-black', 
        badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)]',
        aura: 'from-emerald-500/20 via-emerald-500/5 to-transparent'
    },
    on_break: { 
        label: 'Resting', 
        dot: 'bg-amber-400 animate-pulse drop-shadow-[0_0_8px_#f59e0b]', 
        ring: 'ring-amber-400/30', 
        text: 'text-amber-400', 
        cardBg: 'bg-[margin-box,border-box] bg-[linear-gradient(120deg,rgba(245,158,11,0.15),rgba(4,4,15,0.8))] border-amber-500/20 shadow-[-4px_-4px_10px_rgba(255,255,255,0.01),8px_8px_20px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] hover:brightness-110 font-black', 
        badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)]',
        aura: 'from-amber-500/20 via-amber-500/5 to-transparent'
    },
    on_brb: { 
        label: 'Moving', 
        dot: 'bg-blue-400 animate-pulse drop-shadow-[0_0_8px_#3b82f6]', 
        ring: 'ring-blue-400/30', 
        text: 'text-blue-400', 
        cardBg: 'bg-[margin-box,border-box] bg-[linear-gradient(120deg,rgba(59,130,246,0.15),rgba(4,4,15,0.8))] border-blue-500/20 shadow-[-4px_-4px_10px_rgba(255,255,255,0.01),8px_8px_20px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] hover:brightness-110 font-black', 
        badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)]',
        aura: 'from-blue-500/20 via-blue-500/5 to-transparent'
    },
    punched_out: { 
        label: 'Logged Out', 
        dot: 'bg-slate-500', 
        ring: 'ring-slate-400/0', 
        text: 'text-slate-500', 
        cardBg: 'bg-[linear-gradient(145deg,rgba(30,41,59,0.3),rgba(15,23,42,0.8))] border-slate-700/40 shadow-[-2px_-2px_6px_rgba(255,255,255,0.01),4px_4px_12px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.04)]', 
        badgeBg: 'bg-slate-800/80 border-slate-700/50 text-slate-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_2px_6px_rgba(0,0,0,0.4)]',
        aura: 'from-slate-500/0 to-slate-500/0'
    },
    on_leave: { 
        label: 'Scheduled Leave', 
        dot: 'bg-violet-400', 
        ring: 'ring-violet-400/30', 
        text: 'text-violet-400', 
        cardBg: 'bg-[linear-gradient(120deg,rgba(139,92,246,0.15),rgba(4,4,15,0.8))] border-violet-500/20 shadow-[-4px_-4px_10px_rgba(255,255,255,0.01),8px_8px_20px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] hover:brightness-110 font-black', 
        badgeBg: 'bg-violet-500/15 border-violet-500/30 text-violet-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_2px_6px_rgba(0,0,0,0.6)]',
        aura: 'from-violet-500/20 via-violet-500/5 to-transparent'
    },
};

const MC_BREAK_OVERSTAY_MS = 45 * 60 * 1000;
const MC_BRB_OVERSTAY_MS = 10 * 60 * 1000;

function fmtMs(ms: number): string {
    const mins = Math.floor(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function EmployeeRow({ r, isMaster, isClean, onEndBreak, onEndBrb, onPunchOut, confirmingEnd, onConfirmEnd, onCancelEnd, confirmingDelete, onConfirmDelete, onCancelDelete, onDeleteRequest, onClickRow }: any) {
    const cfg = STATUS[r.status as keyof typeof STATUS] ?? STATUS.idle;
    const isDone = r.status === 'punched_out' || r.status === 'idle';
    const isLeave = r.status === 'on_leave';
    const isBreak = r.status === 'on_break';
    const isBrb = r.status === 'on_brb';
    const isWorking = r.status === 'working';
    const workedMs = r.workedMs ?? (r.punchIn && r.punchOut ? r.punchOut - r.punchIn : 0);
    const now = Date.now();
    const breakElapsed = isBreak && r.breakStart ? now - r.breakStart : 0;
    const brbElapsed = isBrb && r.brbStart ? now - r.brbStart : 0;
    const breakOverstay = breakElapsed > MC_BREAK_OVERSTAY_MS;
    const brbOverstay = brbElapsed > MC_BRB_OVERSTAY_MS;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClickRow} 
            className={`relative flex items-center p-3 mb-2 rounded-2xl border ${cfg.cardBg} group transition-all duration-300 cursor-pointer overflow-hidden`}
            style={(breakOverstay || brbOverstay) ? { borderLeftWidth: '3px', borderLeftColor: breakOverstay ? 'rgba(245,158,11,0.6)' : 'rgba(239,68,68,0.5)' } : undefined}
        >
            {/* Background Aura Glow */}
            <div className={`absolute -inset-1 bg-gradient-to-r ${cfg.aura} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10`} />

            {/* Left: Avatar + Info */}
            <div className="flex items-center gap-4 w-[34%] pl-2 shrink-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 transition-transform duration-500 group-hover:scale-110 ${isDone || isLeave ? 'bg-slate-800 text-slate-500 border border-slate-700/50' : cfg.text.replace('text-', 'bg-').replace('-400', '-500/20') + ' border border-current shadow-[0_0_15px_currentColor] drop-shadow-xl ' + cfg.text}`}>
                    {r.user.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-black tracking-tight truncate ${isDone ? 'text-slate-500 font-bold' : 'text-white'}`}>{r.user.name}</h3>
                        {isClean && (
                            <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30 text-[9px] font-black uppercase tracking-tighter" title="Perfect 7-day compliance">
                                <span>AURA MAX</span>
                            </div>
                        )}
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{r.user.clientName || 'Internal'}</p>
                </div>
            </div>

            {/* Middle: Status Badge */}
            <div className="w-[14%] shrink-0">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.15em] ${cfg.badgeBg}`}>
                    {(!isDone && !isLeave) && <div className={`w-2 h-2 rounded-full ${cfg.dot} shadow-[0_0_8px_currentColor]`} />}
                    {cfg.label}
                </div>
            </div>

            {/* Middle: Timer section */}
            <div className="w-[28%] flex items-center shrink-0">
                {isLeave && <p className="text-xs font-black text-violet-400 opacity-80 tracking-wide">ON LEAVE</p>}
                {isDone && workedMs > 0 && (
                    <div className="flex flex-col">
                        <span className="text-[9px] text-slate-600 uppercase tracking-widest font-black mb-1">Shift Total</span>
                        <span className="font-mono text-slate-400 font-black text-sm">{formatDuration(workedMs)}</span>
                    </div>
                )}
                {isDone && !workedMs && !isLeave && <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">OFFLINE</p>}
                {!isLeave && !isDone && (
                    <div className="flex items-center gap-2 w-full">
                        {isWorking && r.workStart && (
                            <div className="flex flex-col">
                                <span className="text-[9px] text-emerald-500/60 uppercase tracking-widest font-black mb-1">Session</span>
                                <div className="text-base font-black tracking-tight text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]"><LiveTimer since={r.workStart} /></div>
                            </div>
                        )}
                        {isBreak && r.breakStart && (
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-amber-500/60 uppercase tracking-widest font-black mb-1">Resting</span>
                                    <div className={`text-base font-black tracking-tight ${breakOverstay ? 'text-red-400' : 'text-amber-400'} drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]`}><LiveTimer since={r.breakStart} isBreakOrBrb /></div>
                                </div>
                                {breakOverstay && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[9px] font-black text-red-400 animate-pulse">
                                        ⚠ &gt;45m
                                    </span>
                                )}
                            </div>
                        )}
                        {isBrb && r.brbStart && (
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-blue-500/60 uppercase tracking-widest font-black mb-1">Moving</span>
                                    <div className={`text-base font-black tracking-tight ${brbOverstay ? 'text-red-400' : 'text-blue-400'} drop-shadow-[0_0_10px_rgba(96,165,250,0.4)]`}><LiveTimer since={r.brbStart} isBreakOrBrb /></div>
                                </div>
                                {brbOverstay && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[9px] font-black text-red-400 animate-pulse">
                                        ⚠ &gt;10m
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            {isMaster ? (
                <div className="flex items-center justify-end gap-3 pr-2 w-[24%] shrink-0" onClick={e => e.stopPropagation()}>
                    {isBreak && !confirmingEnd && (
                        <button onClick={onEndBreak} className="px-5 py-2.5 text-xs uppercase tracking-widest font-black rounded-xl bg-orange-500 text-orange-950 hover:brightness-110 active:scale-95 transition-all shadow-lg hover:shadow-orange-500/20 border border-orange-400/50">End Break</button>
                    )}
                    {isBrb && !confirmingEnd && (
                        <button onClick={onEndBrb} className="px-5 py-2.5 text-xs uppercase tracking-widest font-black rounded-xl bg-blue-500 text-white hover:brightness-110 active:scale-95 transition-all shadow-lg hover:shadow-blue-500/20 border border-blue-400/50">End BRB</button>
                    )}
                    {!['idle', 'punched_out', 'on_leave'].includes(r.status) && (
                        confirmingEnd
                            ? <div className="flex items-center gap-2">
                                <button onClick={onConfirmEnd} className="px-5 py-2.5 text-xs font-black rounded-xl bg-rose-600 text-white hover:brightness-110 uppercase tracking-widest active:scale-95 transition-all shadow-lg hover:shadow-rose-500/20 border border-rose-400/50">Yes, Out</button>
                                <button onClick={onCancelEnd} className="px-5 py-2.5 text-xs font-black rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 uppercase tracking-widest border border-white/10 active:scale-95 transition-all">Cancel</button>
                            </div>
                            : (!isBreak && !isBrb) && (
                                <button onClick={onPunchOut} className="px-5 py-2.5 text-xs rounded-xl bg-white/5 text-slate-400 border border-white/10 shadow-sm hover:border-white/30 hover:text-white transition-all opacity-0 group-hover:opacity-100 uppercase tracking-widest font-black backdrop-blur-sm">
                                    Clock Out
                                </button>
                            )
                    )}

                    <div className="ml-2 pl-2 flex items-center border-l border-white/5">
                        {confirmingDelete
                            ? <div className="flex items-center gap-2 bg-rose-500/10 p-1.5 rounded-xl border border-rose-500/20">
                                <button onClick={onConfirmDelete} className="text-[10px] font-black px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 uppercase">Delete</button>
                                <button onClick={onCancelDelete} className="text-[10px] font-black px-3 py-1.5 rounded-lg bg-white/10 text-slate-400 hover:bg-white/20 uppercase">Cancel</button>
                            </div>
                            : <button onClick={onDeleteRequest} className="p-2.5 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                        }
                    </div>
                </div>
            ) : null}
        </motion.div>
    );
}

export function MonthlyLeaveCalendar({ leaves, selectedClients }: { leaves: LeaveRecord[], selectedClients: string[] }) {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = viewDate.toLocaleString('default', { month: 'long' });
    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
    const todayStr = dateStr(new Date());

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-1">
                <button onClick={prevMonth} className="p-1 px-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
                    <ChevronDown size={14} className="rotate-90" />
                </button>
                <div className="text-center">
                    <p className="text-[13px] font-black text-white uppercase tracking-wider">{monthName}</p>
                    <p className="text-[9px] font-bold text-slate-600 tracking-widest">{year}</p>
                </div>
                <button onClick={nextMonth} className="p-1 px-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
                    <ChevronDown size={14} className="-rotate-90" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center border-b border-white/5 pb-2 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <span key={i} className="text-[9px] font-black text-slate-700 uppercase">{d}</span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((dayNum, i) => {
                    if (dayNum === null) return <div key={`empty-${i}`} className="h-8" />;
                    const d = new Date(year, month, dayNum);
                    const ds = dateStr(d);
                    const dayLeaves = leaves.filter(l => l.date === ds && (selectedClients.length === 0 || selectedClients.includes(l.client_name)));
                    const count = dayLeaves.length;
                    const isToday = ds === todayStr;
                    const isSelected = selectedDay === ds;
                    return (
                        <button
                            key={ds}
                            onClick={() => count > 0 && setSelectedDay(isSelected ? null : ds)}
                            className={`h-9 rounded-lg border flex flex-col items-center justify-center relative transition-all ${count > 0 ? (isToday ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'bg-slate-700/30 text-white border-slate-600/40 hover:bg-slate-600/50') : (isToday ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-white/[0.01] text-slate-600 border-transparent hover:border-white/5')} ${isSelected ? 'ring-2 ring-violet-500/50 border-violet-500/40' : ''} ${count > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <span className={`text-[11px] tabular-nums ${count > 0 ? 'font-black' : 'font-medium'}`}>{dayNum}</span>
                            {count > 0 && (
                                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]" />
                            )}
                        </button>
                    );
                })}
            </div>
            <AnimatePresence>
                {selectedDay && (() => {
                    const dayLeaves = leaves.filter(l => l.date === selectedDay && (selectedClients.length === 0 || selectedClients.includes(l.client_name)));
                    if (dayLeaves.length === 0) return null;
                    const expandedDate = new Date(selectedDay + 'T00:00:00');
                    return (
                        <motion.div initial={{ opacity: 0, height: 0, y: 10 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: 10 }} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 mt-2 overflow-hidden shadow-2xl">
                            <div className="flex items-center justify-between mb-3 border-b border-violet-500/10 pb-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-violet-400">{expandedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                <span className="text-[9px] font-black uppercase text-violet-500/80 bg-violet-500/10 px-2 py-0.5 rounded-full">{dayLeaves.length} Leaves</span>
                            </div>
                            <div className="space-y-2.5 max-h-48 overflow-y-auto scrollbar-thin">
                                {dayLeaves.map((l, idx) => (
                                    <div key={idx} className="flex items-start justify-between gap-3 group">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-[10px] font-black text-violet-300 flex-shrink-0 border border-violet-500/20">{l.employee_name[0]?.toUpperCase()}</div>
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-black text-slate-200 truncate group-hover:text-white transition-colors">{l.employee_name}</p>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{l.client_name}</p>
                                            </div>
                                        </div>
                                        <span className="text-[8px] font-black uppercase text-violet-400 bg-violet-500/10 border border-violet-500/30 px-2 py-1 rounded-md mt-0.5">{l.leave_type}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function MasterConsole({ isMaster, currentUserId }: { isMaster: boolean; currentUserId: string }) {
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
    const recordsRef = useRef<UserStatusRecord[]>([]);
    const [notifications, setNotifications] = useState<ActivityNote[]>([]);
    const [cleanIds, setCleanIds] = useState<Set<string>>(new Set());

    const [selectedUserDetail, setSelectedUserDetail] = useState<UserStatusRecord | null>(null);
    const [detailLogs, setDetailLogs] = useState<TimeLog[]>([]);
    const [addLogType, setAddLogType] = useState('punch_in');
    const [addLogTime, setAddLogTime] = useState('08:00');
    const [addLogDate, setAddLogDate] = useState(getTodayKey());
    const [timelineDeleteConfirmId, setTimelineDeleteConfirmId] = useState<string | null>(null);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);

    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileData, setProfileData] = useState<Partial<User>>({});

    useEffect(() => {
        if (selectedUserDetail) {
            setProfileData({
                name: selectedUserDetail.user.name,
                clientName: selectedUserDetail.user.clientName,
                shiftStart: selectedUserDetail.user.shiftStart,
                shiftEnd: selectedUserDetail.user.shiftEnd,
                workMode: selectedUserDetail.user.workMode,
            });
        }
    }, [selectedUserDetail]);

    async function handleUpdateProfile() {
        if (!selectedUserDetail) return;
        setIsSavingProfile(true);
        try {
            await updateUser(selectedUserDetail.user.id, profileData);
            await refresh(true);
            const data = await getAllUsersStatus(undefined, true);
            const updated = data.find(r => r.user.id === selectedUserDetail.user.id);
            if (updated) setSelectedUserDetail(updated);
        } catch (e: any) { alert(e.message); } finally { setIsSavingProfile(false); }
    }

    useEffect(() => {
        if (selectedUserDetail) getLogs(selectedUserDetail.user.id, addLogDate).then(setDetailLogs);
    }, [selectedUserDetail, addLogDate]);

    async function handleAdminAddLog(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedUserDetail) return;
        const [datePart] = addLogDate.split('T');
        const d = new Date(`${datePart}T00:00:00`);
        const [hStr, mStr] = addLogTime.split(':');
        d.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
        try {
            if (editingLogId) {
                const { updateTimeLog } = await import('@/lib/store');
                await updateTimeLog(editingLogId, { eventType: addLogType as TimeLog['eventType'], timestamp: d.getTime(), date: addLogDate });
                setEditingLogId(null);
            } else {
                await insertLog(selectedUserDetail.user.id, { id: generateUUID(), eventType: addLogType as TimeLog['eventType'], timestamp: d.getTime(), date: addLogDate, addedBy: currentUserId });
            }
            setDetailLogs(await getLogs(selectedUserDetail.user.id, addLogDate));
        } catch (e: any) { alert(e.message); }
    }

    const refreshStatus = useCallback(async (force = false) => {
        const data = await getAllUsersStatus(undefined, force);
        if (!mountedRef.current) return;
        setRecords(data); recordsRef.current = data; setLoading(false);
    }, []);

    const refreshMeta = useCallback(async (force = false) => {
        const [pData, clientsData, leavesData] = await Promise.all([getPendingUsers(), getClients(force), getLeaves(undefined, force)]);
        if (!mountedRef.current) return;
        setPending(pData); setClients(clientsData); setLeaves(leavesData);
    }, []);

    const refresh = useCallback(async (force = false) => {
        await Promise.all([refreshStatus(force), refreshMeta(force)]);
        setLoading(false);
    }, [refreshMeta, refreshStatus]);

    useEffect(() => {
        mountedRef.current = true; void refresh(true);
        const unsub1 = subscribe('time_logs', 'INSERT', () => refreshStatus(true));
        const unsub2 = subscribe('users', '*', () => refresh(true));
        return () => { mountedRef.current = false; unsub1(); unsub2(); };
    }, [refresh, refreshStatus]);

    const doOverride = async (userId: string, action: 'break_end' | 'brb_end' | 'punch_out') => {
        await masterOverride(userId, action, currentUserId);
        setConfirmEnd(null); await refresh(true);
    };
    const doApprove = async (userId: string) => { await approveUser(userId); await refresh(true); };
    const doReject = async (userId: string) => { await deleteUser(userId); await refresh(true); };
    const doClearLogs = async (userId: string) => { await deleteUserLogsForToday(userId); setConfirmDelete(null); await refresh(true); };

    const todayStr = useMemo(() => dateStr(new Date()), []);
    const filteredRecords = useMemo(() => {
        let f = records;
        // User explicitly requested WFO focus for this console
        f = f.filter(r => r.user.workMode === 'WFO');
        
        if (selectedClients.length > 0) f = f.filter(r => selectedClients.includes(r.user.clientName));
        if (search) { const q = search.toLowerCase(); f = f.filter(r => r.user.name.toLowerCase().includes(q) || r.user.clientName.toLowerCase().includes(q)); }
        return f;
    }, [records, selectedClients, search]);

    const augmented = useMemo(() => filteredRecords.map(r => {
        const leave = leaves.find(l => l.date === todayStr && l.employee_name === r.user.name);
        return leave ? { ...r, status: 'on_leave' as any } : r;
    }), [filteredRecords, leaves, todayStr]);

    const sorted = useMemo(() => {
        const order = ['on_break', 'on_brb', 'working', 'idle', 'punched_out', 'on_leave'];
        let list = [...augmented];
        if (statusFilter) list = list.filter(r => r.status === statusFilter);
        return list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    }, [augmented, statusFilter]);

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
            <AnimatePresence>
                {pending.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl border border-blue-500/30 bg-blue-900/10 p-4 space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest"><UserCheck size={14}/> Pending Approval ({pending.length})</div>
                        {pending.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-blue-500/10">
                                <div><p className="text-sm font-bold text-white">{p.name}</p><p className="text-[10px] text-slate-500 font-black uppercase">{p.clientName}</p></div>
                                <div className="flex gap-2">
                                    <button onClick={() => doApprove(p.id)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-black">Approve</button>
                                    <button onClick={() => doReject(p.id)} className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 text-xs font-black">Reject</button>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
                <div className="space-y-8">
                    {!loading && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {[
                                { label: 'Active', k: 'working', val: stats.working, color: 'text-emerald-400', acc: 'bg-emerald-500' },
                                { label: 'Break', k: 'on_break', val: stats.onBreak, color: 'text-amber-400', acc: 'bg-amber-500' },
                                { label: 'Away', k: 'on_brb', val: stats.onBrb, color: 'text-blue-400', acc: 'bg-blue-500' },
                                { label: 'Leave', k: 'on_leave', val: stats.onLeave, color: 'text-violet-400', acc: 'bg-violet-500' },
                                { label: 'Done', k: 'punched_out', val: stats.done, color: 'text-slate-400', acc: 'bg-slate-500' },
                                { label: 'Total', k: null, val: augmented.length, color: 'text-white', acc: 'bg-white/20' }
                            ].map(s => (
                                <button key={s.label} onClick={() => setStatusFilter(s.k)} className={`p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${statusFilter === s.k ? 'bg-white/10 border-white/20' : 'bg-white/[0.03] border-white/5 hover:bg-white/5'}`}>
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.acc} opacity-50 shadow-[0_0_10px_currentColor]`} />
                                    <p className={`text-2xl font-black tabular-nums mt-1 ${s.color}`}>{s.val}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">{s.label}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl p-3">
                        <div className="flex items-center gap-2 text-emerald-400 pl-2">
                            <Wifi size={16} className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Live Flow</span>
                        </div>
                        <div className="relative flex-1 group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-white" />
                            <input type="text" placeholder="Search operational fleet..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none font-bold" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {sorted.map(r => (
                            <EmployeeRow key={r.user.id} r={r} isMaster={isMaster} isClean={cleanIds.has(r.user.id)} onEndBreak={() => doOverride(r.user.id, 'break_end')} onEndBrb={() => doOverride(r.user.id, 'brb_end')} onPunchOut={() => setConfirmEnd(r.user.id)} confirmingEnd={confirmEnd === r.user.id} onConfirmEnd={() => doOverride(r.user.id, 'punch_out')} onCancelEnd={() => setConfirmEnd(null)} confirmingDelete={confirmDelete === r.user.id} onConfirmDelete={() => doClearLogs(r.user.id)} onCancelDelete={() => setConfirmDelete(null)} onDeleteRequest={() => setConfirmDelete(r.user.id)} onClickRow={() => setSelectedUserDetail(r)} />
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="panel-3d p-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-violet-400 mb-4 flex items-center gap-2"><Calendar size={14}/> Leave Console</h3>
                        <MonthlyLeaveCalendar leaves={leaves} selectedClients={selectedClients} />
                    </div>
                    <div className="panel-3d p-5"><StarPerformers /></div>
                    <div className="panel-3d p-5"><ViolatorsPanel /></div>
                </div>
            </div>

            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {selectedUserDetail && (
                        <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedUserDetail(null)} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]" />
                            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[#050510] border-l border-white/10 shadow-2xl z-[150] flex flex-col">
                                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-transparent">
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">{selectedUserDetail.user.name}</h2>
                                        <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mt-1">{selectedUserDetail.user.clientName} · Administrative Access</p>
                                    </div>
                                    <button onClick={() => setSelectedUserDetail(null)} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"><X size={24} /></button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                                    <section>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Core Profile</h3>
                                            <div className="h-px flex-1 mx-4 bg-white/5" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-6 bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2">Full Name</label>
                                                    <input type="text" value={profileData.name || ''} onChange={e => setProfileData(p => ({ ...p, name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-bold focus:border-blue-500/50 outline-none" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2">Work Mode</label>
                                                    <CustomSelect value={profileData.workMode || 'WFO'} onChange={val => setProfileData(p => ({ ...p, workMode: val as User['workMode'] }))} options={[{ value: 'WFO', label: 'Office' }, { value: 'Remote', label: 'Remote' }, { value: 'Hybrid', label: 'Hybrid' }]} />
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2">Assigned Team</label>
                                                    <CustomSelect value={profileData.clientName || ''} onChange={val => setProfileData(p => ({ ...p, clientName: val }))} options={clients.map(c => ({ value: c.name, label: c.name }))} />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2">Shift Window</label>
                                                    <div className="flex gap-2">
                                                        <input type="text" value={profileData.shiftStart || ''} onChange={e => setProfileData(p => ({ ...p, shiftStart: e.target.value }))} className="w-1/2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-bold" placeholder="08:00" />
                                                        <input type="text" value={profileData.shiftEnd || ''} onChange={e => setProfileData(p => ({ ...p, shiftEnd: e.target.value }))} className="w-1/2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-bold" placeholder="17:00" />
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={handleUpdateProfile} disabled={isSavingProfile} className="col-span-2 mt-2 w-full py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50">
                                                {isSavingProfile ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                                {isSavingProfile ? 'Updating Core...' : 'Sync Profile Changes'}
                                            </button>
                                        </div>
                                    </section>

                                    <section>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Log Timeline</h3>
                                            <div className="h-px flex-1 mx-4 bg-white/5" />
                                        </div>
                                        <TimelineLog logs={detailLogs} isAdmin={true} onDeleteLog={id => deleteTimeLog(id).then(() => getLogs(selectedUserDetail!.user.id, addLogDate).then(setDetailLogs))} />
                                    </section>
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
