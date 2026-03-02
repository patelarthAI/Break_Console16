'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileSpreadsheet, Plus, Trash2, Download, CheckCircle,
    Edit2, X, ChevronDown, CalendarCheck2,
    TrendingDown, AlertCircle, Filter, Search,
    SlidersHorizontal, ChevronUp, Users2
} from 'lucide-react';
import { getLeaves, addLeave, deleteLeave, updateLeave, getClients, ClientRow, getAllUsers } from '@/lib/store';
import { LeaveRecord, User as AppUser } from '@/types';
import { exportExcel, dateStr } from '@/lib/timeUtils';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

// ─── Constants ────────────────────────────────────────────────────────────────
const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'LWP', 'HD-Casual', 'Health Issue', 'Vacation', 'Bereavement'];

const LEAVE_META: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    'Sick Leave': { dot: '#f87171', text: 'text-red-400', bg: 'bg-red-500/8', border: 'border-red-500/20' },
    'Casual Leave': { dot: '#60a5fa', text: 'text-blue-400', bg: 'bg-blue-500/8', border: 'border-blue-500/20' },
    'LWP': { dot: '#ef4444', text: 'text-red-500', bg: 'bg-red-500/15', border: 'border-red-500/30' },
    'HD-Casual': { dot: '#fbbf24', text: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20' },
    'Health Issue': { dot: '#fb923c', text: 'text-orange-400', bg: 'bg-orange-500/8', border: 'border-orange-500/20' },
    'Vacation': { dot: '#a78bfa', text: 'text-violet-400', bg: 'bg-violet-500/8', border: 'border-violet-500/20' },
    'Bereavement': { dot: '#94a3b8', text: 'text-slate-400', bg: 'bg-slate-500/8', border: 'border-slate-500/20' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
    const m = LEAVE_META[type] ?? LEAVE_META['Casual Leave'];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase border ${m.text} ${m.bg} ${m.border}`}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.dot }} />
            {type}
        </span>
    );
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3 bg-[#0A0A0A] border border-white/[0.06] rounded-xl px-6 py-5 hover:-translate-y-0.5 hover:border-white/[0.15] hover:shadow-2xl hover:shadow-black/50 transition-all duration-300 group">
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
                <div className="text-slate-700 group-hover:text-slate-500 transition-colors">{icon}</div>
            </div>
            <div>
                <p className={`text-3xl font-black tabular-nums tracking-tighter leading-none ${color}`}>{value}</p>
                {sub && <p className="text-[11px] text-slate-600 mt-1.5 font-medium">{sub}</p>}
            </div>
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
export default function MasterLeaveTracker({ currentUser }: { currentUser: AppUser }) {
    const { success, error: toastError, warning } = useToast();

    // Data
    const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [allUsers, setAllUsers] = useState<AppUser[]>([]);
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
    const [filterClient, setFilterClient] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [search, setSearch] = useState('');
    const [periodFilter, setPeriodFilter] = useState(''); // '' = all, 'YYYY' = year, 'YYYY-MM' = month

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [l, c, u] = await Promise.all([getLeaves(), getClients(), getAllUsers()]);
            setLeaves(l); setClients(c); setAllUsers(u.filter(u => !u.isMaster));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
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

        // Duplicate detection
        if (!editingId) {
            const dup = leaves.find(l => l.employee_name === employeeName && l.date === date);
            if (dup) {
                warning(
                    'Duplicate leave detected',
                    `${employeeName} already has a "${dup.leave_type}" record on ${date}. Save anyway?`
                );
                // Allow save to proceed (just warn, don't block)
            }
        }

        setSaving(true);
        try {
            const payload = { date, client_name: selectedClient, employee_name: employeeName, is_planned: isPlanned, reason: reason || null, approver: currentUser.name, leave_type: leaveType, day_count: dayCount };
            if (editingId) {
                const updated = await updateLeave(editingId, payload);
                setLeaves(prev => prev.map(l => l.id === editingId ? updated : l));
                success('Record updated', `${employeeName}'s leave on ${date} has been saved.`);
            } else {
                const added = await addLeave(payload);
                setLeaves(prev => [added, ...prev]);
                success('Leave recorded', `${employeeName} · ${leaveType} · ${date}`);
            }
            resetForm(); setDrawerOpen(false);
        } catch (err) { console.error(err); toastError('Could not save leave', 'Check the `leaves` table in Supabase and try again.'); }
        finally { setSaving(false); }
    }

    async function handleDelete(id: string) {
        await deleteLeave(id);
        const name = leaves.find(l => l.id === id)?.employee_name ?? 'Record';
        setLeaves(prev => prev.filter(l => l.id !== id));
        if (editingId === id) cancelEdit();
        setDeleteId(null);
        success('Leave deleted', `${name}'s record has been removed.`);
    }

    // Available periods derived from leave data
    const availableYearMonths = useMemo(() => {
        const set = new Set(leaves.map(l => l.date.slice(0, 7))); // 'YYYY-MM'
        return [...set].sort().reverse();
    }, [leaves]);

    // Filtered + searched data
    const displayedLeaves = useMemo(() => leaves.filter(l => {
        if (filterClient && l.client_name !== filterClient) return false;
        if (filterEmployee && l.employee_name !== filterEmployee) return false;
        if (periodFilter && !l.date.startsWith(periodFilter)) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!l.employee_name.toLowerCase().includes(q) && !l.client_name.toLowerCase().includes(q) && !l.leave_type.toLowerCase().includes(q)) return false;
        }
        return true;
    }), [leaves, filterClient, filterEmployee, search, periodFilter]);

    const totalDays = useMemo(() => displayedLeaves.reduce((s, l) => s + Number(l.day_count), 0), [displayedLeaves]);
    const lwpCount = useMemo(() => displayedLeaves.filter(l => l.leave_type === 'LWP').reduce((s, l) => s + Number(l.day_count), 0), [displayedLeaves]);
    const unplanned = useMemo(() => displayedLeaves.filter(l => !l.is_planned).length, [displayedLeaves]);
    const uniqueEmpls = useMemo(() => new Set(displayedLeaves.map(l => l.employee_name)).size, [displayedLeaves]);

    const employeeSummary = useMemo(() => {
        const map: Record<string, { total: number; lwp: number }> = {};
        displayedLeaves.forEach(l => {
            if (!map[l.employee_name]) map[l.employee_name] = { total: 0, lwp: 0 };
            map[l.employee_name].total += Number(l.day_count);
            if (l.leave_type === 'LWP') map[l.employee_name].lwp += Number(l.day_count);
        });
        return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
    }, [displayedLeaves]);

    function handleExport() {
        const header = ['Date', 'Client', 'Employee', 'Leave Type', 'Duration', 'Planned', 'Reason', 'Approver'];
        const data = displayedLeaves.map(l => [l.date, l.client_name, l.employee_name, l.leave_type, l.day_count === 1 ? 'Full Day' : 'Half Day', l.is_planned ? 'Yes' : 'No', l.reason || '', l.approver || '']);
        exportExcel([header, ...data], 'leave-tracker');
    }

    const hasFilter = !!(filterClient || filterEmployee || search || periodFilter);

    return (
        <div className="flex flex-col gap-8">
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
                    <button onClick={handleExport} disabled={displayedLeaves.length === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/8 text-slate-300 text-xs font-semibold hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none">
                        <Download size={14} /> Export CSV
                    </button>
                    <button onClick={openNew}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-black text-xs font-bold tracking-wide hover:bg-emerald-400 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_12px_rgba(16,185,129,0.2)]">
                        <Plus size={15} /> New Record
                    </button>
                </div>
            </div>

            {/* ── Stats Row ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-3">
                <StatCard label="Total Records" value={displayedLeaves.length} color="text-white" icon={<FileSpreadsheet size={14} />} />
                <StatCard label="Total Days" value={totalDays.toFixed(1)} color="text-emerald-400" sub="days taken" icon={<CalendarCheck2 size={14} />} />
                <StatCard label="LWP Days" value={lwpCount.toFixed(1)} color={lwpCount > 0 ? 'text-red-400' : 'text-slate-500'} sub="leave without pay" icon={<TrendingDown size={14} />} />
                <StatCard label="Unplanned" value={unplanned} color={unplanned > 0 ? 'text-amber-400' : 'text-slate-500'} sub="no advance notice" icon={<AlertCircle size={14} />} />
            </div>

            {/* ── Employee Summary Strip ───────────────────────────────────── */}
            {employeeSummary.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Users2 size={12} className="text-slate-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">By Employee</span>
                    </div>
                    <div className="w-px h-3 bg-white/8 flex-shrink-0" />
                    {employeeSummary.map(([name, stats]) => (
                        <button key={name} onClick={() => setFilterEmployee(filterEmployee === name ? '' : name)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-all border
                            ${filterEmployee === name
                                    ? 'bg-white/10 text-white border-white/15'
                                    : 'bg-white/[0.03] text-slate-500 border-white/5 hover:text-white hover:border-white/10'}`}>
                            <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-black text-white">{name[0]}</span>
                            {name}
                            <span className={`font-black tabular-nums ${stats.total >= 3 ? 'text-rose-400' : 'text-slate-500'}`}>{stats.total}</span>
                            {stats.lwp > 0 && <span className="text-[9px] text-red-400 bg-red-500/10 px-1 rounded font-black">LWP</span>}
                        </button>
                    ))}
                    {filterEmployee && (
                        <button onClick={() => setFilterEmployee('')} className="inline-flex items-center gap-1 text-[10px] text-slate-600 hover:text-white transition-colors flex-shrink-0">
                            <X size={11} /> Clear
                        </button>
                    )}
                </div>
            )}

            {/* ── Filter & Search Bar ──────────────────────────────────────── */}
            <div className="flex items-center justify-between bg-[#0A0A0A] p-2.5 rounded-xl border border-white/[0.06] shadow-lg">
                <div className="flex items-center gap-3 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm ml-2">
                        <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input type="text" placeholder="Search employee, client, type…" value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full bg-transparent border-none py-1.5 pl-7 pr-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all" />
                        {search && <button onClick={() => setSearch('')} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"><X size={14} /></button>}
                    </div>

                    <div className="w-px h-5 bg-white/10" />

                    <div className="flex items-center gap-4 px-2">
                        <div className="flex items-center gap-1.5">
                            <Filter size={13} className="text-slate-500" />
                            <SelectWrap>
                                <select value={filterClient} onChange={e => { setFilterClient(e.target.value); setFilterEmployee(''); }}
                                    className="bg-transparent text-sm font-semibold text-slate-400 focus:outline-none appearance-none pr-5 cursor-pointer hover:text-white transition-colors">
                                    <option value="" className="bg-[#0A0A0A]">All Clients</option>
                                    {clients.map(c => <option key={c.id} value={c.name} className="bg-[#0A0A0A]">{c.name}</option>)}
                                </select>
                            </SelectWrap>
                        </div>

                        <SelectWrap>
                            <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
                                className="bg-transparent text-sm font-semibold text-slate-400 focus:outline-none appearance-none pr-5 cursor-pointer hover:text-white transition-colors">
                                <option value="" className="bg-[#0A0A0A]">All Employees</option>
                                {[...new Set(leaves.filter(l => !filterClient || l.client_name === filterClient).map(l => l.employee_name))].sort().map(n => (
                                    <option key={n} value={n} className="bg-[#0A0A0A]">{n}</option>
                                ))}
                            </select>
                        </SelectWrap>

                        <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                            <SlidersHorizontal size={13} className="text-slate-500" />
                            <SelectWrap>
                                <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
                                    className="bg-transparent text-sm font-semibold text-slate-400 focus:outline-none appearance-none pr-5 cursor-pointer hover:text-white transition-colors">
                                    <option value="" className="bg-[#0A0A0A]">All Time</option>
                                    {/* Unique years */}
                                    {[...new Set(availableYearMonths.map(ym => ym.slice(0, 4)))].map(yr => (
                                        <option key={yr} value={yr} className="bg-[#0A0A0A] font-bold">── {yr}</option>
                                    ))}
                                    {/* Individual months */}
                                    {availableYearMonths.map(ym => {
                                        const [yr, mo] = ym.split('-');
                                        const label = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                                        return <option key={ym} value={ym} className="bg-[#0A0A0A]">&nbsp;&nbsp;{label}</option>;
                                    })}
                                </select>
                            </SelectWrap>
                        </div>

                        {hasFilter && (
                            <button onClick={() => { setFilterClient(''); setFilterEmployee(''); setSearch(''); setPeriodFilter(''); }}
                                className="ml-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1 bg-white/[0.04] hover:bg-white/10 px-2 py-1 rounded border border-white/5">
                                <X size={12} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="pr-3 pl-4 border-l border-white/10">
                    <span className="text-[11px] text-slate-500 font-bold tracking-wide uppercase">
                        {displayedLeaves.length} {displayedLeaves.length === 1 ? 'Match' : 'Matches'}
                        {periodFilter && <span className="ml-1 text-slate-400 normal-case">· {periodFilter.length === 4 ? periodFilter : new Date(periodFilter + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                    </span>
                </div>
            </div>

            {/* ── Table ───────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-white/[0.07] overflow-hidden bg-[#0A0A0A]">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/[0.06] bg-[#0A0A0A] shadow-[0_1px_0_rgba(255,255,255,0.02)]">
                                {['Date', 'Employee', 'Client', 'Leave Type', 'Duration', 'Planned', 'Reason', 'Logged by', ''].map(h => (
                                    <th key={h} className="py-3 px-4 text-left text-[11px] font-bold tracking-[0.1em] uppercase text-slate-500 whitespace-nowrap first:pl-5 last:w-16">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-5 h-5 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin" />
                                        <p className="text-xs text-slate-600">Loading records…</p>
                                    </div>
                                </td></tr>
                            ) : displayedLeaves.length === 0 ? (
                                <tr><td colSpan={9} className="py-24 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                                            <CalendarCheck2 size={22} className="text-slate-700" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-500">No records found</p>
                                            <p className="text-xs text-slate-700 mt-1">{search || hasFilter ? 'Try adjusting your filters' : 'Click "New Record" to add the first leave entry'}</p>
                                        </div>
                                        {(search || hasFilter) && (
                                            <button onClick={() => { setSearch(''); setFilterClient(''); setFilterEmployee(''); }}
                                                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                                                Clear all filters
                                            </button>
                                        )}
                                    </div>
                                </td></tr>
                            ) : (
                                <AnimatePresence initial={false}>
                                    {displayedLeaves.map((l, i) => (
                                        <motion.tr key={l.id}
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.15 }} // Removed per-row stagger delay for instant tabular display
                                            className={`border-b border-white/[0.04] hover:bg-white/5 transition-colors group cursor-default
                                                ${editingId === l.id ? 'bg-amber-500/[0.04] border-l-2 border-l-amber-500/40' : ''}`}>
                                            <td className="py-3.5 px-4 pl-5 font-mono text-xs text-slate-500 whitespace-nowrap">{l.date}</td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-md bg-white/5 text-[10px] font-black text-white flex items-center justify-center flex-shrink-0">
                                                        {l.employee_name[0]}
                                                    </span>
                                                    <span className="text-sm font-semibold text-white whitespace-nowrap">{l.employee_name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 bg-white/[0.04] border border-white/8 px-2 py-1 rounded-md whitespace-nowrap">{l.client_name}</span>
                                            </td>
                                            <td className="py-3.5 px-4"><TypeBadge type={l.leave_type} /></td>
                                            <td className="py-3.5 px-4">
                                                <span className={`text-xs font-black tabular-nums ${l.day_count === 1 ? 'text-blue-400' : 'text-amber-400'}`}>
                                                    {l.day_count === 1 ? 'Full Day' : 'Half Day'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {l.is_planned
                                                    ? <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold"><CheckCircle size={11} /> Yes</span>
                                                    : <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-bold"><AlertCircle size={11} /> No</span>}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-500 text-xs max-w-[130px] truncate" title={l.reason || ''}>{l.reason || <span className="text-slate-700">—</span>}</td>
                                            <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">{l.approver}</td>
                                            <td className="py-3.5 px-4 pr-4">
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all justify-end">
                                                    <button onClick={() => startEdit(l)} title="Edit"
                                                        className="p-1.5 rounded-md text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button onClick={() => setDeleteId(l.id)} title="Delete"
                                                        className="p-1.5 rounded-md text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                {displayedLeaves.length > 0 && (
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
                                        <select value={leaveType} onChange={e => setLeaveType(e.target.value)} className={sel}>
                                            {LEAVE_TYPES.map(t => <option key={t} value={t} className="bg-[#0d0d1a]">{t}</option>)}
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
                                        <div className="flex rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                                            <button type="button" onClick={() => setDayCount(1)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide transition-all duration-150 ${dayCount === 1 ? 'bg-blue-500/20 text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}>Full</button>
                                            <button type="button" onClick={() => setDayCount(0.5)}
                                                className={`flex-1 py-2 text-xs font-black tracking-wide transition-all duration-150 ${dayCount === 0.5 ? 'bg-amber-500/20 text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>Half</button>
                                        </div>
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
