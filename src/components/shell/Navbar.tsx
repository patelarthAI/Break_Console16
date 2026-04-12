import { motion } from 'framer-motion';
import type { User } from '@/types';

interface NavbarProps {
  user: User;
  activeView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
}

const NAV_TABS = [
  { id: 'dashboard', label: 'Live Dashboard' },
  { id: 'reports', label: 'Reports' },
  { id: 'leave', label: 'Leave Desk' },
  { id: 'settings', label: 'Settings' },
];

export default function Navbar({ user, activeView, onViewChange, onLogout }: NavbarProps) {
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#030014]/60 backdrop-blur-3xl">
      <div className="flex items-center justify-between px-4 lg:px-8 h-20">
        {/* Left: Brand & Custom Logo */}
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-[#8a2be2] to-[#00d2ff] p-[1.5px] shadow-[0_0_30px_rgba(0,210,255,0.2)] group-hover:scale-110 transition-transform duration-500">
            <div className="flex items-center justify-center w-full h-full bg-[#0a001a] rounded-[14px]">
              <span className="font-outfit font-black text-transparent bg-clip-text bg-gradient-to-tr from-[#00d2ff] to-[#8a2be2] text-sm tracking-tighter text-glow">BP</span>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#8a2be2] to-[#00d2ff] blur-lg -z-10 opacity-40 group-hover:opacity-80 transition-opacity"></div>
          </div>

          <div className="flex flex-col">
            <span className="font-outfit text-xl font-black text-white tracking-tighter hidden sm:inline drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">
              Brigade Pulse
            </span>
            {user.isMaster && (
               <span className="px-2 py-0.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-[8px] font-black text-emerald-400 tracking-[0.2em] w-fit">ADMIN PROTOCOL</span>
            )}
          </div>
        </div>

        {/* Center: Nav tabs (Modern Segmented) */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-2xl p-1.5 border border-white/[0.06] backdrop-blur-md shadow-2xl">
          {NAV_TABS.map((tab) => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onViewChange(tab.id)}
                className={`relative px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all whitespace-nowrap overflow-hidden ${
                  isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600/90 to-fuchsia-600/90 rounded-xl shadow-[0_0_25px_rgba(99,102,241,0.4)]"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 tracking-widest uppercase text-[10px]">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Date + Logout */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Chronos</span>
            <span className="text-[11px] text-slate-300 font-bold font-mono tracking-tight">{todayLabel}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/[0.08] hover:text-white transition-all active:scale-95"
          >
            Terminal Out →
          </button>
        </div>
      </div>
    </nav>
  );
}
