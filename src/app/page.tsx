'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Check } from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import { useToast } from '@/components/Toast';
import AppShell from '@/components/shell/AppShell';
import EliteDashboard from '@/components/EliteDashboard';
import NASAClock from '@/components/NASAClock';
import { User, TimeLog, AppStatus } from '@/types';
import {
  getCurrentUser, setCurrentUser, getLogs, insertLog, getAllUsersStatus, UserStatusRecord, getSingleUserStatus
} from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { subscribe } from '@/lib/realtime';
import {
  computeSession, computeWorkedTime, computeTotalTime,
  generateUUID, getTodayKey, setServerOffset, getRealNow, countBRBs, getPastDaysZoned
} from '@/lib/timeUtils';
import { useClock } from '@/hooks/useClock';
import { STATUS_COUNTS } from '@/lib/statusMap';

// ─── Pending Approval Screen ──────────────────────────────────────────────────
function PendingApproval({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  
  useEffect(() => {
    let delay = 5000;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const check = async () => {
      try {
        const { data, error } = await supabase.from('users').select('is_approved').eq('id', user.id).single();
        if (cancelled) return;
        
        if (error || !data) {
          setStatus('rejected');
          return;
        }
        
        if (data.is_approved) { 
          setCurrentUser({ ...user, isApproved: true }); 
          setStatus('approved');
          return;
        }
        delay = 5000;
      } catch {
        delay = Math.min(delay * 2, 30000);
        if (cancelled) return;
      }
      timeoutId = setTimeout(check, delay);
    };

    check();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [user]);

  if (status === 'approved') { 
    setTimeout(() => window.location.reload(), 500); 
  }

  const isRejected = status === 'rejected';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      {/* Soft atmospheric overlay */}
      <div className="absolute inset-0 bg-[#02050A]/40 backdrop-blur-[4px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] px-10 py-12 rounded-[28px] text-center relative flex flex-col items-center justify-center pointer-events-auto"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.02), 0 25px 60px -15px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Soft atmospheric background glow centered on the card */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] rounded-full blur-[90px] opacity-[0.18] pointer-events-none ${isRejected ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ zIndex: -1 }} />

        {/* Apple-style Logo Frame */}
        <div className="relative mb-8">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 blur-xl opacity-70" />
          <div className="relative w-20 h-20 rounded-full border border-white/10 flex items-center justify-center bg-white/[0.02] backdrop-blur-md shadow-inner">
            <motion.img
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              src="/logo.png"
              alt="Brigade Pulse"
              className="w-12 h-12 object-contain"
            />
          </div>
        </div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className={`text-2xl font-light tracking-[0.06em] mb-4 ${isRejected ? 'text-red-400' : 'text-white'}`}
        >
          {isRejected ? 'ACCESS DENIED' : 'Awaiting Approval'}
        </motion.h2>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-[13.5px] text-white/50 leading-relaxed mb-8 max-w-[320px] font-light tracking-wide"
        >
          {isRejected ? (
            <p>Your authorization request for <span className="font-semibold text-white">{user.name}</span> has been declined.</p>
          ) : (
            <p>Hi <span className="font-medium text-white">{user.name}</span>, your account is currently pending admin approval.</p>
          )}
        </motion.div>
        
        {!isRejected ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-col items-center gap-3.5 mb-10 w-full"
          >
            {/* Minimal glowing loader bar */}
            <div className="w-48 h-[2px] bg-white/5 rounded-full overflow-hidden relative">
              <motion.div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-500/0 via-orange-400 to-orange-500/0 w-1/3"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.18em] text-orange-400/85 uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
              </span>
              <span>Syncing heartbeat</span>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}
            className="flex items-center gap-2 mb-10 px-5 py-2.5 rounded-full bg-red-500/5 border border-red-500/10 text-[11px] font-medium tracking-[0.1em] text-red-400 uppercase"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>Connection Terminated</span>
          </motion.div>
        )}

        <motion.button 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.4 }}
          onClick={onLogout} 
          className="group text-[11px] font-medium uppercase tracking-[0.2em] text-white/50 hover:text-white flex items-center justify-center gap-2.5 transition-all duration-300 border border-white/5 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.04] px-8 py-3 rounded-full pointer-events-auto shadow-sm hover:shadow-md"
        >
          <LogOut size={13} strokeWidth={1.8} className="opacity-60 group-hover:opacity-100 transition-opacity" />
          {isRejected ? 'Return to Gateway' : 'Sign out'}
        </motion.button>
      </motion.div>
    </div>
  );
}


// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [logsLoading, setLogsLoading] = useState(false);
  const [teamStatus, setTeamStatus] = useState<UserStatusRecord[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    working: 0,
    onBreak: 0,
    brb: 0,
    onLeave: 0,
    clockedOut: 0,
    offline: 0
  });
  const now = useClock();
  const { error: showError } = useToast();

  const loadLogs = useCallback(async (userId: string) => {
    setLogsLoading(true);
    try {
      let dayLogs = await getLogs(userId, getTodayKey());
      // Cross-midnight: today has activity but no punch_in means the session
      // began yesterday and crossed midnight. Stitch yesterday so worked/break
      // totals and status resolve correctly (matches getAllUsersStatus).
      if (dayLogs.length > 0 && !dayLogs.some(l => l.eventType === 'punch_in')) {
        const yesterdayKey = getPastDaysZoned(1, true)[0];
        if (yesterdayKey) {
          const yLogs = await getLogs(userId, yesterdayKey);
          if (yLogs.length) {
            dayLogs = [...yLogs, ...dayLogs].sort((a, b) => a.timestamp - b.timestamp);
          }
        }
      }
      setLogs(dayLogs);
      restoreStatus(dayLogs);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadTeamStatus = useCallback(async (force = false) => {
    try {
      const data = await getAllUsersStatus(undefined, force);
      setTeamStatus(data);
      
      // Calculate status counts for KPI cards using central logic
      const counts = STATUS_COUNTS(data);
      setStatusCounts(counts);
    } catch (e) {
      console.error('Failed to load team status:', e);
    }
  }, []);

  useEffect(() => {
    fetch('/api/time')
      .then(res => res.json())
      .then(data => { if (data.now) setServerOffset(data.now); })
      .catch(e => console.error('Failed to sync server time:', e));

    const saved = getCurrentUser();
    if (saved) {
      setUser(saved);
      if (saved.isApproved || saved.isMaster) {
        // Fire-and-forget: each dashboard renders its own loading/skeleton
        // state, so we never block the whole app behind the session splash.
        void loadLogs(saved.id);
        void loadTeamStatus();
      }
    }
    // Resolve the session gate immediately once the saved user is known.
    setLoadingSession(false);
    
    if (saved && (saved.isApproved || saved.isMaster)) {
      // Realtime sync: incrementally update team status when a log is added today
      const unsub = subscribe('time_logs', '*', async (payload: any) => {
        const userId = payload?.new?.user_id || payload?.old?.user_id;
        if (userId) {
          try {
            const updatedUserStatus = await getSingleUserStatus(userId);
            if (updatedUserStatus) {
              setTeamStatus(prev => {
                const newStatus = [...prev];
                const index = newStatus.findIndex(s => s.user.id === userId);
                if (index !== -1) {
                  newStatus[index] = updatedUserStatus;
                } else {
                  newStatus.push(updatedUserStatus);
                }
                setStatusCounts(STATUS_COUNTS(newStatus));
                return newStatus;
              });
            }
          } catch (e) {
            console.error('Failed to incremental update user status:', e);
          }
        } else {
          loadTeamStatus(); // fallback if payload is weird
        }
      }, `date=eq.${getTodayKey()}`);
      
      // Removed 5-minute fallback polling to eliminate massive API egress leaks
      return () => {
        unsub();
      };
    }
  }, [loadLogs, loadTeamStatus]);

  function restoreStatus(todayLogs: TimeLog[]) {
    if (!todayLogs.length) { setStatus('idle'); return; }
    const last = todayLogs[todayLogs.length - 1];
    const map: Record<string, AppStatus> = { 
      punch_in: 'working', 
      punch_out: 'punched_out', 
      break_start: 'on_break', 
      break_end: 'working', 
      brb_start: 'on_brb', 
      brb_end: 'working' 
    };
    setStatus(map[last.eventType] ?? 'idle');
  }

  const addLog = useCallback(async (eventType: TimeLog['eventType']) => {
    if (!user) return;
    const log: TimeLog = { id: generateUUID(), eventType, timestamp: getRealNow(), date: getTodayKey() };
    setLogs((prev) => [...prev, log]); // optimistic
    try {
      await insertLog(user.id, log);
      loadTeamStatus(); // refresh global state immediately
    } catch (e) {
      console.error('Failed to save time log:', e);
      // Roll back the optimistic entry and resync truth from the server.
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
      await loadLogs(user.id);
      showError('Action not saved', 'Check your connection and try again.');
    }
  }, [user, loadTeamStatus, loadLogs, showError]);

  const handleLogin = async (u: User) => { 
    setUser(u); 
    if (u.isApproved || u.isMaster) {
      await loadLogs(u.id); 
      await loadTeamStatus();
    }
  };

  const handleLogout = () => {
    setCurrentUser(null); 
    setUser(null); 
    setLogs([]); 
    setStatus('idle');
  };

  const session = computeSession(logs);
  const nowMs = now?.getTime() ?? Date.now();
  const workedMs = computeWorkedTime(session, nowMs);
  const totalBreakMs = computeTotalTime(session.breaks, nowMs);
  const totalBrbMs = computeTotalTime(session.brbs, nowMs);
  const brbCount = countBRBs(logs);

  if (loadingSession) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-0 relative z-10 bg-[#02050A]">
        <NASAClock />
        <div className="relative flex flex-col items-center justify-center gap-8 z-20">
          {/* Glowing pulse ring */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-2 rounded-full border border-purple-500/20 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center backdrop-blur-md shadow-inner">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-[10px] font-medium tracking-[0.25em] text-white/50 uppercase">Establishing Session</h2>
            <div className="flex gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-0 relative z-10 bg-[#02050A]">
      {(!user || (!user.isMaster && !user.isApproved)) && <NASAClock />}
      
      {!user && <AuthModal onLogin={handleLogin} />}
      {user && !user.isMaster && !user.isApproved && <PendingApproval user={user} onLogout={handleLogout} />}

      <AnimatePresence mode="wait">
        {user && (user.isMaster || user.isApproved) && (
          <motion.div
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full"
          >
            {user.isMaster ? (
              <AppShell user={user} onLogout={handleLogout} />
            ) : (
              <EliteDashboard
                user={user}
                onLogout={handleLogout}
                status={status}
                teamStatus={teamStatus}
                logs={logs}
                workedMs={workedMs}
                breakMs={totalBreakMs}
                brbMs={totalBrbMs}
                brbCount={brbCount}
                totalBreakMs={totalBreakMs + totalBrbMs}
                onAction={(action: string) => {
                  void addLog(action as any);
                  const map: Record<string, AppStatus> = {
                    punch_in: 'working',
                    punch_out: 'punched_out',
                    break_start: 'on_break',
                    break_end: 'working',
                    brb_start: 'on_brb',
                    brb_end: 'working'
                  };
                  setStatus(map[action]);
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

