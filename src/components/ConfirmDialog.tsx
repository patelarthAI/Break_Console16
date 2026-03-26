'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface Props {
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning';
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open, title, message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger',
    onConfirm, onCancel
}: Props) {
    const isDanger = variant === 'danger';

    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const content = (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm"
                        onClick={onCancel}
                    />
                    {/* Dialog */}
                    <div className="fixed inset-0 z-[9991] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 8 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            className="pointer-events-auto w-full max-w-sm bg-[#0c0c1c] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">

                            {/* Top bar */}
                            <div className={`h-0.5 w-full ${isDanger ? 'bg-rose-500' : 'bg-amber-500'}`} />

                            <div className="p-6">
                                {/* Icon + title */}
                                <div className="flex items-start gap-3 mb-4">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDanger ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                                        {isDanger
                                            ? <Trash2 size={16} className="text-rose-400" />
                                            : <AlertTriangle size={16} className="text-amber-400" />}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-white">{title}</h3>
                                        {message && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</p>}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-2">
                                    <button onClick={onCancel}
                                        className="px-4 py-2 rounded-lg border border-white/8 text-slate-400 text-sm font-semibold hover:text-white hover:border-white/15 transition-all">
                                        {cancelLabel}
                                    </button>
                                    <motion.button onClick={onConfirm}
                                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                        className={`px-5 py-2 rounded-lg text-sm font-black tracking-wide transition-all shadow-lg
                                            ${isDanger
                                                ? 'bg-rose-500 text-white hover:bg-rose-400 shadow-rose-500/20'
                                                : 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20'}`}>
                                        {confirmLabel}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );

    if (!mounted) return null;
    return createPortal(content, document.body);
}
