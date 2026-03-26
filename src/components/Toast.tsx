'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

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
const CONFIG: Record<ToastType, { icon: React.ReactNode; bar: string; border: string; bg: string }> = {
    success: {
        icon: <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />,
        bar: 'bg-emerald-500',
        border: 'border-emerald-500/20',
        bg: 'bg-emerald-500/5',
    },
    error: {
        icon: <XCircle size={15} className="text-rose-400 flex-shrink-0" />,
        bar: 'bg-rose-500',
        border: 'border-rose-500/20',
        bg: 'bg-rose-500/5',
    },
    warning: {
        icon: <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />,
        bar: 'bg-amber-500',
        border: 'border-amber-500/20',
        bg: 'bg-amber-500/5',
    },
    info: {
        icon: <Info size={15} className="text-blue-400 flex-shrink-0" />,
        bar: 'bg-blue-500',
        border: 'border-blue-500/20',
        bg: 'bg-blue-500/5',
    },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────
function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
    const cfg = CONFIG[t.type];
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className={`relative w-80 rounded-xl border ${cfg.border} ${cfg.bg} backdrop-blur-sm shadow-2xl overflow-hidden`}>

            {/* Progress bar */}
            <motion.div
                className={`absolute top-0 left-0 h-[2px] ${cfg.bar}`}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: (t.duration ?? 4000) / 1000, ease: 'linear' }}
                onAnimationComplete={() => onDismiss(t.id)}
            />

            <div className="flex items-start gap-3 px-4 py-3 pr-8">
                {cfg.icon}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white leading-tight">{t.title}</p>
                    {t.message && <p className="text-xs text-slate-500 mt-0.5 leading-snug">{t.message}</p>}
                </div>
            </div>

            <button
                onClick={() => onDismiss(t.id)}
                className="absolute top-2.5 right-2.5 text-slate-600 hover:text-white transition-colors p-0.5 rounded">
                <X size={12} />
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
        setToasts(prev => [...prev.slice(-4), { ...opts, id }]); // max 5 at once
    }, []);

    const success = useCallback((title: string, message?: string) => toast({ type: 'success', title, message }), [toast]);
    const error = useCallback((title: string, message?: string) => toast({ type: 'error', title, message, duration: 6000 }), [toast]);
    const warning = useCallback((title: string, message?: string) => toast({ type: 'warning', title, message }), [toast]);
    const info = useCallback((title: string, message?: string) => toast({ type: 'info', title, message }), [toast]);

    return (
        <ToastContext.Provider value={{ toast, success, error, warning, info }}>
            {children}
            {/* Toast stack — fixed bottom-right */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none">
                <AnimatePresence mode="sync">
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
