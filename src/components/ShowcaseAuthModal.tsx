'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  RadioTower,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
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

const WELCOME_QUOTES = [
  'Make attendance feel like mission control.',
  'Turn every shift into a polished operating rhythm.',
  'Bring clarity, confidence, and momentum to the floor.',
  'Design the dashboard your team deserves to work in.',
  'High-trust teams move faster when the interface stays ahead.',
];

const FEATURE_POINTS = [
  'Real-time recruiter visibility with zero clutter.',
  'Approval, reporting, and shift control in one command surface.',
  'Built to feel premium on first glance and reliable all day.',
];

interface Props {
  onLogin: (user: User) => void;
}

export default function ShowcaseAuthModal({ onLogin }: Props) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    const remembered = getRememberedUser();

    if (remembered) {
      setName(remembered.name);
      setClientName(remembered.clientName);
      setRememberMe(true);
    }

    setQuoteIdx(Math.floor(Math.random() * WELCOME_QUOTES.length));
    getClients()
      .then(setClients)
      .catch((e) => console.error('Failed to load clients:', e))
      .finally(() => setLoadingClients(false));
  }, []);

  const isMasterAttempt = name.trim().toLowerCase() === MASTER_NAME.toLowerCase();

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
      console.error('Login error details:', err);
      if (err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'))) {
        setError('The database is unreachable from this environment right now.');
      } else {
        setError('Authentication failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto px-4 py-6 sm:px-6 sm:py-8">
      <div className="ambient-orb left-[-10%] top-[-8%] h-[18rem] w-[18rem] bg-[#67d7ff]/18" />
      <div className="ambient-orb bottom-[-12%] right-[-8%] h-[20rem] w-[20rem] bg-[#f2d49a]/15" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]"
      >
        <section className="glass-card relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(103,215,255,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(242,212,154,0.14),transparent_30%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">
                <Sparkles size={14} className="text-[#f2d49a]" />
                Competition-ready ops UI
              </div>

              <div className="space-y-4">
                <p className="section-kicker">Brigade Pulse</p>
                <h1 className="headline-balance max-w-3xl text-gradient-brand">
                  The recruiter command center reimagined for a world-class first impression.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300">
                  This sign-in experience now opens like a premium product, not a basic admin form. From here,
                  recruiters and leads step straight into a calmer, sharper, more cinematic workflow.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="surface-card rounded-[1.6rem] p-5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Signal</p>
                  <p className="mt-3 text-3xl font-bold text-white">Live</p>
                  <p className="mt-2 text-sm text-slate-400">Real-time punch, break, and team motion.</p>
                </div>
                <div className="surface-card rounded-[1.6rem] p-5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Clarity</p>
                  <p className="mt-3 text-3xl font-bold text-white">360</p>
                  <p className="mt-2 text-sm text-slate-400">Cleaner decisions for recruiters and admins.</p>
                </div>
                <div className="surface-card rounded-[1.6rem] p-5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Presence</p>
                  <p className="mt-3 text-3xl font-bold text-white">24/7</p>
                  <p className="mt-2 text-sm text-slate-400">A premium workspace that feels active all day.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="surface-card rounded-[2rem] p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-2xl border border-[#67d7ff]/25 bg-[#67d7ff]/12 p-2.5 text-[#67d7ff]">
                    <RadioTower size={18} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-slate-500">System note</p>
                    <p className="mt-1 text-lg font-semibold text-white">{WELCOME_QUOTES[quoteIdx]}</p>
                  </div>
                </div>
                <div className="lux-divider mb-4" />
                <div className="space-y-3">
                  {FEATURE_POINTS.map((point) => (
                    <div key={point} className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 text-[#f2d49a]" />
                      <p className="text-sm leading-6 text-slate-300">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="surface-card rounded-[2rem] p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Access modes</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Recruiter or control lead</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    2026 edition
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 inline-flex rounded-2xl border border-[#f2d49a]/20 bg-[#f2d49a]/10 p-2 text-[#f2d49a]">
                      <BriefcaseBusiness size={16} />
                    </div>
                    <p className="font-semibold text-white">Recruiter access</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Sign in with your name, client, and recruiter passkey to enter the live workspace.
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 inline-flex rounded-2xl border border-[#67d7ff]/20 bg-[#67d7ff]/10 p-2 text-[#67d7ff]">
                      <ShieldCheck size={16} />
                    </div>
                    <p className="font-semibold text-white">Admin access</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Type <span className="font-semibold text-white">Captain</span> in the name field to unlock the control console.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_30%)]" />
          <div className="relative mx-auto flex h-full w-full max-w-[30rem] flex-col justify-center">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.7rem] border border-white/10 bg-white/5 shadow-[0_18px_36px_rgba(0,0,0,0.3)]">
                <Image src="/logo.png" alt="Brigade Pulse logo" width={40} height={40} className="h-10 w-10 object-contain" />
              </div>
              <div>
                <p className="section-kicker">Welcome back</p>
                <h2 className="mt-1 text-3xl font-semibold text-white">Enter the dashboard</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Full name
                </span>
                <div className="relative">
                  <UserIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="input-primitive w-full pl-12 pr-4"
                    autoFocus
                  />
                </div>
              </label>

              <AnimatePresence initial={false}>
                {!isMasterAttempt && (
                  <motion.label
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="block overflow-hidden"
                  >
                    <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                      Client
                    </span>
                    <div className="relative">
                      <BriefcaseBusiness size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <select
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        disabled={loadingClients}
                        className={`input-primitive w-full appearance-none pl-12 pr-12 ${
                          clientName ? 'text-white' : 'text-slate-500'
                        }`}
                      >
                        <option value="">{loadingClients ? 'Loading clients...' : 'Select a client'}</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.name}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                  </motion.label>
                )}
              </AnimatePresence>

              <label className="block">
                <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                  Passkey
                </span>
                <div className="relative">
                  <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isMasterAttempt ? 'Admin passkey' : 'Recruiter passkey'}
                    className="input-primitive w-full pl-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((value) => !value)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-white"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-white/8 bg-black/20 px-4 py-3">
                {!isMasterAttempt ? (
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-transparent accent-[#67d7ff]"
                    />
                    Remember my recruiter profile
                  </label>
                ) : (
                  <p className="text-sm text-slate-400">Admin mode detected. Client selection is hidden automatically.</p>
                )}

                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                  {isMasterAttempt ? 'Control console' : 'Recruiter workspace'}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="rounded-[1.5rem] border border-rose-400/20 bg-rose-500/10 px-4 py-3"
                  >
                    <p className="text-sm font-medium leading-6 text-rose-200">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={loading ? {} : { y: -2 }}
                whileTap={loading ? {} : { scale: 0.985 }}
                className="btn-primary w-full justify-between rounded-[1.4rem] px-5 text-sm uppercase tracking-[0.22em] disabled:cursor-not-allowed disabled:opacity-60"
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

            <div className="mt-8 flex items-center justify-between border-t border-white/8 pt-5 text-xs text-slate-500">
              <span>Arth Global Systems</span>
              <span>Best website edition 2026</span>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
