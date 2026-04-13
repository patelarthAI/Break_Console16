'use client';

import { Search, X } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  clientFilter: string[];
  clientOptions: string[];
  onClientFilterChange: (value: string[]) => void;
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
  const selectOptions = clientOptions.map((c) => ({ value: c, label: c }));

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-white/6 bg-[var(--surface-2)]">
      {showLive && (
        <div className="flex items-center gap-2 pr-3 border-r border-white/8">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
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
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={12} />
          </button>
        )}
      </label>

      <div className="w-px h-6 bg-white/8 flex-shrink-0" />

      <CustomSelect
        multi
        options={selectOptions}
        value={clientFilter}
        onChange={onClientFilterChange}
        placeholder="All Clients"
        searchable={selectOptions.length > 6}
        className="min-w-[180px] max-w-[280px]"
      />

      <div className="pl-3 border-l border-white/8 text-[11px] font-bold text-slate-500 tracking-wider uppercase whitespace-nowrap">
        {matchCount} match{matchCount !== 1 ? 'es' : ''}
      </div>
    </div>
  );
}
