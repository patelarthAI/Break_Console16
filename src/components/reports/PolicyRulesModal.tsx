'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sliders, RotateCcw, Check } from 'lucide-react';
import {
    PolicyConfigState,
    DEFAULT_POLICY_CONFIG,
    DEFAULT_POLICY_RULE,
    PolicyRule,
} from '@/lib/policyConfig';
import CustomSelect from '@/components/ui/CustomSelect';

interface PolicyRulesModalProps {
    open: boolean;
    config: PolicyConfigState;
    clients: string[];
    onSave: (next: PolicyConfigState) => void;
    onClose: () => void;
}

export default function PolicyRulesModal({
    open,
    config,
    clients,
    onSave,
    onClose,
}: PolicyRulesModalProps) {
    const [mounted, setMounted] = useState(false);
    const [draft, setDraft] = useState<PolicyConfigState>(config);
    const [scope, setScope] = useState<string>('__global__');

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        if (open) {
            setDraft(JSON.parse(JSON.stringify(config)));
            setScope('__global__');
        }
    }, [open, config]);

    if (!open || !mounted) return null;

    const isGlobal = scope === '__global__';
    const currentClientOverride = !isGlobal ? (draft.clients[scope] ?? {}) : {};

    const effectiveBreak = isGlobal ? draft.global.breakLimitMins : (currentClientOverride.breakLimitMins ?? draft.global.breakLimitMins);
    const effectiveBrb = isGlobal ? draft.global.brbLimitMins : (currentClientOverride.brbLimitMins ?? draft.global.brbLimitMins);
    const effectiveCombined = isGlobal ? draft.global.combinedLimitMins : (currentClientOverride.combinedLimitMins ?? draft.global.combinedLimitMins);
    const effectiveGrace = isGlobal ? draft.global.graceMins : (currentClientOverride.graceMins ?? draft.global.graceMins);
    const effectiveShiftStart = isGlobal ? (draft.global.shiftStart ?? '') : (currentClientOverride.shiftStart ?? '');
    const effectiveShiftEnd = isGlobal ? (draft.global.shiftEnd ?? '') : (currentClientOverride.shiftEnd ?? '');

    const patchField = (field: keyof PolicyRule, value: number | string | undefined) => {
        setDraft(prev => {
            if (isGlobal) {
                return {
                    ...prev,
                    global: { ...prev.global, [field]: value },
                };
            }
            const nextClient = { ...(prev.clients[scope] ?? {}), [field]: value };
            return {
                ...prev,
                clients: { ...prev.clients, [scope]: nextClient },
            };
        });
    };

    const clearCurrentScope = () => {
        if (isGlobal) {
            setDraft(prev => ({ ...prev, global: { ...DEFAULT_POLICY_RULE } }));
            return;
        }
        setDraft(prev => {
            const nextClients = { ...prev.clients };
            delete nextClients[scope];
            return { ...prev, clients: nextClients };
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/75 p-4"
            style={{ zIndex: 9995 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-lg rounded-2xl bg-[#10121e] border border-white/15 shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#151828]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                            <Sliders size={15} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white tracking-tight">Shift &amp; Break Policy Rules</h3>
                            <p className="text-[11px] text-slate-400">Customize limits globally or override per client</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                            Rule Scope
                        </label>
                        <CustomSelect
                            options={[
                                { value: '__global__', label: 'Global Default (All Clients)' },
                                ...clients.map(c => ({
                                    value: c,
                                    label: draft.clients[c] ? `${c} (Custom Override)` : c,
                                })),
                            ]}
                            value={scope}
                            onChange={setScope}
                            placeholder="Select scope"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-orange-300 mb-1">
                                Break Limit (mins)
                            </span>
                            <input
                                type="number"
                                min={1}
                                max={300}
                                value={effectiveBreak}
                                onChange={(e) => patchField('breakLimitMins', Math.max(1, parseInt(e.target.value || '75', 10)))}
                                className="w-full h-[38px] px-3 rounded-xl bg-[#0b0d16] border border-white/10 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-sky-300 mb-1">
                                BRB Limit (mins)
                            </span>
                            <input
                                type="number"
                                min={1}
                                max={120}
                                value={effectiveBrb}
                                onChange={(e) => patchField('brbLimitMins', Math.max(1, parseInt(e.target.value || '10', 10)))}
                                className="w-full h-[38px] px-3 rounded-xl bg-[#0b0d16] border border-white/10 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-fuchsia-300 mb-1">
                                Combined Brk+BRB Cap (mins)
                            </span>
                            <input
                                type="number"
                                min={1}
                                max={360}
                                value={effectiveCombined}
                                onChange={(e) => patchField('combinedLimitMins', Math.max(1, parseInt(e.target.value || '85', 10)))}
                                className="w-full h-[38px] px-3 rounded-xl bg-[#0b0d16] border border-white/10 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1">
                                Late Login Grace (mins)
                            </span>
                            <input
                                type="number"
                                min={0}
                                max={60}
                                value={effectiveGrace}
                                onChange={(e) => patchField('graceMins', Math.max(0, parseInt(e.target.value || '5', 10)))}
                                className="w-full h-[38px] px-3 rounded-xl bg-[#0b0d16] border border-white/10 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                            />
                        </label>
                    </div>

                    {!isGlobal && (
                        <div className="pt-2 border-t border-white/[0.07]">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Optional Shift Override for {scope} (leave blank to use each user&apos;s shift)
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="block text-[10px] text-slate-500 mb-1">Shift Start</span>
                                    <input
                                        type="time"
                                        value={effectiveShiftStart}
                                        onChange={(e) => patchField('shiftStart', e.target.value || undefined)}
                                        className="w-full h-[38px] px-3 rounded-xl bg-[#0b0d16] border border-white/10 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                                    />
                                </label>
                                <label className="block">
                                    <span className="block text-[10px] text-slate-500 mb-1">Shift End</span>
                                    <input
                                        type="time"
                                        value={effectiveShiftEnd}
                                        onChange={(e) => patchField('shiftEnd', e.target.value || undefined)}
                                        className="w-full h-[38px] px-3 rounded-xl bg-[#0b0d16] border border-white/10 text-xs font-mono text-white focus:border-indigo-500 outline-none"
                                    />
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-[#131624]">
                    <button
                        type="button"
                        onClick={clearCurrentScope}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <RotateCcw size={12} />
                        {isGlobal ? 'Reset Defaults' : `Clear ${scope} Override`}
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => { onSave(DEFAULT_POLICY_CONFIG); onClose(); }}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            Reset All
                        </button>
                        <button
                            type="button"
                            onClick={() => { onSave(draft); onClose(); }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-indigo-500/20"
                        >
                            <Check size={13} />
                            Apply Rules
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
