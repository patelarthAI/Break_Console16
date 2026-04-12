'use client';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, FileText, Calendar, ChevronLeft, ChevronRight, Download, AlertTriangle, CheckCircle, BarChart2, Users, X, ChevronDown, Filter, Zap, Globe, ShieldAlert, Search } from 'lucide-react';
import { getAllUsers, getLogsForDate, getLogDatesForMonth, getClients, ClientRow, getLogsBatch, getCurrentUser } from '@/lib/store';
import { TimeLog, User } from '@/types';
import DailyLogEditor from './DailyLogEditor';
import CustomSelect from './ui/CustomSelect';
import DateRangePicker, { type DateRangeValue } from './ui/DateRangePicker';
import { Pencil } from 'lucide-react';
import {
    computeSession, computeWorkedTime, computeTotalTime,
    countBreaks, countBRBs, formatDuration, formatTime,
    exportExcel, dateStr, dayName, isWorkDay, yearMonthStr,
    BREAK_LIMIT_MS, BRB_LIMIT_MS, checkViolations,
} from '@/lib/timeUtils';

type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

function pad(n: number) { return String(n).padStart(2, '0'); }

function getMondayOfWeek(weekOffset: number): Date {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
}
function getWeekDates(weekOffset: number): string[] {
    const monday = getMondayOfWeek(weekOffset);
    return Array.from({ length: 5 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return dateStr(d); });
}
function getMonthWorkDates(yearMonth: string): string[] {
    const [y, m] = yearMonth.split('-').map(Number);
    const dates: string[] = [];
    const d = new Date(y, m - 1, 1);
    while (d.getMonth() === m - 1) { if (isWorkDay(dateStr(d))) dates.push(dateStr(d)); d.setDate(d.getDate() + 1); }
    return dates;
}
function weekLabel(weekOffset: number): string {
    const monday = getMondayOfWeek(weekOffset);
    const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
    return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
function monthLabel(d: Date): string { return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }

interface DayRow { userId: string; name: string; clientName: string; date: string; punchIn?: number; punchOut?: number; workedMs: number; breakMs: number; brbMs: number; breakCount: number; brbCount: number; breakViol: boolean; breakViolMs: number; brbViol: boolean; brbViolMs: number; lateIn: boolean; lateInMs: number; earlyOut: boolean; earlyOutMs: number; autoLogout: boolean; }

function processLogsIntoRow(
    userId: string, name: string, clientName: string, date: string,
    logs: TimeLog[],
    shiftStart = '08:00', shiftEnd = '17:00', timezone = 'America/Chicago'
): DayRow {
    const session = computeSession(logs);
    const now = Date.now();
    const breakMs = computeTotalTime(session.breaks, now);
    const brbMs = computeTotalTime(session.brbs, now);
    
    // We pass logs to checkViolations for autoLogout detection
    const v = checkViolations(breakMs, brbMs, session.punchIn, session.punchOut, shiftStart, shiftEnd, timezone, logs);
    
    return { 
        userId, name, clientName, date, 
        punchIn: session.punchIn, punchOut: session.punchOut, 
        workedMs: computeWorkedTime(session, now, date, shiftEnd), 
        breakMs, brbMs, breakCount: countBreaks(logs), brbCount: countBRBs(logs), 
        breakViol: v.breakViol, breakViolMs: v.breakViolMs, 
        brbViol: v.brbViol, brbViolMs: v.brbViolMs, 
        lateIn: v.lateIn, lateInMs: v.lateInMs, 
        earlyOut: v.earlyOut, earlyOutMs: v.earlyOutMs,
        autoLogout: v.autoLogout
    };
}

function ViolBadge({ breakViol, breakViolMs, brbViol, brbViolMs, lateIn, lateInMs, earlyOut, earlyOutMs, autoLogout }: { breakViol: boolean; breakViolMs: number; brbViol: boolean; brbViolMs: number; lateIn: boolean; lateInMs: number; earlyOut: boolean; earlyOutMs: number; autoLogout: boolean; }) {
    if (!breakViol && !brbViol && !lateIn && !earlyOut && !autoLogout) return <span className="text-emerald-400"><CheckCircle size={13} /></span>;
    return (
        <div className="flex flex-col gap-0.5">
            {breakViol && <span className="flex items-center gap-1 text-orange-400 text-[10px] font-bold"><AlertTriangle size={9} />Break {breakViolMs > 0 ? `(${Math.round(breakViolMs / 60000)}m)` : ''}</span>}
            {brbViol && <span className="flex items-center gap-1 text-sky-400 text-[10px] font-bold"><AlertTriangle size={9} />BRB {brbViolMs > 0 ? `(${Math.round(brbViolMs / 60000)}m)` : ''}</span>}
            {lateIn && <span className="flex items-center gap-1 text-amber-400 text-[10px] font-bold"><AlertTriangle size={9} />Late In {lateInMs > 0 ? `(${Math.round(lateInMs / 60000)}m)` : ''}</span>}
            {earlyOut && <span className="flex items-center gap-1 text-purple-400 text-[10px] font-bold"><AlertTriangle size={9} />Early Out {earlyOutMs > 0 ? `(${Math.round(earlyOutMs / 60000)}m)` : ''}</span>}
            {autoLogout && <span className="flex items-center gap-1 text-red-500 text-[10px] font-bold"><AlertTriangle size={9} />Auto Out</span>}
        </div>
    );
}

interface Summary { totalWorked: number; totalBreak: number; totalBrb: number; breakCount: number; brbCount: number; breakViolDays: number; brbViolDays: number; lateInDays: number; earlyOutDays: number; autoLogoutDays: number; daysWorked: number; }
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
    }), { totalWorked: 0, totalBreak: 0, totalBrb: 0, breakCount: 0, brbCount: 0, breakViolDays: 0, brbViolDays: 0, lateInDays: 0, earlyOutDays: 0, autoLogoutDays: 0, daysWorked: 0 });
}

