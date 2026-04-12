'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Command,
  LayoutDashboard,
  LogOut,
  RadioTower,
  Settings2,
  Users,
} from 'lucide-react';
import { AppStatus, TimeLog, User } from '@/types';
import { getAllUsersStatus, getPendingUsers } from '@/lib/store';
import ReimaginedAdminExperience from '@/components/ReimaginedAdminExperience.legacy';
import ReimaginedRecruiterExperience from '@/components/ReimaginedRecruiterExperience';
import { cn } from '@/lib/utils';
import { type AdminView, type RecruiterView, type WorkspaceView } from '@/components/reimagined/workspaceShared';

interface Props {
  user: User;
  logs: TimeLog[];
  logsLoading: boolean;
  status: Exclude<AppStatus, 'on_leave'>;
  workedMs: number;
  breakMs: number;
  brbMs: number;
  onLogout: () => void;
  onPunchIn: () => void;
  onPunchOut: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onBRBIn: () => void;
  onBRBOut: () => void;
}

const ADMIN_VIEWS: Array<{ id: AdminView; label: string; note: string; icon: ReactNode }> = [
  { id: 'dashboard', label: 'Live Floor', note: 'Realtime recruiter presence', icon: <LayoutDashboard size={16} /> },
  { id: 'reports', label: 'Reports', note: 'Readable performance records', icon: <BarChart3 size={16} /> },
  { id: 'leave', label: 'Leave Desk', note: 'Absence scheduling and review', icon: <CalendarDays size={16} /> },
  { id: 'settings', label: 'Settings', note: 'Clients, users, and broadcasts', icon: <Settings2 size={16} /> },
];

const RECRUITER_VIEWS: Array<{ id: RecruiterView; label: string; note: string; icon: ReactNode }> = [
  { id: 'shift', label: 'Shift Deck', note: 'Punch, pause, and review the day', icon: <Clock3 size={16} /> },
  { id: 'team', label: 'Team Pulse', note: 'See your client team at a glance', icon: <Users size={16} /> },
];

