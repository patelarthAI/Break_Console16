'use client';

import { useState, useDeferredValue, useMemo, useEffect, useCallback } from 'react';
import type { User, LeaveRecord } from '@/types';
import {
  getAllUsersStatus,
  getSingleUserStatus,
  getLeaves,
  getWeeklyBreakStats,
  masterOverride,
  getPendingUsers,
  approveUser,
  deleteUser,
  type UserStatusRecord,
  type WeeklyBreakStats,
} from '@/lib/store';
import { subscribe } from '@/lib/realtime';
import { getTodayKey } from '@/lib/timeUtils';
import { getClientTheme } from '@/lib/utils';

import FilterBar from '@/components/ui/FilterBar';
import RecruiterRow, { ROW_GRID, ROW_GAP, ROW_PX } from '@/components/admin/RecruiterRow';
import LeaveCalendar from '@/components/sidebar/LeaveCalendar';
import HallOfFame from '@/components/sidebar/HallOfFame';
import BreakViolators from '@/components/sidebar/BreakViolators';
import HybridEditDrawer from '@/components/HybridEditDrawer';
import type { StatusCounts } from '@/components/shell/StatusBar';
import { Check, RefreshCcw, X } from 'lucide-react';

type MemberStatus = 'working' | 'on_break' | 'on_brb' | 'on_leave' | 'logged_out' | 'offline';
type StatFilter = 'all' | MemberStatus;

interface LiveFloorProps {
  user: User;
  onStatusCountsChange: (counts: StatusCounts) => void;
  activeFilter: string;
}

function toMemberStatus(status: string, onLeave: boolean): MemberStatus {
  if (onLeave) return 'on_leave';
  if (status === 'working') return 'working';
  if (status === 'on_break') return 'on_break';
  if (status === 'on_brb') return 'on_brb';
  if (status === 'punched_out') return 'logged_out';
  return 'offline';
}

function toPersonKey(name: string, clientName: string) {
  return `${name.trim().toLowerCase()}::${clientName.trim().toLowerCase()}`;
}

// Client theme helper is imported from utils.ts

