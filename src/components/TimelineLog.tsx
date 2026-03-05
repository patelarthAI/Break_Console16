'use client';
import { motion } from 'framer-motion';
import { LogIn, LogOut, Coffee, PlayCircle, RotateCcw, RotateCw, Clock, Trash2 } from 'lucide-react';
import { TimeLog } from '@/types';
import { formatTime } from '@/lib/timeUtils';

const eventConfig = {
    punch_in: { label: 'Punch In', icon: <LogIn size={14} />, color: 'text-emerald-400', dot: 'bg-emerald-400' },
    punch_out: { label: 'Punch Out', icon: <LogOut size={14} />, color: 'text-rose-400', dot: 'bg-rose-400' },
    break_start: { label: 'Break Start', icon: <Coffee size={14} />, color: 'text-amber-400', dot: 'bg-amber-400' },
    break_end: { label: 'Break End', icon: <PlayCircle size={14} />, color: 'text-sky-400', dot: 'bg-sky-400' },
    brb_start: { label: 'BRB In', icon: <RotateCcw size={14} />, color: 'text-violet-400', dot: 'bg-violet-400' },
    brb_end: { label: 'BRB Out', icon: <RotateCw size={14} />, color: 'text-teal-400', dot: 'bg-teal-400' },
};

export default function TimelineLog({ logs, isAdmin, onDeleteLog }: { logs: TimeLog[]; isAdmin?: boolean; onDeleteLog?: (id: string) => void }) {
    if (!logs.length) return (
        <div className="text-center py-6 text-slate-500 text-sm">
            <Clock size={24} className="mx-auto mb-2 opacity-40" />
            No events recorded yet today.
        </div>
    );

    return (
        <div className="space-y-0.5">
            {[...logs].reverse().map((log, i) => {
                const cfg = eventConfig[log.eventType] ?? { label: log.eventType, icon: null, color: 'text-slate-400', dot: 'bg-slate-400' };
                return (
                    <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.2 }}
                        className="group flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/5 transition-colors">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <span className={`${cfg.color} flex-shrink-0`}>{cfg.icon}</span>
                        <span className="text-sm font-medium text-white flex-1">{cfg.label}</span>
                        {log.addedBy && <span className="text-xs text-amber-500 font-medium">master</span>}
                        <span className="text-xs text-slate-400 font-mono">{formatTime(log.timestamp)}</span>
                        {isAdmin && onDeleteLog && (
                            <button
                                onClick={() => onDeleteLog(log.id)}
                                title="Delete Log"
                                className="ml-2 p-1 rounded-md text-slate-500 opacity-0 group-hover:opacity-100 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}
