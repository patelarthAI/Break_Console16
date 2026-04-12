import { createClient } from '@supabase/supabase-js';

const SUPABASE_EXTERNAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_EXTERNAL_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables are missing.');
}

if (typeof window !== 'undefined') {
    console.info(`[Supabase] Browser client using direct connection: ${SUPABASE_EXTERNAL_URL}`);
}

// ─── Resilient fetch wrapper with timeout ─────────────────────────────────────
const SUPABASE_FETCH_TIMEOUT_MS = 15_000; // 15 seconds

function resilientFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const existingSignal = options?.signal;

    // If the caller already has an AbortSignal, listen to it too
    if (existingSignal) {
        existingSignal.addEventListener('abort', () => controller.abort(existingSignal.reason));
    }

    const timeout = setTimeout(() => controller.abort('Supabase request timed out'), SUPABASE_FETCH_TIMEOUT_MS);

    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeout));
}

export const supabase = createClient(SUPABASE_EXTERNAL_URL, SUPABASE_ANON_KEY, {
    auth: { 
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    realtime: {
        params: { eventsPerSecond: 10 },
        timeout: 30_000,          // 30s connection timeout (default is 10s, too aggressive)
    },
    global: {
        fetch: resilientFetch,
    },
});

export function describeSupabaseError(error: unknown): string {
    if (!error) return 'Unknown Supabase error.';
    if (error instanceof Error) return error.message || error.name;
    if (typeof error === 'string') return error;

    if (typeof error === 'object') {
        const record = error as Record<string, unknown>;
        const parts = [record.message, record.details, record.hint, record.code, record.status]
            .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
            .map(String);

        if (parts.length > 0) return parts.join(' | ');
    }

    return 'Unexpected Supabase error.';
}

// ─── Type helpers matching Supabase rows ──────────────────────────────────────
export interface UserRow {
    id: string; name: string; client_name: string;
    is_master: boolean; is_approved: boolean;
    shift_start: string; shift_end: string; timezone: string;
    work_mode?: string;
}
export interface LogRow {
    id: string; user_id: string; event_type: string;
    timestamp: number; date: string; added_by: string | null;
}
