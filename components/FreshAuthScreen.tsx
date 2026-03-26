'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Command,
  Eye,
  EyeOff,
  Lock,
  RadioTower,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { User } from '@/types';
import {
  ClientRow,
  forgetUser,
  getClients,
  getRememberedUser,
  getUserByNameAndClient,
  rememberUser,
  setCurrentUser,
  upsertUser,
} from '@/lib/store';
import { generateUUID } from '@/lib/timeUtils';

const MASTER_PASS = '1234';
const MASTER_NAME = 'Captain';
const REGULAR_PASS = '123';

const HERO_QUOTES = [
  'A flagship experience for recruiter operations.',
  'Designed to impress judges before the first click.',
  'The command center should feel premium from login onward.',
  'Timing, trust, and team visibility deserve a better stage.',
];

const PREVIEW_STATS = [
  { label: 'Live Recruiters', value: '28', accent: 'text-emerald-300', bg: 'bg-emerald-400/10' },
  { label: 'Shift Rhythm', value: '92%', accent: 'text-sky-300', bg: 'bg-sky-400/10' },
  { label: 'Average Start', value: '08:03', accent: 'text-amber-300', bg: 'bg-amber-400/10' },
];

const STREAM_ROWS = [
  { name: 'Alicia Stone', client: 'Brooksource', status: 'Working', dot: 'bg-emerald-400' },
  { name: 'Marcus Lee', client: 'Talent Grid', status: 'On break', dot: 'bg-amber-400' },
  { name: 'Riya Patel', client: 'Codex Team', status: 'Back online', dot: 'bg-sky-400' },
];

const FEATURE_POINTS = [
  'Stronger hierarchy so judges instantly understand the value.',
  'Clearer surfaces that feel designed instead of patched together.',
  'A premium first screen that sets the tone before login completes.',
];

interface Props {
  onLogin: (user: User) => void;
}

