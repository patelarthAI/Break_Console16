'use client';

import { Dispatch, ReactNode, SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BriefcaseBusiness,
  CalendarClock,
  Clock3,
  FileText,
  LogOut,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { AppStatus, TimeLog, User } from '@/types';
import { formatDuration } from '@/lib/timeUtils';
import PremiumClock from '@/components/PremiumClock';
import PremiumNotificationPanel from '@/components/PremiumNotificationPanel';
import PremiumPunchPanel from '@/components/PremiumPunchPanel';
import PremiumStatusBadge from '@/components/PremiumStatusBadge';
import PremiumTimelineLog from '@/components/PremiumTimelineLog';

type MasterTab = 'dashboard' | 'reports' | 'leaves' | 'settings';
type UserTab = 'tracker' | 'team';

const MASTER_TABS: Array<{ id: MasterTab; label: string; icon: ReactNode }> = [
  { id: 'dashboard', label: 'Live Dashboard', icon: <Activity size={15} /> },
  { id: 'reports', label: 'Data Reports', icon: <FileText size={15} /> },
  { id: 'leaves', label: 'Leave Tracker', icon: <CalendarClock size={15} /> },
  { id: 'settings', label: 'Settings', icon: <ShieldCheck size={15} /> },
];

const USER_TABS: Array<{ id: UserTab; label: string; icon: ReactNode }> = [
  { id: 'tracker', label: 'My Deck', icon: <Clock3 size={15} /> },
  { id: 'team', label: 'Team Pulse', icon: <Users size={15} /> },
];

function NavTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; icon: ReactNode }>;
  value: T;
  onChange: Dispatch<SetStateAction<T>>;
}) {
  return (
    <nav className="flex flex-wrap gap-2 rounded-full border border-white/10 bg-black/20 p-2">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] transition-all ${
              active
                ? 'border border-[#f2d49a]/20 bg-[#f2d49a]/12 text-[#f2d49a] shadow-[0_12px_24px_rgba(242,212,154,0.12)]'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function MetricCard({
  label,
  value,
  tone,
  helper,
}: {
  label: string;
  value: string;
  tone: string;
  helper: string;
}) {
  return (
    <div className="surface-card rounded-[1.6rem] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className={`mono-numeric mt-3 text-3xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

interface Props {
  user: User;
  status: Exclude<AppStatus, 'on_leave'>;
  masterTab: MasterTab;
  setMasterTab: Dispatch<SetStateAction<MasterTab>>;
  userTab: UserTab;
  setUserTab: Dispatch<SetStateAction<UserTab>>;
  logs: TimeLog[];
  logsLoading: boolean;
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
  masterContent: ReactNode;
  teamContent: ReactNode;
}

export default function HomeExperience({
  user,
  status,
  masterTab,
  setMasterTab,
  userTab,
  setUserTab,
  logs,
  logsLoading,
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
  masterContent,
  teamContent,
}: Props) {
  const isMaster = user.isMaster;
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <section className="relative min-h-screen px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="ambient-orb left-[-10%] top-[-5%] h-[20rem] w-[20rem] bg-[#67d7ff]/14" />
      <div className="ambient-orb bottom-[-10%] right-[-6%] h-[18rem] w-[18rem] bg-[#f2d49a]/12" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={`relative mx-auto flex w-full flex-col gap-6 ${isMaster ? 'max-w-[1700px]' : 'max-w-[1500px]'}`}
      >
        <header className="glass-card relative overflow-hidden p-5 sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_26%)]" />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.8rem] border border-white/10 bg-white/5 text-lg font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
                  {initials}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="section-kicker">{isMaster ? 'Control console' : 'Recruiter workspace'}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                      {todayLabel}
                    </span>
                  </div>
                  <h1 className="headline-balance max-w-4xl text-[clamp(2.2rem,4vw,3.7rem)]">
                    {isMaster ? 'Command every recruiter from one premium control surface.' : 'A calmer, smarter shift deck built to keep you in flow.'}
                  </h1>
                  <p className="max-w-3xl text-base leading-7 text-slate-300">
                    {isMaster
                      ? 'Monitor live attendance, review reports, and manage approvals in a single high-clarity workspace.'
                      : `Signed in as ${user.name} for ${user.clientName}. Your time, actions, and team context now live in one place.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="btn-secondary self-start rounded-full px-5 text-xs uppercase tracking-[0.22em] text-slate-300"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              {isMaster ? (
                <NavTabs tabs={MASTER_TABS} value={masterTab} onChange={setMasterTab} />
              ) : (
                <NavTabs tabs={USER_TABS} value={userTab} onChange={setUserTab} />
              )}

              <div className="flex flex-wrap gap-2">
                <div className="data-pill">
                  <BriefcaseBusiness size={14} className="text-[#f2d49a]" />
                  {isMaster ? 'System wide visibility' : user.clientName}
                </div>
                <div className="data-pill">
                  <Sparkles size={14} className="text-[#67d7ff]" />
                  {isMaster ? 'Operations online' : `${user.shiftStart ?? '08:00'} to ${user.shiftEnd ?? '17:00'}`}
                </div>
              </div>
            </div>
          </div>
        </header>

        {isMaster ? (
          <section className="glass-card min-h-[72vh] p-4 sm:p-6">
            {masterContent}
          </section>
        ) : (
          <AnimatePresence mode="wait">
            {userTab === 'tracker' ? (
              <motion.div
                key="tracker"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"
              >
                <div className="panel-grid">
                  <PremiumNotificationPanel userId={user.id} />
                  <PremiumClock />
                  <div className="flex justify-center xl:justify-start">
                    <PremiumStatusBadge status={status} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <MetricCard
                      label="Worked"
                      value={formatDuration(workedMs)}
                      tone="text-[#64d7a6]"
                      helper="Live time on task today"
                    />
                    <MetricCard
                      label="Breaks"
                      value={formatDuration(breakMs)}
                      tone="text-[#ffc061]"
                      helper="Combined break time"
                    />
                    <MetricCard
                      label="BRB"
                      value={formatDuration(brbMs)}
                      tone="text-[#67d7ff]"
                      helper="Quick away moments"
                    />
                  </div>
                  <PremiumPunchPanel
                    status={status}
                    onPunchIn={onPunchIn}
                    onPunchOut={onPunchOut}
                    onStartBreak={onStartBreak}
                    onEndBreak={onEndBreak}
                    onBRBIn={onBRBIn}
                    onBRBOut={onBRBOut}
                  />
                </div>

                <section className="surface-card rounded-[2rem] p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="section-kicker">Timeline</p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">Every action from today, cleanly mapped.</h3>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300">
                      {logs.length} event{logs.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  {logsLoading ? (
                    <div className="rounded-[1.7rem] border border-dashed border-white/10 bg-black/10 px-5 py-10 text-center">
                      <p className="text-sm text-slate-400">Loading session history...</p>
                    </div>
                  ) : (
                    <PremiumTimelineLog logs={logs} />
                  )}
                </section>
              </motion.div>
            ) : (
              <motion.section
                key="team"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass-card min-h-[72vh] p-4 sm:p-6"
              >
                {teamContent}
              </motion.section>
            )}
          </AnimatePresence>
        )}
      </motion.div>
    </section>
  );
}
