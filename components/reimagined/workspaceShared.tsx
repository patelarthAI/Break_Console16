'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AppStatus, User } from '@/types';
import { UserStatusRecord } from '@/lib/store';
import { getRelativeDate, getTodayKey, formatDuration } from '@/lib/timeUtils';
import type { ReactNode } from 'react';

export type LiveStatus = Exclude<AppStatus, 'on_leave'>;
export type AdminView = 'dashboard' | 'reports' | 'leave' | 'settings';
export type RecruiterView = 'shift' | 'team';
export type WorkspaceView = AdminView | RecruiterView;
export type ReportRange = 'today' | 'yesterday' | 'week' | 'month';

export interface ReportRow {
  user: User;
  liveStatus: LiveStatus;
  workedMs: number;
  breakMs: number;
  brbMs: number;
  violationCount: number;
  violationTags: string[];
  activeDays: number;
  firstPunch?: number;
  lastPunch?: number;
}

export interface EditUserDraft {
  id: string;
  name: string;
  clientName: string;
  isApproved: boolean;
  shiftStart: string;
  shiftEnd: string;
  timezone: string;
}

export interface LeaveDraft {
  employeeName: string;
  clientName: string;
  date: string;
  leaveType: string;
  dayCount: string;
  reason: string;
  isPlanned: boolean;
}

export type ConfirmState =
  | { kind: 'client'; id: string; name: string }
  | { kind: 'user'; id: string; name: string }
  | { kind: 'notification'; id: string; name: string }
  | { kind: 'leave'; id: string; name: string }
  | null;

export const STATUS_META: Record<
  LiveStatus,
  { label: string; chip: string; dot: string; surface: string; valueTone: string }
> = {
  idle: {
    label: 'Idle',
    chip: 'border-white/10 bg-white/6 text-slate-200',
    dot: 'bg-slate-400',
    surface: 'from-slate-400/14 via-transparent to-transparent',
    valueTone: 'text-slate-100',
  },
  working: {
    label: 'Working',
    chip: 'border-emerald-400/22 bg-emerald-400/10 text-emerald-200',
    dot: 'bg-emerald-400',
    surface: 'from-emerald-400/14 via-transparent to-transparent',
    valueTone: 'text-emerald-200',
  },
  on_break: {
    label: 'On break',
    chip: 'border-amber-400/22 bg-amber-400/10 text-amber-200',
    dot: 'bg-amber-400',
    surface: 'from-amber-400/14 via-transparent to-transparent',
    valueTone: 'text-amber-200',
  },
  on_brb: {
    label: 'BRB',
    chip: 'border-sky-400/22 bg-sky-400/10 text-sky-200',
    dot: 'bg-sky-400',
    surface: 'from-sky-400/14 via-transparent to-transparent',
    valueTone: 'text-sky-200',
  },
  punched_out: {
    label: 'Done',
    chip: 'border-rose-400/22 bg-rose-400/10 text-rose-200',
    dot: 'bg-rose-400',
    surface: 'from-rose-400/14 via-transparent to-transparent',
    valueTone: 'text-rose-200',
  },
};

export const REPORT_RANGE_LABELS: Record<ReportRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 days',
  month: 'Last 30 days',
};

export const TIMEZONE_OPTIONS = [
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Asia/Kolkata',
];

export const ACTION_TONES = {
  gold: 'border-[#f4c27a]/24 bg-[#f4c27a]/10 text-[#f4c27a]',
  emerald: 'border-emerald-400/24 bg-emerald-400/10 text-emerald-200',
  amber: 'border-amber-400/24 bg-amber-400/10 text-amber-200',
  sky: 'border-sky-400/24 bg-sky-400/10 text-sky-200',
  rose: 'border-rose-400/24 bg-rose-400/10 text-rose-200',
  slate: 'border-white/10 bg-white/6 text-slate-200',
} as const;

export function normalizeStatus(status: AppStatus): LiveStatus {
  return status === 'on_leave' ? 'idle' : status;
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatShortTime(timestamp?: number, timezone = 'America/Chicago') {
  if (!timestamp) return '--';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(timestamp));
}

