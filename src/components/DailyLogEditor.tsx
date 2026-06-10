'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Clock, LogIn, LogOut, Coffee, PlayCircle, Trash2, Edit2, AlertCircle, History } from 'lucide-react';
import { TimeLog, User } from '@/types';
import { getLogs, insertLog, deleteTimeLog, updateTimeLog } from '@/lib/store';
import { formatTime, generateUUID, getTodayKey } from '@/lib/timeUtils';
import TimelineLog from '@/components/TimelineLog';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/ui/CustomSelect';

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
        for (let j = 0; j < 60; j += 15) { // 15 min intervals for precision
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
            <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between bg-[var(--surface-2)] border border-white/[0.08] rounded-[var(--r-lg)] py-3.5 px-4 text-white text-[14px] font-bold focus:border-[var(--cyan)]/40 outline-none transition-all hover:bg-white/[0.04]">
                <span>{value ? formatDisplay(value) : '--:-- AM'}</span>
                <Clock size={16} className="text-[var(--text-faint)]" />
            </button>
            <AnimatePresence>
                {open && (
                    <>
                        <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                            animate={{ opacity: 1, y: 0, scale: 1 }} 
                            exit={{ opacity: 0, y: 10, scale: 0.95 }} 
                            className="absolute bottom-full mb-2 left-0 right-0 max-h-60 overflow-y-auto bg-[var(--surface-3)] border border-white/[0.1] rounded-[var(--r-xl)] shadow-[var(--shadow-xl)] z-[210] custom-scrollbar p-1"
                        >
                            <div className="flex flex-col gap-0.5">
                                {options.map(opt => (
                                    <button 
                                        key={opt} 
                                        type="button" 
                                        onClick={() => { onChange(opt); setOpen(false); }} 
                                        className={`text-left rounded-[var(--r-md)] px-4 py-2 text-[13px] font-black uppercase tracking-wider transition-all ${value === opt ? 'bg-[var(--cyan)] text-[var(--surface-0)] shadow-[var(--cyan-glow-sm)]' : 'text-[var(--text-faint)] hover:bg-white/5 hover:text-white'}`}
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
            <AnimatePresence mode="wait">
                <div className="fixed inset-0 z-[150] flex justify-end overflow-hidden">
                    {/* Glass Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        onClick={onClose} 
                        className="fixed inset-0 bg-[var(--surface-0)]/60 backdrop-blur-md" 
                    />
                    
                    {/* Drawer Content */}
                    <motion.div 
                        initial={{ x: '100%', opacity: 0.5 }} 
                        animate={{ x: 0, opacity: 1 }} 
                        exit={{ x: '100%', opacity: 0.5 }} 
                        transition={{ type: 'spring', damping: 30, stiffness: 250 }} 
                        className="relative w-full max-w-[480px] bg-[var(--surface-1)] border-l border-white/[0.08] shadow-[var(--shadow-xl)] flex flex-col h-full overflow-hidden"
                    >
                        {/* Premium Header Decoration */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--cyan)] to-transparent opacity-50" />

                        <div className="px-8 py-8 border-b border-white/[0.06] flex items-center justify-between">
                            <div>
                                <h2 className="text-[20px] font-black text-white tracking-tighter leading-tight">{user.name}</h2>
                                <p className="text-[10px] text-[var(--text-faint)] font-black uppercase tracking-[0.2em] mt-2">
                                    {user.clientName} <span className="text-[var(--cyan)]">Timeline Matrix</span>
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2.5 rounded-full text-[var(--text-faint)] hover:text-white hover:bg-white/5 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 custom-scrollbar">
                            {/* Timeline View */}
                            <section>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <History size={14} className="text-[var(--cyan)]" />
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-faint)]">Historical Pulse</h3>
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--amber)] bg-[var(--amber)]/10 px-2.5 py-1 rounded-[var(--r-md)] border border-[var(--amber)]/20 shadow-[0_0_15px_-5px_var(--amber)]">
                                        Override Active
                                    </span>
                                </div>
                                
                                <div className="bg-[var(--surface-2)] border border-white/[0.05] rounded-[var(--r-xl)] p-6 shadow-inner relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                                            <div className="w-8 h-8 border-2 border-[var(--cyan)] border-t-transparent rounded-full animate-spin" />
                                            <span className="text-[11px] font-black text-[var(--cyan)] uppercase tracking-widest animate-pulse">Retaining Logs...</span>
                                        </div>
                                    ) : (
                                        <TimelineLog logs={logs} isAdmin={true} onDeleteLog={setDeleteConfirmId} onEditLog={handleEditLog} />
                                    )}
                                </div>
                            </section>

                            {/* Editor Form */}
                            <section className="pt-4 border-t border-white/[0.06]">
                                <div className="flex items-center gap-2 mb-6">
                                    <Edit2 size={14} className="text-[var(--cyan)]" />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-faint)]">
                                        {editingLogId ? 'Update Event Sector' : 'Inject Historical Log'}
                                    </h3>
                                </div>

                                <form onSubmit={handleAddLog} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-[var(--text-faint)] uppercase tracking-[0.2em] ml-1">Event Protocol</label>
                                            <CustomSelect
                                                options={[
                                                    { value: 'punch_in', label: 'Punch In' },
                                                    { value: 'punch_out', label: 'Punch Out' },
                                                    { value: 'break_start', label: 'Break Start' },
                                                    { value: 'break_end', label: 'Break End' },
                                                    { value: 'brb_start', label: 'BRB Start' },
                                                    { value: 'brb_end', label: 'BRB End' },
                                                    { value: 'auto_logout', label: 'Auto Logout' }
                                                ]}
                                                value={addLogType}
                                                onChange={setAddLogType}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-[var(--text-faint)] uppercase tracking-[0.2em] ml-1">Log Date</label>
                                            <input
                                                type="date"
                                                value={addLogDate}
                                                onChange={e => setAddLogDate(e.target.value)}
                                                className="w-full bg-[var(--surface-2)] border border-white/[0.08] rounded-[var(--r-lg)] px-4 py-3.5 text-[14px] font-bold text-white [color-scheme:dark] focus:border-[var(--cyan)]/40 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-[var(--text-faint)] uppercase tracking-[0.2em] ml-1">Temporal Alignment</label>
                                        <CustomTimePicker value={addLogTime} onChange={setAddLogTime} />
                                    </div>

                                    <div className="pt-2">
                                        <motion.button 
                                            type="submit" 
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className={`w-full py-4 rounded-[var(--r-xl)] text-[12px] font-black uppercase tracking-[0.2em] transition-all shadow-[var(--shadow-lg)] ${editingLogId ? 'bg-[var(--amber)] text-[var(--surface-0)] shadow-[0_0_20px_-5px_var(--amber)]' : 'bg-[var(--cyan)] text-[var(--surface-0)] shadow-[var(--cyan-glow-sm)]'}`}
                                        >
                                            {editingLogId ? 'Update Log Matrix' : 'Commit Log Entry'}
                                        </motion.button>
                                        
                                        {editingLogId && (
                                            <button 
                                                type="button" 
                                                onClick={() => { setEditingLogId(null); setAddLogType('punch_in'); }} 
                                                className="w-full py-3 mt-2 text-[10px] font-black text-[var(--text-faint)] hover:text-white uppercase tracking-widest transition-colors"
                                            >
                                                Abort Revision
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-start gap-3 bg-[var(--surface-2)]/50 border border-white/[0.03] p-4 rounded-[var(--r-lg)]">
                                        <AlertCircle size={14} className="text-[var(--text-faint)] mt-0.5 flex-shrink-0" />
                                        <p className="text-[10px] text-[var(--text-faint)] leading-relaxed font-bold uppercase tracking-wider">
                                            Historical revisions trigger real-time analytical recalibration. Actions are permanently indexed for auditing.
                                        </p>
                                    </div>
                                </form>
                            </section>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>

            <ConfirmDialog
                open={!!deleteConfirmId}
                title="Erase Timeline Segment?"
                message="This will permanently delete the selected log from the historical archives. This operation cannot be reversed."
                confirmLabel="Confirm Erasure"
                onConfirm={confirmDeleteLog}
                onCancel={() => setDeleteConfirmId(null)}
            />
        </>,
        document.body
    );
}
