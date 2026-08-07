create extension if not exists "pgcrypto";

create type public.app_role as enum ('user', 'admin');
create type public.plan_id as enum ('nivel1', 'nivel2', 'nivel3');
create type public.onboarding_status as enum ('awaiting_payment', 'active', 'cancelled', 'trial');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.resource_type as enum ('ebook', 'recipe', 'protocol');
create type public.community_platform as enum ('whatsapp', 'telegram');

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  selected_plan public.plan_id not null default 'nivel1',
  onboarding_status public.onboarding_status not null default 'awaiting_payment',
  has_completed_payment boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.health_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  age integer,
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  blood_type text,
  goals text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.family_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  relation text not null,
  notes text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id public.plan_id not null,
  amount_cents integer not null,
  currency text not null default 'brl',
  status text not null,
  stripe_session_id text,
  stripe_customer_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id public.plan_id not null,
  status public.onboarding_status not null default 'active',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_subscription_id text,
  granted_by_admin uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  summary text not null,
  resource_type public.resource_type not null,
  minimum_plan public.plan_id not null default 'nivel1',
  storage_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.community_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform public.community_platform not null,
  href text not null,
  minimum_plan public.plan_id not null default 'nivel2',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  title text not null,
  body text not null,
  audience public.plan_id[],
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  import_type text not null,
  file_name text not null,
  status text not null default 'queued',
  processed_rows integer not null default 0,
  error_rows integer not null default 0,
  report text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_name text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.health_profiles enable row level security;
alter table public.family_history enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.content_assets enable row level security;
alter table public.community_links enable row level security;
alter table public.broadcast_messages enable row level security;
alter table public.admin_import_jobs enable row level security;
alter table public.audit_logs enable row level security;

create policy "users can view own role"
on public.user_roles
for select
using (auth.uid() = user_id or public.is_admin());

create policy "users can view own profile"
on public.profiles
for select
using (auth.uid() = id or public.is_admin());

create policy "users can update own profile"
on public.profiles
for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "users can manage own health profile"
on public.health_profiles
for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy "users can manage own family history"
on public.family_history
for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy "users can view own payments"
on public.payments
for select
using (auth.uid() = user_id or public.is_admin());

create policy "users can view own subscriptions"
on public.subscriptions
for select
using (auth.uid() = user_id or public.is_admin());

create policy "admins manage subscriptions"
on public.subscriptions
for all
using (public.is_admin())
with check (public.is_admin());

create policy "authenticated users view eligible content"
on public.content_assets
for select
using (auth.role() = 'authenticated');

create policy "admins manage content assets"
on public.content_assets
for all
using (public.is_admin())
with check (public.is_admin());

create policy "authenticated users view community links"
on public.community_links
for select
using (auth.role() = 'authenticated');

create policy "admins manage community links"
on public.community_links
for all
using (public.is_admin())
with check (public.is_admin());

create policy "admins manage broadcasts"
on public.broadcast_messages
for all
using (public.is_admin())
with check (public.is_admin());

create policy "admins manage import jobs"
on public.admin_import_jobs
for all
using (public.is_admin())
with check (public.is_admin());

create policy "admins read audit logs"
on public.audit_logs
for select
using (public.is_admin());
