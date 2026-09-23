create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('customer', 'support', 'operator', 'admin');
create type public.order_status as enum (
  'draft', 'payment_pending', 'awaiting_transfer', 'receipt_submitted', 'transfer_review',
  'information_required', 'paid', 'ready_to_send', 'validating_delivery', 'delivering',
  'reconciling', 'delivered', 'manual_review', 'refund_pending', 'refunded', 'rejected', 'expired', 'canceled'
);
create type public.payment_method as enum ('mercado_pago', 'bank_transfer');
create type public.friendship_state as enum ('not_added', 'pending', 'waiting', 'ready', 'blocked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.epic_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  alias text,
  platform text not null default 'epic' check (platform in ('epic', 'psn', 'xbl', 'nintendo')),
  display_name text not null,
  epic_account_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, epic_account_id)
);

create table public.catalog_items (
  main_id text primary key,
  name text not null,
  description text not null default '',
  image_url text,
  item_type text not null,
  rarity text not null,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_offers (
  id uuid primary key default gen_random_uuid(),
  offer_id text not null,
  main_id text not null references public.catalog_items(main_id),
  regular_price_vbucks integer not null check (regular_price_vbucks > 0),
  final_price_vbucks integer not null check (final_price_vbucks > 0),
  giftable boolean not null default false,
  active boolean not null default true,
  available_from timestamptz,
  available_until timestamptz,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(offer_id, source_updated_at)
);
create index shop_offers_active_main_idx on public.shop_offers(main_id) where active;

create table public.catalog_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_date timestamptz not null,
  payload jsonb not null,
  checksum text not null,
  created_at timestamptz not null default now(),
  unique(source, checksum)
);

create table public.price_rules (
  id uuid primary key default gen_random_uuid(),
  min_vbucks integer not null check (min_vbucks > 0),
  max_vbucks integer check (max_vbucks is null or max_vbucks >= min_vbucks),
  mxn_per_hundred numeric(8,2) not null check (mxn_per_hundred > 0),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now()
);
insert into public.price_rules (min_vbucks, max_vbucks, mxn_per_hundred) values
  (100, 499, 10.00), (500, 1499, 8.00), (1500, 2999, 7.50), (3000, null, 7.00);

create table public.offer_price_overrides (
  id uuid primary key default gen_random_uuid(),
  main_id text not null references public.catalog_items(main_id) on delete cascade,
  amount_mxn_cents integer not null check (amount_mxn_cents > 0),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.delivery_agents (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'fnshop',
  provider_account_id text not null,
  public_alias text not null,
  category text not null default 'default',
  priority integer not null default 0,
  enabled boolean not null default true,
  healthy boolean not null default true,
  vbucks_balance integer not null default 0 check (vbucks_balance >= 0),
  gifts_used integer not null default 0 check (gifts_used >= 0),
  gifts_limit integer not null default 5 check (gifts_limit > 0),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_account_id),
  unique(public_alias)
);

create table public.friendship_status (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.delivery_agents(id) on delete cascade,
  epic_account_id text not null,
  state public.friendship_state not null default 'not_added',
  requested_at timestamptz,
  accepted_at timestamptz,
  giftable_at timestamptz,
  last_checked_at timestamptz not null default now(),
  unique(agent_id, epic_account_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid() unique,
  user_id uuid references auth.users(id) on delete set null,
  status public.order_status not null default 'draft',
  customer_email text not null,
  epic_account_id text not null,
  epic_display_name text not null,
  item_main_id text not null,
  offer_id text not null,
  item_name text not null,
  item_image_url text,
  vbucks_price integer not null check (vbucks_price > 0),
  amount_mxn_cents integer not null check (amount_mxn_cents > 0),
  payment_method public.payment_method not null,
  price_expires_at timestamptz not null default (now() + interval '30 minutes'),
  paid_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_email_idx on public.orders(lower(customer_email));
create index orders_status_created_idx on public.orders(status, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  external_id text,
  status text not null,
  amount_mxn_cents integer not null check (amount_mxn_cents > 0),
  provider_payload jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_id)
);

create table public.transfer_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  storage_path text not null,
  sender_bank text,
  sender_name text,
  transfer_reference text,
  transferred_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);

create table public.fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null default 'fnshop',
  agent_id uuid references public.delivery_agents(id),
  external_id text,
  status text not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique(provider, external_event_id)
);

create table public.outbox_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outbox_jobs_available_idx on public.outbox_jobs(available_at) where status = 'pending';

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null,
  item_count integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('transfer-receipts', 'transfer-receipts', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  update public.orders set user_id = new.id
    where user_id is null and lower(customer_email) = lower(coalesce(new.email, ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_valid_order_transition(p_from public.order_status, p_to public.order_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'draft' then p_to in ('payment_pending', 'awaiting_transfer', 'canceled')
    when 'payment_pending' then p_to in ('paid', 'rejected', 'expired', 'canceled')
    when 'awaiting_transfer' then p_to in ('receipt_submitted', 'expired', 'canceled')
    when 'receipt_submitted' then p_to = 'transfer_review'
    when 'transfer_review' then p_to in ('information_required', 'paid', 'rejected')
    when 'information_required' then p_to in ('receipt_submitted', 'rejected', 'canceled')
    when 'paid' then p_to in ('ready_to_send', 'refund_pending', 'manual_review')
    when 'ready_to_send' then p_to in ('validating_delivery', 'refund_pending', 'manual_review')
    when 'validating_delivery' then p_to in ('delivering', 'manual_review', 'refund_pending')
    when 'delivering' then p_to in ('delivered', 'reconciling', 'manual_review')
    when 'reconciling' then p_to in ('delivered', 'manual_review')
    when 'manual_review' then p_to in ('ready_to_send', 'refund_pending', 'canceled')
    when 'refund_pending' then p_to in ('refunded', 'manual_review')
    else false
  end;
$$;

create or replace function public.transition_order(p_order_id uuid, p_from text, p_to text, p_metadata jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if not public.is_valid_order_transition(p_from::public.order_status, p_to::public.order_status) then
    raise exception 'invalid order transition from % to %', p_from, p_to;
  end if;
  update public.orders set status = p_to::public.order_status, metadata = metadata || p_metadata, updated_at = now(),
    paid_at = case when p_to = 'paid' and paid_at is null then now() else paid_at end,
    delivered_at = case when p_to = 'delivered' and delivered_at is null then now() else delivered_at end
  where id = p_order_id and status = p_from::public.order_status;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

alter table public.profiles enable row level security;
alter table public.epic_accounts enable row level security;
alter table public.catalog_items enable row level security;
alter table public.shop_offers enable row level security;
alter table public.catalog_snapshots enable row level security;
alter table public.price_rules enable row level security;
alter table public.offer_price_overrides enable row level security;
alter table public.delivery_agents enable row level security;
alter table public.friendship_status enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.transfer_receipts enable row level security;
alter table public.fulfillments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.outbox_jobs enable row level security;
alter table public.audit_log enable row level security;
alter table public.sync_runs enable row level security;

create policy "catalog is publicly readable" on public.catalog_items for select using (true);
create policy "active offers are publicly readable" on public.shop_offers for select using (active);
create policy "active price rules are publicly readable" on public.price_rules for select using (active and effective_from <= now() and (effective_until is null or effective_until > now()));
create policy "profiles own row" on public.profiles for select using (auth.uid() = id);
create policy "users own epic accounts" on public.epic_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users read own orders" on public.orders for select using (auth.uid() = user_id);

revoke all on function public.transition_order(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.transition_order(uuid, text, text, jsonb) to service_role;
