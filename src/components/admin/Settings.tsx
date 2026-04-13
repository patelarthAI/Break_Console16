'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, Pencil, Check, X, RefreshCcw } from 'lucide-react';
import type { User, AppNotification } from '@/types';
import {
  getClients,
  addClient,
  deleteClient,
  renameClient,
  getAllUsers,
  updateUser,
  deleteUser,
  getPendingUsers,
  approveUser,
  getAllNotifications,
  createNotification,
  deleteNotification,
  type ClientRow,
} from '@/lib/store';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

interface SettingsProps {
  user: User;
}

const TIMEZONE_OPTIONS = [
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Asia/Kolkata',
];

export default function AdminSettings({ user }: SettingsProps) {
  const { success, error: toastError } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [newClient, setNewClient] = useState('');
  const [newBroadcast, setNewBroadcast] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmState, setConfirmState] = useState<{ kind: string; id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, u, n] = await Promise.all([
        getClients(true),
        getAllUsers(),
        getAllNotifications(),
      ]);
      setClients(c);
      setAllUsers(u.filter((x) => !x.isMaster));
      setNotifications(n);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const handleAddClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClient.trim()) return;
    try {
      await addClient(newClient.trim());
      setNewClient('');
      success('Client added');
      void loadData();
    } catch { toastError('Failed to add client'); }
  };

  const handleRename = async (id: string, oldName: string) => {
    if (!renameValue.trim() || renameValue === oldName) {
      setRenamingId(null);
      return;
    }
    try {
      await renameClient(id, oldName, renameValue.trim());
      setRenamingId(null);
      success('Client renamed');
      void loadData();
    } catch { toastError('Failed to rename'); }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await deleteClient(id);
      success('Client deleted');
      setConfirmState(null);
      void loadData();
    } catch { toastError('Failed to delete client'); }
  };

  const handleSaveUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateUser(editingUser.id, {
        name: editingUser.name,
        clientName: editingUser.clientName,
        isApproved: editingUser.isApproved,
        shiftStart: editingUser.shiftStart,
        shiftEnd: editingUser.shiftEnd,
        timezone: editingUser.timezone,
        workMode: editingUser.workMode,
      });
      setEditingUser(null);
      success('User updated');
      void loadData();
    } catch { toastError('Failed to update user'); }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUser(id);
      success('User deleted');
      setConfirmState(null);
      void loadData();
    } catch { toastError('Failed to delete user'); }
  };

  const handleAddBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBroadcast.trim()) return;
    try {
      await createNotification(newBroadcast.trim(), user.id);
      setNewBroadcast('');
      success('Broadcast sent');
      void loadData();
    } catch { toastError('Failed to send broadcast'); }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id);
      success('Broadcast deleted');
      setConfirmState(null);
      void loadData();
    } catch { toastError('Failed to delete broadcast'); }
  };

  const handleConfirm = async () => {
    if (!confirmState) return;
    if (confirmState.kind === 'client') await handleDeleteClient(confirmState.id);
    else if (confirmState.kind === 'user') await handleDeleteUser(confirmState.id);
    else if (confirmState.kind === 'notification') await handleDeleteNotification(confirmState.id);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={!!confirmState}
        title={`Delete ${confirmState?.name}?`}
        message={
          confirmState?.kind === 'client'
            ? 'This removes the client. Linked recruiters need manual review.'
            : confirmState?.kind === 'user'
            ? 'This permanently removes the recruiter and all time logs.'
            : 'This removes the broadcast from every workspace.'
        }
        confirmLabel="Delete"
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmState(null)}
      />

      {/* Edit User Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}
        >
          <form onSubmit={handleSaveUser} className="bg-[#0a001a]/95 border border-indigo-500/20 shadow-[0_24px_64px_rgba(0,0,0,0.9)] backdrop-blur-3xl w-full max-w-lg p-6 space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400">Edit Recruiter</h3>
              <button type="button" onClick={() => setEditingUser(null)} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"><X size={16}/></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Name</span>
                <input className="input-field" value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Client</span>
                <select className="input-field" value={editingUser.clientName} onChange={(e) => setEditingUser({ ...editingUser, clientName: e.target.value })}>
                  {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Shift Start</span>
                <input type="time" className="input-field" value={editingUser.shiftStart} onChange={(e) => setEditingUser({ ...editingUser, shiftStart: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Shift End</span>
                <input type="time" className="input-field" value={editingUser.shiftEnd} onChange={(e) => setEditingUser({ ...editingUser, shiftEnd: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Timezone</span>
                <select className="input-field" value={editingUser.timezone} onChange={(e) => setEditingUser({ ...editingUser, timezone: e.target.value })}>
                  {TIMEZONE_OPTIONS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">Work Mode</span>
                <select className="input-field" value={editingUser.workMode} onChange={(e) => setEditingUser({ ...editingUser, workMode: e.target.value as 'WFO' | 'WFH' })}>
                  <option value="WFO">Work From Office</option>
                  <option value="WFH">Work From Home</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingUser(null)} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-lg font-bold text-white">Settings</h2>

        {/* Clients */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] panel-3d">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]"></span>
              Client Management
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold">{clients.length} clients</span>
          </div>
          <form onSubmit={handleAddClient} className="flex gap-2">
            <input className="input-field flex-1" placeholder="New client name..." value={newClient} onChange={(e) => setNewClient(e.target.value)} />
            <button type="submit" className="btn btn-primary"><Plus size={14} /> Add</button>
          </form>
          <div className="space-y-1.5">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                {renamingId === c.id ? (
                  <input className="input-field flex-1 text-sm bg-black/40 border-indigo-500/30" value={renameValue} autoFocus onChange={(e) => setRenameValue(e.target.value)} onBlur={() => handleRename(c.id, c.name)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(c.id, c.name); if (e.key === 'Escape') setRenamingId(null); }} />
                ) : (
                  <span className="flex-1 text-sm text-slate-200 font-bold tracking-wide">{c.name}</span>
                )}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => { setRenamingId(c.id); setRenameValue(c.name); }} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-400/20 rounded-lg transition-all"><Pencil size={14} /></button>
                  <button type="button" onClick={() => setConfirmState({ kind: 'client', id: c.id, name: c.name })} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/20 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Users */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] panel-3d">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"></span>
              User Management
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">{allUsers.length} recruiters</span>
              <button type="button" onClick={() => void loadData()} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-all"><RefreshCcw size={14} /></button>
            </div>
          </div>
          <div className="space-y-1.5">
            {allUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-200 tracking-wide">{u.name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="text-indigo-400 font-semibold">{u.clientName}</span>
                    <span>·</span>
                    <span className="font-mono text-[10px]">{u.shiftStart}–{u.shiftEnd}</span>
                    <span>·</span>
                    <span className="uppercase text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded bg-white/5">{u.workMode}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${u.isApproved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                  {u.isApproved ? 'Approved' : 'Pending'}
                </span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                  <button type="button" onClick={() => setEditingUser(u)} className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/20 rounded-lg transition-all"><Pencil size={14} /></button>
                  <button type="button" onClick={() => setConfirmState({ kind: 'user', id: u.id, name: u.name })} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/20 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Broadcasts */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] panel-3d">
          <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]"></span>
            Broadcasts
          </h3>
          <form onSubmit={handleAddBroadcast} className="flex gap-2">
            <input className="input-field flex-1" placeholder="Type a broadcast message..." value={newBroadcast} onChange={(e) => setNewBroadcast(e.target.value)} />
            <button type="submit" className="btn btn-primary"><Plus size={14} /> Send</button>
          </form>
          <div className="space-y-1.5">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group">
                <span className="flex-1 text-sm font-medium text-slate-200">{n.message}</span>
                <span className="text-[10px] text-slate-500 font-mono font-bold mr-4">{new Date(n.createdAt).toLocaleDateString()}</span>
                <button type="button" onClick={() => setConfirmState({ kind: 'notification', id: n.id, name: 'broadcast' })} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="text-xs text-slate-500 font-bold uppercase tracking-widest text-center py-6">No active broadcasts</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
