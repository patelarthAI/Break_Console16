'use client';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase, FileText, Calendar, AlertTriangle, CheckCircle, BarChart2, Users,
    X, ChevronDown, Zap, Search, Clock, Coffee, Clock3, LogOut, GitCompare, Pencil
} from 'lucide-react';
import { getAllUsers, getClients, ClientRow, getLogsBatch, getCurrentUser } from '@/lib/store';
import { TimeLog, User } from '@/types';
import DailyLogEditor from './DailyLogEditor';
import CustomSelect from './ui/CustomSelect';
import DateRangePicker, { type DateRangeValue } from './ui/DateRangePicker';
import {
    computeSession, computeWorkedTime, computeTotalTime,
    countBreaks, countBRBs, formatDuration, formatTime,
    exportExcel, dateStr, dayName,
    BREAK_LIMIT_MS, BRB_LIMIT_MS, checkViolations, toZonedTimestamp,
} from '@/lib/timeUtils';

type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface DayRow {
    userId: string;
    name: string;
    clientName: string;
    date: string;
    punchIn?: number;
    punchOut?: number;
    workedMs: number;
    breakMs: number;
    brbMs: number;
    breakCount: number;
    brbCount: number;
    breakViol: boolean;
    breakViolMs: number;
    brbViol: boolean;
    brbViolMs: number;
    lateIn: boolean;
    lateInMs: number;
    earlyOut: boolean;
    earlyOutMs: number;
    autoLogout: boolean;
}

function processLogsIntoRow(
    userId: string, name: string, clientName: string, date: string,
    logs: TimeLog[],
    shiftStart = '08:00', shiftEnd = '17:00', timezone = 'America/Chicago'
): DayRow {
    const session = computeSession(logs);
    const now = Date.now();
    const todayStr = dateStr(new Date(now));

    let punchOut = session.punchOut;
    let isVirtualAutoOut = false;

    // Handle past dates with missing punchOut
    if (!punchOut && session.punchIn && date < todayStr) {
        punchOut = toZonedTimestamp(date, shiftEnd, timezone);
        isVirtualAutoOut = true;
    }

    const effectiveEnd = punchOut || now;
    const breakMs = computeTotalTime(session.breaks, effectiveEnd);
    const brbMs = computeTotalTime(session.brbs, effectiveEnd);

    const v = checkViolations(breakMs, brbMs, session.punchIn, punchOut, shiftStart, shiftEnd, timezone, logs);

    return {
        userId, name, clientName, date,
        punchIn: session.punchIn,
        punchOut,
        workedMs: computeWorkedTime({ ...session, punchOut }, now, date, shiftEnd, timezone),
        breakMs, brbMs, breakCount: countBreaks(logs), brbCount: countBRBs(logs),
        breakViol: v.breakViol, breakViolMs: v.breakViolMs,
        brbViol: v.brbViol, brbViolMs: v.brbViolMs,
        lateIn: v.lateIn, lateInMs: v.lateInMs,
        earlyOut: v.earlyOut, earlyOutMs: v.earlyOutMs,
        autoLogout: v.autoLogout || isVirtualAutoOut
    };
}

function ViolBadge({ breakViol, breakViolMs, brbViol, brbViolMs, lateIn, lateInMs, earlyOut, earlyOutMs, autoLogout }: {
    breakViol: boolean; breakViolMs: number; brbViol: boolean; brbViolMs: number;
    lateIn: boolean; lateInMs: number; earlyOut: boolean; earlyOutMs: number; autoLogout: boolean;
}) {
    if (!breakViol && !brbViol && !lateIn && !earlyOut && !autoLogout) return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            <CheckCircle size={11} /> Clean
        </span>
    );
    return (
        <div className="flex flex-wrap gap-1.5 items-center">
            {breakViol && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    <AlertTriangle size={10} /> Break {breakViolMs > 0 ? `(${Math.round(breakViolMs / 60000)}m)` : ''}
                </span>
            )}
            {brbViol && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full">
                    <AlertTriangle size={10} /> BRB {brbViolMs > 0 ? `(${Math.round(brbViolMs / 60000)}m)` : ''}
                </span>
            )}
            {lateIn && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    <AlertTriangle size={10} /> Late In {lateInMs > 0 ? `(${Math.round(lateInMs / 60000)}m)` : ''}
                </span>
            )}
            {earlyOut && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                    <AlertTriangle size={10} /> Early Out {earlyOutMs > 0 ? `(${Math.round(earlyOutMs / 60000)}m)` : ''}
                </span>
            )}
            {autoLogout && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                    <AlertTriangle size={10} /> Auto Out
                </span>
            )}
        </div>
    );
}

interface Summary {
    totalWorked: number; totalBreak: number; totalBrb: number;
    breakCount: number; brbCount: number; breakViolDays: number;
    brbViolDays: number; lateInDays: number; earlyOutDays: number;
    autoLogoutDays: number; daysWorked: number;
}
function summarize(rows: DayRow[]): Summary {
    return rows.reduce((a, r) => ({
        totalWorked: a.totalWorked + r.workedMs,
        totalBreak: a.totalBreak + r.breakMs,
        totalBrb: a.totalBrb + r.brbMs,
        breakCount: a.breakCount + r.breakCount,
        brbCount: a.brbCount + r.brbCount,
        breakViolDays: a.breakViolDays + (r.breakViol ? 1 : 0),
        brbViolDays: a.brbViolDays + (r.brbViol ? 1 : 0),
        lateInDays: a.lateInDays + (r.lateIn ? 1 : 0),
        earlyOutDays: a.earlyOutDays + (r.earlyOut ? 1 : 0),
        autoLogoutDays: a.autoLogoutDays + (r.autoLogout ? 1 : 0),
        daysWorked: a.daysWorked + (r.workedMs > 0 ? 1 : 0),
    }), {
        totalWorked: 0, totalBreak: 0, totalBrb: 0, breakCount: 0, brbCount: 0,
        breakViolDays: 0, brbViolDays: 0, lateInDays: 0, earlyOutDays: 0, autoLogoutDays: 0, daysWorked: 0
    });
}

