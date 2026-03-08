'use client';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, FileText, Calendar, ChevronLeft, ChevronRight, Download, AlertTriangle, CheckCircle, BarChart2, Users, X, ChevronDown, Filter } from 'lucide-react';
import { getAllUsers, getLogsForDate, getLogDatesForMonth, getClients, ClientRow, getLogsBatch } from '@/lib/store';
import { TimeLog } from '@/types';
import {
    computeSession, computeWorkedTime, computeTotalTime,
    countBreaks, countBRBs, formatDuration, formatTime,
    exportExcel, dateStr, dayName, isWorkDay, yearMonthStr,
    BREAK_LIMIT_MS, BRB_LIMIT_MS, checkViolations,
} from '@/lib/timeUtils';

type DateRange = 'today' | 'yesterday' | 'week' | 'month';

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

interface DayRow { userId: string; name: string; clientName: string; date: string; punchIn?: number; punchOut?: number; workedMs: number; breakMs: number; brbMs: number; breakCount: number; brbCount: number; breakViol: boolean; breakViolMs: number; brbViol: boolean; brbViolMs: number; lateIn: boolean; lateInMs: number; earlyOut: boolean; earlyOutMs: number; }

function processLogsIntoRow(
    userId: string, name: string, clientName: string, date: string,
    logs: TimeLog[],
    shiftStart = '08:00', shiftEnd = '17:00', timezone = 'America/Chicago'
): DayRow {
    const session = computeSession(logs);
    const now = Date.now();
    const breakMs = computeTotalTime(session.breaks, now);
    const brbMs = computeTotalTime(session.brbs, now);
    const v = checkViolations(breakMs, brbMs, session.punchIn, session.punchOut, shiftStart, shiftEnd, timezone);
    return { userId, name, clientName, date, punchIn: session.punchIn, punchOut: session.punchOut, workedMs: computeWorkedTime(session, now), breakMs, brbMs, breakCount: countBreaks(logs), brbCount: countBRBs(logs), breakViol: v.breakViol, breakViolMs: v.breakViolMs, brbViol: v.brbViol, brbViolMs: v.brbViolMs, lateIn: v.lateIn, lateInMs: v.lateInMs, earlyOut: v.earlyOut, earlyOutMs: v.earlyOutMs };
}

function ViolBadge({ breakViol, breakViolMs, brbViol, brbViolMs, lateIn, lateInMs, earlyOut, earlyOutMs }: { breakViol: boolean; breakViolMs: number; brbViol: boolean; brbViolMs: number; lateIn: boolean; lateInMs: number; earlyOut: boolean; earlyOutMs: number; }) {
    if (!breakViol && !brbViol && !lateIn && !earlyOut) return <span className="text-emerald-400"><CheckCircle size={13} /></span>;
    return (
        <div className="flex flex-col gap-0.5">
            {breakViol && <span className="flex items-center gap-1 text-orange-400 text-[10px] font-bold"><AlertTriangle size={9} />Break {breakViolMs > 0 ? `(${Math.round(breakViolMs / 60000)}m)` : ''}</span>}
            {brbViol && <span className="flex items-center gap-1 text-sky-400 text-[10px] font-bold"><AlertTriangle size={9} />BRB {brbViolMs > 0 ? `(${Math.round(brbViolMs / 60000)}m)` : ''}</span>}
            {lateIn && <span className="flex items-center gap-1 text-amber-400 text-[10px] font-bold"><AlertTriangle size={9} />Late In {lateInMs > 0 ? `(${Math.round(lateInMs / 60000)}m)` : ''}</span>}
            {earlyOut && <span className="flex items-center gap-1 text-purple-400 text-[10px] font-bold"><AlertTriangle size={9} />Early Out {earlyOutMs > 0 ? `(${Math.round(earlyOutMs / 60000)}m)` : ''}</span>}
        </div>
    );
}

interface Summary { totalWorked: number; totalBreak: number; totalBrb: number; breakCount: number; brbCount: number; breakViolDays: number; brbViolDays: number; lateInDays: number; earlyOutDays: number; daysWorked: number; }
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
        daysWorked: a.daysWorked + (r.workedMs > 0 ? 1 : 0),
    }), { totalWorked: 0, totalBreak: 0, totalBrb: 0, breakCount: 0, brbCount: 0, breakViolDays: 0, brbViolDays: 0, lateInDays: 0, earlyOutDays: 0, daysWorked: 0 });
}

