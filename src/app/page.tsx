'use client';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, BarChart2, Clock as ClockIcon, Users, Activity,
  FileBarChart2, UserX, Settings, CalendarDays, Briefcase, Pencil, X, Search
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import ErrorBoundary from '@/components/ErrorBoundary';
import AuthModal from '@/components/AuthModal';
import Clock from '@/components/Clock';
import PunchPanel from '@/components/PunchPanel';
import StatusBadge from '@/components/StatusBadge';
import TimelineLog from '@/components/TimelineLog';
import MasterConsole from '@/components/MasterConsole';
import MasterReports from '@/components/MasterReports';
import BreakDashboard from '@/components/BreakDashboard';
import MasterLeaveTracker from '@/components/MasterLeaveTracker';
import { User, TimeLog, AppStatus } from '@/types';
import { getCurrentUser, setCurrentUser, getLogs, insertLog, getClients, addClient, deleteClient, ClientRow, getAllUsers, updateUser, getPendingUsers } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import {
  computeSession, computeWorkedTime, computeTotalTime,
  formatDuration, generateUUID, getTodayKey,
} from '@/lib/timeUtils';
import { useClock } from '@/hooks/useClock';

type MasterTab = 'dashboard' | 'reports' | 'leaves' | 'settings';
type UserTab = 'tracker' | 'team';

// ─── Pending Approval Screen ──────────────────────────────────────────────────
function PendingApproval({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.from('users').select('is_approved').eq('id', user.id).single();
      if (data?.is_approved) { setCurrentUser({ ...user, isApproved: true }); setApproved(true); }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [user]);
  if (approved) { setTimeout(() => window.location.reload(), 500); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-sm p-8 rounded-3xl text-center space-y-6">
        <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain mx-auto" />
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Awaiting Approval</h2>
          <p className="text-slate-400 text-sm">Hi <span className="text-white font-semibold">{user.name}</span>, your account is pending admin approval.</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-amber-400">
          <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span></span>
          <span className="text-sm font-medium">Checking every 5 seconds…</span>
        </div>
        <button onClick={onLogout} className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 mx-auto">
          <LogOut size={12} /> Sign out
        </button>
      </motion.div>
    </div>
  );
}

