import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
    auth: { persistSession: false },
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
