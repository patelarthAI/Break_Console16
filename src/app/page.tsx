'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import AppShell from '@/components/shell/AppShell';
import ReimaginedWorkspace from '@/components/ReimaginedWorkspace.legacy';
import { User, TimeLog, AppStatus } from '@/types';
import {
  getCurrentUser, setCurrentUser, getLogs, insertLog
} from '@/lib/store';
import { supabase } from '@/lib/supabase';
import {
  computeSession, computeWorkedTime, computeTotalTime,
  generateUUID, getTodayKey, setServerOffset, getRealNow
} from '@/lib/timeUtils';
import { useClock } from '@/hooks/useClock';

// ─── Pending Approval Screen ──────────────────────────────────────────────────
function PendingApproval({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    let delay = 5000; // start at 5s, backoff to max 30s
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const check = async () => {
      try {
        const { data } = await supabase.from('users').select('is_approved').eq('id', user.id).single();
        if (cancelled) return;
        if (data?.is_approved) { 
          setCurrentUser({ ...user, isApproved: true }); 
          setApproved(true);
          return; // stop polling once approved
        }
        // Reset delay on successful check (network is fine)
        delay = 5000;
      } catch {
        // On error, increase delay (exponential backoff)
        delay = Math.min(delay * 2, 30000);
        if (cancelled) return;
      }
      timeoutId = setTimeout(check, delay);
    };

    check();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [user]);

  if (approved) { 
    setTimeout(() => window.location.reload(), 500); 
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-sm p-8 rounded-3xl text-center space-y-6">
        <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain mx-auto" />
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Awaiting Approval</h2>
          <p className="text-slate-400 text-sm">Hi <span className="text-white font-semibold">{user.name}</span>, your account is pending admin approval.</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-amber-400">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <span className="text-sm font-medium">Checking every 5 seconds…</span>
        </div>
        <button onClick={onLogout} className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 mx-auto">
          <LogOut size={12} /> Sign out
        </button>
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
  const now = useClock();

  useEffect(() => {
    // 1. Sync server time
    fetch('/api/time')
      .then(res => res.json())
      .then(data => { if (data.now) setServerOffset(data.now); })
      .catch(e => console.error('Failed to sync server time:', e));

    // 2. Load user session
    const saved = getCurrentUser();
    if (saved) { 
      setUser(saved); 
      if (saved.isApproved) void loadLogs(saved.id); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLogs(userId: string) {
    setLogsLoading(true);
    try { 
      const todayLogs = await getLogs(userId, getTodayKey()); 
      setLogs(todayLogs); 
      restoreStatus(todayLogs); 
    } finally { 
      setLogsLoading(false); 
    }
  }

  function restoreStatus(todayLogs: TimeLog[]) {
    if (!todayLogs.length) return;
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
    setLogs((prev) => [...prev, log]);
    await insertLog(user.id, log);
  }, [user]);

  const handleLogin = async (u: User) => { 
    setUser(u); 
    if (u.isApproved) await loadLogs(u.id); 
  };

  const handleLogout = () => {
    setCurrentUser(null); 
    setUser(null); 
    setLogs([]); 
    setStatus('idle');
  };

  const session = computeSession(logs);
  const nowMs = now.getTime();
  const workedMs = computeWorkedTime(session, nowMs);
  const breakMs = computeTotalTime(session.breaks, nowMs);
  const brbMs = computeTotalTime(session.brbs, nowMs);

  return (
    <main className="min-h-screen flex flex-col items-center p-0 relative bg-[var(--surface-0)]">
      {!user && <AuthModal onLogin={handleLogin} />}
      {user && !user.isMaster && !user.isApproved && <PendingApproval user={user} onLogout={handleLogout} />}

      <AnimatePresence mode="wait">
        {user && (user.isMaster || user.isApproved) && (
          <motion.div
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {user.isMaster ? (
              <AppShell user={user} onLogout={handleLogout} />
            ) : (
              <ReimaginedWorkspace
                user={user}
                logs={logs}
                logsLoading={logsLoading}
                status={status as Exclude<AppStatus, 'on_leave'>}
                workedMs={workedMs}
                breakMs={breakMs}
                brbMs={brbMs}
                onLogout={handleLogout}
                onPunchIn={() => { void addLog('punch_in'); setStatus('working'); }}
                onPunchOut={() => { void addLog('punch_out'); setStatus('punched_out'); }}
                onStartBreak={() => { void addLog('break_start'); setStatus('on_break'); }}
                onEndBreak={() => { void addLog('break_end'); setStatus('working'); }}
                onBRBIn={() => { void addLog('brb_start'); setStatus('on_brb'); }}
                onBRBOut={() => { void addLog('brb_end'); setStatus('working'); }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
