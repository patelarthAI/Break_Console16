// src/components/ui/FilterBar.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Search, RefreshCcw, X } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  clientFilter: string[];
  clientOptions: string[];
  onClientFilterChange: (value: string[]) => void;
  matchCount: number;
  onRefresh?: () => void;
  isLoading?: boolean;
  isError?: boolean;
}

export default function FilterBar({
  search,
  onSearchChange,
  clientFilter,
  clientOptions,
  onClientFilterChange,
  matchCount,
  onRefresh,
  isLoading,
}: FilterBarProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active?.tagName === 'INPUT' ||
        active?.tagName === 'TEXTAREA' ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        const input = document.getElementById('search-input');
        if (input) input.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex items-center gap-[12px] w-full">
      {/* LIVE Indicator */}
      <div className="flex items-center gap-[10px] pr-[12px] border-r border-[var(--b1)] flex-shrink-0">
        <div className="relative flex h-[6px] w-[6px]">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--s-working)] opacity-40"></span>
          <span className="relative inline-flex rounded-full h-[6px] w-[6px] bg-[var(--s-working)] shadow-[0_0_8px_var(--s-working)]"></span>
        </div>
        <span style={{
          fontFamily: 'var(--f-display)',
          fontSize: '10px',
          fontWeight: 800,
          color: 'var(--t2)',
          textTransform: 'uppercase',
          letterSpacing: '2px',
        }}>Live</span>
      </div>

      {/* Search Input Area */}
      <div className="flex-1 relative flex items-center group">
        <Search 
          size={13} 
          className="absolute left-[14px] text-[var(--t3)] group-focus-within:text-[var(--accent-pale)] transition-colors duration-300 pointer-events-none z-10" 
        />
        <input
          id="search-input"
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search recruiter or client..."
          className="w-full bg-white/[0.015] hover:bg-white/[0.030] focus:bg-white/[0.005] border border-[var(--b1)] focus:border-[var(--accent-border)] rounded-[12px] py-2 text-[12px] font-[500] text-[var(--t1)] outline-none focus:ring-4 focus:ring-[var(--accent-border)]/5 transition-all duration-300 placeholder:text-[var(--t3)] font-sans shadow-[inset_0_1px_1px_rgba(255,255,255,0.01)]"
          style={{ height: '36px', paddingLeft: '40px', paddingRight: '36px' }}
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-[12px] p-1 text-[var(--t3)] hover:text-white hover:bg-white/5 rounded-md transition-all duration-200 z-10"
          >
            <X size={12} />
          </button>
        ) : (
          <div className="absolute right-[14px] pointer-events-none select-none px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[8px] font-black font-mono text-slate-500 tracking-wider leading-none">
            /
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-[8px]">
        {/* Matches Badge */}
        <div 
          className="inline-flex items-center gap-[6px] px-[12px] rounded-[12px]"
          style={{
            height: '36px',
            background: 'var(--z3)',
            border: '1px solid var(--b1)',
            color: 'var(--t3)',
            fontSize: '10px',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            letterSpacing: '1px',
            fontFamily: 'var(--f-display)',
          }}
        >
          <span style={{ fontSize: '12px' }}>{matchCount}</span>
          <span className="opacity-50">MATCHES</span>
        </div>

        {/* Client Selector */}
        <CustomSelect
          multi={true}
          options={clientOptions.map((client) => ({
            value: client,
            label: client.toUpperCase(),
          }))}
          value={clientFilter}
          onChange={onClientFilterChange}
          placeholder="All Clients"
        />

        {/* Refresh Action */}
        {onRefresh && (
          <button 
            type="button"
            onClick={onRefresh}
            className={`flex items-center justify-center w-[36px] h-[36px] rounded-[12px] bg-[var(--z3)] border border-[var(--b1)] text-[var(--t3)] hover:text-[var(--s-working)] hover:border-[var(--s-working)] transition-all ${isLoading ? 'animate-spin opacity-50 pointer-events-none' : ''}`}
          >
            <RefreshCcw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
