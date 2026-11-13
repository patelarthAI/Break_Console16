import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Shared single Realtime channel ───────────────────────────────────────────
// Instead of each component opening its own WebSocket channel (5+ simultaneous),
// we consolidate into ONE shared channel to avoid connection storms on restricted
// networks and stay within Supabase free-tier connection limits.

type RealtimeCallback = (payload?: any) => void;

interface ListenerEntry {
    id: string;
    table: string;
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    filter?: string;
    callback: RealtimeCallback;
}

interface BroadcastListenerEntry {
    id: string;
    event: string;
    callback: (payload: any, event: string) => void;
}

let sharedChannel: RealtimeChannel | null = null;
let listeners: ListenerEntry[] = [];
let broadcastListeners: BroadcastListenerEntry[] = [];
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

    // Listen for named broadcast events across shared channel (zero DB writes)
    const BROADCAST_EVENTS = ['SESSION_CLAIMED', 'FORCE_LOGOUT', 'PRESENCE_PING'];
    for (const ev of BROADCAST_EVENTS) {
        channel = channel.on(
            'broadcast' as any,
            { event: ev },
            (data: any) => {
                const eventPayload = data.payload ?? data;
                for (const bl of broadcastListeners) {
                    if (bl.event === '*' || bl.event === ev) {
                        try {
                            bl.callback(eventPayload, ev);
                        } catch (e) {
                            console.error('[Realtime Broadcast] Listener error:', e);
                        }
                    }
                }
            }
        );
    }

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
                        listener.callback(payload);
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

/**
 * Subscribe to Realtime broadcast events.
 * Runs purely in memory across WebSocket clients — zero DB writes or storage impact.
 */
export function onBroadcast(
    event: string,
    callback: (payload: any, event: string) => void,
): () => void {
    const id = `bl_${++listenerIdCounter}`;
    broadcastListeners.push({ id, event, callback });
    scheduleRebuild();

    return () => {
        broadcastListeners = broadcastListeners.filter(b => b.id !== id);
        scheduleRebuild();
    };
}

/**
 * Send an ephemeral broadcast message across the shared WebSocket channel.
 * Completely bypasses PostgreSQL — 0 rows, 0 storage, 0 database compute.
 */
export async function sendBroadcast(event: string, payload: any): Promise<boolean> {
    if (!sharedChannel) {
        buildAndSubscribeChannel();
    }
    // If channel is still connecting, wait up to 2.5 seconds for it to become SUBSCRIBED
    if (!isConnected && sharedChannel) {
        let waited = 0;
        while (!isConnected && waited < 2500) {
            await new Promise(r => setTimeout(r, 100));
            waited += 100;
        }
    }
    if (!sharedChannel) return false;
    try {
        const resp = await sharedChannel.send({
            type: 'broadcast',
            event,
            payload,
        });
        return resp === 'ok';
    } catch (err) {
        console.warn('[Realtime Broadcast] send error:', err);
        return false;
    }
}

// Warm up the shared channel immediately on browser client load
if (typeof window !== 'undefined') {
    setTimeout(() => {
        if (!sharedChannel) buildAndSubscribeChannel();
    }, 50);
}
