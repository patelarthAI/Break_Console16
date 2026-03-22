'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  Coffee,
  LogIn,
  LogOut,
  Search,
} from 'lucide-react';
import { AppNotification, AppStatus, TimeLog, User } from '@/types';
import { dismissNotification, getActiveNotifications, getAllUsersStatus, getLeaves } from '@/lib/store';
import { parseShiftMins, formatDuration } from '@/lib/timeUtils';
import { supabase } from '@/lib/supabase';
import {
  ActionTile,
  EmptyState,
  MetricTile,
  PresenceCard,
  SectionHeading,
  Surface,
  StatusChip,
  formatReadableDate,
  formatShortTime,
  normalizeStatus,
} from '@/components/reimagined/workspaceShared';

type LiveStatus = Exclude<AppStatus, 'on_leave'>;
type RecruiterView = 'shift' | 'team';

interface Props {
  user: User;
  view: RecruiterView;
  logs: TimeLog[];
  logsLoading: boolean;
  status: LiveStatus;
  workedMs: number;
  breakMs: number;
  brbMs: number;
  onPunchIn: () => void;
  onPunchOut: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onBRBIn: () => void;
  onBRBOut: () => void;
}

export default function ReimaginedRecruiterExperience({
  user,
  view,
  logs,
  logsLoading,
  status,
  workedMs,
  breakMs,
  brbMs,
  onPunchIn,
  onPunchOut,
  onStartBreak,
  onEndBreak,
  onBRBIn,
  onBRBOut,
}: Props) {
  const [teamRecords, setTeamRecords] = useState<Awaited<ReturnType<typeof getAllUsersStatus>>>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamSearch, setTeamSearch] = useState('');
  const [activeNotifications, setActiveNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [leaves, setLeaves] = useState<Awaited<ReturnType<typeof getLeaves>>>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeam() {
      setTeamLoading(true);
      try {
        const records = await getAllUsersStatus();
        if (!cancelled) setTeamRecords(records.filter((record) => record.user.clientName === user.clientName));
      } finally {
        if (!cancelled) setTeamLoading(false);
      }
    }

    void loadTeam();
    const intervalId = window.setInterval(() => {
      void loadTeam();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user.clientName]);

  useEffect(() => {
    let cancelled = false;

    async function loadActive() {
      setNotificationsLoading(true);
      try {
        const data = await getActiveNotifications(user.id);
        if (!cancelled) setActiveNotifications(data);
      } finally {
        if (!cancelled) setNotificationsLoading(false);
      }
    }

    async function loadLeavesList() {
      const data = await getLeaves();
      if (!cancelled) setLeaves(data.filter((entry) => entry.client_name === user.clientName));
    }

    void loadActive();
    void loadLeavesList();

    const channel = supabase
      .channel(`workspace-notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        void loadActive();
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user.clientName, user.id]);

  async function handleDismissNotification(notificationId: string) {
    setActiveNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    try {
      await dismissNotification(notificationId, user.id);
    } catch (error) {
      console.error('Dismiss notification failed', error);
    }
  }

  const shiftGoalMs = Math.max(1, (parseShiftMins(user.shiftEnd) - parseShiftMins(user.shiftStart)) * 60000);
  const shiftProgress = Math.max(0, Math.min(100, Math.round((workedMs / shiftGoalMs) * 100)));
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: user.timezone,
  }).format(new Date());
  const liveClock = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: user.timezone,
  }).format(new Date());

  const teamStatusCounts = {
    working: teamRecords.filter((record) => normalizeStatus(record.status) === 'working').length,
    away: teamRecords.filter((record) => ['on_break', 'on_brb'].includes(normalizeStatus(record.status))).length,
    done: teamRecords.filter((record) => normalizeStatus(record.status) === 'punched_out').length,
    idle: teamRecords.filter((record) => normalizeStatus(record.status) === 'idle').length,
  };

  const filteredTeamRecords = teamRecords
    .filter((record) => record.user.name.toLowerCase().includes(teamSearch.toLowerCase()))
    .sort((left, right) => left.user.name.localeCompare(right.user.name));

  if (view === 'team') {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.14fr_0.86fr]">
        <Surface className="space-y-6">
          <SectionHeading
            kicker="Team pulse"
            title={`Everyone in ${user.clientName}, surfaced as live presence cards.`}
            body="Your team should feel visible, not buried. This view keeps the same data but presents it with clearer hierarchy and faster scanning."
            action={
              <label className="competition-field relative flex items-center gap-3 rounded-[1.25rem] border border-white/10 px-4 py-3 lg:w-[20rem]">
                <Search size={16} className="text-slate-500" />
                <input
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  placeholder="Search teammate"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </label>
            }
          />

          {teamLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="competition-panel h-[13rem] animate-pulse rounded-[1.7rem] bg-white/5" />
              ))}
            </div>
          ) : filteredTeamRecords.length === 0 ? (
            <EmptyState title="No teammate matched this search." body="Clear the filter to bring the full client team back into view." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTeamRecords.map((record) => (
                <PresenceCard key={record.user.id} record={record} />
              ))}
            </div>
          )}
        </Surface>

        <div className="space-y-6">
          <Surface className="space-y-5">
            <SectionHeading kicker="Presence mix" title="How your team looks right now." body="This summary keeps the current state visible even before you scan individual cards." />
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Working" value={String(teamStatusCounts.working)} detail="Actively on task" accent="text-emerald-200" />
              <MetricTile label="Away" value={String(teamStatusCounts.away)} detail="Break plus BRB" accent="text-[#f4c27a]" />
              <MetricTile label="Done" value={String(teamStatusCounts.done)} detail="Shift wrapped" accent="text-rose-200" />
              <MetricTile label="Idle" value={String(teamStatusCounts.idle)} detail="No active session" accent="text-white" />
            </div>
          </Surface>

          <Surface className="space-y-5">
            <SectionHeading kicker="Leave board" title="Upcoming or recent time away for your client team." body="Your team pulse now includes leave context without sending you into another cluttered screen." />
            {leaves.length === 0 ? (
              <EmptyState title="No leave entries for this client." body="Leave records for your client group will appear here when they are added by the control desk." />
            ) : (
              <div className="space-y-3">
                {leaves.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="competition-panel rounded-[1.4rem] p-4">
                    <p className="text-base font-semibold text-white">{entry.employee_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{entry.leave_type}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{entry.reason || 'No leave note provided.'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">{formatReadableDate(entry.date)}</span>
                      <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${entry.is_planned ? 'border-sky-400/18 bg-sky-400/10 text-sky-200' : 'border-[#f4c27a]/18 bg-[#f4c27a]/10 text-[#f4c27a]'}`}>
                        {entry.is_planned ? 'Planned' : 'Unplanned'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-6">
        <Surface className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(93,215,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,194,122,0.14),transparent_30%)]" />
          <div className="relative space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f4c27a]">Shift status</p>
                <h2 className="mt-3 text-[clamp(1.9rem,2.4vw,2.8rem)] font-semibold tracking-[-0.05em] text-white">Built to keep your day readable.</h2>
              </div>
              <StatusChip status={status} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="competition-panel rounded-[1.6rem] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Local time</p>
                <p className="mono-numeric mt-3 text-4xl font-semibold text-white">{liveClock}</p>
                <p className="mt-2 text-sm text-slate-400">{todayLabel}</p>
              </div>
              <div className="competition-panel rounded-[1.6rem] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Shift progress</p>
                <p className="mono-numeric mt-3 text-4xl font-semibold text-emerald-200">{shiftProgress}%</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#f4c27a] via-[#5dd7ff] to-emerald-300" style={{ width: `${shiftProgress}%` }} />
                </div>
                <p className="mt-2 text-sm text-slate-400">Goal window {user.shiftStart} to {user.shiftEnd}</p>
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="space-y-5">
          <SectionHeading kicker="Actions" title="Every shift action stays one tap away." body="No more cramped buttons. Each action is larger, clearer, and only lights up when it makes sense." />
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionTile label="Punch in" body="Start live time tracking." icon={<LogIn size={18} />} tone="gold" disabled={status !== 'idle' && status !== 'punched_out'} onClick={onPunchIn} />
            <ActionTile label="Punch out" body="Finish the session cleanly." icon={<LogOut size={18} />} tone="rose" disabled={status !== 'working'} onClick={onPunchOut} />
            <ActionTile label="Start break" body="Pause for a planned break." icon={<Coffee size={18} />} tone="amber" disabled={status !== 'working'} onClick={onStartBreak} />
            <ActionTile label="End break" body="Return from break." icon={<ArrowRight size={18} />} tone="emerald" disabled={status !== 'on_break'} onClick={onEndBreak} />
            <ActionTile label="Start BRB" body="Mark a quick away moment." icon={<CircleDot size={18} />} tone="sky" disabled={status !== 'working'} onClick={onBRBIn} />
            <ActionTile label="End BRB" body="Resume work instantly." icon={<CheckCircle2 size={18} />} tone="slate" disabled={status !== 'on_brb'} onClick={onBRBOut} />
          </div>
        </Surface>

        <Surface className="space-y-5">
          <SectionHeading kicker="Broadcasts" title="Messages from the control desk." body="Announcements now feel like a polished message rail instead of an afterthought." />
          {notificationsLoading ? (
            <div className="competition-panel h-[12rem] animate-pulse rounded-[1.6rem] bg-white/5" />
          ) : activeNotifications.length === 0 ? (
            <EmptyState title="No active broadcasts." body="When admins send an operations message, it will appear here for quick acknowledgment." />
          ) : (
            <div className="space-y-3">
              {activeNotifications.map((notification) => (
                <div key={notification.id} className="competition-panel rounded-[1.5rem] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm leading-7 text-slate-200">{notification.message}</p>
                      <p className="mt-2 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <button type="button" onClick={() => void handleDismissNotification(notification.id)} className="rounded-full border border-emerald-400/18 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      <Check size={14} className="mr-1 inline-block" />
                      Ack
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricTile label="Worked" value={formatDuration(workedMs)} detail="Live task time today" accent="text-emerald-200" />
          <MetricTile label="Break" value={formatDuration(breakMs)} detail="Combined pause duration" accent="text-[#f4c27a]" />
          <MetricTile label="BRB" value={formatDuration(brbMs)} detail="Quick away moments" accent="text-sky-200" />
        </div>

        <Surface className="space-y-6">
          <SectionHeading kicker="Timeline" title="A cleaner history of your day." body="Every shift event is mapped in order so you can verify the entire session in seconds." />
          {logsLoading ? (
            <div className="competition-panel h-[18rem] animate-pulse rounded-[1.8rem] bg-white/5" />
          ) : logs.length === 0 ? (
            <EmptyState title="No activity logged yet." body="Once you punch in, your day will begin filling this timeline automatically." />
          ) : (
            <div className="space-y-4">
              {logs.slice().reverse().map((log) => (
                <div key={log.id} className="competition-panel rounded-[1.5rem] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-black/18 text-[#f4c27a]">
                        <Activity size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold capitalize text-white">{log.eventType.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatReadableDate(log.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="mono-numeric text-sm font-semibold text-white">{formatShortTime(log.timestamp, user.timezone)}</p>
                      <p className="mt-1 text-xs text-slate-500">{user.timezone}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
