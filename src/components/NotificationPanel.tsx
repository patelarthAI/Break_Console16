'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { subscribe } from '@/lib/realtime';
import { AppNotification, User, TimeLog } from '@/types';
import { getActiveNotifications, dismissNotification, getUserByNameAndClient, getLogs } from '@/lib/store';
import { checkViolations, formatDuration, getTodayKey, getRealDate, dateStr, computeSession, computeTotalTime, getRealNow, BREAK_LIMIT_MS } from '@/lib/timeUtils';

export default function NotificationPanel({ userId }: { userId: string }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [personalAlerts, setPersonalAlerts] = useState<AppNotification[]>([]);
    const [todayLogs, setTodayLogs] = useState<TimeLog[]>([]);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                // 1. Load Admin Broadcasts
                const active = await getActiveNotifications(userId);
                if (isMounted) setNotifications(active);

                // 2. Load User Context & Logs
                const { data: userData } = await supabase.from('users').select('*').eq('id', userId).single();
                if (!userData) return;

                const today = getTodayKey();
                const d = getRealDate(); d.setDate(d.getDate() - 1);
                const yesterday = dateStr(d);

                const [tLogs, yLogs] = await Promise.all([
                    getLogs(userId, today),
                    getLogs(userId, yesterday)
                ]);
                if (isMounted) setTodayLogs(tLogs);

                const scan = () => {
                    const alerts: AppNotification[] = [];

                    // Late Login Check
                    const v = checkViolations(0, 0, tLogs.find(l => l.eventType === 'punch_in')?.timestamp, undefined, userData.shift_start, userData.shift_end, userData.timezone);
                    if (v.lateIn) {
                        alerts.push({
                            id: `late-in-${today}`,
                            message: `⚠️ You clocked in late today at ${new Date(tLogs.find(l => l.eventType === 'punch_in')!.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
                            createdAt: new Date().toISOString(), createdBy: 'system', isActive: true
                        });
                    }

                    // Forgot Logout Yesterday Check
                    if (yLogs.length > 0) {
                        const lastEvent = yLogs[yLogs.length - 1].eventType;
                        if (lastEvent !== 'punch_out' && lastEvent !== 'auto_logout') {
                            alerts.push({
                                id: `forgot-logout-${yesterday}`,
                                message: `🔴 You forgot to logout yesterday (${yesterday}).`,
                                createdAt: new Date().toISOString(), createdBy: 'system', isActive: true
                            });
                        }
                    }

                    // Active Overstay Checks
                    const session = computeSession(tLogs);
                    const now = getRealNow();
                    const totalBreakMs = computeTotalTime(session.breaks, now);
                    if (totalBreakMs > BREAK_LIMIT_MS) {
                        alerts.push({
                            id: `total-break-over-${today}`,
                            message: `☕ Your total break time has exceeded ${formatDuration(BREAK_LIMIT_MS)}.`,
                            createdAt: new Date().toISOString(), createdBy: 'system', isActive: true
                        });
                    }

                    // Check if current open break is > 30m
                    const activeBreak = session.breaks.find(b => !b.end);
                    if (activeBreak && (now - activeBreak.start) > 30 * 60 * 1000) {
                        alerts.push({
                            id: `active-break-long-${today}`,
                            message: `⚠️ Your current break has exceeded 30 minutes (${formatDuration(now - activeBreak.start)}).`,
                            createdAt: new Date().toISOString(), createdBy: 'system', isActive: true
                        });
                    }

                    if (isMounted) setPersonalAlerts(alerts);
                };

                scan();

                // 3. Subscription for Admin Broadcasts (via shared channel)
                const unsubNotifs = subscribe('notifications', 'INSERT', async () => {
                    const active = await getActiveNotifications(userId);
                    if (isMounted) setNotifications(active);
                });

                // 4. Subscription for User's Own Logs (via shared channel)
                const unsubLogs = subscribe('time_logs', 'INSERT', async () => {
                    const fresh = await getLogs(userId, getTodayKey());
                    if (isMounted) { setTodayLogs(fresh); scan(); }
                });

                // 5. Minute timer for active overstays
                const timer = setInterval(scan, 60000);

                return () => {
                    isMounted = false;
                    unsubNotifs();
                    unsubLogs();
                    clearInterval(timer);
                };
            } catch (err) { console.error('Failed to load notifications', err); }
        };

        load();
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

    const allNotifs = [...personalAlerts, ...notifications];

    if (allNotifs.length === 0) return null;

    const totalChars = allNotifs.reduce((acc, n) => acc + n.message.length, 0);
    const duration = Math.max(16, totalChars * 0.15);

    return (
        <motion.div
            initial={{ opacity: 0, y: -5, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(5px)' }}
            className="w-full relative bg-[#05050f]/60 backdrop-blur-2xl border border-white/10 pl-1.5 pr-4 rounded-full flex items-center shadow-[0_8px_32px_rgba(0,0,0,0.6)] group h-[48px] z-20 hover:border-white/20 transition-colors duration-500 overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-transparent pointer-events-none" />

            <div className="flex items-center gap-2.5 px-5 py-1.5 h-[36px] rounded-full z-20 bg-gradient-to-r from-blue-600/20 to-indigo-600/10 border border-blue-400/30 shadow-[0_0_20px_rgba(59,130,246,0.2)] shrink-0 mr-4 backdrop-blur-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[150%] animate-[shimmer_3s_infinite]" />
                <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,1)] animate-[pulse_2s_ease-in-out_infinite]" />
                <span className="text-[10px] font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200 tracking-[0.2em] whitespace-nowrap hidden sm:inline-block relative z-10">Alerts & Broadcasts</span>
            </div>

            <style>{`
                @keyframes marquee-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
                @keyframes shimmer { 100% { transform: translateX(150%); } }
                .marquee-content { display: inline-flex; align-items: center; height: 100%; padding-left: 100%; animation: marquee-ticker ${duration}s linear infinite; will-change: transform; }
                .group:hover .marquee-content { animation-play-state: paused; }
            `}</style>

            <div className="flex-1 overflow-hidden whitespace-nowrap relative h-full flex items-center" style={{ maskImage: 'linear-gradient(to right, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)' }}>
                <div className="marquee-content">
                    {allNotifs.map((n, i) => (
                        <div key={n.id} className="flex items-center h-full">
                            <span className={`text-[14px] font-medium tracking-wide drop-shadow-lg ${n.createdBy === 'system' ? 'text-amber-300' : 'text-slate-100'}`}>
                                {n.message}
                            </span>

                            <button
                                onClick={(e) => n.createdBy === 'system' ? setPersonalAlerts(prev => prev.filter(x => x.id !== n.id)) : handleDismiss(e, n.id)}
                                className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-400/50 text-emerald-400/80 hover:text-emerald-300 text-[10px] uppercase font-bold tracking-wider px-3.5 pt-[0.25rem] pb-[0.25rem] rounded-full ml-5 cursor-pointer backdrop-blur-xl shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.2)] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            >
                                <CheckCircle size={13} className="opacity-90" /> <span className="mt-[1px]">Acknowledge</span>
                            </button>

                            {i < allNotifs.length - 1 && <div className="w-[3px] h-[3px] rounded-full bg-white/20 mx-8 shrink-0" />}
                        </div>
                    ))}
                    <div className="w-16 h-1 flex-shrink-0" />
                </div>
            </div>
        </motion.div>
    );
}
