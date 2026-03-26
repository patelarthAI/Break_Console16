import { createClient } from '@supabase/supabase-js';

const SUPABASE_EXTERNAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// In the browser, route through the Next.js API proxy to bypass corporate network blocks.
// On the server (SSR/API routes), connect directly.
const url = typeof window !== 'undefined'
    ? `${window.location.origin}/api/supabase`
    : SUPABASE_EXTERNAL_URL;

console.log('[Supabase] Initializing client via proxy:', url);
export const supabase = createClient(url, key, {
    auth: { 
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    realtime: { params: { eventsPerSecond: 10 } },
});

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
