'use client';
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State { hasError: boolean; error: Error | null; }
interface Props { children: React.ReactNode; fallbackLabel?: string; }

export default class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        if (process.env.NODE_ENV === 'development') {
            console.error('[ErrorBoundary]', error, info);
        }
    }

    reset = () => this.setState({ hasError: false, error: null });

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/8 border border-rose-500/20 flex items-center justify-center">
                    <AlertTriangle size={24} className="text-rose-400" />
                </div>
                <div>
                    <p className="text-sm font-bold text-white">{this.props.fallbackLabel ?? 'Something went wrong'}</p>
                    <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                        {process.env.NODE_ENV === 'development' ? this.state.error?.message : 'An unexpected error occurred. Try refreshing this section.'}
                    </p>
                </div>
                <button onClick={this.reset}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/8 text-slate-400 text-sm font-bold hover:text-white hover:bg-white/[0.07] transition-all">
                    <RefreshCw size={13} /> Retry
                </button>
            </div>
        );
    }
}
