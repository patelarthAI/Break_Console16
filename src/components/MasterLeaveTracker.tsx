'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileSpreadsheet, Plus, Trash2, Download, CheckCircle,
    Edit2, X, ChevronDown, ChevronUp, CalendarCheck2,
    AlertCircle, Search,
    ChevronLeft, ChevronRight,
    CheckSquare, Square, MinusSquare, Sliders, CalendarRange, Sparkles, Check,
    Activity, Clock, User as UserIcon, Building2, Tag, Calendar as CalendarIcon,
    Flame, ShieldCheck, HeartPulse
} from 'lucide-react';
import {
    getAllUsers, getClients, ClientRow,
    addLeave, updateLeave, deleteLeave, getLeavesPage, getLeaveSummary, SmartLeaveRecord, LeaveSummary,
    bulkUpdateLeaves, bulkDeleteLeaves, bulkAddLeaves
} from '@/lib/store';
import { User, LeaveRecord } from '@/types';
import { dateStr, exportExcel } from '@/lib/timeUtils';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/ui/CustomSelect';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Format date cleanly: "28 Aug 2026" */
function fmtDate(iso: string): string {
    if (!iso) return '';
    const [yr, mo, dy] = iso.split('-');
    const m = MONTHS[parseInt(mo, 10) - 1] || 'Jan';
    return `${parseInt(dy, 10)} ${m} ${yr}`;
}

/** Get weekday: "Thu" */
function getWeekday(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d.getTime()) ? '' : DAYS_OF_WEEK[d.getDay()];
}