export default function ReimaginedWorkspace({
  user,
  logs,
  logsLoading,
  status,
  workedMs,
  breakMs,
  brbMs,
  onLogout,
  onPunchIn,
  onPunchOut,
  onStartBreak,
  onEndBreak,
  onBRBIn,
  onBRBOut,
}: Props) {
  const [view, setView] = useState<WorkspaceView>(user.isMaster ? 'dashboard' : 'shift');
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [summaryWorking, setSummaryWorking] = useState(0);
  const [summaryAway, setSummaryAway] = useState(0);
  const [summaryPending, setSummaryPending] = useState(0);

  useEffect(() => {
    if (!user.isMaster) return;

    let cancelled = false;

    async function loadSummary() {
      try {
        const [records, pending] = await Promise.all([getAllUsersStatus(), getPendingUsers()]);
        if (cancelled) return;

        setSummaryTotal(records.length);
        setSummaryWorking(records.filter((record) => record.status === 'working').length);
        setSummaryAway(records.filter((record) => record.status === 'on_break' || record.status === 'on_brb').length);
        setSummaryPending(pending.length);
      } catch (error) {
        console.error('Failed to load header summary', error);
      }
    }

    void loadSummary();
    const intervalId = window.setInterval(() => {
      void loadSummary();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user.isMaster]);

  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: user.timezone,
  }).format(new Date());

  const headerMetrics = user.isMaster
    ? [
        { label: 'Approved', value: String(summaryTotal), detail: 'Recruiters visible across the network', accent: 'text-white', tone: 'amber' as const },
        { label: 'Live now', value: String(summaryWorking), detail: `${summaryAway} currently away from desk`, accent: 'text-emerald-100', tone: 'emerald' as const },
        { label: 'Pending', value: String(summaryPending), detail: 'Profiles waiting for approval', accent: 'text-sky-100', tone: 'violet' as const },
      ]
    : [
        { label: 'Worked', value: formatDuration(workedMs), detail: 'Tracked live for today', accent: 'text-emerald-100', tone: 'emerald' as const },
        { label: 'Break', value: formatDuration(breakMs), detail: 'Combined pause duration', accent: 'text-white', tone: 'amber' as const },
        { label: 'BRB', value: formatDuration(brbMs), detail: 'Quick away moments', accent: 'text-sky-100', tone: 'cyan' as const },
      ];

  const workspaceTitle = user.isMaster ? 'Recruiter Operations Command' : 'Recruiter Shift Workspace';
  const workspaceBody = user.isMaster
    ? 'Live floor, approvals, reporting, and leave management brought together in one richer command surface.'
    : `Signed in as ${user.name} for ${user.clientName}. Your shift controls, team visibility, and updates now live in one focused workspace.`;
  const activeViews = user.isMaster ? ADMIN_VIEWS : RECRUITER_VIEWS;
  const workspaceSignals = user.isMaster
    ? [
        { label: 'Network span', value: `${summaryTotal} recruiters`, tone: 'amber' as const },
        { label: 'Live activity', value: `${summaryWorking} in motion`, tone: 'emerald' as const },
        { label: 'Control load', value: summaryPending ? `${summaryPending} approvals` : 'All clear', tone: 'cyan' as const },
      ]
    : [
        { label: 'Today', value: formatDuration(workedMs), tone: 'emerald' as const },
        { label: 'Break', value: formatDuration(breakMs), tone: 'amber' as const },
        { label: 'Focus', value: user.clientName, tone: 'cyan' as const },
      ];

  return (
    <section className="competition-stage relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="competition-grid pointer-events-none absolute inset-0 opacity-45" />
      <div className="pointer-events-none absolute left-[-8rem] top-[-6rem] h-[22rem] w-[22rem] rounded-full bg-[#5dd7ff]/12 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10rem] right-[-8rem] h-[26rem] w-[26rem] rounded-full bg-[#f4c27a]/12 blur-[140px]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex w-full max-w-[1660px] flex-col gap-6"
      >
        <header className="competition-shell relative overflow-hidden rounded-[2.1rem] px-5 py-5 sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(93,215,255,0.13),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(244,194,122,0.12),transparent_24%)]" />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f4c27a]">
                  <Command size={13} />
                  {user.isMaster ? 'Operations flagship' : 'Shift deck'}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/18 bg-sky-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200">
                  <RadioTower size={13} />
                  Live workspace
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-slate-300">
                  {todayLabel}
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:border-white/18 hover:bg-white/8"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
              <div className="flagship-card flagship-card--cyan relative rounded-[2rem] border p-6 sm:p-7">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,187,85,0.2),transparent_24%),radial-gradient(circle_at_100%_0%,rgba(95,211,255,0.22),transparent_30%)]" />
                <div className="relative space-y-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-[1.7rem] border border-white/10 bg-black/20 shadow-[0_20px_44px_rgba(0,0,0,0.24)]">
                      <Image src="/logo.png" alt="Brigade Pulse logo" width={52} height={52} className="h-[3.25rem] w-[3.25rem] object-contain" />
                    </div>
                    <div className="min-w-0 space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/90">
                        Workspace
                        <span className="text-[#f4c27a]">{user.isMaster ? 'Control console' : user.clientName}</span>
                      </div>
                      <div className="space-y-3">
                        <h1 className="max-w-4xl text-[clamp(2.2rem,4.6vw,4.9rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-white">
                          {workspaceTitle}
                        </h1>
                        <p className="max-w-3xl text-sm leading-7 text-slate-200/90 sm:text-[1rem]">
                          {workspaceBody}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {workspaceSignals.map((signal) => (
                      <div
                        key={signal.label}
                        className={cn(
                          'rounded-[1.4rem] border px-4 py-4',
                          signal.tone === 'amber'
                            ? 'border-[#f4c27a]/24 bg-[#f4c27a]/10'
                            : signal.tone === 'emerald'
                              ? 'border-emerald-400/22 bg-emerald-400/10'
                              : 'border-sky-400/22 bg-sky-400/10',
                        )}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-300/80">{signal.label}</p>
                        <p className="mt-2 text-lg font-semibold text-white">{signal.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {activeViews.map((entry) => (
                      <WorkspaceNavButton key={entry.id} active={view === entry.id} label={entry.label} note={entry.note} icon={entry.icon} onClick={() => setView(entry.id)} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                  {headerMetrics.map((metric) => (
                    <WorkspaceMetric key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} accent={metric.accent} tone={metric.tone} />
                  ))}
                </div>

                <div className="flagship-card flagship-card--amber rounded-[1.8rem] border p-5">
                  <div className="relative z-[1]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#ffe2b0]">Signal matrix</p>
                    <h3 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.05em] text-white">
                      The workspace should look alive before the data moves.
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-200/85">
                      Rich contrast, warmer highlights, and stronger callouts turn the control layer into something memorable instead of generic.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pb-8"
          >
            {user.isMaster ? (
              <ReimaginedAdminExperience user={user} view={view as AdminView} />
            ) : (
              <ReimaginedRecruiterExperience
                user={user}
                view={view as RecruiterView}
                logs={logs}
                logsLoading={logsLoading}
                status={status}
                workedMs={workedMs}
                breakMs={breakMs}
                brbMs={brbMs}
                onPunchIn={onPunchIn}
                onPunchOut={onPunchOut}
                onStartBreak={onStartBreak}
                onEndBreak={onEndBreak}
                onBRBIn={onBRBIn}
                onBRBOut={onBRBOut}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </section>
  );
}

function formatDuration(ms: number) {
  return ms <= 0 ? '00m 00s' : `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0')}m`;
}

function WorkspaceNavButton({
  active,
  label,
  note,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  note: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-[1.35rem] border px-4 py-3 text-left transition-all duration-200',
        active
          ? 'border-[#f4c27a]/28 bg-[linear-gradient(135deg,rgba(255,194,112,0.22),rgba(255,255,255,0.05))] shadow-[0_18px_34px_rgba(244,194,122,0.12)]'
          : 'border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] hover:border-sky-300/18 hover:bg-[linear-gradient(135deg,rgba(95,211,255,0.12),rgba(255,255,255,0.03))]',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'rounded-[1rem] border p-2.5',
            active ? 'border-[#f4c27a]/28 bg-[#f4c27a]/12 text-[#ffe0af]' : 'border-white/10 bg-black/18 text-slate-200',
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', active ? 'text-white' : 'text-slate-200')}>{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
        </div>
      </div>
    </button>
  );
}

function WorkspaceMetric({
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
      <p className={cn('mono-numeric mt-2 text-[1.45rem] font-semibold', accent)}>{value}</p>
      <p className="mt-1.5 text-xs leading-5 text-white/72">{detail}</p>
    </div>
  );
}
