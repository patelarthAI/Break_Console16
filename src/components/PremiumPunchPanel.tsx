'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  Coffee,
  LogIn,
  LogOut,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'working' | 'on_break' | 'on_brb' | 'punched_out';

interface Props {
  status: Status;
  onPunchIn: () => void;
  onPunchOut: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onBRBIn: () => void;
  onBRBOut: () => void;
}

interface ActionProps {
  title: string;
  detail: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone: 'gold' | 'cyan' | 'amber' | 'emerald' | 'coral' | 'slate';
  featured?: boolean;
}

const toneClasses: Record<ActionProps['tone'], string> = {
  gold: 'border-[#f2d49a]/25 bg-[#f2d49a]/10 text-[#f2d49a]',
  cyan: 'border-[#67d7ff]/25 bg-[#67d7ff]/10 text-[#67d7ff]',
  amber: 'border-[#ffc061]/25 bg-[#ffc061]/10 text-[#ffc061]',
  emerald: 'border-[#64d7a6]/25 bg-[#64d7a6]/10 text-[#64d7a6]',
  coral: 'border-[#ff9b70]/25 bg-[#ff9b70]/10 text-[#ff9b70]',
  slate: 'border-white/10 bg-white/5 text-slate-300',
};

function ActionCard({ title, detail, icon, disabled, onClick, tone, featured }: ActionProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? {} : { y: -3, scale: 1.01 }}
      whileTap={disabled ? {} : { scale: 0.99 }}
      className={cn(
        'group relative overflow-hidden rounded-[1.7rem] border px-5 py-5 text-left transition-all',
        featured ? 'min-h-[7.5rem]' : 'min-h-[6.5rem]',
        toneClasses[tone],
        disabled
          ? 'cursor-not-allowed border-white/8 bg-white/[0.03] text-slate-500 opacity-45'
          : 'shadow-[0_18px_36px_rgba(0,0,0,0.22)] hover:border-white/20',
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex h-full flex-col justify-between gap-4">
        <div className="flex items-center justify-between">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-2.5">{icon}</div>
          {!disabled && <ArrowRight size={16} className="text-white/50 transition-transform group-hover:translate-x-1" />}
        </div>
        <div>
          <p className="text-base font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
        </div>
      </div>
    </motion.button>
  );
}

export default function PremiumPunchPanel({
  status,
  onPunchIn,
  onPunchOut,
  onStartBreak,
  onEndBreak,
  onBRBIn,
  onBRBOut,
}: Props) {
  const canBreak = status === 'working';
  const onBreak = status === 'on_break';
  const onBrb = status === 'on_brb';
  const canPunchOut = status === 'working';

  return (
    <section className="surface-card rounded-[2rem] p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="section-kicker">Shift actions</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Everything important stays one tap away.</h3>
        </div>
        <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 sm:block">
          Smart state aware
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ActionCard
          title="Punch in"
          detail="Start your shift and activate live tracking."
          icon={<LogIn size={18} />}
          onClick={onPunchIn}
          disabled={status !== 'idle' && status !== 'punched_out'}
          tone="gold"
          featured
        />
        <ActionCard
          title="Punch out"
          detail="Wrap the day with a clean session close."
          icon={<LogOut size={18} />}
          onClick={onPunchOut}
          disabled={!canPunchOut}
          tone="coral"
          featured
        />
        <ActionCard
          title="Start break"
          detail="Pause the shift for a planned break."
          icon={<Coffee size={18} />}
          onClick={onStartBreak}
          disabled={!canBreak}
          tone="amber"
        />
        <ActionCard
          title="End break"
          detail="Return to active work and resume focus."
          icon={<ArrowRight size={18} />}
          onClick={onEndBreak}
          disabled={!onBreak}
          tone="emerald"
        />
        <ActionCard
          title="Start BRB"
          detail="Mark a quick away moment without ending the shift."
          icon={<RotateCcw size={18} />}
          onClick={onBRBIn}
          disabled={status !== 'working'}
          tone="cyan"
        />
        <ActionCard
          title="End BRB"
          detail="Come back instantly and continue the session."
          icon={<RotateCw size={18} />}
          onClick={onBRBOut}
          disabled={!onBrb}
          tone="slate"
        />
      </div>
    </section>
  );
}
