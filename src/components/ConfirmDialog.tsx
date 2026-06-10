'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, ShieldAlert, X } from 'lucide-react';

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
    confirmLabel = 'Authorize Action',
    cancelLabel = 'Abort Protocol',
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
                    {/* Cinematic Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9990] bg-[#020408]/85 backdrop-blur-xl"
                        onClick={onCancel}
                    />
                    
                    {/* Dialog Hub */}
                    <div className="fixed inset-0 z-[9991] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, rotateX: 12 }}
                            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                            exit={{ opacity: 0, scale: 0.95, rotateX: -12 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                            className="pointer-events-auto w-full max-w-[420px] bg-gradient-to-b from-white/[0.015] to-[var(--surface-1)] border border-white/[0.08] rounded-[24px] shadow-[0_30px_80px_rgba(0,0,0,0.85)] overflow-hidden relative"
                        >
                            {/* Alert Scanline / Top Gradient line */}
                            <div 
                              className="absolute top-0 left-1/4 right-1/4 h-[3px] opacity-80" 
                              style={{
                                background: isDanger
                                  ? 'linear-gradient(90deg, transparent, var(--red) 50%, transparent)'
                                  : 'linear-gradient(90deg, transparent, var(--amber) 50%, transparent)',
                                boxShadow: isDanger
                                  ? '0 0 16px var(--red)'
                                  : '0 0 16px var(--amber)'
                              }}
                            />

                            {/* Internal ambient glow behind icon */}
                            <div 
                              className="absolute top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-[50px] opacity-15 pointer-events-none"
                              style={{
                                background: isDanger ? 'var(--red)' : 'var(--amber)'
                              }}
                            />

                             <div className="p-8 relative z-10">
                                {/* Close Button */}
                                <button 
                                    onClick={onCancel}
                                    className="absolute top-5 right-5 p-2 rounded-xl hover:bg-white/5 text-[var(--text-faint)] hover:text-white transition-all cursor-pointer"
                                >
                                    <X size={15} />
                                </button>

                                {/* Header Intel */}
                                <div className="flex flex-col items-center text-center mb-8 mt-4">
                                    {/* Double ring premium avatar frame */}
                                    <div className="relative mb-6">
                                        <div className={`absolute inset-0 rounded-[20px] blur-md opacity-35 ${isDanger ? 'bg-[var(--red)]' : 'bg-[var(--amber)]'}`} />
                                        <div className={`w-14 h-14 rounded-[18px] border flex items-center justify-center bg-black/40 relative z-10 ${
                                          isDanger 
                                            ? 'border-[var(--red)]/30' 
                                            : 'border-[var(--amber)]/30'
                                        }`}>
                                            {isDanger
                                                ? <ShieldAlert size={26} className="text-[var(--red)] drop-shadow-[0_0_8px_var(--red)]" />
                                                : <AlertTriangle size={26} className="text-[var(--amber)] drop-shadow-[0_0_8px_var(--amber)]" />}
                                        </div>
                                    </div>
                                    
                                    <h3 className="text-[16px] font-black text-white uppercase tracking-[0.08em] mb-2.5 leading-none">
                                      {title}
                                    </h3>
                                    
                                    {message && (
                                      <p className="text-[12px] text-slate-400 font-medium leading-relaxed px-2">
                                        {message}
                                      </p>
                                    )}
                                </div>

                                {/* Tactical Actions */}
                                <div className="flex flex-col gap-2.5">
                                    <motion.button 
                                        onClick={onConfirm}
                                        whileHover={{ scale: 1.015, y: -0.5 }}
                                        whileTap={{ scale: 0.985 }}
                                        className="w-full py-3.5 rounded-xl text-[11px] font-black uppercase tracking-[0.18em] transition-all cursor-pointer"
                                        style={{
                                          background: isDanger
                                            ? 'linear-gradient(135deg, var(--red) 0%, #c21b3a 100%)'
                                            : 'linear-gradient(135deg, var(--amber) 0%, #b27a05 100%)',
                                          color: isDanger ? '#fff' : '#000',
                                          border: isDanger ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                                          boxShadow: isDanger 
                                            ? '0 8px 20px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)' 
                                            : '0 8px 20px rgba(245, 158, 11, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                                        }}
                                    >
                                        {confirmLabel}
                                    </motion.button>
                                    
                                    <motion.button 
                                        onClick={onCancel}
                                        whileHover={{ scale: 1.015, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                                        whileTap={{ scale: 0.985 }}
                                        className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer"
                                    >
                                        {cancelLabel}
                                    </motion.button>
                                </div>
                            </div>
                            
                            {/* Matrix Footer Decor */}
                            <div className="px-8 py-3 bg-white/[0.015] border-t border-white/[0.04] flex justify-center">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className={`w-1 h-1 rounded-full ${isDanger ? 'bg-[var(--red)]' : 'bg-[var(--amber)]'} opacity-20`} />
                                    ))}
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
