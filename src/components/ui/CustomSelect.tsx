'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

/* ── Single-select props ────────────────────────────────────────────── */
interface SingleSelectProps {
  multi?: false;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  searchable?: boolean;
}

/* ── Multi-select props ─────────────────────────────────────────────── */
interface MultiSelectProps {
  multi: true;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  searchable?: boolean;
}

type CustomSelectProps = SingleSelectProps | MultiSelectProps;

export default function CustomSelect(props: CustomSelectProps) {
  const {
    options,
    placeholder = 'Select option...',
    label,
    className = '',
    searchable = false,
    multi,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = searchable
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Multi-select helpers ──────────────────────────────────────────── */
  const multiValue = multi ? (props as MultiSelectProps).value : [];
  const multiOnChange = multi ? (props as MultiSelectProps).onChange : undefined;

  const toggleMultiValue = useCallback(
    (optValue: string) => {
      if (!multiOnChange) return;
      multiOnChange(
        multiValue.includes(optValue)
          ? multiValue.filter(v => v !== optValue)
          : [...multiValue, optValue],
      );
    },
    [multiValue, multiOnChange],
  );

  const selectAll = useCallback(() => {
    multiOnChange?.(filteredOptions.map(o => o.value));
  }, [filteredOptions, multiOnChange]);

  const clearAll = useCallback(() => {
    multiOnChange?.([]);
  }, [multiOnChange]);

  /* ── Single-select helpers ─────────────────────────────────────────── */
  const singleValue = !multi ? (props as SingleSelectProps).value : '';
  const singleOnChange = !multi ? (props as SingleSelectProps).onChange : undefined;
  const selectedOption = !multi ? options.find(opt => opt.value === singleValue) : undefined;

  /* ── Trigger label ─────────────────────────────────────────────────── */
  const renderTriggerLabel = () => {
    if (multi) {
      if (multiValue.length === 0) {
        return <span className="text-[13px] font-semibold text-slate-500 truncate">{placeholder}</span>;
      }
      if (multiValue.length <= 2) {
        return (
          <div className="flex items-center gap-1.5 overflow-hidden">
            {multiValue.map(v => {
              const opt = options.find(o => o.value === v);
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 text-[11px] font-bold px-2 py-0.5 rounded-md truncate max-w-[120px]"
                >
                  {opt?.label ?? v}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); toggleMultiValue(v); }}
                    className="text-indigo-400 hover:text-white -mr-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        );
      }
      return (
        <span className="text-[13px] font-semibold text-white truncate">
          {multiValue.length} selected
        </span>
      );
    }

    return (
      <span className={`text-[13px] font-semibold truncate ${selectedOption ? 'text-white' : 'text-slate-500'}`}>
        {selectedOption ? selectedOption.label : placeholder}
      </span>
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-1">
          {label}
        </label>
      )}

      {/* ── Trigger button ──────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/[0.03] border transition-all duration-300 backdrop-blur-xl min-h-[44px] ${
          isOpen
            ? 'border-indigo-500/50 bg-white/[0.06] ring-4 ring-indigo-500/10'
            : 'border-white/10 hover:border-white/20'
        }`}
      >
        <div className="flex-1 min-w-0 text-left">{renderTriggerLabel()}</div>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition-transform duration-300 flex-shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', damping: 24, stiffness: 350 }}
            className="absolute z-[100] w-full mt-2 rounded-2xl bg-[#0a001a]/95 border border-white/10 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Search + bulk actions */}
            {(searchable || multi) && (
              <div className="p-2 border-b border-white/5 space-y-1.5">
                {searchable && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-[12px] font-semibold text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-all"
                    />
                  </div>
                )}
                {multi && (
                  <div className="flex items-center justify-between px-2 py-1">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider transition-colors"
                    >
                      Select all
                    </button>
                    {multiValue.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-[10px] font-bold text-slate-500 hover:text-rose-400 uppercase tracking-wider transition-colors"
                      >
                        Clear ({multiValue.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Option list */}
            <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5">
              {!multi && singleValue && (
                <button
                  type="button"
                  onClick={() => {
                    singleOnChange?.('');
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className="flex items-center w-full px-4 py-2 rounded-lg text-[12px] font-semibold text-slate-500 hover:bg-white/5 hover:text-white transition-all mb-0.5"
                >
                  Clear selection
                </button>
              )}

              {filteredOptions.length > 0 ? (
                filteredOptions.map(option => {
                  const isSelected = multi
                    ? multiValue.includes(option.value)
                    : option.value === singleValue;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        if (multi) {
                          toggleMultiValue(option.value);
                        } else {
                          singleOnChange?.(option.value);
                          setIsOpen(false);
                          setSearchTerm('');
                        }
                      }}
                      className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all mb-0.5 last:mb-0 ${
                        isSelected
                          ? multi
                            ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/20'
                            : 'bg-indigo-600/90 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {multi && (
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-all flex-shrink-0 ${
                              isSelected
                                ? 'bg-indigo-500 border-indigo-400'
                                : 'border-white/20 bg-white/5'
                            }`}
                          >
                            {isSelected && <Check size={10} strokeWidth={3} className="text-white" />}
                          </div>
                        )}
                        <span className="truncate">{option.label}</span>
                      </div>
                      {!multi && isSelected && <Check size={14} className="text-white flex-shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-6 text-center text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                  No matches found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
