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
  formatStationCode,
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
      {/* ── 2026 Captain Dynamic Island Floating HUD ───────────────────────────── */}
      <AnimatePresence>
        {user.isMaster && pendingTransfers.length > 0 && (
          <motion.div
            initial={{ y: -80, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] w-[92%] max-w-xl pointer-events-auto"
          >
            <div className="p-3 pl-3.5 rounded-2xl bg-[#090b14]/94 border border-amber-500/35 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(245,158,11,0.2)] flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.25)]">
                    <ArrowLeftRight size={15} className="animate-pulse" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300">
                      Desk Transfer Request {pendingTransfers.length > 1 ? `(${pendingTransfers.length})` : ''}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                      {pendingTransfers[0].clientName}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white truncate mt-0.5">
                    {pendingTransfers[0].userName}
                    <span className="text-zinc-400 font-normal ml-1.5 font-mono text-[11px]">
                      requests shift bind to <span className="text-amber-200 font-bold font-mono">[{formatStationCode(pendingTransfers[0].targetDeviceId)}]</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={processingUserId === pendingTransfers[0].userId}
                  onClick={() => handleApproveTransfer(pendingTransfers[0])}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] text-white text-[10px] font-bold tracking-wider uppercase transition-all shadow-[0_0_16px_rgba(16,185,129,0.35)] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {processingUserId === pendingTransfers[0].userId ? (
                    <><Loader2 size={12} className="animate-spin" /> Authorizing…</>
                  ) : (
                    <><Check size={12} strokeWidth={2.5} /> Authorize</>
                  )}
                </button>
                <button
                  type="button"
                  disabled={processingUserId === pendingTransfers[0].userId}
                  onClick={() => handleRejectTransfer(pendingTransfers[0])}
                  className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-zinc-400 text-xs transition-all border border-white/10 cursor-pointer disabled:opacity-50"
                  title="Decline Request"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
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
