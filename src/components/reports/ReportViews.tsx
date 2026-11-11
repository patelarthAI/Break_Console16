'use client';

import { useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Pencil,
    Printer,
    Eye,
    ShieldAlert,
    Trophy,
    Flame,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import {
    DayRow,
    RecruiterRollup,
    ClientRollup,
    summarizeRows,
} from '@/lib/reportUtils';
import {
    dayName,
    formatTimeNoSec,
    formatDurationHM,
    formatExceedHM,
    COMBINED_LIMIT_MS,
} from '@/lib/timeUtils';

export type SortKey =
    | 'name'
    | 'date'
    | 'punchIn'
    | 'workedMs'
    | 'breakMs'
    | 'brbMs'
    | 'totalBreakCount'
    | 'totalBreakMs'
    | 'totalBreakViolMs';

export function ViolBadge({ r }: { r: DayRow }) {
    const anyViol =
        r.breakViol || r.brbViol || r.totalBreakViol || r.lateIn || r.earlyOut || r.autoLogout;

    if (!anyViol && !r.hasAnomaly) {
        return (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                <CheckCircle size={11} className="shrink-0" /> Clean
            </span>
        );
    }

    return (
        <div className="flex flex-wrap gap-1">
            {r.hasAnomaly && (
                <span
                    title={r.anomalies.join(' · ')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-200 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-md"
                >
                    <ShieldAlert size={10} className="shrink-0 text-amber-300" />
                    {r.anomalies[0]}
                </span>
            )}
            {r.totalBreakViol && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-fuchsia-300 bg-fuchsia-500/15 border border-fuchsia-500/35 px-2 py-0.5 rounded-md">
                    <Flame size={10} className="shrink-0" />
                    Brk+BRB (+{formatExceedHM(r.totalBreakViolMs)})
                </span>
            )}
            {r.breakViol && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/25 px-2 py-0.5 rounded-md">
                    <AlertTriangle size={10} className="shrink-0" />
                    Break (+{formatExceedHM(r.breakViolMs)})
                </span>
            )}
            {r.brbViol && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/25 px-2 py-0.5 rounded-md">
                    <AlertTriangle size={10} className="shrink-0" />
                    BRB (+{formatExceedHM(r.brbViolMs)})
                </span>
            )}
            {r.lateIn && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md">
                    <AlertTriangle size={10} className="shrink-0" />
                    Late ({formatExceedHM(r.lateInMs)})
                </span>
            )}
            {r.earlyOut && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded-md">
                    <AlertTriangle size={10} className="shrink-0" />
                    Early ({formatExceedHM(r.earlyOutMs)})
                </span>
            )}
            {r.autoLogout && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded-md">
                    Auto Out
                </span>
            )}
        </div>
    );
}

interface DailyReportTableProps {
    rows: DayRow[];
    showDate: boolean;
    onEdit: (r: DayRow) => void;
    sortKey: SortKey;
    sortDir: 'asc' | 'desc';
    onSort: (k: SortKey) => void;
}

