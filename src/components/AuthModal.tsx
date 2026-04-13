'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, Briefcase, Lock, Eye, EyeOff, CheckSquare, ChevronDown, Sparkles } from 'lucide-react';
import { User } from '@/types';
import { getUserByNameAndClient, upsertUser, setCurrentUser, getClients, ClientRow, getRememberedUser, rememberUser, forgetUser } from '@/lib/store';
import { describeSupabaseError } from '@/lib/supabase';
import { generateUUID } from '@/lib/timeUtils';

const MASTER_PASS = '1234';
const MASTER_NAME = 'Captain';
const REGULAR_PASS = '123';

const WELCOME_QUOTES = [
    "Empowering your recruitment journey with precision.",
    "The intersection of elite talent and dedicated effort.",
    "Elevate your workflow. Redefine your excellence.",
    "Driven by data, powered by breakthrough performance.",
    "Welcome back to the core of your high-performance team.",
];

interface Props { onLogin: (user: User) => void; }

function isNetworkLikeError(details: string): boolean {
    const normalized = details.toLowerCase();
    return (
        normalized.includes('fetch')
        || normalized.includes('network')
        || normalized.includes('timeout')
        || normalized.includes('headers timeout')
        || normalized.includes('upstream request timeout')
        || normalized.includes('failed to load clients')
    );
}

function firstErrorLine(details: string): string {
    return details.split('|')[0]?.split('\n')[0]?.trim() || 'Unexpected error.';
}