export function formatReadableDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getDatesForRange(range: ReportRange, timezone: string) {
  const today = getTodayKey();

  if (range === 'today') return [today];
  if (range === 'yesterday') return [getRelativeDate(today, -1)];
  if (range === 'week') return Array.from({ length: 7 }, (_, index) => getRelativeDate(today, index - 6));
  return Array.from({ length: 30 }, (_, index) => getRelativeDate(today, index - 29));
}

export function Surface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <section className={cn('competition-shell rounded-[2rem] p-5 sm:p-6', className)}>{children}</section>;
}

export function SectionHeading({
  kicker,
  title,
  body,
  action,
}: {
  kicker: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f4c27a]">{kicker}</p>
        <h2 className="mt-3 text-[clamp(1.65rem,2vw,2.35rem)] font-semibold tracking-[-0.05em] text-white">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <div className="competition-panel rounded-[1.7rem] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">{label}</p>
      <p className={cn('mono-numeric mt-3 text-[clamp(1.8rem,3vw,2.7rem)] font-semibold', accent)}>{value}</p>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

export function StatusChip({ status }: { status: AppStatus }) {
  const meta = STATUS_META[normalizeStatus(status)];

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]', meta.chip)}>
      <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.7rem] border border-dashed border-white/10 bg-black/12 px-6 py-10 text-center">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-400">{body}</p>
    </div>
  );
}

export function ViewButton({
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
        'rounded-[1.35rem] border px-4 py-3 text-left transition-all',
        active
          ? 'border-[#f4c27a]/24 bg-[#f4c27a]/10 shadow-[0_16px_30px_rgba(244,194,122,0.08)]'
          : 'border-white/8 bg-white/4 hover:border-white/14 hover:bg-white/7',
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-2xl border p-2.5', active ? 'border-[#f4c27a]/24 bg-[#f4c27a]/12 text-[#f4c27a]' : 'border-white/10 bg-black/15 text-slate-300')}>
            {icon}
          </div>
          <div>
            <p className={cn('text-sm font-semibold', active ? 'text-white' : 'text-slate-200')}>{label}</p>
            <p className="text-xs text-slate-500">{note}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

export function ActionTile({
  label,
  body,
  icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  body: string;
  icon: ReactNode;
  tone: keyof typeof ACTION_TONES;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileHover={disabled ? {} : { y: -2 }}
      whileTap={disabled ? {} : { scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'rounded-[1.6rem] border p-4 text-left transition-all',
        ACTION_TONES[tone],
        disabled ? 'cursor-not-allowed opacity-40 saturate-0' : 'hover:border-white/20 hover:bg-white/8',
      )}
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-black/18 p-2.5">{icon}</div>
        <div>
          <p className="text-base font-semibold text-white">{label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
        </div>
      </div>
    </motion.button>
  );
}

export function PresenceCard({ record }: { record: UserStatusRecord }) {
  const meta = STATUS_META[normalizeStatus(record.status)];

  return (
    <article className="competition-panel relative overflow-hidden rounded-[1.7rem] p-4">
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', meta.surface)} />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/10 bg-black/18 text-sm font-semibold text-white">
              {getInitials(record.user.name)}
            </div>
            <div>
              <p className="text-base font-semibold text-white">{record.user.name}</p>
              <p className="text-sm text-slate-500">{record.user.clientName}</p>
            </div>
          </div>
          <StatusChip status={record.status} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.2rem] border border-white/8 bg-black/15 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Started</p>
            <p className="mono-numeric mt-2 text-sm font-semibold text-white">{formatShortTime(record.punchIn, record.user.timezone)}</p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-black/15 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Worked</p>
            <p className={cn('mono-numeric mt-2 text-sm font-semibold', meta.valueTone)}>{formatDuration(record.workedMs)}</p>
          </div>
          <div className="rounded-[1.2rem] border border-white/8 bg-black/15 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Signals</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {record.breakCount} break{record.breakCount === 1 ? '' : 's'} / {record.brbCount} BRB
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
