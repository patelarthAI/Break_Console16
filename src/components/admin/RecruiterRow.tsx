'use client';

import { motion } from 'framer-motion';
import { formatDuration } from '@/lib/timeUtils';
import type { UserStatusRecord } from '@/lib/store';
import { Pencil, LogOut, AlertTriangle, TrendingUp, User as UserIcon } from 'lucide-react';

interface RecruiterRowProps {
  record: UserStatusRecord;
  isOnLeave?: boolean;
  onEndBreak?: (userId: string) => void;
  onEndBrb?: (userId: string) => void;
  onPunchOut?: (userId: string) => void;
  onEditLogs?: (userId: string, userName: string, clientName: string) => void;
}

function getInitials(name: string) {
  return name.split(' ').slice(0,2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function RecruiterRow({ record, isOnLeave, onEndBreak, onEndBrb, onPunchOut, onEditLogs }: RecruiterRowProps) {
  const { user, status: rawStatus, workedMs, punchIn, breakStart, brbStart, workStart, breakCount, brbCount } = record;
  const status = isOnLeave ? 'on_leave' as const : rawStatus;
  const isActive = status === 'working' || status === 'on_break' || status === 'on_brb';
  const now = Date.now();

  const breakElapsed = breakStart ? now - breakStart : 0;
  const brbElapsed = brbStart ? now - brbStart : 0;
  const workingElapsed = workStart ? now - workStart : 0;

  let displayStatus = status.replace('on_', '').replace('_', ' ').toUpperCase();
  
  let accentColor = '#64748b'; // Idle
  if (status === 'working') accentColor = '#10b981';
  else if (status === 'on_break') accentColor = '#f59e0b';
  else if (status === 'on_brb') accentColor = '#3b82f6';
  else if (status === 'on_leave') accentColor = '#8b5cf6';

  const isOverdueBreak = status === 'on_break' && breakElapsed > 30 * 60 * 1000;
  const isOverdueBrb = status === 'on_brb' && brbElapsed > 15 * 60 * 1000;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative grid grid-cols-[auto_1fr_120px_minmax(180px,1.5fr)_140px] items-center gap-5 px-6 py-4 mb-3 rounded-2xl transition-all duration-500 group ${
        isActive ? 'bg-[#0a001a]/80 border-white/10 shadow-2xl' : 'bg-white/[0.02] border-white/[0.04]'
      } border backdrop-blur-xl`}
    >
      {/* 3D Left Acccent */}
      {isActive && (
        <motion.div 
          layoutId={`row-accent-${user.id}`}
          className="absolute left-0 top-1/4 bottom-1/4 w-1.5 rounded-r-full blur-[1px]"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}` }}
        />
      )}

      {/* Avatar with Glow */}
      <div className="relative flex-shrink-0">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all duration-500 ${
          status === 'working' ? 'glow-avatar-working' : 
          status === 'on_break' ? 'glow-avatar-break' :
          status === 'on_brb' ? 'glow-avatar-brb' :
          status === 'on_leave' ? 'glow-avatar-leave' : 'border border-white/10 bg-white/5 text-slate-500'
        }`}>
          {getInitials(user.name)}
        </div>
        {isActive && (
           <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#030014] p-0.5">
             <div className="w-full h-full rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
           </div>
        )}
      </div>

      {/* Name and Metadata */}
      <div className="flex flex-col min-w-0 justify-center">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <span className="text-[15px] font-outfit font-black text-white tracking-tight truncate max-w-full group-hover:text-glow transition-all duration-300" title={user.name}>
            {user.name}
          </span>
          {breakCount === 0 && brbCount === 0 && punchIn && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded flex-shrink-0 bg-amber-500/10 border border-amber-500/20">
              <TrendingUp size={10} className="text-amber-400" />
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest hidden sm:inline-block">Elite</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <UserIcon size={10} /> {user.clientName}
          </span>
        </div>
      </div>

      {/* Status Badge Overhaul */}
      <div className="flex justify-center min-w-0">
        <div className={`badge ${
          status === 'working' ? 'badge-working' : 
          status === 'on_break' ? 'badge-break' :
          status === 'on_brb' ? 'badge-brb' : 'badge-idle'
        } py-1.5 px-4`}>
          {displayStatus}
        </div>
      </div>

      {/* Live Performance Center */}
      <div className="flex flex-col items-end min-w-0 pr-4">
        {status === 'working' ? (
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-[0.2em] mb-1">Live Shift</span>
              <span className="font-mono text-lg font-black text-emerald-400 tabular-nums tracking-tighter text-glow">
                {formatElapsed(workingElapsed)}
              </span>
            </div>
            <div className="flex flex-col items-end border-l border-white/5 pl-8">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Accumulated</span>
              <span className="font-mono text-lg font-black text-white tabular-nums tracking-tighter opacity-80">
                {formatDuration(workedMs)}
              </span>
            </div>
          </div>
        ) : isActive ? (
          <div className="flex flex-col items-end">
             <span className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${isOverdueBreak || isOverdueBrb ? 'text-red-500' : 'opacity-60'}`} style={{ color: !isOverdueBreak && !isOverdueBrb ? accentColor : undefined }}>
               LAST CHANGE
             </span>
             <div className="flex items-center gap-2">
               {(isOverdueBreak || isOverdueBrb) && <AlertTriangle size={14} className="text-red-500 animate-bounce" />}
               <span className={`font-mono text-2xl font-black tabular-nums tracking-tighter ${isOverdueBreak || isOverdueBrb ? 'text-red-500' : 'text-white'}`} style={{ color: !isOverdueBreak && !isOverdueBrb ? accentColor : undefined }}>
                 {formatElapsed(status === 'on_break' ? breakElapsed : brbElapsed)}
               </span>
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-end opacity-40">
             <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-1">TOTAL SESSION</span>
             <span className="font-mono text-lg font-black text-slate-400 tabular-nums tracking-tighter">
               {punchIn ? formatDuration(workedMs) : '00:00:00'}
             </span>
          </div>
        )}
      </div>

      {/* Action Protocol */}
      <div className="flex items-center justify-end gap-2 pr-2">
        {status === 'on_break' && onEndBreak && (
          <button onClick={() => onEndBreak(user.id)} className="btn-3d-warning text-[10px] font-black py-2 px-3 rounded-xl whitespace-nowrap">RESUME</button>
        )}
        {status === 'on_brb' && onEndBrb && (
          <button onClick={() => onEndBrb(user.id)} className="btn-3d-info text-[10px] font-black py-2 px-3 rounded-xl whitespace-nowrap">END BRB</button>
        )}
        
        <div className={`flex items-center gap-1 transition-all duration-300 ${isActive ? 'opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto' : 'opacity-100'}`}>
          {status === 'working' && onPunchOut && (
            <button onClick={() => onPunchOut(user.id)} className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" title="Administrative Shutdown"><LogOut size={16} /></button>
          )}
          {onEditLogs && punchIn && (
            <button onClick={() => onEditLogs(user.id, user.name, user.clientName)} className="p-2.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all" title="Override Protocols"><Pencil size={16} /></button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
