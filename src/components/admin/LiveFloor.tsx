'use client';

import { useState, useDeferredValue, useMemo, useEffect, useCallback } from 'react';
import type { User, LeaveRecord } from '@/types';
import {
  getAllUsersStatus,
  getLeaves,
  get7DayBreakStats,
  masterOverride,
  getPendingUsers,
  approveUser,
  type UserStatusRecord,
  type UserBreakStats,
} from '@/lib/store';
import { getTodayKey } from '@/lib/timeUtils';
import FilterBar from '@/components/ui/FilterBar';
import RecruiterRow from '@/components/admin/RecruiterRow';
import LeaveCalendar from '@/components/sidebar/LeaveCalendar';
import HallOfFame from '@/components/sidebar/HallOfFame';
import BreakViolators from '@/components/sidebar/BreakViolators';
import HybridEditDrawer from '@/components/HybridEditDrawer';
import type { StatusCounts } from '@/components/shell/StatusBar';
import { Check, RefreshCcw } from 'lucide-react';

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

export default function LiveFloor({ user, onStatusCountsChange, activeFilter }: LiveFloorProps) {
  const [statusRecords, setStatusRecords] = useState<UserStatusRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [breakStats, setBreakStats] = useState<UserBreakStats[]>([]);
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
        get7DayBreakStats(undefined, showRefreshing),
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
    const interval = window.setInterval(() => void loadDashboard(), 20000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

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
      <div className="flex gap-4 px-4 lg:px-6 pb-6">
        {/* Left: Roster */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                clientFilter={clientFilter}
                clientOptions={clientOptions}
                onClientFilterChange={setClientFilter}
                matchCount={filteredRecords.length}
              />
            </div>
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              className={`btn btn-ghost text-xs py-2.5 px-3 ${refreshing ? 'animate-spin' : ''}`}
              title="Force refresh"
            >
              <RefreshCcw size={14} />
            </button>
          </div>

          {!loading && filteredRecords.length > 0 && (
            <div className="grid grid-cols-[auto_1fr_120px_minmax(180px,1.5fr)_140px] gap-5 px-6 py-2 mb-1 border-b border-white/5 opacity-40">
               <div className="w-12 h-1 text-[9px] font-black uppercase tracking-widest text-slate-500 flex justify-center">Reps</div>
               <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Identity / Client</div>
               <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">Protocol</div>
               <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Activity Timeline</div>
               <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</div>
            </div>
          )}

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
              return (
                <section key={clientName} className="mb-8">
                  <div className="flex items-center gap-3 px-6 py-4 mb-4 rounded-3xl bg-[#00d2ff]/[0.05] border border-[#00d2ff]/20 shadow-[0_4px_32px_rgba(0,210,255,0.05)] backdrop-blur-xl">
                    <span className="text-xl font-outfit font-black text-white uppercase tracking-[0.2em] drop-shadow-[0_0_8px_rgba(0,210,255,0.5)]">
                      {clientName}
                    </span>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 rounded-full border border-slate-700 bg-slate-800/80 text-[10px] font-bold text-slate-300 tracking-[0.2em] shadow-inner">
                        {members.length} REPS
                      </span>
                      {activeCount > 0 && (
                        <span className="px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 text-[10px] font-bold text-emerald-400 tracking-[0.2em] shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                          {activeCount} ACTIVE
                        </span>
                      )}
                      {breakCount > 0 && (
                        <span className="px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/20 text-[10px] font-bold text-amber-400 tracking-[0.2em] shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                          {breakCount} BREAK
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
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
              <div className="space-y-2">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{u.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{u.clientName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleApprove(u)}
                      className="btn btn-success text-[10px] py-1 px-2 flex-shrink-0"
                    >
                      <Check size={11} /> Approve
                    </button>
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