export default function AuthModal({ onLogin }: Props) {
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
            .catch((err: unknown) => {
                const details = describeSupabaseError(err);
                console.error('Failed to load clients:', details, err);
                if (isNetworkLikeError(details)) {
                    setError('Supabase is temporarily unavailable. Client data could not be loaded.');
                } else {
                    setError(`Unable to load clients. ${firstErrorLine(details)}`);
                }
            })
            .finally(() => setLoadingClients(false));
    }, []);

    const isMasterAttempt = name.trim().toLowerCase() === MASTER_NAME.toLowerCase();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) { setError('Full Name required — please enter your name.'); return; }
        if (isMasterAttempt && password !== MASTER_PASS) { setError('Administrative credential mismatch.'); return; }
        if (!isMasterAttempt) {
            if (!clientName.trim()) { setError('Selection required — please choose your client.'); return; }
            if (password !== REGULAR_PASS) { setError('Access denied — incorrect credentials.'); return; }
        }

        setLoading(true);
        try {
            if (isMasterAttempt) {
                let user = await getUserByNameAndClient('Master Admin', '__master__');
                if (!user) user = await upsertUser({
                    id: generateUUID(), name: 'Master Admin', clientName: '__master__',
                    isMaster: true, isApproved: true,
                    shiftStart: '08:00', shiftEnd: '17:00', timezone: 'America/Chicago', workMode: 'WFO'
                });
                else user = await upsertUser({ ...user, isMaster: true, isApproved: true });
                setCurrentUser(user);
                onLogin(user);
            } else {
                let user = await getUserByNameAndClient(name.trim(), clientName.trim());
                if (!user) {
                    user = await upsertUser({
                        id: generateUUID(), name: name.trim(), clientName: clientName.trim(),
                        isMaster: false, isApproved: false,
                        shiftStart: '08:00', shiftEnd: '17:00', timezone: 'America/Chicago', workMode: 'WFO'
                    });
                } else if (user.name !== name.trim()) {
                    user = await upsertUser({ ...user, name: name.trim() });
                }
                if (rememberMe) rememberUser(name.trim(), clientName.trim());
                else forgetUser();
                setCurrentUser(user);
                onLogin(user);
            }
        } catch (err: unknown) {
            const details = describeSupabaseError(err);
            console.error('Login error details:', details, err);
            if (isNetworkLikeError(details)) {
                setError('Supabase is temporarily unavailable. Login cannot complete right now.');
            } else {
                setError(`Authentication failed — ${firstErrorLine(details)}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#02020a] font-sans selection:bg-indigo-500/30 overflow-hidden">
            {/* ── Immersive Mesh Background ── */}
            <div className="absolute inset-0 z-0">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.4, 0.3],
                        rotate: [0, 90, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] rounded-full bg-gradient-radial from-indigo-600/20 via-transparent to-transparent blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.3, 0.2],
                        rotate: [0, -45, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[10%] -right-[5%] w-[70%] h-[70%] rounded-full bg-gradient-radial from-blue-600/20 via-transparent to-transparent blur-[100px]"
                />
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[440px] relative z-10"
            >
                {/* ── Frosted Glass Login Card ── */}
                <div className="relative group overflow-hidden rounded-[2.5rem] bg-white/[0.01] backdrop-blur-[24px] border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.6)] px-10 py-12">
                    
                    {/* Animated Accent Border */}
                    <div className="absolute inset-0 pointer-events-none">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute inset-0 rounded-[2.5rem] border border-indigo-500/20" 
                        />
                    </div>

                    <div className="flex flex-col items-center mb-10 text-center">
                        <motion.div 
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="w-24 h-24 mb-6 relative"
                        >
                            <img src="/logo.png" alt="Breakthrough" className="w-full h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-transform duration-700" />
                        </motion.div>
                        
                        <motion.h1 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl font-black text-white tracking-[-0.03em] mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
                        >
                            Breakthrough Console
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400/80 mb-6"
                        >
                            Presence Creates Momentum
                        </motion.p>
                        
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="w-full relative py-4 px-6 rounded-2xl bg-black/40 border border-white/[0.03] overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-blue-500" />
                            <p className="text-xs text-slate-400 leading-relaxed font-medium">"{WELCOME_QUOTES[quoteIdx]}"</p>
                        </motion.div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <UserIcon size={18} />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Full Name" 
                                value={name} 
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-2xl py-4.5 pl-12 pr-4 text-white text-[15px] placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.04] transition-all duration-300 ring-offset-black focus:ring-4 focus:ring-indigo-500/10"
                                autoFocus 
                            />
                        </motion.div>

                        <AnimatePresence>
                            {!isMasterAttempt && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0, y: -10 }} 
                                    animate={{ opacity: 1, height: 'auto', y: 0 }} 
                                    exit={{ opacity: 0, height: 0, y: -10 }}
                                    className="relative group"
                                >
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                        <Briefcase size={18} />
                                    </div>
                                    <select 
                                        value={clientName} 
                                        onChange={e => setClientName(e.target.value)} 
                                        disabled={loadingClients}
                                        className={`w-full bg-white/[0.02] border border-white/[0.06] rounded-2xl py-4.5 pl-12 pr-10 text-[15px] focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.04] transition-all duration-300 appearance-none ${!clientName ? 'text-slate-600' : 'text-white'}`}
                                    >
                                        <option value="" className="bg-[#0a0a14]">{loadingClients ? 'Loading clients...' : 'Select Client'}</option>
                                        {clients.map(c => <option key={c.id} value={c.name} className="bg-[#0a0a14]">{c.name}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-600">
                                        <ChevronDown size={16} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7 }} className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <Lock size={18} />
                            </div>
                            <input 
                                type={showPass ? 'text' : 'password'} 
                                placeholder="Password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-2xl py-4.5 pl-12 pr-12 text-white text-[15px] placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.04] transition-all duration-300 focus:ring-4 focus:ring-indigo-500/10" 
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors p-1"
                            >
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </motion.div>

                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex items-center justify-between px-1">
                            {!isMasterAttempt && (
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <div className="relative">
                                        <input 
                                            type="checkbox" 
                                            checked={rememberMe} 
                                            onChange={e => setRememberMe(e.target.checked)} 
                                            className="sr-only" 
                                        />
                                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all duration-300 ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'border-white/10 bg-white/5 group-hover:border-white/20'}`}>
                                            {rememberMe && <CheckSquare size={12} className="text-white" />}
                                        </div>
                                    </div>
                                    <span className="text-[12px] text-slate-500 group-hover:text-slate-300 transition-colors font-semibold">Persist Session</span>
                                </label>
                            )}
                        </motion.div>

                        <AnimatePresence>
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }} 
                                    animate={{ opacity: 1, scale: 1 }} 
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3"
                                >
                                    <div className="p-1 rounded-md bg-rose-500/20 text-rose-500 mt-0.5">
                                        <Sparkles size={12} />
                                    </div>
                                    <p className="text-[13px] text-rose-300 font-medium leading-tight">{error}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button 
                            type="submit" 
                            disabled={loading}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.9 }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="relative w-full py-4.5 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(79,70,229,0.3)] hover:shadow-[0_20px_40px_rgba(79,70,229,0.4)] transition-all group overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {loading ? (
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                ) : (
                                    <>Sign In <Sparkles size={14} /></>
                                )}
                            </span>
                        </motion.button>
                    </form>
                </div>
                
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="text-center mt-8 text-[10px] font-bold text-slate-700 uppercase tracking-[0.3em]"
                >
                    &copy; 2026 Arth Global Systems
                </motion.p>
            </motion.div>
        </div>
    );
}