function ReportTable({ rows, showDate, showName, onEdit }: {
    rows: DayRow[]; showDate: boolean; showName: boolean; onEdit: (r: DayRow) => void;
}) {
    if (!rows.length) return (
        <div className="text-center text-zinc-400 font-medium text-sm py-16 bg-[#0d101d] rounded-2xl border border-white/[0.06]">
            No records match the current filters.
        </div>
    );

    const gridCols = [
        showName ? 'minmax(180px, 1.8fr)' : null,
        showDate ? '95px' : null,
        showDate ? '65px' : null,
        '85px', '85px', '95px', '65px', '85px', '65px', '85px', '90px', 'minmax(140px, 1.6fr)', '40px'
    ].filter(Boolean).join(' ');

    return (
        <div className="w-full overflow-auto max-h-[65vh] rounded-2xl border border-white/[0.08] bg-[#0d101d] shadow-2xl p-2.5 scrollbar-thin">
            <div className="min-w-[1140px] flex flex-col gap-1.5 relative">
                {/* Sticky Header */}
                <div className="sticky top-0 z-20 grid gap-3 px-5 py-3 rounded-xl bg-[#121629] border border-white/10 shadow-lg items-center select-none" style={{ gridTemplateColumns: gridCols }}>
                    {showName && <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-300">Recruiter</div>}
                    {showDate && <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400">Date</div>}
                    {showDate && <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400">Day</div>}
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-300">Arrival</div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-300">Departure</div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-emerald-400">Net Active</div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400">Breaks</div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400">Break Total</div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400">BRBs</div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400">BRB Total</div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400">Idle Time</div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-300">Compliance</div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-500 text-right opacity-0">Actions</div>
                </div>

                {/* Rows */}
                {rows.map((r, i) => (
                    <div
                        key={`${r.userId}-${r.date}-${i}`}
                        className="grid gap-3 px-5 py-2.5 items-center rounded-xl transition-colors duration-150 border border-white/[0.04] bg-[#121524]/70 hover:bg-[#181c30] hover:border-indigo-500/30 group"
                        style={{ gridTemplateColumns: gridCols }}
                    >
                        {showName && (
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                                    {r.name[0]?.toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-semibold text-sm text-zinc-100 tracking-tight truncate group-hover:text-indigo-200 transition-colors">
                                        {r.name}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">{r.clientName}</div>
                                </div>
                            </div>
                        )}
                        {showDate && <div className="text-xs font-mono text-zinc-300 font-medium">{r.date}</div>}
                        {showDate && <div className="text-xs font-medium text-zinc-400">{dayName(r.date)}</div>}

                        <div className="text-xs font-mono text-zinc-300 font-medium">{r.punchIn ? formatTime(r.punchIn) : <span className="text-zinc-600 font-sans">—</span>}</div>
                        <div className="text-xs font-mono text-zinc-300 font-medium">
                            {r.punchOut ? (
                                <span className={r.autoLogout ? 'text-rose-400 font-semibold' : 'text-zinc-300'}>{formatTime(r.punchOut)}</span>
                            ) : r.punchIn ? (
                                <span className="text-sky-400 font-bold text-[11px] uppercase tracking-wider bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">Active</span>
                            ) : (
                                <span className="text-zinc-600 font-sans">—</span>
                            )}
                        </div>

                        <div className="text-xs font-mono text-emerald-400 font-semibold">{r.workedMs > 0 ? formatDuration(r.workedMs) : <span className="text-zinc-600 font-sans">—</span>}</div>

                        <div className="text-xs font-mono text-zinc-300">{r.breakCount > 0 ? r.breakCount : <span className="text-zinc-600">—</span>}</div>
                        <div className="text-xs font-mono text-zinc-300">{r.breakMs > 0 ? formatDuration(r.breakMs) : <span className="text-zinc-600 font-sans">—</span>}</div>

                        <div className="text-xs font-mono text-zinc-300">{r.brbCount > 0 ? r.brbCount : <span className="text-zinc-600">—</span>}</div>
                        <div className="text-xs font-mono text-zinc-300">{r.brbMs > 0 ? formatDuration(r.brbMs) : <span className="text-zinc-600 font-sans">—</span>}</div>

                        <div className="text-xs font-mono text-zinc-400">
                            {(r.breakMs + r.brbMs) > 0 ? formatDuration(r.breakMs + r.brbMs) : <span className="text-zinc-600 font-sans">—</span>}
                        </div>

                        <div className="min-w-0">
                            <ViolBadge
                                breakViol={r.breakViol} breakViolMs={r.breakViolMs}
                                brbViol={r.brbViol} brbViolMs={r.brbViolMs}
                                lateIn={r.lateIn} lateInMs={r.lateInMs}
                                earlyOut={r.earlyOut} earlyOutMs={r.earlyOutMs}
                                autoLogout={r.autoLogout}
                            />
                        </div>

                        <div className="flex justify-end pr-1">
                            <button
                                onClick={() => onEdit(r)}
                                title="Edit Historical Logs"
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                                <Pencil size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function UserSummaryCard({ name, rows }: { name: string; rows: DayRow[] }) {
    const s = summarize(rows.filter(r => r.workedMs > 0));
    if (s.daysWorked === 0) return null;
    const avgBreak = s.daysWorked > 0 ? s.totalBreak / s.daysWorked : 0;
    const avgBrb = s.daysWorked > 0 ? s.totalBrb / s.daysWorked : 0;
    const hasViol = s.breakViolDays + s.brbViolDays + s.autoLogoutDays > 0;
    return (
        <div className={`panel-3d transition-all hover:scale-[1.01] ${hasViol ? 'border-rose-500/40 bg-rose-900/20 shadow-[-4px_-4px_10px_rgba(255,255,255,0.01),8px_8px_20px_rgba(225,29,72,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)] p-3.5' : 'p-3.5'}`}>
            <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-400/30 flex items-center justify-center text-xs font-black text-white shadow-lg">{name[0].toUpperCase()}</div>
                    <p className="text-sm font-extrabold text-white tracking-tight">{name}</p>
                </div>
                {hasViol && <span className="flex items-center gap-1 text-[10px] text-rose-400 font-bold bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full"><AlertTriangle size={10} /> {s.breakViolDays + s.brbViolDays + s.autoLogoutDays} viol</span>}
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
                {[
                    { label: 'Days', val: `${s.daysWorked}d`, color: 'text-white' },
                    { label: 'Worked', val: formatDuration(s.totalWorked), color: 'text-indigo-400' },
                    { label: 'Avg Brk/d', val: formatDuration(avgBreak), color: avgBreak > BREAK_LIMIT_MS ? 'text-rose-400' : 'text-amber-400' },
                    { label: 'Avg BRB/d', val: formatDuration(avgBrb), color: avgBrb > BRB_LIMIT_MS ? 'text-sky-400' : 'text-blue-400' },
                    { label: 'Brk Viols', val: s.breakViolDays, color: s.breakViolDays > 0 ? 'text-orange-400' : 'text-slate-500' },
                    { label: 'BRB Viols', val: s.brbViolDays, color: s.brbViolDays > 0 ? 'text-sky-400' : 'text-slate-500' },
                    { label: 'Auto Outs', val: s.autoLogoutDays, color: s.autoLogoutDays > 0 ? 'text-red-400' : 'text-slate-500' },
                ].map(stat => (
                    <div key={stat.label} className="bg-black/30 border border-white/5 rounded-lg py-1 px-1.5 transition-colors hover:bg-black/50">
                        <p className="text-[8px] font-bold tracking-widest uppercase text-slate-500 mb-0.5">{stat.label}</p>
                        <p className={`text-[11px] font-extrabold font-mono tracking-tight ${stat.color}`}>{stat.val}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Comparison Card for compare mode ─────────────────────────── */
function ComparisonCard({ name, clientName, rows }: { name: string; clientName: string; rows: DayRow[] }) {
    const worked = rows.filter(r => r.workedMs > 0);
    const s = summarize(worked);
    const avgBreak = s.daysWorked > 0 ? s.totalBreak / s.daysWorked : 0;
    const totalViol = s.breakViolDays + s.brbViolDays + s.lateInDays + s.earlyOutDays + s.autoLogoutDays;
    const cleanDays = s.daysWorked - worked.filter(r => r.breakViol || r.brbViol || r.lateIn || r.earlyOut || r.autoLogout).length;
    const complianceRate = s.daysWorked > 0 ? Math.round((cleanDays / s.daysWorked) * 100) : 100;

    return (
        <div className="panel-3d p-4 rounded-[1.25rem] flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400/30 flex items-center justify-center text-sm font-black text-white shadow-lg">
                    {name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-extrabold text-white tracking-tight truncate">{name}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{clientName || 'Unassigned'}</p>
                </div>
            </div>

            {s.daysWorked === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center bg-black/20 rounded-xl border border-white/5">
                    <p className="text-xs font-bold text-slate-500">No hours logged</p>
                    <p className="text-[9px] text-slate-600 uppercase tracking-wider mt-1">In selected range</p>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-center py-2">
                        <div className={`relative w-20 h-20 rounded-full border-4 flex items-center justify-center ${
                            complianceRate >= 90 ? 'border-emerald-500/60' : complianceRate >= 70 ? 'border-amber-500/60' : 'border-rose-500/60'
                        }`}>
                            <div className="text-center">
                                <p className={`text-xl font-black font-mono ${
                                    complianceRate >= 90 ? 'text-emerald-400' : complianceRate >= 70 ? 'text-amber-400' : 'text-rose-400'
                                }`}>{complianceRate}%</p>
                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Clean</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        {[
                            { label: 'Days Worked', val: `${s.daysWorked}`, color: 'text-white' },
                            { label: 'Total Hours', val: formatDuration(s.totalWorked), color: 'text-indigo-400' },
                            { label: 'Avg Break/d', val: formatDuration(avgBreak), color: avgBreak > BREAK_LIMIT_MS ? 'text-rose-400' : 'text-amber-400' },
                            { label: 'Violations', val: `${totalViol}`, color: totalViol > 0 ? 'text-rose-400' : 'text-emerald-400' },
                        ].map(stat => (
                            <div key={stat.label} className="bg-black/30 border border-white/5 rounded-lg py-1.5 px-2 text-center">
                                <p className="text-[8px] font-bold tracking-widest uppercase text-slate-500 mb-0.5">{stat.label}</p>
                                <p className={`text-sm font-extrabold font-mono tracking-tight ${stat.color}`}>{stat.val}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

type ViolFilter = 'late_in' | 'break' | 'brb' | 'auto_out' | 'all' | null;

export default function MasterReports() {
    const todayStr = dateStr(new Date());
    const [dateRange, setDateRange] = useState<DateRangeValue>({
        preset: 'today',
        startDate: todayStr,
        endDate: todayStr,
    });

    const range: DateRange = dateRange.preset === 'today' ? 'today'
        : dateRange.preset === 'yesterday' ? 'yesterday'
        : ['thisWeek', 'lastWeek', 'last7'].includes(dateRange.preset ?? '') ? 'week'
        : ['thisMonth', 'lastMonth', 'last30'].includes(dateRange.preset ?? '') ? 'month'
        : 'custom';

    const [rows, setRows] = useState<DayRow[]>([]);
    const [allUsersList, setAllUsersList] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [selectedRecruiters, setSelectedRecruiters] = useState<string[]>([]);

    // Violation filter tile
    const [violationFilter, setViolationFilter] = useState<ViolFilter>(null);

    // Dynamic Filters
    const [statusDropFilter, setStatusDropFilter] = useState<string>('');
    const [violDropFilter, setViolDropFilter] = useState<string>('');

    // Comparison mode
    const [compareMode, setCompareMode] = useState(false);

    // Export dropdown (Portal)
    const [exportOpen, setExportOpen] = useState(false);
    const [exportPos, setExportPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
    const exportBtnRef = useRef<HTMLButtonElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Violation mini-timeline
    const [showViolTimeline, setShowViolTimeline] = useState(false);

    // Unified Recruiter Search & Picker (Portal)
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchBoxRef = useRef<HTMLDivElement>(null);
    const searchMenuRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchPos, setSearchPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [debouncedQuery, setDebouncedQuery] = useState('');

    const [selectedUserForEdit, setSelectedUserForEdit] = useState<{ user: User, date: string } | null>(null);
    const [mounted, setMounted] = useState(false);
    const currentAdminId = getCurrentUser()?.id ?? '';

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        getClients().then(setClients).catch(console.error);
    }, []);

    // Press `/` to focus recruiter search
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    // Position & outside-click for search autocomplete portal
    const updateSearchPos = useCallback(() => {
        if (!searchBoxRef.current) return;
        const r = searchBoxRef.current.getBoundingClientRect();
        setSearchPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 280) });
    }, []);

    useEffect(() => {
        if (!searchFocused) return;
        updateSearchPos();
        const handleOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                searchBoxRef.current && !searchBoxRef.current.contains(target) &&
                (!searchMenuRef.current || !searchMenuRef.current.contains(target))
            ) {
                setSearchFocused(false);
            }
        };
        window.addEventListener('resize', updateSearchPos);
        window.addEventListener('scroll', updateSearchPos, true);
        document.addEventListener('mousedown', handleOutside);
        return () => {
            window.removeEventListener('resize', updateSearchPos);
            window.removeEventListener('scroll', updateSearchPos, true);
            document.removeEventListener('mousedown', handleOutside);
        };
    }, [searchFocused, updateSearchPos]);

    // Position & outside-click for export portal
    const updateExportPos = useCallback(() => {
        if (!exportBtnRef.current) return;
        const r = exportBtnRef.current.getBoundingClientRect();
        setExportPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }, []);

    useEffect(() => {
        if (!exportOpen) return;
        updateExportPos();
        const handleOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                exportBtnRef.current && !exportBtnRef.current.contains(target) &&
                (!exportMenuRef.current || !exportMenuRef.current.contains(target))
            ) {
                setExportOpen(false);
            }
        };
        window.addEventListener('resize', updateExportPos);
        window.addEventListener('scroll', updateExportPos, true);
        document.addEventListener('mousedown', handleOutside);
        return () => {
            window.removeEventListener('resize', updateExportPos);
            window.removeEventListener('scroll', updateExportPos, true);
            document.removeEventListener('mousedown', handleOutside);
        };
    }, [exportOpen, updateExportPos]);

    // Debounce search query
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 150);
        return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
    }, [searchQuery]);

    const generateDatesFromRange = useCallback((): string[] => {
        const start = new Date(dateRange.startDate + 'T00:00');
        const end = new Date(dateRange.endDate + 'T00:00');
        const dates: string[] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            dates.push(dateStr(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }, [dateRange.startDate, dateRange.endDate]);

    const buildRows = useCallback(async () => {
        setLoading(true);
        try {
            const users = (await getAllUsers()).filter((u) => !u.isMaster);
            setAllUsersList(users);
            const userIds = users.map(u => u.id);
            const dates = generateDatesFromRange();

            const logsByDay = await getLogsBatch(userIds, dates);

            const newRows: DayRow[] = [];
            for (const user of users) {
                for (const d of dates) {
                    const logs = logsByDay[`${user.id}-${d}`] || [];
                    newRows.push(processLogsIntoRow(user.id, user.name, user.clientName, d, logs, user.shiftStart, user.shiftEnd, user.timezone));
                }
            }

            const isMultiDayRange = dates.length > 1;
            setRows(isMultiDayRange ? newRows.filter(r => r.punchIn || r.workedMs > 0) : newRows);
        } finally { setLoading(false); }
    }, [generateDatesFromRange]);

    useEffect(() => { buildRows(); }, [buildRows]);

    /* ── Export helpers ── */
    const buildExportData = (type: 'daily' | 'weekly' | 'violation') => {
        if (type === 'weekly') {
            const byUser = new Map<string, DayRow[]>();
            filteredRows.forEach(r => {
                const list = byUser.get(r.name) ?? [];
                list.push(r);
                byUser.set(r.name, list);
            });
            const header = [
                'Name', 'Client', 'Days Worked', 'Total Worked', 'Avg Worked/Day',
                'Breaks #', 'Break Time', 'Avg Break/Day', 'BRBs #', 'BRB Time',
                'Break Viols', 'BRB Viols', 'Late Ins', 'Early Outs', 'Auto Outs', 'Compliance %'
            ];
            const data = [...byUser.entries()].map(([name, uRows]) => {
                const worked = uRows.filter(r => r.workedMs > 0);
                const s = summarize(worked);
                const cleanDays = s.daysWorked - worked.filter(r => r.breakViol || r.brbViol || r.lateIn || r.earlyOut || r.autoLogout).length;
                const compliance = s.daysWorked > 0 ? `${Math.round((cleanDays / s.daysWorked) * 100)}%` : '100%';
                const avgWork = s.daysWorked > 0 ? s.totalWorked / s.daysWorked : 0;
                const avgBreak = s.daysWorked > 0 ? s.totalBreak / s.daysWorked : 0;
                return [
                    name, uRows[0]?.clientName ?? '', s.daysWorked, formatDuration(s.totalWorked), formatDuration(avgWork),
                    s.breakCount, formatDuration(s.totalBreak), formatDuration(avgBreak), s.brbCount, formatDuration(s.totalBrb),
                    s.breakViolDays, s.brbViolDays, s.lateInDays, s.earlyOutDays, s.autoLogoutDays, compliance
                ];
            });
            exportExcel([
                header,
                ...data,
                [],
                ['Period', `${dateRange.startDate} to ${dateRange.endDate}`],
                ['Policy Rules', 'Break allowance: 1h | Max: 1h 15m', 'BRB max: 10m/day', 'Shift: 8:00 AM CST | Grace: 8:05 AM', 'Shift end: 5:00 PM CST']
            ], 'weekly-summary');
            return;
        }

        const isMultiDayExport = ['week', 'month'].includes(range) || dateRange.startDate !== dateRange.endDate;
        const sourceRows = type === 'violation'
            ? filteredRows.filter(r => r.breakViol || r.brbViol || r.lateIn || r.earlyOut || r.autoLogout)
            : filteredRows;
        const label = type === 'violation' ? 'violation-report' : 'daily-attendance';

        const header = [
            'Name', 'Client', 'Status',
            ...(isMultiDayExport ? ['Date', 'Day'] : []),
            'Punch In', 'Punch Out', 'Worked', 'Breaks #', 'Break Time', 'BRBs #', 'BRB Time', 'Total Break',
            'Total Break Exceed', 'Break Viol', 'BRB Viol', 'Late In', 'Early Out'
        ];

        const data = sourceRows.map((r: DayRow) => {
            const totExMs = (r.breakViolMs || 0) + (r.brbViolMs || 0);
            return [
                r.name, r.clientName, (r.punchIn || r.workedMs > 0) ? 'Active' : 'Offline',
                ...(isMultiDayExport ? [r.date, dayName(r.date)] : []),
                r.punchIn ? formatTime(r.punchIn) : '',
                r.punchOut ? formatTime(r.punchOut) : '',
                formatDuration(r.workedMs),
                r.breakCount,
                formatDuration(r.breakMs),
                r.brbCount,
                formatDuration(r.brbMs),
                formatDuration(r.breakMs + r.brbMs),
                totExMs > 0 ? `${Math.round(totExMs / 60000)}m` : '-',
                r.breakViol ? `${Math.round(r.breakViolMs / 60000)}m` : '-',
                r.brbViol ? `${Math.round(r.brbViolMs / 60000)}m` : '-',
                r.lateIn ? `${Math.round(r.lateInMs / 60000)}m` : '-',
                r.earlyOut ? `${Math.round(r.earlyOutMs / 60000)}m` : '-'
            ];
        });

        const s = summarize(sourceRows.filter((r: DayRow) => r.workedMs > 0));

        const totalsRow = [
            'TOTALS', '', '',
            ...(isMultiDayExport ? ['', ''] : []),
            '', '',
            formatDuration(s.totalWorked),
            s.breakCount,
            formatDuration(s.totalBreak),
            s.brbCount,
            formatDuration(s.totalBrb),
            formatDuration(s.totalBreak + s.totalBrb),
            '',
            `${s.breakViolDays} day(s)`,
            `${s.brbViolDays} day(s)`,
            `${sourceRows.filter((r: DayRow) => r.lateIn).length} day(s)`,
            `${sourceRows.filter((r: DayRow) => r.earlyOut).length} day(s)`
        ];

        exportExcel([
            header,
            ...data,
            [],
            totalsRow,
            [],
            ['Policy Rules', 'Break allowance: 1h | Max: 1h 15m', 'BRB max: 10m/day', 'Shift: 8:00 AM CST | Grace: 8:05 AM', 'Shift end: 5:00 PM CST']
        ], label);
    };

    const isMultiDay = dateRange.startDate !== dateRange.endDate;

    const { filteredRows, baseS, uniqueUsers, recruiterFiltered, avgWorkedMs, uniqueUserCount, complianceRate } = useMemo(() => {
        const clientFiltered = selectedClients.length === 0 ? rows : rows.filter((r: DayRow) => selectedClients.includes(r.clientName));
        const q = debouncedQuery.trim().toLowerCase();
        const rFiltered = clientFiltered.filter((r: DayRow) => {
            const matchesSelected = selectedRecruiters.length === 0 || selectedRecruiters.includes(r.name);
            const matchesQuery = !q || r.name.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q);
            return matchesSelected && matchesQuery;
        });

        const fRows = (violationFilter === null ? rFiltered
            : violationFilter === 'late_in' ? rFiltered.filter((r: DayRow) => r.lateIn)
                : violationFilter === 'break' ? rFiltered.filter((r: DayRow) => r.breakViol)
                    : violationFilter === 'brb' ? rFiltered.filter((r: DayRow) => r.brbViol)
                        : violationFilter === 'auto_out' ? rFiltered.filter((r: DayRow) => r.autoLogout)
                            : rFiltered.filter((r: DayRow) => r.lateIn || r.breakViol || r.brbViol || r.earlyOut || r.autoLogout)
        ).filter((r: DayRow) => {
            if (statusDropFilter === 'Active' && !r.punchIn && r.workedMs === 0) return false;
            if (statusDropFilter === 'Not Active' && (r.punchIn || r.workedMs > 0)) return false;

            if (violDropFilter === 'Late In' && !r.lateIn) return false;
            if (violDropFilter === 'Early Out' && !r.earlyOut) return false;
            if (violDropFilter === 'Break Exceed' && !r.breakViol) return false;
            if (violDropFilter === 'BRB Exceed' && !r.brbViol) return false;
            if (violDropFilter === 'Auto Out' && !r.autoLogout) return false;

            return true;
        }).sort((a, b) => (b.breakMs + b.brbMs) - (a.breakMs + a.brbMs));

        const workedRows = rFiltered.filter((r: DayRow) => r.workedMs > 0);
        const bS = summarize(workedRows);
        const cleanCount = workedRows.filter(r => !r.breakViol && !r.brbViol && !r.lateIn && !r.earlyOut && !r.autoLogout).length;
        const cRate = workedRows.length > 0 ? Math.round((cleanCount / workedRows.length) * 100) : 100;
        const uUsers = [...new Set(fRows.map((r: DayRow) => r.userId))];
        const uUserCount = [...new Set(rFiltered.map((r: DayRow) => r.userId))].length || 1;
        const avgWkMs = bS.totalWorked / uUserCount;

        return {
            filteredRows: fRows,
            baseS: bS,
            uniqueUsers: uUsers,
            recruiterFiltered: rFiltered,
            avgWorkedMs: avgWkMs,
            uniqueUserCount: uUserCount,
            complianceRate: cRate,
        };
    }, [rows, selectedClients, selectedRecruiters, debouncedQuery, violationFilter, statusDropFilter, violDropFilter]);

    // All recruiter names (with client)
    const allRecruiters = useMemo(() => {
        const names = allUsersList.length > 0 ? allUsersList.map(u => u.name) : rows.map(r => r.name);
        return [...new Set(names)].sort();
    }, [allUsersList, rows]);

    const recruiterClientMap = useMemo(() => {
        const map: Record<string, string> = {};
        allUsersList.forEach(u => { if (!map[u.name]) map[u.name] = u.clientName; });
        rows.forEach(r => { if (!map[r.name]) map[r.name] = r.clientName; });
        return map;
    }, [allUsersList, rows]);

    // Recruiter picker / autocomplete list (shows all unselected recruiters on focus, filtered as user types)
    const searchSuggestions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const pool = allRecruiters.filter(n =>
            (selectedClients.length === 0 || selectedClients.includes(recruiterClientMap[n] ?? ''))
        );
        if (!q) return pool.slice(0, 12);
        return pool
            .filter(n => n.toLowerCase().includes(q) || (recruiterClientMap[n] ?? '').toLowerCase().includes(q))
            .slice(0, 12);
    }, [searchQuery, allRecruiters, recruiterClientMap, selectedClients]);

    const toggleRecruiter = (name: string) => {
        setSelectedRecruiters(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
        setSearchQuery('');
    };
    const addRecruiter = (name: string) => {
        setSelectedRecruiters(prev => prev.includes(name) ? prev : [...prev, name]);
        setSearchQuery('');
    };
    const removeRecruiter = (name: string) => setSelectedRecruiters(prev => prev.filter(n => n !== name));

    const totalViol = (baseS.breakViolDays || 0) + (baseS.brbViolDays || 0) + (baseS.lateInDays || 0) + (baseS.earlyOutDays || 0) + (baseS.autoLogoutDays || 0);
    const canCompare = selectedRecruiters.length >= 2 && selectedRecruiters.length <= 4;

    // Violation timeline data
    const violTimelineData = useMemo(() => {
        if (!showViolTimeline) return [];
        const violByDate: Record<string, number> = {};
        recruiterFiltered.forEach(r => {
            const count = (r.breakViol ? 1 : 0) + (r.brbViol ? 1 : 0) + (r.lateIn ? 1 : 0) + (r.earlyOut ? 1 : 0) + (r.autoLogout ? 1 : 0);
            if (count > 0) violByDate[r.date] = (violByDate[r.date] || 0) + count;
        });
        return Object.entries(violByDate).sort(([a], [b]) => a.localeCompare(b));
    }, [showViolTimeline, recruiterFiltered]);

    const maxViolPerDay = useMemo(() => Math.max(1, ...violTimelineData.map(([, c]) => c)), [violTimelineData]);

    const hasActiveFilters = selectedClients.length > 0 || selectedRecruiters.length > 0 || debouncedQuery.trim() !== '' || statusDropFilter !== '' || violDropFilter !== '' || violationFilter !== null;

    /* ── Portal: Search Autocomplete Menu ── */
    const searchPortal = (
        <AnimatePresence>
            {searchFocused && searchSuggestions.length > 0 && (
                <motion.div
                    ref={searchMenuRef}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    style={{
                        position: 'fixed',
                        zIndex: 9985,
                        top: searchPos.top,
                        left: searchPos.left,
                        width: searchPos.width,
                    }}
                    className="bg-[#10121e] border border-white/[0.12] rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.92)] overflow-hidden"
                >
                    <div className="px-3 py-1.5 border-b border-white/[0.06] bg-[#0b0d17] flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                            {searchQuery.trim() ? 'Matching Recruiters' : 'Select Recruiter(s)'}
                        </span>
                        <span className="text-[9px] text-slate-600 font-mono">Click to pin · Enter for top</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1 scrollbar-thin">
                        {searchSuggestions.map(name => {
                            const isSelected = selectedRecruiters.includes(name);
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); toggleRecruiter(name); }}
                                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                                        isSelected ? 'bg-indigo-500/20 text-indigo-200' : 'hover:bg-white/[0.06] text-zinc-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {name[0]?.toUpperCase()}
                                        </div>
                                        <span className="text-xs font-semibold truncate">{name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {recruiterClientMap[name] && (
                                            <span className="text-[10px] text-slate-500">{recruiterClientMap[name]}</span>
                                        )}
                                        {isSelected && <CheckCircle size={12} className="text-indigo-400" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    /* ── Portal: Export Templates Menu ── */
    const exportPortal = (
        <AnimatePresence>
            {exportOpen && (
                <motion.div
                    ref={exportMenuRef}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14 }}
                    style={{
                        position: 'fixed',
                        zIndex: 9990,
                        top: exportPos.top,
                        right: exportPos.right,
                    }}
                    className="min-w-[215px] bg-[#10121e] border border-white/[0.12] rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.92)] overflow-hidden p-1"
                >
                    {[
                        { label: 'Daily Attendance Report', desc: 'Full row-by-row logs', type: 'daily' as const, icon: <FileText size={13} /> },
                        { label: 'Weekly Summary Report', desc: 'Per-recruiter rollup', type: 'weekly' as const, icon: <Calendar size={13} /> },
                        { label: 'Violation Report', desc: 'Flagged days only', type: 'violation' as const, icon: <AlertTriangle size={13} /> },
                    ].map(item => (
                        <button
                            key={item.type}
                            type="button"
                            onClick={() => { buildExportData(item.type); setExportOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-indigo-500/15 transition-colors cursor-pointer group"
                        >
                            <span className="text-indigo-400 group-hover:text-indigo-300">{item.icon}</span>
                            <div>
                                <p className="text-xs font-semibold text-zinc-200 group-hover:text-white">{item.label}</p>
                                <p className="text-[10px] text-slate-500">{item.desc}</p>
                            </div>
                        </button>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="space-y-3">
            {/* ── UNIFIED COMMAND & FILTER TOOLBAR (No backdrop-blur trap!) ──────────────────────── */}
            <div className="rounded-2xl bg-[#0c0d18] border border-white/[0.08] p-2.5 shadow-xl">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Unified Recruiter Search & Picker */}
                    <div ref={searchBoxRef} className="relative flex-1 min-w-[220px] flex items-center h-[38px] rounded-xl bg-[#131624] border border-white/[0.09] focus-within:border-indigo-500/60 focus-within:bg-[#141728] px-3 gap-2 transition-all">
                        <Search size={14} className="text-slate-400 shrink-0" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            onKeyDown={e => {
                                if (e.key === 'Escape') {
                                    setSearchQuery('');
                                    setSearchFocused(false);
                                    searchInputRef.current?.blur();
                                } else if (e.key === 'Enter' && searchSuggestions.length > 0) {
                                    e.preventDefault();
                                    addRecruiter(searchSuggestions[0]);
                                }
                            }}
                            placeholder="Search or pick recruiter…"
                            className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-slate-400 outline-none font-medium"
                        />
                        {searchQuery ? (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="p-0.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                                title="Clear search"
                            >
                                <X size={12} />
                            </button>
                        ) : (
                            <kbd className="hidden sm:inline-flex items-center text-[9px] font-mono font-bold text-slate-500 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded">/</kbd>
                        )}
                    </div>

                    {/* Clients */}
                    <div className="w-full sm:w-[160px]">
                        <CustomSelect
                            multi
                            options={clients.map(c => ({ value: c.name, label: c.name }))}
                            value={selectedClients}
                            onChange={setSelectedClients}
                            placeholder="All Clients"
                            searchable
                        />
                    </div>

                    {/* Status */}
                    <div className="w-[calc(50%-4px)] sm:w-[130px]">
                        <CustomSelect
                            allowClear
                            options={[
                                { value: 'Active', label: 'Active Now' },
                                { value: 'Not Active', label: 'Offline' }
                            ]}
                            value={statusDropFilter}
                            onChange={setStatusDropFilter}
                            placeholder="All Status"
                        />
                    </div>

                    {/* Violation */}
                    <div className="w-[calc(50%-4px)] sm:w-[155px]">
                        <CustomSelect
                            allowClear
                            options={[
                                { value: 'Late In', label: 'Late Login' },
                                { value: 'Early Out', label: 'Early Logout' },
                                { value: 'Break Exceed', label: 'Break Violation' },
                                { value: 'BRB Exceed', label: 'BRB Violation' },
                                { value: 'Auto Out', label: 'Auto Logout' }
                            ]}
                            value={violDropFilter}
                            onChange={setViolDropFilter}
                            placeholder="All Violations"
                        />
                    </div>

                    {/* Date Range */}
                    <div className="w-full sm:w-[235px]">
                        <DateRangePicker
                            value={dateRange}
                            onChange={setDateRange}
                        />
                    </div>

                    {/* Compare (2-4 selected) + Export */}
                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                        {canCompare && (
                            <button
                                type="button"
                                onClick={() => setCompareMode(prev => !prev)}
                                className={`flex items-center justify-center gap-1.5 h-[38px] px-3 rounded-xl text-[10px] font-black tracking-[0.14em] uppercase transition-all whitespace-nowrap cursor-pointer ${
                                    compareMode
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_4px_12px_rgba(6,182,212,0.3)]'
                                        : 'bg-[#131624] border border-white/[0.09] text-slate-300 hover:text-white hover:border-cyan-500/40'
                                }`}
                            >
                                <GitCompare size={13} />
                                {compareMode ? 'Comparing' : 'Compare'}
                            </button>
                        )}

                        <button
                            ref={exportBtnRef}
                            type="button"
                            onClick={() => setExportOpen(prev => !prev)}
                            disabled={filteredRows.length === 0}
                            className="flex items-center justify-center gap-1.5 h-[38px] px-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-black tracking-[0.18em] uppercase hover:brightness-110 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.25)] disabled:opacity-25 disabled:pointer-events-none whitespace-nowrap cursor-pointer"
                        >
                            <Zap size={12} fill="currentColor" />
                            Export
                            <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Active Filter Chips (only when active) */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-white/[0.06]">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {selectedRecruiters.map(name => (
                                <span key={name} className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-indigo-500/15 text-indigo-200 border border-indigo-500/30 pl-1 pr-2 py-0.5 rounded-lg">
                                    <span className="w-4 h-4 rounded bg-indigo-500/30 text-indigo-100 text-[9px] font-bold flex items-center justify-center">
                                        {name[0]?.toUpperCase()}
                                    </span>
                                    <span className="truncate max-w-[140px]">{name}</span>
                                    {recruiterClientMap[name] && (
                                        <span className="text-[10px] text-indigo-400/70 hidden sm:inline">· {recruiterClientMap[name]}</span>
                                    )}
                                    <button type="button" onClick={() => removeRecruiter(name)} className="text-indigo-300 hover:text-white transition-colors cursor-pointer"><X size={11} /></button>
                                </span>
                            ))}

                            {selectedClients.map(name => (
                                <span key={name} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-500/15 text-purple-200 border border-purple-500/30 px-2 py-0.5 rounded-lg">
                                    <Briefcase size={10} className="text-purple-400 shrink-0" />
                                    <span className="truncate max-w-[130px]">{name}</span>
                                    <button type="button" onClick={() => setSelectedClients(prev => prev.filter(c => c !== name))} className="text-purple-300 hover:text-white transition-colors cursor-pointer"><X size={11} /></button>
                                </span>
                            ))}

                            {violationFilter && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-500/15 text-rose-200 border border-rose-500/30 px-2 py-0.5 rounded-lg">
                                    <AlertTriangle size={10} className="text-rose-400" />
                                    <span>
                                        {violationFilter === 'late_in' ? 'Late Logins'
                                            : violationFilter === 'break' ? 'Break Exceeds'
                                            : violationFilter === 'brb' ? 'BRB Exceeds'
                                            : violationFilter === 'auto_out' ? 'Auto Outs'
                                            : 'All Violations'}
                                    </span>
                                    <button type="button" onClick={() => { setViolationFilter(null); setShowViolTimeline(false); }} className="text-rose-300 hover:text-white transition-colors cursor-pointer"><X size={11} /></button>
                                </span>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedClients([]); setSelectedRecruiters([]); setSearchQuery('');
                                    setStatusDropFilter(''); setViolDropFilter(''); setViolationFilter(null);
                                    setCompareMode(false); setShowViolTimeline(false);
                                }}
                                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-white/5 cursor-pointer"
                            >
                                <X size={10} /> Clear all
                            </button>
                        </div>

                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                            {filteredRows.length} / {rows.length} records
                        </span>
                    </div>
                )}
            </div>

            {/* ── COMPACT KPI DASHBOARD (6 Cards) ──────────────────────────────────────────────── */}
            {!loading && baseS.daysWorked > 0 && (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        {/* Avg Worked + Total + Compliance summary */}
                        <div className="panel-3d border border-indigo-500/20 border-t-2 border-t-indigo-500 bg-[#0b0c14]/60 p-3 flex flex-col justify-between rounded-2xl min-h-[82px]">
                            <div className="flex items-center justify-between w-full">
                                <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">Avg Worked / Person</p>
                                <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <Users size={11} />
                                </span>
                            </div>
                            <div className="mt-1">
                                <p className="text-lg lg:text-xl font-black font-mono tracking-tight leading-none text-indigo-400">{formatDuration(avgWorkedMs)}</p>
                                <p className="text-[9px] font-semibold text-slate-500 mt-1 truncate">
                                    {uniqueUserCount} {uniqueUserCount === 1 ? 'person' : 'people'} · <span className={complianceRate >= 90 ? 'text-emerald-400' : complianceRate >= 70 ? 'text-amber-400' : 'text-rose-400'}>{complianceRate}% clean</span>
                                </p>
                            </div>
                        </div>

                        {/* Clickable violation tiles */}
                        {([
                            { key: 'late_in' as ViolFilter, label: 'Late Logins', count: baseS.lateInDays, active: 'border-amber-500/60 bg-amber-500/10', idle: baseS.lateInDays > 0 ? 'border-amber-500/20 border-t-2 border-t-amber-500 bg-[#0b0c14]/60 hover:border-amber-500/40' : 'border-white/[0.06] border-t-2 border-t-slate-700 bg-black/20 opacity-55', num: baseS.lateInDays > 0 ? 'text-amber-400' : 'text-slate-600' },
                            { key: 'break' as ViolFilter, label: 'Break Exceeds', count: baseS.breakViolDays, active: 'border-orange-500/60 bg-orange-500/10', idle: baseS.breakViolDays > 0 ? 'border-orange-500/20 border-t-2 border-t-orange-500 bg-[#0b0c14]/60 hover:border-orange-500/40' : 'border-white/[0.06] border-t-2 border-t-slate-700 bg-black/20 opacity-55', num: baseS.breakViolDays > 0 ? 'text-orange-400' : 'text-slate-600' },
                            { key: 'brb' as ViolFilter, label: 'BRB Exceeds', count: baseS.brbViolDays, active: 'border-sky-500/60 bg-sky-500/10', idle: baseS.brbViolDays > 0 ? 'border-sky-500/20 border-t-2 border-t-sky-500 bg-[#0b0c14]/60 hover:border-sky-500/40' : 'border-white/[0.06] border-t-2 border-t-slate-700 bg-black/20 opacity-55', num: baseS.brbViolDays > 0 ? 'text-sky-400' : 'text-slate-600' },
                            { key: 'auto_out' as ViolFilter, label: 'Auto Outs', count: baseS.autoLogoutDays, active: 'border-red-500/60 bg-red-500/10', idle: baseS.autoLogoutDays > 0 ? 'border-red-500/20 border-t-2 border-t-red-500 bg-[#0b0c14]/60 hover:border-red-500/40' : 'border-white/[0.06] border-t-2 border-t-slate-700 bg-black/20 opacity-55', num: baseS.autoLogoutDays > 0 ? 'text-red-400' : 'text-slate-600' },
                            { key: 'all' as ViolFilter, label: 'Total Violations', count: totalViol, active: 'border-rose-500/60 bg-rose-500/10', idle: totalViol > 0 ? 'border-rose-500/20 border-t-2 border-t-rose-500 bg-[#0b0c14]/60 hover:border-rose-500/40' : 'border-emerald-500/20 border-t-2 border-t-emerald-500 bg-[#0b0c14]/60', num: totalViol > 0 ? 'text-rose-400' : 'text-emerald-400' },
                        ]).map(t => {
                            const isActive = violationFilter === t.key;
                            return (
                                <button
                                    key={t.label}
                                    type="button"
                                    onClick={() => {
                                        if (t.count > 0) {
                                            const next = isActive ? null : t.key;
                                            setViolationFilter(next);
                                            setShowViolTimeline(next !== null);
                                        }
                                    }}
                                    className={`panel-3d p-3 flex flex-col justify-between text-left transition-all duration-200 rounded-2xl min-h-[82px]
                                        ${isActive ? t.active + ' border-t-2' : t.idle}
                                        ${t.count === 0 ? 'cursor-default' : 'cursor-pointer hover:-translate-y-0.5'}`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">{t.label}</p>
                                        <span className={`p-1 rounded-lg ${isActive ? 'bg-white/15 text-current' : 'bg-white/[0.03] text-slate-500'}`}>
                                            {t.key === 'late_in' && <Clock size={11} />}
                                            {t.key === 'break' && <Coffee size={11} />}
                                            {t.key === 'brb' && <Clock3 size={11} />}
                                            {t.key === 'auto_out' && <LogOut size={11} />}
                                            {t.key === 'all' && <AlertTriangle size={11} />}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-1 mt-1">
                                        <p className={`text-lg lg:text-xl font-black font-mono tracking-tight leading-none ${t.num}`}>{t.count}</p>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{t.count === 1 ? 'day' : 'days'}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Violation Drill-down: Client Breakdown + Mini Timeline */}
                    {violationFilter && filteredRows.length > 0 && (() => {
                        const byClient = filteredRows.reduce((acc: Record<string, DayRow[]>, r: DayRow) => {
                            if (!acc[r.clientName]) acc[r.clientName] = [];
                            acc[r.clientName].push(r);
                            return acc;
                        }, {});
                        return (
                            <div className="panel-3d p-3.5 space-y-3 rounded-2xl">
                                {showViolTimeline && violTimelineData.length > 1 && (
                                    <div className="pb-2.5 border-b border-white/[0.06]">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">Daily Violation Trend</p>
                                            <button type="button" onClick={() => setShowViolTimeline(false)} className="p-0.5 text-slate-500 hover:text-white transition-colors cursor-pointer">
                                                <X size={12} />
                                            </button>
                                        </div>
                                        <div className="flex items-end gap-1.5 h-14 overflow-x-auto scrollbar-thin">
                                            {violTimelineData.map(([date, count]) => (
                                                <div key={date} className="flex flex-col items-center gap-0.5 shrink-0 group" title={`${date}: ${count} violation${count !== 1 ? 's' : ''}`}>
                                                    <span className="text-[8px] font-mono font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                                                    <div
                                                        className="w-5 rounded-t-sm bg-gradient-to-t from-rose-600 to-rose-400 hover:from-rose-500 hover:to-rose-300 transition-all"
                                                        style={{ height: `${Math.max(4, (count / maxViolPerDay) * 36)}px` }}
                                                    />
                                                    <span className="text-[8px] font-mono text-slate-500 whitespace-nowrap">{date.slice(5)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                        {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''} · click a recruiter to filter
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                        {Object.entries(byClient).sort(([a], [b]) => a.localeCompare(b)).map(([client, cRows]) => (
                                            <div key={client} className="bg-white/[0.02] border border-white/[0.05] p-2.5 rounded-xl">
                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                    <Briefcase size={10} className="text-slate-500" />
                                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider truncate flex-1">{client}</p>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">{cRows.length}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {[...new Set(cRows.map(r => r.name))].map(name => (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            onClick={() => addRecruiter(name)}
                                                            className="text-[10px] font-semibold bg-white/[0.04] hover:bg-indigo-500/20 border border-white/[0.08] hover:border-indigo-500/40 text-slate-300 hover:text-indigo-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                                        >
                                                            {name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {loading && <p className="text-center text-slate-400 font-medium text-sm py-12 animate-pulse">Processing report data…</p>}

            {/* ── COMPARISON MODE OR REPORT TABLE ────────────────────────────────────────────────── */}
            {!loading && compareMode && canCompare ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <GitCompare size={14} className="text-cyan-400" />
                            <p className="text-xs font-black text-white tracking-wider uppercase">Comparing {selectedRecruiters.length} Recruiters</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCompareMode(false)}
                            className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            Back to Table
                        </button>
                    </div>
                    <div className={`grid gap-3 ${selectedRecruiters.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : selectedRecruiters.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
                        {selectedRecruiters.map(name => {
                            const userRows = filteredRows.filter(r => r.name === name);
                            return (
                                <ComparisonCard
                                    key={name}
                                    name={name}
                                    clientName={recruiterClientMap[name] || ''}
                                    rows={userRows}
                                />
                            );
                        })}
                    </div>
                </div>
            ) : (
                !loading && (
                    <ReportTable
                        rows={filteredRows}
                        showDate={isMultiDay}
                        showName={true}
                        onEdit={(r) => {
                            getAllUsers().then(users => {
                                const fullUser = users.find(u => u.id === r.userId);
                                if (fullUser) setSelectedUserForEdit({ user: fullUser, date: r.date });
                            });
                        }}
                    />
                )
            )}

            {/* Policy Legend Footnote */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] font-bold tracking-widest uppercase text-slate-500 px-2">
                <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-orange-400" /> Break &gt; 1h 15m</span>
                <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-sky-400" /> BRB &gt; 10m</span>
                <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-amber-400" /> Login after 8:05 AM CST</span>
                <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-purple-400" /> Logout before 5:00 PM CST</span>
            </div>

            <AnimatePresence>
                {selectedUserForEdit && (
                    <DailyLogEditor
                        user={selectedUserForEdit.user}
                        initialDate={selectedUserForEdit.date}
                        currentUserId={currentAdminId}
                        onClose={() => setSelectedUserForEdit(null)}
                        onSave={() => buildRows()}
                    />
                )}
            </AnimatePresence>

            {!loading && isMultiDay && uniqueUsers.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-[#ffd700]/20 to-[#d4af37]/10 rounded-lg border border-[#ffd700]/30">
                            <BarChart2 size={13} className="text-[#ffd700]" />
                        </div>
                        <h3 className="text-xs font-black text-white tracking-wider uppercase">Per-Recruiter Breakdown</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {uniqueUsers.map((uid: string) => {
                            const uRows = filteredRows.filter((r: DayRow) => r.userId === uid);
                            return <UserSummaryCard key={uid} name={uRows[0]?.name ?? uid} rows={uRows} />;
                        })}
                    </div>
                </div>
            )}

            {mounted && createPortal(searchPortal, document.body)}
            {mounted && createPortal(exportPortal, document.body)}
        </div>
    );
}