export default function LiveFloor({ user, onStatusCountsChange, activeFilter }: LiveFloorProps) {
  const [statusRecords, setStatusRecords] = useState<UserStatusRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [breakStats, setBreakStats] = useState<WeeklyBreakStats[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [editDrawer, setEditDrawer] = useState<{ userId: string; userName: string; clientName: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const todayKey = getTodayKey();

  const loadDashboard = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const [nextStatuses, nextLeaves, nextBreakStats, nextPending] = await Promise.all([
        getAllUsersStatus(undefined, showRefreshing),
        getLeaves(undefined, showRefreshing),
        getWeeklyBreakStats(undefined, showRefreshing),
        getPendingUsers(),
      ]);
      setStatusRecords(nextStatuses);
      setLeaves(nextLeaves);
      setBreakStats(nextBreakStats);
      setPendingUsers(nextPending);
    } catch {
      // Silent fail — data will load on next poll
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();

    // ── Realtime push (replaces fast polling) ──
    // On any time_logs change, fetch ONLY the affected user's status and patch it
    // in. Instant, seamless updates with minimal egress (one user's logs per event)
    // instead of re-fetching the whole floor on a timer.
    const unsubTimeLogs = subscribe('time_logs', '*', async (payload?: { new?: { user_id?: string }; old?: { user_id?: string } }) => {
      const userId = payload?.new?.user_id || payload?.old?.user_id;
      if (!userId) { void loadDashboard(); return; }
      try {
        const updated = await getSingleUserStatus(userId);
        if (!updated) return;
        setStatusRecords((prev) => {
          const idx = prev.findIndex((r) => r.user.id === userId);
          if (idx === -1) return [...prev, updated];
          const next = prev.slice();
          next[idx] = updated;
          return next;
        });
      } catch (e) {
        console.error('LiveFloor: realtime status patch failed', e);
      }
    }, `date=eq.${todayKey}`);

    // Subscribe to leaves table changes to automatically refresh leaves
    const unsubLeaves = subscribe('leaves', '*', async () => {
      try {
        const nextLeaves = await getLeaves();
        setLeaves(nextLeaves);
      } catch (e) {
        console.error('LiveFloor: failed to refresh leaves on realtime event', e);
      }
    });

    // Subscribe to users table changes to automatically refresh pending users and weekly stats
    const unsubUsers = subscribe('users', '*', async () => {
      try {
        const [nextPending, nextBreakStats] = await Promise.all([
          getPendingUsers(),
          getWeeklyBreakStats(),
        ]);
        setPendingUsers(nextPending);
        setBreakStats(nextBreakStats);
      } catch (e) {
        console.error('LiveFloor: failed to refresh users/stats on realtime event', e);
      }
    });

    // Extremely slow safety-net poll (10 minutes)
    const interval = window.setInterval(() => void loadDashboard(), 600000);

    return () => {
      unsubTimeLogs();
      unsubLeaves();
      unsubUsers();
      window.clearInterval(interval);
    };
  }, [loadDashboard, todayKey]);

  // Computed: leave keys for today
  const todayLeaveKeys = useMemo(
    () => new Set(leaves.filter((l) => l.date === todayKey).map((l) => toPersonKey(l.employee_name, l.client_name))),
    [leaves, todayKey],
  );

  // Map status records to enriched entries
  const enrichedRecords = useMemo(() => {
    return statusRecords.map((record) => {
      const isOnLeave = todayLeaveKeys.has(toPersonKey(record.user.name, record.user.clientName));
      const memberStatus = toMemberStatus(record.status, isOnLeave);
      return { record, memberStatus, isOnLeave };
    });
  }, [statusRecords, todayLeaveKeys]);

  // Stat counts
  const counts: StatusCounts = useMemo(() => {
    const c: StatusCounts = { all: 0, working: 0, on_break: 0, on_brb: 0, on_leave: 0, logged_out: 0, offline: 0 };
    c.all = enrichedRecords.length;
    for (const { memberStatus } of enrichedRecords) {
      c[memberStatus]++;
    }
    return c;
  }, [enrichedRecords]);

  // Push counts up
  useEffect(() => {
    onStatusCountsChange(counts);
  }, [counts, onStatusCountsChange]);

  // Client options
  const clientOptions = useMemo(() => {
    const set = new Set(statusRecords.map((r) => r.user.clientName));
    return Array.from(set).sort();
  }, [statusRecords]);

  // Filtered + sorted
  const filteredRecords = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const statusFilter = activeFilter as StatFilter;

    return enrichedRecords
      .filter(({ record, memberStatus }) => {
        if (clientFilter.length > 0 && !clientFilter.includes(record.user.clientName)) return false;
        if (statusFilter !== 'all' && memberStatus !== statusFilter) return false;
        if (query && !record.user.name.toLowerCase().includes(query) && !record.user.clientName.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => {
        const order: Record<MemberStatus, number> = { on_break: 0, on_brb: 1, working: 2, on_leave: 3, logged_out: 4, offline: 5 };
        const diff = order[a.memberStatus] - order[b.memberStatus];
        return diff !== 0 ? diff : a.record.user.name.localeCompare(b.record.user.name);
      });
  }, [enrichedRecords, deferredSearch, clientFilter, activeFilter]);

  // Group by client
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredRecords>();
    for (const entry of filteredRecords) {
      const key = entry.record.user.clientName;
      const arr = map.get(key) ?? [];
      arr.push(entry);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRecords]);

  // Admin actions
  const handleEndBreak = async (userId: string) => {
    await masterOverride(userId, 'break_end', user.id);
    void loadDashboard(true);
  };

  const handleEndBrb = async (userId: string) => {
    await masterOverride(userId, 'brb_end', user.id);
    void loadDashboard(true);
  };

  const handlePunchOut = async (userId: string) => {
    await masterOverride(userId, 'punch_out', user.id);
    void loadDashboard(true);
  };

  const handleApprove = async (u: User) => {
    await approveUser(u.id);
    setPendingUsers((prev) => prev.filter((p) => p.id !== u.id));
    void loadDashboard(true);
  };

  const handleReject = async (u: User) => {
    await deleteUser(u.id);
    setPendingUsers((prev) => prev.filter((p) => p.id !== u.id));
    void loadDashboard(true);
  };

  const handleEditLogs = (userId: string, userName: string, clientName: string) => {
    const targetUser = statusRecords.find((r) => r.user.id === userId)?.user;
    if (targetUser) {
      setEditDrawer({ userId, userName, clientName });
    }
  };

  const todayLeaveCount = todayLeaveKeys.size;

  // Find the user object for the edit drawer
  const editUser = editDrawer ? statusRecords.find((r) => r.user.id === editDrawer.userId)?.user : null;

  return (
    <>
      <div className="relative max-w-[1400px] mx-auto flex gap-6 px-4 lg:px-6 pt-4 pb-6 min-h-[85vh] overflow-hidden z-10 w-full">
        {/* Futuristic Ambient Orbs background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] mix-blend-screen animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-950/15 blur-[150px] mix-blend-screen" />
          <div className="absolute top-[40%] right-[20%] w-[35%] h-[35%] rounded-full bg-indigo-950/10 blur-[100px] mix-blend-screen" />
        </div>

        {/* Left: Roster */}
        <div className="flex-1 min-w-0 space-y-3 relative z-10">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                clientFilter={clientFilter}
                clientOptions={clientOptions}
                onClientFilterChange={setClientFilter}
                matchCount={filteredRecords.length}
                onRefresh={() => void loadDashboard(true)}
                isLoading={refreshing}
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-14 rounded-lg" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <div className="card p-8 text-center bg-[#0c0d15] border-white/[0.04]">
              <div className="text-3xl mb-3 opacity-50">🔍</div>
              <div className="text-sm font-semibold text-slate-400">No recruiters match the current filters.</div>
              <div className="text-xs text-slate-600 mt-1">Try adjusting your search or status filter.</div>
            </div>
          ) : (
            grouped.map(([clientName, members]) => {
              const activeCount = members.filter((m) => m.memberStatus === 'working').length;
              const breakCount = members.filter((m) => m.memberStatus === 'on_break' || m.memberStatus === 'on_brb').length;
              const theme = getClientTheme(clientName);
              return (
                <section 
                  key={clientName} 
                  className="relative mt-8 mb-10 first:mt-4 rounded-2xl overflow-hidden border transition-all duration-300"
                  style={{
                    background: 'rgba(255, 255, 255, 0.015)',
                    backdropFilter: 'blur(30px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(160%)',
                    borderColor: 'rgba(255, 255, 255, 0.04)',
                    boxShadow: `0 24px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px ${theme.color}08, inset 0 1px 0 rgba(255, 255, 255, 0.06)`,
                  }}
                >
                  {/* Glowing dynamic top border (Hotstar style) */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-[2.5px] z-20 pointer-events-none transition-all duration-300"
                    style={{
                      background: `linear-gradient(90deg, transparent 10%, ${theme.color} 50%, transparent 90%)`,
                      boxShadow: `0 1.5px 12px ${theme.color}`,
                    }}
                  />

                  {/* Section header panel */}
                  <div className="flex items-center justify-between px-6 py-4 bg-white/[0.005] border-b border-white/[0.03] select-none">
                    <div className="flex items-center gap-3">
                      {/* Themed vertical accent bar */}
                      <div 
                        className="h-4.5 w-1 rounded-full transition-all duration-300 animate-pulse"
                        style={{ 
                          backgroundColor: theme.color, 
                          boxShadow: `0 0 10px ${theme.color}` 
                        }} 
                      />
                      
                      {/* Section label with unique color and glow */}
                      <span 
                        className="text-[13px] font-black uppercase tracking-[0.25em] transition-all duration-300"
                        style={{
                          color: theme.color,
                          textShadow: `0 0 10px ${theme.glow}`,
                        }}
                      >
                        {clientName}
                      </span>
                    </div>
 
                    {/* Dynamic styled count pills */}
                    <div className="flex items-center gap-2">
                      <span 
                        className="px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all duration-300"
                        style={{
                          borderColor: theme.pillBorder,
                          backgroundColor: theme.pillBg,
                          color: theme.color,
                        }}
                      >
                        {members.length} REPS
                      </span>
                      {activeCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full border border-emerald-500/10 bg-emerald-500/[0.03] text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                          {activeCount} ACTIVE
                        </span>
                      )}
                      {breakCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full border border-amber-500/10 bg-amber-500/[0.03] text-[9px] font-bold text-amber-400 uppercase tracking-widest">
                          {breakCount} BREAK
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Roster Rows wrapper list inside the card panel */}
                  <div className="p-3 pt-2.5 space-y-3.5 bg-[#06040a]/40">
                    {/* Local Table Headers aligned perfectly inside the container */}
                    <div className={`grid ${ROW_GRID} ${ROW_GAP} ${ROW_PX} pb-2 border-b border-white/[0.02] select-none items-center`}>
                       <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Rep</div>
                       <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Identity</div>
                       <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Protocol</div>
                       <div className="relative text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">
                         <div className="absolute left-[-6px] top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-white/[0.05] to-transparent pointer-events-none" />
                         Shift
                       </div>
                       <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Break</div>
                       <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">BRB</div>
                       <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Total</div>
                       <div className="relative text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">
                         <div className="absolute left-[-6px] top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-white/[0.05] to-transparent pointer-events-none" />
                         Actions
                       </div>
                    </div>
                    {members.map(({ record, isOnLeave }) => (
                      <RecruiterRow
                        key={record.user.id}
                        record={record}
                        isOnLeave={isOnLeave}
                        onEndBreak={handleEndBreak}
                        onEndBrb={handleEndBrb}
                        onPunchOut={handlePunchOut}
                        onEditLogs={handleEditLogs}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* Right: Sidebar */}
        <aside className="hidden xl:block w-72 flex-shrink-0 space-y-3">
          <LeaveCalendar leaves={leaves} todayLeaveCount={todayLeaveCount} />
          <HallOfFame stats={breakStats} />
          <BreakViolators stats={breakStats} />

          {/* Approval Queue */}
          {pendingUsers.length > 0 && (
            <div className="card p-4 border-amber-500/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-300">Pending Approvals</span>
                <span className="badge text-[9px] bg-amber-400/10 text-amber-300 border-amber-400/20">
                  {pendingUsers.length}
                </span>
              </div>
              <div className="space-y-3.5">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="flex flex-col gap-2 py-2.5 border-b border-white/[0.03] last:border-0 last:pb-0 first:pt-0">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{u.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{u.clientName}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleApprove(u)}
                        className="flex-1 btn btn-success text-[10px] py-1.5 px-2 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check size={10} /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReject(u)}
                        className="flex-1 btn text-[10px] py-1.5 px-2 flex items-center justify-center gap-1 cursor-pointer"
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                        }}
                      >
                        <X size={10} /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Edit Drawer */}
      {editDrawer && editUser && (
        <HybridEditDrawer
          user={editUser}
          date={todayKey}
          currentUserId={user.id}
          onClose={() => setEditDrawer(null)}
          onSave={() => void loadDashboard(true)}
        />
      )}
    </>
  );
}
