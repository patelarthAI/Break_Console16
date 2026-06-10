'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback. Receives the error and a reset handler. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * App-level error boundary. A render/runtime throw in any child is caught here
 * instead of unmounting the whole React tree to a blank screen.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to the console for debugging / future error-reporting hook.
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: 24,
          textAlign: 'center',
          background: '#06070a',
          color: '#f8fafc',
          fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.30)',
            fontSize: 26,
          }}
        >
          ⚠️
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', maxWidth: 360, lineHeight: 1.5 }}>
            The interface hit an unexpected error. Your data is safe — reload to continue.
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 22px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(99,102,241,0.3)',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
