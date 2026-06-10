'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
}

type CustomSelectProps = SingleSelectProps | MultiSelectProps;

export default function CustomSelect(props: CustomSelectProps) {
  const { options, placeholder = 'Select…', label, className = '', searchable = false, multi } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = searchable
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const multiValue = multi ? (props as MultiSelectProps).value : [];
  const multiOnChange = multi ? (props as MultiSelectProps).onChange : undefined;

  const toggleMultiValue = useCallback((val: string) => {
    if (!multiOnChange) return;
    multiOnChange(multiValue.includes(val) ? multiValue.filter(v => v !== val) : [...multiValue, val]);
  }, [multiValue, multiOnChange]);

  const clearAll = useCallback(() => { multiOnChange?.([]); setSearchTerm(''); }, [multiOnChange]);

  const singleValue = !multi ? (props as SingleSelectProps).value : '';
  const singleOnChange = !multi ? (props as SingleSelectProps).onChange : undefined;
  const selectedOption = !multi ? options.find(o => o.value === singleValue) : undefined;

  const hasValue = multi ? multiValue.length > 0 : !!selectedOption;

  const triggerLabel = () => {
    if (multi) {
      return multiValue.length === 0
        ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{placeholder}</span>
        : <span style={{ color: 'var(--accent-pale)', fontWeight: 700 }}>{multiValue.length} selected</span>;
    }
    return selectedOption
      ? <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedOption.label}</span>
      : <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{placeholder}</span>;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-stat-label block mb-1.5 px-1">{label}</label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: '36px',
          padding: '0 12px',
          borderRadius: 'var(--r-input)',
          border: `1px solid ${isOpen ? 'var(--accent-border)' : hasValue ? 'var(--accent-border)' : 'var(--border)'}`,
          background: hasValue ? 'var(--accent-dim)' : 'var(--bg-input)',
          fontFamily: 'var(--f-body)',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(168,85,247,0.10)' : 'none',
          outline: 'none',
        }}
      >
        <div className="flex-1 min-w-0 text-left truncate mr-2">{triggerLabel()}</div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasValue && multi && multiValue.length > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); clearAll(); }}
              className="hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)', opacity: 0.6, padding: '2px', borderRadius: '4px' }}
            >
              <X size={11} />
            </button>
          )}
          <ChevronDown
            size={13}
            style={{
              color: isOpen || hasValue ? 'var(--accent-pale)' : 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease, color 0.18s ease',
            }}
          />
        </div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              zIndex: 200,
              width: '100%',
              minWidth: '180px',
              marginTop: '6px',
              borderRadius: 'var(--r-lg)',
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border-strong)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(168,85,247,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Search */}
            {searchable && (
              <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      padding: '6px 8px 6px 28px',
                      fontSize: '12px',
                      fontFamily: 'var(--f-body)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Multi header: select all / clear */}
            {multi && !searchable && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 4px', borderBottom: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => multiOnChange?.(options.map(o => o.value))}
                  style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-pale)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
                  All
                </button>
                <button type="button" onClick={clearAll}
                  style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RotateCcw size={9} /> Clear
                </button>
              </div>
            )}

            {/* Options list */}
            <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '6px' }}>
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
                          else { singleOnChange?.(opt.value); setIsOpen(false); setSearchTerm(''); }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: 'var(--r-sm)',
                          fontSize: '12px',
                          fontFamily: 'var(--f-body)',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--accent-pale)' : 'var(--text-secondary)',
                          background: isSelected ? 'var(--accent-dim)' : 'transparent',
                          border: isSelected ? '1px solid var(--accent-border)' : '1px solid transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.12s ease, color 0.12s ease',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                      >
                        <span className="truncate pr-2">{opt.label}</span>
                        {isSelected && <Check size={12} style={{ flexShrink: 0, color: 'var(--accent)' }} />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6" style={{ opacity: 0.4 }}>
                  <Search size={14} style={{ marginBottom: 6, color: 'var(--text-muted)' }} />
                  <p className="text-stat-label">No results</p>
                </div>
              )}
            </div>

            {/* Multi footer */}
            {multi && (
              <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Apply
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
