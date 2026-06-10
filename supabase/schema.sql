-- ============================================================================
-- Brigade Pulse — database schema (reconstructed from app code)
-- Run this in a NEW Supabase project: SQL Editor → paste → Run.
-- Then import your data (pg_dump restore, or CSV per table).
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto (already available on Supabase).
create extension if not exists pgcrypto;

-- ── clients ────────────────────────────────────────────────────────────────
create table if not exists public.clients (
    id   uuid primary key default gen_random_uuid(),
    name text not null
);

-- ── users (app-managed; NOT Supabase Auth) ──────────────────────────────────
create table if not exists public.users (
    id          uuid primary key default gen_random_uuid(),
    name        text    not null,
    client_name text,
    is_master   boolean not null default false,
    is_approved boolean not null default false,
    shift_start text    not null default '08:00',
    shift_end   text    not null default '17:00',
    timezone    text    not null default 'America/Chicago',
    work_mode   text    not null default 'WFO'   -- 'WFO' | 'WFH'
);

-- ── time_logs (punch / break / brb events) ──────────────────────────────────
-- timestamp is Unix epoch milliseconds (the app stores Date.now()).
-- date is the Chicago calendar day label 'YYYY-MM-DD' used for partitioning.
create table if not exists public.time_logs (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid   not null references public.users(id) on delete cascade,
    event_type text   not null,   -- punch_in | punch_out | break_start | break_end | brb_start | brb_end | auto_logout
    timestamp  bigint not null,
    date       text   not null,
    added_by   text
);

-- ── leaves ──────────────────────────────────────────────────────────────────
create table if not exists public.leaves (
    id            uuid primary key default gen_random_uuid(),
    date          text    not null,
    client_name   text    not null,
    employee_name text    not null,
    is_planned    boolean not null default true,
    reason        text,
    approver      text,
    leave_type    text    not null,
    day_count     numeric not null default 1,
    created_at    timestamptz not null default now()
);

-- ── notifications ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
    id         uuid primary key default gen_random_uuid(),
    message    text    not null,
    created_by text,
    is_active  boolean not null default true,
    created_at timestamptz not null default now()
);

-- ── notification_dismissals ──────────────────────────────────────────────────
create table if not exists public.notification_dismissals (
    id              uuid primary key default gen_random_uuid(),
    notification_id uuid not null references public.notifications(id) on delete cascade,
    user_id         uuid not null references public.users(id) on delete cascade,
    created_at      timestamptz not null default now(),
    unique (notification_id, user_id)
);

-- ── Indexes (query speed; the app filters by user_id + date constantly) ──────
create index if not exists idx_time_logs_user_date on public.time_logs (user_id, date);
create index if not exists idx_time_logs_date      on public.time_logs (date);
create index if not exists idx_leaves_date         on public.leaves (date);
create index if not exists idx_users_client        on public.users (client_name);
create index if not exists idx_dismissals_user     on public.notification_dismissals (user_id);

-- ── Realtime (the admin floor + recruiter view subscribe to time_logs) ───────
alter publication supabase_realtime add table public.time_logs;

-- ============================================================================
-- RLS NOTE
-- The app talks to Supabase with the public ANON key (no Supabase Auth).
-- This schema leaves RLS DISABLED so the app keeps working exactly as before.
-- ⚠️ That means anyone with the anon key (it ships to the browser) can
-- read/write these tables. To lock it down later, enable RLS per table and add
-- policies — but test the app afterward, since a too-strict policy will break
-- reads/writes done with the anon key.
-- ============================================================================
