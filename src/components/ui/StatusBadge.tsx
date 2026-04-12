'use client';

import type { AppStatus } from '@/types';

type VisualStatus = 'working' | 'on_break' | 'on_brb' | 'on_leave' | 'idle' | 'punched_out';

const STATUS_CONFIG: Record<VisualStatus, { label: string; className: string; dotClass: string }> = {
  working: {
    label: 'Working',
    className: 'badge-working',
    dotClass: 'dot-working',
  },
  on_break: {
    label: 'On Break',
    className: 'badge-break',
    dotClass: 'dot-break',
  },
  on_brb: {
    label: 'BRB',
    className: 'badge-brb',
    dotClass: 'dot-brb',
  },
  on_leave: {
    label: 'On Leave',
    className: 'badge-leave',
    dotClass: 'dot-leave',
  },
  idle: {
    label: 'Idle',
    className: 'badge-idle',
    dotClass: 'dot-idle',
  },
  punched_out: {
    label: 'Done',
    className: 'badge-out',
    dotClass: 'dot-out',
  },
};

function normalize(status: AppStatus): VisualStatus {
  if (status === 'on_leave') return 'on_leave';
  return status as VisualStatus;
}

export default function StatusBadge({ status }: { status: AppStatus }) {
  const config = STATUS_CONFIG[normalize(status)];
  return (
    <span className={`badge ${config.className}`}>
      <span className={`dot ${config.dotClass}`} />
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG, normalize };
export type { VisualStatus };
