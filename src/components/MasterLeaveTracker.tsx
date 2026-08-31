'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileSpreadsheet, Plus, Trash2, Download, CheckCircle,
    Edit2, X, ChevronDown, ChevronUp, CalendarCheck2,
    AlertCircle, Search,
    ChevronLeft, ChevronRight,
    CheckSquare, Square, MinusSquare, Sliders, CalendarRange, Sparkles, Check
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

/** Convert ISO date string (YYYY-MM-DD) → DD-Mon-YY, e.g. "07-Jan-25" */
function fmtDate(iso: string): string {
    if (!iso) return '';
    const [yr, mo, dy] = iso.split('-');
    return `${dy}-${MONTHS[parseInt(mo, 10) - 1] || 'Jan'}-${yr ? yr.slice(2) : ''}`;
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
    'Sick Leave': { dot: '#a78bfa', text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/30', glow: 'rgba(167,139,250,0.4)' },
    'HD-Sick': { dot: '#c4b5fd', text: 'text-violet-200', bg: 'bg-violet-500/10', border: 'border-violet-500/30', glow: 'rgba(196,181,253,0.4)' },
    'Casual Leave': { dot: '#60a5fa', text: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-500/30', glow: 'rgba(96,165,250,0.4)' },
    'HD-Casual': { dot: '#93c5fd', text: 'text-sky-200', bg: 'bg-sky-500/10', border: 'border-sky-500/30', glow: 'rgba(147,197,253,0.4)' },
    'LWP': { dot: '#f87171', text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/35', glow: 'rgba(248,113,113,0.4)' },
    'HD-LWP': { dot: '#fb7185', text: 'text-rose-200', bg: 'bg-rose-500/15', border: 'border-rose-500/35', glow: 'rgba(251,113,133,0.4)' },
    'HD-Sick Room': { dot: '#c084fc', text: 'text-purple-300', bg: 'bg-purple-500/10', border: 'border-purple-500/30', glow: 'rgba(192,132,252,0.4)' },
    'LWP-Doc not Received': { dot: '#ef4444', text: 'text-red-300', bg: 'bg-red-500/20', border: 'border-red-500/40', glow: 'rgba(239,68,68,0.4)' },
    'Paternity': { dot: '#e879f9', text: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', glow: 'rgba(232,121,249,0.4)' },
    'Paid Leave': { dot: '#34d399', text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/35', glow: 'rgba(52,211,153,0.4)' },
    'System: Absent': { dot: '#fbbf24', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/35', glow: 'rgba(251,191,36,0.5)' },
    'System: Half-Day': { dot: '#fbbf24', text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/35', glow: 'rgba(251,191,36,0.5)' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypeBadge({ type, isSmart }: { type: string, isSmart?: boolean }) {
    const m = LEAVE_META[type] ?? LEAVE_META['Casual Leave'];
    return (
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wider uppercase border shadow-sm ${m.text} ${m.bg} ${m.border}`}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.dot, boxShadow: `0 0 8px ${m.glow}` }} />
            <span className="truncate">{type}</span>
        </span>
    );
}

function StatCard({ label, value, sub, color, accent, active }: { label: string; value: string | number; sub?: string; color: string; accent: string; active?: boolean; }) {
    return (
        <div className={`relative flex flex-col panel-3d px-5 py-4 overflow-hidden transition-all duration-300 group ${active ? 'border-white/20 ring-1 ring-white/10' : 'hover:brightness-110'}`}>
            {/* Colored top accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${accent} ${active ? 'opacity-100' : 'opacity-80'}`} />
            {active && <div className={`absolute -right-4 -top-4 w-12 h-12 ${accent} opacity-10 blur-2xl rounded-full`} />}
            <p className={`text-3xl font-black tabular-nums tracking-tighter leading-none mt-2 ${color}`}>{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">{label}</p>
            {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
        </div>
    );
}

// ─── Label / Input tokens ─────────────────────────────────────────────────────
const lbl = "block text-[11px] font-black tracking-[0.14em] uppercase text-slate-400 mb-2";
const inp = "w-full bg-[#121626] border border-white/10 rounded-xl py-3 px-3.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all placeholder:text-slate-600 color-scheme-dark shadow-inner font-semibold";
const sel = `${inp} appearance-none pr-9 cursor-pointer`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className={lbl}>{label}</label>{children}</div>;
}
function SelectWrap({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative">
            {children}
            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MasterLeaveTracker({ currentUser }: { currentUser: User }) {
    const { success, error: toastError } = useToast();

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
    // Separate Year + Month filters for flexible date range
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'Date', dir: 'desc' });

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

    // Load leaves on page / filter change
    useEffect(() => {
        loadLeavesPage(false, currentPage);
    }, [currentPage, filterClient, filterEmployee, filterLeaveType, search, filterYear, filterMonth, sortConfig]);

    async function loadLeavesPage(force = false, targetPage = currentPage) {
        setLoading(true);
        try {
            const page = force ? 1 : targetPage;
            const filters = {
                clientName: filterClient.length > 0 ? filterClient : undefined,
                employeeName: filterEmployee.length > 0 ? filterEmployee : undefined,
                leaveType: filterLeaveType.length > 0 ? filterLeaveType : undefined,
                search: search || undefined,
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
        
        // Always guarantee that if employeeName is set (e.g. while editing or pre-selected), it exists in the list!
        const names = new Set(pool.map(u => u.name));
        if (employeeName && !names.has(employeeName)) {
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
        // If a recruiter/employee is already filtered at the top, pre-select them automatically!
        if (filterEmployee.length > 0) {
            const empName = filterEmployee[0];
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

    // Dynamic list of dates calculated for range creation
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

    // Bulk action handlers
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

    const availableYears = useMemo(() => {
        const years = new Set(leaves.map(l => l.date.slice(0, 4)));
        // Ensure common years are present if they exist in UI context
        ['2025', '2026', '2027'].forEach(y => years.add(y));
        return [...years].sort().reverse();
    }, [leaves]);

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

    // Unique employee names scoped to selected clients (for filter dropdown)
    const filterableEmployees = useMemo(() => {
        const pool = filterClient.length > 0
            ? allUsers.filter(u => filterClient.includes(u.clientName)).map(u => u.name)
            : allUsers.map(u => u.name);
        return [...new Set(pool)].sort();
    }, [allUsers, filterClient]);

    const totalPages = Math.max(1, Math.ceil(totalLeaves / LEAVE_PAGE_SIZE));
    const pageStart = totalLeaves === 0 ? 0 : ((currentPage - 1) * LEAVE_PAGE_SIZE) + 1;
    const pageEnd = totalLeaves === 0 ? 0 : pageStart + leaves.length - 1;

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

    // Summary of selected records for bulk edit drawer
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

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                        <FileSpreadsheet size={18} className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight">Leave Management</h1>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium tracking-wide">Attendance, history, and active leaves</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleExport} disabled={visibleLeaves.length === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 text-xs font-semibold hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none">
                        <Download size={14} /> Export CSV
                    </button>
                    <button onClick={openNew}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-black text-xs font-bold tracking-wide hover:bg-emerald-400 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_12px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-[0.98]">
                        <Plus size={15} /> New Record
                    </button>
                </div>
            </div>

            {/* ── Stats Row — KPI tiles ───────────────────────────────────── */}
            <div className="grid grid-cols-5 gap-3">
                <StatCard label="Total Leaves" value={totalDays.toFixed(1)} color="text-emerald-400" accent="bg-emerald-500" sub="days taken" />
                <StatCard label="Sick Leaves" value={sickCount.toFixed(1)} color="text-violet-400" accent="bg-violet-500" sub="health issues" />
                <StatCard label="Casual Leaves" value={casualCount.toFixed(1)} color="text-blue-400" accent="bg-blue-500" sub="personal & vacation" />
                <StatCard label="LWP Days" value={lwpCount.toFixed(1)} color={lwpCount > 0 ? 'text-red-500' : 'text-slate-500'} accent={lwpCount > 0 ? 'bg-red-900' : 'bg-slate-800'} sub="leave without pay" />
                <StatCard label="Unplanned" value={unplanned} color={unplanned > 0 ? 'text-amber-400' : 'text-slate-500'} accent={unplanned > 0 ? 'bg-amber-500' : 'bg-slate-800'} sub="records missing notice" />
            </div>

            {/* ── Unified Filter Bar ─────────────────────────────────────── */}
            <div className="panel-3d rounded-2xl shadow-lg z-20 relative">
                <div className="flex items-center gap-3 p-3 flex-wrap">
                    {/* Year Selector */}
                    <CustomSelect
                        options={availableYears.map(yr => ({ value: yr, label: yr }))}
                        value={filterYear}
                        onChange={(val) => { setFilterYear(val); if (!val) setFilterMonth(''); }}
                        placeholder="All Years"
                        className="min-w-[120px]"
                    />

                    {/* Month Selector */}
                    <CustomSelect
                        options={['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => ({
                            value: m,
                            label: new Date(2000, Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long' })
                        }))}
                        value={filterMonth}
                        onChange={setFilterMonth}
                        placeholder="All Months"
                        className={`min-w-[140px] ${!filterYear ? 'opacity-40 pointer-events-none' : ''}`}
                    />

                    <div className="w-px h-6 bg-white/10 flex-shrink-0" />

                    {/* Client Multi-Select */}
                    <CustomSelect
                        multi
                        options={clients.map(c => ({ value: c.name, label: c.name }))}
                        value={filterClient}
                        onChange={(vals) => { setFilterClient(vals); setFilterEmployee([]); }}
                        placeholder="All Clients"
                        searchable={clients.length > 5}
                        className="min-w-[170px] max-w-[240px]"
                    />

                    {/* Employee Multi-Select */}
                    <CustomSelect
                        multi
                        options={filterableEmployees.map(n => ({ value: n, label: n }))}
                        value={filterEmployee}
                        onChange={setFilterEmployee}
                        placeholder="All Employees"
                        searchable={filterableEmployees.length > 5}
                        className="min-w-[170px] max-w-[240px]"
                    />

                    {/* Leave Type Selector */}
                    <CustomSelect
                        multi
                        options={ALL_LEAVE_TYPES.map(lt => ({ value: lt, label: lt }))}
                        value={filterLeaveType}
                        onChange={setFilterLeaveType}
                        placeholder="All Leave Types"
                        searchable
                        className="min-w-[170px] max-w-[240px]"
                    />

                    <div className="w-px h-6 bg-white/10 flex-shrink-0" />

                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 transition-all font-semibold" />
                        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"><X size={12} /></button>}
                    </div>
                </div>

                {/* Active Filters + Match Count */}
                {hasFilter && (
                <div className="flex items-center justify-between px-3 pb-2.5 pt-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        {filterYear && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                                {filterYear}{filterMonth ? ` · ${new Date(2000, Number(filterMonth) - 1, 1).toLocaleDateString('en-US', { month: 'short' })}` : ''}
                                <button onClick={() => { setFilterYear(''); setFilterMonth(''); }} className="hover:text-white transition-colors"><X size={10} /></button>
                            </span>
                        )}
                        {filterClient.map(c => (
                            <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] font-black text-violet-400 uppercase tracking-wider">
                                {c}
                                <button onClick={() => { setFilterClient(filterClient.filter(x => x !== c)); setFilterEmployee([]); }} className="hover:text-white transition-colors"><X size={10} /></button>
                            </span>
                        ))}
                        {filterEmployee.map(emp => (
                            <span key={emp} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                                {emp}
                                <button onClick={() => setFilterEmployee(filterEmployee.filter(x => x !== emp))} className="hover:text-white transition-colors"><X size={10} /></button>
                            </span>
                        ))}
                        {filterLeaveType.map(lt => (
                            <span key={lt} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-400 uppercase tracking-wider">
                                {lt}
                                <button onClick={() => setFilterLeaveType(filterLeaveType.filter(x => x !== lt))} className="hover:text-white transition-colors"><X size={10} /></button>
                            </span>
                        ))}
                        {(filterClient.length > 0 || filterEmployee.length > 0 || filterLeaveType.length > 0 || search || filterYear) && (
                            <button onClick={() => { setFilterClient([]); setFilterEmployee([]); setFilterLeaveType([]); setSearch(''); setFilterYear(''); setFilterMonth(''); }}
                                className="flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10">
                                <X size={10} /> Reset All
                            </button>
                        )}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex-shrink-0 ml-3">
                        {visibleLeaves.length} record{visibleLeaves.length !== 1 ? 's' : ''}
                    </span>
                </div>
                )}
            </div>

            {/* ── Table ───────────────────────────────────────────────────── */}
            <div className="rounded-[2.2rem] bg-[#090b14]/90 backdrop-blur-2xl border border-white/[0.08] p-6 shadow-[0_25px_70px_rgba(0,0,0,0.65)] overflow-hidden">
                <div className="overflow-x-auto pb-4">
                    <div className="min-w-[1180px] flex flex-col gap-3.5">
                        {/* Headers */}
                        <div className="grid grid-cols-[48px_115px_minmax(190px,2fr)_minmax(140px,1.2fr)_minmax(180px,1.4fr)_105px_105px_minmax(200px,2fr)_120px_90px] gap-3 px-6 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] items-center">
                            {/* Master Checkbox */}
                            <div className="flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-all hover:bg-white/5 focus:outline-none"
                                    title={isAllVisibleSelected ? "Deselect all on page" : "Select all on page"}
                                >
                                    {isAllVisibleSelected ? (
                                        <CheckSquare size={18} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
                                    ) : isSomeVisibleSelected ? (
                                        <MinusSquare size={18} className="text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                    ) : (
                                        <Square size={18} className="text-slate-500 hover:text-slate-300" />
                                    )}
                                </button>
                            </div>

                            {['Date', 'Employee', 'Client', 'Leave Type', 'Duration', 'Planned', 'Reason', 'Logged by'].map(h => (
                                <button key={h} onClick={() => {
                                    if (sortConfig.key === h) setSortConfig({ key: h, dir: sortConfig.dir === 'asc' ? 'desc' : 'asc' });
                                    else setSortConfig({ key: h, dir: 'asc' });
                                }} className="flex items-center gap-1.5 text-xs font-black tracking-[0.14em] uppercase text-slate-400 hover:text-white transition-colors outline-none cursor-pointer group text-left">
                                    {h}
                                    <span className="flex flex-col opacity-0 group-hover:opacity-70 transition-opacity" style={{ opacity: sortConfig.key === h ? 1 : undefined }}>
                                        <ChevronUp size={11} className={`-mb-1 transition-colors ${sortConfig.key === h && sortConfig.dir === 'asc' ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]' : ''}`} />
                                        <ChevronDown size={11} className={`transition-colors ${sortConfig.key === h && sortConfig.dir === 'desc' ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]' : ''}`} />
                                    </span>
                                </button>
                            ))}
                            <div className="text-xs font-black tracking-[0.14em] uppercase text-slate-400 text-right pr-2">Actions</div>
                        </div>

                        {/* Body Slots: System Alerts */}
                        {currentPage === 1 && filteredSmartLeaves.length > 0 && !loading && (
                            <div className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4 shadow-[0_0_25px_rgba(245,158,11,0.06)]">
                                <div className="mb-3.5 flex items-center justify-between gap-3 px-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                                        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-400">System Auto-Detected Leave Exceptions</p>
                                    </div>
                                    <span className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-300 shadow-sm">
                                        {filteredSmartLeaves.length} alert{filteredSmartLeaves.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {filteredSmartLeaves.map((l) => {
                                        const isSelected = selectedIds.includes(l.id);
                                        return (
                                            <div key={l.id} className={`grid grid-cols-[48px_115px_minmax(190px,2fr)_minmax(140px,1.2fr)_minmax(180px,1.4fr)_105px_105px_minmax(200px,2fr)_120px_90px] gap-3 px-6 py-4 items-center rounded-2xl border transition-all duration-200
                                                ${isSelected ? 'border-amber-500/60 bg-amber-500/[0.14] shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/40' : 'border-amber-500/20 bg-black/40 hover:bg-black/60'}`}>
                                                
                                                {/* Checkbox */}
                                                <div className="flex items-center justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSelect(l.id)}
                                                        className="p-1.5 rounded-lg transition-colors hover:bg-amber-500/10"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare size={18} className="text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
                                                        ) : (
                                                            <Square size={18} className="text-slate-500 hover:text-slate-300" />
                                                        )}
                                                    </button>
                                                </div>

                                                <div className="font-mono text-xs font-bold text-slate-200 tracking-wider uppercase">{fmtDate(l.date)}</div>
                                                
                                                <div className="flex items-center gap-3.5 min-w-0">
                                                    <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 text-xs font-black text-amber-300 flex items-center justify-center flex-shrink-0 shadow-inner">
                                                        {l.employee_name[0]}
                                                    </span>
                                                    <span className="text-sm font-bold text-white truncate tracking-tight">{l.employee_name}</span>
                                                </div>

                                                <div className="min-w-0">
                                                    <span className="inline-block max-w-full truncate text-[11px] font-bold uppercase tracking-wider text-slate-300 bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-xl shadow-inner">{l.client_name}</span>
                                                </div>

                                                <div><TypeBadge type={l.leave_type} isSmart /></div>

                                                <div>
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase border shadow-sm ${l.day_count === 1 ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
                                                        {l.day_count === 1 ? 'Full' : 'Half'}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="inline-flex items-center gap-1.5 text-amber-300 text-xs uppercase tracking-wider font-black bg-amber-500/15 px-3 py-1 rounded-xl border border-amber-500/30 shadow-sm">
                                                        <AlertCircle size={12} /> Auto
                                                    </span>
                                                </div>

                                                <div className="min-w-0 text-slate-300 text-xs font-medium truncate" title={l.reason || ''}>
                                                    <span className="text-amber-400/90 text-xs font-bold">{(l.reason || '').replace(/System Auto-Generated:\s*/i, '').replace(/No punch-in recorded/i, 'No Punch In').replace(/Half-Day/i, 'Less Hours')}</span>
                                                </div>

                                                <div className="truncate text-slate-400 text-xs font-bold">
                                                    <span className="text-indigo-400/80 italic font-semibold">System Gen</span>
                                                </div>

                                                <div className="flex items-center justify-end gap-2 w-full">
                                                    <button onClick={() => startEdit(l)} title="Approve & Save"
                                                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:scale-105 active:scale-95">
                                                        <CheckCircle size={15} />
                                                    </button>
                                                    <button onClick={() => void declineSmartLeave(l)} title="Decline"
                                                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-[0_0_12px_rgba(225,29,72,0.15)] hover:scale-105 active:scale-95">
                                                        <X size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Standard Records */}
                        {loading ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-3.5">
                                <div className="w-8 h-8 border-3 border-white/10 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                                <p className="text-xs font-bold tracking-widest uppercase text-slate-400">Loading leave records…</p>
                            </div>
                        ) : leaves.length === 0 && filteredSmartLeaves.length === 0 ? (
                            <div className="py-28 flex flex-col items-center justify-center gap-4">
                                <div className="w-16 h-16 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-inner">
                                    <CalendarCheck2 size={30} className="text-slate-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-base font-black text-slate-300 tracking-wide">No records found</p>
                                    <p className="text-xs font-medium text-slate-500 mt-1.5">{search || hasFilter ? 'Try adjusting your search or active filters' : 'Click "New Record" to add the first leave entry'}</p>
                                </div>
                                {(search || hasFilter) && (
                                    <button onClick={() => { setSearch(''); setFilterClient([]); setFilterEmployee([]); setFilterLeaveType([]); setFilterYear(''); setFilterMonth(''); }}
                                        className="text-xs uppercase tracking-widest text-indigo-400 hover:text-indigo-300 font-black transition-colors px-5 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25">
                                        Reset all filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {leaves.map((l) => {
                                    const isSelected = selectedIds.includes(l.id);
                                    return (
                                        <motion.div key={l.id}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
                                            transition={{ duration: 0.2 }}
                                            className={`grid grid-cols-[48px_115px_minmax(190px,2fr)_minmax(140px,1.2fr)_minmax(180px,1.4fr)_105px_105px_minmax(200px,2fr)_120px_90px] gap-3 px-6 py-4.5 items-center rounded-2xl transition-all duration-200 group cursor-default
                                                ${editingId === l.id ? 'bg-amber-500/[0.12] border border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/30' 
                                                : isSelected ? 'bg-gradient-to-r from-indigo-600/[0.18] via-purple-600/[0.08] to-transparent border border-indigo-500/60 shadow-[0_0_30px_rgba(99,102,241,0.22)] ring-1 ring-indigo-500/40' 
                                                : 'bg-[#0e1220]/75 border border-white/[0.06] hover:bg-[#151a2e] hover:border-indigo-500/30 hover:shadow-[0_6px_30px_rgba(0,0,0,0.5)] hover:scale-[1.002]'}`}>
                                            
                                            {/* Checkbox */}
                                            <div className="flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSelect(l.id)}
                                                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare size={18} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
                                                    ) : (
                                                        <Square size={18} className="text-slate-500 hover:text-slate-300" />
                                                    )}
                                                </button>
                                            </div>

                                            {/* Date */}
                                            <div className="font-mono text-xs font-bold text-slate-200 tracking-wider uppercase">{fmtDate(l.date)}</div>
                                            
                                            {/* Employee */}
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/15 text-xs font-black text-white flex items-center justify-center flex-shrink-0 shadow-inner">
                                                    {l.employee_name[0]}
                                                </span>
                                                <span className="text-sm font-bold text-white truncate tracking-tight group-hover:text-indigo-200 transition-colors">{l.employee_name}</span>
                                            </div>

                                            {/* Client */}
                                            <div className="min-w-0">
                                                <span className="inline-block max-w-full truncate text-[11px] font-bold uppercase tracking-wider text-slate-300 bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-xl shadow-inner">{l.client_name}</span>
                                            </div>

                                            {/* Leave Type */}
                                            <div><TypeBadge type={l.leave_type} isSmart={(l as any).is_smart} /></div>

                                            {/* Duration */}
                                            <div>
                                                <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase border shadow-sm ${l.day_count === 1 ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
                                                    {l.day_count === 1 ? 'Full' : 'Half'}
                                                </span>
                                            </div>

                                            {/* Planned */}
                                            <div>
                                                {(l as any).is_smart ? (
                                                    <span className="inline-flex items-center gap-1.5 text-amber-300 text-xs uppercase tracking-wider font-black bg-amber-500/15 px-3 py-1 rounded-xl border border-amber-500/30 shadow-sm"><AlertCircle size={12} /> Auto</span>
                                                ) : l.is_planned
                                                    ? <span className="inline-flex items-center gap-1.5 text-emerald-300 text-xs uppercase tracking-wider font-bold bg-emerald-500/15 px-3 py-1 rounded-xl border border-emerald-500/30 shadow-sm"><CheckCircle size={12} /> Yes</span>
                                                    : <span className="inline-flex items-center gap-1.5 text-rose-300 text-xs uppercase tracking-wider font-bold bg-rose-500/15 px-3 py-1 rounded-xl border border-rose-500/30 shadow-sm"><AlertCircle size={12} /> No</span>}
                                            </div>

                                            {/* Reason */}
                                            <div className="min-w-0 text-slate-300 text-xs font-medium truncate" title={l.reason || ''}>
                                                {(l as any).is_smart ? (
                                                    <span className="text-amber-400/90 text-xs font-bold">{(l.reason || '').replace(/System Auto-Generated:\s*/i, '').replace(/No punch-in recorded/i, 'No Punch In').replace(/Half-Day/i, 'Less Hours')}</span>
                                                ) : (
                                                    l.reason ? <span className="text-slate-200">{l.reason}</span> : <span className="text-slate-600 font-bold">—</span>
                                                )}
                                            </div>

                                            {/* Logged by */}
                                            <div className="truncate text-slate-400 text-xs font-bold">
                                                {(l as any).is_smart ? <span className="text-indigo-400/80 italic font-semibold">System Gen</span> : l.approver}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center justify-end gap-2 w-full">
                                                {(l as any).is_smart && (
                                                    <>
                                                        <button onClick={() => startEdit(l)} title="Approve & Save"
                                                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:scale-105 active:scale-95">
                                                            <CheckCircle size={15} />
                                                        </button>
                                                        <button onClick={() => declineSmartLeave(l)} title="Decline"
                                                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-[0_0_12px_rgba(225,29,72,0.15)] hover:scale-105 active:scale-95">
                                                            <X size={15} />
                                                        </button>
                                                    </>
                                                )}
                                                {!(l as any).is_smart && (
                                                    <button onClick={() => startEdit(l)} title="Edit Record"
                                                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300 transition-all shadow-sm hover:scale-105 active:scale-95">
                                                        <Edit2 size={13} />
                                                    </button>
                                                )}
                                                {!(l as any).is_smart && (
                                                    <button onClick={() => setDeleteId(l.id)} title="Delete Record"
                                                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-300 transition-all shadow-sm hover:scale-105 active:scale-95">
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        )}
                    </div>
                </div>

                {/* Table Footer */}
                {visibleLeaves.length > 0 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-black/20 mt-3 rounded-2xl">
                        <p className="text-xs text-slate-400 font-semibold">
                            {displayedLeaves.length} records · {uniqueEmpls} {uniqueEmpls === 1 ? 'employee' : 'employees'}
                        </p>
                        <div className="flex items-center gap-5">
                            <p className="text-xs text-slate-400 font-semibold">
                                <span className="text-emerald-400 font-black">{totalDays}</span> total days
                            </p>
                            {lwpCount > 0 && (
                                <p className="text-xs font-semibold">
                                    <span className="text-rose-400 font-black">{lwpCount}</span> <span className="text-slate-400">LWP</span>
                                </p>
                            )}
                            <p className="text-xs text-slate-400 font-semibold">
                                Page <span className="text-white font-black">{currentPage}</span> of <span className="text-white font-black">{totalPages}</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    disabled={currentPage === 1 || loading}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-bold text-slate-300 transition-all disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 hover:text-white"
                                >
                                    <ChevronLeft size={14} /> Prev
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                    disabled={currentPage >= totalPages || loading}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-bold text-slate-300 transition-all disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 hover:text-white"
                                >
                                    Next <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Floating Action Dock (HUD) ────────────────── */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3.5 rounded-2xl bg-[#0b0e1b]/95 backdrop-blur-2xl border border-indigo-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(99,102,241,0.3)] ring-1 ring-white/15"
                    >
                        <div className="flex items-center gap-3 pr-4 border-r border-white/15">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.9)]" />
                            <span className="text-xs font-black text-white tracking-wide">
                                {selectedIds.length} <span className="text-slate-400 font-medium">{selectedIds.length === 1 ? 'record' : 'records'} selected</span>
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setBulkDrawerOpen(true)}
                            className="flex items-center gap-2 px-4.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white text-xs font-black shadow-[0_0_20px_rgba(99,102,241,0.5)] hover:brightness-110 active:scale-95 transition-all"
                        >
                            <Sliders size={14} /> Bulk Edit
                        </button>

                        <button
                            type="button"
                            onClick={() => setBulkDeleteConfirm(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 hover:bg-rose-500/25 hover:text-white text-xs font-bold active:scale-95 transition-all"
                        >
                            <Trash2 size={14} /> Delete
                        </button>

                        <button
                            type="button"
                            onClick={clearSelection}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Clear selection"
                        >
                            <X size={15} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Single Record / Date Range Form Drawer ──────────────────── */}
            <AnimatePresence>
                {drawerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
                            onClick={cancelEdit} />
                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
                            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
                            className="fixed right-0 top-0 bottom-0 z-50 w-[500px] bg-[#0a0c16] border-l border-white/10 shadow-[0_0_90px_rgba(0,0,0,0.9)] flex flex-col">

                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.08] bg-white/[0.01]">
                                <div>
                                    <p className={`font-black text-base ${editingId ? 'text-amber-400' : 'text-white'}`}>
                                        {editingId ? 'Edit Leave Record' : 'Record New Leave'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 font-bold tracking-wider uppercase">
                                        {editingId ? 'Update existing leave entry' : 'Add new entry to leave tracker'}
                                    </p>
                                </div>
                                <button onClick={cancelEdit} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
                                {/* Mode Selector (Single Day vs Date Range) */}
                                {!editingId && (
                                    <div className="p-1.5 rounded-2xl bg-[#121626] border border-white/10 flex gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setCreationMode('single')}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2
                                                ${creationMode === 'single' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            Single Day
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCreationMode('range')}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2
                                                ${creationMode === 'range' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400 hover:text-slate-200'}`}
                                        >
                                            <CalendarRange size={14} /> Date Range
                                        </button>
                                    </div>
                                )}

                                {/* Date Fields */}
                                {creationMode === 'single' || editingId ? (
                                    <Field label="Date">
                                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={inp} />
                                    </Field>
                                ) : (
                                    <div className="space-y-3.5 p-4 rounded-2xl bg-indigo-500/[0.05] border border-indigo-500/20">
                                        <div className="grid grid-cols-2 gap-3.5">
                                            <Field label="Start Date">
                                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={inp} />
                                            </Field>
                                            <Field label="End Date">
                                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className={inp} />
                                            </Field>
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <label className="flex items-center gap-2.5 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={skipWeekends}
                                                    onChange={e => setSkipWeekends(e.target.checked)}
                                                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                                />
                                                <span className="text-xs text-slate-300 font-semibold">Skip Weekends (Sat/Sun)</span>
                                            </label>

                                            <span className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-xl border border-indigo-500/30">
                                                <Sparkles size={12} /> {calculatedRangeDates.length} working days
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <Field label="Client">
                                    <SelectWrap>
                                        <select value={selectedClient} onChange={e => { setSelectedClient(e.target.value); }} required className={sel}>
                                            <option value="" className="bg-[#0d0f18]">Select client…</option>
                                            {clients.map(c => <option key={c.id} value={c.name} className="bg-[#0d0f18]">{c.name}</option>)}
                                        </select>
                                    </SelectWrap>
                                </Field>

                                <Field label="Employee / Recruiter">
                                    <SelectWrap>
                                        <select value={employeeName} onChange={e => setEmployeeName(e.target.value)} required className={sel}>
                                            <option value="" className="bg-[#0d0f18]">Select recruiter…</option>
                                            {availableEmployees.map(u => <option key={u.id} value={u.name} className="bg-[#0d0f18]">{u.name}</option>)}
                                        </select>
                                    </SelectWrap>
                                    {employeeName && (
                                        <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                                            Logged leaves for {employeeName}: <span className="text-emerald-400 font-bold">
                                                {leaves.filter(l => l.employee_name === employeeName).reduce((s, l) => s + Number(l.day_count), 0)} days
                                            </span>
                                        </p>
                                    )}
                                </Field>

                                <Field label="Leave Type">
                                    <SelectWrap>
                                        <select value={leaveType} onChange={e => {
                                            const val = e.target.value;
                                            setLeaveType(val);
                                            if (val.startsWith('HD-')) {
                                                setDayCount(0.5);
                                            } else {
                                                setDayCount(1);
                                            }
                                        }} className={sel}>
                                            {ALL_LEAVE_TYPES.map(t => <option key={t} value={t} className="bg-[#0d0f18]">{t}</option>)}
                                        </select>
                                    </SelectWrap>
                                </Field>

                                {/* Planned + Duration — Segmented Controls */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={lbl}>Planned?</label>
                                        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-[#121626] p-1">
                                            <button type="button" onClick={() => setIsPlanned(true)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all ${isPlanned ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}>Yes</button>
                                            <button type="button" onClick={() => setIsPlanned(false)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all ${!isPlanned ? 'bg-rose-500/25 text-rose-300 border border-rose-500/30' : 'text-slate-500 hover:text-slate-300'}`}>No</button>
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
                                                <button type="button" onClick={() => setDayCount(1)}
                                                    className={`flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all ${dayCount === 1 ? 'bg-sky-500/25 text-sky-300 border border-sky-500/30' : 'text-slate-500 hover:text-slate-300'}`}>Full (1.0)</button>
                                                <button type="button" onClick={() => setDayCount(0.5)}
                                                    className={`flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all ${dayCount === 0.5 ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300'}`}>Half (0.5)</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Field label="Reason (optional)">
                                    <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                                        placeholder="e.g. Fever, personal work, vacation…" className={inp} />
                                </Field>

                                <div className="pt-2 flex items-center gap-2">
                                    <span className="text-xs text-slate-500">Logged by</span>
                                    <span className="text-xs font-bold text-slate-300">{currentUser.name}</span>
                                </div>
                            </form>

                            {/* Drawer Footer */}
                            <div className="px-7 py-5 border-t border-white/[0.08] flex gap-3.5 bg-white/[0.01]">
                                <motion.button type="button" onClick={handleSubmit as any} disabled={saving || !employeeName}
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black tracking-wide transition-all disabled:opacity-40 shadow-lg
                                        ${editingId ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}>
                                    {saving
                                        ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        : editingId ? <><Edit2 size={16} /> Update Record</> 
                                        : creationMode === 'range' ? <><CalendarRange size={16} /> Save {calculatedRangeDates.length} Days</>
                                        : <><Plus size={16} /> Save Record</>}
                                </motion.button>
                                <button type="button" onClick={cancelEdit}
                                    className="px-6 py-3 rounded-xl border border-white/10 text-slate-300 text-sm font-bold hover:text-white hover:border-white/20 transition-all">
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
                        {/* Backdrop */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
                            onClick={() => setBulkDrawerOpen(false)} />
                        
                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
                            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
                            className="fixed right-0 top-0 bottom-0 z-50 w-[500px] bg-[#0a0c16] border-l border-white/10 shadow-[0_0_90px_rgba(0,0,0,0.9)] flex flex-col">

                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.08] bg-white/[0.01]">
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <p className="font-black text-base text-indigo-400">Bulk Edit Records</p>
                                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-xs font-black text-indigo-300 border border-indigo-500/30">
                                            {selectedIds.length} records
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 font-bold tracking-wider uppercase">
                                        Batch update selected leave entries
                                    </p>
                                </div>
                                <button onClick={() => setBulkDrawerOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
                                {/* Selected items snippet preview */}
                                <div className="p-4 rounded-2xl bg-[#121626] border border-white/10 space-y-2.5">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Selected Target Entries ({selectedIds.length})</p>
                                    <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                                        {selectedRecords.map(r => (
                                            <div key={r.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-black/50 border border-white/5">
                                                <span className="font-bold text-white truncate max-w-[200px]">{r.employee_name}</span>
                                                <span className="text-xs font-mono font-semibold text-slate-300">{fmtDate(r.date)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Field 1: Leave Type */}
                                <div className="space-y-2.5 p-4 rounded-2xl bg-[#121626] border border-white/10">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={updateLeaveType}
                                                onChange={e => setUpdateLeaveType(e.target.checked)}
                                                className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                            />
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">Update Leave Type</span>
                                        </label>
                                    </div>

                                    {updateLeaveType && (
                                        <SelectWrap>
                                            <select value={bulkLeaveType} onChange={e => setBulkLeaveType(e.target.value)} className={sel}>
                                                {ALL_LEAVE_TYPES.map(t => <option key={t} value={t} className="bg-[#0d0f18]">{t}</option>)}
                                            </select>
                                        </SelectWrap>
                                    )}
                                </div>

                                {/* Field 2: Planned Status */}
                                <div className="space-y-2.5 p-4 rounded-2xl bg-[#121626] border border-white/10">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={updatePlanned}
                                                onChange={e => setUpdatePlanned(e.target.checked)}
                                                className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                            />
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">Update Planned Status</span>
                                        </label>
                                    </div>

                                    {updatePlanned && (
                                        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-black/40 p-1">
                                            <button type="button" onClick={() => setBulkIsPlanned(true)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all ${bulkIsPlanned ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}>Yes</button>
                                            <button type="button" onClick={() => setBulkIsPlanned(false)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all ${!bulkIsPlanned ? 'bg-rose-500/25 text-rose-300 border border-rose-500/30' : 'text-slate-500 hover:text-slate-300'}`}>No</button>
                                        </div>
                                    )}
                                </div>

                                {/* Field 3: Duration */}
                                <div className="space-y-2.5 p-4 rounded-2xl bg-[#121626] border border-white/10">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={updateDuration}
                                                onChange={e => setUpdateDuration(e.target.checked)}
                                                className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                            />
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">Update Duration</span>
                                        </label>
                                    </div>

                                    {updateDuration && (
                                        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-black/40 p-1">
                                            <button type="button" onClick={() => setBulkDayCount(1)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all ${bulkDayCount === 1 ? 'bg-sky-500/25 text-sky-300 border border-sky-500/30' : 'text-slate-500 hover:text-slate-300'}`}>Full Day (1.0)</button>
                                            <button type="button" onClick={() => setBulkDayCount(0.5)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all ${bulkDayCount === 0.5 ? 'bg-amber-500/25 text-amber-300 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300'}`}>Half Day (0.5)</button>
                                        </div>
                                    )}
                                </div>

                                {/* Field 4: Reason */}
                                <div className="space-y-2.5 p-4 rounded-2xl bg-[#121626] border border-white/10">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={updateReason}
                                                onChange={e => setUpdateReason(e.target.checked)}
                                                className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 cursor-pointer"
                                            />
                                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">Update Reason</span>
                                        </label>
                                    </div>

                                    {updateReason && (
                                        <input
                                            type="text"
                                            value={bulkReason}
                                            onChange={e => setBulkReason(e.target.value)}
                                            placeholder="e.g. Approved leave, emergency, brother marriage, etc."
                                            className={inp}
                                        />
                                    )}
                                </div>
                            </form>

                            {/* Drawer Footer */}
                            <div className="px-7 py-5 border-t border-white/[0.08] flex gap-3.5 bg-white/[0.01]">
                                <motion.button
                                    type="button"
                                    onClick={handleBulkSubmit as any}
                                    disabled={bulkSaving || (!updateLeaveType && !updatePlanned && !updateDuration && !updateReason)}
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white text-sm font-black tracking-wide transition-all disabled:opacity-40 shadow-[0_0_25px_rgba(99,102,241,0.35)]"
                                >
                                    {bulkSaving ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <><Check size={16} /> Apply to {selectedIds.length} Records</>
                                    )}
                                </motion.button>
                                <button
                                    type="button"
                                    onClick={() => setBulkDrawerOpen(false)}
                                    className="px-6 py-3 rounded-xl border border-white/10 text-slate-300 text-sm font-bold hover:text-white hover:border-white/20 transition-all"
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
