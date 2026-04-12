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
          <form onSubmit={handleSaveUser} className="card-elevated w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Edit Recruiter</h3>
              <button type="button" onClick={() => setEditingUser(null)} className="btn btn-ghost text-xs">Close</button>
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
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Client Management</h3>
            <span className="badge badge-idle text-[9px]">{clients.length} clients</span>
          </div>
          <form onSubmit={handleAddClient} className="flex gap-2">
            <input className="input-field flex-1" placeholder="New client name..." value={newClient} onChange={(e) => setNewClient(e.target.value)} />
            <button type="submit" className="btn btn-primary"><Plus size={14} /> Add</button>
          </form>
          <div className="space-y-1">
            {clients.map((c) => (
              <div key={c.id} className="table-row">
                {renamingId === c.id ? (
                  <input className="input-field flex-1 text-sm" value={renameValue} autoFocus onChange={(e) => setRenameValue(e.target.value)} onBlur={() => handleRename(c.id, c.name)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(c.id, c.name); if (e.key === 'Escape') setRenamingId(null); }} />
                ) : (
                  <span className="flex-1 text-sm text-white font-medium">{c.name}</span>
                )}
                <div className="flex gap-1">
                  <button type="button" onClick={() => { setRenamingId(c.id); setRenameValue(c.name); }} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-all"><Pencil size={13} /></button>
                  <button type="button" onClick={() => setConfirmState({ kind: 'client', id: c.id, name: c.name })} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Users */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">User Management</h3>
            <div className="flex items-center gap-2">
              <span className="badge badge-idle text-[9px]">{allUsers.length} recruiters</span>
              <button type="button" onClick={() => void loadData()} className="p-1 text-slate-500 hover:text-white rounded transition-colors"><RefreshCcw size={13} /></button>
            </div>
          </div>
          <div className="space-y-1">
            {allUsers.map((u) => (
              <div key={u.id} className="table-row group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.clientName} · {u.shiftStart}–{u.shiftEnd} · <span className="text-slate-400 font-bold">{u.workMode}</span></div>
                </div>
                <span className={`badge text-[9px] ${u.isApproved ? 'badge-working' : 'badge-leave'}`}>
                  {u.isApproved ? 'Approved' : 'Pending'}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => setEditingUser(u)} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-all"><Pencil size={13} /></button>
                  <button type="button" onClick={() => setConfirmState({ kind: 'user', id: u.id, name: u.name })} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Broadcasts */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Broadcasts</h3>
          <form onSubmit={handleAddBroadcast} className="flex gap-2">
            <input className="input-field flex-1" placeholder="Type a broadcast message..." value={newBroadcast} onChange={(e) => setNewBroadcast(e.target.value)} />
            <button type="submit" className="btn btn-primary"><Plus size={14} /> Send</button>
          </form>
          <div className="space-y-1">
            {notifications.map((n) => (
              <div key={n.id} className="table-row">
                <span className="flex-1 text-sm text-slate-300">{n.message}</span>
                <span className="text-[10px] text-slate-600">{new Date(n.createdAt).toLocaleDateString()}</span>
                <button type="button" onClick={() => setConfirmState({ kind: 'notification', id: n.id, name: 'broadcast' })} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"><Trash2 size={13} /></button>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="text-xs text-slate-500 text-center py-4">No active broadcasts</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
