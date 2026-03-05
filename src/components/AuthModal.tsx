'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, Briefcase, Lock, Eye, EyeOff, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { User } from '@/types';
import { getUserByNameAndClient, upsertUser, setCurrentUser, getClients, ClientRow, getRememberedUser, rememberUser, forgetUser } from '@/lib/store';
import { generateUUID } from '@/lib/timeUtils';

const MASTER_PASS = '1234';
const MASTER_NAME = 'Captain';
const REGULAR_PASS = '123';

const WELCOME_QUOTES = [
    "Every great day starts with showing up. Let's go! 🚀",
    "Your effort today shapes tomorrow's results. 💪",
    "Consistency beats perfection every single time. ⚡",
    "Champions punch in first and punch out last. 🏆",
    "Another day, another opportunity to be outstanding. 🔥",
];

interface Props { onLogin: (user: User) => void; }

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

    // Pre-fill if remembered
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
            .catch(e => console.error('Failed to load clients:', e))
            .finally(() => setLoadingClients(false));
    }, []);

    const isMasterAttempt = name.trim().toLowerCase() === MASTER_NAME.toLowerCase();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) { setError('Please enter your name.'); return; }
        if (isMasterAttempt && password !== MASTER_PASS) { setError('Incorrect admin password.'); return; }
        if (!isMasterAttempt) {
            if (!clientName.trim()) { setError('Please select your client.'); return; }
            if (password !== REGULAR_PASS) { setError('Incorrect password.'); return; }
        }

        setLoading(true);
        try {
            if (isMasterAttempt) {
                let user = await getUserByNameAndClient('Master Admin', '__master__');
                if (!user) user = await upsertUser({
                    id: generateUUID(), name: 'Master Admin', clientName: '__master__',
                    isMaster: true, isApproved: true,
                    shiftStart: '08:00', shiftEnd: '17:00', timezone: 'America/Chicago'
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
                        shiftStart: '08:00', shiftEnd: '17:00', timezone: 'America/Chicago'
                    });
                } else if (user.name !== name.trim()) {
                    user = await upsertUser({ ...user, name: name.trim() });
                }
                if (rememberMe) rememberUser(name.trim(), clientName.trim());
                else forgetUser();
                setCurrentUser(user);
                onLogin(user);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Connection error — please check your internet.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030014] font-sans">
            {/* Subtle glow behind the card */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
                <div className="w-[600px] h-[600px] rounded-full bg-blue-900/10 blur-[120px]" />
            </div>

            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[420px] relative z-10">

                <div className="relative rounded-[2rem] bg-[#070714] border border-white/[0.03] p-10 shadow-2xl z-10">
                    {/* Logo & Header */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 mb-5 flex items-center justify-center">
                            <img src="/logo.png" alt="Breakthrough" className="w-full h-full object-contain drop-shadow-lg" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight mb-1">Breakthrough Brigade</h1>
                        <p className="text-[11px] font-bold tracking-[0.2em] text-[#3b82f6] uppercase mb-4">Authorized Login</p>
                        {/* Welcome Quote */}
                        <div className="w-full text-center px-5 py-4 rounded-xl bg-[#0a0a1a] border border-[#1a1a2e]">
                            <p className="text-[13px] text-slate-300 italic">Another day, another opportunity to be outstanding.</p>
                            <div className="mt-1 text-[16px]">🔥</div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <UserIcon size={18} className="text-[#3b82f6]" />
                            </div>
                            <input type="text" placeholder="Your Full Name" value={name} onChange={e => setName(e.target.value)}
                                className="w-full bg-transparent border border-[#3b82f6] rounded-xl py-4 pl-12 pr-4 text-white text-[15px] placeholder:text-slate-600 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/50 transition-all font-medium"
                                autoFocus />
                        </div>

                        {/* Client Dropdown */}
                        <AnimatePresence>
                            {!isMasterAttempt && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative group overflow-hidden">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Briefcase size={18} className="text-slate-600 group-focus-within:text-[#3b82f6] transition-colors" />
                                    </div>
                                    <select value={clientName} onChange={e => setClientName(e.target.value)} disabled={loadingClients}
                                        className={`w-full bg-transparent border border-[#1a1a2e] rounded-xl py-4 pl-12 pr-8 text-[15px] font-medium focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/50 transition-all appearance-none ${!clientName ? 'text-slate-600' : 'text-white'}`}>
                                        <option value="" className="bg-[#070714]">{loadingClients ? 'Loading…' : 'Select Client'}</option>
                                        {clients.map(c => <option key={c.id} value={c.name} className="bg-[#070714]">{c.name}</option>)}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-600">
                                        <ChevronDown size={16} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Password */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock size={18} className="text-slate-600 group-focus-within:text-[#3b82f6] transition-colors" />
                            </div>
                            <input type={showPass ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full bg-transparent border border-[#1a1a2e] rounded-xl py-4 pl-12 pr-12 text-white text-[15px] font-medium placeholder:text-slate-600 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/50 transition-all" />
                            <button type="button" onClick={() => setShowPass(!showPass)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors p-1">
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        {/* Remember Me */}
                        {!isMasterAttempt && (
                            <label className="flex items-center gap-3 cursor-pointer py-1 group w-max">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                                    ${rememberMe ? 'bg-transparent border-slate-500/70' : 'bg-transparent border-[#1a1a2e] group-hover:border-slate-500/50'}`}>
                                    {rememberMe && <CheckSquare size={16} className="text-slate-400" />}
                                </div>
                                <span className="text-[13px] text-slate-300 font-medium select-none">Remember me on this device</span>
                            </label>
                        )}

                        {/* Error */}
                        <AnimatePresence>
                            {error && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium rounded-xl p-3 text-center">{error}</div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit */}
                        <motion.button type="submit" disabled={loading}
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                            className="w-full py-4 rounded-xl bg-[#4b4eff] text-white font-bold text-[16px] tracking-wide mt-2 shadow-[0_4px_14px_rgba(75,78,255,0.4)] hover:bg-[#5b5fff] transition-all disabled:opacity-60 flex justify-center items-center">
                            {loading
                                ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                                : 'Sign In'}
                        </motion.button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
