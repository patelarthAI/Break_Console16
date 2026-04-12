'use client';

import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  clientFilter: string;
  clientOptions: string[];
  onClientFilterChange: (value: string) => void;
  matchCount: number;
  showLive?: boolean;
}

export default function FilterBar({
  search,
  onSearchChange,
  clientFilter,
  clientOptions,
  onClientFilterChange,
  matchCount,
  showLive = true,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-white/6 bg-[var(--surface-2)]">
      {showLive && (
        <div className="flex items-center gap-2 pr-3 border-r border-white/8">
          <span className="dot dot-live" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Live</span>
        </div>
      )}

      <label className="flex items-center gap-2 flex-1 min-w-0 max-w-xs">
        <Search size={14} className="text-slate-500 flex-shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search recruiter or client..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600 font-medium"
        />
      </label>

      <div className="relative">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/8 bg-white/[0.03] text-sm text-slate-300 font-medium cursor-pointer">
          <SlidersHorizontal size={13} className="text-slate-500" />
          <span>{clientFilter === 'all' ? 'All Clients' : clientFilter}</span>
          <ChevronDown size={13} className="text-slate-500" />
        </div>
        <select
          value={clientFilter}
          onChange={(e) => onClientFilterChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
          aria-label="Filter by client"
        >
          {clientOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'all' ? 'All Clients' : opt}
            </option>
          ))}
        </select>
      </div>

      <div className="pl-3 border-l border-white/8 text-[11px] font-bold text-slate-500 tracking-wider uppercase whitespace-nowrap">
        {matchCount} match{matchCount !== 1 ? 'es' : ''}
      </div>
    </div>
  );
}
