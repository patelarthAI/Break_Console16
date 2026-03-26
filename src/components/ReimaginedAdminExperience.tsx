'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Download,
  Pencil,
  Plus,
  RadioTower,
  RefreshCcw,
  Search,
  Trash2,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useToast } from '@/components/Toast';
import { AppNotification, LeaveRecord, User } from '@/types';
import {
  ClientRow,
  UserStatusRecord,
  addClient,
  addLeave,
  approveUser,
  createNotification,
  deleteClient,
  deleteLeave,
  deleteNotification,
  deleteUser,
  getAllNotifications,
  getAllUsers,
  getAllUsersStatus,
  getClients,
  getLeaves,
  getLogsBatch,
  getPendingUsers,
  renameClient,
  updateUser,
} from '@/lib/store';
import {
  checkViolations,
  computeSession,
  computeTotalTime,
  computeWorkedTime,
  exportCSV,
  formatDuration,
  getTodayKey,
  parseShiftMins,
} from '@/lib/timeUtils';
import {
  type AdminView,
  type ConfirmState,
  type EditUserDraft,
  type LeaveDraft,
  type LiveStatus,
  type ReportRange,
  type ReportRow,
  EmptyState,
  getInitials,
  MetricTile,
  REPORT_RANGE_LABELS,
  SectionHeading,
  StatusChip,
  Surface,
  TIMEZONE_OPTIONS,
  STATUS_META,
  formatReadableDate,
  formatShortTime,
  getDatesForRange,
  normalizeStatus,
} from '@/components/reimagined/workspaceShared';
import { cn } from '@/lib/utils';

interface Props {
  user: User;
  view: AdminView;
}

