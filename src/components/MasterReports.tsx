'use client';
import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, FileText, Calendar, ChevronLeft, ChevronRight, Download, AlertTriangle, CheckCircle, BarChart2 } from 'lucide-react';
import { getAllUsers, getLogsForDate, getLogDatesForMonth, getClients, ClientRow } from '@/lib/store';
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

interface DayRow { userId: string; name: string; clientName: string; date: string; punchIn?: number; punchOut?: number; workedMs: number; breakMs: number; brbMs: number; breakCount: number; brbCount: number; breakViol: boolean; brbViol: boolean; }

async function buildRow(userId: string, name: string, clientName: string, date: string): Promise<DayRow> {
    const logs = await getLogsForDate(userId, date);
    const session = computeSession(logs);
    const now = Date.now();
    const breakMs = computeTotalTime(session.breaks, now);
    const brbMs = computeTotalTime(session.brbs, now);
    const v = checkViolations(breakMs, brbMs);
    return { userId, name, clientName, date, punchIn: session.punchIn, punchOut: session.punchOut, workedMs: computeWorkedTime(session, now), breakMs, brbMs, breakCount: countBreaks(logs), brbCount: countBRBs(logs), breakViol: v.breakViol, brbViol: v.brbViol };
}

function ViolBadge({ breakViol, brbViol }: { breakViol: boolean; brbViol: boolean }) {
    if (!breakViol && !brbViol) return <span className="text-emerald-400"><CheckCircle size={13} /></span>;
    return (<div className="flex flex-col gap-0.5">{breakViol && <span className="flex items-center gap-1 text-rose-400 text-xs font-bold"><AlertTriangle size={10} />Break</span>}{brbViol && <span className="flex items-center gap-1 text-orange-400 text-xs font-bold"><AlertTriangle size={10} />BRB</span>}</div>);
}

interface Summary { totalWorked: number; totalBreak: number; totalBrb: number; breakCount: number; brbCount: number; breakViolDays: number; brbViolDays: number; daysWorked: number; }
function summarize(rows: DayRow[]): Summary {
    return rows.reduce((a, r) => ({ totalWorked: a.totalWorked + r.workedMs, totalBreak: a.totalBreak + r.breakMs, totalBrb: a.totalBrb + r.brbMs, breakCount: a.breakCount + r.breakCount, brbCount: a.brbCount + r.brbCount, breakViolDays: a.breakViolDays + (r.breakViol ? 1 : 0), brbViolDays: a.brbViolDays + (r.brbViol ? 1 : 0), daysWorked: a.daysWorked + (r.workedMs > 0 ? 1 : 0) }),
        { totalWorked: 0, totalBreak: 0, totalBrb: 0, breakCount: 0, brbCount: 0, breakViolDays: 0, brbViolDays: 0, daysWorked: 0 });
}