function ReportTable({ rows, showDate, showName, onEdit }: { rows: DayRow[]; showDate: boolean; showName: boolean; onEdit: (r: DayRow) => void; }) {
    if (!rows.length) return <p className="text-center text-slate-500 font-medium text-sm py-16 bg-black/20 rounded-[2rem] border border-white/5">No data for this period.</p>;
    
    const gridCols = [
        showName ? 'minmax(150px, 1.5fr)' : null,
        showDate ? '90px' : null,
        showDate ? '80px' : null,
        '70px', '70px', '80px', '70px', '80px', '70px', '80px', '100px', 'minmax(120px, 1.5fr)', '40px'
    ].filter(Boolean).join(' ');

    return (
        <div className="overflow-visible rounded-3xl relative">
            <div className="min-w-[1000px] flex flex-col gap-3">
                {/* Sticky Header */}
                <div className="sticky top-0 z-50 grid gap-4 px-6 py-4 rounded-2xl bg-[#0a001a]/80 border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] items-center backdrop-blur-3xl" style={{ gridTemplateColumns: gridCols }}>
                    {showName && <div className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500">Recruiter Protocol</div>}
                    {showDate && <div className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500">Timeline</div>}
                    {showDate && <div className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500">Day</div>}
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-emerald-500/80">Arrival</div>
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-rose-500/80">Departure</div>
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-400">Net Active</div>
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-orange-400">Breaks</div>
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-orange-400">Total</div>
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-sky-400">BRBs</div>
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-sky-400">Total</div>
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-purple-400">Idle Pool</div>
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-rose-400">Compliance</div>
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500 text-right opacity-0">Actions</div>
                </div>

                {/* Rows */}
                {rows.map((r, i) => {
                    const anyViol = r.breakViol || r.brbViol || r.lateIn || r.earlyOut;
                    return (
                        <div key={`${r.userId}-${r.date}-${i}`} 
                            className={`grid gap-4 px-5 py-3.5 items-center rounded-2xl transition-all duration-300 panel-3d hover:scale-[1.01] group 
                                ${anyViol ? 'bg-[linear-gradient(120deg,rgba(225,29,72,0.06),rgba(0,0,0,0.4))] border-l-2 border-l-rose-500/40' : 'bg-white/[0.015] hover:bg-white/[0.03]'}`}
                            style={{ gridTemplateColumns: gridCols }}>
                            
                            {showName && <div className="font-extrabold text-[13px] text-white tracking-tight truncate drop-shadow-sm">{r.name}</div>}
                            {showDate && <div className="text-[11px] font-mono text-slate-400/80 font-bold uppercase tracking-widest">{r.date}</div>}
                            {showDate && <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{dayName(r.date)}</div>}
                            
                            <div className="text-[13px] text-emerald-400 font-mono font-bold tracking-tight">{r.punchIn ? formatTime(r.punchIn) : <span className="text-slate-600 font-sans">—</span>}</div>
                            <div className="text-[13px] font-mono font-bold tracking-tight">
                                {r.punchOut ? (
                                    <span className={r.autoLogout ? 'text-red-400' : 'text-rose-400'}>{formatTime(r.punchOut)}</span>
                                ) : r.punchIn ? (
                                    <span className="text-sky-400 animate-pulse font-extrabold text-[10px] uppercase tracking-widest bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/30">Active</span>
                                ) : (
                                    <span className="text-slate-600 font-sans">—</span>
                                )}
                            </div>
                            
                            <div className="text-[13px] text-indigo-400 font-mono font-black tracking-tight">{r.workedMs > 0 ? formatDuration(r.workedMs) : <span className="text-slate-600 font-sans">—</span>}</div>
                            
                            <div className="text-[12px] text-orange-400 font-black">{r.breakCount > 0 ? r.breakCount : <span className="text-slate-600">—</span>}</div>
                            <div className="text-[12px] text-orange-400 font-mono font-bold tracking-tight">{r.breakMs > 0 ? formatDuration(r.breakMs) : <span className="text-slate-600 font-sans">—</span>}</div>
                            
                            <div className="text-[12px] text-sky-400 font-black">{r.brbCount > 0 ? r.brbCount : <span className="text-slate-600">—</span>}</div>
                            <div className="text-[12px] text-sky-400 font-mono font-bold tracking-tight">{r.brbMs > 0 ? formatDuration(r.brbMs) : <span className="text-slate-600 font-sans">—</span>}</div>
                            
                            <div className="text-[13px] font-mono font-black tracking-tight">
                                {(r.breakMs + r.brbMs) > 0 ? (
                                    <span className={`${(r.breakMs + r.brbMs) > 85 * 60 * 1000 ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(225,29,72,0.5)]' : (r.breakMs + r.brbMs) > 60 * 60 * 1000 ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-purple-400'}`}>
                                        {formatDuration(r.breakMs + r.brbMs)}
                                    </span>
                                ) : <span className="text-slate-600 font-sans">—</span>}
                            </div>
                            
                            <div className="min-w-0"><ViolBadge breakViol={r.breakViol} breakViolMs={r.breakViolMs} brbViol={r.brbViol} brbViolMs={r.brbViolMs} lateIn={r.lateIn} lateInMs={r.lateInMs} earlyOut={r.earlyOut} earlyOutMs={r.earlyOutMs} autoLogout={r.autoLogout} /></div>
                            
                            <div className="flex justify-end pr-1">
                                <button
                                    onClick={() => onEdit(r)}
                                    title="Edit Historical Logs"
                                    className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Pencil size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
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
        <div className={`panel-3d transition-all hover:scale-[1.01] ${hasViol ? 'border-rose-500/40 bg-rose-900/20 shadow-[-4px_-4px_10px_rgba(255,255,255,0.01),8px_8px_20px_rgba(225,29,72,0.2),inset_0_1px_1px_rgba(255,255,255,0.08)]' : 'p-5'}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-400/30 flex items-center justify-center text-sm font-extrabold text-white shadow-lg">{name[0].toUpperCase()}</div>
                    <p className="text-base font-extrabold text-white tracking-tight">{name}</p>
                </div>
                {hasViol && <span className="flex items-center gap-1.5 text-xs text-rose-400 font-bold bg-rose-500/20 border border-rose-500/30 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse"><AlertTriangle size={12} /> {s.breakViolDays + s.brbViolDays + s.autoLogoutDays} violation{(s.breakViolDays + s.brbViolDays + s.autoLogoutDays) > 1 ? 's' : ''}</span>}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
                {[
                    { label: 'Days', val: `${s.daysWorked}d`, color: 'text-white' },
                    { label: 'Total Worked', val: formatDuration(s.totalWorked), color: 'text-indigo-400' },
                    { label: 'Avg Break/day', val: formatDuration(avgBreak), color: avgBreak > BREAK_LIMIT_MS ? 'text-rose-400' : 'text-amber-400' },
                    { label: 'Avg BRB/day', val: formatDuration(avgBrb), color: avgBrb > BRB_LIMIT_MS ? 'text-sky-400' : 'text-blue-400' },
                    { label: 'Break Viols', val: s.breakViolDays, color: s.breakViolDays > 0 ? 'text-orange-400' : 'text-slate-500' },
                    { label: 'BRB Viols', val: s.brbViolDays, color: s.brbViolDays > 0 ? 'text-sky-400' : 'text-slate-500' },
                    { label: 'Auto Outs', val: s.autoLogoutDays, color: s.autoLogoutDays > 0 ? 'text-red-400' : 'text-slate-500' },
                ].map(stat => (
                    <div key={stat.label} className="bg-black/30 border border-white/5 rounded-[1rem] p-3 transition-colors hover:bg-black/50">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1">{stat.label}</p>
                        <p className={`text-sm font-extrabold font-mono tracking-tight ${stat.color}`}>{stat.val}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

type ViolFilter = 'late_in' | 'break' | 'brb' | 'auto_out' | 'all' | null;

export default function MasterReports() {
    /* ── Date range (new unified picker) ──────────────────────────── */
    const todayStr = dateStr(new Date());
    const [dateRange, setDateRange] = useState<DateRangeValue>({
        preset: 'today',
        startDate: todayStr,
        endDate: todayStr,
    });

    // Derive a legacy range type for display logic
    const range: DateRange = dateRange.preset === 'today' ? 'today'
        : dateRange.preset === 'yesterday' ? 'yesterday'
        : ['thisWeek', 'lastWeek', 'last7'].includes(dateRange.preset ?? '') ? 'week'
        : ['thisMonth', 'lastMonth', 'last30'].includes(dateRange.preset ?? '') ? 'month'
        : 'custom';

    const [rows, setRows] = useState<DayRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);
    // Name search + chips
    const [recruiterSearch, setRecruiterSearch] = useState('');
    const [selectedRecruiters, setSelectedRecruiters] = useState<string[]>([]);

    // Violation filter tile
    const [violationFilter, setViolationFilter] = useState<ViolFilter>(null);

    // Dynamic Filters
    const [statusDropFilter, setStatusDropFilter] = useState<string>('');
    const [violDropFilter, setViolDropFilter] = useState<string>('');

    const [selectedUserForEdit, setSelectedUserForEdit] = useState<{ user: User, date: string } | null>(null);
    const currentAdminId = getCurrentUser()?.id ?? '';

    useEffect(() => {
        getClients().then(data => {
            setClients(data);
            setLoadingClients(false);
        }).catch(err => {
            console.error(err);
            setLoadingClients(false);
        });
    }, []);

    /* ── Generate dates from dateRange ────────────────────────────── */
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

    // Build rows whenever range/offsets change
    useEffect(() => { buildRows(); }, [buildRows]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _unused = 0; // suppress unused warning

    const handleCSV = () => {
        const isMultiDay = ['week', 'month'].includes(range);
        const header = [
            'Name', 'Client', 'Status', 
            ...(isMultiDay ? ['Date', 'Day'] : []), 
            'Punch In', 'Punch Out', 'Worked', 'Breaks #', 'Break Time', 'BRBs #', 'BRB Time', 'Total Break',
            'Total Break Exceed', 'Break Viol', 'BRB Viol', 'Late In', 'Early Out'
        ];
        
        const data = filteredRows.map((r: DayRow) => {
            const totExMs = (r.breakViolMs || 0) + (r.brbViolMs || 0);
            return [
                r.name, r.clientName, (r.punchIn || r.workedMs > 0) ? 'Active' : 'Offline', 
                ...(isMultiDay ? [r.date, dayName(r.date)] : []), 
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
        
        const s = summarize(filteredRows.filter((r: DayRow) => r.workedMs > 0));
        const lateInDays = filteredRows.filter(r => r.lateIn).length;
        const earlyOutDays = filteredRows.filter(r => r.earlyOut).length;
        
        const totalsRow = [
            'TOTALS', '', '', 
            ...(isMultiDay ? ['', ''] : []), 
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
            `${filteredRows.filter((r: DayRow) => r.lateIn).length} day(s)`, 
            `${filteredRows.filter((r: DayRow) => r.earlyOut).length} day(s)`
        ];
        
        exportExcel([
            header, 
            ...data, 
            [], 
            totalsRow, 
            [], 
            ['Policy Rules', 'Break allowance: 1h | Max: 1h 15m', 'BRB max: 10m/day', 'Shift: 8:00 AM CST | Grace: 8:05 AM', 'Shift end: 5:00 PM CST']
        ], 'data-report');
    };

    const isMultiDay = dateRange.startDate !== dateRange.endDate;

    // Memoized derived data
    const { filteredRows, baseS, uniqueUsers, recruiterFiltered, avgWorkedMs, uniqueUserCount } = useMemo(() => {
        const clientFiltered = selectedClients.length === 0 ? rows : rows.filter((r: DayRow) => selectedClients.includes(r.clientName));
        const rFiltered = clientFiltered.filter((r: DayRow) => selectedRecruiters.length === 0 || selectedRecruiters.includes(r.name));

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

        const bS = summarize(rFiltered.filter((r: DayRow) => r.workedMs > 0));
        const uUsers = [...new Set(fRows.map((r: DayRow) => r.userId))];
        const uUserCount = [...new Set(rFiltered.map((r: DayRow) => r.userId))].length || 1;
        const avgWkMs = bS.totalWorked / uUserCount;

        return { filteredRows: fRows, baseS: bS, uniqueUsers: uUsers, recruiterFiltered: rFiltered, avgWorkedMs: avgWkMs, uniqueUserCount: uUserCount };
    }, [rows, selectedClients, selectedRecruiters, violationFilter, statusDropFilter, violDropFilter]);

    // All recruiter names for typeahead
    const allRecruiters = useMemo(() => [...new Set(rows.map(r => r.name))].sort(), [rows]);
    const filteredSuggestions = recruiterSearch.trim()
        ? allRecruiters.filter(n => n.toLowerCase().includes(recruiterSearch.toLowerCase()) && !selectedRecruiters.includes(n))
        : [];
    const addRecruiter = (name: string) => { setSelectedRecruiters(prev => prev.includes(name) ? prev : [...prev, name]); setRecruiterSearch(''); };
    const removeRecruiter = (name: string) => setSelectedRecruiters(prev => prev.filter(n => n !== name));

    // Summary always based on un-violation-filtered data for the tile counts to stay stable
    const allS = summarize(filteredRows.filter(r => r.workedMs > 0));
    const totalViol = (baseS.breakViolDays || 0) + (baseS.brbViolDays || 0) + (baseS.lateInDays || 0) + (baseS.earlyOutDays || 0) + (baseS.autoLogoutDays || 0);

    return (
        <div className="space-y-5">
            {/* ── Header row ────────────────────────────────────────────── */}
            {/* ── Header row (2026 Vibrant) ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
                        <div className="relative w-14 h-14 bg-[#0a001a] border border-white/10 rounded-2xl flex items-center justify-center">
                            <FileText size={28} className="text-indigo-400" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tighter mb-1">Analytical Intelligence</h2>
                        <div className="flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Operational Reports 2026</span>
                        </div>
                    </div>
                </div>
                <motion.button 
                    onClick={handleCSV} 
                    whileHover={{ scale: 1.02, y: -2 }} 
                    whileTap={{ scale: 0.98 }} 
                    disabled={filteredRows.length === 0}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-black text-xs font-black tracking-[0.2em] uppercase hover:bg-indigo-50 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] disabled:opacity-20"
                >
                    <Zap size={16} fill="currentColor" /> Generate Dataset
                </motion.button>
            </div>

            {/* ── Filter bar — unified style ─────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 focus-within:border-indigo-500/50 transition-all">
                    <Search className="text-slate-500 flex-shrink-0" size={14} />
                    <input
                        type="text"
                        placeholder="Search recruiter..."
                        value={recruiterSearch}
                        onChange={e => setRecruiterSearch(e.target.value)}
                        className="bg-transparent text-[12px] font-semibold text-white placeholder:text-slate-600 outline-none w-full"
                    />
                </div>

                <CustomSelect
                    multi
                    options={clients.map(c => ({ value: c.name, label: c.name }))}
                    value={selectedClients}
                    onChange={setSelectedClients}
                    placeholder="Select Clients"
                    searchable
                />

                <CustomSelect
                    options={[
                        { value: 'Active', label: 'Active Now' },
                        { value: 'Not Active', label: 'Offline' }
                    ]}
                    value={statusDropFilter}
                    onChange={setStatusDropFilter}
                    placeholder="Engagement Status"
                />

                <CustomSelect
                    options={[
                        { value: 'Late In', label: 'Late Login' },
                        { value: 'Early Out', label: 'Early Logout' },
                        { value: 'Break Exceed', label: 'Break Violation' },
                        { value: 'BRB Exceed', label: 'BRB Violation' },
                        { value: 'Auto Out', label: 'Auto Logout' }
                    ]}
                    value={violDropFilter}
                    onChange={setViolDropFilter}
                    placeholder="Violation Protocol"
                />

                <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                />
            </div>

            {/* ── Active Filters & Match Count ── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-6 px-1">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Selected recruiter chips */}
                    {selectedRecruiters.map(name => (
                        <span key={name} className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-2.5 py-1 rounded-md">
                            {name}
                            <button onClick={() => removeRecruiter(name)} className="text-indigo-400 hover:text-white transition-colors"><X size={9} /></button>
                        </span>
                    ))}

                    {/* Violation filter chip (when active) */}
                    {violationFilter && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-md">
                            {violationFilter === 'late_in' ? '🔴 Late Logins' : violationFilter === 'break' ? '☕ Break Exceeds' : violationFilter === 'brb' ? '🔄 BRB Exceeds' : violationFilter === 'auto_out' ? '🚨 Auto Outs' : '⚠️ All Violations'}
                            <button onClick={() => setViolationFilter(null)} className="text-rose-400 hover:text-white transition-colors"><X size={9} /></button>
                        </span>
                    )}

                    {(selectedClients.length > 0 || selectedRecruiters.length > 0 || statusDropFilter !== '' || violDropFilter !== '' || violationFilter !== null) && (
                        <button onClick={() => { setSelectedClients([]); setSelectedRecruiters([]); setRecruiterSearch(''); setStatusDropFilter(''); setViolDropFilter(''); setViolationFilter(null); }}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
                            <X size={10} /> Clear all
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 pr-2 pl-4 border-l border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                        {filteredRows.length} Match{filteredRows.length !== 1 ? 'es' : ''}
                    </span>
                </div>
            </div>

            {loading && <p className="text-center text-slate-500 font-medium text-sm py-16 animate-pulse">Processing report data…</p>}

            {/* ── VIOLATIONS DASHBOARD ─────────────────────────────────────────── */}
            {!loading && baseS.daysWorked > 0 && (
                <div className="space-y-3">
                    <div className="grid grid-cols-5 gap-3">
                        {/* Avg Worked — display only */}
                        <div className="panel-3d border border-indigo-500/30 bg-[linear-gradient(120deg,rgba(99,102,241,0.1),rgba(4,4,15,0.8))] p-4 flex flex-col gap-1">
                            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Avg Worked / Person</p>
                            <p className="text-2xl font-black font-mono tabular-nums text-indigo-400">{formatDuration(avgWorkedMs)}</p>
                            <p className="text-[9px] text-slate-600">{uniqueUserCount} people · {range}</p>
                        </div>

                        {/* Clickable violation tiles */}
                        {([
                            { key: 'late_in' as ViolFilter, label: 'Late Logins', count: baseS.lateInDays, icon: '🔴', active: 'border-amber-500/60 bg-amber-500/10', idle: baseS.lateInDays > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/8 bg-black/30', num: baseS.lateInDays > 0 ? 'text-amber-400' : 'text-slate-600' },
                            { key: 'break' as ViolFilter, label: 'Break Exceeds', count: baseS.breakViolDays, icon: '☕', active: 'border-orange-500/60 bg-orange-500/10', idle: baseS.breakViolDays > 0 ? 'border-orange-500/30 bg-orange-500/5' : 'border-white/8 bg-black/30', num: baseS.breakViolDays > 0 ? 'text-orange-400' : 'text-slate-600' },
                            { key: 'brb' as ViolFilter, label: 'BRB Exceeds', count: baseS.brbViolDays, icon: '🔄', active: 'border-sky-500/60 bg-sky-500/10', idle: baseS.brbViolDays > 0 ? 'border-sky-500/30 bg-sky-500/5' : 'border-white/8 bg-black/30', num: baseS.brbViolDays > 0 ? 'text-sky-400' : 'text-slate-600' },
                            { key: 'auto_out' as ViolFilter, label: 'Auto Outs', count: baseS.autoLogoutDays, icon: '🚨', active: 'border-red-500/60 bg-red-500/10', idle: baseS.autoLogoutDays > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-white/8 bg-black/30', num: baseS.autoLogoutDays > 0 ? 'text-red-400' : 'text-slate-600' },
                            { key: 'all' as ViolFilter, label: 'Total Violations', count: totalViol, icon: '⚠️', active: 'border-rose-500/60 bg-rose-500/10', idle: totalViol > 0 ? 'border-rose-500/30 bg-rose-500/5' : 'border-emerald-500/20 bg-emerald-500/5', num: totalViol > 0 ? 'text-rose-400' : 'text-emerald-400' },
                        ]).map(t => {
                            const isActive = violationFilter === t.key;
                            return (
                                <button key={t.label}
                                    onClick={() => setViolationFilter(isActive ? null : t.key)}
                                    className={`panel-3d p-4 flex flex-col gap-1 text-left transition-all hover:brightness-110 relative overflow-hidden
                                        ${isActive ? t.active : t.idle}
                                        ${t.count === 0 ? 'cursor-default' : 'cursor-pointer'}`}>
                                    {isActive && <div className="absolute top-0 inset-x-0 h-0.5 bg-current opacity-60" />}
                                    <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{t.label}</p>
                                    <p className={`text-2xl font-black font-mono tabular-nums ${t.num}`}>{t.count}</p>
                                    {isActive && <p className="text-[9px] text-slate-500 mt-0.5">↓ filtered below</p>}
                                </button>
                            );
                        })}
                    </div>

                    {/* When a violation tile is active: group results by client */}
                    {violationFilter && filteredRows.length > 0 && (() => {
                        const byClient = filteredRows.reduce((acc: Record<string, DayRow[]>, r: DayRow) => {
                            if (!acc[r.clientName]) acc[r.clientName] = [];
                            acc[r.clientName].push(r);
                            return acc;
                        }, {});
                        return (
                            <div className="panel-3d p-4 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''} · grouped by client
                                </p>
                                {Object.entries(byClient).sort(([a], [b]) => a.localeCompare(b)).map(([client, cRows]) => (
                                    <div key={client}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Briefcase size={11} className="text-slate-600" />
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{client}</p>
                                            <span className="text-[10px] text-slate-600">{cRows.length}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pl-4">
                                            {[...new Set(cRows.map(r => r.name))].map(name => (
                                                <button key={name}
                                                    onClick={() => addRecruiter(name)}
                                                    className="text-[11px] font-semibold bg-white/[0.04] hover:bg-indigo-500/15 border border-white/8 hover:border-indigo-500/30 text-slate-300 hover:text-indigo-200 px-2.5 py-1 rounded-full transition-all">
                                                    {name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            )}

            <div className="flex items-center gap-4 text-[10px] font-bold tracking-widest uppercase text-slate-400 px-2">
                <span className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5"><AlertTriangle size={12} className="text-orange-400" /> Break &gt; 1h 15m</span>
                <span className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5"><AlertTriangle size={12} className="text-sky-400" /> BRB &gt; 10m</span>
                <span className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5"><AlertTriangle size={12} className="text-amber-400" /> Login after 8:05 AM CST</span>
                <span className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5"><AlertTriangle size={12} className="text-purple-400" /> Logout before 5:00 PM CST</span>
            </div>

            {!loading && <ReportTable rows={filteredRows} showDate={isMultiDay} showName={true} onEdit={(r) => {
                const u = rows.find(x => x.userId === r.userId); // In practice we want the User object
                getAllUsers().then(users => {
                    const fullUser = users.find(u => u.id === r.userId);
                    if (fullUser) setSelectedUserForEdit({ user: fullUser, date: r.date });
                });
            }} />}

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
                <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-[#ffd700]/20 to-[#d4af37]/10 rounded-xl border border-[#ffd700]/30 shadow-[inset_0_0_15px_rgba(255,215,0,0.2)]">
                            <BarChart2 size={16} className="text-[#ffd700] drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]" />
                        </div>
                        <h3 className="text-base font-extrabold text-white tracking-tight">Per-Recruiter Breakdown</h3>
                    </div>
                    {uniqueUsers.map((uid: string) => { const uRows = filteredRows.filter((r: DayRow) => r.userId === uid); return <UserSummaryCard key={uid} name={uRows[0]?.name ?? uid} rows={uRows} />; })}
                </div>
            )}
        </div>
    );
}
