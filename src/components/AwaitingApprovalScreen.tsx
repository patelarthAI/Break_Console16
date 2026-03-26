'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock3, LogOut, RadioTower, ShieldCheck } from 'lucide-react';
import { User } from '@/types';
import { setCurrentUser } from '@/lib/store';
import { supabase } from '@/lib/supabase';

interface Props {
  user: User;
  onApproved: (user: User) => void;
  onLogout: () => void;
}

const WAITING_NOTES = [
  'Your recruiter workspace is ready. The only remaining step is admin approval.',
  'Keep this window open and we will unlock the full command deck automatically.',
  'The system checks every few seconds so you do not need to refresh manually.',
];

export default function AwaitingApprovalScreen({ user, onApproved, onLogout }: Props) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkApproval() {
      try {
        const { data } = await supabase
          .from('users')
          .select('is_approved')
          .eq('id', user.id)
          .single();

        if (!cancelled && data?.is_approved) {
          const approvedUser = { ...user, isApproved: true };
          setCurrentUser(approvedUser);
          onApproved(approvedUser);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void checkApproval();
    const intervalId = window.setInterval(() => {
      void checkApproval();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [onApproved, user]);

  return (
    <section className="competition-stage relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="competition-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute left-[-10rem] top-[-8rem] h-[24rem] w-[24rem] rounded-full bg-[#5dd7ff]/12 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-[-10rem] right-[-8rem] h-[26rem] w-[26rem] rounded-full bg-[#f4c27a]/12 blur-[140px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1280px] items-center"
      >
        <div className="grid w-full gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="competition-shell relative overflow-hidden p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(93,215,255,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,194,122,0.12),transparent_30%)]" />
            <div className="relative flex h-full flex-col justify-between gap-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f4c27a]">
                  <ShieldCheck size={14} />
                  Recruiter Access Review
                </div>

                <div className="space-y-4">
                  <h1 className="max-w-3xl text-[clamp(2.8rem,5vw,5.2rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-white">
                    Your workspace is staged and waiting for the green light.
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-slate-300">
                    We already created your recruiter profile for <span className="text-white">{user.clientName}</span>.
                    Once an admin approves it, the full interface opens automatically.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {WAITING_NOTES.map((note) => (
                  <div key={note} className="competition-panel rounded-[1.7rem] p-5">
                    <CheckCircle2 size={18} className="mb-3 text-[#f4c27a]" />
                    <p className="text-sm leading-7 text-slate-200">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="competition-shell relative overflow-hidden p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_34%)]" />

            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-18 w-18 items-center justify-center rounded-[2rem] border border-white/10 bg-black/20 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
                    <Image src="/logo.png" alt="Brigade Pulse logo" width={54} height={54} className="h-14 w-14 object-contain" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Profile detected</p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">{user.name}</h2>
                  </div>
                </div>

                <div className="competition-panel rounded-[1.8rem] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Approval state</p>
                      <p className="mt-2 text-2xl font-semibold text-white">Pending admin confirmation</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#5dd7ff]/20 bg-[#5dd7ff]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8ee6ff]">
                      <RadioTower size={14} />
                      Live check
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.3rem] border border-white/8 bg-black/15 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Client</p>
                      <p className="mt-2 text-lg font-semibold text-white">{user.clientName}</p>
                    </div>
                    <div className="rounded-[1.3rem] border border-white/8 bg-black/15 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Refresh cadence</p>
                      <p className="mt-2 text-lg font-semibold text-white">Every 5 seconds</p>
                    </div>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={checking ? 'checking' : 'standby'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-[1.8rem] border border-[#f4c27a]/18 bg-[#f4c27a]/8 px-5 py-4"
                  >
                    <div className="flex items-center gap-3 text-[#f8d39f]">
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f4c27a] opacity-70" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-[#f4c27a]" />
                      </span>
                      <span className="text-sm font-semibold">
                        {checking ? 'Checking approval status...' : 'Waiting for the next approval check...'}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-5">
                <div className="inline-flex items-center gap-2 text-sm text-slate-400">
                  <Clock3 size={15} className="text-[#5dd7ff]" />
                  Stay on this page and the workspace will open automatically.
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/8"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    </section>
  );
}
