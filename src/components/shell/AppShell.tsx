// src/components/shell/AppShell.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowLeftRight, ShieldCheck, Loader2 } from 'lucide-react';
import type { User } from '@/types';
import AdminNavbar from '@/components/admin/AdminNavbar';
import StatusBar, { type StatusCounts } from '@/components/shell/StatusBar';
import LiveFloor from '@/components/admin/LiveFloor';
import BroadcastBanner from '@/components/BroadcastBanner';
import { useToast } from '@/components/Toast';
import { subscribe } from '@/lib/realtime';
import {
  getPendingDeskTransfers,
  approveWorkstationTransfer,
  rejectWorkstationTransfer,
  listenForDeskTransferRequests,
  type DeskTransferRequest,
} from '@/lib/sessionLock';

// Lazy-load heavy views
const MasterReports = dynamic(() => import('@/components/MasterReports'), {
  loading: () => <div className="skeleton rounded-xl h-96 mx-6 mt-6" />,
});
const MasterLeaveTracker = dynamic(() => import('@/components/MasterLeaveTracker'), {
  loading: () => <div className="skeleton rounded-xl h-96 mx-6 mt-6" />,
});
const AdminSettings = dynamic(() => import('@/components/admin/Settings'), {
  loading: () => <div className="skeleton rounded-xl h-96 mx-6 mt-6" />,
});

interface AppShellProps {
  user: User;
  onLogout: () => void;
}

export default function AppShell({ user, onLogout }: AppShellProps) {
  const { success, error: toastError } = useToast();
  const [activeView, setActiveView] = useState('dashboard');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingTransfers, setPendingTransfers] = useState<DeskTransferRequest[]>([]);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0,
    working: 0,
    on_break: 0,
    on_brb: 0,
    on_leave: 0,
    logged_out: 0,
    offline: 0,
  });

  const handleStatusCountsChange = useCallback((counts: StatusCounts) => {
    setStatusCounts(counts);
  }, []);

  const refreshPendingTransfers = useCallback(async () => {
    if (!user.isMaster) return;
    try {
      const list = await getPendingDeskTransfers();
      setPendingTransfers(list);
    } catch (err) {
      console.warn('Failed to fetch pending desk transfers:', err);
    }
  }, [user.isMaster]);

  useEffect(() => {
    if (!user.isMaster) return;
    void refreshPendingTransfers();

    // 1. Listen for realtime broadcast requests from recruiters
    const unsubBroadcast = listenForDeskTransferRequests(
      (newReq) => {
        setPendingTransfers((prev) => {
          if (prev.some((p) => p.userId === newReq.userId)) return prev;
          return [newReq, ...prev];
        });
        success('Desk Transfer Request', `${newReq.userName} (${newReq.clientName}) requested to switch workstations.`);
      },
      (resolvedUserId) => {
        setPendingTransfers((prev) => prev.filter((p) => p.userId !== resolvedUserId));
      }
    );

    // 2. Listen for DB updates on time_logs to keep in sync
    const unsubLogs = subscribe('time_logs', '*', () => {
      void refreshPendingTransfers();
    });

    return () => {
      unsubBroadcast();
      unsubLogs();
    };
  }, [user.isMaster, refreshPendingTransfers, success]);

  const handleApproveTransfer = async (req: DeskTransferRequest) => {
    setProcessingUserId(req.userId);
    try {
      const ok = await approveWorkstationTransfer(req.userId, req.targetDeviceId);
      if (ok) {
        setPendingTransfers((prev) => prev.filter((p) => p.userId !== req.userId));
        success('Desk Transfer Authorized', `${req.userName} has been transferred to Station [${req.stationCode}].`);
      } else {
        toastError('Transfer Failed', 'Could not rebind desk. Try again.');
      }
    } catch (err: any) {
      toastError('Transfer Failed', err?.message || 'Error authorizing desk.');
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleRejectTransfer = async (req: DeskTransferRequest) => {
    setProcessingUserId(req.userId);
    try {
      await rejectWorkstationTransfer(req.userId);
      setPendingTransfers((prev) => prev.filter((p) => p.userId !== req.userId));
      success('Request Declined', `Declined transfer request for ${req.userName}.`);
    } catch (err: any) {
      toastError('Action Failed', err?.message || 'Error declining request.');
    } finally {
      setProcessingUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      {/* ── Captain Live Desk Transfer Approval HUD ────────────────────────────── */}
      <AnimatePresence>
        {user.isMaster && pendingTransfers.length > 0 && (
          <motion.aside
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="sticky top-0 z-50 px-4 py-2.5 bg-gradient-to-r from-[#170e28]/95 via-[#1a1438]/95 to-[#0b172a]/95 border-b border-indigo-500/40 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.85)]"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 font-mono flex items-center gap-1">
                      <ArrowLeftRight size={11} /> Desk Transfer Approval ({pendingTransfers.length})
                    </span>
                    <span className="text-xs text-white font-bold">
                      {pendingTransfers[0].userName}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {pendingTransfers[0].clientName}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Recruiter shifted desks and requests to transfer active shift to Station <span className="font-mono text-amber-200 font-bold bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">[{pendingTransfers[0].stationCode}]</span>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={processingUserId === pendingTransfers[0].userId}
                  onClick={() => handleApproveTransfer(pendingTransfers[0])}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] text-white text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_16px_rgba(16,185,129,0.35)] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {processingUserId === pendingTransfers[0].userId ? (
                    <><Loader2 size={13} className="animate-spin" /> Authorizing…</>
                  ) : (
                    <><Check size={13} strokeWidth={2.5} /> Approve &amp; Bind Desk</>
                  )}
                </button>
                <button
                  type="button"
                  disabled={processingUserId === pendingTransfers[0].userId}
                  onClick={() => handleRejectTransfer(pendingTransfers[0])}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 text-zinc-400 text-xs font-semibold tracking-wider uppercase transition-all border border-white/10 cursor-pointer disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AdminNavbar
        user={user}
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={onLogout}
      />

      {/* Broadcast Announcement Banner (only shows real management announcements, never daily directive quotes) */}
      <BroadcastBanner user={user} hideDirective={true} className="max-w-7xl mx-auto px-6 pt-3" />

      {/* Status bar (KPI tiles) only on dashboard */}
      {activeView === 'dashboard' && (
        <StatusBar
          counts={statusCounts}
          activeFilter={statusFilter}
          onFilterChange={setStatusFilter}
        />
      )}

      {/* Views */}
      {activeView === 'dashboard' && (
        <LiveFloor
          user={user}
          onStatusCountsChange={handleStatusCountsChange}
          activeFilter={statusFilter}
        />
      )}

      {activeView === 'reports' && (
        <div className="px-4 lg:px-6 pt-4 pb-6">
          <MasterReports />
        </div>
      )}

      {activeView === 'leave' && (
        <div className="px-4 lg:px-6 pt-4 pb-6">
          <MasterLeaveTracker currentUser={user} />
        </div>
      )}

      {activeView === 'settings' && (
        <div className="px-4 lg:px-6 pt-4 pb-6">
          <AdminSettings user={user} />
        </div>
      )}
    </div>
  );
}