// ─── Settings Panel (Clients + Users) ────────────────────────────────────────
function SettingsPanel() {
  const { success, error: toastError, warning } = useToast();
  const [settingsTab, setSettingsTab] = useState<'clients' | 'users'>('clients');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editApproved, setEditApproved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  // ConfirmDialog state
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'client' | 'user'; id: string; name: string } | null>(null);

  useEffect(() => {
    getClients().then(d => setClients(d)).finally(() => setLoadingClients(false));
    getPendingUsers().then(p => setPendingCount(p.length)).catch(() => { });
  }, []);

  useEffect(() => {
    if (settingsTab === 'users' && allUsers.length === 0) {
      setLoadingUsers(true);
      getAllUsers().then(d => setAllUsers(d)).finally(() => setLoadingUsers(false));
    }
  }, [settingsTab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    try {
      const c = await addClient(newClientName);
      setClients(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
      setNewClientName('');
      success('Client added', `"${c.name}" is now available in dropdowns.`);
    } catch (err) { console.error(err); toastError('Failed to add client', 'Check your Supabase connection.'); }
  }

  async function confirmDeleteClient(id: string) {
    try {
      await deleteClient(id);
      const name = clients.find(c => c.id === id)?.name ?? '';
      setClients(prev => prev.filter(c => c.id !== id));
      setConfirmDelete(null);
      success('Client removed', `"${name}" has been deleted.`);
    } catch (err) { console.error(err); toastError('Failed to remove client'); setConfirmDelete(null); }
  }

  function openEditUser(u: User) {
    setEditUser(u); setEditName(u.name); setEditClient(u.clientName); setEditApproved(u.isApproved);
  }

  async function saveEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      const updated = await updateUser(editUser.id, { name: editName.trim(), clientName: editClient, isApproved: editApproved });
      setAllUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      setEditUser(null);
      success('User updated', `${editName.trim()} has been saved.`);
      if (editApproved !== editUser.isApproved) setPendingCount(prev => Math.max(0, editApproved ? prev - 1 : prev + 1));
    } catch (err) { console.error(err); toastError('Failed to save user'); } finally { setSaving(false); }
  }

  async function confirmDeleteUser(userId: string) {
    const { deleteUser } = await import('@/lib/store');
    const name = allUsers.find(u => u.id === userId)?.name ?? '';
    await deleteUser(userId);
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    setConfirmDelete(null);
    success('User deleted', `${name} and all their logs have been removed.`);
  }

  const filteredUsers = userSearch.trim()
    ? allUsers.filter(u =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.clientName.toLowerCase().includes(userSearch.toLowerCase()))
    : allUsers;

  return (
    <div className="space-y-5">
      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'client' ? `Remove "${confirmDelete?.name}"?` : `Delete ${confirmDelete?.name}?`}
        message={confirmDelete?.type === 'user' ? 'This will permanently remove the user and ALL their time logs. This cannot be undone.' : 'Recruiters using this client will lose their client assignment.'}
        confirmLabel={confirmDelete?.type === 'user' ? 'Delete User' : 'Remove Client'}
        onConfirm={() => { const d = confirmDelete; if (!d) return; d.type === 'client' ? confirmDeleteClient(d.id) : confirmDeleteUser(d.id); }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(['clients', 'users'] as const).map(t => (
          <button key={t} onClick={() => setSettingsTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
              ${settingsTab === t ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:text-white border border-white/5 hover:border-white/10'}`}>
            {t === 'clients' ? <Briefcase size={12} /> : <Users size={12} />}
            {t === 'clients' ? 'Clients' : 'All Users'}
            {t === 'users' && pendingCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black leading-none">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* CLIENTS TAB */}
        {settingsTab === 'clients' && (
          <motion.div key="clients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <form onSubmit={handleAddClient} className="flex gap-2">
              <input type="text" placeholder="New client name…" value={newClientName} onChange={e => setNewClientName(e.target.value)}
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all" />
              <button type="submit" disabled={!newClientName.trim()} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black px-5 rounded-xl font-black text-sm transition-colors">Add</button>
            </form>
            <div className="rounded-xl border border-white/8 overflow-hidden">
              {loadingClients
                ? <p className="text-center py-8 text-sm text-slate-600 animate-pulse">Loading…</p>
                : clients.length === 0
                  ? <p className="text-center py-8 text-sm text-slate-600">No clients yet.</p>
                  : <ul className="divide-y divide-white/5">{clients.map(c => (
                    <li key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02]">
                      <span className="text-sm font-semibold text-white">{c.name}</span>
                      <button onClick={() => setConfirmDelete({ type: 'client', id: c.id, name: c.name })} className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"><UserX size={14} /></button>
                    </li>
                  ))}</ul>}
            </div>
          </motion.div>
        )}

        {/* USERS TAB */}
        {settingsTab === 'users' && (
          <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {/* Edit User Modal */}
            <AnimatePresence>
              {editUser && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
                  onClick={e => { if (e.target === e.currentTarget) setEditUser(null); }}>
                  <motion.form initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                    onSubmit={saveEditUser}
                    className="w-full max-w-sm bg-[#0d0d1a] border border-white/12 rounded-2xl p-6 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <p className="font-black text-white">Edit User</p>
                      <button type="button" onClick={() => setEditUser(null)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Full Name</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Client</label>
                      <select value={editClient} onChange={e => setEditClient(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none">
                        {clients.map(c => <option key={c.id} value={c.name} className="bg-[#0d0d1a]">{c.name}</option>)}
                      </select>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={editApproved} onChange={e => setEditApproved(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                      <span className="text-sm text-slate-300">Account approved / active</span>
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button type="submit" disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-colors disabled:opacity-60">
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button type="button" onClick={() => setEditUser(null)}
                        className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm hover:text-white transition-colors">Cancel</button>
                    </div>
                  </motion.form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* User search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input type="text" placeholder="Search by name or client…" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/8 rounded-lg py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-white/15 transition-all" />
              {userSearch && <button onClick={() => setUserSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white"><X size={12} /></button>}
            </div>

            {loadingUsers
              ? <p className="text-center py-12 text-sm text-slate-600 animate-pulse">Loading users…</p>
              : filteredUsers.length === 0
                ? <p className="text-center py-12 text-sm text-slate-600">{userSearch ? 'No users match your search.' : 'No users found.'}</p>
                : (
                  <div className="rounded-xl border border-white/8 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-black/30 border-b border-white/8">
                          <th className="py-2.5 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Name</th>
                          <th className="py-2.5 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Client</th>
                          <th className="py-2.5 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                          <th className="py-2.5 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4 font-semibold text-white">{u.name}</td>
                            <td className="py-3 px-4 text-slate-400 text-xs">{u.clientName}</td>
                            <td className="py-3 px-4">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md
                                ${u.isApproved ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'}`}>
                                {u.isApproved ? 'Active' : 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openEditUser(u)} className="p-1.5 text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all" title="Edit"><Pencil size={13} /></button>
                                <button onClick={() => setConfirmDelete({ type: 'user', id: u.id, name: u.name })} className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all" title="Delete"><UserX size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-2 border-t border-white/5 bg-black/10">
                      <p className="text-[10px] text-slate-700">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}{userSearch ? ` matching "${userSearch}"` : ''} · {allUsers.filter(u => !u.isApproved).length} pending approval</p>
                    </div>
                  </div>
                )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [masterTab, setMasterTab] = useState<MasterTab>('dashboard');
  const [userTab, setUserTab] = useState<UserTab>('tracker');
  const [logsLoading, setLogsLoading] = useState(false);
  const now = useClock();

  useEffect(() => {
    const saved = getCurrentUser();
    if (saved) { setUser(saved); if (saved.isApproved) loadLogs(saved.id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLogs(userId: string) {
    setLogsLoading(true);
    try { const todayLogs = await getLogs(userId, getTodayKey()); setLogs(todayLogs); restoreStatus(todayLogs); }
    finally { setLogsLoading(false); }
  }

  function restoreStatus(todayLogs: TimeLog[]) {
    if (!todayLogs.length) return;
    const last = todayLogs[todayLogs.length - 1];
    const map: Record<string, AppStatus> = { punch_in: 'working', punch_out: 'punched_out', break_start: 'on_break', break_end: 'working', brb_start: 'on_brb', brb_end: 'working' };
    setStatus(map[last.eventType] ?? 'idle');
  }

  const addLog = useCallback(async (eventType: TimeLog['eventType']) => {
    if (!user) return;
    const log: TimeLog = { id: generateUUID(), eventType, timestamp: Date.now(), date: getTodayKey() };
    setLogs((prev) => [...prev, log]);
    await insertLog(user.id, log);
  }, [user]);

  const handleLogin = async (u: User) => { setUser(u); if (u.isApproved) await loadLogs(u.id); };
  const handleLogout = () => {
    setCurrentUser(null); setUser(null); setLogs([]); setStatus('idle');
    setMasterTab('dashboard'); setUserTab('tracker');
  };

  const session = computeSession(logs);
  const nowMs = now.getTime();
  const workedMs = computeWorkedTime(session, nowMs);
  const breakMs = computeTotalTime(session.breaks, nowMs);
  const brbMs = computeTotalTime(session.brbs, nowMs);
  const isMaster = user?.isMaster ?? false;

  const MASTER_TABS = [
    { id: 'dashboard' as const, label: 'Live Dashboard', icon: <Activity size={15} /> },
    { id: 'reports' as const, label: 'Data Reports', icon: <FileBarChart2 size={15} /> },
    { id: 'leaves' as const, label: 'Leave Tracker', icon: <CalendarDays size={15} /> },
    { id: 'settings' as const, label: 'Settings', icon: <Settings size={15} /> },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center p-4 pt-6 pb-16 relative">
      {/* Background glows */}
      <div className="fixed top-0 left-0 w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-[#ffd700]/4 rounded-full blur-[120px] pointer-events-none" />

      {!user && <AuthModal onLogin={handleLogin} />}
      {user && !user.isMaster && !user.isApproved && <PendingApproval user={user} onLogout={handleLogout} />}

      <AnimatePresence>
        {user && (user.isMaster || user.isApproved) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full ${isMaster ? 'max-w-6xl' : 'max-w-md'} flex flex-col gap-0`}>

            {/* ── TOP NAV SHELL ── */}
            <div className="glass-card rounded-2xl px-5 py-3 flex items-center justify-between mb-0 border-b-0 rounded-b-none">
              {/* Brand */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-black border flex-shrink-0
                  ${isMaster ? 'border-amber-500/30 bg-amber-500/10' : 'bg-blue-900/40 border-blue-500/40 text-blue-300'}`}>
                  {isMaster
                    ? <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
                    : user.name[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-white tracking-tight">{isMaster ? 'Breakthrough Console' : user.name}</p>
                    {isMaster && <span className="text-[9px] uppercase font-black tracking-widest bg-amber-500 text-black px-1.5 py-0.5 rounded-md">Admin</span>}
                    {!isMaster && user.clientName && (
                      <span className="text-[9px] uppercase font-black tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-md">{user.clientName}</span>
                    )}
                  </div>
                  {isMaster && <p className="text-[10px] text-slate-600 mt-0.5 tracking-wider uppercase">Master Control</p>}
                </div>
              </div>

              {/* Master Tab Nav — lives inside the top bar on desktop */}
              {isMaster && (
                <nav className="flex items-center gap-1 bg-black/30 border border-white/8 rounded-xl p-1">
                  {MASTER_TABS.map(t => (
                    <button key={t.id} onClick={() => setMasterTab(t.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-200
                        ${masterTab === t.id
                          ? 'bg-amber-500 text-black shadow-[0_2px_12px_rgba(245,158,11,0.4)]'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </nav>
              )}

              {/* Sign out */}
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all">
                <LogOut size={13} /> Sign out
              </button>
            </div>

            {/* ── CONTENT AREA ── */}
            <div className="glass-card rounded-2xl rounded-t-none border-t-0 p-6 shadow-2xl min-h-[60vh]">

              {/* ════ MASTER ════ */}
              {isMaster && (
                <AnimatePresence mode="wait">
                  <motion.div key={masterTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                    {masterTab === 'dashboard' && <ErrorBoundary fallbackLabel="Dashboard failed to load"><MasterConsole currentUserId={user.id} isMaster={true} /></ErrorBoundary>}
                    {masterTab === 'reports' && <ErrorBoundary fallbackLabel="Reports failed to load"><MasterReports /></ErrorBoundary>}
                    {masterTab === 'leaves' && <ErrorBoundary fallbackLabel="Leave tracker failed to load"><MasterLeaveTracker currentUser={user} /></ErrorBoundary>}
                    {masterTab === 'settings' && <ErrorBoundary fallbackLabel="Settings failed to load"><SettingsPanel /></ErrorBoundary>}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* ════ USER ════ */}
              {!isMaster && (
                <>
                  {/* User sub-tabs */}
                  <div className="flex gap-2 mb-6">
                    {([
                      { id: 'tracker' as const, label: 'My Tracker', icon: <ClockIcon size={14} /> },
                      { id: 'team' as const, label: 'Team Status', icon: <Users size={14} /> },
                    ]).map(t => (
                      <button key={t.id} onClick={() => setUserTab(t.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-200
                          ${userTab === t.id ? 'bg-blue-600 text-white shadow-[0_4px_16px_rgba(37,99,235,0.4)]' : 'text-slate-400 hover:text-white bg-white/[0.03] border border-white/8'}`}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    {userTab === 'tracker' && (
                      <motion.div key="tracker" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                        <Clock />
                        <div className="flex justify-center"><StatusBadge status={status as Exclude<AppStatus, 'on_leave'>} /></div>
                        {logsLoading && <p className="text-center text-xs text-slate-600 animate-pulse">Loading session…</p>}
                        {status !== 'idle' && !logsLoading && (
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: 'Worked', value: formatDuration(workedMs), color: 'text-amber-400', border: 'border-amber-500/20' },
                              { label: 'Break', value: formatDuration(breakMs), color: 'text-blue-400', border: 'border-blue-500/20' },
                              { label: 'BRB', value: formatDuration(brbMs), color: 'text-violet-400', border: 'border-violet-500/20' },
                            ].map(s => (
                              <div key={s.label} className={`bg-white/[0.03] border ${s.border} rounded-xl p-3 text-center`}>
                                <p className={`text-base font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
                                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-600 mt-1">{s.label}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <PunchPanel
                          status={status as Exclude<AppStatus, 'on_leave'>}
                          onPunchIn={() => { addLog('punch_in'); setStatus('working'); }}
                          onStartBreak={() => { addLog('break_start'); setStatus('on_break'); }}
                          onEndBreak={() => { addLog('break_end'); setStatus('working'); }}
                          onPunchOut={() => { addLog('punch_out'); setStatus('punched_out'); }}
                          onBRBIn={() => { addLog('brb_start'); setStatus('on_brb'); }}
                          onBRBOut={() => { addLog('brb_end'); setStatus('working'); }}
                        />
                        <div className="border-t border-white/5 pt-5">
                          <div className="flex items-center gap-2 mb-4">
                            <BarChart2 size={15} className="text-slate-500" />
                            <h3 className="text-sm font-bold text-slate-400">Today's Timeline</h3>
                            <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-wider">{logs.length} events</span>
                          </div>
                          <TimelineLog logs={logs} />
                        </div>
                      </motion.div>
                    )}
                    {userTab === 'team' && (
                      <motion.div key="team" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <BreakDashboard currentUserId={user.id} isMaster={false} clientName={user.clientName} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
