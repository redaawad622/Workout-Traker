-- Paid plans, hidden until turned on. Flip "enabled" to true in the workout_subscription row
-- (Table Editor → app_config) and every app shows a notice for grace_days, then asks to subscribe.
-- Shared Supabase project, so keys are prefixed with the app they belong to.
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Anyone, signed in or not, can read the settings; only the dashboard (service role) changes them.
create policy "Anyone can read app config" on public.app_config
  for select to anon, authenticated
  using (true);

create trigger app_config_touch before update on public.app_config
  for each row execute function public.touch_updated_at();

insert into public.app_config (key, value) values (
  'workout_subscription',
  '{
    "enabled": false,
    "native": false,
    "grace_days": 7,
    "currency": "USD",
    "monthly_price": 1,
    "yearly_price": 10,
    "monthly_url": "",
    "yearly_url": ""
  }'
);

-- Who has paid. Written by the stripe-webhook function (service role) or by hand in the dashboard,
-- e.g. plan 'lifetime' with no period end for someone who never pays. Each person reads only their own row.
create table public.workout_subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly', 'lifetime')),
  status text not null default 'active',
  current_period_end timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

alter table public.workout_subscriptions enable row level security;

create policy "Read own subscription" on public.workout_subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create trigger workout_subscriptions_touch before update on public.workout_subscriptions
  for each row execute function public.touch_updated_at();
