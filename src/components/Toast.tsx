'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X, Zap, ShieldCheck, ShieldAlert } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextValue {
    toast: (opts: Omit<Toast, 'id'>) => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIG: Record<ToastType, { icon: React.ReactNode; bar: string; border: string; bg: string; text: string; glow: string }> = {
    success: {
        icon: <ShieldCheck size={16} className="text-[var(--green)] flex-shrink-0" />,
        bar: 'bg-[var(--green)]',
        border: 'border-[var(--green)]/30',
        bg: 'bg-[var(--green-soft)]',
        text: 'text-[var(--green)]',
        glow: 'shadow-[0_0_20px_-5px_var(--green)]'
    },
    error: {
        icon: <XCircle size={16} className="text-[var(--red)] flex-shrink-0" />,
        bar: 'bg-[var(--red)]',
        border: 'border-[var(--red)]/30',
        bg: 'bg-[var(--red-soft)]',
        text: 'text-[var(--red)]',
        glow: 'shadow-[0_0_20px_-5px_var(--red)]'
    },
    warning: {
        icon: <ShieldAlert size={16} className="text-[var(--amber)] flex-shrink-0" />,
        bar: 'bg-[var(--amber)]',
        border: 'border-[var(--amber)]/30',
        bg: 'bg-[var(--amber-soft)]',
        text: 'text-[var(--amber)]',
        glow: 'shadow-[0_0_20px_-5px_var(--amber)]'
    },
    info: {
        icon: <Zap size={16} className="text-[var(--cyan)] flex-shrink-0" />,
        bar: 'bg-[var(--cyan)]',
        border: 'border-[var(--cyan)]/30',
        bg: 'bg-[var(--cyan-soft)]',
        text: 'text-[var(--cyan)]',
        glow: 'shadow-[0_0_20px_-5px_var(--cyan)]'
    },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────
function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
    const cfg = CONFIG[t.type];
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.9, rotateX: -20 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`relative w-[340px] rounded-[var(--r-2xl)] border ${cfg.border} ${cfg.bg} backdrop-blur-2xl ${cfg.glow} overflow-hidden shadow-[var(--shadow-2xl)]`}>

            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/[0.05]">
                <motion.div
                    className={`h-full ${cfg.bar} shadow-[0_0_8px_currentcolor]`}
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: (t.duration ?? 4000) / 1000, ease: 'linear' }}
                    onAnimationComplete={() => onDismiss(t.id)}
                />
            </div>

            <div className="flex items-start gap-4 px-6 py-5 pr-10">
                <div className={`mt-0.5 p-2 rounded-[var(--r-lg)] bg-white/[0.03] border border-white/[0.05]`}>
                    {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black text-white tracking-tight leading-none mb-1.5 uppercase">{t.title}</p>
                    {t.message && <p className="text-[11px] font-bold text-[var(--text-faint)] leading-relaxed tracking-wide">{t.message}</p>}
                </div>
            </div>

            <button
                onClick={() => onDismiss(t.id)}
                className="absolute top-4 right-4 text-[var(--text-faint)] hover:text-white transition-all p-2 rounded-full hover:bg-white/5">
                <X size={14} />
            </button>
        </motion.div>
    );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counter = useRef(0);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = useCallback((opts: Omit<Toast, 'id'>) => {
        const id = `t${++counter.current}`;
        setToasts(prev => [...prev.slice(-3), { ...opts, id }]); // max 4 at once
    }, []);

    const success = useCallback((title: string, message?: string) => toast({ type: 'success', title, message }), [toast]);
    const error = useCallback((title: string, message?: string) => toast({ type: 'error', title, message, duration: 6000 }), [toast]);
    const warning = useCallback((title: string, message?: string) => toast({ type: 'warning', title, message }), [toast]);
    const info = useCallback((title: string, message?: string) => toast({ type: 'info', title, message }), [toast]);

    return (
        <ToastContext.Provider value={{ toast, success, error, warning, info }}>
            {children}
            {/* Toast stack — fixed bottom-right */}
            <div className="fixed bottom-10 right-10 z-[9999] flex flex-col gap-4 items-end pointer-events-none perspective-[1000px]">
                <AnimatePresence mode="popLayout">
                    {toasts.map(t => (
                        <div key={t.id} className="pointer-events-auto">
                            <ToastItem t={t} onDismiss={dismiss} />
                        </div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}
