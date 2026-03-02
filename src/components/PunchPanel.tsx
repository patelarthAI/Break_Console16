'use client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LogIn, LogOut, Coffee, PlayCircle, RotateCcw, RotateCw } from 'lucide-react';

type Status = 'idle' | 'working' | 'on_break' | 'on_brb' | 'punched_out';

interface Props {
    status: Status;
    onPunchIn: () => void;
    onPunchOut: () => void;
    onStartBreak: () => void;
    onEndBreak: () => void;
    onBRBIn: () => void;
    onBRBOut: () => void;
}

function Btn({
    onClick, children, variant, disabled, glow, fullWidth,
}: {
    onClick: () => void; children: React.ReactNode;
    variant: 'electric' | 'amber' | 'green' | 'rose' | 'purple' | 'teal';
    disabled?: boolean; glow?: boolean; fullWidth?: boolean;
}) {
    const variants = {
        electric: 'bg-gradient-to-r from-[#ffd700] to-[#d4af37] text-black shadow-[0_8px_32px_rgba(255,215,0,0.3)]',
        amber: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_8px_32px_rgba(245,158,11,0.2)]',
        green: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_8px_32px_rgba(16,185,129,0.2)]',
        rose: 'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-[0_8px_32px_rgba(244,63,94,0.2)]',
        purple: 'bg-gradient-to-br from-[#3b82f6] to-blue-700 text-white shadow-[0_8px_32px_rgba(59,130,246,0.2)]',
        teal: 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-[0_8px_32px_rgba(20,184,166,0.2)]',
    };
    return (
        <motion.button
            onClick={onClick} disabled={disabled}
            whileHover={disabled ? {} : { scale: 1.03, y: -2 }}
            whileTap={disabled ? {} : { scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={cn(
                'relative flex items-center justify-center gap-2 py-4 rounded-[1.2rem] font-extrabold text-sm uppercase tracking-widest transition-all duration-300 border border-white/10',
                fullWidth ? 'w-full' : '',
                variants[variant],
                disabled && 'opacity-30 grayscale cursor-not-allowed border-transparent shadow-none',
                glow && !disabled && 'animate-breathe'
            )}
        >
            {/* Glossy top overlay for 3D effect */}
            <div className="absolute inset-0 rounded-[1.2rem] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
            {children}
        </motion.button>
    );
}

export default function PunchPanel({ status, onPunchIn, onPunchOut, onStartBreak, onEndBreak, onBRBIn, onBRBOut }: Props) {
    const canBreak = status === 'working';
    const onBreak = status === 'on_break';
    const onBrb = status === 'on_brb';
    const canWork = status === 'working';
    const canPunchOut = status === 'working'; // Only when working (not during break/BRB)

    return (
        <div className="space-y-2.5">
            {/* Row 1 ── Break controls */}
            <div className="grid grid-cols-2 gap-2.5">
                <Btn onClick={onStartBreak} variant="amber" disabled={!canBreak}>
                    <Coffee size={16} /> Break Start
                </Btn>
                <Btn onClick={onEndBreak} variant="green" disabled={!onBreak}>
                    <PlayCircle size={16} /> Break End
                </Btn>
            </div>

            {/* Row 2 ── BRB controls */}
            <div className="grid grid-cols-2 gap-2.5">
                <Btn onClick={onBRBIn} variant="purple" disabled={!canWork || onBreak || onBrb}>
                    <RotateCcw size={15} /> BRB Start
                </Btn>
                <Btn onClick={onBRBOut} variant="teal" disabled={!onBrb}>
                    <RotateCw size={15} /> BRB End
                </Btn>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10 my-1" />

            {/* Row 3 ── Punch In (full width) */}
            <Btn onClick={onPunchIn} variant="electric" disabled={status !== 'idle'} glow={status === 'idle'} fullWidth>
                <LogIn size={17} /> Punch In
            </Btn>

            {/* Row 4 ── Punch Out (full width) */}
            <Btn onClick={onPunchOut} variant="rose" disabled={!canPunchOut} fullWidth>
                <LogOut size={17} /> Punch Out
            </Btn>
        </div>
    );
}
