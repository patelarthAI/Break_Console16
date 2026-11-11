'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search, X, RotateCcw } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SingleSelectProps {
  multi?: false;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  searchable?: boolean;
  allowClear?: boolean;
}

interface MultiSelectProps {
  multi: true;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  searchable?: boolean;
  allowClear?: boolean;
}

type CustomSelectProps = SingleSelectProps | MultiSelectProps;

export default function CustomSelect(props: CustomSelectProps) {
  const { options, placeholder = 'Select…', label, className = '', searchable = false, multi, allowClear = false } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { setMounted(true); }, []);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUp: boolean }>({
    top: 0,
    left: 0,
    width: 200,
    openUp: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = searchable
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260 && rect.top > spaceBelow;
    const minWidth = Math.max(rect.width, 200);
    const maxLeft = Math.max(8, window.innerWidth - minWidth - 8);
    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.min(rect.left, maxLeft),
      width: minWidth,
      openUp,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const multiValue = multi ? (props as MultiSelectProps).value : [];
  const multiOnChange = multi ? (props as MultiSelectProps).onChange : undefined;

  const toggleMultiValue = useCallback((val: string) => {
    if (!multiOnChange) return;
    multiOnChange(multiValue.includes(val) ? multiValue.filter(v => v !== val) : [...multiValue, val]);
  }, [multiValue, multiOnChange]);

  const clearAll = useCallback(() => {
    if (multi) {
      multiOnChange?.([]);
    } else {
      (props as SingleSelectProps).onChange('');
    }
    setSearchTerm('');
  }, [multi, multiOnChange, props]);

  const singleValue = !multi ? (props as SingleSelectProps).value : '';
  const singleOnChange = !multi ? (props as SingleSelectProps).onChange : undefined;
  const selectedOption = !multi ? options.find(o => o.value === singleValue) : undefined;

  const hasValue = multi ? multiValue.length > 0 : !!selectedOption;

  const triggerLabel = () => {
    if (multi) {
      if (multiValue.length === 0) {
        return <span className="text-slate-400 font-medium">{placeholder}</span>;
      }
      if (multiValue.length === 1) {
        const match = options.find(o => o.value === multiValue[0]);
        return <span className="text-indigo-200 font-semibold">{match?.label ?? multiValue[0]}</span>;
      }
      return <span className="text-indigo-200 font-bold">{multiValue.length} selected</span>;
    }
    return selectedOption
      ? <span className="text-zinc-100 font-semibold">{selectedOption.label}</span>
      : <span className="text-slate-400 font-medium">{placeholder}</span>;
  };

  const dropdownContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: coords.openUp ? 4 : -4, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: coords.openUp ? 4 : -4, scale: 0.99 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            zIndex: 9990,
            top: coords.openUp ? undefined : coords.top,
            bottom: coords.openUp ? window.innerHeight - coords.top : undefined,
            left: coords.left,
            width: coords.width,
            borderRadius: '14px',
            backgroundColor: '#10121e',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.92), 0 0 0 1px rgba(99,102,241,0.12)',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          {searchable && (
            <div className="p-2 border-b border-white/[0.08] bg-[#0b0d17]">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-[#151828] border border-white/10 focus:border-indigo-500/50 rounded-lg py-1.5 pl-8 pr-2.5 text-xs text-zinc-100 placeholder-slate-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Multi header: select all / clear */}
          {multi && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] bg-[#0c0e18]">
              <button
                type="button"
                onClick={() => multiOnChange?.(options.map(o => o.value))}
                className="text-[10px] font-bold tracking-wider uppercase text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw size={9} /> Clear
              </button>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-[220px] overflow-y-auto p-1.5 scrollbar-thin">
            {filteredOptions.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {filteredOptions.map((opt, idx) => {
                  const isSelected = multi ? multiValue.includes(opt.value) : opt.value === singleValue;
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      type="button"
                      onClick={() => {
                        if (multi) toggleMultiValue(opt.value);
                        else {
                          singleOnChange?.(isSelected && allowClear ? '' : opt.value);
                          setIsOpen(false);
                          setSearchTerm('');
                        }
                      }}
                      className={`flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-500/20 text-indigo-200 font-semibold border border-indigo-500/35'
                          : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent'
                      }`}
                    >
                      <span className="truncate pr-2">{opt.label}</span>
                      {isSelected && <Check size={13} className="shrink-0 text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 opacity-50">
                <Search size={14} className="mb-1.5 text-slate-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">No results</p>
              </div>
            )}
          </div>

          {/* Multi footer */}
          {multi && (
            <div className="p-2 border-t border-white/[0.06] bg-[#0b0d17]">
              <button
                type="button"
                onClick={() => { setIsOpen(false); setSearchTerm(''); }}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-stat-label block mb-1.5 px-1">{label}</label>
      )}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center justify-between w-full h-[38px] px-3 rounded-xl text-xs transition-all cursor-pointer outline-none border ${
          isOpen
            ? 'border-indigo-500/60 bg-[#141728] shadow-[0_0_0_2px_rgba(99,102,241,0.18)]'
            : hasValue
              ? 'border-indigo-500/40 bg-indigo-500/10 hover:border-indigo-400/60'
              : 'border-white/[0.09] bg-[#131624] hover:border-white/20 hover:bg-[#171a2b]'
        }`}
      >
        <div className="flex-1 min-w-0 text-left truncate mr-2">{triggerLabel()}</div>
        <div className="flex items-center gap-1 shrink-0">
          {hasValue && (multi || allowClear) && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); clearAll(); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); clearAll(); } }}
              className="hover:text-white text-slate-400 p-0.5 rounded hover:bg-white/10 transition-colors"
              title="Clear selection"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-400' : hasValue ? 'text-indigo-400' : 'text-slate-400'}`}
          />
        </div>
      </button>

      {mounted && createPortal(dropdownContent, document.body)}
    </div>
  );
}