function ReportTable({ rows, showDate, showName }: { rows: DayRow[]; showDate: boolean; showName: boolean; }) {
    if (!rows.length) return <p className="text-center text-slate-500 font-medium text-sm py-16 bg-black/20 rounded-[2rem] border border-white/5">No data for this period.</p>;
    return (
        <div className="overflow-x-auto rounded-[1.5rem] border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative">
            {/* Subtle glow behind table header */}
            <div className="absolute top-0 left-0 right-0 h-10 bg-blue-500/10 blur-[20px] pointer-events-none" />

            <table className="w-full text-xs min-w-[700px] relative z-10">
                <thead>
                    <tr className="bg-white/5 text-slate-300 border-b border-white/10">
                        {showName && <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px]">Name</th>}
                        {showDate && <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px]">Date</th>}
                        {showDate && <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px]">Day</th>}
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px]">In</th><th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px]">Out</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-[#ffd700]">Worked</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-amber-400">Breaks</th><th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-amber-400">Break Time</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-[#3b82f6]">BRBs</th><th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-[#3b82f6]">BRB Time</th>
                        <th className="py-3.5 px-4 text-left font-bold tracking-widest uppercase text-[10px] text-rose-400">⚠️</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {rows.map((r, i) => (
                        <tr key={`${r.userId}-${r.date}-${i}`} className={`hover:bg-white/5 transition-colors ${r.breakViol || r.brbViol ? 'border-l-[3px] border-l-rose-500 bg-rose-500/5' : ''}`}>
                            {showName && <td className="py-3 px-4 font-extrabold text-white whitespace-nowrap tracking-tight">{r.name}</td>}
                            {showDate && <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">{r.date}</td>}
                            {showDate && <td className="py-3 px-4 text-slate-400 font-medium whitespace-nowrap">{dayName(r.date)}</td>}
                            <td className="py-3 px-4 text-emerald-400 font-mono font-bold whitespace-nowrap tracking-tight">{r.punchIn ? formatTime(r.punchIn) : <span className="text-slate-600">—</span>}</td>
                            <td className="py-3 px-4 text-rose-400 font-mono font-bold whitespace-nowrap tracking-tight">{r.punchOut ? formatTime(r.punchOut) : <span className="text-blue-400 animate-pulse font-extrabold text-[10px] uppercase tracking-widest bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]">Active</span>}</td>
                            <td className="py-3 px-4 text-[#ffd700] font-mono font-extrabold whitespace-nowrap tracking-tight">{r.workedMs > 0 ? formatDuration(r.workedMs) : <span className="text-slate-600">—</span>}</td>
                            <td className="py-3 px-4 text-amber-400 font-bold whitespace-nowrap">{r.breakCount > 0 ? r.breakCount : '—'}</td>
                            <td className="py-3 px-4 text-amber-400 font-mono font-bold whitespace-nowrap tracking-tight">{r.breakMs > 0 ? formatDuration(r.breakMs) : '—'}</td>
                            <td className="py-3 px-4 text-[#3b82f6] font-bold whitespace-nowrap">{r.brbCount > 0 ? r.brbCount : '—'}</td>
                            <td className="py-3 px-4 text-[#3b82f6] font-mono font-bold whitespace-nowrap tracking-tight">{r.brbMs > 0 ? formatDuration(r.brbMs) : '—'}</td>
                            <td className="py-3 px-4 whitespace-nowrap"><ViolBadge breakViol={r.breakViol} brbViol={r.brbViol} /></td>
                        </tr>
                    ))}
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
                    { label: 'Total Worked', val: formatDuration(s.totalWorked), color: 'text-[#ffd700]' },
                    { label: 'Avg Break/day', val: formatDuration(avgBreak), color: avgBreak > BREAK_LIMIT_MS ? 'text-rose-400' : 'text-amber-400' },
                    { label: 'Avg BRB/day', val: formatDuration(avgBrb), color: avgBrb > BRB_LIMIT_MS ? 'text-orange-400' : 'text-[#3b82f6]' },
                    { label: 'Break Viols', val: s.breakViolDays, color: s.breakViolDays > 0 ? 'text-rose-400' : 'text-slate-500' },
                    { label: 'BRB Viols', val: s.brbViolDays, color: s.brbViolDays > 0 ? 'text-orange-400' : 'text-slate-500' },
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

export default function MasterReports() {
    const [range, setRange] = useState<DateRange>('today');
    const [weekOffset, setWeekOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);
    const [rows, setRows] = useState<DayRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('all');
    const [loadingClients, setLoadingClients] = useState(true);

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
            const newRows: DayRow[] = [];
            const now = new Date();

            if (range === 'today') {
                const today = dateStr(now);
                await Promise.all(users.map(async (u) => { newRows.push(await buildRow(u.id, u.name, u.clientName, today)); }));
            } else if (range === 'yesterday') {
                const yest = new Date(now); yest.setDate(yest.getDate() - 1);
                await Promise.all(users.map(async (u) => { newRows.push(await buildRow(u.id, u.name, u.clientName, dateStr(yest))); }));
            } else if (range === 'week') {
                const dates = getWeekDates(weekOffset);
                await Promise.all(users.flatMap((u) => dates.map(async (d) => { newRows.push(await buildRow(u.id, u.name, u.clientName, d)); })));
            } else if (range === 'month') {
                const refDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
                const ym = yearMonthStr(refDate);
                const dates = getMonthWorkDates(ym);
                await Promise.all(users.flatMap((u) => dates.map(async (d) => { newRows.push(await buildRow(u.id, u.name, u.clientName, d)); })));
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
        const header = ['Name', 'Client', ...(isMultiDay ? ['Date', 'Day'] : []), 'Punch In', 'Punch Out', 'Worked', 'Breaks #', 'Break Time', 'BRBs #', 'BRB Time', 'Break Violation', 'BRB Violation'];
        const data = filteredRows.map(r => [r.name, r.clientName, ...(isMultiDay ? [r.date, dayName(r.date)] : []), r.punchIn ? formatTime(r.punchIn) : '', r.punchOut ? formatTime(r.punchOut) : '', formatDuration(r.workedMs), r.breakCount, formatDuration(r.breakMs), r.brbCount, formatDuration(r.brbMs), r.breakViol ? 'YES' : 'No', r.brbViol ? 'YES' : 'No']);
        const s = summarize(filteredRows.filter(r => r.workedMs > 0));
        exportExcel([header, ...data, [], ['TOTALS', '', ...(isMultiDay ? ['', ''] : []), '', '', formatDuration(s.totalWorked), s.breakCount, formatDuration(s.totalBreak), s.brbCount, formatDuration(s.totalBrb), `${s.breakViolDays} day(s)`, `${s.brbViolDays} day(s)`], [], ['Violation Limits:', 'Break > 1h 15m per day', 'BRB > 10m per day']], 'data-report');
    };

    const now = new Date();
    const refDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const isMultiDay = ['week', 'month'].includes(range);

    const filteredRows = selectedClient === 'all' ? rows : rows.filter(r => r.clientName === selectedClient);
    const uniqueUsers = [...new Set(filteredRows.map(r => r.userId))];
    const allS = summarize(filteredRows.filter(r => r.workedMs > 0));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-600/20 to-blue-500/10 rounded-xl border border-blue-500/30 shadow-[inset_0_0_15px_rgba(59,130,246,0.2)]">
                        <FileText size={20} className="text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    </div>
                    <h2 className="font-extrabold text-white text-lg tracking-tight">Data Reports</h2>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 border border-white/10 bg-white/5 px-2.5 py-1 rounded-full ml-2">Mon–Fri</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Briefcase size={12} className="text-slate-500 group-focus-within:text-blue-400 transition-colors duration-300" />
                        </div>
                        <select
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                            disabled={loadingClients}
                            className="bg-white/[0.03] border border-white/10 rounded-lg py-1.5 pl-8 pr-8 text-xs text-white focus:outline-none focus:bg-white/[0.05] focus:border-blue-500/50 appearance-none min-w-[140px]"
                        >
                            <option value="all" className="bg-slate-900 text-white">All Clients</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.name} className="bg-slate-900 text-white">{c.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-500 group-focus-within:text-blue-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                        </div>
                    </div>

                    <motion.button onClick={handleCSV} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={filteredRows.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 border border-emerald-400/30 text-white text-xs font-bold tracking-wider hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:grayscale">
                        <Download size={14} /> Export Excel
                    </motion.button>
                </div>
            </div>

            <div className="glass-card rounded-[1.5rem] p-1.5 grid grid-cols-4 gap-1 bg-black/20">
                {(['today', 'yesterday', 'week', 'month'] as const).map((r) => (
                    <button key={r} onClick={() => setRange(r)}
                        className={`flex items-center justify-center gap-1.5 py-3 rounded-[1.2rem] text-sm font-bold tracking-wide transition-all duration-300 ${range === r ? 'bg-blue-600/90 text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)] border border-blue-400/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
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

            {!loading && allS.daysWorked > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: isMultiDay ? 'Total Team Hours' : 'Today\'s Total', val: formatDuration(allS.totalWorked), color: 'text-[#ffd700]', bg: 'bg-black/40 border-[#ffd700]/30 shadow-[inset_0_0_20px_rgba(255,215,0,0.1)]' },
                        { label: isMultiDay ? 'Avg Break time' : 'Total Break time', val: formatDuration(isMultiDay && allS.daysWorked > 0 ? allS.totalBreak / allS.daysWorked : allS.totalBreak), color: 'text-amber-400', bg: 'bg-black/40 border-amber-500/30 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' },
                        { label: 'Total Violations', val: `${allS.breakViolDays + allS.brbViolDays}`, color: allS.breakViolDays + allS.brbViolDays > 0 ? 'text-rose-400' : 'text-emerald-400', bg: allS.breakViolDays + allS.brbViolDays > 0 ? 'bg-rose-900/20 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.15)]' : 'bg-emerald-900/10 border-emerald-500/30' },
                    ].map(s => (
                        <div key={s.label} className={`border rounded-[1.5rem] p-4 text-center backdrop-blur-md transition-all hover:scale-105 ${s.bg}`}>
                            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1.5">{s.label}</p>
                            <p className={`text-2xl font-black font-mono tracking-tighter ${s.color}`}>{s.val}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-4 text-[10px] font-bold tracking-widest uppercase text-slate-400 px-2">
                <span className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5"><AlertTriangle size={12} className="text-rose-400 drop-shadow-[0_0_5px_rgba(244,63,94,0.8)]" /> Break &gt; 1h 15m</span>
                <span className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5"><AlertTriangle size={12} className="text-orange-400 drop-shadow-[0_0_5px_rgba(251,146,60,0.8)]" /> BRB &gt; 10m</span>
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
                    {uniqueUsers.map(uid => { const uRows = filteredRows.filter(r => r.userId === uid); return <UserSummaryCard key={uid} name={uRows[0]?.name ?? uid} rows={uRows} />; })}
                </div>
            )}
        </div>
    );
}