function ReportTable({ rows, showDate, showName }: { rows: DayRow[]; showDate: boolean; showName: boolean; }) {
    if (!rows.length) return <p className="text-center text-slate-500 font-medium text-sm py-16 bg-black/20 rounded-[2rem] border border-white/5">No data for this period.</p>;
    return (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative">
            <table className="w-full text-xs min-w-[700px] relative z-10">
                <thead>
                    <tr className="bg-white/[0.04] text-slate-400 border-b border-white/10">
                        {showName && <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px]">Name</th>}
                        {showDate && <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px]">Date</th>}
                        {showDate && <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px]">Day</th>}
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-emerald-500">In</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-rose-500">Out</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-indigo-400">Worked</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-orange-400">Breaks</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-orange-400">Break Time</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-sky-400">BRBs</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-sky-400">BRB Time</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-purple-400">⏱ Total Break</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-rose-400">⚠ Violations</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {rows.map((r, i) => {
                        const anyViol = r.breakViol || r.brbViol || r.lateIn || r.earlyOut;
                        return (
                            <tr key={`${r.userId}-${r.date}-${i}`} className={`hover:bg-white/[0.03] transition-colors ${anyViol ? 'border-l-2 border-l-rose-500/70 bg-rose-500/[0.04]' : ''}`}>
                                {showName && <td className="py-3 px-4 font-extrabold text-white whitespace-nowrap tracking-tight">{r.name}</td>}
                                {showDate && <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">{r.date}</td>}
                                {showDate && <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">{dayName(r.date)}</td>}
                                <td className="py-3 px-4 text-emerald-400 font-mono font-bold whitespace-nowrap tracking-tight">{r.punchIn ? formatTime(r.punchIn) : <span className="text-slate-600">—</span>}</td>
                                <td className="py-3 px-4 font-mono font-bold whitespace-nowrap tracking-tight">{r.punchOut ? <span className="text-rose-400">{formatTime(r.punchOut)}</span> : r.punchIn ? <span className="text-sky-400 animate-pulse font-extrabold text-[10px] uppercase tracking-widest bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/30">Active</span> : <span className="text-slate-600">—</span>}</td>
                                <td className="py-3 px-4 text-indigo-400 font-mono font-extrabold whitespace-nowrap tracking-tight">{r.workedMs > 0 ? formatDuration(r.workedMs) : <span className="text-slate-600">—</span>}</td>
                                <td className="py-3 px-4 text-orange-400 font-bold whitespace-nowrap">{r.breakCount > 0 ? r.breakCount : '—'}</td>
                                <td className="py-3 px-4 text-orange-400 font-mono font-bold whitespace-nowrap tracking-tight">{r.breakMs > 0 ? formatDuration(r.breakMs) : '—'}</td>
                                <td className="py-3 px-4 text-sky-400 font-bold whitespace-nowrap">{r.brbCount > 0 ? r.brbCount : '—'}</td>
                                <td className="py-3 px-4 text-sky-400 font-mono font-bold whitespace-nowrap tracking-tight">{r.brbMs > 0 ? formatDuration(r.brbMs) : '—'}</td>
                                <td className="py-3 px-4 font-mono font-bold whitespace-nowrap tracking-tight">
                                    {(r.breakMs + r.brbMs) > 0 ? (
                                        <span className={`${(r.breakMs + r.brbMs) > 85 * 60 * 1000
                                            ? 'text-rose-400'
                                            : (r.breakMs + r.brbMs) > 60 * 60 * 1000
                                                ? 'text-amber-400'
                                                : 'text-purple-400'
                                            }`}>{formatDuration(r.breakMs + r.brbMs)}</span>
                                    ) : '—'}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap"><ViolBadge breakViol={r.breakViol} breakViolMs={r.breakViolMs} brbViol={r.brbViol} brbViolMs={r.brbViolMs} lateIn={r.lateIn} lateInMs={r.lateInMs} earlyOut={r.earlyOut} earlyOutMs={r.earlyOutMs} /></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function UserSummaryCard({ name, rows }: { name: string; rows: DayRow[] }) {
    const s = summarize(rows.filter(r => r.workedMs > 0));
    if (s.daysWorked === 0) return null;
    const avgBreak = s.daysWorked > 0 ? s.totalBreak / s.daysWorked : 0;
    const avgBrb = s.daysWorked > 0 ? s.totalBrb / s.daysWorked : 0;
    const hasViol = s.breakViolDays + s.brbViolDays > 0;
    return (
        <div className={`rounded-[1.5rem] border p-5 backdrop-blur-md transition-all hover:scale-[1.01] ${hasViol ? 'border-rose-500/40 bg-rose-900/20 shadow-[0_0_20px_rgba(244,63,94,0.15)]' : 'border-white/10 bg-black/40'}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-400/30 flex items-center justify-center text-sm font-extrabold text-white shadow-lg">{name[0].toUpperCase()}</div>
                    <p className="text-base font-extrabold text-white tracking-tight">{name}</p>
                </div>
                {hasViol && <span className="flex items-center gap-1.5 text-xs text-rose-400 font-bold bg-rose-500/20 border border-rose-500/30 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse"><AlertTriangle size={12} /> {s.breakViolDays + s.brbViolDays} violation{(s.breakViolDays + s.brbViolDays) > 1 ? 's' : ''}</span>}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
                {[
                    { label: 'Days', val: `${s.daysWorked}d`, color: 'text-white' },
                    { label: 'Total Worked', val: formatDuration(s.totalWorked), color: 'text-indigo-400' },
                    { label: 'Avg Break/day', val: formatDuration(avgBreak), color: avgBreak > BREAK_LIMIT_MS ? 'text-rose-400' : 'text-amber-400' },
                    { label: 'Avg BRB/day', val: formatDuration(avgBrb), color: avgBrb > BRB_LIMIT_MS ? 'text-sky-400' : 'text-blue-400' },
                    { label: 'Break Viols', val: s.breakViolDays, color: s.breakViolDays > 0 ? 'text-orange-400' : 'text-slate-500' },
                    { label: 'BRB Viols', val: s.brbViolDays, color: s.brbViolDays > 0 ? 'text-sky-400' : 'text-slate-500' },
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

type ViolFilter = 'late_in' | 'break' | 'brb' | 'all' | null;

export default function MasterReports() {
    const [range, setRange] = useState<DateRange>('today');
    const [weekOffset, setWeekOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);
    const [rows, setRows] = useState<DayRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [memoizedRange, setMemoizedRange] = useState<DateRange>('today'); // To avoid flicker
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [clientDropOpen, setClientDropOpen] = useState(false);
    const clientDropRef = useRef<HTMLDivElement>(null);
    const [loadingClients, setLoadingClients] = useState(true);
    // Name search + chips
    const [recruiterSearch, setRecruiterSearch] = useState('');
    const [selectedRecruiters, setSelectedRecruiters] = useState<string[]>([]);
    const recruiterRef = useRef<HTMLDivElement>(null);

    // Violation filter tile (Legacy)
    const [violationFilter, setViolationFilter] = useState<ViolFilter>(null);

    // New Dynamic Filters
    const [statusDropFilter, setStatusDropFilter] = useState<string>(''); // 'Active', 'Not Active'
    const [violDropFilter, setViolDropFilter] = useState<string>(''); // 'BRB Exceed', 'Break Exceed', 'Late In', 'Early Out'

    const [statusDropOpen, setStatusDropOpen] = useState(false);
    const [violDropOpen, setViolDropOpen] = useState(false);

    const statusRef = useRef<HTMLDivElement>(null);
    const violRef = useRef<HTMLDivElement>(null);

    // Close client dropdown on outside click
    useEffect(() => {
        function handleOutside(e: MouseEvent) {
            if (clientDropRef.current && !clientDropRef.current.contains(e.target as Node)) setClientDropOpen(false);
            if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusDropOpen(false);
            if (violRef.current && !violRef.current.contains(e.target as Node)) setViolDropOpen(false);
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    useEffect(() => {
        getClients().then(data => {
            setClients(data);
            setLoadingClients(false);
        }).catch(err => {
            console.error(err);
            setLoadingClients(false);
        });
    }, []);

    const buildRows = useCallback(async () => {
        setLoading(true);
        try {
            const users = (await getAllUsers()).filter((u) => !u.isMaster);
            const userIds = users.map(u => u.id);
            const now = new Date();
            let dates: string[] = [];

            if (range === 'today') {
                dates = [dateStr(now)];
            } else if (range === 'yesterday') {
                const yest = new Date(now); yest.setDate(yest.getDate() - 1);
                dates = [dateStr(yest)];
            } else if (range === 'week') {
                dates = getWeekDates(weekOffset);
            } else if (range === 'month') {
                const refDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
                dates = getMonthWorkDates(yearMonthStr(refDate));
            }

            const logsByDay = await getLogsBatch(userIds, dates);
            
            const newRows: DayRow[] = [];
            for (const user of users) {
                for (const d of dates) {
                    const logs = logsByDay[`${user.id}-${d}`] || [];
                    newRows.push(processLogsIntoRow(user.id, user.name, user.clientName, d, logs, user.shiftStart, user.shiftEnd, user.timezone));
                }
            }
            
            setRows(['week', 'month'].includes(range) ? newRows.filter(r => r.punchIn || r.workedMs > 0) : newRows);
        } finally { setLoading(false); }
    }, [range, weekOffset, monthOffset]);

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




    const now = new Date();
    const refDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const isMultiDay = ['week', 'month'].includes(range);

    // Memoized derived data
    const { filteredRows, baseS, uniqueUsers, recruiterFiltered, avgWorkedMs, uniqueUserCount } = useMemo(() => {
        const clientFiltered = selectedClients.length === 0 ? rows : rows.filter((r: DayRow) => selectedClients.includes(r.clientName));
        const rFiltered = clientFiltered.filter((r: DayRow) => selectedRecruiters.length === 0 || selectedRecruiters.includes(r.name));

        const fRows = (violationFilter === null ? rFiltered
            : violationFilter === 'late_in' ? rFiltered.filter((r: DayRow) => r.lateIn)
                : violationFilter === 'break' ? rFiltered.filter((r: DayRow) => r.breakViol)
                    : violationFilter === 'brb' ? rFiltered.filter((r: DayRow) => r.brbViol)
                        : rFiltered.filter((r: DayRow) => r.lateIn || r.breakViol || r.brbViol || r.earlyOut)
        ).filter((r: DayRow) => {
            if (statusDropFilter === 'Active' && !r.punchIn && r.workedMs === 0) return false;
            if (statusDropFilter === 'Not Active' && (r.punchIn || r.workedMs > 0)) return false;

            if (violDropFilter === 'Late In' && !r.lateIn) return false;
            if (violDropFilter === 'Early Out' && !r.earlyOut) return false;
            if (violDropFilter === 'Break Exceed' && !r.breakViol) return false;
            if (violDropFilter === 'BRB Exceed' && !r.brbViol) return false;

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
    const totalViol = baseS.breakViolDays + baseS.brbViolDays + baseS.lateInDays + baseS.earlyOutDays;

    return (
        <div className="space-y-5">
            {/* ── Header row ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-600/20 to-blue-500/10 rounded-xl border border-blue-500/30 shadow-[inset_0_0_15px_rgba(59,130,246,0.2)]">
                        <FileText size={20} className="text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    </div>
                    <h2 className="font-black text-white text-lg tracking-tight">Data Reports</h2>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 border border-white/10 bg-white/5 px-2.5 py-1 rounded-full">Mon–Fri</span>
                </div>
                <motion.button onClick={handleCSV} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={filteredRows.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 border border-emerald-400/30 text-white text-xs font-bold tracking-wider hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:grayscale">
                    <Download size={14} /> Export Excel
                </motion.button>
            </div>

            {/* ── Filter bar — matching Live Dashboard style ─────────────── */}
            <div className="flex z-40 items-center justify-between bg-black/60 backdrop-blur-md p-2.5 rounded-2xl border border-white/10 shadow-lg relative flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                    {/* Multi-select client dropdown */}
                    <div className="relative" ref={clientDropRef}>
                        <button
                            onClick={() => setClientDropOpen(o => !o)}
                            disabled={loadingClients}
                            className="flex items-center gap-1.5 px-3 py-2 bg-transparent hover:bg-white/[0.04] rounded-xl transition-colors text-[13px] font-bold text-slate-300"
                        >
                            <Filter size={14} className="text-slate-500" />
                            {selectedClients.length === 0 ? 'All Clients' : `${selectedClients.length} Clients`}
                            <ChevronDown size={14} className={`text-slate-500 transition-transform ${clientDropOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                            {clientDropOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                    className="absolute top-full left-0 mt-2 w-56 bg-[#0C0C14] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] overflow-hidden z-[100] py-1"
                                >
                                    <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                                        <button onClick={() => setSelectedClients(clients.map(c => c.name))} className="text-[10px] font-bold tracking-widest text-indigo-400 hover:text-indigo-300 uppercase">Select All</button>
                                        <button onClick={() => setSelectedClients([])} className="text-[10px] font-bold text-slate-600 hover:text-white uppercase tracking-widest">Clear</button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {clients.map(c => {
                                            const checked = selectedClients.includes(c.name);
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => setSelectedClients(prev =>
                                                        prev.includes(c.name) ? prev.filter(n => n !== c.name) : [...prev, c.name]
                                                    )}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-all ${checked ? 'bg-indigo-500/15 text-white font-bold' : 'text-slate-300 hover:bg-white/5 font-medium'}`}
                                                >
                                                    <span className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                                        {checked && <span className="text-black text-[10px] font-black">✓</span>}
                                                    </span>
                                                    {c.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="w-px h-6 bg-white/10" />

                    {/* Name typeahead search */}
                    <div className="relative" ref={recruiterRef}>
                        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 min-w-[200px] focus-within:border-white/20 transition-all">
                            <Users size={14} className="text-slate-500 flex-shrink-0" />
                            <input
                                type="text"
                                placeholder="Search recruiter…"
                                value={recruiterSearch}
                                onChange={e => setRecruiterSearch(e.target.value)}
                                className="bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none w-full font-semibold"
                            />
                            {recruiterSearch && <button onClick={() => setRecruiterSearch('')} className="text-slate-600 hover:text-white"><X size={10} /></button>}
                        </div>
                        {/* Suggestions dropdown */}
                        <AnimatePresence>
                            {filteredSuggestions.length > 0 && (
                                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                    className="absolute top-full left-0 mt-1 z-50 w-52 rounded-xl border border-white/10 bg-[#0C0C14] backdrop-blur-xl shadow-2xl py-1">
                                    {filteredSuggestions.slice(0, 8).map(name => (
                                        <button key={name} onClick={() => addRecruiter(name)}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-all font-medium">
                                            {name}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="w-px h-6 bg-white/10" />

                    {/* Status Dropdown */}
                    <div className="relative" ref={statusRef}>
                        <button onClick={() => { setStatusDropOpen(o => !o); setClientDropOpen(false); setViolDropOpen(false); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-transparent hover:bg-white/[0.04] rounded-xl transition-colors text-[13px] font-bold text-slate-300">
                            {statusDropFilter || 'Status'}
                            <ChevronDown size={13} className={`text-slate-500 transition-transform ${statusDropOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                            {statusDropOpen && (
                                <motion.div initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                    className="absolute top-full left-0 mt-2 w-48 bg-[#0C0C14] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] overflow-hidden z-[100] py-1">
                                    <div className="px-3 py-2 border-b border-white/[0.06]">
                                        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Filter by Status</span>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        <button onClick={() => { setStatusDropFilter(''); setStatusDropOpen(false); }}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all ${!statusDropFilter ? 'bg-indigo-500/15 text-white font-bold' : 'text-slate-300 hover:bg-white/5 font-medium'}`}>
                                            <span className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${!statusDropFilter ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                                {!statusDropFilter && <span className="text-black text-[10px] font-black">✓</span>}
                                            </span>
                                            All Statuses
                                        </button>
                                        {['Active', 'Not Active'].map(st => (
                                            <button key={st} onClick={() => { setStatusDropFilter(st); setStatusDropOpen(false); }}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all ${statusDropFilter === st ? 'bg-indigo-500/15 text-white font-bold' : 'text-slate-300 hover:bg-white/5 font-medium'}`}>
                                                <span className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${statusDropFilter === st ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                                    {statusDropFilter === st && <span className="text-black text-[10px] font-black">✓</span>}
                                                </span>
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Violations Dropdown */}
                    <div className="relative" ref={violRef}>
                        <button onClick={() => { setViolDropOpen(o => !o); setClientDropOpen(false); setStatusDropOpen(false); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-transparent hover:bg-white/[0.04] rounded-xl transition-colors text-[13px] font-bold text-slate-300">
                            {violDropFilter || 'Violations'}
                            <ChevronDown size={13} className={`text-slate-500 transition-transform ${violDropOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                            {violDropOpen && (
                                <motion.div initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                    className="absolute top-full left-0 mt-2 w-52 bg-[#0C0C14] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] overflow-hidden z-[100] py-1">
                                    <div className="px-3 py-2 border-b border-white/[0.06]">
                                        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Filter Violations</span>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        <button onClick={() => { setViolDropFilter(''); setViolDropOpen(false); }}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all ${!violDropFilter ? 'bg-indigo-500/15 text-white font-bold' : 'text-slate-300 hover:bg-white/5 font-medium'}`}>
                                            <span className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${!violDropFilter ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                                {!violDropFilter && <span className="text-black text-[10px] font-black">✓</span>}
                                            </span>
                                            All Violations
                                        </button>
                                        {['BRB Exceed', 'Break Exceed', 'Late In', 'Early Out'].map(st => (
                                            <button key={st} onClick={() => { setViolDropFilter(st); setViolDropOpen(false); }}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all ${violDropFilter === st ? 'bg-indigo-500/15 text-white font-bold' : 'text-slate-300 hover:bg-white/5 font-medium'}`}>
                                                <span className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${violDropFilter === st ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                                    {violDropFilter === st && <span className="text-black text-[10px] font-black">✓</span>}
                                                </span>
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Violation filter chip (when active) */}
                    {violationFilter && (
                        <span className="flex items-center gap-1 text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-full">
                            {violationFilter === 'late_in' ? '🔴 Late Logins' : violationFilter === 'break' ? '☕ Break Exceeds' : violationFilter === 'brb' ? '🔄 BRB Exceeds' : '⚠️ All Violations'}
                            <button onClick={() => setViolationFilter(null)} className="text-rose-400 hover:text-white transition-colors"><X size={10} /></button>
                        </span>
                    )}

                    {(selectedClients.length > 0 || selectedRecruiters.length > 0 || statusDropFilter !== '' || violDropFilter !== '' || violationFilter !== null) && (
                        <button onClick={() => { setSelectedClients([]); setSelectedRecruiters([]); setRecruiterSearch(''); setStatusDropFilter(''); setViolDropFilter(''); setViolationFilter(null); }}
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 mt-1 xl:mt-0">
                            <X size={11} /> Clear all
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 pr-2 pl-4 border-l border-white/10">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {filteredRows.length} Match{filteredRows.length !== 1 ? 'es' : ''}
                    </span>
                </div>
            </div>

            {/* ── Date range tabs — matching Live Dashboard segmented control ── */}
            <div className="glass-card rounded-[1.5rem] p-1.5 grid grid-cols-4 gap-1 bg-black/20">
                {(['today', 'yesterday', 'week', 'month'] as const).map((r) => (
                    <button key={r} onClick={() => setRange(r)}
                        className={`flex items-center justify-center gap-1.5 py-3 rounded-[1.2rem] text-sm font-bold tracking-wide transition-all duration-300 ${range === r ? 'bg-indigo-600 text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)] border border-indigo-400/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                        <Calendar size={14} /> {r === 'today' ? 'Today' : r === 'yesterday' ? 'Yesterday' : r === 'week' ? 'Past Week' : 'Past Month'}
                    </button>
                ))}
            </div>

            {range === 'week' && (
                <div className="flex items-center justify-between glass-card rounded-[1.5rem] px-5 py-4 border border-white/10 bg-black/40 shadow-xl">
                    <button onClick={() => setWeekOffset(o => o - 1)} className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"><ChevronLeft size={20} /></button>
                    <p className="text-base font-extrabold text-white tracking-wide">{weekLabel(weekOffset)}</p>
                    <button onClick={() => setWeekOffset(o => Math.min(o + 1, 0))} disabled={weekOffset >= 0} className="text-slate-400 hover:text-white transition-colors disabled:opacity-30 p-2 rounded-lg hover:bg-white/5"><ChevronRight size={20} /></button>
                </div>
            )}
            {range === 'month' && (
                <div className="flex items-center justify-between glass-card rounded-[1.5rem] px-5 py-4 border border-white/10 bg-black/40 shadow-xl">
                    <button onClick={() => setMonthOffset(o => o - 1)} className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"><ChevronLeft size={20} /></button>
                    <p className="text-base font-extrabold text-white tracking-wide">{monthLabel(refDate)}</p>
                    <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))} disabled={monthOffset >= 0} className="text-slate-400 hover:text-white transition-colors disabled:opacity-30 p-2 rounded-lg hover:bg-white/5"><ChevronRight size={20} /></button>
                </div>
            )}

            {loading && <p className="text-center text-slate-500 font-medium text-sm py-16 animate-pulse">Processing report data…</p>}

            {/* ── VIOLATIONS DASHBOARD ─────────────────────────────────────────── */}
            {!loading && baseS.daysWorked > 0 && (
                <div className="space-y-3">
                    <div className="grid grid-cols-5 gap-3">
                        {/* Avg Worked — display only */}
                        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 flex flex-col gap-1">
                            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Avg Worked / Person</p>
                            <p className="text-2xl font-black font-mono tabular-nums text-indigo-400">{formatDuration(avgWorkedMs)}</p>
                            <p className="text-[9px] text-slate-600">{uniqueUserCount} people · {range}</p>
                        </div>

                        {/* Clickable violation tiles */}
                        {([
                            { key: 'late_in' as ViolFilter, label: 'Late Logins', count: baseS.lateInDays, icon: '🔴', active: 'border-amber-500/60 bg-amber-500/10', idle: baseS.lateInDays > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/8 bg-black/30', num: baseS.lateInDays > 0 ? 'text-amber-400' : 'text-slate-600' },
                            { key: 'break' as ViolFilter, label: 'Break Exceeds', count: baseS.breakViolDays, icon: '☕', active: 'border-orange-500/60 bg-orange-500/10', idle: baseS.breakViolDays > 0 ? 'border-orange-500/30 bg-orange-500/5' : 'border-white/8 bg-black/30', num: baseS.breakViolDays > 0 ? 'text-orange-400' : 'text-slate-600' },
                            { key: 'brb' as ViolFilter, label: 'BRB Exceeds', count: baseS.brbViolDays, icon: '🔄', active: 'border-sky-500/60 bg-sky-500/10', idle: baseS.brbViolDays > 0 ? 'border-sky-500/30 bg-sky-500/5' : 'border-white/8 bg-black/30', num: baseS.brbViolDays > 0 ? 'text-sky-400' : 'text-slate-600' },
                            { key: 'all' as ViolFilter, label: 'Total Violations', count: totalViol, icon: '⚠️', active: 'border-rose-500/60 bg-rose-500/10', idle: totalViol > 0 ? 'border-rose-500/30 bg-rose-500/5' : 'border-emerald-500/20 bg-emerald-500/5', num: totalViol > 0 ? 'text-rose-400' : 'text-emerald-400' },
                        ]).map(t => {
                            const isActive = violationFilter === t.key;
                            return (
                                <button key={t.label}
                                    onClick={() => setViolationFilter(isActive ? null : t.key)}
                                    className={`rounded-2xl border p-4 flex flex-col gap-1 text-left transition-all hover:brightness-110 relative overflow-hidden
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
                            <div className="rounded-2xl border border-white/8 bg-black/30 p-4 space-y-3">
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

            {!loading && <ReportTable rows={filteredRows} showDate={isMultiDay} showName={true} />}

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
