'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileSpreadsheet, Plus, Trash2, Download, CheckCircle,
    Edit2, X, ChevronDown, ChevronUp, CalendarCheck2,
    TrendingDown, AlertCircle, Filter, Search, Users2, Briefcase, Calendar
} from 'lucide-react';
import {
    getAllUsers, getSmartLeaves, getClients, ClientRow,
    addLeave, updateLeave, deleteLeave
} from '@/lib/store';
import { User, LeaveRecord } from '@/types';
import { supabase } from '@/lib/supabase';
import { formatDuration, formatTime, dateStr, getPastDaysZoned, exportExcel } from '@/lib/timeUtils';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Convert ISO date string (YYYY-MM-DD) → DD-Mon-YY, e.g. "07-Jan-25" */
function fmtDate(iso: string): string {
    const [yr, mo, dy] = iso.split('-');
    return `${dy}-${MONTHS[parseInt(mo) - 1]}-${yr.slice(2)}`;
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
        <div className={`relative flex flex-col bg-[#0a0a1a] border rounded-xl px-5 py-4 overflow-hidden transition-all duration-300 group ${active ? 'border-white/20 bg-white/5 ring-1 ring-white/10' : 'border-white/5 hover:bg-white/[0.04] hover:border-white/10'}`}>
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
    const { success, error: toastError, warning } = useToast();

    // Data
    const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
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
    const [filterClient, setFilterClient] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterType, setFilterType] = useState<'sick' | 'casual' | null>(null);
    const [search, setSearch] = useState('');
    const [periodFilter, setPeriodFilter] = useState(''); // '' = all, 'YYYY' = year, 'YYYY-MM' = month
    const [sortConfig, setSortConfig] = useState<{ key: string, dir: 'asc' | 'desc' } | null>(null);

    // Dropdown open states
    const [periodDropOpen, setPeriodDropOpen] = useState(false);
    const [colFilterOpen, setColFilterOpen] = useState<string | null>(null);

    const periodDropRef = useRef<HTMLDivElement>(null);
    const colFilterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (periodDropRef.current && !periodDropRef.current.contains(e.target as Node)) setPeriodDropOpen(false);
            if (colFilterRef.current && !colFilterRef.current.contains(e.target as Node)) setColFilterOpen(null);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [l, c, u] = await Promise.all([
                getSmartLeaves(getPastDaysZoned(14, false)), // Last 14 days of smart lookups
                getClients(),
                getAllUsers()
            ]);
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

        // Duplicate prevention
        if (!editingId) {
            const lowName = employeeName.toLowerCase().trim();
            const lowClient = selectedClient.toLowerCase().trim();
            const dup = leaves.find(l => 
                l.employee_name.toLowerCase().trim() === lowName && 
                l.client_name.toLowerCase().trim() === lowClient &&
                l.date === date
            );
            if (dup) {
                toastError('Duplicate entry blocked', `${employeeName} already has a record for ${fmtDate(date)}. Only one entry per day is allowed.`);
                return;
            }
        }

        setSaving(true);
        try {
            const payload = { date, client_name: selectedClient, employee_name: employeeName, is_planned: isPlanned, reason: reason || null, approver: currentUser.name, leave_type: leaveType, day_count: dayCount };
            if (editingId && !editingId.startsWith('virtual-')) {
                const updated = await updateLeave(editingId, payload);
                setLeaves(prev => prev.map(l => l.id === editingId ? updated : l));
                success('Record updated', `${employeeName}'s leave on ${date} has been saved.`);
            } else {
                const added = await addLeave(payload);
                if (editingId && editingId.startsWith('virtual-')) {
                    setLeaves(prev => prev.map(l => l.id === editingId ? added : l));
                } else {
                    setLeaves(prev => [added, ...prev]);
                }
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

    function declineSmartLeave(id: string) {
        if (!id.startsWith('virtual-')) return;
        const dec = JSON.parse(localStorage.getItem('declined_smart_leaves') || '[]');
        if (!dec.includes(id)) {
            dec.push(id);
            localStorage.setItem('declined_smart_leaves', JSON.stringify(dec));
        }
        setLeaves(prev => prev.filter(l => l.id !== id));
        success('Leave Declined', 'The auto-generated record has been dismissed.');
    }

    // Available periods derived from leave data
    const availableYearMonths = useMemo(() => {
        const set = new Set(leaves.map(l => l.date.slice(0, 7))); // 'YYYY-MM'
        return [...set].sort().reverse();
    }, [leaves]);

    // Filtered + searched data
    const displayedLeaves = useMemo(() => {
        let result = leaves.filter(l => {
            if (filterClient && l.client_name !== filterClient) return false;
            if (filterEmployee && l.employee_name !== filterEmployee) return false;
            if (periodFilter && !l.date.startsWith(periodFilter)) return false;
            if (filterType === 'sick') {
                const t = l.leave_type.toLowerCase();
                if (!t.includes('sick')) return false;
            }
            if (filterType === 'casual') {
                const t = l.leave_type.toLowerCase();
                if (!t.includes('casual') && !t.includes('paid leave') && !t.includes('paternity')) return false;
            }
            if (search) {
                const q = search.toLowerCase();
                if (!l.employee_name.toLowerCase().includes(q) && !l.client_name.toLowerCase().includes(q) && !l.leave_type.toLowerCase().includes(q)) return false;
            }
            return true;
        });

        if (sortConfig) {
            result.sort((a, b) => {
                let aVal: any = '';
                let bVal: any = '';
                switch (sortConfig.key) {
                    case 'Date': aVal = a.date; bVal = b.date; break;
                    case 'Employee': aVal = a.employee_name; bVal = b.employee_name; break;
                    case 'Client': aVal = a.client_name; bVal = b.client_name; break;
                    case 'Leave Type': aVal = a.leave_type; bVal = b.leave_type; break;
                    case 'Duration': aVal = a.day_count; bVal = b.day_count; break;
                    case 'Planned': aVal = a.is_planned ? 1 : 0; bVal = b.is_planned ? 1 : 0; break;
                    case 'Reason': aVal = a.reason || ''; bVal = b.reason || ''; break;
                    case 'Logged by': aVal = (a as any).is_smart ? 'System Gen' : (a.approver || ''); bVal = (b as any).is_smart ? 'System Gen' : (b.approver || ''); break;
                }
                if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [leaves, filterClient, filterEmployee, search, periodFilter, sortConfig]);

    const totalDays = useMemo(() => displayedLeaves.reduce((s, l) => s + Number(l.day_count), 0), [displayedLeaves]);
    const lwpCount = useMemo(() => displayedLeaves.filter(l => l.leave_type.startsWith('LWP')).reduce((s, l) => s + Number(l.day_count), 0), [displayedLeaves]);
    const sickCount = useMemo(() => displayedLeaves.filter(l => l.leave_type.includes('Sick')).reduce((s, l) => s + Number(l.day_count), 0), [displayedLeaves]);
    const casualCount = useMemo(() => displayedLeaves.filter(l => l.leave_type.includes('Casual') || l.leave_type === 'Paid Leave' || l.leave_type.includes('Paternity')).reduce((s, l) => s + Number(l.day_count), 0), [displayedLeaves]);
    const unplanned = useMemo(() => displayedLeaves.filter(l => !l.is_planned).length, [displayedLeaves]);
    const uniqueEmpls = useMemo(() => new Set(displayedLeaves.map(l => l.employee_name)).size, [displayedLeaves]);

    const baseLeavesForStrips = useMemo(() => {
        return leaves.filter(l => {
            if (periodFilter && !l.date.startsWith(periodFilter)) return false;
            return true;
        });
    }, [leaves, periodFilter]);

    const clientSummary = useMemo(() => {
        const map: Record<string, { total: number }> = {};
        baseLeavesForStrips.forEach(l => {
            if (!map[l.client_name]) map[l.client_name] = { total: 0 };
            map[l.client_name].total += Number(l.day_count);
        });
        return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
    }, [baseLeavesForStrips]);

    const employeeSummary = useMemo(() => {
        const map: Record<string, { total: number; lwp: number }> = {};
        const pool = filterClient ? baseLeavesForStrips.filter(l => l.client_name === filterClient) : baseLeavesForStrips;
        pool.forEach(l => {
            if (!map[l.employee_name]) map[l.employee_name] = { total: 0, lwp: 0 };
            map[l.employee_name].total += Number(l.day_count);
            if (l.leave_type.startsWith('LWP')) map[l.employee_name].lwp += Number(l.day_count);
        });
        return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
    }, [baseLeavesForStrips, filterClient]);

    const uniqueLeaveTypes = useMemo(() => {
        return [...new Set(leaves.map(l => l.leave_type))].sort();
    }, [leaves]);

    function handleExport() {
        const header = ['Date', 'Client', 'Name', 'Planned', 'Reason', 'Approver', 'Leave Type', 'Count'];
        const data = displayedLeaves.map(l => [
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
                    <div className="w-px h-6 bg-white/10 mx-1" />

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

            {/* ── Stats Row — matching Live Dashboard KPI tile style ─────── */}
            <div className="grid grid-cols-5 gap-3">
                <button onClick={() => setFilterType(null)} className="text-left outline-none block w-full h-full">
                    <StatCard label="Total Leaves" value={totalDays.toFixed(1)} color="text-emerald-400" accent="bg-emerald-500" sub="days taken" active={!filterType && hasFilter} />
                </button>
                <button onClick={() => setFilterType(filterType === 'sick' ? null : 'sick')} className="text-left outline-none block w-full h-full">
                    <StatCard label="Sick Leaves" value={sickCount.toFixed(1)} color="text-violet-400" accent="bg-violet-500" sub="health issues" active={filterType === 'sick'} />
                </button>
                <button onClick={() => setFilterType(filterType === 'casual' ? null : 'casual')} className="text-left outline-none block w-full h-full">
                    <StatCard label="Casual Leaves" value={casualCount.toFixed(1)} color="text-blue-400" accent="bg-blue-500" sub="personal & vacation" active={filterType === 'casual'} />
                </button>
                <StatCard label="LWP Days" value={lwpCount.toFixed(1)} color={lwpCount > 0 ? 'text-red-500' : 'text-slate-500'} accent={lwpCount > 0 ? 'bg-red-900' : 'bg-slate-800'} sub="leave without pay" />
                <StatCard label="Unplanned" value={unplanned} color={unplanned > 0 ? 'text-amber-400' : 'text-slate-500'} accent={unplanned > 0 ? 'bg-amber-500' : 'bg-slate-800'} sub="records missing notice" />
            </div>

            <div className="flex flex-col gap-3">
                {/* ── Client Summary Strip ───────────────────────────────────── */}
                {clientSummary.length > 0 && (
                    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                        <div className="flex items-center gap-2 flex-shrink-0 bg-white/[0.02] px-3 py-2 rounded-xl border border-white/5">
                            <Briefcase size={14} className="text-indigo-400" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Client</span>
                        </div>
                        <div className="w-px h-6 bg-white/10 flex-shrink-0 mx-1" />
                        {clientSummary.map(([name, stats]) => (
                            <button key={name} onClick={() => { setFilterClient(filterClient === name ? '' : name); setFilterEmployee(''); }}
                                className={`group relative flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 transition-all overflow-hidden border
                                ${filterClient === name
                                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                        : 'bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/[0.08] hover:text-white hover:border-white/25'}`}>
                                {filterClient === name && (
                                    <motion.div layoutId="clientFilterGlow" className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-transparent pointer-events-none" />
                                )}
                                <span className="relative z-10">{name}</span>
                                <div className={`relative z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-md ${filterClient === name ? 'bg-indigo-500/30' : 'bg-white/10 group-hover:bg-white/20'}`}>
                                    <span className="text-xs font-black tabular-nums">{stats.total}</span>
                                </div>
                            </button>
                        ))}
                        {filterClient && (
                            <button onClick={() => setFilterClient('')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors flex-shrink-0 ml-1">
                                <X size={12} /> Clear Filter
                            </button>
                        )}
                    </div>
                )}

                {/* ── Employee Summary Strip ───────────────────────────────────── */}
                {employeeSummary.length > 0 && (
                    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                        <div className="flex items-center gap-2 flex-shrink-0 bg-white/[0.02] px-3 py-2 rounded-xl border border-white/5">
                            <Users2 size={14} className="text-emerald-400" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Employee</span>
                        </div>
                        <div className="w-px h-6 bg-white/10 flex-shrink-0 mx-1" />
                        {employeeSummary.map(([name, stats]) => (
                            <button key={name} onClick={() => setFilterEmployee(filterEmployee === name ? '' : name)}
                                className={`group flex items-center pl-1.5 pr-4 py-1.5 rounded-full text-sm font-bold flex-shrink-0 transition-all border
                                ${filterEmployee === name
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                        : 'bg-[#151525] text-slate-300 border-white/10 hover:bg-white/[0.08] hover:text-white hover:border-white/25'}`}>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black mr-2 ${filterEmployee === name ? 'bg-emerald-500 text-black' : 'bg-[#2a2a40] text-slate-300 group-hover:bg-white/20'}`}>
                                    {name[0]}
                                </span>
                                <span className="mr-3">{name}</span>
                                <span className={`font-black tabular-nums ${stats.total >= 3 ? 'text-rose-400' : 'text-slate-400 group-hover:text-slate-200'}`}>{stats.total}</span>
                            </button>
                        ))}
                        {filterEmployee && (
                            <button onClick={() => setFilterEmployee('')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors flex-shrink-0 ml-1">
                                <X size={12} /> Clear Filter
                            </button>
                        )}
                    </div>
                )}

                {/* ── Period / Date Strip ───────────────────────────────────── */}
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    <div className="flex items-center gap-2 flex-shrink-0 bg-white/[0.02] px-3 py-2 rounded-xl border border-white/5">
                        <Calendar size={14} className="text-amber-400" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Period</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 flex-shrink-0 mx-1" />
                    
                    {/* All Time toggle */}
                    <button onClick={() => setPeriodFilter('')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex-shrink-0
                        ${!periodFilter ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'bg-white/[0.03] text-slate-500 border-white/5 hover:text-slate-300'}`}>
                        All Records
                    </button>

                    <div className="w-px h-6 bg-white/5 flex-shrink-0" />

                    {/* Available Periods */}
                    {availableYearMonths.map(ym => {
                        const [yr, mo] = ym.split('-');
                        const label = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
                        const isCurrentFullYear = periodFilter === yr;
                        const isSelected = periodFilter === ym;
                        
                        return (
                            <button key={ym} onClick={() => setPeriodFilter(isSelected ? '' : ym)}
                                className={`group flex flex-col items-center min-w-[60px] px-3 py-1.5 rounded-xl border transition-all flex-shrink-0
                                ${isSelected 
                                    ? 'bg-indigo-500/20 border-indigo-500/50 text-white shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
                                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'}`}>
                                <span className={`text-[9px] font-black uppercase tracking-tighter mb-0.5 ${isSelected ? 'text-indigo-400' : 'text-slate-600'}`}>{yr}</span>
                                <span className="text-xs font-bold leading-none">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Filter & Search Bar — matching Live Dashboard style ───────── */}
            <div className="flex z-10 items-center justify-between bg-black/60 backdrop-blur-md p-2.5 rounded-2xl border border-white/10 shadow-lg relative">
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm ml-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input type="text" placeholder="Search employee, client, type…" value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20 transition-all font-semibold" />
                        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"><X size={14} /></button>}
                    </div>

                    {filterType && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl ml-2">
                            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{filterType === 'sick' ? 'Sick Only' : 'Casual Only'}</span>
                            <button onClick={() => setFilterType(null)} className="text-indigo-400 hover:text-white transition-colors"><X size={12} /></button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 pr-2 pl-4 border-l border-white/10">
                    {hasFilter && (
                        <button onClick={() => { setFilterClient(''); setFilterEmployee(''); setSearch(''); setPeriodFilter(''); setFilterType(null); }}
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5 mr-4 border-r border-white/10 pr-4">
                            <X size={11} /> Clear all
                        </button>
                    )}
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {displayedLeaves.length} Match{displayedLeaves.length !== 1 ? 'es' : ''}
                    </span>
                </div>
            </div>

            {/* ── Table ───────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-white/[0.07] overflow-hidden bg-white/[0.02]">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/[0.06] bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.02)]">
                                {['Date', 'Employee', 'Client', 'Leave Type', 'Duration', 'Planned', 'Reason', 'Logged by'].map(h => {
                                    const isFilterable = ['Employee', 'Client', 'Leave Type'].includes(h);
                                    let activeFilter = false;
                                    if (h === 'Employee' && filterEmployee) activeFilter = true;
                                    if (h === 'Client' && filterClient) activeFilter = true;

                                    return (
                                        <th key={h} className="py-3 px-4 text-left whitespace-nowrap first:pl-5 relative">
                                            <div className="flex items-center gap-2 group">
                                                <button onClick={() => {
                                                    if (sortConfig?.key === h) setSortConfig({ key: h, dir: sortConfig.dir === 'asc' ? 'desc' : 'asc' });
                                                    else setSortConfig({ key: h, dir: 'asc' });
                                                }} className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-slate-500 hover:text-white transition-colors outline-none cursor-pointer">
                                                    {h}
                                                    <span className="flex flex-col opacity-0 group-hover:opacity-50 transition-opacity aria-[selected=true]:opacity-100" aria-selected={sortConfig?.key === h}>
                                                        <ChevronUp size={10} className={`-mb-1 transition-colors ${sortConfig?.key === h && sortConfig.dir === 'asc' ? 'text-emerald-400' : ''}`} />
                                                        <ChevronDown size={10} className={`transition-colors ${sortConfig?.key === h && sortConfig.dir === 'desc' ? 'text-emerald-400' : ''}`} />
                                                    </span>
                                                </button>

                                                {isFilterable && (
                                                    <div className="relative" ref={colFilterOpen === h ? colFilterRef : undefined}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setColFilterOpen(colFilterOpen === h ? null : h);
                                                            }}
                                                            className={`p-1 rounded transition-colors ${activeFilter ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500 hover:bg-white/10 hover:text-white opacity-0 group-hover:opacity-100'}`}
                                                        >
                                                            <Filter size={10} />
                                                        </button>
                                                        <AnimatePresence>
                                                            {colFilterOpen === h && (
                                                                <motion.div initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                                                    className="absolute top-full left-0 mt-2 w-48 bg-[#0C0C14] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] overflow-hidden z-[100] py-1 font-sans normal-case tracking-normal">
                                                                    <div className="px-3 py-2 border-b border-white/[0.06]">
                                                                        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Filter</span>
                                                                    </div>
                                                                    <div className="max-h-60 overflow-y-auto">
                                                                        <button onClick={() => {
                                                                            if (h === 'Employee') setFilterEmployee('');
                                                                            if (h === 'Client') setFilterClient('');
                                                                            setColFilterOpen(null);
                                                                        }}
                                                                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all ${!activeFilter ? 'bg-indigo-500/15 text-white font-bold' : 'text-slate-300 hover:bg-white/5 font-medium'}`}>
                                                                            <span className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${!activeFilter ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                                                                {!activeFilter && <span className="text-black text-[10px] font-black">✓</span>}
                                                                            </span>
                                                                            All
                                                                        </button>
                                                                        {h === 'Employee' && [...new Set(leaves.map(l => l.employee_name))].sort().map(n => (
                                                                            <button key={n} onClick={() => { setFilterEmployee(n); setColFilterOpen(null); }}
                                                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all ${filterEmployee === n ? 'bg-indigo-500/15 text-white font-bold' : 'text-slate-300 hover:bg-white/5 font-medium'}`}>
                                                                                {n}
                                                                            </button>
                                                                        ))}
                                                                        {h === 'Client' && clients.map(c => (
                                                                            <button key={c.id} onClick={() => { setFilterClient(c.name); setColFilterOpen(null); }}
                                                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all ${filterClient === c.name ? 'bg-indigo-500/15 text-white font-bold' : 'text-slate-300 hover:bg-white/5 font-medium'}`}>
                                                                                {c.name}
                                                                            </button>
                                                                        ))}
                                                                        {h === 'Leave Type' && uniqueLeaveTypes.map(lt => (
                                                                            <button key={lt} onClick={() => { setSearch(lt); setColFilterOpen(null); }}
                                                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all text-slate-300 hover:bg-white/5 font-medium`}>
                                                                                {lt}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="py-3 px-4 w-32 text-right pr-6">
                                    <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-500">Actions</span>
                                </th>
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
                                            <td className="py-3.5 px-4 pl-5 font-mono text-xs text-slate-400 whitespace-nowrap">{fmtDate(l.date)}</td>
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
                                            <td className="py-3.5 px-4"><TypeBadge type={l.leave_type} isSmart={(l as any).is_smart} /></td>
                                            <td className="py-3.5 px-4">
                                                <span className={`text-xs font-black tabular-nums ${l.day_count === 1 ? 'text-blue-400' : 'text-amber-400'}`}>
                                                    {l.day_count === 1 ? 'Full Day' : 'Half Day'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {(l as any).is_smart ? (
                                                    <span className="inline-flex items-center gap-1 text-amber-500 text-[10px] uppercase tracking-widest font-black"><AlertCircle size={10} /> Auto</span>
                                                ) : l.is_planned
                                                    ? <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold"><CheckCircle size={11} /> Yes</span>
                                                    : <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-bold"><AlertCircle size={11} /> No</span>}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-500 text-xs max-w-[130px] truncate" title={l.reason || ''}>
                                                {(l as any).is_smart ? <span className="text-amber-500/80 text-[10px] font-bold uppercase">{l.reason}</span> : (l.reason || <span className="text-slate-700">—</span>)}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">{(l as any).is_smart ? <span className="text-slate-500 italic">System Gen</span> : l.approver}</td>
                                            <td className="py-3.5 px-4 pr-6 w-32">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    {(l as any).is_smart && (
                                                        <>
                                                            <button onClick={() => startEdit(l)} title="Approve & Save"
                                                                className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all">
                                                                <CheckCircle size={14} />
                                                            </button>
                                                            <button onClick={() => declineSmartLeave(l.id)} title="Decline"
                                                                className="flex items-center justify-center w-7 h-7 rounded-md bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all">
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {!(l as any).is_smart && (
                                                        <button onClick={() => startEdit(l)} title="Edit"
                                                            className="p-1.5 rounded-md text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                                                            <Edit2 size={13} />
                                                        </button>
                                                    )}
                                                    {!(l as any).is_smart && (
                                                        <button onClick={() => setDeleteId(l.id)} title="Delete"
                                                            className="p-1.5 rounded-md text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
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
