'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AppNotification } from '@/types';
import { getActiveNotifications, dismissNotification } from '@/lib/store';

export default function NotificationPanel({ userId }: { userId: string }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    useEffect(() => {
        // Initial load
        const load = async () => {
            try {
                const active = await getActiveNotifications(userId);
                setNotifications(active);
            } catch (err) {
                console.error('Failed to load notifications', err);
            }
        };
        load();

        // Subscribe to real-time new notifications
        const channel = supabase.channel('public:notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
                const n = payload.new;
                if (!n.is_active) return; // ignore inactive

                const newNotif: AppNotification = {
                    id: n.id, message: n.message, createdBy: n.created_by,
                    createdAt: n.created_at, isActive: n.is_active
                };

                setNotifications(prev => {
                    // avoid duplicates just in case
                    if (prev.some(x => x.id === newNotif.id)) return prev;
                    return [newNotif, ...prev];
                });
            })
            // Also listen to DELETE or UPDATE (if admin deletes/deactivates it, remove it for everyone)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => {
                if (!payload.new.is_active) {
                    setNotifications(prev => prev.filter(n => n.id !== payload.new.id));
                }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, payload => {
                setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    const handleDismiss = async (e: React.MouseEvent, notifId: string) => {
        e.preventDefault();
        e.stopPropagation();
        // Optimistic UI update
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        try {
            await dismissNotification(notifId, userId);
        } catch (err) {
            console.error('Failed to dismiss notification', err);
        }
    };

    // If zero notifications, don't show the marquee at all.
    if (notifications.length === 0) return null;

    // Calculate dynamic duration so speed is roughly constant regardless of text length:
    // Roughly 7 characters per second, with a minimum base time.
    const totalChars = notifications.reduce((acc, n) => acc + n.message.length, 0);
    const duration = Math.max(16, totalChars * 0.15);

    return (
        <motion.div
            initial={{ opacity: 0, y: -5, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(5px)' }}
            className="w-full relative bg-[#05050f]/60 backdrop-blur-2xl border border-white/10 pl-1.5 pr-4 rounded-full flex items-center shadow-[0_8px_32px_rgba(0,0,0,0.6)] group h-[48px] z-20 hover:border-white/20 transition-colors duration-500 overflow-hidden"
        >
            {/* Ambient Background Glow inside the pill */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-transparent pointer-events-none" />

            {/* Left Static Indicator - Award winning badge style */}
            <div className="flex items-center gap-2.5 px-5 py-1.5 h-[36px] rounded-full z-20 bg-gradient-to-r from-blue-600/20 to-indigo-600/10 border border-blue-400/30 shadow-[0_0_20px_rgba(59,130,246,0.2)] shrink-0 mr-4 backdrop-blur-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[150%] animate-[shimmer_3s_infinite]" />
                <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,1)] animate-[pulse_2s_ease-in-out_infinite]" />
                <span className="text-[10px] font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200 tracking-[0.2em] whitespace-nowrap hidden sm:inline-block relative z-10">Live Updates</span>
            </div>



            <style>{`
                @keyframes marquee-ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                @keyframes shimmer {
                    100% { transform: translateX(150%); }
                }
                .marquee-content {
                    display: inline-flex;
                    align-items: center;
                    height: 100%;
                    padding-left: 100%;
                    animation: marquee-ticker ${duration}s linear infinite;
                    will-change: transform;
                }
                .group:hover .marquee-content {
                    animation-play-state: paused;
                }
            `}</style>

            {/* Ticker Container - using mask-image for glass-safe edge fading */}
            <div
                className="flex-1 overflow-hidden whitespace-nowrap relative h-full flex items-center"
                style={{ maskImage: 'linear-gradient(to right, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)' }}
            >
                <div className="marquee-content">
                    {notifications.map((n, i) => (
                        <div key={n.id} className="flex items-center h-full">
                            <span className="text-[14px] text-slate-100 font-medium tracking-wide drop-shadow-lg">{n.message}</span>

                            {/* Dismiss visible on hover */}
                            <button
                                onClick={(e) => handleDismiss(e, n.id)}
                                className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-400/50 text-emerald-400/80 hover:text-emerald-300 text-[10px] uppercase font-bold tracking-wider px-3.5 pt-[0.25rem] pb-[0.25rem] rounded-full ml-5 cursor-pointer backdrop-blur-xl shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            >
                                <CheckCircle size={13} className="opacity-90" /> <span className="mt-[1px]">Acknowledge</span>
                            </button>

                            {/* Delimiter */}
                            {i < notifications.length - 1 && <div className="w-[3px] h-[3px] rounded-full bg-white/20 mx-8 shrink-0" />}
                        </div>
                    ))}
                    {/* Padding so last element leaves screen smoothly before loop restarts */}
                    <div className="w-16 h-1 flex-shrink-0" />
                </div>
            </div>

        </motion.div>
    );
}
