'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Clock, RotateCcw, RotateCw, LogIn, LogOut, Coffee, PlayCircle, Trash2 } from 'lucide-react';
import { TimeLog, User } from '@/types';
import { getLogs, insertLog, deleteTimeLog, updateTimeLog } from '@/lib/store';
import { formatTime, generateUUID, getTodayKey } from '@/lib/timeUtils';
import TimelineLog from './TimelineLog';
import ConfirmDialog from './ConfirmDialog';

interface DailyLogEditorProps {
    user: User;
    initialDate: string;
    onClose: () => void;
    onSave: () => void;
    currentUserId: string;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

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
            <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all hover:bg-white/[0.06]">
                <span className="font-semibold">{value ? formatDisplay(value) : '--:-- AM'}</span>
                <Clock size={13} className="text-slate-500" />
            </button>
            <AnimatePresence>
                {open && (
                    <>
                        <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -5 }} className="absolute bottom-full mb-1 left-0 right-0 max-h-48 overflow-y-auto bg-[#131326] border border-blue-500/30 rounded-xl shadow-2xl z-[210] scrollbar-thin">
                            <div className="flex flex-col py-1 mt-1 flex-col-reverse">
                                {options.map(opt => (
                                    <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); }} className={`text-left rounded-lg px-3 py-1.5 mx-1 text-[13px] font-semibold transition-colors ${value === opt ? 'bg-blue-500/20 text-blue-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
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

export default function DailyLogEditor({ user, initialDate, onClose, onSave, currentUserId }: DailyLogEditorProps) {
    const [logs, setLogs] = useState<TimeLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [addLogType, setAddLogType] = useState('punch_in');
    const [addLogTime, setAddLogTime] = useState('08:00');
    const [addLogDate, setAddLogDate] = useState(initialDate);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        getLogs(user.id, addLogDate).then(setLogs).finally(() => setLoading(false));
    }, [user.id, addLogDate]);

    function handleEditLog(log: TimeLog) {
        setEditingLogId(log.id);
        setAddLogType(log.eventType);
        setAddLogDate(log.date);
        const d = new Date(log.timestamp);
        setAddLogTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }

    async function handleAddLog(e: React.FormEvent) {
        e.preventDefault();
        const [hStr, mStr] = addLogTime.split(':');
        const d = new Date(`${addLogDate}T00:00:00`);
        d.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);

        if (editingLogId) {
            await updateTimeLog(editingLogId, {
                eventType: addLogType as TimeLog['eventType'],
                timestamp: d.getTime(),
                date: addLogDate
            });
            setEditingLogId(null);
        } else {
            const newLog: TimeLog = {
                id: generateUUID(),
                eventType: addLogType as TimeLog['eventType'],
                timestamp: d.getTime(),
                date: addLogDate,
                addedBy: currentUserId
            };
            await insertLog(user.id, newLog);
        }
        
        const latest = await getLogs(user.id, addLogDate);
        setLogs(latest);
        onSave();
    }

    async function confirmDeleteLog() {
        if (!deleteConfirmId) return;
        await deleteTimeLog(deleteConfirmId);
        setLogs(prev => prev.filter(l => l.id !== deleteConfirmId));
        setDeleteConfirmId(null);
        onSave();
    }

    if (typeof document === 'undefined') return null;

    return createPortal(
        <>
            <AnimatePresence>
                <div className="fixed inset-0 z-[150] flex justify-end overflow-hidden">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm shadow-2xl" />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="relative w-full max-w-md bg-[#0a0a1a] border-l border-white/10 shadow-2xl flex flex-col h-full">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">{user.name}</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{user.clientName} · Timeline Editor</p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Historical Timeline</h3>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">Admin Override Enabled</span>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 shadow-inner">
                                    {loading ? (
                                        <div className="text-center py-12 animate-pulse text-slate-500 text-sm">Loading logs...</div>
                                    ) : (
                                        <TimelineLog logs={logs} isAdmin={true} onDeleteLog={setDeleteConfirmId} onEditLog={handleEditLog} />
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-8">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">{editingLogId ? 'Edit Log Entry' : 'Add Missing Log'}</h3>
                                <form onSubmit={handleAddLog} className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">Event Type</label>
                                            <div className="relative">
                                                <select value={addLogType} onChange={e => setAddLogType(e.target.value)} className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 pl-4 pr-10 text-sm font-semibold text-white appearance-none focus:outline-none focus:border-blue-500/50 transition-all">
                                                    <option value="punch_in" className="bg-slate-900">Punch In</option>
                                                    <option value="punch_out" className="bg-slate-900">Punch Out</option>
                                                    <option value="break_start" className="bg-slate-900">Break Start</option>
                                                    <option value="break_end" className="bg-slate-900">Break End</option>
                                                    <option value="brb_start" className="bg-slate-900">BRB Start</option>
                                                    <option value="brb_end" className="bg-slate-900">BRB End</option>
                                                    <option value="auto_logout" className="bg-slate-900 text-rose-400">Auto Logout</option>
                                                </select>
                                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">Log Date</label>
                                            <input
                                                type="date"
                                                value={addLogDate}
                                                onChange={e => setAddLogDate(e.target.value)}
                                                className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-4 text-sm font-semibold text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark] transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">Log Time</label>
                                        <CustomTimePicker value={addLogTime} onChange={setAddLogTime} />
                                    </div>
                                    <button type="submit" className={`w-full py-4 mt-2 rounded-[1.2rem] text-black text-xs font-black uppercase tracking-[0.2em] shadow-lg transition-all transform active:scale-[0.98] ${editingLogId ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/25'}`}>
                                        {editingLogId ? 'Update Log Entry' : 'Insert Log Entry'}
                                    </button>
                                    {editingLogId && (
                                        <button type="button" onClick={() => { setEditingLogId(null); setAddLogType('punch_in'); }} className="w-full py-2 hover:text-white text-slate-500 text-[10px] font-bold uppercase tracking-wider">Cancel Edit</button>
                                    )}
                                    <p className="text-[10px] text-slate-600 text-center px-4 leading-relaxed font-medium">Historical changes will instantly update calculation for this employee's reports. This action is logged for audit purposes.</p>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>

            <ConfirmDialog
                open={!!deleteConfirmId}
                title="Delete Timeline Event?"
                message="This will permanently remove the log from the employee's history. This cannot be undone."
                confirmLabel="Delete Permanently"
                onConfirm={confirmDeleteLog}
                onCancel={() => setDeleteConfirmId(null)}
            />
        </>,
        document.body
    );
}
