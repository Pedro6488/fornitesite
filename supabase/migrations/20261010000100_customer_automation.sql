-- Customer messaging and operational notification automation.

alter table public.outbox_jobs add column if not exists dedupe_key text;
alter table public.outbox_jobs add column if not exists sent_at timestamptz;
alter table public.outbox_jobs add column if not exists provider_message_id text;
create unique index if not exists outbox_jobs_dedupe_key_unique
  on public.outbox_jobs(dedupe_key) where dedupe_key is not null;

create table if not exists public.email_contacts (
  id uuid primary key default gen_random_uuid(),
  commerce_session_id uuid not null references public.commerce_sessions(id) on delete cascade,
  email text not null,
  email_normalized text not null,
  user_id uuid references auth.users(id) on delete set null,
  marketing_consent boolean not null default false,
  verified_at timestamptz,
  unsubscribed_at timestamptz,
  welcome_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists email_contacts_session_email_unique
  on public.email_contacts(commerce_session_id, email_normalized);

create table if not exists public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.email_contacts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_verification_tokens_contact_idx
  on public.email_verification_tokens(contact_id, expires_at desc);

alter table public.commerce_sessions add column if not exists email_contact_id uuid
  references public.email_contacts(id) on delete set null;
create index if not exists commerce_sessions_email_contact_idx
  on public.commerce_sessions(email_contact_id) where email_contact_id is not null;

create table if not exists public.cart_recovery_campaigns (
  cart_id uuid primary key references public.shopping_carts(id) on delete cascade,
  contact_id uuid not null references public.email_contacts(id) on delete cascade,
  last_activity_at timestamptz not null,
  first_sent_at timestamptz,
  second_sent_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cart_recovery_campaigns_pending_idx
  on public.cart_recovery_campaigns(last_activity_at)
  where canceled_at is null;

create table if not exists public.cart_recovery_tokens (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.shopping_carts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cart_recovery_tokens_cart_idx
  on public.cart_recovery_tokens(cart_id, expires_at desc);

alter table public.email_contacts enable row level security;
alter table public.email_verification_tokens enable row level security;
alter table public.cart_recovery_campaigns enable row level security;
alter table public.cart_recovery_tokens enable row level security;

create or replace function public.claim_outbox_jobs(p_limit integer default 25)
returns setof public.outbox_jobs
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with candidates as (
    select id from public.outbox_jobs
    where status = 'pending' and available_at <= now()
    order by available_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  update public.outbox_jobs as job
  set status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;
revoke all on function public.claim_outbox_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_outbox_jobs(integer) to service_role;

-- Keep inactive carts available long enough for the daily recovery campaign.
-- The dashboard already classifies carts older than 24 hours as abandoned.
create or replace function public.cleanup_expired_commerce_sessions()
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from public.commerce_rate_limits
  where window_started_at < now() - interval '2 days';
  delete from public.commerce_sessions
  where user_id is null and last_seen_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.cleanup_expired_commerce_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_expired_commerce_sessions() to service_role;
