import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Shared single Realtime channel ───────────────────────────────────────────
// Instead of each component opening its own WebSocket channel (5+ simultaneous),
// we consolidate into ONE shared channel to avoid connection storms on restricted
// networks and stay within Supabase free-tier connection limits.

type RealtimeCallback = () => void;

interface ListenerEntry {
    id: string;
    table: string;
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    filter?: string;
    callback: RealtimeCallback;
}

let sharedChannel: RealtimeChannel | null = null;
let listeners: ListenerEntry[] = [];
let listenerIdCounter = 0;
let isConnected = false;
let connectionAttempts = 0;

// Connection health state
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
let connectionStatus: ConnectionStatus = 'disconnected';
const statusListeners = new Set<(status: ConnectionStatus) => void>();

export function onConnectionStatusChange(cb: (status: ConnectionStatus) => void): () => void {
    statusListeners.add(cb);
    // Immediately notify with current status
    cb(connectionStatus);
    return () => statusListeners.delete(cb);
}

function setConnectionStatus(status: ConnectionStatus) {
    connectionStatus = status;
    statusListeners.forEach(cb => cb(status));
}

function buildAndSubscribeChannel(): void {
    // Tear down existing channel first
    if (sharedChannel) {
        supabase.removeChannel(sharedChannel);
        sharedChannel = null;
    }

    if (listeners.length === 0) {
        setConnectionStatus('disconnected');
        return;
    }

    // Deduplicate the table+event+filter combos to avoid redundant subscriptions
    const uniqueSubscriptions = new Map<string, { table: string; event: string; filter?: string }>();
    for (const listener of listeners) {
        const key = `${listener.table}:${listener.event}:${listener.filter ?? ''}`;
        if (!uniqueSubscriptions.has(key)) {
            uniqueSubscriptions.set(key, { table: listener.table, event: listener.event, filter: listener.filter });
        }
    }

    let channel = supabase.channel('brigade-pulse-shared', {
        config: { broadcast: { self: false } },
    });

    for (const sub of uniqueSubscriptions.values()) {
        const opts: Record<string, string> = {
            event: sub.event,
            schema: 'public',
            table: sub.table,
        };
        if (sub.filter) opts.filter = sub.filter;

        channel = channel.on(
            'postgres_changes' as any,
            opts,
            (payload: any) => {
                // Dispatch to all matching listeners
                for (const listener of listeners) {
                    if (listener.table !== sub.table) continue;
                    if (listener.event !== '*' && listener.event !== payload.eventType) continue;
                    if (listener.filter && listener.filter !== sub.filter) continue;
                    try {
                        listener.callback();
                    } catch (e) {
                        console.error('[Realtime] Listener error:', e);
                    }
                }
            }
        );
    }

    setConnectionStatus('connecting');
    connectionAttempts++;

    channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
            isConnected = true;
            connectionAttempts = 0;
            setConnectionStatus('connected');
            console.info('[Realtime] Connected — single shared channel active');
        } else if (status === 'CHANNEL_ERROR') {
            isConnected = false;
            setConnectionStatus('error');
            console.warn('[Realtime] Channel error:', err?.message ?? 'unknown');
            // Auto-reconnect with backoff
            const backoffMs = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
            setTimeout(() => {
                if (listeners.length > 0) buildAndSubscribeChannel();
            }, backoffMs);
        } else if (status === 'TIMED_OUT') {
            isConnected = false;
            setConnectionStatus('error');
            console.warn('[Realtime] Connection timed out, retrying...');
            const backoffMs = Math.min(2000 * Math.pow(2, connectionAttempts), 30000);
            setTimeout(() => {
                if (listeners.length > 0) buildAndSubscribeChannel();
            }, backoffMs);
        } else if (status === 'CLOSED') {
            isConnected = false;
            setConnectionStatus('disconnected');
        }
    });

    sharedChannel = channel;
}

// Debounce channel rebuilds so rapid mount/unmount cycles don't cause connection storms
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRebuild(): void {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
        rebuildTimer = null;
        buildAndSubscribeChannel();
    }, 100);
}

/**
 * Subscribe to Postgres changes on a table. Returns an unsubscribe function.
 * Multiple components can subscribe — all share a single WebSocket channel.
 *
 * @example
 * useEffect(() => {
 *   const unsub1 = subscribe('time_logs', 'INSERT', () => refreshStatus(true));
 *   const unsub2 = subscribe('leaves', '*', () => loadLeaves(true));
 *   return () => { unsub1(); unsub2(); };
 * }, []);
 */
export function subscribe(
    table: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: RealtimeCallback,
    filter?: string,
): () => void {
    const id = `listener_${++listenerIdCounter}`;
    listeners.push({ id, table, event, filter, callback });
    scheduleRebuild();

    return () => {
        listeners = listeners.filter(l => l.id !== id);
        scheduleRebuild();
    };
}

/**
 * Get current connection status for UI indicators
 */
export function getRealtimeStatus(): ConnectionStatus {
    return connectionStatus;
}
