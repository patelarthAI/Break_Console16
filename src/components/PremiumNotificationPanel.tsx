'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { AppNotification } from '@/types';
import { dismissNotification, getActiveNotifications } from '@/lib/store';
import { subscribe } from '@/lib/realtime';

export default function PremiumNotificationPanel({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const active = await getActiveNotifications(userId);
        setNotifications(active);
      } catch (err) {
        console.error('Failed to load notifications', err);
      }
    };

    load();

    // Subscribe to all notification changes via shared channel
    const unsubInsert = subscribe('notifications', 'INSERT', async () => {
      try {
        const active = await getActiveNotifications(userId);
        setNotifications(active);
      } catch { /* ignore */ }
    });
    const unsubUpdate = subscribe('notifications', 'UPDATE', async () => {
      try {
        const active = await getActiveNotifications(userId);
        setNotifications(active);
      } catch { /* ignore */ }
    });
    const unsubDelete = subscribe('notifications', 'DELETE', async () => {
      try {
        const active = await getActiveNotifications(userId);
        setNotifications(active);
      } catch { /* ignore */ }
    });

    return () => {
      unsubInsert();
      unsubUpdate();
      unsubDelete();
    };
  }, [userId]);

  const handleDismiss = async (notifId: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== notifId));
    try {
      await dismissNotification(notifId, userId);
    } catch (err) {
      console.error('Failed to dismiss notification', err);
    }
  };

  if (notifications.length === 0) return null;

  return (
    <section className="surface-card rounded-[2rem] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#67d7ff]/20 bg-[#67d7ff]/10 p-2.5 text-[#67d7ff]">
            <BellRing size={18} />
          </div>
          <div>
            <p className="section-kicker">Broadcasts</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Live updates from the control desk</h3>
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
          {notifications.length} active
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm leading-7 text-slate-200">{notification.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Posted {new Date(notification.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                    at{' '}
                    {new Date(notification.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(notification.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#64d7a6]/20 bg-[#64d7a6]/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#64d7a6] transition-colors hover:bg-[#64d7a6]/20"
                >
                  <CheckCircle2 size={14} />
                  Ack
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
