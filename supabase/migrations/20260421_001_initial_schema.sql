create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id public.plan_id not null,
  reason text not null,
  starts_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.access_grants enable row level security;

create policy "users can view own access grants"
on public.access_grants
for select
using (auth.uid() = user_id or public.is_admin());

create policy "admins manage access grants"
on public.access_grants
for all
using (public.is_admin())
with check (public.is_admin());
