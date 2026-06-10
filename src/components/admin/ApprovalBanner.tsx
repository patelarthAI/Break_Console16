'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Check, X, RefreshCw, UserCheck, Clock, Building2, ChevronRight } from 'lucide-react';
import { getPendingUsers, approveUser, deleteUser } from '@/lib/store';
import type { User } from '@/types';

// ─── Full-page Approval Modal ─────────────────────────────────────────────────
function ApprovalModal({ users, processingId, onApprove, onDeny, onClose }: {
  users: User[];
  processingId: string | null;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl rounded-[24px] overflow-hidden"
        style={{ background: 'rgba(8,8,14,0.95)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <ShieldAlert size={20} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-white tracking-tight">Access Requests</h2>
                <p className="text-[12px] text-white/40 mt-0.5">
                  {users.length} pending {users.length === 1 ? 'recruiter' : 'recruiters'} awaiting clearance
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] hover:border-white/10 transition-all duration-200"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-4 flex flex-col gap-2 max-h-[480px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          <AnimatePresence mode="popLayout">
            {users.map((user, i) => (
              <motion.div
                key={user.id} layout
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20, height: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                className="flex items-center gap-5 px-5 py-4 rounded-2xl group transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-[13px] font-bold text-indigo-300 uppercase">
                    {user.name.slice(0, 2)}
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-[2px] border-[#08080e]">
                    <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-60" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white tracking-tight truncate">{user.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Building2 size={10} className="text-white/30 flex-shrink-0" />
                    <span className="text-[11px] text-white/40 truncate">{user.clientName || 'No client'}</span>
                    <span className="text-white/15">/</span>
                    <Clock size={10} className="text-white/30 flex-shrink-0" />
                    <span className="text-[11px] text-white/40">{user.shiftStart} – {user.shiftEnd}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => onApprove(user.id)} disabled={!!processingId}
                    className="h-8 px-5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 flex items-center gap-1.5"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.22)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.4)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.25)'; }}
                  >
                    {processingId === user.id ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <Check size={11} strokeWidth={2.5} />
                    )}
                    {processingId === user.id ? 'Granting...' : 'Approve'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => onDeny(user.id)} disabled={!!processingId}
                    className="h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(248,113,113,0.7)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = 'rgba(248,113,113,0.7)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)'; }}
                  >
                    <X size={14} strokeWidth={2} />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {users.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <UserCheck size={32} className="text-emerald-500/40" />
              <p className="text-[13px] text-white/30 font-medium">All clear — no pending requests</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Banner ────────────────────────────────────────────────────────────────────
export default function ApprovalBanner() {
  const [pending, setPending] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadPending = useCallback(async () => {
    try {
      const users = await getPendingUsers();
      setPending(users);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
    const interval = setInterval(() => void loadPending(), 30000);
    return () => clearInterval(interval);
  }, [loadPending]);

  const handleApprove = async (userId: string) => {
    setProcessingId(userId);
    try {
      await approveUser(userId);
      setPending(prev => prev.filter(u => u.id !== userId));
    } catch (err) { console.error('Approval failed:', err); }
    finally { setProcessingId(null); }
  };

  const handleDeny = async (userId: string) => {
    setProcessingId(userId);
    try {
      await deleteUser(userId);
      setPending(prev => prev.filter(u => u.id !== userId));
    } catch (err) { console.error('Denial failed:', err); }
    finally { setProcessingId(null); }
  };

  if (loading || pending.length === 0) return null;

  // Inline users to show in the banner (max 2), rest open modal
  const inlinePending = pending.slice(0, 2);
  const extraCount = pending.length - inlinePending.length;

  return (
    <>
      <motion.div
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-[99] overflow-hidden"
        style={{ background: 'rgba(6,6,12,0.9)', borderBottom: '1px solid rgba(245,158,11,0.12)', backdropFilter: 'blur(24px)' }}
      >
        {/* Top edge glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none" />

        <div className="max-w-[1800px] mx-auto px-6 h-[60px] flex items-center justify-between gap-8">
          {/* Left: badge + count */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <ShieldAlert size={17} className="text-amber-400" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] bg-rose-600 rounded-full border-[2.5px] border-[#06060c] flex items-center justify-center">
                <span className="text-[9px] font-black text-white leading-none">{pending.length}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-400/70 uppercase tracking-[0.25em] leading-none mb-1">Clearance Queue</p>
              <p className="text-[13px] font-semibold text-white leading-none">
                {pending.length} recruiter{pending.length > 1 ? 's' : ''} awaiting approval
              </p>
            </div>
          </div>

          {/* Right: inline cards + overflow */}
          <div className="flex items-center gap-3 overflow-hidden">
            <AnimatePresence mode="popLayout">
              {inlinePending.map((user) => (
                <motion.div
                  key={user.id} layout
                  initial={{ opacity: 0, scale: 0.9, x: 15 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: -15 }}
                  className="flex items-center gap-4 pl-4 pr-3 h-10 rounded-2xl flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-[9px] font-bold text-indigo-300 uppercase">
                      {user.name.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-white leading-none">{user.name}</p>
                      <p className="text-[9px] text-white/35 leading-none mt-0.5">{user.clientName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 border-l border-white/[0.06] pl-3">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => handleApprove(user.id)} disabled={!!processingId}
                      className="h-7 px-3 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}
                    >
                      {processingId === user.id ? <RefreshCw size={9} className="animate-spin" /> : <Check size={9} strokeWidth={3} />}
                      {processingId === user.id ? '...' : 'Approve'}
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => handleDeny(user.id)} disabled={!!processingId}
                      className="h-7 w-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', color: 'rgba(248,113,113,0.6)' }}
                    >
                      <X size={11} strokeWidth={2} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* "View all" if more than 2 */}
            {extraCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 h-10 rounded-2xl flex-shrink-0 transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest">+{extraCount} more</span>
                <ChevronRight size={12} />
              </motion.button>
            )}

            {/* View all button */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 h-10 rounded-2xl flex-shrink-0 transition-all"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: 'rgba(129,140,248,0.7)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#818cf8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.color = 'rgba(129,140,248,0.7)'; }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest">Manage All</span>
              <ChevronRight size={12} />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Full Approval Modal */}
      <AnimatePresence>
        {showModal && (
          <ApprovalModal
            users={pending}
            processingId={processingId}
            onApprove={handleApprove}
            onDeny={handleDeny}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
