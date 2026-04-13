'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileSpreadsheet, Plus, Trash2, Download, CheckCircle,
    Edit2, X, ChevronDown, ChevronUp, CalendarCheck2,
    AlertCircle, Search,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import {
    getAllUsers, getClients, ClientRow,
    addLeave, updateLeave, deleteLeave, getLeavesPage, getLeaveSummary, SmartLeaveRecord, LeaveSummary
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
    const [yr, mo, dy] = iso.split('-');
    return `${dy}-${MONTHS[parseInt(mo, 10) - 1]}-${yr.slice(2)}`;
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

const LEAVE_META: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    'Sick Leave': { dot: '#a78bfa', text: 'text-violet-400', bg: 'bg-violet-500/8', border: 'border-violet-500/20' },
    'HD-Sick': { dot: '#c4b5fd', text: 'text-violet-300', bg: 'bg-violet-500/8', border: 'border-violet-500/20' },
    'Casual Leave': { dot: '#60a5fa', text: 'text-blue-400', bg: 'bg-blue-500/8', border: 'border-blue-500/20' },
    'HD-Casual': { dot: '#93c5fd', text: 'text-blue-300', bg: 'bg-blue-500/8', border: 'border-blue-500/20' },
    'LWP': { dot: '#7f1d1d', text: 'text-red-700', bg: 'bg-red-900/20', border: 'border-red-900/30' },
    'HD-LWP': { dot: '#991b1b', text: 'text-red-600', bg: 'bg-red-900/20', border: 'border-red-900/30' },
    'HD-Sick Room': { dot: '#8b5cf6', text: 'text-violet-500', bg: 'bg-violet-500/8', border: 'border-violet-500/20' },
    'LWP-Doc not Received': { dot: '#450a0a', text: 'text-red-900', bg: 'bg-red-950/40', border: 'border-red-900/40' },
    'Paternity': { dot: '#d8b4fe', text: 'text-violet-200', bg: 'bg-violet-500/8', border: 'border-violet-500/20' },
    'Paid Leave': { dot: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20' },
    'System: Absent': { dot: '#fbbf24', text: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
    'System: Half-Day': { dot: '#fbbf24', text: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypeBadge({ type, isSmart }: { type: string, isSmart?: boolean }) {
    const m = LEAVE_META[type] ?? LEAVE_META['Casual Leave'];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase border ${m.text} ${m.bg} ${m.border}`}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.dot }} />
            {type}
        </span>
    );
}

function StatCard({ label, value, sub, color, accent, active }: { label: string; value: string | number; sub?: string; color: string; accent: string; active?: boolean; }) {
    return (
        <div className={`relative flex flex-col panel-3d px-5 py-4 overflow-hidden transition-all duration-300 group ${active ? 'border-white/20 ring-1 ring-white/10' : 'hover:brightness-110'}`}>
            {/* Colored top accent bar — same pattern as Live Dashboard */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${accent} ${active ? 'opacity-100' : 'opacity-80'}`} />
            {active && <div className={`absolute -right-4 -top-4 w-12 h-12 ${accent} opacity-10 blur-2xl rounded-full`} />}
            <p className={`text-3xl font-black tabular-nums tracking-tighter leading-none mt-2 ${color}`}>{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-2">{label}</p>
            {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
        </div>
    );
}

// ─── Label / Input tokens ─────────────────────────────────────────────────────
const lbl = "block text-[11px] font-bold tracking-[0.1em] uppercase text-slate-500 mb-1.5";
const inp = "w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-slate-700 color-scheme-dark";
const sel = `${inp} appearance-none pr-8 cursor-pointer`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className={lbl}>{label}</label>{children}</div>;
}
function SelectWrap({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative">
            {children}
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
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

    // Form drawer
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Pending delete (for ConfirmDialog)
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Form fields
    const [date, setDate] = useState(dateStr(new Date()));
    const [selectedClient, setSelectedClient] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [isPlanned, setIsPlanned] = useState(true);
    const [reason, setReason] = useState('');
    const [leaveType, setLeaveType] = useState('Sick Leave');
    const [dayCount, setDayCount] = useState<number>(1);

    // Filters
    const [filterClient, setFilterClient] = useState<string[]>([]);
    const [filterEmployee, setFilterEmployee] = useState<string[]>([]);
    const [filterLeaveType, setFilterLeaveType] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    // Separate Year + Month filters for flexible date range
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, dir: 'asc' | 'desc' }>({ key: 'Date', dir: 'desc' });

    useEffect(() => {
        void loadMeta();
    }, []);

    const filterClientKey = filterClient.join(',');
    const filterEmployeeKey = filterEmployee.join(',');
    const filterLeaveTypeKey = filterLeaveType.join(',');

    useEffect(() => {
        void loadLeavesPage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, filterClientKey, filterEmployeeKey, filterLeaveTypeKey, search, filterYear, filterMonth, sortConfig.key, sortConfig.dir]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterClientKey, filterEmployeeKey, filterLeaveTypeKey, search, filterYear, filterMonth, sortConfig.key, sortConfig.dir]);

    async function loadMeta() {
        try {
            const [c, u] = await Promise.all([
                getClients(),
                getAllUsers()
            ]);
            setClients(c);
            setAllUsers(u.filter(u => !u.isMaster));
        } catch (err) {
            console.error(err);
            toastError('Could not load leave metadata', 'Please try again in a moment.');
        }
    }

    async function loadLeavesPage(force = false, page = currentPage) {
        setLoading(true);
        try {
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

    const availableEmployees = selectedClient
        ? allUsers.filter(u => u.clientName === selectedClient).sort((a, b) => a.name.localeCompare(b.name))
        : [];

    function resetForm() {
        setEditingId(null); setDate(dateStr(new Date())); setSelectedClient('');
        setEmployeeName(''); setIsPlanned(true); setReason(''); setLeaveType('Sick Leave'); setDayCount(1);
    }

    function openNew() { resetForm(); setDrawerOpen(true); }
    function startEdit(l: LeaveRecord) {
        setEditingId(l.id); setDate(l.date); setSelectedClient(l.client_name);
        setEmployeeName(l.employee_name); setIsPlanned(l.is_planned);
        setReason(l.reason || ''); setLeaveType(l.leave_type); setDayCount(l.day_count);
        setDrawerOpen(true);
    }
    function cancelEdit() { resetForm(); setDrawerOpen(false); }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedClient || !employeeName) return;

        setSaving(true);
        try {
            const payload = { date, client_name: selectedClient, employee_name: employeeName, is_planned: isPlanned, reason: reason || null, approver: currentUser.name, leave_type: leaveType, day_count: dayCount };
            if (editingId && !editingId.startsWith('virtual-')) {
                await updateLeave(editingId, payload);
                success('Record updated', `${employeeName}'s leave on ${date} has been saved.`);
            } else {
                await addLeave(payload);
                success('Leave recorded', `${employeeName} · ${leaveType} · ${date}`);
            }
            if (currentPage !== 1) setCurrentPage(1);
            else await loadLeavesPage(true, 1);
            resetForm(); setDrawerOpen(false);
        } catch (err) { console.error(err); toastError('Could not save leave', 'Check the `leaves` table in Supabase and try again.'); }
        finally { setSaving(false); }
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
        const nextTotal = Math.max(0, totalLeaves - 1);
        const nextPage = Math.min(currentPage, Math.max(1, Math.ceil(nextTotal / LEAVE_PAGE_SIZE)));
        const filters = {
            clientName: filterClient.length > 0 ? filterClient : undefined,
            employeeName: filterEmployee.length > 0 ? filterEmployee : undefined,
            leaveType: filterLeaveType || undefined,
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

    async function declineSmartLeave(l: SmartLeaveRecord) {
        setSaving(true);
        try {
            await updateLeave(l.id, { leave_type: 'Dismissed', reason: 'Dismissed by Admin' });
            setSmartLeaves((current) => current.filter((leave) => leave.id !== l.id));
            setLeaves((current) => current.filter((leave) => leave.id !== l.id));
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

    return (
        <div className="flex flex-col gap-6">
            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={!!deleteId}
                title="Delete this leave record?"
                message="This will permanently remove the leave entry. This action cannot be undone."
                confirmLabel="Delete Record"
                onConfirm={() => { if (deleteId) handleDelete(deleteId); }}
                onCancel={() => setDeleteId(null)}
            />

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <FileSpreadsheet size={18} className="text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight">Leave Management</h1>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium tracking-wide">Attendance, history, and active leaves</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-px h-6 bg-white/10 mx-1" />

                    <button onClick={handleExport} disabled={visibleLeaves.length === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/8 text-slate-300 text-xs font-semibold hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none">
                        <Download size={14} /> Export CSV
                    </button>
                    <button onClick={openNew}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-black text-xs font-bold tracking-wide hover:bg-emerald-400 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_12px_rgba(16,185,129,0.2)]">
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
                        {filterLeaveType && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-400 uppercase tracking-wider">
                                {filterLeaveType}
                                <button onClick={() => setFilterLeaveType('')} className="hover:text-white transition-colors"><X size={10} /></button>
                            </span>
                        )}
                        {(filterClient.length > 0 || filterEmployee.length > 0 || filterLeaveType || search) && (
                            <button onClick={() => { setFilterClient([]); setFilterEmployee([]); setFilterLeaveType(''); setSearch(''); setFilterYear(''); setFilterMonth(''); }}
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
            <div className="panel-3d overflow-hidden rounded-[2rem] p-4">
                <div className="overflow-x-auto pb-4">
                    <div className="min-w-[1050px] flex flex-col gap-3">
                        {/* Headers */}
                        <div className="grid grid-cols-[100px_minmax(150px,2fr)_minmax(130px,1fr)_minmax(160px,1.5fr)_90px_90px_minmax(140px,1.5fr)_100px_90px] gap-4 px-5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] items-center">
                            {['Date', 'Employee', 'Client', 'Leave Type', 'Duration', 'Planned', 'Reason', 'Logged by'].map(h => (
                                <button key={h} onClick={() => {
                                    if (sortConfig.key === h) setSortConfig({ key: h, dir: sortConfig.dir === 'asc' ? 'desc' : 'asc' });
                                    else setSortConfig({ key: h, dir: 'asc' });
                                }} className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.15em] uppercase text-slate-500 hover:text-white transition-colors outline-none cursor-pointer group text-left">
                                    {h}
                                    <span className="flex flex-col opacity-0 group-hover:opacity-50 transition-opacity" style={{ opacity: sortConfig.key === h ? 1 : undefined }}>
                                        <ChevronUp size={10} className={`-mb-1 transition-colors ${sortConfig.key === h && sortConfig.dir === 'asc' ? 'text-emerald-400' : ''}`} />
                                        <ChevronDown size={10} className={`transition-colors ${sortConfig.key === h && sortConfig.dir === 'desc' ? 'text-emerald-400' : ''}`} />
                                    </span>
                                </button>
                            ))}
                            <div className="text-[10px] font-black tracking-[0.15em] uppercase text-slate-500 text-right pr-2">Actions</div>
                        </div>

                        {/* Body Slots */}
                        {currentPage === 1 && filteredSmartLeaves.length > 0 && !loading && (
                            <div className="mb-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">Recent System Alerts</p>
                                        <p className="text-xs text-slate-500">These are recent auto-detected leave exceptions from the last 14 days.</p>
                                    </div>
                                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                                        {filteredSmartLeaves.length} alert{filteredSmartLeaves.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {filteredSmartLeaves.map((l) => (
                                        <div key={l.id} className="grid grid-cols-[100px_minmax(150px,2fr)_minmax(130px,1fr)_minmax(160px,1.5fr)_90px_90px_minmax(140px,1.5fr)_100px_90px] gap-4 px-5 py-3.5 items-center rounded-2xl border border-amber-500/15 bg-black/20">
                                            <div className="font-mono text-[11px] font-bold text-slate-400/80 uppercase tracking-widest">{fmtDate(l.date)}</div>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="w-8 h-8 rounded-xl bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] border border-white/10 text-[11px] font-black text-white flex items-center justify-center flex-shrink-0">{l.employee_name[0]}</span>
                                                <span className="text-[13px] font-bold text-white truncate">{l.employee_name}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <span className="inline-block max-w-full truncate text-[9px] font-black uppercase tracking-widest text-slate-400 bg-black/40 border border-white/5 px-2.5 py-1.5 rounded-lg">{l.client_name}</span>
                                            </div>
                                            <div><TypeBadge type={l.leave_type} isSmart /></div>
                                            <div className={`text-[11px] font-black tracking-wider uppercase ${l.day_count === 1 ? 'text-blue-400' : 'text-amber-400'}`}>{l.day_count === 1 ? 'Full' : 'Half'}</div>
                                            <div>
                                                <span className="inline-flex items-center gap-1 text-amber-500/90 text-[10px] uppercase tracking-widest font-black bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20"><AlertCircle size={10} /> Auto</span>
                                            </div>
                                            <div className="min-w-0 text-slate-500 text-[11px] font-semibold truncate" title={l.reason || ''}>
                                                <span className="text-amber-500/70 text-[9px] font-black uppercase tracking-widest">{(l.reason || '').replace(/System Auto-Generated:\s*/i, '').replace(/No punch-in recorded/i, 'No Punch In').replace(/Half-Day/i, 'Less Hours')}</span>
                                            </div>
                                            <div className="truncate text-slate-500 text-[11px] font-bold"><span className="text-indigo-400/70 italic">System Gen</span></div>
                                            <div className="flex items-center justify-end gap-1.5 w-full">
                                                <button onClick={() => startEdit(l)} title="Approve & Save"
                                                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:from-emerald-500 hover:to-emerald-400 hover:text-emerald-950 transition-all">
                                                    <CheckCircle size={14} />
                                                </button>
                                                <button onClick={() => void declineSmartLeave(l)} title="Decline"
                                                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-600/10 border border-rose-500/30 text-rose-400 hover:from-rose-500 hover:to-rose-400 hover:text-rose-950 transition-all">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-3">
                                <div className="w-6 h-6 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.4)]" />
                                <p className="text-xs font-bold tracking-widest uppercase text-slate-500">Loading records…</p>
                            </div>
                        ) : leaves.length === 0 && filteredSmartLeaves.length === 0 ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-4">
                                <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.02)]">
                                    <CalendarCheck2 size={28} className="text-slate-600" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-400 tracking-wide">No records found</p>
                                    <p className="text-xs font-medium text-slate-600 mt-1">{search || hasFilter ? 'Try adjusting your filters' : 'Click "New Record" to add the first leave entry'}</p>
                                </div>
                                {(search || hasFilter) && (
                                    <button onClick={() => { setSearch(''); setFilterClient([]); setFilterEmployee([]); setFilterLeaveType(''); setFilterYear(''); setFilterMonth(''); }}
                                        className="text-xs uppercase tracking-widest text-indigo-400 hover:text-indigo-300 font-black transition-colors px-4 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20">
                                        Clear all filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {leaves.map((l) => (
                                    <motion.div key={l.id}
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className={`grid grid-cols-[100px_minmax(150px,2fr)_minmax(130px,1fr)_minmax(160px,1.5fr)_90px_90px_minmax(140px,1.5fr)_100px_90px] gap-4 px-5 py-3.5 items-center rounded-2xl transition-all duration-300 group cursor-default
                                            ${editingId === l.id ? 'bg-[linear-gradient(120deg,rgba(245,158,11,0.08),rgba(0,0,0,0.4))] border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/20' : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 hover:shadow-xl hover:scale-[1.005]'}`}>
                                        
                                        <div className="font-mono text-[11px] font-bold text-slate-400/80 uppercase tracking-widest">{fmtDate(l.date)}</div>
                                        
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="w-8 h-8 rounded-xl bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] text-[11px] font-black text-white flex items-center justify-center flex-shrink-0 drop-shadow-md">
                                                {l.employee_name[0]}
                                            </span>
                                            <span className="text-[13px] font-bold text-white truncate drop-shadow-sm">{l.employee_name}</span>
                                        </div>

                                        <div className="min-w-0">
                                            <span className="inline-block max-w-full truncate text-[9px] font-black uppercase tracking-widest text-slate-400 bg-black/40 border border-white/5 px-2.5 py-1.5 rounded-lg shadow-inner">{l.client_name}</span>
                                        </div>

                                        <div><TypeBadge type={l.leave_type} isSmart={(l as any).is_smart} /></div>

                                        <div className={`text-[11px] font-black tracking-wider uppercase ${l.day_count === 1 ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`}>
                                            {l.day_count === 1 ? 'Full' : 'Half'}
                                        </div>

                                        <div>
                                            {(l as any).is_smart ? (
                                                <span className="inline-flex items-center gap-1 text-amber-500/90 text-[10px] uppercase tracking-widest font-black bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20"><AlertCircle size={10} /> Auto</span>
                                            ) : l.is_planned
                                                ? <span className="inline-flex items-center gap-1 text-emerald-400/90 text-[10px] uppercase tracking-widest font-black bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20"><CheckCircle size={10} /> Yes</span>
                                                : <span className="inline-flex items-center gap-1 text-rose-400/90 text-[10px] uppercase tracking-widest font-black bg-rose-500/10 px-2 py-1 rounded-md border border-rose-500/20"><AlertCircle size={10} /> No</span>}
                                        </div>

                                        <div className="min-w-0 text-slate-500 text-[11px] font-semibold truncate" title={l.reason || ''}>
                                            {(l as any).is_smart ? <span className="text-amber-500/70 text-[9px] font-black uppercase tracking-widest">{(l.reason || '').replace(/System Auto-Generated:\s*/i, '').replace(/No punch-in recorded/i, 'No Punch In').replace(/Half-Day/i, 'Less Hours')}</span> : (l.reason || <span className="text-slate-700 font-bold">—</span>)}
                                        </div>

                                        <div className="truncate text-slate-500 text-[11px] font-bold">{(l as any).is_smart ? <span className="text-indigo-400/70 italic drop-shadow-[0_0_5px_rgba(129,140,248,0.3)]">System Gen</span> : l.approver}</div>

                                        <div className="flex items-center justify-end gap-1.5 w-full">
                                            {(l as any).is_smart && (
                                                <>
                                                    <button onClick={() => startEdit(l)} title="Approve & Save"
                                                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:from-emerald-500 hover:to-emerald-400 hover:text-emerald-950 transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95">
                                                        <CheckCircle size={14} className="drop-shadow-sm" />
                                                    </button>
                                                    <button onClick={() => declineSmartLeave(l)} title="Decline"
                                                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-600/10 border border-rose-500/30 text-rose-400 hover:from-rose-500 hover:to-rose-400 hover:text-rose-950 transition-all shadow-[0_0_10px_rgba(225,29,72,0.1)] hover:shadow-[0_0_15px_rgba(225,29,72,0.4)] hover:scale-105 active:scale-95">
                                                        <X size={14} className="drop-shadow-sm" />
                                                    </button>
                                                </>
                                            )}
                                            {!(l as any).is_smart && (
                                                <button onClick={() => startEdit(l)} title="Edit"
                                                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:bg-amber-500/20 hover:border-amber-500/40 hover:text-amber-400 transition-all shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:scale-105 active:scale-95">
                                                    <Edit2 size={13} />
                                                </button>
                                            )}
                                            {!(l as any).is_smart && (
                                                <button onClick={() => setDeleteId(l.id)} title="Delete"
                                                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-400 transition-all shadow-sm hover:shadow-[0_0_15px_rgba(225,29,72,0.2)] hover:scale-105 active:scale-95">
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>

                {/* Table Footer */}
                {visibleLeaves.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.05] bg-black/10">
                        <p className="text-[11px] text-slate-700 font-medium">
                            {displayedLeaves.length} records · {uniqueEmpls} {uniqueEmpls === 1 ? 'employee' : 'employees'}
                        </p>
                        <div className="flex items-center gap-4">
                            <p className="text-[11px] text-slate-600 font-medium">
                                <span className="text-emerald-400 font-black">{totalDays}</span> total days
                            </p>
                            {lwpCount > 0 && (
                                <p className="text-[11px] font-medium">
                                    <span className="text-red-400 font-black">{lwpCount}</span> <span className="text-slate-600">LWP</span>
                                </p>
                            )}
                            <p className="text-[11px] text-slate-600 font-medium">
                                History page <span className="text-white font-black">{currentPage}</span> of <span className="text-white font-black">{totalPages}</span>
                            </p>
                            <p className="text-[11px] text-slate-600 font-medium">
                                Showing <span className="text-white font-black">{pageStart}-{pageEnd}</span> of <span className="text-white font-black">{totalLeaves}</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    disabled={currentPage === 1 || loading}
                                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition-all disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5"
                                >
                                    <ChevronLeft size={12} /> Prev
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                    disabled={currentPage >= totalPages || loading}
                                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition-all disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5"
                                >
                                    Next <ChevronRight size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Form Drawer (Slide-in from right) ───────────────────────── */}
            <AnimatePresence>
                {drawerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                            onClick={cancelEdit} />
                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
                            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
                            className="fixed right-0 top-0 bottom-0 z-50 w-[440px] bg-[#0C0C14] border-l border-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col">

                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                                <div>
                                    <p className={`font-black text-sm ${editingId ? 'text-amber-400' : 'text-white'}`}>
                                        {editingId ? 'Edit Record' : 'New Leave Record'}
                                    </p>
                                    <p className="text-[10px] text-slate-600 mt-0.5 font-medium tracking-wider uppercase">
                                        {editingId ? 'Update existing entry' : 'Add to leave tracker'}
                                    </p>
                                </div>
                                <button onClick={cancelEdit} className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-white/5 transition-all">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                                <Field label="Date">
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={inp} />
                                </Field>

                                <Field label="Client">
                                    <SelectWrap>
                                        <select value={selectedClient} onChange={e => { setSelectedClient(e.target.value); setEmployeeName(''); }} required className={sel}>
                                            <option value="" className="bg-[#0d0d1a]">Select client…</option>
                                            {clients.map(c => <option key={c.id} value={c.name} className="bg-[#0d0d1a]">{c.name}</option>)}
                                        </select>
                                    </SelectWrap>
                                </Field>

                                <Field label="Employee">
                                    <SelectWrap>
                                        <select value={employeeName} onChange={e => setEmployeeName(e.target.value)} required disabled={!selectedClient} className={`${sel} disabled:opacity-40`}>
                                            <option value="" className="bg-[#0d0d1a]">{selectedClient ? 'Select employee…' : '← Pick client first'}</option>
                                            {availableEmployees.map(u => <option key={u.id} value={u.name} className="bg-[#0d0d1a]">{u.name}</option>)}
                                        </select>
                                    </SelectWrap>
                                    {employeeName && (
                                        <p className="text-[10px] text-slate-600 mt-1.5">
                                            Total leaves: <span className="text-emerald-400 font-bold">
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
                                            // Automatically set day count defaults
                                            if (val.startsWith('HD-')) {
                                                setDayCount(0.5);
                                            } else if (val === 'Paid Leave') {
                                                setDayCount(1);
                                            } else {
                                                setDayCount(1);
                                            }
                                        }} className={sel}>
                                            {ALL_LEAVE_TYPES.map(t => <option key={t} value={t} className="bg-[#0d0d1a]">{t}</option>)}
                                        </select>
                                    </SelectWrap>
                                </Field>

                                {/* Planned + Duration — Segmented Controls */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={lbl}>Planned?</label>
                                        <div className="flex rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                                            <button type="button" onClick={() => setIsPlanned(true)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide transition-all duration-150 ${isPlanned ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}>Yes</button>
                                            <button type="button" onClick={() => setIsPlanned(false)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide transition-all duration-150 ${!isPlanned ? 'bg-rose-500/15 text-rose-400' : 'text-slate-600 hover:text-slate-400'}`}>No</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lbl}>Duration</label>
                                        {leaveType === 'Paid Leave' ? (
                                            <input 
                                                type="number" 
                                                min="0"
                                                step="0.5"
                                                value={dayCount} 
                                                onChange={e => setDayCount(Number(e.target.value))}
                                                className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-[7px] text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                            />
                                        ) : (
                                            <div className="flex rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                                                <button type="button" onClick={() => setDayCount(1)}
                                                    className={`flex-1 py-2 text-xs font-black tracking-wide transition-all duration-150 ${dayCount === 1 ? 'bg-blue-500/20 text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}>Full</button>
                                                <button type="button" onClick={() => setDayCount(0.5)}
                                                    className={`flex-1 py-2 text-xs font-black tracking-wide transition-all duration-150 ${dayCount === 0.5 ? 'bg-amber-500/20 text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>Half</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Field label="Reason (optional)">
                                    <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                                        placeholder="e.g. Fever, personal work…" className={inp} />
                                </Field>

                                <div className="pt-2 flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-700">Logged by</span>
                                    <span className="text-[10px] font-bold text-slate-500">{currentUser.name}</span>
                                </div>
                            </form>

                            {/* Drawer Footer */}
                            <div className="px-6 py-5 border-t border-white/[0.06] flex gap-3">
                                <motion.button type="button" onClick={handleSubmit as any} disabled={saving || !selectedClient || !employeeName}
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all disabled:opacity-40 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]
                                        ${editingId ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-emerald-500 text-black hover:bg-emerald-400'}`}>
                                    {saving
                                        ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        : editingId ? <><Edit2 size={16} /> Update</> : <><Plus size={16} /> Save Record</>}
                                </motion.button>
                                <button type="button" onClick={cancelEdit}
                                    className="px-5 py-2.5 rounded-lg border border-white/8 text-slate-400 text-sm font-bold hover:text-white hover:border-white/15 transition-all">
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
