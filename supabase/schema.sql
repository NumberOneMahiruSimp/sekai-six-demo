-- Run once in the Supabase SQL Editor.
create table if not exists public.six_player_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.six_player_data enable row level security;

create policy "Players can read their own save"
  on public.six_player_data for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players can create their own save"
  on public.six_player_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Players can update their own save"
  on public.six_player_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
