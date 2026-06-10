-- Run each statement in Supabase SQL Editor.
-- These indexes make the current app queries much cheaper.

create index concurrently if not exists idx_users_approved_client_name
on public.users (is_master, is_approved, client_name, name);

create index concurrently if not exists idx_time_logs_user_date_timestamp
on public.time_logs (user_id, date, timestamp);

create index concurrently if not exists idx_leaves_client_date_employee
on public.leaves (client_name, date, employee_name);

create index concurrently if not exists idx_clients_name
on public.clients (name);

analyze public.users;
analyze public.time_logs;
analyze public.leaves;
analyze public.clients;
