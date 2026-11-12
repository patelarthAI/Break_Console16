'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Briefcase,
    FileText,
    Calendar,
    AlertTriangle,
    CheckCircle,
    BarChart2,
    Users,
    X,
    ChevronDown,
    Zap,
    Search,
    Clock,
    Coffee,
    Clock3,
    LogOut,
    GitCompare,
    Flame,
    ShieldAlert,
    Sliders,
    RefreshCw,
    Printer,
    Layers,
    UserCheck,
    Building2,
} from 'lucide-react';
import { getAllUsers, getClients, ClientRow, getLogsBatch, getCurrentUser } from '@/lib/store';
import { User } from '@/types';
import DailyLogEditor from './DailyLogEditor';
import CustomSelect from './ui/CustomSelect';
import DateRangePicker, { type DateRangeValue } from './ui/DateRangePicker';
import PolicyRulesModal from './reports/PolicyRulesModal';
import {
    DailyReportTable,
    RecruiterRollupTable,
    ClientRollupTable,
    ComplianceLeaderboard,
    type SortKey,
} from './reports/ReportViews';
import {
    PolicyConfigState,
    loadPolicyConfig,
    savePolicyConfig,
} from '@/lib/policyConfig';
import {
    DayRow,
    processLogsIntoRow,
    summarizeRows,
    buildRecruiterRollups,
    buildClientRollups,
    openPrintableScorecard,
} from '@/lib/reportUtils';
import {
    formatTimeNoSec,
    formatDurationHM,
    formatExceedHM,
    exportExcel,
    dateStr,
    dayName,
    BREAK_LIMIT_MS,
    BRB_LIMIT_MS,
    COMBINED_LIMIT_MS,
} from '@/lib/timeUtils';

type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type ViewMode = 'daily' | 'recruiters' | 'clients';
type ViolFilter =
    | 'late_in'
    | 'break'
    | 'brb'
    | 'total_break'
    | 'early_out'
    | 'auto_out'
    | 'anomaly'
    | 'all'
    | null;