export default function FreshAuthScreen({ onLogin }: Props) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientLoadError, setClientLoadError] = useState('');
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    const remembered = getRememberedUser();
    if (remembered) {
      setName(remembered.name);
      setClientName(remembered.clientName);
      setRememberMe(true);
    }

    setQuoteIdx(Math.floor(Math.random() * HERO_QUOTES.length));
    getClients()
      .then((rows) => {
        setClients(rows);
        setClientLoadError('');
      })
      .catch((e: unknown) => {
        const rawMessage = e instanceof Error ? e.message : 'Unable to load client list.';
        const message = rawMessage.includes('Network request to Supabase failed')
          ? 'The live client directory is unreachable right now. You can still type your client name manually.'
          : rawMessage;
        setClientLoadError(message);
      })
      .finally(() => setLoadingClients(false));
  }, []);

  const isMasterAttempt = name.trim().toLowerCase() === MASTER_NAME.toLowerCase();
  const useManualClientEntry = !isMasterAttempt && (!loadingClients && (clients.length === 0 || !!clientLoadError));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name before continuing.');
      return;
    }

    if (isMasterAttempt && password !== MASTER_PASS) {
      setError('Admin passkey mismatch. Please try again.');
      return;
    }

    if (!isMasterAttempt) {
      if (!clientName.trim()) {
        setError('Choose your client to unlock the recruiter workspace.');
        return;
      }

      if (password !== REGULAR_PASS) {
        setError('That recruiter passkey is not correct.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isMasterAttempt) {
        let user = await getUserByNameAndClient('Master Admin', '__master__');

        if (!user) {
          user = await upsertUser({
            id: generateUUID(),
            name: 'Master Admin',
            clientName: '__master__',
            isMaster: true,
            isApproved: true,
            shiftStart: '08:00',
            shiftEnd: '17:00',
            timezone: 'America/Chicago',
            workMode: 'WFO',
          });
        } else {
          user = await upsertUser({ ...user, isMaster: true, isApproved: true });
        }

        setCurrentUser(user);
        onLogin(user);
        return;
      }

      let user = await getUserByNameAndClient(name.trim(), clientName.trim());
      if (!user) {
        user = await upsertUser({
          id: generateUUID(),
          name: name.trim(),
          clientName: clientName.trim(),
          isMaster: false,
          isApproved: false,
          shiftStart: '08:00',
          shiftEnd: '17:00',
          timezone: 'America/Chicago',
          workMode: 'WFO',
        });
      } else if (user.name !== name.trim()) {
        user = await upsertUser({ ...user, name: name.trim() });
      }

      if (rememberMe) rememberUser(name.trim(), clientName.trim());
      else forgetUser();

      setCurrentUser(user);
      onLogin(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (
        err instanceof TypeError ||
        message.includes('fetch') ||
        message.includes('Network request to Supabase failed')
      ) {
        setError('The database is unreachable from this environment right now.');
      } else {
        setError(message || 'Authentication failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.16),transparent_18%),radial-gradient(circle_at_85%_15%,rgba(245,158,11,0.14),transparent_18%),linear-gradient(150deg,#04070c_0%,#0a131c_50%,#11161e_100%)] px-4 py-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:120px_120px] opacity-30" />
      <div className="pointer-events-none absolute left-[-6rem] top-[-6rem] h-80 w-80 rounded-full bg-sky-400/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-[-4rem] h-96 w-96 rounded-full bg-amber-300/10 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1520px] gap-6 xl:grid-cols-[1.1fr_0.9fr]"
      >
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(155deg,rgba(8,15,24,0.94),rgba(10,20,29,0.86))] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.42)] sm:p-8 xl:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.14),transparent_26%)]" />
          <div className="relative flex h-full flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200">
                <Command size={14} className="text-amber-300" />
                Brigade Pulse flagship edition
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-semibold text-sky-100">
                <RadioTower size={14} />
                Competition-ready presentation
              </div>
            </div>

            <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_0.98fr]">
              <div className="flex flex-col justify-between gap-6">
                <div className="space-y-5">
                  <p className="section-kicker text-amber-300">Recruitment Ops Reimagined</p>
                  <h1 className="max-w-3xl text-[clamp(2.8rem,5vw,5.6rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-white">
                    A command center that feels custom-built to win.
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-slate-300">
                    This experience is rebuilt to feel designed, not themed. Strong composition, clear hierarchy,
                    richer surfaces, and a hero section that actually carries the page.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {FEATURE_POINTS.map((point) => (
                    <div key={point} className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                      <CheckCircle2 size={18} className="mb-3 text-amber-300" />
                      <p className="text-sm leading-6 text-slate-200">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative rounded-[2.1rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Live Pulse Preview</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Operational cockpit</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-slate-300">
                    Real time
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {PREVIEW_STATS.map((stat) => (
                    <div key={stat.label} className={`rounded-[1.4rem] border border-white/10 ${stat.bg} p-4`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{stat.label}</p>
                      <p className={`mt-3 text-3xl font-semibold ${stat.accent}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Shift Flow</p>
                      <p className="mt-1 text-base font-semibold text-white">Readable at a glance</p>
                    </div>
                    <BarChart3 size={18} className="text-sky-300" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                        <span>Punch-ins complete</span>
                        <span>84%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div className="h-2 w-[84%] rounded-full bg-gradient-to-r from-sky-300 to-cyan-300" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                        <span>Break adherence</span>
                        <span>91%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div className="h-2 w-[91%] rounded-full bg-gradient-to-r from-amber-300 to-orange-300" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Live Team Stream</p>
                      <p className="mt-1 text-base font-semibold text-white">Clear status cards</p>
                    </div>
                    <Users size={18} className="text-emerald-300" />
                  </div>

                  <div className="space-y-3">
                    {STREAM_ROWS.map((row) => (
                      <div key={row.name} className="flex items-center gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-3 py-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm font-semibold text-white">
                          {row.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{row.name}</p>
                          <p className="truncate text-xs text-slate-500">{row.client}</p>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/20 px-2.5 py-1 text-[11px] text-slate-300">
                          <span className={`h-2 w-2 rounded-full ${row.dot}`} />
                          {row.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  <Sparkles size={15} className="text-amber-300" />
                  {HERO_QUOTES[quoteIdx]}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/14 bg-[linear-gradient(180deg,#f7efe4_0%,#efe2d2_100%)] p-6 text-[#10151d] shadow-[0_40px_120px_rgba(0,0,0,0.36)] sm:p-8 xl:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.65),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.18),transparent_30%)]" />
          <div className="relative mx-auto flex h-full max-w-[31rem] flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-18 w-18 items-center justify-center rounded-[1.9rem] border border-black/8 bg-white/60 shadow-[0_16px_40px_rgba(16,21,29,0.12)]">
                  <Image src="/logo.png" alt="Brigade Pulse logo" width={52} height={52} className="h-13 w-13 object-contain" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c5a35]">Workforce Command Center</p>
                  <h2 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[#10151d]">Enter Brigade Pulse</h2>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-black/8 bg-white/55 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#10151d] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                    <BriefcaseBusiness size={13} />
                    Recruiter mode
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-black/[0.03] px-3 py-1.5 text-xs font-semibold text-[#46515c]">
                    <ShieldCheck size={13} className="text-[#7c5a35]" />
                    Type <span className="font-bold text-[#10151d]">Captain</span> for admin access
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6c7176]">
                  Full Name
                </span>
                <div className="relative">
                  <UserIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#657081]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full rounded-[1.25rem] border border-black/10 bg-white/75 py-4 pl-12 pr-4 text-[15px] text-[#10151d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition-all placeholder:text-[#8f96a0] focus:border-[#10151d]/25 focus:bg-white"
                    autoFocus
                  />
                </div>
              </label>

              <AnimatePresence initial={false}>
                {!isMasterAttempt && (
                  <motion.label
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    className="block overflow-hidden"
                  >
                    <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6c7176]">
                      Client
                    </span>
                    {useManualClientEntry ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <BriefcaseBusiness size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#657081]" />
                          <input
                            type="text"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            placeholder="Type your client name"
                            className="w-full rounded-[1.25rem] border border-black/10 bg-white/75 py-4 pl-12 pr-4 text-[15px] text-[#10151d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition-all placeholder:text-[#8f96a0] focus:border-[#10151d]/25 focus:bg-white"
                          />
                        </div>
                        <p className="text-xs leading-6 text-[#7d6342]">
                          {clientLoadError || 'No saved clients were found, so manual client entry is enabled.'}
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <BriefcaseBusiness size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#657081]" />
                        <select
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          disabled={loadingClients}
                          className={`w-full appearance-none rounded-[1.25rem] border border-black/10 bg-white/75 py-4 pl-12 pr-12 text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition-all focus:border-[#10151d]/25 focus:bg-white ${
                            clientName ? 'text-[#10151d]' : 'text-[#8f96a0]'
                          }`}
                        >
                          <option value="">{loadingClients ? 'Loading clients...' : 'Select a client'}</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.name}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#657081]" />
                      </div>
                    )}
                  </motion.label>
                )}
              </AnimatePresence>

              <label className="block">
                <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6c7176]">
                  Passkey
                </span>
                <div className="relative">
                  <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#657081]" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isMasterAttempt ? 'Admin passkey' : 'Recruiter passkey'}
                    className="w-full rounded-[1.25rem] border border-black/10 bg-white/75 py-4 pl-12 pr-12 text-[15px] text-[#10151d] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition-all placeholder:text-[#8f96a0] focus:border-[#10151d]/25 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#657081] transition-colors hover:text-[#10151d]"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <div className="rounded-[1.4rem] border border-black/8 bg-white/55 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {!isMasterAttempt ? (
                    <label className="flex cursor-pointer items-center gap-3 text-sm text-[#28313b]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-black/20 bg-transparent accent-[#10151d]"
                      />
                      Remember my recruiter profile
                    </label>
                  ) : (
                    <p className="text-sm text-[#55606c]">Admin mode detected. Client selection is hidden automatically.</p>
                  )}

                  <div className="rounded-full border border-black/8 bg-black/[0.04] px-3 py-1.5 text-xs font-semibold text-[#44515f]">
                    {isMasterAttempt ? 'Control console' : 'Recruiter workspace'}
                  </div>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3"
                  >
                    <p className="text-sm font-medium leading-6 text-rose-800">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={loading ? {} : { y: -2 }}
                whileTap={loading ? {} : { scale: 0.99 }}
                className="flex w-full items-center justify-between rounded-[1.35rem] bg-[#10151d] px-5 py-4 text-sm font-semibold uppercase tracking-[0.24em] text-white shadow-[0_22px_40px_rgba(16,21,29,0.22)] transition-all hover:bg-[#171d28] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{loading ? 'Opening workspace' : 'Enter Brigade Pulse'}</span>
                {loading ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8z" />
                  </svg>
                ) : (
                  <ArrowRight size={16} />
                )}
              </motion.button>
            </form>

            <div className="flex items-center justify-between border-t border-black/8 pt-5 text-xs text-[#66707b]">
              <span>Arth Global Systems</span>
              <span>Competition edition 2026</span>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
