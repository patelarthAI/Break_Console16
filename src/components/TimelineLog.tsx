'use client';
import { motion } from 'framer-motion';
import { LogIn, LogOut, Coffee, PlayCircle, RotateCcw, RotateCw, Clock, Trash2, Edit2 } from 'lucide-react';
import { TimeLog } from '@/types';
import { formatTime } from '@/lib/timeUtils';

const eventConfig = {
    punch_in: { label: 'Punch In', icon: <LogIn size={13} />, color: 'text-[var(--cyan)]', dot: 'bg-[var(--cyan)]', glow: 'shadow-[0_0_8px_var(--cyan)]' },
    punch_out: { label: 'Punch Out', icon: <LogOut size={13} />, color: 'text-[var(--red)]', dot: 'bg-[var(--red)]', glow: 'shadow-[0_0_8px_var(--red)]' },
    break_start: { label: 'Break Start', icon: <Coffee size={13} />, color: 'text-[var(--amber)]', dot: 'bg-[var(--amber)]', glow: 'shadow-[0_0_8px_var(--amber)]' },
    break_end: { label: 'Break End', icon: <PlayCircle size={13} />, color: 'text-[var(--cyan)]', dot: 'bg-[var(--cyan)]', glow: 'shadow-[0_0_8px_var(--cyan)]' },
    brb_start: { label: 'BRB Start', icon: <RotateCcw size={13} />, color: 'text-[var(--amber)]', dot: 'bg-[var(--amber)]', glow: 'shadow-[0_0_8px_var(--amber)]' },
    brb_end: { label: 'BRB End', icon: <RotateCw size={13} />, color: 'text-[var(--cyan)]', dot: 'bg-[var(--cyan)]', glow: 'shadow-[0_0_8px_var(--cyan)]' },
    auto_logout: { label: 'Auto Logout', icon: <Clock size={13} />, color: 'text-[var(--red)]', dot: 'bg-[var(--red)]', glow: 'shadow-[0_0_8px_var(--red)]' },
};

const fallbackEventConfig = {
    label: 'Manual Event',
    icon: <Clock size={13} />,
    color: 'text-white/40',
    dot: 'bg-white/20',
    glow: '',
};

export default function TimelineLog({ logs, isAdmin, onDeleteLog, onEditLog }: { logs: TimeLog[]; isAdmin?: boolean; onDeleteLog?: (id: string) => void; onEditLog?: (log: TimeLog) => void }) {
    if (!logs.length) return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4">
                <Clock size={20} className="text-[var(--text-faint)] opacity-40" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-faint)]">Temporal Void Detected</p>
            <p className="text-[10px] text-[var(--text-faint)]/60 mt-1 uppercase tracking-widest font-bold">No events recorded for this sector</p>
        </div>
    );

    return (
        <div className="relative space-y-1">
            {/* Timeline Connector Line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-[var(--cyan)]/20 via-white/5 to-transparent" />

            {[...logs].reverse().map((log, i) => {
                const cfg = eventConfig[log.eventType as keyof typeof eventConfig] ?? {
                    ...fallbackEventConfig,
                    label: log.eventType.replace('_', ' '),
                };
                return (
                    <motion.div 
                        key={log.id} 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="group relative flex items-center gap-4 py-3 px-4 rounded-[var(--r-lg)] hover:bg-white/[0.04] border border-transparent hover:border-white/[0.05] transition-all duration-300"
                    >
                        <div className={`relative z-10 w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 border-[var(--surface-2)] ${cfg.dot} ${cfg.glow}`} />
                        
                        <div className={`flex items-center justify-center w-8 h-8 rounded-[var(--r-md)] bg-white/[0.03] border border-white/[0.05] ${cfg.color}`}>
                            {cfg.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] font-black text-white tracking-tight uppercase">{cfg.label}</span>
                                {log.addedBy && (
                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--amber)] bg-[var(--amber)]/10 px-1.5 py-0.5 rounded border border-[var(--amber)]/20">
                                        MASTER
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-[11px] font-black font-mono text-[var(--text-faint)] uppercase tracking-widest">
                                {formatTime(log.timestamp)}
                            </span>

                            {isAdmin && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                    {onEditLog && (
                                        <button
                                            onClick={() => onEditLog(log)}
                                            className="p-2 rounded-[var(--r-md)] bg-white/5 text-[var(--text-faint)] hover:text-white hover:bg-[var(--cyan)]/20 transition-all"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                    )}
                                    {onDeleteLog && (
                                        <button
                                            onClick={() => onDeleteLog(log.id)}
                                            className="p-2 rounded-[var(--r-md)] bg-white/5 text-[var(--text-faint)] hover:text-[var(--red)] hover:bg-[var(--red)]/20 transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
