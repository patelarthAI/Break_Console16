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
const SUPABASE_FETCH_TIMEOUT_MS = 30_000; // 30 seconds (increased from 15s to handle cold starts/slow networks)

function resilientFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const existingSignal = options?.signal;

    // If the caller already has an AbortSignal, listen to it too
    if (existingSignal) {
        if (existingSignal.aborted) {
            controller.abort(existingSignal.reason);
        } else {
            existingSignal.addEventListener('abort', () => controller.abort(existingSignal.reason));
        }
    }

    const timeout = setTimeout(() => {
        controller.abort('Supabase request timed out after 30s');
    }, SUPABASE_FETCH_TIMEOUT_MS);

    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeout));
}

export const supabase = createClient(SUPABASE_EXTERNAL_URL, SUPABASE_ANON_KEY, {
    auth: { 
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
    realtime: {
        params: { eventsPerSecond: 10 },
        timeout: 30_000,          // 30s connection timeout
    },
    global: {
        fetch: resilientFetch,
    },
});

export function describeSupabaseError(error: unknown): string {
    if (!error) return 'Unknown Supabase error.';
    
    // Handle standard Error objects
    if (error instanceof Error) {
        if (error.name === 'AbortError') return `Request was aborted (timeout or manual cancellation)`;
        return error.message || error.name || 'An unexpected error occurred';
    }

    if (typeof error === 'string') return error;

    // Handle Supabase/Postgrest error objects
    if (typeof error === 'object' && error !== null) {
        const record = error as Record<string, unknown>;
        
        // Collect potential error fields
        const rawParts = [record.message, record.details, record.hint, record.code, record.status];
        
        // Filter out empty, null, or "undefined" string values
        const parts = rawParts
            .map(p => (p === null || p === undefined) ? '' : String(p).trim())
            .filter(s => s !== '' && s !== 'undefined' && s !== 'null' && s !== '[object Object]');

        if (parts.length > 0) return parts.join(' | ');
        
        // Fallback for object with no recognized fields
        try {
            const str = JSON.stringify(record);
            return str !== '{}' ? `Error Object: ${str}` : 'Unknown error object';
        } catch {
            return 'Unserializable error object';
        }
    }

    return String(error);
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
