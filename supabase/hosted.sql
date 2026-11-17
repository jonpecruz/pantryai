-- Run ONLY in the new, separate hosted PantryAI project.
-- Do not run schema.sql or schema_part*.sql in this project.
begin;
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
revoke all on public.user_state from anon;
grant select, insert, update, delete on public.user_state to authenticated;
create policy "own pantry only" on public.user_state for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.publik_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  record text not null
);
alter table public.publik_users enable row level security;
revoke all on public.publik_users from anon, authenticated;
grant all on public.publik_users to service_role;

create table if not exists public.ai_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('publik', 'gemini')),
  own_key text,
  usage boolean not null default true
);
alter table public.ai_preferences enable row level security;
revoke all on public.ai_preferences from anon, authenticated;
grant all on public.ai_preferences to service_role;
commit;