/* ── Comparison Card for compare mode ─────────────────────────────────────── */
function ComparisonCard({
    name,
    clientName,
    rows,
    onPrint,
}: {
    name: string;
    clientName: string;
    rows: DayRow[];
    onPrint: () => void;
}) {
    const active = rows.filter(r => r.punchIn || r.workedMs > 0 || r.totalBreakMs > 0);
    const s = summarizeRows(active);
    const denom = s.activeDays || 1;
    const avgCombined = s.totalCombinedBreak / denom;
    const avgExceed = s.totalBreakViolMsSum / denom;
    const totalViol =
        s.breakViolDays + s.brbViolDays + s.totalBreakViolDays + s.lateInDays + s.earlyOutDays + s.autoLogoutDays;

    return (
        <div className="panel-3d p-4 rounded-[1.25rem] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400/30 flex items-center justify-center text-sm font-black text-white shadow-lg shrink-0">
                        {name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-extrabold text-white tracking-tight truncate">{name}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                            {clientName || 'Unassigned'}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onPrint}
                    title="Print Scorecard"
                    className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-emerald-500/20 border border-white/10 text-slate-300 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                    <Printer size={13} />
                </button>
            </div>

            {s.activeDays === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center bg-black/20 rounded-xl border border-white/5">
                    <p className="text-xs font-bold text-slate-500">No hours logged</p>
                    <p className="text-[9px] text-slate-600 uppercase tracking-wider mt-1">In selected range</p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col items-center justify-center py-2">
                        <div
                            className={`relative w-20 h-20 rounded-full border-4 flex items-center justify-center ${
                                s.breakComplianceRate >= 90
                                    ? 'border-emerald-500/60'
                                    : s.breakComplianceRate >= 70
                                        ? 'border-amber-500/60'
                                        : 'border-rose-500/60'
                            }`}
                        >
                            <div className="text-center">
                                <p
                                    className={`text-xl font-black font-mono ${
                                        s.breakComplianceRate >= 90
                                            ? 'text-emerald-400'
                                            : s.breakComplianceRate >= 70
                                                ? 'text-amber-400'
                                                : 'text-rose-400'
                                    }`}
                                >
                                    {s.breakComplianceRate}%
                                </p>
                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Clean Brk</p>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-1.5">
                            {s.punctualityRate}% on-time · {totalViol} flags
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        {[
                            { label: 'Active Days', val: `${s.activeDays}d`, color: 'text-white' },
                            { label: 'Total Worked', val: formatDurationHM(s.totalWorked), color: 'text-indigo-400' },
                            { label: 'Total Breaks', val: `${s.totalBreakCountSum} (${s.totalBreakEventsSum}B+${s.totalBrbEventsSum}R)`, color: 'text-zinc-200' },
                            { label: 'Avg Brk+BRB/d', val: formatDurationHM(avgCombined), color: avgCombined > COMBINED_LIMIT_MS ? 'text-fuchsia-400' : 'text-emerald-400' },
                            { label: 'Avg Exceed/d', val: avgExceed > 0 ? `+${formatExceedHM(avgExceed)}` : '0m', color: avgExceed > 0 ? 'text-rose-400' : 'text-emerald-400' },
                            { label: 'Overall Exceed', val: s.totalBreakViolMsSum > 0 ? `+${formatExceedHM(s.totalBreakViolMsSum)}` : '0m', color: s.totalBreakViolMsSum > 0 ? 'text-rose-300' : 'text-slate-400' },
                        ].map(stat => (
                            <div key={stat.label} className="bg-black/30 border border-white/5 rounded-lg py-1.5 px-2 text-center">
                                <p className="text-[8px] font-bold tracking-widest uppercase text-slate-500 mb-0.5">{stat.label}</p>
                                <p className={`text-xs font-extrabold font-mono tracking-tight ${stat.color}`}>{stat.val}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default function MasterReports() {
    const todayStr = dateStr(new Date());
    const [dateRange, setDateRange] = useState<DateRangeValue>({
        preset: 'today',
        startDate: todayStr,
        endDate: todayStr,
    });

    const range: DateRange =
        dateRange.preset === 'today'
            ? 'today'
            : dateRange.preset === 'yesterday'
                ? 'yesterday'
                : ['thisWeek', 'lastWeek', 'last7'].includes(dateRange.preset ?? '')
                    ? 'week'
                    : ['thisMonth', 'lastMonth', 'last30'].includes(dateRange.preset ?? '')
                        ? 'month'
                        : 'custom';

    const [viewMode, setViewMode] = useState<ViewMode>('daily');
    const [rawLogsByDay, setRawLogsByDay] = useState<Record<string, import('@/types').TimeLog[]>>({});
    const [datesInRange, setDatesInRange] = useState<string[]>([todayStr]);
    const [allUsersList, setAllUsersList] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [selectedRecruiters, setSelectedRecruiters] = useState<string[]>([]);

    // Configurable policy rules (Global + per-client)
    const [policyConfig, setPolicyConfig] = useState<PolicyConfigState>(() => loadPolicyConfig());
    const [policyModalOpen, setPolicyModalOpen] = useState(false);

    // Violation / Anomaly filters
    const [violationFilter, setViolationFilter] = useState<ViolFilter>(null);
    const [statusDropFilter, setStatusDropFilter] = useState<string>('');
    const [violDropFilter, setViolDropFilter] = useState<string>('');
    const [compareMode, setCompareMode] = useState(false);

    // Table sorting
    const [sortKey, setSortKey] = useState<SortKey>('totalBreakViolMs');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const handleSort = useCallback((key: SortKey) => {
        setSortKey(prev => {
            if (prev === key) {
                setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
                return prev;
            }
            setSortDir(key === 'name' || key === 'date' ? 'asc' : 'desc');
            return key;
        });
    }, []);

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
    const [searchPos, setSearchPos] = useState<{ top: number; left: number; width: number }>({
        top: 0,
        left: 0,
        width: 320,
    });
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [debouncedQuery, setDebouncedQuery] = useState('');

    const [selectedUserForEdit, setSelectedUserForEdit] = useState<{ user: User; date: string } | null>(null);
    const [mounted, setMounted] = useState(false);
    const currentAdminId = getCurrentUser()?.id ?? '';

    useEffect(() => {
        setMounted(true);
    }, []);

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
                searchBoxRef.current &&
                !searchBoxRef.current.contains(target) &&
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
                exportBtnRef.current &&
                !exportBtnRef.current.contains(target) &&
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

    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 150);
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
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

    const fetchData = useCallback(
        async (silent = false) => {
            if (silent) setRefreshing(true);
            else setLoading(true);
            try {
                const users = (await getAllUsers()).filter(u => !u.isMaster);
                const dates = generateDatesFromRange();
                const userIds = users.map(u => u.id);
                const logsByDay = await getLogsBatch(userIds, dates);
                setAllUsersList(users);
                setDatesInRange(dates);
                setRawLogsByDay(logsByDay);
                setLastSyncedAt(Date.now());
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [generateDatesFromRange],
    );

    useEffect(() => {
        void fetchData(false);
    }, [fetchData]);

    // Live 30s auto-refresh when range includes Today
    const includesToday = dateRange.endDate >= todayStr && dateRange.startDate <= todayStr;
    useEffect(() => {
        if (!includesToday || !autoRefresh) return;
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                void fetchData(true);
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [includesToday, autoRefresh, fetchData]);

    // Derive rows reactively when logs OR policy rules change (instant feedback on Policy Rules save!)
    const rows = useMemo(() => {
        if (!allUsersList.length) return [];
        const computed: DayRow[] = [];
        for (const u of allUsersList) {
            for (const d of datesInRange) {
                const logs = rawLogsByDay[`${u.id}-${d}`] || [];
                computed.push(
                    processLogsIntoRow(
                        u.id,
                        u.name,
                        u.clientName,
                        d,
                        logs,
                        policyConfig,
                        u.shiftStart,
                        u.shiftEnd,
                        u.timezone,
                    ),
                );
            }
        }
        const isMultiDayRange = datesInRange.length > 1;
        return isMultiDayRange
            ? computed.filter(r => r.punchIn || r.workedMs > 0 || r.totalBreakMs > 0)
            : computed;
    }, [allUsersList, datesInRange, rawLogsByDay, policyConfig]);

    const handleSavePolicy = (next: PolicyConfigState) => {
        setPolicyConfig(next);
        savePolicyConfig(next);
    };

    const isMultiDay = dateRange.startDate !== dateRange.endDate;

    const {
        filteredRows,
        baseS,
        uniqueUsers,
        recruiterFiltered,
        avgWorkedMs,
        avgCombinedBreakPerDay,
        avgExceedPerDay,
        uniqueUserCount,
        complianceRate,
    } = useMemo(() => {
        const clientFiltered =
            selectedClients.length === 0 ? rows : rows.filter(r => selectedClients.includes(r.clientName));
        const q = debouncedQuery.trim().toLowerCase();
        const rFiltered = clientFiltered.filter(r => {
            const matchesSelected = selectedRecruiters.length === 0 || selectedRecruiters.includes(r.name);
            const matchesQuery =
                !q || r.name.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q);
            return matchesSelected && matchesQuery;
        });

        const fRows = (
            !violationFilter
                ? rFiltered
                : violationFilter === 'late_in'
                    ? rFiltered.filter(r => r.lateIn)
                    : violationFilter === 'break'
                        ? rFiltered.filter(r => r.breakViol)
                        : violationFilter === 'brb'
                            ? rFiltered.filter(r => r.brbViol)
                            : violationFilter === 'total_break'
                                ? rFiltered.filter(r => r.totalBreakViol)
                                : violationFilter === 'early_out'
                                    ? rFiltered.filter(r => r.earlyOut)
                                    : violationFilter === 'auto_out'
                                        ? rFiltered.filter(r => r.autoLogout)
                                        : violationFilter === 'anomaly'
                                            ? rFiltered.filter(r => r.hasAnomaly)
                                            : rFiltered.filter(
                                                r =>
                                                    r.lateIn ||
                                                    r.breakViol ||
                                                    r.brbViol ||
                                                    r.totalBreakViol ||
                                                    r.earlyOut ||
                                                    r.autoLogout,
                                            )
        )
            .filter(r => {
                if (statusDropFilter === 'Active' && !r.punchIn && r.workedMs === 0) return false;
                if (statusDropFilter === 'Not Active' && (r.punchIn || r.workedMs > 0)) return false;

                if (violDropFilter === 'Late In' && !r.lateIn) return false;
                if (violDropFilter === 'Early Out' && !r.earlyOut) return false;
                if (violDropFilter === 'Break Exceed' && !r.breakViol) return false;
                if (violDropFilter === 'BRB Exceed' && !r.brbViol) return false;
                if (violDropFilter === 'Total Break Exceed' && !r.totalBreakViol) return false;
                if (violDropFilter === 'Auto Out' && !r.autoLogout) return false;
                if (violDropFilter === 'Anomaly' && !r.hasAnomaly) return false;

                return true;
            })
            .sort((a, b) => {
                const dir = sortDir === 'asc' ? 1 : -1;
                if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
                if (sortKey === 'date') return a.date.localeCompare(b.date) * dir;
                if (sortKey === 'punchIn') return ((a.punchIn ?? 0) - (b.punchIn ?? 0)) * dir;
                return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
            });

        const activeRows = rFiltered.filter(r => r.punchIn || r.workedMs > 0 || r.totalBreakMs > 0);
        const bS = summarizeRows(activeRows);
        const cleanCount = activeRows.filter(
            r => !r.breakViol && !r.brbViol && !r.totalBreakViol && !r.lateIn && !r.earlyOut && !r.autoLogout,
        ).length;
        const cRate = activeRows.length > 0 ? Math.round((cleanCount / activeRows.length) * 100) : 100;
        const uUsers = [...new Set(fRows.map(r => r.userId))];
        const uUserCount = [...new Set(rFiltered.map(r => r.userId))].length || 1;
        const avgWkMs = bS.totalWorked / uUserCount;
        const dCount = bS.activeDays || 1;
        const avgCombMs = bS.totalCombinedBreak / dCount;
        const avgExMs = bS.totalBreakViolMsSum / dCount;

        return {
            filteredRows: fRows,
            baseS: bS,
            uniqueUsers: uUsers,
            recruiterFiltered: rFiltered,
            avgWorkedMs: avgWkMs,
            avgCombinedBreakPerDay: avgCombMs,
            avgExceedPerDay: avgExMs,
            uniqueUserCount: uUserCount,
            complianceRate: cRate,
        };
    }, [
        rows,
        selectedClients,
        selectedRecruiters,
        debouncedQuery,
        violationFilter,
        statusDropFilter,
        violDropFilter,
        sortKey,
        sortDir,
    ]);

    const recruiterRollups = useMemo(() => buildRecruiterRollups(filteredRows), [filteredRows]);
    const clientRollups = useMemo(() => buildClientRollups(filteredRows), [filteredRows]);

    const allRecruiters = useMemo(() => {
        const names = allUsersList.length > 0 ? allUsersList.map(u => u.name) : rows.map(r => r.name);
        return [...new Set(names)].sort();
    }, [allUsersList, rows]);

    const recruiterClientMap = useMemo(() => {
        const map: Record<string, string> = {};
        allUsersList.forEach(u => {
            if (!map[u.name]) map[u.name] = u.clientName;
        });
        rows.forEach(r => {
            if (!map[r.name]) map[r.name] = r.clientName;
        });
        return map;
    }, [allUsersList, rows]);

    const searchSuggestions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const pool = allRecruiters.filter(
            n => selectedClients.length === 0 || selectedClients.includes(recruiterClientMap[n] ?? ''),
        );
        if (!q) return pool.slice(0, 12);
        return pool
            .filter(n => n.toLowerCase().includes(q) || (recruiterClientMap[n] ?? '').toLowerCase().includes(q))
            .slice(0, 12);
    }, [searchQuery, allRecruiters, recruiterClientMap, selectedClients]);

    const toggleRecruiter = (name: string) => {
        setSelectedRecruiters(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));
        setSearchQuery('');
    };
    const addRecruiter = (name: string) => {
        setSelectedRecruiters(prev => (prev.includes(name) ? prev : [...prev, name]));
        setSearchQuery('');
    };
    const removeRecruiter = (name: string) => setSelectedRecruiters(prev => prev.filter(n => n !== name));

    const totalViol =
        baseS.breakViolDays +
        baseS.brbViolDays +
        baseS.totalBreakViolDays +
        baseS.lateInDays +
        baseS.earlyOutDays +
        baseS.autoLogoutDays;
    const canCompare = selectedRecruiters.length >= 2 && selectedRecruiters.length <= 4;

    const violTimelineData = useMemo(() => {
        if (!showViolTimeline) return [];
        const violByDate: Record<string, number> = {};
        recruiterFiltered.forEach(r => {
            const count =
                (r.breakViol ? 1 : 0) +
                (r.brbViol ? 1 : 0) +
                (r.totalBreakViol ? 1 : 0) +
                (r.lateIn ? 1 : 0) +
                (r.earlyOut ? 1 : 0) +
                (r.autoLogout ? 1 : 0);
            if (count > 0) violByDate[r.date] = (violByDate[r.date] || 0) + count;
        });
        return Object.entries(violByDate).sort(([a], [b]) => a.localeCompare(b));
    }, [showViolTimeline, recruiterFiltered]);

    const maxViolPerDay = useMemo(() => Math.max(1, ...violTimelineData.map(([, c]) => c)), [violTimelineData]);

    const hasActiveFilters =
        selectedClients.length > 0 ||
        selectedRecruiters.length > 0 ||
        debouncedQuery.trim() !== '' ||
        statusDropFilter !== '' ||
        violDropFilter !== '' ||
        violationFilter !== null;

    const rangeLabel =
        dateRange.startDate === dateRange.endDate
            ? dateRange.startDate
            : `${dateRange.startDate} to ${dateRange.endDate}`;

    const handlePrintRecruiter = (userId: string, name: string, clientName: string) => {
        const userRows = rows.filter(r => r.userId === userId);
        openPrintableScorecard(name, clientName, rangeLabel, userRows);
    };

    /* ── Excel Export (zero seconds, hours:minutes exceed, total breaks, overall exceed) ── */
    const buildExportData = (type: 'daily' | 'weekly' | 'violation') => {
        const globalCombinedLabel = formatDurationHM(policyConfig.global.combinedLimitMins * 60000);
        const policyFooter = [
            'Policy Rules',
            `Break max: ${formatDurationHM(policyConfig.global.breakLimitMins * 60000)}`,
            `BRB max: ${policyConfig.global.brbLimitMins}m/day`,
            `Total Brk+BRB max: ${globalCombinedLabel}`,
            `Late grace: +${policyConfig.global.graceMins}m`,
        ];

        if (type === 'weekly') {
            const header = [
                'Name',
                'Client',
                'Days Active',
                'Net Active',
                'Avg Worked/Day',
                'Total Breaks #',
                'Breaks #',
                'Break Time',
                'BRBs #',
                'BRB Time',
                'Total Brk+BRB',
                'Avg Brk+BRB/Day',
                'Avg Exceed/Day',
                'Overall Break Exceed',
                'Brk+BRB Viols',
                'Break Viols',
                'BRB Viols',
                'Late Ins',
                'Early Outs',
                'Auto Outs',
                'Anomalies',
                'Compliance %',
            ];
            const data = recruiterRollups.map(r => [
                r.name,
                r.clientName,
                r.activeDays,
                formatDurationHM(r.totalWorkedMs),
                formatDurationHM(r.avgWorkedPerDayMs),
                r.totalBreakCount,
                r.breakCount,
                formatDurationHM(r.totalBreakMs),
                r.brbCount,
                formatDurationHM(r.totalBrbMs),
                formatDurationHM(r.totalCombinedBreakMs),
                formatDurationHM(r.avgCombinedBreakPerDayMs),
                r.avgExceedPerDayMs > 0 ? `+${formatExceedHM(r.avgExceedPerDayMs)}` : '0m',
                r.overallExceedMs > 0 ? `+${formatExceedHM(r.overallExceedMs)}` : '0m',
                r.totalBreakViolDays,
                r.breakViolDays,
                r.brbViolDays,
                r.lateInDays,
                r.earlyOutDays,
                r.autoLogoutDays,
                r.anomalyDays,
                `${r.complianceRate}%`,
            ]);
            exportExcel([header, ...data, [], ['Period', rangeLabel], policyFooter], 'recruiter-summary');
            return;
        }

        const isMultiDayExport = ['week', 'month'].includes(range) || dateRange.startDate !== dateRange.endDate;
        const sourceRows =
            type === 'violation'
                ? filteredRows.filter(
                    r => r.breakViol || r.brbViol || r.totalBreakViol || r.lateIn || r.earlyOut || r.autoLogout || r.hasAnomaly,
                )
                : filteredRows;
        const label = type === 'violation' ? 'violation-report' : 'daily-attendance';

        const header = [
            'Name',
            'Client',
            'Status',
            ...(isMultiDayExport ? ['Date', 'Day'] : []),
            'Arrival',
            'Departure',
            'Net Active',
            'Total Breaks #',
            'Breaks #',
            'Break Time',
            'BRBs #',
            'BRB Time',
            'Total Brk+BRB',
            'Combined Exceed',
            'Break Viol',
            'BRB Viol',
            'Late In',
            'Early Out',
            'Audit Flags',
        ];

        const data = sourceRows.map(r => [
            r.name,
            r.clientName,
            r.punchIn || r.workedMs > 0 ? 'Active' : 'Offline',
            ...(isMultiDayExport ? [r.date, dayName(r.date)] : []),
            r.punchIn ? formatTimeNoSec(r.punchIn) : '',
            r.punchOut ? formatTimeNoSec(r.punchOut) : r.punchIn ? 'ACTIVE' : '',
            formatDurationHM(r.workedMs),
            r.totalBreakCount,
            r.breakCount,
            formatDurationHM(r.breakMs),
            r.brbCount,
            formatDurationHM(r.brbMs),
            formatDurationHM(r.totalBreakMs),
            r.totalBreakViol ? `+${formatExceedHM(r.totalBreakViolMs)}` : '-',
            r.breakViol ? `+${formatExceedHM(r.breakViolMs)}` : '-',
            r.brbViol ? `+${formatExceedHM(r.brbViolMs)}` : '-',
            r.lateIn ? `+${formatExceedHM(r.lateInMs)}` : '-',
            r.earlyOut ? `+${formatExceedHM(r.earlyOutMs)}` : '-',
            r.anomalies.join('; ') || '-',
        ]);

        const s = summarizeRows(sourceRows.filter(r => r.punchIn || r.workedMs > 0 || r.totalBreakMs > 0));
        const dCount = s.activeDays || 1;
        const totalsRow = [
            'TOTALS',
            '',
            '',
            ...(isMultiDayExport ? ['', ''] : []),
            '',
            '',
            formatDurationHM(s.totalWorked),
            s.totalBreakCountSum,
            s.totalBreakEventsSum,
            formatDurationHM(s.totalBreak),
            s.totalBrbEventsSum,
            formatDurationHM(s.totalBrb),
            formatDurationHM(s.totalCombinedBreak),
            `${s.totalBreakViolMsSum > 0 ? `+${formatExceedHM(s.totalBreakViolMsSum)}` : '0m'} (Avg +${formatExceedHM(s.totalBreakViolMsSum / dCount)}/d)`,
            `${s.breakViolDays}d`,
            `${s.brbViolDays}d`,
            `${sourceRows.filter(r => r.lateIn).length}d`,
            `${sourceRows.filter(r => r.earlyOut).length}d`,
            `${s.anomalyDays}d`,
        ];

        exportExcel([header, ...data, [], totalsRow, [], policyFooter], label);
    };

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
                    style={{ position: 'fixed', zIndex: 9985, top: searchPos.top, left: searchPos.left, width: searchPos.width }}
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
                                    onMouseDown={e => {
                                        e.preventDefault();
                                        toggleRecruiter(name);
                                    }}
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
                    style={{ position: 'fixed', zIndex: 9990, top: exportPos.top, right: exportPos.right }}
                    className="min-w-[230px] bg-[#10121e] border border-white/[0.12] rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.92)] overflow-hidden p-1"
                >
                    {[
                        { label: 'Daily Attendance Report', desc: 'Row-by-row (no seconds)', type: 'daily' as const, icon: <FileText size={13} /> },
                        { label: 'Recruiter Rollup Report', desc: 'Per-recruiter totals & exceed', type: 'weekly' as const, icon: <Calendar size={13} /> },
                        { label: 'Violations & Audits', desc: 'Flagged & anomaly rows', type: 'violation' as const, icon: <AlertTriangle size={13} /> },
                    ].map(item => (
                        <button
                            key={item.type}
                            type="button"
                            onClick={() => {
                                buildExportData(item.type);
                                setExportOpen(false);
                            }}
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

    const toggleViolFilter = (key: Exclude<ViolFilter, null>) => {
        const next = violationFilter === key ? null : key;
        setViolationFilter(next);
        setShowViolTimeline(next !== null && key !== 'anomaly');
    };

    const clientOverrideCount = Object.keys(policyConfig.clients).length;

    return (
        <div className="space-y-3">
            {/* ── UNIFIED COMMAND & FILTER TOOLBAR ──────────────────────────────────────────────── */}
            <div className="rounded-2xl bg-[#0c0d18] border border-white/[0.08] p-2.5 shadow-xl">
                <div className="flex flex-wrap items-center gap-2">
                    <div
                        ref={searchBoxRef}
                        className="relative flex-1 min-w-[220px] flex items-center h-[38px] rounded-xl bg-[#131624] border border-white/[0.09] focus-within:border-indigo-500/60 focus-within:bg-[#141728] px-3 gap-2 transition-all"
                    >
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
                            <kbd className="hidden sm:inline-flex items-center text-[9px] font-mono font-bold text-slate-500 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded">
                                /
                            </kbd>
                        )}
                    </div>

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

                    <div className="w-[calc(50%-4px)] sm:w-[128px]">
                        <CustomSelect
                            allowClear
                            options={[
                                { value: 'Active', label: 'Active Now' },
                                { value: 'Not Active', label: 'Offline' },
                            ]}
                            value={statusDropFilter}
                            onChange={setStatusDropFilter}
                            placeholder="All Status"
                        />
                    </div>

                    <div className="w-[calc(50%-4px)] sm:w-[165px]">
                        <CustomSelect
                            allowClear
                            options={[
                                { value: 'Total Break Exceed', label: `Brk+BRB > ${formatDurationHM(policyConfig.global.combinedLimitMins * 60000)}` },
                                { value: 'Break Exceed', label: 'Break Violation' },
                                { value: 'BRB Exceed', label: 'BRB Violation' },
                                { value: 'Late In', label: 'Late Login' },
                                { value: 'Early Out', label: 'Early Logout' },
                                { value: 'Auto Out', label: 'Auto Logout' },
                                { value: 'Anomaly', label: 'Audit Anomalies' },
                            ]}
                            value={violDropFilter}
                            onChange={setViolDropFilter}
                            placeholder="All Violations"
                        />
                    </div>

                    <div className="w-full sm:w-[235px]">
                        <DateRangePicker value={dateRange} onChange={setDateRange} />
                    </div>

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

                {hasActiveFilters && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-white/[0.06]">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {selectedRecruiters.map(name => (
                                <span
                                    key={name}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-indigo-500/15 text-indigo-200 border border-indigo-500/30 pl-1 pr-2 py-0.5 rounded-lg"
                                >
                                    <span className="w-4 h-4 rounded bg-indigo-500/30 text-indigo-100 text-[9px] font-bold flex items-center justify-center">
                                        {name[0]?.toUpperCase()}
                                    </span>
                                    <span className="truncate max-w-[140px]">{name}</span>
                                    <button type="button" onClick={() => removeRecruiter(name)} className="text-indigo-300 hover:text-white transition-colors cursor-pointer">
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}

                            {selectedClients.map(name => (
                                <span
                                    key={name}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-500/15 text-purple-200 border border-purple-500/30 px-2 py-0.5 rounded-lg"
                                >
                                    <Briefcase size={10} className="text-purple-400 shrink-0" />
                                    <span className="truncate max-w-[130px]">{name}</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedClients(prev => prev.filter(c => c !== name))}
                                        className="text-purple-300 hover:text-white transition-colors cursor-pointer"
                                    >
                                        <X size={11} />
                                    </button>
                                </span>
                            ))}

                            {violationFilter && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-500/15 text-rose-200 border border-rose-500/30 px-2 py-0.5 rounded-lg">
                                    <AlertTriangle size={10} className="text-rose-400" />
                                    <span>
                                        {violationFilter === 'late_in'
                                            ? 'Late Logins'
                                            : violationFilter === 'break'
                                                ? 'Break Exceeds'
                                                : violationFilter === 'brb'
                                                    ? 'BRB Exceeds'
                                                    : violationFilter === 'total_break'
                                                        ? 'Combined Brk+BRB Exceed'
                                                        : violationFilter === 'early_out'
                                                            ? 'Early Outs'
                                                            : violationFilter === 'auto_out'
                                                                ? 'Auto Outs'
                                                                : violationFilter === 'anomaly'
                                                                    ? 'Audit Anomalies'
                                                                    : 'All Violations'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViolationFilter(null);
                                            setShowViolTimeline(false);
                                        }}
                                        className="text-rose-300 hover:text-white transition-colors cursor-pointer"
                                    >
                                        <X size={11} />
                                    </button>
                                </span>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedClients([]);
                                    setSelectedRecruiters([]);
                                    setSearchQuery('');
                                    setStatusDropFilter('');
                                    setViolDropFilter('');
                                    setViolationFilter(null);
                                    setCompareMode(false);
                                    setShowViolTimeline(false);
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

            {/* ── 4 HERO KPI CARDS + VIOLATION QUICK-FILTER STRIP ───────────────────────────────── */}
            {!loading && baseS.activeDays > 0 && (
                <div className="space-y-2.5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 1. Team Output */}
                        <div className="panel-3d border border-indigo-500/20 border-t-2 border-t-indigo-500 bg-[#0b0c14]/70 p-3.5 rounded-2xl flex flex-col justify-between min-h-[90px]">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                                    Net Active &amp; Production
                                </p>
                                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <Users size={12} />
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className="flex items-baseline gap-2">
                                    <p className="text-xl lg:text-2xl font-black font-mono tracking-tight text-indigo-400">
                                        {formatDurationHM(baseS.totalWorked)}
                                    </p>
                                    <span className={`text-[11px] font-mono font-bold ${baseS.workedVarianceMs >= 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {baseS.workedVarianceMs >= 0 ? `+${formatDurationHM(baseS.workedVarianceMs)}` : `-${formatDurationHM(Math.abs(baseS.workedVarianceMs))}`}
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium text-slate-500 mt-1 truncate">
                                    {uniqueUserCount} {uniqueUserCount === 1 ? 'recruiter' : 'recruiters'} · {baseS.activeDays}d active · Avg {formatDurationHM(avgWorkedMs)}/p
                                </p>
                            </div>
                        </div>

                        {/* 2. Total Breaks & Daily Avg */}
                        <div className="panel-3d border border-cyan-500/20 border-t-2 border-t-cyan-500 bg-[#0b0c14]/70 p-3.5 rounded-2xl flex flex-col justify-between min-h-[90px]">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                                    Total Combined Breaks
                                </p>
                                <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                                    <Coffee size={12} />
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className="flex items-baseline gap-2">
                                    <p className="text-xl lg:text-2xl font-black font-mono tracking-tight text-cyan-300">
                                        {formatDurationHM(baseS.totalCombinedBreak)}
                                    </p>
                                    <span className="text-[11px] font-mono text-slate-300">
                                        Avg {formatDurationHM(avgCombinedBreakPerDay)}/d
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium text-slate-500 mt-1 truncate">
                                    {baseS.totalBreakCountSum} breaks ({baseS.totalBreakEventsSum}B + {baseS.totalBrbEventsSum}R) · 1h 25m budget
                                </p>
                            </div>
                        </div>

                        {/* 3. Overall Total Break Exceed + Avg Exceed/d */}
                        <button
                            type="button"
                            onClick={() => toggleViolFilter('total_break')}
                            className={`panel-3d text-left p-3.5 rounded-2xl flex flex-col justify-between min-h-[90px] border transition-all cursor-pointer ${
                                violationFilter === 'total_break'
                                    ? 'border-fuchsia-500/70 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/40'
                                    : baseS.totalBreakViolMsSum > 0
                                        ? 'border-fuchsia-500/25 border-t-2 border-t-fuchsia-500 bg-[#0b0c14]/70 hover:border-fuchsia-500/50'
                                        : 'border-emerald-500/20 border-t-2 border-t-emerald-500 bg-[#0b0c14]/70'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                                    Overall Break Exceed (Lost Time)
                                </p>
                                <span className={`p-1.5 rounded-lg ${baseS.totalBreakViolMsSum > 0 ? 'bg-fuchsia-500/15 text-fuchsia-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    <Flame size={12} />
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className="flex items-baseline gap-2">
                                    <p className={`text-xl lg:text-2xl font-black font-mono tracking-tight ${baseS.totalBreakViolMsSum > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {baseS.totalBreakViolMsSum > 0 ? `+${formatExceedHM(baseS.totalBreakViolMsSum)}` : '0m'}
                                    </p>
                                    <span className="text-[11px] font-mono text-slate-300">
                                        Avg exceed {avgExceedPerDay > 0 ? `+${formatExceedHM(avgExceedPerDay)}/d` : '0m/d'}
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium text-slate-500 mt-1 truncate">
                                    {baseS.totalBreakViolDays} of {baseS.activeDays}d exceeded · {baseS.cleanBreakDays}d clean
                                </p>
                            </div>
                        </button>

                        {/* 4. Compliance Rate & Audit Anomalies */}
                        <button
                            type="button"
                            onClick={() => toggleViolFilter(baseS.anomalyDays > 0 ? 'anomaly' : 'all')}
                            className={`panel-3d text-left p-3.5 rounded-2xl flex flex-col justify-between min-h-[90px] border transition-all cursor-pointer ${
                                violationFilter === 'anomaly' || violationFilter === 'all'
                                    ? 'border-amber-500/60 bg-amber-500/10'
                                    : 'border-white/[0.08] border-t-2 border-t-emerald-500 bg-[#0b0c14]/70 hover:border-white/20'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                                    Break &amp; Attendance Quality
                                </p>
                                <span className={`p-1.5 rounded-lg ${baseS.anomalyDays > 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    <ShieldAlert size={12} />
                                </span>
                            </div>
                            <div className="mt-1.5">
                                <div className="flex items-baseline gap-2">
                                    <p
                                        className={`text-xl lg:text-2xl font-black font-mono tracking-tight ${
                                            baseS.breakComplianceRate >= 90
                                                ? 'text-emerald-400'
                                                : baseS.breakComplianceRate >= 70
                                                    ? 'text-amber-400'
                                                    : 'text-rose-400'
                                        }`}
                                    >
                                        {baseS.breakComplianceRate}% break clean
                                    </p>
                                    <span className="text-[11px] font-mono text-slate-400">
                                        {baseS.punctualityRate}% on-time
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium text-slate-500 mt-1 truncate">
                                    {baseS.lateInDays} Late · {baseS.autoLogoutDays} Auto-Out · {baseS.anomalyDays} Audits
                                </p>
                            </div>
                        </button>
                    </div>

                    {/* Quick Violation Filter Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 px-0.5">
                        {(
                            [
                                { key: 'late_in' as const, label: 'Late Logins', count: baseS.lateInDays, icon: <Clock size={11} />, tone: 'amber' },
                                { key: 'break' as const, label: 'Break Exceeds', count: baseS.breakViolDays, icon: <Coffee size={11} />, tone: 'orange' },
                                { key: 'brb' as const, label: 'BRB Exceeds', count: baseS.brbViolDays, icon: <Clock3 size={11} />, tone: 'sky' },
                                { key: 'total_break' as const, label: 'Brk+BRB Exceeds', count: baseS.totalBreakViolDays, icon: <Flame size={11} />, tone: 'fuchsia' },
                                { key: 'early_out' as const, label: 'Early Outs', count: baseS.earlyOutDays, icon: <AlertTriangle size={11} />, tone: 'purple' },
                                { key: 'auto_out' as const, label: 'Auto Outs', count: baseS.autoLogoutDays, icon: <LogOut size={11} />, tone: 'red' },
                                { key: 'anomaly' as const, label: 'Audit Flags', count: baseS.anomalyDays, icon: <ShieldAlert size={11} />, tone: 'amber' },
                                { key: 'all' as const, label: 'All Violations', count: totalViol, icon: <AlertTriangle size={11} />, tone: 'rose' },
                            ] as const
                        ).map(chip => {
                            const active = violationFilter === chip.key;
                            return (
                                <button
                                    key={chip.key}
                                    type="button"
                                    disabled={chip.count === 0 && !active}
                                    onClick={() => toggleViolFilter(chip.key)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                                        active
                                            ? 'bg-indigo-500/20 border-indigo-400 text-white shadow-sm cursor-pointer'
                                            : chip.count > 0
                                                ? 'bg-[#0e101c] border-white/[0.09] text-zinc-200 hover:border-white/25 cursor-pointer'
                                                : 'bg-black/20 border-white/[0.04] text-slate-600 cursor-default opacity-60'
                                    }`}
                                >
                                    <span className={chip.count > 0 || active ? 'text-indigo-300' : 'text-slate-600'}>
                                        {chip.icon}
                                    </span>
                                    <span>{chip.label}</span>
                                    <span
                                        className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                            chip.count > 0 ? 'bg-white/10 text-white' : 'text-slate-600'
                                        }`}
                                    >
                                        {chip.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Drill-down Timeline + Client Breakdown */}
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
                                            <p className="text-[9px] font-black tracking-widest uppercase text-slate-400">
                                                Daily Violation Trend
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setShowViolTimeline(false)}
                                                className="p-0.5 text-slate-500 hover:text-white transition-colors cursor-pointer"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                        <div className="flex items-end gap-1.5 h-14 overflow-x-auto scrollbar-thin">
                                            {violTimelineData.map(([date, count]) => (
                                                <div
                                                    key={date}
                                                    className="flex flex-col items-center gap-0.5 shrink-0 group"
                                                    title={`${date}: ${count} violation${count !== 1 ? 's' : ''}`}
                                                >
                                                    <span className="text-[8px] font-mono font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {count}
                                                    </span>
                                                    <div
                                                        className="w-5 rounded-t-sm bg-gradient-to-t from-rose-600 to-rose-400 hover:from-rose-500 hover:to-rose-300 transition-all"
                                                        style={{ height: `${Math.max(4, (count / maxViolPerDay) * 36)}px` }}
                                                    />
                                                    <span className="text-[8px] font-mono text-slate-500 whitespace-nowrap">
                                                        {date.slice(5)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                        {filteredRows.length} flagged record{filteredRows.length !== 1 ? 's' : ''} · click a recruiter to pin
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                        {Object.entries(byClient)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([client, cRows]) => (
                                                <div key={client} className="bg-white/[0.02] border border-white/[0.05] p-2.5 rounded-xl">
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <Briefcase size={10} className="text-slate-500" />
                                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider truncate flex-1">
                                                            {client}
                                                        </p>
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">
                                                            {cRows.length}
                                                        </span>
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

            {/* ── VIEW SWITCHER + LIVE SYNC + POLICY RULES BAR ─────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-1">
                {/* Segmented View Tabs */}
                <div className="inline-flex items-center p-1 rounded-xl bg-[#0d101c] border border-white/[0.08] gap-1">
                    {(
                        [
                            { id: 'daily' as const, label: 'Daily Logs', count: filteredRows.length, icon: <Layers size={12} /> },
                            { id: 'recruiters' as const, label: 'By Recruiter', count: recruiterRollups.length, icon: <UserCheck size={12} /> },
                            { id: 'clients' as const, label: 'By Client', count: clientRollups.length, icon: <Building2 size={12} /> },
                        ] as const
                    ).map(tab => {
                        const active = viewMode === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setViewMode(tab.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                    active
                                        ? 'bg-indigo-500/25 text-white border border-indigo-500/40 shadow-sm'
                                        : 'text-slate-400 hover:text-white border border-transparent'
                                }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/[0.07] text-slate-300">
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Right Controls: Live Refresh + Print Scorecard + Policy Rules */}
                <div className="flex flex-wrap items-center gap-2">
                    {selectedRecruiters.length === 1 && (
                        <button
                            type="button"
                            onClick={() => {
                                const name = selectedRecruiters[0];
                                const match = rows.find(r => r.name === name);
                                if (match) handlePrintRecruiter(match.userId, name, match.clientName);
                            }}
                            className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                            <Printer size={12} />
                            Print Scorecard
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setPolicyModalOpen(true)}
                        className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-xl bg-[#0e101c] hover:bg-white/[0.06] border border-white/[0.1] text-slate-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                        <Sliders size={12} className="text-indigo-400" />
                        <span>Policy Rules</span>
                        {clientOverrideCount > 0 && (
                            <span className="font-mono text-[10px] px-1.5 rounded bg-indigo-500/25 text-indigo-300">
                                {clientOverrideCount}
                            </span>
                        )}
                    </button>

                    {includesToday && (
                        <div className="inline-flex items-center gap-1.5 h-[32px] px-2.5 rounded-xl bg-[#0e101c] border border-white/[0.09] text-[11px]">
                            <button
                                type="button"
                                onClick={() => setAutoRefresh(a => !a)}
                                title="Toggle 30s automatic live refresh"
                                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white cursor-pointer"
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        autoRefresh ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                                    }`}
                                />
                                <span className="font-bold text-[10px] uppercase tracking-wider">
                                    {autoRefresh ? 'Live 30s' : 'Paused'}
                                </span>
                            </button>
                            {lastSyncedAt && (
                                <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                                    · {formatTimeNoSec(lastSyncedAt)}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => void fetchData(true)}
                                title="Refresh now"
                                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <RefreshCw size={11} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── COLLAPSIBLE COMPLIANCE LEADERBOARD & REPEAT-OFFENDER STRIP ──────────────────────── */}
            {!loading && recruiterRollups.length >= 2 && (
                <ComplianceLeaderboard
                    rollups={recruiterRollups}
                    onInspectRecruiter={name => {
                        setSelectedRecruiters([name]);
                        setViewMode('daily');
                    }}
                />
            )}

            {loading && (
                <p className="text-center text-slate-400 font-medium text-sm py-12 animate-pulse">
                    Processing attendance &amp; compliance metrics…
                </p>
            )}

            {/* ── MAIN REPORT VIEW ──────────────────────────────────────────────────────────────── */}
            {!loading && compareMode && canCompare ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <GitCompare size={14} className="text-cyan-400" />
                            <p className="text-xs font-black text-white tracking-wider uppercase">
                                Comparing {selectedRecruiters.length} Recruiters
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCompareMode(false)}
                            className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            Back to View
                        </button>
                    </div>
                    <div
                        className={`grid gap-3 ${
                            selectedRecruiters.length === 2
                                ? 'grid-cols-1 sm:grid-cols-2'
                                : selectedRecruiters.length === 3
                                    ? 'grid-cols-1 sm:grid-cols-3'
                                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                        }`}
                    >
                        {selectedRecruiters.map(name => {
                            const userRows = filteredRows.filter(r => r.name === name);
                            const match = userRows[0];
                            return (
                                <ComparisonCard
                                    key={name}
                                    name={name}
                                    clientName={recruiterClientMap[name] || ''}
                                    rows={userRows}
                                    onPrint={() => {
                                        if (match) handlePrintRecruiter(match.userId, name, match.clientName);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            ) : !loading && viewMode === 'recruiters' ? (
                <RecruiterRollupTable
                    rollups={recruiterRollups}
                    onInspectRecruiter={name => {
                        setSelectedRecruiters([name]);
                        setViewMode('daily');
                    }}
                    onPrintScorecard={handlePrintRecruiter}
                />
            ) : !loading && viewMode === 'clients' ? (
                <ClientRollupTable
                    rollups={clientRollups}
                    onSelectClient={clientName => {
                        setSelectedClients([clientName]);
                        setViewMode('recruiters');
                    }}
                />
            ) : (
                !loading && (
                    <DailyReportTable
                        rows={filteredRows}
                        showDate={isMultiDay}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        onEdit={r => {
                            const fullUser = allUsersList.find(u => u.id === r.userId);
                            if (fullUser) {
                                setSelectedUserForEdit({ user: fullUser, date: r.date });
                            } else {
                                getAllUsers().then(users => {
                                    const found = users.find(u => u.id === r.userId);
                                    if (found) setSelectedUserForEdit({ user: found, date: r.date });
                                });
                            }
                        }}
                    />
                )
            )}

            {/* Dynamic Policy Legend Footnote */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-500 px-2">
                <span className="flex items-center gap-1">
                    <AlertTriangle size={10} className="text-orange-400" />
                    Break &gt; {formatDurationHM(policyConfig.global.breakLimitMins * 60000)}
                </span>
                <span className="flex items-center gap-1">
                    <AlertTriangle size={10} className="text-sky-400" />
                    BRB &gt; {policyConfig.global.brbLimitMins}m
                </span>
                <span className="flex items-center gap-1">
                    <Flame size={10} className="text-fuchsia-400" />
                    Total Brk+BRB &gt; {formatDurationHM(policyConfig.global.combinedLimitMins * 60000)}
                </span>
                <span className="flex items-center gap-1">
                    <Clock size={10} className="text-amber-400" />
                    Per-user shift · +{policyConfig.global.graceMins}m grace
                </span>
                <span className="text-slate-600 ml-auto hidden sm:inline">
                    Times shown without seconds · Exceed ≥ 1h in Xh Ym · Click any daily row to audit
                </span>
            </div>

            <AnimatePresence>
                {selectedUserForEdit && (
                    <DailyLogEditor
                        user={selectedUserForEdit.user}
                        initialDate={selectedUserForEdit.date}
                        currentUserId={currentAdminId}
                        onClose={() => setSelectedUserForEdit(null)}
                        onSave={() => void fetchData(true)}
                    />
                )}
            </AnimatePresence>

            <PolicyRulesModal
                open={policyModalOpen}
                config={policyConfig}
                clients={clients.map(c => c.name)}
                onSave={handleSavePolicy}
                onClose={() => setPolicyModalOpen(false)}
            />

            {mounted && createPortal(searchPortal, document.body)}
            {mounted && createPortal(exportPortal, document.body)}
        </div>
    );
}
