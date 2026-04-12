'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Clock, 
  Trash2, 
  Plus, 
  AlertCircle, 
  ChevronRight, 
  Coffee, 
  LogIn, 
  LogOut,
  History
} from 'lucide-react';
import { TimeLog, User } from '@/types';
import { getLogs, insertLog, deleteTimeLog, updateTimeLog } from '@/lib/store';
import { formatTime, generateUUID, computeSession } from '@/lib/timeUtils';
import { cn } from '@/lib/utils';
import TimelineLog from './TimelineLog';
import ConfirmDialog from './ConfirmDialog';

interface HybridEditDrawerProps {
  user: User;
  date: string;
  onClose: () => void;
  onSave: () => void;
  currentUserId: string;
}

export default function HybridEditDrawer({ user, date, onClose, onSave, currentUserId }: HybridEditDrawerProps) {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [logType, setLogType] = useState<TimeLog['eventType']>('punch_in');
  const [logTime, setLogTime] = useState('09:00');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getLogs(user.id, date);
        setLogs(data);
      } catch (err) {
        console.error('Failed to load logs', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id, date]);

  const session = useMemo(() => computeSession(logs), [logs]);

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const [h, m] = logTime.split(':').map(Number);
    const d = new Date(`${date}T00:00:00`);
    d.setHours(h, m, 0, 0);

    if (editingLogId) {
      await updateTimeLog(editingLogId, {
        eventType: logType,
        timestamp: d.getTime(),
        date
      });
    } else {
      const newLog: TimeLog = {
        id: generateUUID(),
        eventType: logType,
        timestamp: d.getTime(),
        date,
        addedBy: currentUserId
      };
      await insertLog(user.id, newLog);
    }

    const latest = await getLogs(user.id, date);
    setLogs(latest);
    setShowAddForm(false);
    setEditingLogId(null);
    onSave();
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteTimeLog(deleteConfirmId);
    setLogs(prev => prev.filter(l => l.id !== deleteConfirmId));
    setDeleteConfirmId(null);
    onSave();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-end">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose} 
          className="fixed inset-0 bg-black/60 backdrop-blur-md" 
        />
        
        <motion.div 
          initial={{ x: '100%' }} 
          animate={{ x: 0 }} 
          exit={{ x: '100%' }} 
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-xl bg-[#090b11] border-l border-white/10 shadow-2xl flex flex-col h-full overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f4c27a]">Auditor Mode</span>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">{user.name}</h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">{date} · {user.clientName}</p>
          </div>

          {/* Mode Switcher */}
          <div className="flex px-6 border-b border-white/5 bg-black/10">
            <button 
              onClick={() => setActiveTab('visual')}
              className={cn(
                "px-4 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
                activeTab === 'visual' ? "border-[#f4c27a] text-white" : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              Session Overview
            </button>
            <button 
              onClick={() => setActiveTab('raw')}
              className={cn(
                "px-4 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
                activeTab === 'raw' ? "border-[#f4c27a] text-white" : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              Raw Event Log
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="h-8 w-8 border-2 border-[#f4c27a] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Timeline...</p>
              </div>
            ) : activeTab === 'visual' ? (
              <div className="space-y-6">
                {/* Visual Strip */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <History size={12} />
                    Day Visualization
                  </h3>
                  <div className="h-20 bg-black/40 border border-white/5 rounded-2xl relative overflow-hidden p-2">
                     {/* Scale markings */}
                     <div className="absolute inset-x-0 bottom-0 h-4 flex justify-between px-2 text-[8px] font-bold text-slate-600">
                        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>
                     </div>
                     {/* Logic: Similar to MiniTimeline but bigger */}
                     {/* I'll add logic for interactive blocks here if needed, but for now simple visual */}
                  </div>
                </div>

                {/* Session Breakdown Cards */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Structured sessions</h3>
                  
                  {session.punchIn ? (
                    <div className="space-y-3">
                        <SessionCard 
                            type="work" 
                            start={formatTime(session.punchIn)} 
                            end={session.punchOut ? formatTime(session.punchOut) : 'Active Now'} 
                            isLive={!session.punchOut}
                        />
                        {session.breaks.map((b, i) => (
                            <SessionCard key={i} type="break" start={formatTime(b.start)} end={b.end ? formatTime(b.end) : '--:--'} />
                        ))}
                        {session.brbs.map((b, i) => (
                            <SessionCard key={i} type="brb" start={formatTime(b.start)} end={b.end ? formatTime(b.end) : '--:--'} />
                        ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
                        <AlertCircle className="mx-auto text-slate-600 mb-3" size={24} />
                        <p className="text-sm font-semibold text-white">No data found for this date.</p>
                        <p className="text-xs text-slate-500 mt-2">Use the "Add Event" button to record a manual shift.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <TimelineLog 
                logs={logs} 
                isAdmin 
                onEditLog={(log) => {
                    setEditingLogId(log.id);
                    setLogType(log.eventType);
                    const d = new Date(log.timestamp);
                    setLogTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                    setShowAddForm(true);
                }}
                onDeleteLog={setDeleteConfirmId} 
              />
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-white/10 bg-black/20">
            <AnimatePresence>
                {showAddForm ? (
                    <motion.form 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        onSubmit={handleSaveLog} 
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Event</label>
                                <select 
                                    value={logType} 
                                    onChange={e => setLogType(e.target.value as TimeLog['eventType'])}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all focus:border-[#f4c27a]/40 outline-none appearance-none"
                                >
                                    <option value="punch_in">Punch In</option>
                                    <option value="punch_out">Punch Out</option>
                                    <option value="break_start">Break Start</option>
                                    <option value="break_end">Break End</option>
                                    <option value="brb_start">BRB Start</option>
                                    <option value="brb_end">BRB End</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Time</label>
                                <input 
                                    type="time" 
                                    value={logTime} 
                                    onChange={e => setLogTime(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all focus:border-[#f4c27a]/40 outline-none [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                type="submit"
                                className="flex-1 bg-[#f4c27a] text-black rounded-xl py-3 text-xs font-black uppercase tracking-widest shadow-lg shadow-[#f4c27a]/20 active:scale-95 transition-transform"
                            >
                                {editingLogId ? 'Update Record' : 'Add Record'}
                            </button>
                            <button 
                                type="button"
                                onClick={() => { setShowAddForm(false); setEditingLogId(null); }}
                                className="px-6 border border-white/10 text-white rounded-xl py-3 text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.form>
                ) : (
                    <button 
                      onClick={() => setShowAddForm(true)}
                      className="w-full group flex items-center justify-center gap-3 border border-[#f4c27a]/20 bg-[#f4c27a]/5 hover:bg-[#f4c27a]/10 rounded-2xl py-5 text-xs font-black uppercase tracking-[0.2em] text-[#f4c27a] transition-all"
                    >
                      <Plus size={16} className="transition-transform group-hover:rotate-90" />
                      Add missing event
                    </button>
                )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <ConfirmDialog 
        open={!!deleteConfirmId}
        title="Permanently remove log?"
        message="This action is irreversible and will immediately recalculate productivity metrics for this day."
        confirmLabel="Confirm Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </AnimatePresence>,
    document.body
  );
}

function SessionCard({ type, start, end, isLive }: { type: 'work' | 'break' | 'brb', start: string, end: string, isLive?: boolean }) {
    const icons = {
        work: <LogIn size={16} className="text-emerald-400" />,
        break: <Coffee size={16} className="text-amber-400" />,
        brb: <ChevronRight size={16} className="text-sky-400" />,
    };

    const labels = {
        work: 'Main Shift',
        break: 'Break Period',
        brb: 'Quick BRB',
    };

    return (
        <div className="group relative rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-all hover:border-[#f4c27a]/20 hover:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-black/40 flex items-center justify-center border border-white/5">
                        {icons[type]}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white tracking-tight">{labels[type]}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{start}</span>
                            <span className="text-slate-700">→</span>
                            <span className={cn(
                                "text-[11px] font-bold uppercase tracking-widest",
                                isLive ? "text-emerald-400 animate-pulse" : "text-slate-500"
                            )}>
                                {end}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