export function DailyReportTable({
    rows,
    showDate,
    onEdit,
    sortKey,
    sortDir,
    onSort,
}: DailyReportTableProps) {
    if (!rows.length) {
        return (
            <div className="panel-3d border border-white/[0.06] bg-black/20 text-center py-14 rounded-2xl text-slate-400 text-xs font-medium">
                No attendance logs found for the current filters.
            </div>
        );
    }

    const gridCols = showDate
        ? 'minmax(175px, 1.35fr) minmax(118px, 0.9fr) 82px 86px 86px 96px 88px minmax(145px, 1.15fr) minmax(195px, 1.55fr) 36px'
        : 'minmax(185px, 1.4fr) 82px 86px 86px 96px 88px minmax(150px, 1.2fr) minmax(205px, 1.6fr) 36px';

    const SortHdr = ({
        k,
        label,
        className = 'text-zinc-400',
    }: {
        k: SortKey;
        label: string;
        className?: string;
    }) => {
        const active = sortKey === k;
        return (
            <button
                type="button"
                onClick={() => onSort(k)}
                className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold tracking-widest uppercase hover:text-white transition-colors cursor-pointer text-left ${active ? 'text-white' : className}`}
            >
                <span>{label}</span>
                {active ? (
                    sortDir === 'asc' ? (
                        <ArrowUp size={10} className="text-indigo-400" />
                    ) : (
                        <ArrowDown size={10} className="text-indigo-400" />
                    )
                ) : (
                    <ArrowUpDown size={9} className="opacity-35" />
                )}
            </button>
        );
    };

    const s = summarizeRows(rows);
    const avgDays = s.activeDays || 1;
    const avgCombinedMs = s.totalCombinedBreak / avgDays;
    const avgExceedMs = s.totalBreakViolMsSum / avgDays;

    return (
        <div className="w-full overflow-auto max-h-[66vh] rounded-2xl border border-white/[0.08] bg-[#0d101d] shadow-2xl p-2.5 scrollbar-thin">
            <div className="min-w-[1060px] flex flex-col gap-1.5 relative">
                {/* Sticky Header */}
                <div
                    className="sticky top-0 z-20 grid gap-3 px-4 py-3 rounded-xl bg-[#121629] border border-white/10 shadow-lg items-center select-none"
                    style={{ gridTemplateColumns: gridCols }}
                >
                    <SortHdr k="name" label="Recruiter" className="text-zinc-300" />
                    {showDate && <SortHdr k="date" label="Date" className="text-zinc-300" />}
                    <SortHdr k="punchIn" label="Arrival" className="text-zinc-300" />
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-300">
                        Departure
                    </div>
                    <SortHdr k="workedMs" label="Net Active" className="text-emerald-400" />
                    <SortHdr k="breakMs" label="Break" />
                    <SortHdr k="brbMs" label="BRB" />
                    <SortHdr k="totalBreakMs" label="Brks & Exceed" className="text-fuchsia-300" />
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-300">
                        Compliance
                    </div>
                    <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-500 text-right">
                        Audit
                    </div>
                </div>

                {/* Data Rows (click anywhere to audit/edit logs) */}
                {rows.map((r, i) => (
                    <div
                        key={`${r.userId}-${r.date}-${i}`}
                        onClick={() => onEdit(r)}
                        title="Click row to inspect or edit daily logs"
                        className={`grid gap-3 px-4 py-2.5 items-center rounded-xl transition-colors duration-150 border cursor-pointer group ${
                            r.hasAnomaly
                                ? 'border-amber-500/35 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                                : 'border-white/[0.04] bg-[#121524]/70 hover:bg-[#181c30] hover:border-indigo-500/30'
                        }`}
                        style={{ gridTemplateColumns: gridCols }}
                    >
                        {/* Recruiter */}
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div
                                className={`w-8 h-8 rounded-lg border text-xs font-bold flex items-center justify-center shrink-0 ${
                                    r.hasAnomaly
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                        : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                }`}
                            >
                                {r.name[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="font-semibold text-[13px] text-zinc-100 tracking-tight truncate group-hover:text-indigo-200 transition-colors">
                                    {r.name}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">{r.clientName}</div>
                            </div>
                        </div>

                        {/* Date + Day combined */}
                        {showDate && (
                            <div className="text-xs font-mono text-zinc-300">
                                <span className="font-medium">{r.date}</span>
                                <span className="text-zinc-500 ml-1.5 font-sans text-[11px]">{dayName(r.date)}</span>
                            </div>
                        )}

                        {/* Arrival (no seconds) */}
                        <div className="text-xs font-mono text-zinc-300 font-medium">
                            {r.punchIn ? formatTimeNoSec(r.punchIn) : <span className="text-zinc-600 font-sans">—</span>}
                        </div>

                        {/* Departure (no seconds) */}
                        <div className="text-xs font-mono text-zinc-300 font-medium">
                            {r.punchOut ? (
                                <span className={r.autoLogout ? 'text-rose-400 font-semibold' : 'text-zinc-300'}>
                                    {formatTimeNoSec(r.punchOut)}
                                </span>
                            ) : r.punchIn ? (
                                <span className="text-sky-400 font-bold text-[10px] uppercase tracking-wider bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                                    Active
                                </span>
                            ) : (
                                <span className="text-zinc-600 font-sans">—</span>
                            )}
                        </div>

                        {/* Net Active (no seconds) */}
                        <div className="text-xs font-mono text-emerald-400 font-semibold">
                            {r.workedMs > 0 ? formatDurationHM(r.workedMs) : <span className="text-zinc-600 font-sans">—</span>}
                        </div>

                        {/* Break duration + count */}
                        <div className={`text-xs font-mono flex items-center gap-1.5 ${r.breakViol ? 'text-orange-300 font-semibold' : 'text-zinc-300'}`}>
                            {r.breakMs > 0 || r.breakCount > 0 ? (
                                <>
                                    <span>{formatDurationHM(r.breakMs)}</span>
                                    <span className="text-[10px] text-zinc-500">({r.breakCount})</span>
                                </>
                            ) : (
                                <span className="text-zinc-600 font-sans">—</span>
                            )}
                        </div>

                        {/* BRB duration + count */}
                        <div className={`text-xs font-mono flex items-center gap-1.5 ${r.brbViol ? 'text-sky-300 font-semibold' : 'text-zinc-300'}`}>
                            {r.brbMs > 0 || r.brbCount > 0 ? (
                                <>
                                    <span>{formatDurationHM(r.brbMs)}</span>
                                    <span className="text-[10px] text-zinc-500">({r.brbCount})</span>
                                </>
                            ) : (
                                <span className="text-zinc-600 font-sans">—</span>
                            )}
                        </div>

                        {/* Total Breaks Count + Brk+BRB Combined + Exceed */}
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                            {r.totalBreakMs > 0 || r.totalBreakCount > 0 ? (
                                <>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/10">
                                        {r.totalBreakCount}×
                                    </span>
                                    <span className={r.totalBreakViol ? 'text-fuchsia-300 font-semibold' : 'text-zinc-200'}>
                                        {formatDurationHM(r.totalBreakMs)}
                                    </span>
                                    {r.totalBreakViol && (
                                        <span className="text-[10px] font-bold text-rose-200 bg-rose-500/20 border border-rose-500/35 px-1.5 py-0.5 rounded">
                                            +{formatExceedHM(r.totalBreakViolMs)}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-zinc-600 font-sans">—</span>
                            )}
                        </div>

                        {/* Compliance */}
                        <div className="min-w-0">
                            <ViolBadge r={r} />
                        </div>

                        {/* Edit trigger */}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(r);
                                }}
                                title="Edit daily logs"
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-indigo-500/25 border border-white/[0.07] hover:border-indigo-500/40 text-zinc-400 hover:text-indigo-200 transition-all opacity-50 group-hover:opacity-100 cursor-pointer"
                            >
                                <Pencil size={12} />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Sticky Totals & Overall Exceed Bar */}
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 mt-1 rounded-xl bg-[#121629]/95 border border-indigo-500/25 shadow-lg">
                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest uppercase text-indigo-300">
                        <span>Totals &amp; Daily Averages</span>
                        <span className="text-slate-500">({s.activeDays} active / {rows.length} rows)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-mono">
                        <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1.5">Net Active</span>
                            <span className="text-emerald-400 font-bold">{formatDurationHM(s.totalWorked)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1.5">Total Breaks</span>
                            <span className="text-zinc-100 font-bold">{s.totalBreakCountSum}</span>
                            <span className="text-slate-500 ml-1 text-[11px]">({s.totalBreakEventsSum}B + {s.totalBrbEventsSum}R)</span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1.5">Brk+BRB</span>
                            <span className="text-fuchsia-300 font-bold">{formatDurationHM(s.totalCombinedBreak)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1.5">Avg Brk+BRB/d</span>
                            <span className={avgCombinedMs > COMBINED_LIMIT_MS ? 'text-amber-300 font-bold' : 'text-zinc-200 font-semibold'}>
                                {formatDurationHM(avgCombinedMs)}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1.5">Avg Exceed/d</span>
                            <span className={avgExceedMs > 0 ? 'text-rose-300 font-bold' : 'text-emerald-400 font-semibold'}>
                                {avgExceedMs > 0 ? `+${formatExceedHM(avgExceedMs)}` : '0m'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1.5">Overall Exceed</span>
                            <span className={s.totalBreakViolMsSum > 0 ? 'text-rose-400 font-black' : 'text-emerald-400 font-bold'}>
                                {s.totalBreakViolMsSum > 0 ? `+${formatExceedHM(s.totalBreakViolMsSum)}` : '0m'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface RecruiterRollupTableProps {
    rollups: RecruiterRollup[];
    onInspectRecruiter: (name: string) => void;
    onPrintScorecard: (userId: string, name: string, clientName: string) => void;
}

export function RecruiterRollupTable({
    rollups,
    onInspectRecruiter,
    onPrintScorecard,
}: RecruiterRollupTableProps) {
    if (!rollups.length) {
        return (
            <div className="panel-3d border border-white/[0.06] bg-black/20 text-center py-14 rounded-2xl text-slate-400 text-xs font-medium">
                No recruiter records match the active filters.
            </div>
        );
    }

    const totalWorked = rollups.reduce((a, r) => a + r.totalWorkedMs, 0);
    const totalBreaks = rollups.reduce((a, r) => a + r.totalBreakCount, 0);
    const totalCombined = rollups.reduce((a, r) => a + r.totalCombinedBreakMs, 0);
    const totalExceed = rollups.reduce((a, r) => a + r.overallExceedMs, 0);
    const totalActiveDays = rollups.reduce((a, r) => a + r.activeDays, 0) || 1;

    return (
        <div className="w-full overflow-auto max-h-[66vh] rounded-2xl border border-white/[0.08] bg-[#0d101d] shadow-2xl p-2.5 scrollbar-thin">
            <div className="min-w-[1040px] flex flex-col gap-1.5">
                <div
                    className="sticky top-0 z-20 grid gap-3 px-4 py-3 rounded-xl bg-[#121629] border border-white/10 shadow-lg items-center text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400"
                    style={{
                        gridTemplateColumns:
                            'minmax(180px, 1.4fr) 56px 115px 90px 92px 92px 95px 110px 120px 92px 104px',
                    }}
                >
                    <span className="text-zinc-300">Recruiter</span>
                    <span>Days</span>
                    <span className="text-emerald-400">Net Active</span>
                    <span>Total Brks</span>
                    <span>Brk+BRB</span>
                    <span>Avg/Day</span>
                    <span>Avg Exceed</span>
                    <span className="text-fuchsia-300">Overall Exceed</span>
                    <span>Violations</span>
                    <span>Compliance</span>
                    <span className="text-right">Actions</span>
                </div>

                {rollups.map(r => (
                    <div
                        key={r.userId}
                        className="grid gap-3 px-4 py-2.5 items-center rounded-xl border border-white/[0.04] bg-[#121524]/75 hover:bg-[#181c30] hover:border-indigo-500/30 transition-colors"
                        style={{
                            gridTemplateColumns:
                                'minmax(180px, 1.4fr) 56px 115px 90px 92px 92px 95px 110px 120px 92px 104px',
                        }}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                                {r.name[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="font-semibold text-[13px] text-zinc-100 truncate">{r.name}</div>
                                <div className="text-[10px] text-slate-500 truncate">{r.clientName}</div>
                            </div>
                        </div>

                        <div className="text-xs font-mono text-zinc-200 font-semibold">{r.activeDays}d</div>

                        <div className="text-xs font-mono">
                            <div className="text-emerald-400 font-semibold">{formatDurationHM(r.totalWorkedMs)}</div>
                            <div className="text-[10px] text-slate-500">{formatDurationHM(r.avgWorkedPerDayMs)}/d</div>
                        </div>

                        <div className="text-xs font-mono text-zinc-200">
                            <span className="font-bold">{r.totalBreakCount}</span>
                            <span className="text-[10px] text-slate-500 ml-1">({r.breakCount}B+{r.brbCount}R)</span>
                        </div>

                        <div className="text-xs font-mono text-zinc-200 font-medium">
                            {formatDurationHM(r.totalCombinedBreakMs)}
                        </div>

                        <div className={`text-xs font-mono font-semibold ${r.avgCombinedBreakPerDayMs > COMBINED_LIMIT_MS ? 'text-amber-300' : 'text-zinc-200'}`}>
                            {formatDurationHM(r.avgCombinedBreakPerDayMs)}
                        </div>

                        <div className={`text-xs font-mono font-semibold ${r.avgExceedPerDayMs > 0 ? 'text-rose-300' : 'text-emerald-400'}`}>
                            {r.avgExceedPerDayMs > 0 ? `+${formatExceedHM(r.avgExceedPerDayMs)}` : '0m'}
                        </div>

                        <div className={`text-xs font-mono font-black ${r.overallExceedMs > 0 ? 'text-fuchsia-300' : 'text-emerald-400'}`}>
                            {r.overallExceedMs > 0 ? `+${formatExceedHM(r.overallExceedMs)}` : '0m'}
                        </div>

                        <div className="text-[10px] font-mono text-slate-400 leading-tight">
                            {r.totalViolCount === 0 && r.anomalyDays === 0 ? (
                                <span className="text-emerald-400 font-bold">0 issues</span>
                            ) : (
                                <span>
                                    L:{r.lateInDays} · B:{r.totalBreakViolDays} · A:{r.autoLogoutDays}
                                    {r.anomalyDays > 0 && <span className="text-amber-300 font-bold"> · !{r.anomalyDays}</span>}
                                </span>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-1">
                                <span className={r.complianceRate >= 90 ? 'text-emerald-400' : r.complianceRate >= 70 ? 'text-amber-400' : 'text-rose-400'}>
                                    {r.complianceRate}%
                                </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${r.complianceRate >= 90 ? 'bg-emerald-500' : r.complianceRate >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${r.complianceRate}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={() => onInspectRecruiter(r.name)}
                                title="View daily logs for this recruiter"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-indigo-500/20 border border-white/10 text-[10px] font-semibold text-zinc-200 cursor-pointer transition-colors"
                            >
                                <Eye size={11} /> Logs
                            </button>
                            <button
                                type="button"
                                onClick={() => onPrintScorecard(r.userId, r.name, r.clientName)}
                                title="Print or save PDF scorecard"
                                className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-emerald-500/20 border border-white/10 text-zinc-300 hover:text-emerald-300 cursor-pointer transition-colors"
                            >
                                <Printer size={12} />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Rollup Summary Footer */}
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-4 px-5 py-3 mt-1 rounded-xl bg-[#121629]/95 border border-indigo-500/25 text-xs font-mono">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-300">
                        {rollups.length} Recruiters · {totalActiveDays} Active Days
                    </span>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                        <span><span className="text-slate-500 text-[10px] mr-1">NET:</span><strong className="text-emerald-400">{formatDurationHM(totalWorked)}</strong></span>
                        <span><span className="text-slate-500 text-[10px] mr-1">TOTAL BRKS:</span><strong className="text-white">{totalBreaks}</strong></span>
                        <span><span className="text-slate-500 text-[10px] mr-1">BRK+BRB:</span><strong className="text-fuchsia-300">{formatDurationHM(totalCombined)}</strong></span>
                        <span><span className="text-slate-500 text-[10px] mr-1">AVG EXCEED/D:</span><strong className="text-rose-300">+{formatExceedHM(totalExceed / totalActiveDays)}</strong></span>
                        <span><span className="text-slate-500 text-[10px] mr-1">OVERALL EXCEED:</span><strong className="text-rose-400">{totalExceed > 0 ? `+${formatExceedHM(totalExceed)}` : '0m'}</strong></span>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface ClientRollupTableProps {
    rollups: ClientRollup[];
    onSelectClient: (clientName: string) => void;
}

export function ClientRollupTable({ rollups, onSelectClient }: ClientRollupTableProps) {
    if (!rollups.length) {
        return (
            <div className="panel-3d border border-white/[0.06] bg-black/20 text-center py-14 rounded-2xl text-slate-400 text-xs font-medium">
                No client records match the active filters.
            </div>
        );
    }

    return (
        <div className="w-full overflow-auto max-h-[66vh] rounded-2xl border border-white/[0.08] bg-[#0d101d] shadow-2xl p-2.5 scrollbar-thin">
            <div className="min-w-[960px] flex flex-col gap-1.5">
                <div
                    className="sticky top-0 z-20 grid gap-3 px-4 py-3 rounded-xl bg-[#121629] border border-white/10 shadow-lg items-center text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400"
                    style={{
                        gridTemplateColumns:
                            'minmax(175px, 1.3fr) 82px 72px 115px 96px 96px 96px 104px 115px 100px',
                    }}
                >
                    <span className="text-zinc-300">Client Team</span>
                    <span>Recruiters</span>
                    <span>Days</span>
                    <span className="text-emerald-400">Net Active</span>
                    <span>Total Brks</span>
                    <span>Brk+BRB</span>
                    <span>Avg/Day</span>
                    <span>Avg Exceed</span>
                    <span className="text-fuchsia-300">Overall Exceed</span>
                    <span>Compliance</span>
                </div>

                {rollups.map(c => (
                    <button
                        key={c.clientName}
                        type="button"
                        onClick={() => onSelectClient(c.clientName)}
                        className="grid gap-3 px-4 py-3 items-center text-left rounded-xl border border-white/[0.04] bg-[#121524]/75 hover:bg-[#181c30] hover:border-indigo-500/35 transition-colors cursor-pointer"
                        style={{
                            gridTemplateColumns:
                                'minmax(175px, 1.3fr) 82px 72px 115px 96px 96px 96px 104px 115px 100px',
                        }}
                    >
                        <div className="font-bold text-sm text-zinc-100 truncate">{c.clientName}</div>
                        <div className="text-xs font-mono text-zinc-300">{c.recruiterCount}</div>
                        <div className="text-xs font-mono text-zinc-300">{c.activeDays}d</div>
                        <div className="text-xs font-mono">
                            <div className="text-emerald-400 font-semibold">{formatDurationHM(c.totalWorkedMs)}</div>
                            <div className="text-[10px] text-slate-500">{formatDurationHM(c.avgWorkedPerDayMs)}/d avg</div>
                        </div>
                        <div className="text-xs font-mono text-zinc-200 font-semibold">
                            {c.totalBreakCount} <span className="text-[10px] text-slate-500">({c.breakCount}B+{c.brbCount}R)</span>
                        </div>
                        <div className="text-xs font-mono text-zinc-200">{formatDurationHM(c.totalCombinedBreakMs)}</div>
                        <div className={`text-xs font-mono font-semibold ${c.avgCombinedBreakPerDayMs > COMBINED_LIMIT_MS ? 'text-amber-300' : 'text-zinc-200'}`}>
                            {formatDurationHM(c.avgCombinedBreakPerDayMs)}
                        </div>
                        <div className={`text-xs font-mono font-semibold ${c.avgExceedPerDayMs > 0 ? 'text-rose-300' : 'text-emerald-400'}`}>
                            {c.avgExceedPerDayMs > 0 ? `+${formatExceedHM(c.avgExceedPerDayMs)}` : '0m'}
                        </div>
                        <div className={`text-xs font-mono font-black ${c.overallExceedMs > 0 ? 'text-fuchsia-300' : 'text-emerald-400'}`}>
                            {c.overallExceedMs > 0 ? `+${formatExceedHM(c.overallExceedMs)}` : '0m'}
                        </div>
                        <div>
                            <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-1">
                                <span className={c.complianceRate >= 90 ? 'text-emerald-400' : c.complianceRate >= 70 ? 'text-amber-400' : 'text-rose-400'}>
                                    {c.complianceRate}%
                                </span>
                                <span className="text-[9px] text-slate-500">{c.totalViolCount}v</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${c.complianceRate >= 90 ? 'bg-emerald-500' : c.complianceRate >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${c.complianceRate}%` }}
                                />
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

export function ComplianceLeaderboard({
    rollups,
    onInspectRecruiter,
}: {
    rollups: RecruiterRollup[];
    onInspectRecruiter: (name: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    if (rollups.length < 2) return null;

    const cleanest = [...rollups]
        .filter(r => r.activeDays > 0)
        .sort((a, b) => b.complianceRate - a.complianceRate || a.overallExceedMs - b.overallExceedMs || b.activeDays - a.activeDays)
        .slice(0, 5);

    const topExceeders = [...rollups]
        .filter(r => r.overallExceedMs > 0)
        .sort((a, b) => b.overallExceedMs - a.overallExceedMs)
        .slice(0, 5);

    const topClean = cleanest[0];
    const topExceed = topExceeders[0];

    return (
        <div className="panel-3d rounded-2xl border border-white/[0.08] bg-[#0b0d18]/80 overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-300">
                        <Trophy size={12} className="text-amber-400" />
                        Compliance Pulse
                    </span>
                    {topClean && (
                        <span className="text-[11px] text-slate-300">
                            <span className="text-emerald-400 font-bold">Best:</span> {topClean.name} ({topClean.complianceRate}% clean)
                        </span>
                    )}
                    {topExceed && (
                        <span className="text-[11px] text-slate-300">
                            <span className="text-fuchsia-400 font-bold">Highest Break Exceed:</span> {topExceed.name} (+{formatExceedHM(topExceed.overallExceedMs)} across {topExceed.totalBreakViolDays}d)
                        </span>
                    )}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {expanded ? 'Hide Top 5' : 'Show Top 5'}
                    {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </span>
            </button>

            {expanded && (
                <div className="grid md:grid-cols-2 gap-3 p-3.5 pt-1 border-t border-white/[0.06]">
                    <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1.5">
                                <Trophy size={11} /> Top Clean Compliance
                            </span>
                            <span className="text-[10px] text-slate-500">Highest % · Lowest Exceed</span>
                        </div>
                        <div className="space-y-1.5">
                            {cleanest.map((r, idx) => (
                                <button
                                    key={r.userId}
                                    type="button"
                                    onClick={() => onInspectRecruiter(r.name)}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/25 hover:bg-emerald-500/10 text-xs transition-colors cursor-pointer"
                                >
                                    <span className="truncate text-zinc-200 font-medium">
                                        <span className="text-emerald-400 font-mono mr-2">#{idx + 1}</span>
                                        {r.name}
                                        <span className="text-slate-500 text-[10px] ml-1.5">{r.clientName}</span>
                                    </span>
                                    <span className="font-mono font-bold text-emerald-300 shrink-0 ml-2">
                                        {r.complianceRate}% ({r.cleanDays}/{r.activeDays}d)
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl bg-fuchsia-500/[0.04] border border-fuchsia-500/20 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300 flex items-center gap-1.5">
                                <Flame size={11} /> Repeat Break+BRB Exceeds
                            </span>
                            <span className="text-[10px] text-slate-500">Click to inspect logs</span>
                        </div>
                        {topExceeders.length === 0 ? (
                            <p className="text-xs text-emerald-400 py-4 text-center font-medium">
                                Zero combined break exceeds across all recruiters in this range!
                            </p>
                        ) : (
                            <div className="space-y-1.5">
                                {topExceeders.map((r, idx) => (
                                    <button
                                        key={r.userId}
                                        type="button"
                                        onClick={() => onInspectRecruiter(r.name)}
                                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/25 hover:bg-fuchsia-500/10 text-xs transition-colors cursor-pointer"
                                    >
                                        <span className="truncate text-zinc-200 font-medium">
                                            <span className="text-fuchsia-400 font-mono mr-2">#{idx + 1}</span>
                                            {r.name}
                                            <span className="text-slate-500 text-[10px] ml-1.5">Avg +{formatExceedHM(r.avgExceedPerDayMs)}/d</span>
                                        </span>
                                        <span className="font-mono font-bold text-rose-300 shrink-0 ml-2">
                                            +{formatExceedHM(r.overallExceedMs)} · {r.totalBreakViolDays}d
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
