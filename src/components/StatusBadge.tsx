'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Coffee, LogOut, Circle, RotateCcw } from 'lucide-react';

type Status = 'idle' | 'working' | 'on_break' | 'on_brb' | 'punched_out';

const config: Record<Status, { label: string; icon: React.ReactNode; color: string; bg: string; dot?: string; glow?: string }> = {
    idle: { label: 'Ready to Start', icon: <Circle size={15} />, color: 'text-slate-400', bg: 'bg-white/5 border-white/10' },
    working: { label: 'Clocked In — Working', icon: <Briefcase size={15} />, color: 'text-[#ffd700]', bg: 'bg-black/40 border-[#ffd700]/30', dot: 'bg-[#ffd700]', glow: 'shadow-[0_0_20px_rgba(255,215,0,0.15)]' },
    on_break: { label: 'On Break', icon: <Coffee size={15} />, color: 'text-amber-400', bg: 'bg-black/40 border-amber-500/30', dot: 'bg-amber-400', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]' },
    on_brb: { label: 'BRB — Back in a moment', icon: <RotateCcw size={15} />, color: 'text-[#3b82f6]', bg: 'bg-black/40 border-[#3b82f6]/30', dot: 'bg-[#3b82f6]', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]' },
    punched_out: { label: 'Punched Out — Day Done', icon: <LogOut size={15} />, color: 'text-slate-300', bg: 'bg-black/30 border-slate-600/30' },
};

export default function StatusBadge({ status }: { status: Status }) {
    const c = config[status];
    return (
        <AnimatePresence mode="wait">
            <motion.div key={status} initial={{ opacity: 0, scale: 0.9, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-sm font-bold tracking-wide backdrop-blur-md transition-all duration-500 ${c.color} ${c.bg} ${c.glow || ''}`}>
                {c.dot && (
                    <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${c.dot}`} />
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${c.dot}`} />
                    </span>
                )}
                {c.icon}
                {c.label}
            </motion.div>
        </AnimatePresence>
    );
}
