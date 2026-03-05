'use client';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, BarChart2, Clock as ClockIcon, Users, Activity,
  FileBarChart2, UserX, Settings, CalendarDays, Briefcase, Pencil, X, Search, Bell, Trash2
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
import NotificationPanel from '@/components/NotificationPanel';
import { User, TimeLog, AppStatus, AppNotification } from '@/types';
import {
  getCurrentUser, setCurrentUser, getLogs, insertLog, getClients, addClient, deleteClient,
  ClientRow, getAllUsers, updateUser, getPendingUsers,
  getAllNotifications, createNotification, deleteNotification
} from '@/lib/store';
import { supabase } from '@/lib/supabase';
import {
  computeSession, computeWorkedTime, computeTotalTime,
  formatDuration, generateUUID, getTodayKey, setServerOffset, getRealNow
} from '@/lib/timeUtils';
import { useClock } from '@/hooks/useClock';

type MasterTab = 'dashboard' | 'reports' | 'leaves' | 'settings';
type UserTab = 'tracker' | 'team';

// ─── Custom Time Picker ───────────────────────────────────────────────────────
function CustomTimePicker({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 30) {
      const h = i.toString().padStart(2, '0');
      const m = j.toString().padStart(2, '0');
      options.push(`${h}:${m}`);
    }
  }

  const formatDisplay = (h24: string) => {
    if (!h24) return '--:-- AM';
    const [h, m] = h24.split(':');
    let hr = parseInt(h, 10);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    if (hr > 12) hr -= 12;
    if (hr === 0) hr = 12;
    return `${hr.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all hover:bg-white/[0.06]"
      >
        <span className="font-semibold">{value ? formatDisplay(value) : '--:-- AM'}</span>
        <ClockIcon size={13} className="text-slate-500" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[150]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#131326] border border-blue-500/30 rounded-xl shadow-2xl shadow-blue-900/10 z-[200] scrollbar-thin scrollbar-thumb-white/10"
            >
              <div className="flex flex-col py-1.5 px-1.5">
                {options.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { onChange(opt); setOpen(false); }}
                    className={`text-left rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${value === opt ? 'bg-blue-500/20 text-blue-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                  >
                    {formatDisplay(opt)}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  const [settingsTab, setSettingsTab] = useState<'clients' | 'users' | 'notifications'>('clients');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [newClientName, setNewClientName] = useState('');
  const [loadingClients, setLoadingClients] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editApproved, setEditApproved] = useState(true);
  const [editShiftStart, setEditShiftStart] = useState('08:00');
  const [editShiftEnd, setEditShiftEnd] = useState('17:00');
  const [editTimezone, setEditTimezone] = useState('America/Chicago');
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [newNotif, setNewNotif] = useState('');
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const adminId = getCurrentUser()?.id ?? '';
  // ConfirmDialog state
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'client' | 'user' | 'notification'; id: string; name: string } | null>(null);

  useEffect(() => {
    getClients().then(d => setClients(d)).finally(() => setLoadingClients(false));
    getPendingUsers().then(p => setPendingCount(p.length)).catch(() => { });
  }, []);

  useEffect(() => {
    if (settingsTab === 'users' && allUsers.length === 0) {
      setLoadingUsers(true);
      getAllUsers().then(d => setAllUsers(d)).finally(() => setLoadingUsers(false));
    }
    if (settingsTab === 'notifications' && notifications.length === 0) {
      setLoadingNotifs(true);
      getAllNotifications().then(d => setNotifications(d)).finally(() => setLoadingNotifs(false));
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
    setEditUser(u);
    setEditName(u.name);
    setEditClient(u.clientName);
    setEditApproved(u.isApproved);
    setEditShiftStart(u.shiftStart ?? '08:00');
    setEditShiftEnd(u.shiftEnd ?? '17:00');
    setEditTimezone(u.timezone ?? 'America/Chicago');
  }

  async function saveEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      const updated = await updateUser(editUser.id, {
        name: editName.trim(),
        clientName: editClient,
        isApproved: editApproved,
        shiftStart: editShiftStart,
        shiftEnd: editShiftEnd,
        timezone: editTimezone,
      });
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

  async function confirmDeleteNotification(id: string) {
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setConfirmDelete(null);
      success('Notification deleted', 'It has been removed from all recruiter panels.');
    } catch (err) { console.error(err); toastError('Failed to delete notification'); setConfirmDelete(null); }
  }

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault();
    if (!newNotif.trim()) return;
    try {
      await createNotification(newNotif.trim(), adminId);
      setNewNotif('');
      // Refresh the list immediately
      const fresh = await getAllNotifications();
      setNotifications(fresh);
      success('Broadcast Sent', 'Notification appears instantly on all active recruiter screens.');
    } catch (err) { console.error(err); toastError('Failed to send completely'); }
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
        title={
          confirmDelete?.type === 'client' ? `Remove "${confirmDelete?.name}"?` :
            confirmDelete?.type === 'notification' ? 'Delete Broadcast?' :
              `Delete ${confirmDelete?.name}?`
        }
        message={
          confirmDelete?.type === 'user' ? 'This will permanently remove the user and ALL their time logs. This cannot be undone.' :
            confirmDelete?.type === 'notification' ? 'This will instantly remove it from all recruiter screens.' :
              'Recruiters using this client will lose their client assignment.'
        }
        confirmLabel={
          confirmDelete?.type === 'user' ? 'Delete User' :
            confirmDelete?.type === 'notification' ? 'Delete Broadcast' :
              'Remove Client'
        }
        onConfirm={() => {
          const d = confirmDelete; if (!d) return;
          if (d.type === 'client') confirmDeleteClient(d.id);
          else if (d.type === 'notification') confirmDeleteNotification(d.id);
          else confirmDeleteUser(d.id);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(['clients', 'users', 'notifications'] as const).map(t => (
          <button key={t} onClick={() => setSettingsTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
              ${settingsTab === t ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:text-white border border-white/5 hover:border-white/10'}`}>
            {t === 'clients' && <Briefcase size={12} />}
            {t === 'users' && <Users size={12} />}
            {t === 'notifications' && <Bell size={12} />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'users' && pendingCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black leading-none">{pendingCount}</span>
            )}
            {t === 'notifications' && notifications.filter(n => n.isActive).length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-black leading-none">{notifications.filter(n => n.isActive).length}</span>
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
                    {/* Shift Time */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Shift Hours</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] text-slate-600 mb-1">Start</p>
                          <CustomTimePicker value={editShiftStart} onChange={setEditShiftStart} />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-600 mb-1">End</p>
                          <CustomTimePicker value={editShiftEnd} onChange={setEditShiftEnd} />
                        </div>
                      </div>
                    </div>
                    {/* Timezone */}
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Timezone (US)</label>
                      <select value={editTimezone} onChange={e => setEditTimezone(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none">
                        <option value="America/Chicago" className="bg-[#0d0d1a]">Central (CT) — Chicago</option>
                        <option value="America/New_York" className="bg-[#0d0d1a]">Eastern (ET) — New York</option>
                        <option value="America/Denver" className="bg-[#0d0d1a]">Mountain (MT) — Denver</option>
                        <option value="America/Los_Angeles" className="bg-[#0d0d1a]">Pacific (PT) — Los Angeles</option>
                        <option value="America/Phoenix" className="bg-[#0d0d1a]">Arizona (AZ) — No DST</option>
                      </select>
                    </div>
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
                            <td className="py-3 px-4">
                              <p className="font-semibold text-white">{u.name}</p>
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                {u.shiftStart ?? '08:00'} – {u.shiftEnd ?? '17:00'} &nbsp;·&nbsp;
                                {(u.timezone ?? 'America/Chicago').replace('America/', '')}
                              </p>
                            </td>
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

        {/* NOTIFICATIONS TAB */}
        {settingsTab === 'notifications' && (
          <motion.div key="notifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

            {/* Compose area */}
            <div className="bg-gradient-to-br from-blue-500/[0.05] to-indigo-500/[0.02] border border-blue-500/10 rounded-2xl p-5">
              <h3 className="font-black text-white mb-1 flex items-center gap-2">
                <Bell size={16} className="text-blue-400" />
                Broadcast Notification
              </h3>
              <p className="text-[11px] text-slate-500 mb-4">Messages appear instantly on all active recruiter screens. They can individual dismiss them.</p>
              <form onSubmit={handleSendNotification} className="space-y-3">
                <div className="relative">
                  <textarea
                    value={newNotif}
                    onChange={e => setNewNotif(e.target.value)}
                    placeholder="Type an announcement to broadcast..."
                    className="w-full bg-[#0d0d1a]/50 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all resize-none min-h-[100px]"
                    maxLength={300}
                  />
                  <span className={`absolute bottom-3 right-4 text-[10px] font-bold ${newNotif.length > 280 ? 'text-rose-400' : 'text-slate-600'}`}>
                    {newNotif.length}/300
                  </span>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={!newNotif.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:grayscale text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
                    <Bell size={14} /> Send Broadcast
                  </button>
                </div>
              </form>
            </div>

            {/* Active List */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 px-1 border-b border-white/5 pb-2">Recent Broadcasts</h4>
              {loadingNotifs ? (
                <p className="py-8 text-sm text-slate-600 text-center animate-pulse">Loading...</p>
              ) : notifications.length === 0 ? (
                <div className="py-12 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                  <Bell size={24} className="mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="text-sm text-slate-500">No broadcasts sent yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map(n => (
                    <div key={n.id} className="group flex items-start justify-between bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 rounded-xl p-4 transition-colors">
                      <div className="pr-8">
                        <p className="text-sm text-slate-300 leading-relaxed mb-2">{n.message}</p>
                        <p className="text-[10px] text-slate-600 font-medium">
                          Sent {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => setConfirmDelete({ type: 'notification', id: n.id, name: 'this broadcast' })}
                        className="p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                        title="Delete for everyone"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
    // 1. Sync server time to ignore local OS clock spoofing/wrong timezones
    fetch('/api/time')
      .then(res => res.json())
      .then(data => { if (data.now) setServerOffset(data.now); })
      .catch(e => console.error('Failed to sync server time:', e));

    // 2. Load user session
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
    const log: TimeLog = { id: generateUUID(), eventType, timestamp: getRealNow(), date: getTodayKey() };
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
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border
                  ${isMaster ? 'border-indigo-500/30 bg-indigo-500/10' : 'bg-indigo-900/30 border-indigo-500/30'}`}>
                  {isMaster
                    ? <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
                    : <span className="text-sm font-black text-indigo-300">{user.name[0].toUpperCase()}</span>}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white tracking-tight">{isMaster ? 'Brigade Pulse' : user.name}</p>
                    {isMaster && (
                      <>
                        <span className="text-[9px] uppercase font-black tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">Admin</span>
                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                          <span className="badge-dot live"></span> Live
                        </span>
                      </>
                    )}
                    {!isMaster && user.clientName && (
                      <span className="text-[9px] uppercase font-black tracking-widest bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-1.5 py-0.5 rounded">{user.clientName}</span>
                    )}
                  </div>
                  {isMaster && <p className="text-[10px] text-slate-600 mt-0.5 tracking-wider uppercase">Master Control · {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
                </div>
              </div>

              {/* Master Tab Nav */}
              {isMaster && (
                <nav className="flex items-center gap-0.5 bg-black/30 border border-white/8 rounded-xl p-1">
                  {MASTER_TABS.map(t => (
                    <button key={t.id} onClick={() => setMasterTab(t.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150
                        ${masterTab === t.id
                          ? 'bg-indigo-600 text-white shadow-[0_2px_12px_rgba(99,102,241,0.4)]'
                          : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </nav>
              )}

              {/* Sign out */}
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-rose-400 hover:bg-rose-500/8 border border-transparent hover:border-rose-500/15 transition-all">
                <LogOut size={12} /> Sign out
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
                      <motion.div key="tracker" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5 relative">
                        {/* The modern floating notification panel for recruiters */}
                        <NotificationPanel userId={user.id} />

                        <Clock />
                        <div className="flex justify-center"><StatusBadge status={status as Exclude<AppStatus, 'on_leave'>} /></div>
                        {logsLoading && <p className="text-center text-xs text-slate-600 animate-pulse">Loading session…</p>}
                        {status !== 'idle' && !logsLoading && (
                          <div className="grid grid-cols-3 gap-2.5">
                            {[
                              { label: 'Worked', value: formatDuration(workedMs), color: 'text-emerald-400', borderColor: 'border-emerald-500/20', bgColor: 'bg-emerald-500/5' },
                              { label: 'Break Time', value: formatDuration(breakMs), color: 'text-orange-400', borderColor: 'border-orange-500/20', bgColor: 'bg-orange-500/5' },
                              { label: 'BRB Time', value: formatDuration(brbMs), color: 'text-sky-400', borderColor: 'border-sky-500/20', bgColor: 'bg-sky-500/5' },
                            ].map(s => (
                              <div key={s.label} className={`border ${s.borderColor} ${s.bgColor} rounded-xl p-3 text-center`}>
                                <p className={`text-base font-bold font-mono tabular-nums ${s.color}`}>{s.value}</p>
                                <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-600 mt-0.5">{s.label}</p>
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