export default function ReimaginedAdminExperience({ user, view }: Props) {
  const { success, error: toastError, info } = useToast();
  const [statusRecords, setStatusRecords] = useState<UserStatusRecord[]>([]);
  const [statusesLoading, setStatusesLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportRange, setReportRange] = useState<ReportRange>('today');
  const [reportsLoading, setReportsLoading] = useState(false);
  const [broadcasts, setBroadcasts] = useState<AppNotification[]>([]);
  const [managementLoading, setManagementLoading] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardClientFilter, setDashboardClientFilter] = useState('all');
  const [reportSearch, setReportSearch] = useState('');
  const [settingsSearch, setSettingsSearch] = useState('');
  const [clientDraft, setClientDraft] = useState('');
  const [clientEditId, setClientEditId] = useState<string | null>(null);
  const [clientEditName, setClientEditName] = useState('');
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [editingUser, setEditingUser] = useState<EditUserDraft | null>(null);
  const [leaveDraft, setLeaveDraft] = useState<LeaveDraft>({
    employeeName: '',
    clientName: '',
    date: getTodayKey(),
    leaveType: 'Planned Leave',
    dayCount: '1',
    reason: '',
    isPlanned: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPresence() {
      setStatusesLoading(true);
      try {
        const [records, pending] = await Promise.all([getAllUsersStatus(), getPendingUsers()]);
        if (!cancelled) {
          setStatusRecords(records);
          setPendingUsers(pending);
        }
      } catch (error) {
        console.error('Failed to load live presence', error);
        if (!cancelled) toastError('Unable to load live floor', 'Please retry once the connection is back.');
      } finally {
        if (!cancelled) setStatusesLoading(false);
      }
    }

    void loadPresence();
    const intervalId = window.setInterval(() => {
      void loadPresence();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [toastError]);

  useEffect(() => {
    let cancelled = false;

    async function loadClientsList() {
      try {
        const data = await getClients();
        if (!cancelled) {
          setClients(data);
          setLeaveDraft((current) => ({ ...current, clientName: current.clientName || data[0]?.name || '' }));
        }
      } catch (error) {
        console.error('Failed to load clients', error);
      }
    }

    void loadClientsList();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (view !== 'reports') return;
    void loadReports(reportRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportRange, view]);

  useEffect(() => {
    if (view !== 'settings') return;
    void loadSettingsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (view !== 'leave') return;
    void loadLeavesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function refreshPresence() {
    setStatusesLoading(true);
    try {
      const [records, pending] = await Promise.all([getAllUsersStatus(), getPendingUsers()]);
      setStatusRecords(records);
      setPendingUsers(pending);
    } catch (error) {
      console.error('Refresh failed', error);
      toastError('Refresh failed', 'We could not refresh the live floor right now.');
    } finally {
      setStatusesLoading(false);
    }
  }

  async function loadSettingsData() {
    setManagementLoading(true);
    try {
      const [users, notifications] = await Promise.all([getAllUsers(), getAllNotifications()]);
      setAllUsers(users);
      setBroadcasts(notifications);
    } catch (error) {
      console.error('Failed to load settings data', error);
      toastError('Settings data failed to load', 'Some admin tools may be temporarily unavailable.');
    } finally {
      setManagementLoading(false);
    }
  }

  async function loadLeavesList() {
    try {
      const data = await getLeaves();
      setLeaves(data);
    } catch (error) {
      console.error('Failed to load leaves', error);
      toastError('Unable to load leave records', 'Please try again in a moment.');
    }
  }

  async function loadReports(nextRange: ReportRange) {
    setReportsLoading(true);

    try {
      const [users, liveRecords] = await Promise.all([getAllUsers(), getAllUsersStatus()]);
      const dates = getDatesForRange(nextRange, user.timezone);
      const logMap = await getLogsBatch(
        users.map((member) => member.id),
        dates,
      );
      const liveStatusMap = new Map(liveRecords.map((record) => [record.user.id, normalizeStatus(record.status)]));

      const nextRows = users
        .map<ReportRow>((member) => {
          let workedTotal = 0;
          let breakTotal = 0;
          let brbTotal = 0;
          let activeDays = 0;
          let firstPunch: number | undefined;
          let lastPunch: number | undefined;
          const violations = new Set<string>();

          for (const date of dates) {
            const dayLogs = logMap[`${member.id}-${date}`] ?? [];
            if (!dayLogs.length) continue;

            activeDays += 1;
            const session = computeSession(dayLogs);
            const fallbackEnd = dayLogs[dayLogs.length - 1]?.timestamp ?? Date.now();
            const sessionEnd = session.punchOut ?? fallbackEnd;
            const dayBreakMs = computeTotalTime(session.breaks, sessionEnd);
            const dayBrbMs = computeTotalTime(session.brbs, sessionEnd);
            const dayWorkedMs = computeWorkedTime(session, sessionEnd);
            const checks = checkViolations(
              dayBreakMs,
              dayBrbMs,
              session.punchIn,
              session.punchOut,
              member.shiftStart,
              member.shiftEnd,
              member.timezone,
            );

            workedTotal += dayWorkedMs;
            breakTotal += dayBreakMs;
            brbTotal += dayBrbMs;

            if (!firstPunch || (session.punchIn && session.punchIn < firstPunch)) firstPunch = session.punchIn;
            if (!lastPunch || sessionEnd > lastPunch) lastPunch = sessionEnd;

            if (checks.breakViol) violations.add('Break overrun');
            if (checks.brbViol) violations.add('BRB overrun');
            if (checks.lateIn) violations.add('Late arrival');
            if (checks.earlyOut) violations.add('Early logout');
          }

          return {
            user: member,
            liveStatus: liveStatusMap.get(member.id) ?? 'idle',
            workedMs: workedTotal,
            breakMs: breakTotal,
            brbMs: brbTotal,
            violationCount: violations.size,
            violationTags: Array.from(violations),
            activeDays,
            firstPunch,
            lastPunch,
          };
        })
        .sort((left, right) => right.violationCount - left.violationCount || right.workedMs - left.workedMs);

      setReportRows(nextRows);
    } catch (error) {
      console.error('Failed to load reports', error);
      toastError('Reports are unavailable', 'We could not build the selected report range.');
    } finally {
      setReportsLoading(false);
    }
  }

  async function handleApprove(target: User) {
    try {
      await approveUser(target.id);
      setPendingUsers((current) => current.filter((member) => member.id !== target.id));
      setAllUsers((current) => current.map((member) => (member.id === target.id ? { ...member, isApproved: true } : member)));
      success('Recruiter approved', `${target.name} can enter the workspace now.`);
      info('Live floor refreshes automatically', 'Their status card will appear after the next activity sync.');
    } catch (error) {
      console.error('Approval failed', error);
      toastError('Approval failed', 'Please retry once the connection is stable.');
    }
  }

  async function handleAddClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientDraft.trim()) return;

    try {
      const created = await addClient(clientDraft.trim());
      setClients((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
      setClientDraft('');
      success('Client added', `${created.name} is now available across the app.`);
    } catch (error) {
      console.error('Add client failed', error);
      toastError('Unable to add client', 'Please verify the connection and try again.');
    }
  }

  async function handleRenameClient(id: string, oldName: string) {
    const trimmed = clientEditName.trim();
    if (!trimmed || trimmed === oldName) {
      setClientEditId(null);
      return;
    }

    try {
      await renameClient(id, oldName, trimmed);
      setClients((current) => current.map((client) => (client.id === id ? { ...client, name: trimmed } : client)));
      setAllUsers((current) => current.map((member) => (member.clientName === oldName ? { ...member, clientName: trimmed } : member)));
      setLeaves((current) => current.map((entry) => (entry.client_name === oldName ? { ...entry, client_name: trimmed } : entry)));
      setClientEditId(null);
      success('Client renamed', `${oldName} is now ${trimmed}.`);
    } catch (error) {
      console.error('Rename client failed', error);
      toastError('Rename failed', 'The client name could not be synced across the system.');
    }
  }

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;

    try {
      const updated = await updateUser(editingUser.id, {
        name: editingUser.name.trim(),
        clientName: editingUser.clientName,
        isApproved: editingUser.isApproved,
        shiftStart: editingUser.shiftStart,
        shiftEnd: editingUser.shiftEnd,
        timezone: editingUser.timezone,
      });

      setAllUsers((current) => current.map((member) => (member.id === updated.id ? updated : member)));
      setPendingUsers((current) => (updated.isApproved ? current.filter((member) => member.id !== updated.id) : current));
      setEditingUser(null);
      success('Recruiter updated', `${updated.name}'s profile has been saved.`);
    } catch (error) {
      console.error('Update user failed', error);
      toastError('Unable to save recruiter', 'Please retry in a moment.');
    }
  }

  async function handleCreateLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leaveDraft.employeeName.trim() || !leaveDraft.clientName.trim() || !leaveDraft.date) return;

    try {
      const created = await addLeave({
        employee_name: leaveDraft.employeeName.trim(),
        client_name: leaveDraft.clientName.trim(),
        date: leaveDraft.date,
        approver: user.name,
        reason: leaveDraft.reason.trim() || null,
        leave_type: leaveDraft.leaveType,
        day_count: Number(leaveDraft.dayCount) || 1,
        is_planned: leaveDraft.isPlanned,
      });

      setLeaves((current) => [created, ...current].sort((left, right) => right.date.localeCompare(left.date)));
      setLeaveDraft((current) => ({ ...current, employeeName: '', reason: '', dayCount: '1' }));
      success('Leave added', `${created.employee_name} was added to the leave desk.`);
    } catch (error) {
      console.error('Create leave failed', error);
      toastError('Leave entry failed', 'We could not save this leave record.');
    }
  }

  async function handleSendBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!broadcastDraft.trim()) return;

    try {
      await createNotification(broadcastDraft.trim(), user.id);
      const next = await getAllNotifications();
      setBroadcasts(next);
      setBroadcastDraft('');
      success('Broadcast sent', 'Recruiter workspaces will receive it right away.');
    } catch (error) {
      console.error('Broadcast failed', error);
      toastError('Unable to send broadcast', 'Please try again once the connection settles.');
    }
  }

  async function handleConfirmAction() {
    if (!confirmState) return;

    try {
      switch (confirmState.kind) {
        case 'client':
          await deleteClient(confirmState.id);
          setClients((current) => current.filter((client) => client.id !== confirmState.id));
          success('Client removed', `${confirmState.name} has been deleted.`);
          break;
        case 'user':
          await deleteUser(confirmState.id);
          setAllUsers((current) => current.filter((member) => member.id !== confirmState.id));
          setPendingUsers((current) => current.filter((member) => member.id !== confirmState.id));
          success('Recruiter removed', `${confirmState.name} and their logs were deleted.`);
          break;
        case 'notification':
          await deleteNotification(confirmState.id);
          setBroadcasts((current) => current.filter((notification) => notification.id !== confirmState.id));
          success('Broadcast deleted', 'It was removed from the shared feed.');
          break;
        case 'leave':
          await deleteLeave(confirmState.id);
          setLeaves((current) => current.filter((entry) => entry.id !== confirmState.id));
          success('Leave removed', `${confirmState.name} was removed from the leave desk.`);
          break;
      }
    } catch (error) {
      console.error('Confirm action failed', error);
      toastError('Action failed', 'The change could not be completed.');
    } finally {
      setConfirmState(null);
    }
  }

  function handleExportReport() {
    if (!reportRows.length) return;

    const rows = [
      ['Recruiter', 'Client', 'Current status', 'Active days', 'Worked', 'Break', 'BRB', 'First punch', 'Last activity', 'Signals'],
      ...reportRows.map((row) => [
        row.user.name,
        row.user.clientName,
        STATUS_META[row.liveStatus].label,
        row.activeDays,
        formatDuration(row.workedMs),
        formatDuration(row.breakMs),
        formatDuration(row.brbMs),
        formatShortTime(row.firstPunch, row.user.timezone),
        formatShortTime(row.lastPunch, row.user.timezone),
        row.violationTags.join(' | ') || 'Clean',
      ]),
    ];

    exportCSV(rows, 'brigade-pulse-report');
  }

  const roster = statusRecords;
  const statusCounts = {
    total: roster.length,
    working: roster.filter((record) => normalizeStatus(record.status) === 'working').length,
    on_break: roster.filter((record) => normalizeStatus(record.status) === 'on_break').length,
    on_brb: roster.filter((record) => normalizeStatus(record.status) === 'on_brb').length,
    idle: roster.filter((record) => normalizeStatus(record.status) === 'idle').length,
    punched_out: roster.filter((record) => normalizeStatus(record.status) === 'punched_out').length,
  };

  const dashboardClientOptions = [
    { label: 'All clients', value: 'all' },
    ...Array.from(new Set(statusRecords.map((record) => record.user.clientName)))
      .sort((left, right) => left.localeCompare(right))
      .map((name) => ({ label: name, value: name })),
  ];

  const filteredDashboardRoster = roster
    .filter((record) => (dashboardClientFilter === 'all' ? true : record.user.clientName === dashboardClientFilter))
    .filter((record) => {
      if (!dashboardSearch.trim()) return true;
      const query = dashboardSearch.toLowerCase();
      return record.user.name.toLowerCase().includes(query) || record.user.clientName.toLowerCase().includes(query);
    })
    .sort((left, right) => {
      const order: Record<LiveStatus, number> = { working: 0, on_break: 1, on_brb: 2, idle: 3, punched_out: 4 };
      return order[normalizeStatus(left.status)] - order[normalizeStatus(right.status)] || right.workedMs - left.workedMs;
    });

  const filteredReportRows = reportRows.filter((row) => {
    if (!reportSearch.trim()) return true;
    const query = reportSearch.toLowerCase();
    return row.user.name.toLowerCase().includes(query) || row.user.clientName.toLowerCase().includes(query) || row.violationTags.some((tag) => tag.toLowerCase().includes(query));
  });

  const filteredSettingsUsers = allUsers.filter((member) => {
    if (!settingsSearch.trim()) return true;
    const query = settingsSearch.toLowerCase();
    return member.name.toLowerCase().includes(query) || member.clientName.toLowerCase().includes(query);
  });

  const clientBreakdown = Array.from(
    roster.reduce((map, record) => {
      map.set(record.user.clientName, (map.get(record.user.clientName) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  const reportActivityCount = reportRows.filter((row) => row.activeDays > 0).length;
  const reportViolationCount = reportRows.reduce((sum, row) => sum + row.violationCount, 0);
  const reportWorkedTotal = reportRows.reduce((sum, row) => sum + row.workedMs, 0);
  const reportCleanCount = reportRows.filter((row) => row.activeDays > 0 && row.violationCount === 0).length;
  const liveVisibleCount = statusCounts.working + statusCounts.on_break + statusCounts.on_brb;
  const liveCoverage = statusCounts.total ? Math.round((liveVisibleCount / statusCounts.total) * 100) : 0;
  const executionRate = statusCounts.total ? Math.round(((statusCounts.working + statusCounts.punched_out) / statusCounts.total) * 100) : 0;
  const focusAlerts = pendingUsers.length + statusCounts.on_break + statusCounts.on_brb;
  const activeClientCount = clientBreakdown.length;
  const topClient = clientBreakdown[0];
  const topClientShare = statusCounts.total ? Math.round(((topClient?.[1] ?? 0) / statusCounts.total) * 100) : 0;
  const statusSegments = (['working', 'on_break', 'on_brb', 'idle', 'punched_out'] as LiveStatus[]).map((status) => ({
    status,
    count: statusCounts[status],
    ratio: statusCounts.total ? Math.round((statusCounts[status] / statusCounts.total) * 100) : 0,
  }));
  const dashboardHighlights = [
    {
      label: 'Live coverage',
      value: `${liveCoverage}%`,
      detail: `${liveVisibleCount} recruiters visible right now`,
      accent: 'text-white',
      tone: 'cyan' as const,
    },
    {
      label: 'Execution rate',
      value: `${executionRate}%`,
      detail: 'Working or wrapped without open ambiguity',
      accent: 'text-emerald-200',
      tone: 'emerald' as const,
    },
    {
      label: 'Focus alerts',
      value: String(focusAlerts),
      detail: `${pendingUsers.length} approvals plus live away states`,
      accent: 'text-[#f4c27a]',
      tone: 'amber' as const,
    },
    {
      label: 'Active clients',
      value: String(activeClientCount),
      detail: topClient ? `${topClient[0]} leads the floor at ${topClientShare}%` : 'Client mix appears once recruiter activity starts',
      accent: 'text-sky-200',
      tone: 'violet' as const,
    },
  ];

  if (view === 'dashboard') {
    return (
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.42fr)_minmax(21rem,0.78fr)]">
        <div className="space-y-6">
          <Surface className="space-y-6 bg-[radial-gradient(circle_at_top_left,rgba(255,190,105,0.08),transparent_18%),radial-gradient(circle_at_top_right,rgba(86,214,255,0.1),transparent_24%)]">
            <SectionHeading
              kicker="Operations board"
              title="A vivid live roster built to feel like a flagship command board."
              body="The floor now leans into color, contrast, and faster hierarchy so it feels premium at first glance and readable under pressure."
              action={
                <button
                  type="button"
                  onClick={() => void refreshPresence()}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-sm font-semibold text-sky-100 transition-all hover:border-sky-200/28 hover:bg-sky-300/14"
                >
                  <RefreshCcw size={15} />
                  Refresh live floor
                </button>
              }
            />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {dashboardHighlights.map((item) => (
                <DashboardOverviewCard key={item.label} label={item.label} value={item.value} detail={item.detail} accent={item.accent} tone={item.tone} />
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
              <label className="competition-field relative flex items-center gap-3 rounded-[1.3rem] border border-white/10 px-4 py-3">
                <Search size={16} className="text-slate-500" />
                <input
                  value={dashboardSearch}
                  onChange={(event) => setDashboardSearch(event.target.value)}
                  placeholder="Search recruiter or client"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <select
                value={dashboardClientFilter}
                onChange={(event) => setDashboardClientFilter(event.target.value)}
                className="competition-field rounded-[1.3rem] border border-white/10 px-4 py-3 text-sm text-white outline-none"
              >
                {dashboardClientOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#0d131c]">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-hidden rounded-[1.9rem] border border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(86,214,255,0.14),transparent_22%),linear-gradient(180deg,rgba(7,12,20,0.8),rgba(255,255,255,0.02))]">
              <div className="flex flex-col gap-4 border-b border-white/8 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f4c27a]">Live roster</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {filteredDashboardRoster.length} visible recruiter{filteredDashboardRoster.length === 1 ? '' : 's'} after filters.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusSegments.map((segment) => (
                    <div key={segment.status} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-1.5">
                      <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_META[segment.status].dot)} />
                      <span className="text-xs font-medium text-slate-300">{STATUS_META[segment.status].label}</span>
                      <span className="mono-numeric text-xs font-semibold text-white">{segment.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {statusesLoading ? (
                <div className="space-y-3 p-3 sm:p-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-[10.5rem] animate-pulse rounded-[1.7rem] bg-white/[0.04]" />
                  ))}
                </div>
              ) : filteredDashboardRoster.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No recruiters matched this filter." body="Try another recruiter name or switch the client filter back to the full floor." />
                </div>
              ) : (
                <div className="space-y-3 p-3 sm:p-4">
                  {filteredDashboardRoster.map((record) => (
                    <FloorRosterRow key={record.user.id} record={record} />
                  ))}
                </div>
              )}
            </div>
          </Surface>
        </div>

        <div className="space-y-6 2xl:sticky 2xl:top-4 2xl:self-start">
          <Surface className="space-y-5 bg-[radial-gradient(circle_at_top_right,rgba(104,150,255,0.16),transparent_28%),linear-gradient(180deg,rgba(12,18,33,0.96),rgba(8,12,19,0.96))]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f4c27a]">
                  <RadioTower size={14} />
                  Live pulse
                </p>
                <h3 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.04em] text-white">One glance, four answers.</h3>
              </div>
              <div className="rounded-full border border-emerald-400/18 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                {liveCoverage}% coverage
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(106,208,255,0.14),transparent_24%),linear-gradient(180deg,rgba(9,15,24,0.84),rgba(7,12,18,0.94))] p-4">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Floor balance</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{statusCounts.total}</p>
                  <p className="mt-1 text-sm text-slate-400">Approved recruiters across the current floor.</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Busiest client</p>
                  <p className="mt-1 text-sm font-semibold text-white">{topClient?.[0] ?? 'Waiting for activity'}</p>
                </div>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/6">
                <div className="flex h-full">
                  {statusSegments.map((segment) => (
                    <div key={segment.status} className={cn('h-full', STATUS_META[segment.status].dot)} style={{ width: `${segment.ratio}%` }} />
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {statusSegments.map((segment) => (
                  <StatusBalanceRow key={segment.status} status={segment.status} count={segment.count} ratio={segment.ratio} />
                ))}
              </div>
            </div>
          </Surface>

          <Surface className="space-y-5 bg-[radial-gradient(circle_at_top_left,rgba(255,186,104,0.16),transparent_24%),linear-gradient(180deg,rgba(26,18,18,0.94),rgba(11,12,17,0.96))]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f4c27a]">Approval queue</p>
                <h3 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.04em] text-white">New recruiters waiting for access.</h3>
              </div>
              <div className="mono-numeric rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200">
                {pendingUsers.length}
              </div>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/12 px-5 py-6">
                <p className="text-sm font-semibold text-white">Nothing is waiting.</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">All recruiter profiles are already approved right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((candidate) => (
                  <div key={candidate.id} className="rounded-[1.45rem] border border-[#f4c27a]/12 bg-[linear-gradient(135deg,rgba(244,194,122,0.1),rgba(255,255,255,0.02))] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-white">{candidate.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{candidate.clientName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleApprove(candidate)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 transition-all hover:border-emerald-300/30 hover:bg-emerald-400/14"
                      >
                        <Check size={13} />
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface className="space-y-5 bg-[radial-gradient(circle_at_top_right,rgba(86,214,255,0.14),transparent_24%),linear-gradient(180deg,rgba(8,16,27,0.96),rgba(10,12,18,0.96))]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f4c27a]">Client radar</p>
              <h3 className="mt-2 text-[1.35rem] font-semibold tracking-[-0.04em] text-white">Where the floor is busiest.</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">High-volume clients surface first so you can spot concentration quickly.</p>
            </div>

            <div className="space-y-3">
              {clientBreakdown.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/12 px-5 py-6">
                  <p className="text-sm font-semibold text-white">No client activity yet.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Recruiter activity will populate once approved members start logging time.</p>
                </div>
              ) : (
                clientBreakdown.map(([clientName, count]) => (
                  <div key={clientName} className="rounded-[1.35rem] border border-sky-300/10 bg-[linear-gradient(135deg,rgba(84,208,255,0.1),rgba(255,255,255,0.02))] p-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{clientName}</p>
                        <p className="mt-1 text-xs text-slate-500">{roster.length ? Math.round((count / roster.length) * 100) : 0}% of active floor</p>
                      </div>
                      <span className="mono-numeric text-sm font-semibold text-slate-200">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/6">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#f4c27a] via-[#ffd6a0] to-[#5dd7ff]"
                        style={{ width: roster.length ? `${(count / roster.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Surface>
        </div>
      </div>
    );
  }

  if (view === 'reports') {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Logged recruiters" value={String(reportActivityCount)} detail={`${reportRows.length} total in this range`} accent="text-white" />
          <MetricTile label="Worked time" value={formatDuration(reportWorkedTotal)} detail="Combined across the selected range" accent="text-emerald-200" />
          <MetricTile label="Signals" value={String(reportViolationCount)} detail="Break, BRB, late, and early flags" accent="text-[#f4c27a]" />
          <MetricTile label="Clean records" value={String(reportCleanCount)} detail="Active recruiters with no violations" accent="text-sky-200" />
        </div>

        <Surface className="space-y-6">
          <SectionHeading
            kicker="Readable reports"
            title="Metrics that feel editorial, not spreadsheet-only."
            body="The old dense report table is replaced by a cleaner review surface with range controls, search, export, and clearer violation tags."
            action={
              <button type="button" onClick={handleExportReport} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                <Download size={15} className="mr-2 inline-block" />
                Export CSV
              </button>
            }
          />

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(REPORT_RANGE_LABELS) as ReportRange[]).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setReportRange(range)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-semibold transition-all',
                    reportRange === range
                      ? 'border-[#f4c27a]/24 bg-[#f4c27a]/10 text-[#f4c27a]'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/8',
                  )}
                >
                  {REPORT_RANGE_LABELS[range]}
                </button>
              ))}
            </div>

            <label className="competition-field relative flex items-center gap-3 rounded-[1.25rem] border border-white/10 px-4 py-3 xl:w-[22rem]">
              <Search size={16} className="text-slate-500" />
              <input
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                placeholder="Search recruiter, client, or signal"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
              />
            </label>
          </div>

          {reportsLoading ? (
            <div className="competition-panel h-[20rem] animate-pulse rounded-[1.8rem] bg-white/5" />
          ) : filteredReportRows.length === 0 ? (
            <EmptyState title="No report rows matched this range." body="Try a broader date range or clear the report search." />
          ) : (
            <div className="overflow-hidden rounded-[1.8rem] border border-white/8">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/8 text-left">
                  <thead className="bg-black/20">
                    <tr>
                      {['Recruiter', 'Current', 'Coverage', 'Worked', 'Break', 'BRB', 'First in', 'Last activity', 'Signals'].map((label) => (
                        <th key={label} className="px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {filteredReportRows.map((row) => (
                      <tr key={row.user.id} className="bg-white/[0.01] transition-colors hover:bg-white/[0.04]">
                        <td className="px-4 py-4 align-top">
                          <p className="text-sm font-semibold text-white">{row.user.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.user.clientName}</p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <StatusChip status={row.liveStatus} />
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-200">{row.activeDays} active day{row.activeDays === 1 ? '' : 's'}</td>
                        <td className="mono-numeric px-4 py-4 align-top text-sm font-semibold text-emerald-200">{formatDuration(row.workedMs)}</td>
                        <td className="mono-numeric px-4 py-4 align-top text-sm text-slate-200">{formatDuration(row.breakMs)}</td>
                        <td className="mono-numeric px-4 py-4 align-top text-sm text-slate-200">{formatDuration(row.brbMs)}</td>
                        <td className="px-4 py-4 align-top text-sm text-slate-200">{formatShortTime(row.firstPunch, row.user.timezone)}</td>
                        <td className="px-4 py-4 align-top text-sm text-slate-200">{formatShortTime(row.lastPunch, row.user.timezone)}</td>
                        <td className="px-4 py-4 align-top">
                          {row.violationTags.length === 0 ? (
                            <span className="inline-flex rounded-full border border-emerald-400/18 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Clean</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {row.violationTags.map((tag) => (
                                <span key={tag} className="inline-flex rounded-full border border-[#f4c27a]/18 bg-[#f4c27a]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#f4c27a]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Surface>
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={!!confirmState}
        title={
          confirmState?.kind === 'client'
            ? `Delete ${confirmState.name}?`
            : confirmState?.kind === 'user'
              ? `Delete ${confirmState.name}?`
              : confirmState?.kind === 'notification'
                ? 'Delete this broadcast?'
                : confirmState?.kind === 'leave'
                  ? `Delete ${confirmState.name}'s leave?`
                  : ''
        }
        message={
          confirmState?.kind === 'client'
            ? 'This removes the client from the active list. Recruiter records linked to it will need manual review.'
            : confirmState?.kind === 'user'
              ? 'This permanently removes the recruiter profile and all of its time logs.'
              : confirmState?.kind === 'notification'
                ? 'This removes the broadcast from every recruiter workspace.'
                : confirmState?.kind === 'leave'
                  ? 'This removes the leave entry from the leave board.'
                  : ''
        }
        confirmLabel="Delete"
        onConfirm={() => {
          void handleConfirmAction();
        }}
        onCancel={() => setConfirmState(null)}
      />

      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) setEditingUser(null);
            }}
          >
            <motion.form
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              onSubmit={handleSaveUser}
              className="competition-shell w-full max-w-xl space-y-5 rounded-[2rem] p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#f4c27a]">Edit recruiter</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{editingUser.name}</h3>
                </div>
                <button type="button" onClick={() => setEditingUser(null)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                  Close
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Full name</span>
                  <input value={editingUser.name} onChange={(event) => setEditingUser((current) => (current ? { ...current, name: event.target.value } : current))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Client</span>
                  <select value={editingUser.clientName} onChange={(event) => setEditingUser((current) => (current ? { ...current, clientName: event.target.value } : current))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none">
                    {clients.map((client) => (
                      <option key={client.id} value={client.name} className="bg-[#0d131c]">
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Shift start</span>
                  <input type="time" value={editingUser.shiftStart} onChange={(event) => setEditingUser((current) => (current ? { ...current, shiftStart: event.target.value } : current))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Shift end</span>
                  <input type="time" value={editingUser.shiftEnd} onChange={(event) => setEditingUser((current) => (current ? { ...current, shiftEnd: event.target.value } : current))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Timezone</span>
                  <select value={editingUser.timezone} onChange={(event) => setEditingUser((current) => (current ? { ...current, timezone: event.target.value } : current))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none">
                    {TIMEZONE_OPTIONS.map((timezone) => (
                      <option key={timezone} value={timezone} className="bg-[#0d131c]">
                        {timezone}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="inline-flex items-center gap-3 text-sm text-slate-200">
                <input type="checkbox" checked={editingUser.isApproved} onChange={(event) => setEditingUser((current) => (current ? { ...current, isApproved: event.target.checked } : current))} className="h-4 w-4 rounded border-white/20 bg-transparent accent-[#f4c27a]" />
                Mark this recruiter as approved and active
              </label>

              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setEditingUser(null)} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
                  Cancel
                </button>
                <button type="submit" className="rounded-full border border-[#f4c27a]/24 bg-[#f4c27a]/10 px-5 py-3 text-sm font-semibold text-[#f4c27a]">
                  Save recruiter
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'leave' && (
        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-6">
            <Surface className="space-y-6">
              <SectionHeading kicker="Create leave" title="Record absences without the old clunky modal flow." body="Planned and unplanned leave entries can be added from one calm form and reviewed immediately." />
              <form onSubmit={handleCreateLeave} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Employee name</span>
                  <input value={leaveDraft.employeeName} onChange={(event) => setLeaveDraft((current) => ({ ...current, employeeName: event.target.value }))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" placeholder="Enter recruiter name" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Client</span>
                    <select value={leaveDraft.clientName} onChange={(event) => setLeaveDraft((current) => ({ ...current, clientName: event.target.value }))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none">
                      {clients.map((client) => (
                        <option key={client.id} value={client.name} className="bg-[#0d131c]">
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Date</span>
                    <input type="date" value={leaveDraft.date} onChange={(event) => setLeaveDraft((current) => ({ ...current, date: event.target.value }))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Leave type</span>
                    <input value={leaveDraft.leaveType} onChange={(event) => setLeaveDraft((current) => ({ ...current, leaveType: event.target.value }))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Day count</span>
                    <input value={leaveDraft.dayCount} onChange={(event) => setLeaveDraft((current) => ({ ...current, dayCount: event.target.value }))} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Reason</span>
                  <textarea value={leaveDraft.reason} onChange={(event) => setLeaveDraft((current) => ({ ...current, reason: event.target.value }))} className="competition-field min-h-[7rem] w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" placeholder="Optional leave note" />
                </label>
                <label className="inline-flex items-center gap-3 text-sm text-slate-200">
                  <input type="checkbox" checked={leaveDraft.isPlanned} onChange={(event) => setLeaveDraft((current) => ({ ...current, isPlanned: event.target.checked }))} className="h-4 w-4 rounded border-white/20 bg-transparent accent-[#f4c27a]" />
                  Mark this as planned leave
                </label>
                <button type="submit" className="rounded-full border border-[#f4c27a]/24 bg-[#f4c27a]/10 px-5 py-3 text-sm font-semibold text-[#f4c27a]">
                  <Plus size={14} className="mr-2 inline-block" />
                  Add leave
                </button>
              </form>
            </Surface>

            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
              <MetricTile label="Planned" value={String(leaves.filter((entry) => entry.is_planned).length)} detail="Scheduled absences" accent="text-sky-200" />
              <MetricTile label="Unplanned" value={String(leaves.filter((entry) => !entry.is_planned).length)} detail="Unexpected absences" accent="text-[#f4c27a]" />
              <MetricTile label="Impacted clients" value={String(new Set(leaves.map((entry) => entry.client_name)).size)} detail="Unique client groups" accent="text-white" />
            </div>
          </div>

          <Surface className="space-y-6">
            <SectionHeading kicker="Leave board" title="A cleaner history of planned and unplanned time away." body="Each card shows who is away, for which client, and the note behind the entry." />
            {leaves.length === 0 ? (
              <EmptyState title="No leave entries yet." body="The leave board will populate as soon as planned or unplanned absences are recorded." />
            ) : (
              <div className="space-y-4">
                {leaves.map((entry) => (
                  <article key={entry.id} className="competition-panel rounded-[1.6rem] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-white">{entry.employee_name}</p>
                          <span className={cn('inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]', entry.is_planned ? 'border-sky-400/18 bg-sky-400/10 text-sky-200' : 'border-[#f4c27a]/18 bg-[#f4c27a]/10 text-[#f4c27a]')}>
                            {entry.is_planned ? 'Planned' : 'Unplanned'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">{entry.client_name}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">{entry.leave_type}</span>
                          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">{entry.day_count} day{entry.day_count === 1 ? '' : 's'}</span>
                          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">{formatReadableDate(entry.date)}</span>
                        </div>
                        {entry.reason && <p className="text-sm leading-7 text-slate-300">{entry.reason}</p>}
                      </div>
                      <button type="button" onClick={() => setConfirmState({ kind: 'leave', id: entry.id, name: entry.employee_name })} className="rounded-full border border-rose-400/18 bg-rose-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">
                        <Trash2 size={14} className="mr-2 inline-block" />
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Surface>
        </div>
      )}

      {view === 'settings' && (
        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-6">
            <Surface className="space-y-5">
              <SectionHeading kicker="Clients" title="Manage your client list from a cleaner control panel." body="Create, rename, and remove client names without dropping into the older UI." />
              <form onSubmit={handleAddClient} className="flex gap-3">
                <input value={clientDraft} onChange={(event) => setClientDraft(event.target.value)} className="competition-field w-full rounded-[1.25rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" placeholder="Add a new client" />
                <button type="submit" className="rounded-full border border-[#f4c27a]/24 bg-[#f4c27a]/10 px-5 py-3 text-sm font-semibold text-[#f4c27a]">
                  <Plus size={14} className="mr-2 inline-block" />
                  Add
                </button>
              </form>
              <div className="space-y-3">
                {clients.length === 0 ? (
                  <EmptyState title="No clients available." body="Add a client to make it selectable throughout the app." />
                ) : (
                  clients.map((client) => (
                    <div key={client.id} className="competition-panel rounded-[1.4rem] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {clientEditId === client.id ? (
                            <input value={clientEditName} onChange={(event) => setClientEditName(event.target.value)} className="competition-field w-full rounded-[1rem] border border-white/10 px-3 py-2 text-sm text-white outline-none" autoFocus />
                          ) : (
                            <p className="truncate text-sm font-semibold text-white">{client.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {clientEditId === client.id ? (
                            <button type="button" onClick={() => void handleRenameClient(client.id, client.name)} className="rounded-full border border-emerald-400/18 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                              <Check size={14} className="mr-1 inline-block" />
                              Save
                            </button>
                          ) : (
                            <button type="button" onClick={() => { setClientEditId(client.id); setClientEditName(client.name); }} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                              <Pencil size={14} className="mr-1 inline-block" />
                              Rename
                            </button>
                          )}
                          <button type="button" onClick={() => setConfirmState({ kind: 'client', id: client.id, name: client.name })} className="rounded-full border border-rose-400/18 bg-rose-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
                            <Trash2 size={14} className="mr-1 inline-block" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Surface>

            <Surface className="space-y-5">
              <SectionHeading kicker="Broadcast desk" title="Send a polished system-wide message." body="Messages land in recruiter workspaces instantly and can be acknowledged without disrupting the shift." />
              <form onSubmit={handleSendBroadcast} className="space-y-4">
                <textarea value={broadcastDraft} onChange={(event) => setBroadcastDraft(event.target.value)} className="competition-field min-h-[8rem] w-full rounded-[1.3rem] border border-white/10 px-4 py-3 text-sm text-white outline-none" maxLength={300} placeholder="Write a broadcast to every active recruiter workspace" />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{broadcastDraft.length}/300</span>
                  <button type="submit" className="rounded-full border border-[#f4c27a]/24 bg-[#f4c27a]/10 px-5 py-3 text-sm font-semibold text-[#f4c27a]">
                    <RadioTower size={15} className="mr-2 inline-block" />
                    Send broadcast
                  </button>
                </div>
              </form>
              {broadcasts.length > 0 && (
                <div className="space-y-3">
                  {broadcasts.slice(0, 5).map((notification) => (
                    <div key={notification.id} className="competition-panel rounded-[1.4rem] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm leading-7 text-slate-200">{notification.message}</p>
                          <p className="mt-2 text-xs text-slate-500">
                            {new Date(notification.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <button type="button" onClick={() => setConfirmState({ kind: 'notification', id: notification.id, name: 'this broadcast' })} className="rounded-full border border-rose-400/18 bg-rose-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
                          <Trash2 size={14} className="mr-1 inline-block" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>

          <Surface className="space-y-6">
            <SectionHeading kicker="Recruiters" title="Every profile now lives on a cleaner roster." body="Approve, edit, and remove recruiter accounts in a card layout that feels far more intentional than the old table." />
            <label className="competition-field relative flex items-center gap-3 rounded-[1.25rem] border border-white/10 px-4 py-3">
              <Search size={16} className="text-slate-500" />
              <input value={settingsSearch} onChange={(event) => setSettingsSearch(event.target.value)} placeholder="Search recruiter or client" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
            </label>
            {managementLoading ? (
              <div className="competition-panel h-[18rem] animate-pulse rounded-[1.8rem] bg-white/5" />
            ) : filteredSettingsUsers.length === 0 ? (
              <EmptyState title="No recruiters matched this search." body="Try a different recruiter name or clear the filter." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredSettingsUsers.map((member) => (
                  <article key={member.id} className="competition-panel rounded-[1.5rem] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-white">{member.name}</p>
                        <p className="text-sm text-slate-500">{member.clientName}</p>
                      </div>
                      <span className={cn('inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]', member.isApproved ? 'border-emerald-400/18 bg-emerald-400/10 text-emerald-200' : 'border-[#f4c27a]/18 bg-[#f4c27a]/10 text-[#f4c27a]')}>
                        {member.isApproved ? 'Active' : 'Pending'}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.15rem] border border-white/8 bg-black/15 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Shift</p>
                        <p className="mt-2 text-sm font-semibold text-white">{member.shiftStart} to {member.shiftEnd}</p>
                      </div>
                      <div className="rounded-[1.15rem] border border-white/8 bg-black/15 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Timezone</p>
                        <p className="mt-2 text-sm font-semibold text-white">{member.timezone}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {!member.isApproved && (
                        <button type="button" onClick={() => void handleApprove(member)} className="rounded-full border border-emerald-400/18 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                          <Check size={14} className="mr-1 inline-block" />
                          Approve
                        </button>
                      )}
                      <button type="button" onClick={() => setEditingUser({ id: member.id, name: member.name, clientName: member.clientName, isApproved: member.isApproved, shiftStart: member.shiftStart, shiftEnd: member.shiftEnd, timezone: member.timezone })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                        <Pencil size={14} className="mr-1 inline-block" />
                        Edit
                      </button>
                      <button type="button" onClick={() => setConfirmState({ kind: 'user', id: member.id, name: member.name })} className="rounded-full border border-rose-400/18 bg-rose-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
                        <Trash2 size={14} className="mr-1 inline-block" />
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Surface>
        </div>
      )}
    </>
  );
}

function DashboardOverviewCard({
  label,
  value,
  detail,
  accent,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  tone: 'amber' | 'cyan' | 'emerald' | 'violet';
}) {
  return (
    <div
      className={cn(
        'flagship-card rounded-[1.55rem] border px-4 py-4',
        tone === 'amber'
          ? 'flagship-card--amber'
          : tone === 'emerald'
            ? 'flagship-card--emerald'
            : tone === 'violet'
              ? 'flagship-card--violet'
              : 'flagship-card--cyan',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">{label}</p>
      <p className={cn('mono-numeric mt-2 text-[1.9rem] font-semibold', accent)}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-white/70">{detail}</p>
    </div>
  );
}

function FloorRosterRow({ record }: { record: UserStatusRecord }) {
  const liveStatus = normalizeStatus(record.status);
  const meta = STATUS_META[liveStatus];
  const lastTouch = record.punchOut ?? record.breakStart ?? record.brbStart ?? record.workStart ?? record.punchIn;
  const shiftMinutesRaw = parseShiftMins(record.user.shiftEnd) - parseShiftMins(record.user.shiftStart);
  const shiftMinutes = shiftMinutesRaw > 0 ? shiftMinutesRaw : shiftMinutesRaw + 24 * 60;
  const shiftWindowMs = Math.max(1, shiftMinutes) * 60000;
  const shiftProgress = Math.max(0, Math.min(100, Math.round((record.workedMs / shiftWindowMs) * 100)));
  const rowTone =
    liveStatus === 'working'
      ? {
          shell: 'border-emerald-300/16 bg-[radial-gradient(circle_at_top_right,rgba(74,222,128,0.16),transparent_24%),linear-gradient(180deg,rgba(9,18,20,0.92),rgba(255,255,255,0.02))]',
          stripe: 'before:bg-gradient-to-b before:from-emerald-300 before:to-transparent',
          avatar: 'border-emerald-300/20 bg-[linear-gradient(135deg,rgba(74,222,128,0.28),rgba(10,19,18,0.9))]',
          panel: 'border-emerald-300/14 bg-[linear-gradient(180deg,rgba(13,33,27,0.88),rgba(10,18,16,0.94))]',
        }
      : liveStatus === 'on_break'
        ? {
            shell: 'border-[#f4c27a]/16 bg-[radial-gradient(circle_at_top_right,rgba(244,194,122,0.16),transparent_24%),linear-gradient(180deg,rgba(20,15,10,0.92),rgba(255,255,255,0.02))]',
            stripe: 'before:bg-gradient-to-b before:from-[#f4c27a] before:to-transparent',
            avatar: 'border-[#f4c27a]/20 bg-[linear-gradient(135deg,rgba(244,194,122,0.28),rgba(28,20,14,0.9))]',
            panel: 'border-[#f4c27a]/14 bg-[linear-gradient(180deg,rgba(33,24,16,0.88),rgba(18,14,11,0.94))]',
          }
        : liveStatus === 'on_brb'
          ? {
              shell: 'border-sky-300/16 bg-[radial-gradient(circle_at_top_right,rgba(86,214,255,0.16),transparent_24%),linear-gradient(180deg,rgba(10,16,22,0.92),rgba(255,255,255,0.02))]',
              stripe: 'before:bg-gradient-to-b before:from-sky-300 before:to-transparent',
              avatar: 'border-sky-300/20 bg-[linear-gradient(135deg,rgba(86,214,255,0.28),rgba(10,19,28,0.9))]',
              panel: 'border-sky-300/14 bg-[linear-gradient(180deg,rgba(12,24,34,0.88),rgba(9,15,22,0.94))]',
            }
          : liveStatus === 'punched_out'
            ? {
                shell: 'border-rose-300/14 bg-[radial-gradient(circle_at_top_right,rgba(251,113,133,0.14),transparent_24%),linear-gradient(180deg,rgba(21,12,16,0.92),rgba(255,255,255,0.02))]',
                stripe: 'before:bg-gradient-to-b before:from-rose-300 before:to-transparent',
                avatar: 'border-rose-300/18 bg-[linear-gradient(135deg,rgba(251,113,133,0.24),rgba(24,14,18,0.9))]',
                panel: 'border-rose-300/12 bg-[linear-gradient(180deg,rgba(31,16,21,0.88),rgba(15,11,14,0.94))]',
              }
            : {
                shell: 'border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,rgba(13,16,21,0.92),rgba(255,255,255,0.02))]',
                stripe: 'before:bg-gradient-to-b before:from-slate-300 before:to-transparent',
                avatar: 'border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(18,20,25,0.92))]',
                panel: 'border-white/10 bg-[linear-gradient(180deg,rgba(19,21,28,0.9),rgba(11,13,18,0.94))]',
              };

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-[1.55rem] border px-4 py-4 pl-5 transition-all before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1.5 before:content-[""] hover:-translate-y-[1px] hover:border-white/20',
        rowTone.shell,
        rowTone.stripe,
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(15rem,0.72fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] border text-sm font-semibold text-white shadow-[0_14px_26px_rgba(0,0,0,0.18)]', rowTone.avatar)}>
              {getInitials(record.user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="truncate text-base font-semibold text-white">{record.user.name}</p>
                <StatusChip status={record.status} />
                <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-xs font-medium text-slate-200">
                  {record.user.clientName}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                <span>{record.user.shiftStart} - {record.user.shiftEnd}</span>
                <span>{record.breakCount} break{record.breakCount === 1 ? '' : 's'} / {record.brbCount} BRB</span>
                <span>{shiftProgress}% of shift goal tracked</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.15rem] border border-white/10 bg-black/18 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Started</p>
              <p className="mono-numeric mt-2 text-sm font-semibold text-white">{formatShortTime(record.punchIn, record.user.timezone)}</p>
            </div>
            <div className="rounded-[1.15rem] border border-white/10 bg-black/18 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Worked</p>
              <p className={cn('mono-numeric mt-2 text-sm font-semibold', meta.valueTone)}>{formatDuration(record.workedMs)}</p>
            </div>
            <div className="rounded-[1.15rem] border border-white/10 bg-black/18 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Last signal</p>
              <p className="mono-numeric mt-2 text-sm font-semibold text-white">{formatShortTime(lastTouch, record.user.timezone)}</p>
            </div>
          </div>
        </div>

        <div className={cn('rounded-[1.35rem] border p-4', rowTone.panel)}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Shift progress</p>
              <p className="mt-2 text-sm font-semibold text-white">{STATUS_META[liveStatus].label} right now</p>
            </div>
            <span className={cn('mono-numeric text-sm font-semibold', meta.valueTone)}>{shiftProgress}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/6">
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r',
                liveStatus === 'working'
                  ? 'from-emerald-300 to-emerald-500'
                  : liveStatus === 'on_break'
                    ? 'from-amber-200 to-amber-400'
                    : liveStatus === 'on_brb'
                      ? 'from-sky-200 to-sky-400'
                      : liveStatus === 'punched_out'
                        ? 'from-rose-200 to-rose-400'
                        : 'from-slate-300 to-slate-500',
              )}
              style={{ width: `${shiftProgress}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>Shift opens {record.user.shiftStart}</span>
            <span>Latest {formatShortTime(lastTouch, record.user.timezone)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusBalanceRow({
  status,
  count,
  ratio,
}: {
  status: LiveStatus;
  count: number;
  ratio: number;
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_META[status].dot)} />
          <span className="text-sm font-medium text-slate-200">{STATUS_META[status].label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono-numeric text-xs font-semibold text-slate-500">{ratio}%</span>
          <span className="mono-numeric text-sm font-semibold text-white">{count}</span>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/6">
        <div className={cn('h-full rounded-full', STATUS_META[status].dot)} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}