/** Calculate all date strings between start and end with optional weekend skipping */
function getDatesInRange(start: string, end: string, excludeWeekends: boolean): string[] {
    const dates: string[] = [];
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return dates;
    const cur = new Date(s);
    while (cur <= e) {
        const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
        if (!excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
            const y = cur.getFullYear();
            const m = String(cur.getMonth() + 1).padStart(2, '0');
            const d = String(cur.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
        }
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

const LEAVE_TYPES = [
    'Sick Leave',
    'HD-Sick',
    'Casual Leave',
    'HD-Casual',
    'LWP',
    'HD-LWP',
    'HD-Sick Room',
    'LWP-Doc not Received',
    'Paternity',
    'Paid Leave'
];
const SYSTEM_LEAVE_TYPES = ['System: Absent', 'System: Half-Day'];
const ALL_LEAVE_TYPES = [...LEAVE_TYPES, ...SYSTEM_LEAVE_TYPES];
const LEAVE_PAGE_SIZE = 25;

const LEAVE_META: Record<string, { dot: string; text: string; bg: string; border: string; glow: string }> = {
    'Sick Leave': { dot: '#a78bfa', text: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/30', glow: 'rgba(167,139,250,0.5)' },
    'HD-Sick': { dot: '#c4b5fd', text: 'text-violet-200', bg: 'bg-violet-500/15', border: 'border-violet-500/30', glow: 'rgba(196,181,253,0.5)' },
    'Casual Leave': { dot: '#38bdf8', text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-500/30', glow: 'rgba(56,189,248,0.5)' },
    'HD-Casual': { dot: '#7dd3fc', text: 'text-sky-200', bg: 'bg-sky-500/15', border: 'border-sky-500/30', glow: 'rgba(125,211,252,0.5)' },
    'LWP': { dot: '#f43f5e', text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/35', glow: 'rgba(244,63,94,0.5)' },
    'HD-LWP': { dot: '#fb7185', text: 'text-rose-200', bg: 'bg-rose-500/15', border: 'border-rose-500/35', glow: 'rgba(251,113,133,0.5)' },
    'HD-Sick Room': { dot: '#c084fc', text: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/30', glow: 'rgba(192,132,252,0.5)' },
    'LWP-Doc not Received': { dot: '#ef4444', text: 'text-red-300', bg: 'bg-red-500/20', border: 'border-red-500/40', glow: 'rgba(239,68,68,0.5)' },
    'Paternity': { dot: '#e879f9', text: 'text-fuchsia-300', bg: 'bg-fuchsia-500/15', border: 'border-fuchsia-500/30', glow: 'rgba(232,121,249,0.5)' },
    'Paid Leave': { dot: '#10b981', text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/35', glow: 'rgba(16,185,129,0.5)' },
    'System: Absent': { dot: '#f59e0b', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/35', glow: 'rgba(245,158,11,0.5)' },
    'System: Half-Day': { dot: '#f59e0b', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/35', glow: 'rgba(245,158,11,0.5)' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
    const m = LEAVE_META[type] ?? LEAVE_META['Casual Leave'];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide border shadow-sm ${m.text} ${m.bg} ${m.border}`}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.dot, boxShadow: `0 0 6px ${m.glow}` }} />
            <span className="truncate">{type}</span>
        </span>
    );
}

function StatCard({ 
    label, 
    value, 
    sub, 
    accent, 
    active, 
    onClick,
    icon: Icon
}: { 
    label: string; 
    value: string | number; 
    sub?: string; 
    accent: string; 
    active?: boolean; 
    onClick?: () => void;
    icon: any;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{ padding: '16px 18px', minHeight: '112px' }}
            className={`relative flex flex-col justify-between text-left rounded-xl bg-[#0f1220] border transition-all duration-150 group cursor-pointer overflow-hidden ${
                active 
                    ? 'border-indigo-500/60 bg-gradient-to-b from-indigo-500/[0.14] to-indigo-500/[0.04] shadow-[0_0_24px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/40' 
                    : 'border-white/[0.08] hover:border-white/20 hover:bg-[#141828]'
            }`}
        >
            <div className={`absolute top-0 left-0 right-0 h-[2px] ${accent} ${active ? 'opacity-100' : 'opacity-40 group-hover:opacity-100 transition-opacity'}`} />
            
            {/* Top Row: Label & Icon */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 group-hover:text-white transition-colors">{label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
                </div>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${active ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 group-hover:text-white'}`}>
                    <Icon size={14} />
                </div>
            </div>

            {/* Middle: Crisp Count */}
            <div className="my-1.5">
                <p className="text-2xl font-black text-white tabular-nums tracking-tight leading-none">{value}</p>
            </div>

            {/* Bottom Row: Subtitle */}
            <div className="flex items-center justify-between w-full">
                <p className="text-[11px] text-zinc-400 font-medium truncate leading-none">{sub || '—'}</p>
            </div>
        </button>
    );
}

// ─── Label / Input tokens ─────────────────────────────────────────────────────
const lbl = "block text-xs font-semibold text-zinc-300 mb-1.5 tracking-wide";
const inp = "w-full bg-[#121626] border border-white/10 rounded-xl py-2.5 px-3.5 text-zinc-100 text-xs font-medium focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-500 color-scheme-dark";
const sel = `${inp} appearance-none pr-9 cursor-pointer`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className={lbl}>{label}</label>{children}</div>;
}
function SelectWrap({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative">
            {children}
            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MasterLeaveTracker({ currentUser }: { currentUser: User }) {
    const { success, error: toastError } = useToast();
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Data
    const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
    const [smartLeaves, setSmartLeaves] = useState<SmartLeaveRecord[]>([]);
    const [totalLeaves, setTotalLeaves] = useState(0);
    const [summary, setSummary] = useState<LeaveSummary>({
        totalEntries: 0,
        totalDays: 0,
        plannedEntries: 0,
        unplannedEntries: 0,
        sickDays: 0,
        casualDays: 0,
        lwpDays: 0,
        uniqueEmployees: 0,
        uniqueClients: 0,
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

    // Form drawer (Single & Date Range Add / Single Edit)
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [creationMode, setCreationMode] = useState<'single' | 'range'>('single');

    // Pending single delete (for ConfirmDialog)
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Form fields (Single / Range)
    const [date, setDate] = useState(dateStr(new Date()));
    const [startDate, setStartDate] = useState(dateStr(new Date()));
    const [endDate, setEndDate] = useState(dateStr(new Date()));
    const [skipWeekends, setSkipWeekends] = useState(true);
    const [selectedClient, setSelectedClient] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [isPlanned, setIsPlanned] = useState(true);
    const [reason, setReason] = useState('');
    const [leaveType, setLeaveType] = useState('Sick Leave');
    const [dayCount, setDayCount] = useState<number>(1);

    // Bulk Edit Form fields
    const [bulkLeaveType, setBulkLeaveType] = useState('Casual Leave');
    const [bulkIsPlanned, setBulkIsPlanned] = useState(true);
    const [bulkDayCount, setBulkDayCount] = useState<number>(1);
    const [bulkReason, setBulkReason] = useState('');
    const [updateLeaveType, setUpdateLeaveType] = useState(true);
    const [updatePlanned, setUpdatePlanned] = useState(false);
    const [updateDuration, setUpdateDuration] = useState(false);
    const [updateReason, setUpdateReason] = useState(false);
    const [bulkSaving, setBulkSaving] = useState(false);

    // Filters
    const [filterClient, setFilterClient] = useState<string[]>([]);
    const [filterEmployee, setFilterEmployee] = useState<string[]>([]);
    const [filterLeaveType, setFilterLeaveType] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'Date', dir: 'desc' });

    // Available years
    const availableYears = useMemo(() => {
        const currentYr = new Date().getFullYear();
        const years = [String(currentYr)];
        for (let i = 1; i <= 3; i++) {
            years.push(String(currentYr - i));
        }
        return years;
    }, []);

    // Initial load
    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                const [allUsersData, clientsData] = await Promise.all([
                    getAllUsers(),
                    getClients(),
                ]);

                if (!mounted) return;
                setAllUsers(allUsersData.filter(u => !u.isMaster));
                setClients(clientsData);
            } catch (err) {
                console.error(err);
                toastError('Initialization failed', 'Could not load users or clients.');
            }
        }

        init();
        return () => { mounted = false; };
    }, []);

    // Keyboard shortcut listener: "/" or "Ctrl+K" to focus search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === '/' || (e.ctrlKey && e.key === 'k') || (e.metaKey && e.key === 'k')) && 
                document.activeElement?.tagName !== 'INPUT' && 
                document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Debounce search input to avoid overwhelming the server
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setCurrentPage(1);
        }, 220);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset to page 1 on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filterClient, filterEmployee, filterLeaveType, filterYear, filterMonth]);

    // Load leaves on page / filter change with race-condition safety
    useEffect(() => {
        let active = true;
        setLoading(true);

        async function fetchData() {
            try {
                const filters = {
                    clientName: filterClient.length > 0 ? filterClient : undefined,
                    employeeName: filterEmployee.length > 0 ? filterEmployee : undefined,
                    leaveType: filterLeaveType.length > 0 ? filterLeaveType : undefined,
                    search: debouncedSearch || undefined,
                    year: filterYear || undefined,
                    month: filterMonth || undefined,
                    force: false,
                };

                const [historyPage, nextSummary] = await Promise.all([
                    getLeavesPage({
                        ...filters,
                        sortKey: sortConfig.key,
                        sortDir: sortConfig.dir,
                        page: currentPage,
                        pageSize: LEAVE_PAGE_SIZE,
                    }),
                    getLeaveSummary(filters),
                ]);

                if (!active) return;
                setLeaves(historyPage.items);
                setTotalLeaves(historyPage.total);
                setSummary(nextSummary);
                setSmartLeaves([]);
            } catch (err) {
                if (!active) return;
                console.error('Leave fetch error:', err);
                toastError('Could not load leave records', 'The leave board is temporarily unavailable.');
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchData();
        return () => { active = false; };
    }, [currentPage, filterClient, filterEmployee, filterLeaveType, debouncedSearch, filterYear, filterMonth, sortConfig]);

    async function loadLeavesPage(force = false, targetPage = currentPage) {
        setLoading(true);
        try {
            const page = force ? 1 : targetPage;
            const filters = {
                clientName: filterClient.length > 0 ? filterClient : undefined,
                employeeName: filterEmployee.length > 0 ? filterEmployee : undefined,
                leaveType: filterLeaveType.length > 0 ? filterLeaveType : undefined,
                search: debouncedSearch || undefined,
                year: filterYear || undefined,
                month: filterMonth || undefined,
                force,
            };

            const [historyPage, nextSummary] = await Promise.all([
                getLeavesPage({
                    ...filters,
                    sortKey: sortConfig.key,
                    sortDir: sortConfig.dir,
                    page,
                    pageSize: LEAVE_PAGE_SIZE,
                }),
                getLeaveSummary(filters),
            ]);

            setLeaves(historyPage.items);
            setTotalLeaves(historyPage.total);
            setSummary(nextSummary);
            setSmartLeaves([]);
        } catch (err) {
            console.error(err);
            toastError('Could not load leave records', 'The leave board is temporarily unavailable.');
        } finally {
            setLoading(false);
        }
    }

    // Available employees memo with pre-selection guarantee
    const availableEmployees = useMemo(() => {
        let pool = allUsers;
        if (selectedClient) {
            pool = allUsers.filter(u => u.clientName?.trim().toLowerCase() === selectedClient.trim().toLowerCase());
        }
        
        const names = new Set(pool.map(u => u.name.trim()));
        if (employeeName && !names.has(employeeName.trim())) {
            pool = [{ id: `emp-${employeeName}`, name: employeeName, clientName: selectedClient || '' } as any, ...pool];
        }
        return [...pool].sort((a, b) => a.name.localeCompare(b.name));
    }, [allUsers, selectedClient, employeeName]);

    function resetForm() {
        setEditingId(null);
        setCreationMode('single');
        setDate(dateStr(new Date()));
        setStartDate(dateStr(new Date()));
        setEndDate(dateStr(new Date()));
        setSkipWeekends(true);
        setSelectedClient('');
        setEmployeeName('');
        setIsPlanned(true);
        setReason('');
        setLeaveType('Sick Leave');
        setDayCount(1);
    }

    function openNew() {
        resetForm();
        let empName = '';
        if (filterEmployee.length > 0) {
            empName = filterEmployee[0];
        } else if (search.trim()) {
            const match = allUsers.find(u => u.name.toLowerCase().includes(search.trim().toLowerCase()));
            if (match) empName = match.name;
        }

        if (empName) {
            setEmployeeName(empName);
            const userObj = allUsers.find(u => u.name.trim().toLowerCase() === empName.trim().toLowerCase());
            if (userObj?.clientName) {
                setSelectedClient(userObj.clientName);
            } else if (filterClient.length > 0) {
                setSelectedClient(filterClient[0]);
            }
        } else if (filterClient.length > 0) {
            setSelectedClient(filterClient[0]);
        }
        setDrawerOpen(true);
    }

    function startEdit(l: LeaveRecord) {
        setEditingId(l.id);
        setCreationMode('single');
        setDate(l.date);
        setSelectedClient(l.client_name);
        setEmployeeName(l.employee_name);
        setIsPlanned(l.is_planned);
        setReason(l.reason || '');
        setLeaveType(l.leave_type);
        setDayCount(l.day_count);
        setDrawerOpen(true);
    }

    function cancelEdit() {
        resetForm();
        setDrawerOpen(false);
    }

    const calculatedRangeDates = useMemo(() => {
        if (creationMode !== 'range') return [];
        return getDatesInRange(startDate, endDate, skipWeekends);
    }, [creationMode, startDate, endDate, skipWeekends]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedClient || !employeeName) return;

        setSaving(true);
        try {
            if (creationMode === 'range' && !editingId) {
                if (calculatedRangeDates.length === 0) {
                    toastError('Invalid date range', 'No valid working dates were selected.');
                    setSaving(false);
                    return;
                }

                const payloads = calculatedRangeDates.map(d => ({
                    date: d,
                    client_name: selectedClient,
                    employee_name: employeeName,
                    is_planned: isPlanned,
                    reason: reason || null,
                    approver: currentUser.name,
                    leave_type: leaveType,
                    day_count: dayCount
                }));

                await bulkAddLeaves(payloads);
                success(
                    'Multi-day leave recorded',
                    `${employeeName} · ${calculatedRangeDates.length} days (${fmtDate(calculatedRangeDates[0])} to ${fmtDate(calculatedRangeDates[calculatedRangeDates.length - 1])})`
                );
            } else {
                const payload = {
                    date,
                    client_name: selectedClient,
                    employee_name: employeeName,
                    is_planned: isPlanned,
                    reason: reason || null,
                    approver: currentUser.name,
                    leave_type: leaveType,
                    day_count: dayCount
                };

                if (editingId && !editingId.startsWith('virtual-')) {
                    await updateLeave(editingId, payload);
                    success('Record updated', `${employeeName}'s leave on ${fmtDate(date)} has been saved.`);
                } else {
                    await addLeave(payload);
                    success('Leave recorded', `${employeeName} · ${leaveType} · ${fmtDate(date)}`);
                }
            }

            if (currentPage !== 1) setCurrentPage(1);
            else await loadLeavesPage(true, 1);
            resetForm();
            setDrawerOpen(false);
        } catch (err) {
            console.error(err);
            toastError('Could not save leave', 'Check the database connection and try again.');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        const targetLeave = leaves.find(l => l.id === id) || smartLeaves.find(l => l.id === id);
        const isSystem = targetLeave?.leave_type?.startsWith('System:');
        
        if (isSystem) {
            await updateLeave(id, { leave_type: 'Dismissed', reason: 'Dismissed by Admin' });
        } else {
            await deleteLeave(id);
        }
        
        const name = targetLeave?.employee_name ?? 'Record';
        if (editingId === id) cancelEdit();
        setDeleteId(null);
        setSelectedIds(prev => prev.filter(x => x !== id));
        const nextTotal = Math.max(0, totalLeaves - 1);
        const nextPage = Math.min(currentPage, Math.max(1, Math.ceil(nextTotal / LEAVE_PAGE_SIZE)));
        const filters = {
            clientName: filterClient.length > 0 ? filterClient : undefined,
            employeeName: filterEmployee.length > 0 ? filterEmployee : undefined,
            leaveType: filterLeaveType.length > 0 ? filterLeaveType : undefined,
            search: search || undefined,
            year: filterYear || undefined,
            month: filterMonth || undefined,
            force: true,
        };

        setLeaves((current) => current.filter((leave) => leave.id !== id));
        setSmartLeaves((current) => current.filter((leave) => leave.id !== id));
        setTotalLeaves(nextTotal);
        setSummary(await getLeaveSummary(filters));

        if (nextPage !== currentPage) setCurrentPage(nextPage);
        success(isSystem ? 'Leave dismissed' : 'Leave deleted', `${name}'s record has been removed.`);
    }

    async function handleBulkSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (selectedIds.length === 0) return;
        setBulkSaving(true);
        try {
            const updates: Partial<LeaveRecord> = {};
            if (updateLeaveType) updates.leave_type = bulkLeaveType;
            if (updatePlanned) updates.is_planned = bulkIsPlanned;
            if (updateDuration) updates.day_count = bulkDayCount;
            if (updateReason) updates.reason = bulkReason.trim() || null;
            updates.approver = currentUser.name;

            await bulkUpdateLeaves(selectedIds, updates);
            success('Bulk update completed', `Successfully updated ${selectedIds.length} leave record(s).`);
            setBulkDrawerOpen(false);
            setSelectedIds([]);
            await loadLeavesPage(true);
        } catch (err) {
            console.error(err);
            toastError('Bulk update failed', 'Could not apply updates to selected records.');
        } finally {
            setBulkSaving(false);
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) return;
        setSaving(true);
        try {
            await bulkDeleteLeaves(selectedIds);
            success('Bulk delete completed', `Deleted ${selectedIds.length} leave record(s).`);
            setBulkDeleteConfirm(false);
            setSelectedIds([]);
            await loadLeavesPage(true);
        } catch (err) {
            console.error(err);
            toastError('Bulk delete failed', 'Could not delete the selected records.');
        } finally {
            setSaving(false);
        }
    }

    async function declineSmartLeave(l: SmartLeaveRecord) {
        setSaving(true);
        try {
            await updateLeave(l.id, { leave_type: 'Dismissed', reason: 'Dismissed by Admin' });
            setSmartLeaves((current) => current.filter((leave) => leave.id !== l.id));
            setLeaves((current) => current.filter((leave) => leave.id !== l.id));
            setSelectedIds((prev) => prev.filter(x => x !== l.id));
            setTotalLeaves((current) => Math.max(0, current - 1));
            setSummary(await getLeaveSummary({
                clientName: filterClient.length > 0 ? filterClient : undefined,
                employeeName: filterEmployee.length > 0 ? filterEmployee : undefined,
                leaveType: filterLeaveType.length > 0 ? filterLeaveType : undefined,
                search: search || undefined,
                year: filterYear || undefined,
                month: filterMonth || undefined,
                force: true,
            }));
            success('System leave removed', 'The auto-generated leave was permanently deleted.');
        } catch (err) {
            console.error(err);
            toastError('Could not delete system leave', 'Please check your connection and try again.');
        } finally {
            setSaving(false);
        }
    }

    const filteredSmartLeaves = useMemo(() => {
        const q = search.toLowerCase().trim();
        const result = smartLeaves.filter((l) => {
            if (filterClient.length > 0 && !filterClient.includes(l.client_name)) return false;
            if (filterEmployee.length > 0 && !filterEmployee.includes(l.employee_name)) return false;
            if (filterYear && !l.date.startsWith(filterYear)) return false;
            if (filterMonth && l.date.slice(5, 7) !== filterMonth) return false;
            if (filterLeaveType.length > 0 && !filterLeaveType.map(t => t.toLowerCase()).includes(l.leave_type.toLowerCase())) return false;
            if (q && !l.employee_name.toLowerCase().includes(q) && !l.client_name.toLowerCase().includes(q) && !l.leave_type.toLowerCase().includes(q)) return false;
            return true;
        });

        result.sort((a, b) => {
            let aVal: string | number = '';
            let bVal: string | number = '';
            switch (sortConfig.key) {
                case 'Date': aVal = a.date; bVal = b.date; break;
                case 'Employee': aVal = a.employee_name; bVal = b.employee_name; break;
                case 'Client': aVal = a.client_name; bVal = b.client_name; break;
                case 'Leave Type': aVal = a.leave_type; bVal = b.leave_type; break;
                case 'Duration': aVal = a.day_count; bVal = b.day_count; break;
                case 'Planned': aVal = a.is_planned ? 1 : 0; bVal = b.is_planned ? 1 : 0; break;
                case 'Reason': aVal = a.reason || ''; bVal = b.reason || ''; break;
                case 'Logged by': aVal = a.is_smart ? 'System Gen' : (a.approver || ''); bVal = b.is_smart ? 'System Gen' : (b.approver || ''); break;
                default: break;
            }
            if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [smartLeaves, filterClient, filterEmployee, filterLeaveType, search, filterYear, filterMonth, sortConfig]);

    const visibleLeaves = useMemo(() => (currentPage === 1 ? [...filteredSmartLeaves, ...leaves] : leaves), [currentPage, filteredSmartLeaves, leaves]);
    const displayedLeaves = visibleLeaves;

    const totalDays = summary.totalDays;
    const lwpCount = summary.lwpDays;
    const sickCount = summary.sickDays;
    const casualCount = summary.casualDays;
    const unplanned = summary.unplannedEntries;
    const uniqueEmpls = summary.uniqueEmployees;

    function handleExport() {
        const header = ['Date', 'Client', 'Name', 'Planned', 'Reason', 'Approver', 'Leave Type', 'Count'];
        const data = visibleLeaves.map(l => [
            fmtDate(l.date),
            l.client_name,
            l.employee_name,
            l.is_planned ? 'Yes' : 'No',
            l.reason || '',
            l.approver || '',
            l.leave_type,
            l.day_count,
        ]);
        exportExcel([header, ...data], 'leave-tracker');
    }

    const hasFilter = !!(filterClient.length || filterEmployee.length || filterLeaveType.length || search || filterYear);

    const filterableEmployees = useMemo(() => {
        const pool = filterClient.length > 0
            ? allUsers.filter(u => filterClient.includes(u.clientName)).map(u => u.name)
            : allUsers.map(u => u.name);
        return [...new Set(pool)].sort();
    }, [allUsers, filterClient]);

    const totalPages = Math.max(1, Math.ceil(totalLeaves / LEAVE_PAGE_SIZE));

    // Selection helpers
    const allVisibleIds = useMemo(() => visibleLeaves.map(l => l.id), [visibleLeaves]);
    const isAllVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.includes(id));
    const isSomeVisibleSelected = allVisibleIds.some(id => selectedIds.includes(id)) && !isAllVisibleSelected;

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (isAllVisibleSelected) {
            setSelectedIds(prev => prev.filter(id => !allVisibleIds.includes(id)));
        } else {
            setSelectedIds(prev => Array.from(new Set([...prev, ...allVisibleIds])));
        }
    };

    const clearSelection = () => setSelectedIds([]);

    const selectedRecords = useMemo(() => {
        return visibleLeaves.filter(l => selectedIds.includes(l.id));
    }, [visibleLeaves, selectedIds]);

    return (
        <div className="flex flex-col gap-6 relative">
            {/* Single Delete Confirmation Dialog */}
            <ConfirmDialog
                open={!!deleteId}
                title="Delete this leave record?"
                message="This will permanently remove the leave entry. This action cannot be undone."
                confirmLabel="Delete Record"
                onConfirm={() => { if (deleteId) handleDelete(deleteId); }}
                onCancel={() => setDeleteId(null)}
            />

            {/* Bulk Delete Confirmation Dialog */}
            <ConfirmDialog
                open={bulkDeleteConfirm}
                title={`Delete ${selectedIds.length} leave records?`}
                message={`Are you sure you want to permanently delete ${selectedIds.length} selected records? This action cannot be undone.`}
                confirmLabel={`Delete ${selectedIds.length} Records`}
                onConfirm={handleBulkDelete}
                onCancel={() => setBulkDeleteConfirm(false)}
            />

            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                        <FileSpreadsheet size={19} className="text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-white tracking-tight">Leave Management</h1>
                        <p className="text-xs text-zinc-400 mt-0.5 font-medium">Enterprise workforce attendance, historical balances, and leave approvals</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <button 
                        type="button"
                        onClick={handleExport} 
                        disabled={visibleLeaves.length === 0}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-200 text-xs font-semibold hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                    >
                        <Download size={13} /> Export CSV
                    </button>
                    <button 
                        type="button"
                        onClick={openNew}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <Plus size={14} /> New Record
                    </button>
                </div>
            </div>

            {/* ── Interactive KPI Stat Ribbon ─────────────────────────────── */}
            <div className="grid grid-cols-5 gap-3.5">
                <StatCard 
                    label="Total Leaves" 
                    value={totalDays.toFixed(1)} 
                    accent="bg-emerald-500" 
                    sub="All approved days" 
                    icon={Activity}
                    active={filterLeaveType.length === 0}
                    onClick={() => setFilterLeaveType([])}
                />
                <StatCard 
                    label="Sick Leaves" 
                    value={sickCount.toFixed(1)} 
                    accent="bg-violet-500" 
                    sub="Medical & health" 
                    icon={HeartPulse}
                    active={filterLeaveType.includes('Sick Leave')}
                    onClick={() => setFilterLeaveType(prev => prev.includes('Sick Leave') ? [] : ['Sick Leave', 'HD-Sick'])}
                />
                <StatCard 
                    label="Casual Leaves" 
                    value={casualCount.toFixed(1)} 
                    accent="bg-sky-500" 
                    sub="Personal & vacation" 
                    icon={CalendarIcon}
                    active={filterLeaveType.includes('Casual Leave')}
                    onClick={() => setFilterLeaveType(prev => prev.includes('Casual Leave') ? [] : ['Casual Leave', 'HD-Casual'])}
                />
                <StatCard 
                    label="LWP Days" 
                    value={lwpCount.toFixed(1)} 
                    accent={lwpCount > 0 ? 'bg-rose-500' : 'bg-zinc-700'} 
                    sub="Leave without pay" 
                    icon={Clock}
                    active={filterLeaveType.includes('LWP')}
                    onClick={() => setFilterLeaveType(prev => prev.includes('LWP') ? [] : ['LWP', 'HD-LWP', 'LWP-Doc not Received'])}
                />
                <StatCard 
                    label="Unplanned" 
                    value={unplanned} 
                    accent={unplanned > 0 ? 'bg-amber-500' : 'bg-zinc-700'} 
                    sub="Missing prior notice" 
                    icon={AlertCircle}
                />
            </div>

            {/* ── Command & Filter Bar ─────────────────────────────────────── */}
            <div className="rounded-xl bg-[#0f1220] border border-white/[0.08] p-3 shadow-lg z-20 relative flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Search Input with Hotkey */}
                    <div className="relative flex-1 min-w-[240px] max-w-[360px]">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10" />
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Search records, recruiter, client…" 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: '38px', paddingRight: '38px', height: '36px' }}
                            className="w-full bg-[#151928] border border-white/10 rounded-lg text-xs text-white placeholder:text-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium" 
                        />
                        {search ? (
                            <button 
                                type="button"
                                onClick={() => setSearch('')} 
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-white transition-colors"
                            >
                                <X size={13} />
                            </button>
                        ) : (
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-zinc-400 bg-white/[0.06] border border-white/10 px-1.5 py-0.5 rounded pointer-events-none">
                                /
                            </span>
                        )}
                    </div>

                    <div className="w-px h-6 bg-white/[0.08] flex-shrink-0" />

                    {/* Year Selector */}
                    <CustomSelect
                        options={availableYears.map(yr => ({ value: yr, label: yr }))}
                        value={filterYear}
                        onChange={(val) => { setFilterYear(val); if (!val) setFilterMonth(''); }}
                        placeholder="Year"
                        className="min-w-[110px]"
                    />

                    {/* Month Selector */}
                    <CustomSelect
                        options={['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => ({
                            value: m,
                            label: new Date(2000, Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
                        }))}
                        value={filterMonth}
                        onChange={setFilterMonth}
                        placeholder="Month"
                        className={`min-w-[110px] ${!filterYear ? 'opacity-40 pointer-events-none' : ''}`}
                    />

                    {/* Client Multi-Select */}
                    <CustomSelect
                        multi
                        options={clients.map(c => ({ value: c.name, label: c.name }))}
                        value={filterClient}
                        onChange={(vals) => { setFilterClient(vals); setFilterEmployee([]); }}
                        placeholder="Client"
                        searchable={clients.length > 5}
                        className="min-w-[160px] max-w-[220px]"
                    />

                    {/* Employee Multi-Select */}
                    <CustomSelect
                        multi
                        options={filterableEmployees.map(n => ({ value: n, label: n }))}
                        value={filterEmployee}
                        onChange={setFilterEmployee}
                        placeholder="Recruiter"
                        searchable={filterableEmployees.length > 5}
                        className="min-w-[160px] max-w-[220px]"
                    />

                    {/* Leave Type Selector */}
                    <CustomSelect
                        multi
                        options={ALL_LEAVE_TYPES.map(lt => ({ value: lt, label: lt }))}
                        value={filterLeaveType}
                        onChange={setFilterLeaveType}
                        placeholder="Leave Type"
                        searchable
                        className="min-w-[160px] max-w-[220px]"
                    />
                </div>

                {/* Active Filter Chips Bar */}
                {hasFilter && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                            {filterYear && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-semibold text-indigo-300">
                                    {filterYear}{filterMonth ? ` · ${new Date(2000, Number(filterMonth) - 1, 1).toLocaleDateString('en-US', { month: 'short' })}` : ''}
                                    <button type="button" onClick={() => { setFilterYear(''); setFilterMonth(''); }} className="hover:text-white transition-colors"><X size={10} /></button>
                                </span>
                            )}
                            {filterClient.map(c => (
                                <span key={c} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-[11px] font-semibold text-violet-300">
                                    {c}
                                    <button type="button" onClick={() => { setFilterClient(filterClient.filter(x => x !== c)); setFilterEmployee([]); }} className="hover:text-white transition-colors"><X size={10} /></button>
                                </span>
                            ))}
                            {filterEmployee.map(emp => (
                                <span key={emp} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300">
                                    {emp}
                                    <button type="button" onClick={() => setFilterEmployee(filterEmployee.filter(x => x !== emp))} className="hover:text-white transition-colors"><X size={10} /></button>
                                </span>
                            ))}
                            {filterLeaveType.map(lt => (
                                <span key={lt} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[11px] font-semibold text-amber-300">
                                    {lt}
                                    <button type="button" onClick={() => setFilterLeaveType(filterLeaveType.filter(x => x !== lt))} className="hover:text-white transition-colors"><X size={10} /></button>
                                </span>
                            ))}
                            <button 
                                type="button"
                                onClick={() => { setFilterClient([]); setFilterEmployee([]); setFilterLeaveType([]); setSearch(''); setFilterYear(''); setFilterMonth(''); }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20"
                            >
                                <X size={10} /> Reset All
                            </button>
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex-shrink-0">
                            {visibleLeaves.length} {visibleLeaves.length === 1 ? 'entry' : 'entries'} found
                        </span>
                    </div>
                )}
            </div>

            {/* ── Enterprise Data Grid Container ──────────────────────────── */}
            <div className="rounded-2xl bg-[#0c0e17]/90 backdrop-blur-xl border border-white/[0.08] shadow-2xl overflow-hidden pb-28">
                <div className="overflow-x-auto pb-2">
                    <div className="min-w-[1220px]">
                        {/* Table Header Row */}
                        <div className="grid grid-cols-[44px_120px_minmax(180px,2fr)_minmax(130px,1.2fr)_minmax(160px,1.4fr)_100px_100px_minmax(180px,2fr)_110px_70px] gap-3 px-5 py-3.5 bg-[#101322] border-b border-white/[0.08] items-center">
                            {/* Master Selection Checkbox */}
                            <div className="flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    className="p-1 rounded-md text-zinc-400 hover:text-white transition-all hover:bg-white/5 focus:outline-none"
                                    title={isAllVisibleSelected ? "Deselect all on page" : "Select all on page"}
                                >
                                    {isAllVisibleSelected ? (
                                        <CheckSquare size={16} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                                    ) : isSomeVisibleSelected ? (
                                        <MinusSquare size={16} className="text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                                    ) : (
                                        <Square size={16} className="text-zinc-600 hover:text-zinc-300" />
                                    )}
                                </button>
                            </div>

                            {['Date', 'Employee', 'Client', 'Leave Type', 'Duration', 'Planned', 'Reason', 'Logged by'].map(h => (
                                <button 
                                    key={h} 
                                    type="button"
                                    onClick={() => {
                                        if (sortConfig.key === h) setSortConfig({ key: h, dir: sortConfig.dir === 'asc' ? 'desc' : 'asc' });
                                        else setSortConfig({ key: h, dir: 'asc' });
                                    }} 
                                    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors outline-none cursor-pointer group text-left"
                                >
                                    {h}
                                    <span className="flex flex-col opacity-0 group-hover:opacity-70 transition-opacity" style={{ opacity: sortConfig.key === h ? 1 : undefined }}>
                                        <ChevronUp size={10} className={`-mb-1 transition-colors ${sortConfig.key === h && sortConfig.dir === 'asc' ? 'text-indigo-400' : ''}`} />
                                        <ChevronDown size={10} className={`transition-colors ${sortConfig.key === h && sortConfig.dir === 'desc' ? 'text-indigo-400' : ''}`} />
                                    </span>
                                </button>
                            ))}
                            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right pr-2">Actions</div>
                        </div>

                        {/* Loading Skeleton Shimmer */}
                        {loading ? (
                            <div className="divide-y divide-white/[0.04]">
                                {[1, 2, 3, 4, 5, 6, 7].map((idx) => (
                                    <div key={idx} className="grid grid-cols-[44px_120px_minmax(180px,2fr)_minmax(130px,1.2fr)_minmax(160px,1.4fr)_100px_100px_minmax(180px,2fr)_110px_70px] gap-3 px-5 py-3.5 items-center animate-pulse">
                                        <div className="w-4 h-4 rounded bg-white/10 mx-auto" />
                                        <div className="h-4 w-20 rounded bg-white/10" />
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-white/10" />
                                            <div className="h-4 w-28 rounded bg-white/10" />
                                        </div>
                                        <div className="h-4 w-20 rounded bg-white/10" />
                                        <div className="h-5 w-24 rounded-md bg-white/10" />
                                        <div className="h-5 w-16 rounded-md bg-white/10" />
                                        <div className="h-5 w-14 rounded-md bg-white/10" />
                                        <div className="h-4 w-32 rounded bg-white/10" />
                                        <div className="h-4 w-16 rounded bg-white/10" />
                                        <div className="flex items-center justify-end gap-1.5">
                                            <div className="w-7 h-7 rounded-lg bg-white/10" />
                                            <div className="w-7 h-7 rounded-lg bg-white/10" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : leaves.length === 0 && filteredSmartLeaves.length === 0 ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-3.5">
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                                    <CalendarCheck2 size={26} className="text-zinc-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-zinc-300">No records found</p>
                                    <p className="text-xs text-zinc-500 mt-1">{search || hasFilter ? 'Try adjusting your search or active filters' : 'Click "New Record" to add the first leave entry'}</p>
                                </div>
                                {(search || hasFilter) && (
                                    <button 
                                        type="button"
                                        onClick={() => { setSearch(''); setFilterClient([]); setFilterEmployee([]); setFilterLeaveType([]); setFilterYear(''); setFilterMonth(''); }}
                                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors px-4 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20"
                                    >
                                        Reset all filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y divide-white/[0.04]">
                                <AnimatePresence initial={false}>
                                    {visibleLeaves.map((l) => {
                                        const isSelected = selectedIds.includes(l.id);
                                        const initials = l.employee_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                                        return (
                                            <motion.div 
                                                key={l.id}
                                                initial={{ opacity: 0 }} 
                                                animate={{ opacity: 1 }} 
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.12 }}
                                                className={`grid grid-cols-[44px_120px_minmax(180px,2fr)_minmax(130px,1.2fr)_minmax(160px,1.4fr)_100px_100px_minmax(180px,2fr)_110px_70px] gap-3 px-5 py-3.5 items-center transition-all duration-150 group cursor-default
                                                    ${editingId === l.id ? 'bg-amber-500/[0.08] ring-1 ring-amber-500/20' 
                                                    : isSelected ? 'bg-indigo-500/[0.12] ring-1 ring-indigo-500/30' 
                                                    : 'hover:bg-[#141829]'}`}
                                            >
                                                {/* Checkbox */}
                                                <div className="flex items-center justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSelect(l.id)}
                                                        className="p-1 rounded-md transition-colors hover:bg-white/5"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare size={16} className="text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                                                        ) : (
                                                            <Square size={16} className="text-zinc-600 hover:text-zinc-300" />
                                                        )}
                                                    </button>
                                                </div>

                                                {/* Date */}
                                                <div>
                                                    <p className="text-xs font-semibold text-zinc-200 tracking-tight">{fmtDate(l.date)}</p>
                                                    <p className="text-[10px] text-zinc-500 font-medium">{getWeekday(l.date)}</p>
                                                </div>
                                                
                                                {/* Employee */}
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                                        {initials}
                                                    </div>
                                                    <span className="text-sm font-semibold text-zinc-100 truncate group-hover:text-indigo-200 transition-colors">
                                                        {l.employee_name}
                                                    </span>
                                                </div>

                                                {/* Client */}
                                                <div className="min-w-0">
                                                    <span className="inline-block max-w-full truncate text-[11px] font-medium text-zinc-300 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-md">
                                                        {l.client_name}
                                                    </span>
                                                </div>

                                                {/* Leave Type */}
                                                <div><TypeBadge type={l.leave_type} /></div>

                                                {/* Duration */}
                                                <div>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${l.day_count === 1 ? 'bg-sky-500/10 text-sky-300 border-sky-500/25' : 'bg-amber-500/10 text-amber-300 border-amber-500/25'}`}>
                                                        {l.day_count === 1 ? '1.0 Day' : '0.5 Day'}
                                                    </span>
                                                </div>

                                                {/* Planned */}
                                                <div>
                                                    {(l as any).is_smart ? (
                                                        <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-semibold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/25">
                                                            <AlertCircle size={11} /> Auto
                                                        </span>
                                                    ) : l.is_planned ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
                                                            <CheckCircle size={11} /> Yes
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/25">
                                                            <AlertCircle size={11} /> No
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Reason */}
                                                <div className="min-w-0 text-zinc-300 text-xs truncate" title={l.reason || ''}>
                                                    {l.reason ? <span className="text-zinc-200">{l.reason}</span> : <span className="text-zinc-600 font-bold">—</span>}
                                                </div>

                                                {/* Logged by */}
                                                <div className="truncate text-zinc-400 text-xs font-medium">
                                                    {(l as any).is_smart ? (
                                                        <span className="text-indigo-400/80 italic font-semibold">System Gen</span>
                                                    ) : (
                                                        <span>{l.approver || '—'}</span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center justify-end gap-1.5 w-full">
                                                    {(l as any).is_smart && (
                                                        <>
                                                            <button 
                                                                type="button"
                                                                onClick={() => startEdit(l)} 
                                                                title="Approve & Save"
                                                                className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all"
                                                            >
                                                                <CheckCircle size={13} />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => declineSmartLeave(l)} 
                                                                title="Decline"
                                                                className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {!(l as any).is_smart && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => startEdit(l)} 
                                                            title="Edit Record"
                                                            className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.03] border border-white/10 text-zinc-400 hover:bg-indigo-500/20 hover:border-indigo-500/40 hover:text-indigo-300 transition-all"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                    )}
                                                    {!(l as any).is_smart && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => setDeleteId(l.id)} 
                                                            title="Delete Record"
                                                            className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.03] border border-white/10 text-zinc-400 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300 transition-all"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* Table Footer / Pagination */}
                {visibleLeaves.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.08] bg-[#0c0e17] mt-1">
                        <p className="text-xs text-zinc-400 font-medium">
                            Showing <span className="text-zinc-200 font-bold">{displayedLeaves.length}</span> of <span className="text-zinc-200 font-bold">{totalLeaves}</span> records · <span className="text-zinc-300 font-semibold">{uniqueEmpls}</span> {uniqueEmpls === 1 ? 'employee' : 'employees'}
                        </p>
                        <div className="flex items-center gap-5">
                            <p className="text-xs text-zinc-400 font-medium">
                                <span className="text-emerald-400 font-bold">{totalDays.toFixed(1)}</span> total days
                            </p>
                            {lwpCount > 0 && (
                                <p className="text-xs font-medium">
                                    <span className="text-rose-400 font-bold">{lwpCount.toFixed(1)}</span> <span className="text-zinc-500">LWP</span>
                                </p>
                            )}
                            <p className="text-xs text-zinc-400 font-medium">
                                Page <span className="text-zinc-100 font-bold">{currentPage}</span> of <span className="text-zinc-100 font-bold">{totalPages}</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    disabled={currentPage === 1 || loading}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 hover:text-white"
                                >
                                    <ChevronLeft size={13} /> Prev
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                    disabled={currentPage >= totalPages || loading}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 hover:text-white"
                                >
                                    Next <ChevronRight size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Floating Bulk Action HUD Capsule ────────────────────────── */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-[#0f1220]/95 backdrop-blur-xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_24px_rgba(99,102,241,0.3)] ring-1 ring-black/40"
                    >
                        <div className="flex items-center gap-2.5 pr-3.5 border-r border-white/10">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                            <span className="text-xs font-bold text-white tracking-wide">
                                {selectedIds.length} <span className="text-zinc-400 font-normal">{selectedIds.length === 1 ? 'record' : 'records'} selected</span>
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setBulkDrawerOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"
                        >
                            <Sliders size={13} /> Bulk Edit
                        </button>

                        <button
                            type="button"
                            onClick={() => setBulkDeleteConfirm(true)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-semibold active:scale-95 transition-all"
                        >
                            <Trash2 size={13} /> Delete
                        </button>

                        <button
                            type="button"
                            onClick={clearSelection}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
                            title="Clear selection"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Slide-over Form Drawer (Single / Range) ──────────────────── */}
            <AnimatePresence>
                {drawerOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                            onClick={cancelEdit} 
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }} 
                            animate={{ x: 0, opacity: 1 }} 
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
                            className="fixed right-0 top-0 bottom-0 z-50 w-[480px] bg-[#0c0e18] border-l border-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08]">
                                <div>
                                    <p className="font-extrabold text-base text-zinc-100">
                                        {editingId ? 'Edit Leave Record' : 'Record New Leave'}
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        {editingId ? 'Update existing leave entry' : 'Add new entry to leave tracker'}
                                    </p>
                                </div>
                                <button type="button" onClick={cancelEdit} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                                {/* Mode Selector */}
                                {!editingId && (
                                    <div className="p-1 rounded-xl bg-[#121626] border border-white/10 flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setCreationMode('single')}
                                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5
                                                ${creationMode === 'single' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                        >
                                            Single Day
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCreationMode('range')}
                                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5
                                                ${creationMode === 'range' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                        >
                                            <CalendarRange size={13} /> Date Range
                                        </button>
                                    </div>
                                )}

                                {/* Date Fields */}
                                {creationMode === 'single' || editingId ? (
                                    <Field label="Date">
                                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={inp} />
                                    </Field>
                                ) : (
                                    <div className="space-y-3 p-3.5 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/20">
                                        <div className="grid grid-cols-2 gap-3">
                                            <Field label="Start Date">
                                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={inp} />
                                            </Field>
                                            <Field label="End Date">
                                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className={inp} />
                                            </Field>
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={skipWeekends}
                                                    onChange={e => setSkipWeekends(e.target.checked)}
                                                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                                />
                                                <span className="text-xs text-zinc-300 font-medium">Skip Weekends (Sat/Sun)</span>
                                            </label>

                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 bg-indigo-500/15 px-2.5 py-0.5 rounded-md border border-indigo-500/25">
                                                <Sparkles size={11} /> {calculatedRangeDates.length} working days
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <Field label="Client">
                                    <SelectWrap>
                                        <select 
                                            value={selectedClient} 
                                            onChange={e => setSelectedClient(e.target.value)} 
                                            required 
                                            className={sel}
                                        >
                                            <option value="" className="bg-[#0d0f18]">Select client…</option>
                                            {clients.map(c => <option key={c.id} value={c.name} className="bg-[#0d0f18]">{c.name}</option>)}
                                        </select>
                                    </SelectWrap>
                                </Field>

                                <Field label="Employee / Recruiter">
                                    <SelectWrap>
                                        <select 
                                            value={employeeName} 
                                            onChange={e => {
                                                const newEmp = e.target.value;
                                                setEmployeeName(newEmp);
                                                if (newEmp && !selectedClient) {
                                                    const match = allUsers.find(u => u.name === newEmp);
                                                    if (match?.clientName) setSelectedClient(match.clientName);
                                                }
                                            }} 
                                            required 
                                            className={sel}
                                        >
                                            <option value="" className="bg-[#0d0f18]">Select recruiter…</option>
                                            {availableEmployees.map(u => <option key={u.id} value={u.name} className="bg-[#0d0f18]">{u.name}</option>)}
                                        </select>
                                    </SelectWrap>
                                    {employeeName && (
                                        <p className="text-xs text-zinc-400 mt-1 font-normal">
                                            Logged leaves for {employeeName}: <span className="text-emerald-400 font-semibold">
                                                {leaves.filter(l => l.employee_name === employeeName).reduce((s, l) => s + Number(l.day_count), 0)} days
                                            </span>
                                        </p>
                                    )}
                                </Field>

                                <Field label="Leave Type">
                                    <SelectWrap>
                                        <select 
                                            value={leaveType} 
                                            onChange={e => {
                                                const val = e.target.value;
                                                setLeaveType(val);
                                                if (val.startsWith('HD-')) {
                                                    setDayCount(0.5);
                                                } else {
                                                    setDayCount(1);
                                                }
                                            }} 
                                            className={sel}
                                        >
                                            {ALL_LEAVE_TYPES.map(t => <option key={t} value={t} className="bg-[#0d0f18]">{t}</option>)}
                                        </select>
                                    </SelectWrap>
                                </Field>

                                {/* Planned + Duration Segmented Controls */}
                                <div className="grid grid-cols-2 gap-3.5">
                                    <div>
                                        <label className={lbl}>Planned?</label>
                                        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-[#121626] p-1">
                                            <button 
                                                type="button" 
                                                onClick={() => setIsPlanned(true)}
                                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${isPlanned ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                Yes
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => setIsPlanned(false)}
                                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${!isPlanned ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lbl}>Duration (per day)</label>
                                        {leaveType === 'Paid Leave' ? (
                                            <input 
                                                type="number" 
                                                min="0"
                                                step="0.5"
                                                value={dayCount} 
                                                onChange={e => setDayCount(Number(e.target.value))}
                                                className={inp}
                                            />
                                        ) : (
                                            <div className="flex rounded-xl overflow-hidden border border-white/10 bg-[#121626] p-1">
                                                <button 
                                                    type="button" 
                                                    onClick={() => setDayCount(1)}
                                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${dayCount === 1 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                >
                                                    Full (1.0)
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setDayCount(0.5)}
                                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${dayCount === 0.5 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                >
                                                    Half (0.5)
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Field label="Reason (optional)">
                                    <input 
                                        type="text" 
                                        value={reason} 
                                        onChange={e => setReason(e.target.value)}
                                        placeholder="e.g. Fever, personal work, vacation…" 
                                        className={inp} 
                                    />
                                </Field>

                                <div className="pt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                                    <span>Logged by</span>
                                    <span className="font-semibold text-zinc-300">{currentUser.name}</span>
                                </div>
                            </form>

                            {/* Drawer Footer */}
                            <div className="px-6 py-4.5 border-t border-white/[0.08] flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={handleSubmit as any} 
                                    disabled={saving || !employeeName}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all disabled:opacity-40"
                                >
                                    {saving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : editingId ? (
                                        <><Edit2 size={14} /> Update Record</> 
                                    ) : creationMode === 'range' ? (
                                        <><CalendarRange size={14} /> Save {calculatedRangeDates.length} Days</>
                                    ) : (
                                        <><Plus size={14} /> Save Record</>
                                    )}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={cancelEdit}
                                    className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-sm font-semibold transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Bulk Edit Drawer ────────────────────────────────────────── */}
            <AnimatePresence>
                {bulkDrawerOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                            onClick={() => setBulkDrawerOpen(false)} 
                        />
                        
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }} 
                            animate={{ x: 0, opacity: 1 }} 
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
                            className="fixed right-0 top-0 bottom-0 z-50 w-[480px] bg-[#0c0e18] border-l border-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08]">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-extrabold text-base text-zinc-100">Bulk Edit Records</p>
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
                                            {selectedIds.length} records
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        Batch update selected leave entries
                                    </p>
                                </div>
                                <button type="button" onClick={() => setBulkDrawerOpen(false)} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                                <div className="p-3.5 rounded-xl bg-[#121626] border border-white/10 space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Selected Target Entries ({selectedIds.length})</p>
                                    <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                                        {selectedRecords.map(r => (
                                            <div key={r.id} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-black/40 border border-white/5">
                                                <span className="font-medium text-zinc-200 truncate max-w-[200px]">{r.employee_name}</span>
                                                <span className="font-mono text-xs text-zinc-400">{fmtDate(r.date)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Field 1: Leave Type */}
                                <div className="space-y-2 p-3.5 rounded-xl bg-[#121626] border border-white/10">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={updateLeaveType}
                                            onChange={e => setUpdateLeaveType(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                        />
                                        <span className="text-xs font-semibold text-zinc-200">Update Leave Type</span>
                                    </label>

                                    {updateLeaveType && (
                                        <SelectWrap>
                                            <select value={bulkLeaveType} onChange={e => setBulkLeaveType(e.target.value)} className={sel}>
                                                {ALL_LEAVE_TYPES.map(t => <option key={t} value={t} className="bg-[#0d0f18]">{t}</option>)}
                                            </select>
                                        </SelectWrap>
                                    )}
                                </div>

                                {/* Field 2: Planned Status */}
                                <div className="space-y-2 p-3.5 rounded-xl bg-[#121626] border border-white/10">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={updatePlanned}
                                            onChange={e => setUpdatePlanned(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                        />
                                        <span className="text-xs font-semibold text-zinc-200">Update Planned Status</span>
                                    </label>

                                    {updatePlanned && (
                                        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-black/30 p-1">
                                            <button 
                                                type="button" 
                                                onClick={() => setBulkIsPlanned(true)}
                                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${bulkIsPlanned ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                Yes
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => setBulkIsPlanned(false)}
                                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${!bulkIsPlanned ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                No
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Field 3: Duration */}
                                <div className="space-y-2 p-3.5 rounded-xl bg-[#121626] border border-white/10">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={updateDuration}
                                            onChange={e => setUpdateDuration(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                        />
                                        <span className="text-xs font-semibold text-zinc-200">Update Duration</span>
                                    </label>

                                    {updateDuration && (
                                        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-black/30 p-1">
                                            <button 
                                                type="button" 
                                                onClick={() => setBulkDayCount(1)}
                                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${bulkDayCount === 1 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                Full Day (1.0)
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => setBulkDayCount(0.5)}
                                                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${bulkDayCount === 0.5 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                Half Day (0.5)
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Field 4: Reason */}
                                <div className="space-y-2 p-3.5 rounded-xl bg-[#121626] border border-white/10">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={updateReason}
                                            onChange={e => setUpdateReason(e.target.checked)}
                                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                        />
                                        <span className="text-xs font-semibold text-zinc-200">Update Reason</span>
                                    </label>

                                    {updateReason && (
                                        <input
                                            type="text"
                                            value={bulkReason}
                                            onChange={e => setBulkReason(e.target.value)}
                                            placeholder="e.g. Approved leave, emergency, etc."
                                            className={inp}
                                        />
                                    )}
                                </div>
                            </form>

                            {/* Drawer Footer */}
                            <div className="px-6 py-4.5 border-t border-white/[0.08] flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleBulkSubmit as any}
                                    disabled={bulkSaving || (!updateLeaveType && !updatePlanned && !updateDuration && !updateReason)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all disabled:opacity-40"
                                >
                                    {bulkSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <><Check size={14} /> Apply to {selectedIds.length} Records</>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBulkDrawerOpen(false)}
                                    className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-sm font-semibold transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
