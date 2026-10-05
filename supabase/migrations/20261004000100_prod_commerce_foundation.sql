-- Production commerce foundation. This migration is intentionally additive so
-- environments that already ran the September migrations can upgrade safely.

create table if not exists public.commerce_sessions (
  id uuid primary key default gen_random_uuid(),
  anonymous_token_hash text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  whatsapp text,
  merged_into uuid references public.commerce_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists commerce_sessions_user_idx on public.commerce_sessions(user_id) where user_id is not null;
create index if not exists commerce_sessions_last_seen_idx on public.commerce_sessions(last_seen_at);

create table if not exists public.game_id_validations (
  id uuid primary key default gen_random_uuid(),
  commerce_session_id uuid not null references public.commerce_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  platform text not null check (platform in ('epic', 'xbl', 'psn', 'nintendo')),
  submitted_id text not null,
  epic_account_id text not null,
  display_name text not null,
  status text not null check (status in ('pending_friendship', 'waiting', 'ready', 'blocked')),
  giftable_at timestamptz,
  provider text not null default 'fnshop',
  agents_snapshot jsonb not null default '[]'::jsonb,
  validated_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists game_id_validations_session_idx on public.game_id_validations(commerce_session_id, created_at desc);
create index if not exists game_id_validations_epic_idx on public.game_id_validations(epic_account_id, last_checked_at desc);

create table if not exists public.friend_request_records (
  epic_account_id text primary key,
  validation_id uuid references public.game_id_validations(id) on delete set null,
  requested_at timestamptz not null default now(),
  provider_response jsonb not null default '{}'::jsonb
);

create table if not exists public.shopping_carts (
  id uuid primary key default gen_random_uuid(),
  commerce_session_id uuid not null references public.commerce_sessions(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'converted', 'abandoned')),
  converted_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists shopping_carts_one_active_per_session
  on public.shopping_carts(commerce_session_id) where status = 'active';
create index if not exists shopping_carts_session_idx on public.shopping_carts(commerce_session_id, updated_at desc);

create table if not exists public.shopping_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.shopping_carts(id) on delete cascade,
  item_main_id text not null,
  quantity integer not null default 1 check (quantity = 1),
  added_at timestamptz not null default now(),
  unique(cart_id, item_main_id)
);
create index if not exists shopping_cart_items_cart_idx on public.shopping_cart_items(cart_id);

create table if not exists public.customer_favorites (
  id uuid primary key default gen_random_uuid(),
  commerce_session_id uuid not null references public.commerce_sessions(id) on delete cascade,
  item_main_id text not null,
  created_at timestamptz not null default now(),
  unique(commerce_session_id, item_main_id)
);
create index if not exists customer_favorites_session_idx on public.customer_favorites(commerce_session_id);
create index if not exists customer_favorites_item_idx on public.customer_favorites(item_main_id);

create table if not exists public.checkout_quotes (
  id uuid primary key default gen_random_uuid(),
  commerce_session_id uuid not null references public.commerce_sessions(id) on delete cascade,
  validation_id uuid not null references public.game_id_validations(id) on delete restrict,
  amount_mxn_cents integer not null check (amount_mxn_cents > 0),
  total_vbucks integer not null check (total_vbucks > 0),
  selected_agent_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists checkout_quotes_session_idx on public.checkout_quotes(commerce_session_id, created_at desc);

create table if not exists public.checkout_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.checkout_quotes(id) on delete cascade,
  item_main_id text not null,
  offer_id text not null,
  item_name text not null,
  item_image_url text,
  vbucks_price integer not null check (vbucks_price > 0),
  unit_amount_mxn_cents integer not null check (unit_amount_mxn_cents > 0),
  quantity integer not null default 1 check (quantity = 1),
  unique(quote_id, item_main_id)
);

alter table public.orders alter column customer_email drop not null;
alter table public.orders drop constraint if exists orders_recipient_platform_check;
update public.orders set recipient_platform = case recipient_platform
  when 'xbox' then 'xbl' when 'playstation' then 'psn' else recipient_platform end
where recipient_platform in ('xbox', 'playstation');
alter table public.orders add constraint orders_recipient_platform_check
  check (recipient_platform in ('epic', 'xbl', 'psn', 'nintendo'));
alter table public.orders add column if not exists commerce_session_id uuid references public.commerce_sessions(id) on delete set null;
alter table public.orders add column if not exists recipient_validation_id uuid references public.game_id_validations(id) on delete set null;
alter table public.orders add column if not exists checkout_quote_id uuid references public.checkout_quotes(id) on delete set null;
alter table public.orders add column if not exists selected_delivery_agent_id text;
alter table public.orders add column if not exists idempotency_key text;
create unique index if not exists orders_idempotency_key_unique on public.orders(idempotency_key) where idempotency_key is not null;
create index if not exists orders_commerce_session_idx on public.orders(commerce_session_id, created_at desc);

alter table public.transfer_receipts add column if not exists mime_type text;
alter table public.transfer_receipts add column if not exists size_bytes bigint;
alter table public.transfer_receipts add column if not exists checksum text;

create table if not exists public.order_contact_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  channel text not null check (channel in ('whatsapp')),
  commerce_session_id uuid references public.commerce_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_rate_limits (
  key_hash text not null,
  action text not null,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  primary key (key_hash, action)
);

-- Preserve legacy ticket submissions while making transfer_receipts canonical.
insert into public.transfer_receipts (order_id, storage_path, mime_type, created_at)
select old.order_id, old.storage_path, old.mime_type, old.created_at
from public.order_payment_tickets old
where not exists (
  select 1 from public.transfer_receipts current
  where current.order_id = old.order_id and current.storage_path = old.storage_path
);

-- Backfill the canonical state only when the legacy order never left draft.
update public.orders
set status = case supervisor_status
  when 'pending_confirmation' then 'awaiting_transfer'::public.order_status
  when 'submitted_to_administrator' then 'receipt_submitted'::public.order_status
  when 'payment_received' then 'transfer_review'::public.order_status
  when 'sent' then 'delivered'::public.order_status
  else status
end,
updated_at = now()
where status = 'draft' and supervisor_status is not null;

-- Effective pricing must be unambiguous. Both application and database guard
-- overlapping active rules.
alter table public.price_rules add constraint price_rules_valid_window
  check (effective_until is null or effective_until > effective_from) not valid;
alter table public.offer_price_overrides add constraint offer_price_overrides_valid_window
  check (effective_until is null or effective_until > effective_from) not valid;
create or replace function public.reject_overlapping_price_rule()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.active and exists (
    select 1 from public.price_rules existing
    where existing.id <> new.id
      and existing.active
      and int4range(existing.min_vbucks, coalesce(existing.max_vbucks, 2147483646), '[]')
          && int4range(new.min_vbucks, coalesce(new.max_vbucks, 2147483646), '[]')
      and tstzrange(existing.effective_from, existing.effective_until, '[)')
          && tstzrange(new.effective_from, new.effective_until, '[)')
  ) then
    raise exception 'active price rules cannot overlap';
  end if;
  return new;
end;
$$;
drop trigger if exists price_rules_no_overlap on public.price_rules;
create trigger price_rules_no_overlap before insert or update on public.price_rules
for each row execute procedure public.reject_overlapping_price_rule();

-- One transaction consumes an authoritative quote and creates every order
-- snapshot. The service role is the only caller.
create or replace function public.create_order_from_quote(
  p_quote_id uuid,
  p_validation_id uuid,
  p_whatsapp text,
  p_email text,
  p_idempotency_key text
) returns table(order_id uuid, public_token uuid)
language plpgsql security definer set search_path = '' as $$
declare
  quote_row public.checkout_quotes%rowtype;
  validation_row public.game_id_validations%rowtype;
  first_item public.checkout_quote_items%rowtype;
  created_order public.orders%rowtype;
  active_cart_id uuid;
begin
  select * into quote_row from public.checkout_quotes
  where id = p_quote_id for update;
  if quote_row.id is null then
    raise exception 'quote_expired';
  end if;
  select * into created_order from public.orders where idempotency_key = p_idempotency_key;
  if created_order.id is not null then
    if created_order.commerce_session_id <> quote_row.commerce_session_id
      or created_order.recipient_validation_id <> p_validation_id then
      raise exception 'idempotency_mismatch';
    end if;
    return query select created_order.id, created_order.public_token;
    return;
  end if;
  if quote_row.consumed_at is not null or quote_row.expires_at <= now() then
    raise exception 'quote_expired';
  end if;
  if quote_row.validation_id <> p_validation_id then raise exception 'validation_mismatch'; end if;

  select * into validation_row from public.game_id_validations
  where id = p_validation_id and commerce_session_id = quote_row.commerce_session_id;
  if validation_row.id is null or validation_row.status <> 'ready' then raise exception 'recipient_not_ready'; end if;

  select * into first_item from public.checkout_quote_items
  where quote_id = p_quote_id order by id limit 1;
  if first_item.id is null then raise exception 'empty_quote'; end if;

  insert into public.orders (
      status, customer_email, epic_account_id, epic_display_name, recipient_platform,
      contact_whatsapp, item_main_id, offer_id, item_name, item_image_url, vbucks_price,
      amount_mxn_cents, payment_method, price_expires_at, commerce_session_id,
      recipient_validation_id, checkout_quote_id, selected_delivery_agent_id, idempotency_key
    ) values (
      'awaiting_transfer', nullif(trim(p_email), ''), validation_row.epic_account_id,
      validation_row.display_name, validation_row.platform, p_whatsapp,
      first_item.item_main_id, first_item.offer_id, first_item.item_name,
      first_item.item_image_url, first_item.vbucks_price, quote_row.amount_mxn_cents,
      'bank_transfer', quote_row.expires_at, quote_row.commerce_session_id,
      validation_row.id, quote_row.id, quote_row.selected_agent_id, p_idempotency_key
  ) returning * into created_order;

  insert into public.audit_log(action, entity_type, entity_id, after_data)
  values ('order.created', 'order', created_order.id::text,
    jsonb_build_object('status', 'awaiting_transfer', 'quote_id', quote_row.id));

  insert into public.order_items (
      order_id, item_main_id, offer_id, item_name, item_image_url,
      vbucks_price, unit_amount_mxn_cents, quantity
    )
    select created_order.id, item_main_id, offer_id, item_name, item_image_url,
      vbucks_price, unit_amount_mxn_cents, quantity
  from public.checkout_quote_items where quote_id = p_quote_id;

  update public.checkout_quotes set consumed_at = now() where id = p_quote_id;
  update public.commerce_sessions set whatsapp = p_whatsapp, last_seen_at = now()
    where id = quote_row.commerce_session_id;
  select id into active_cart_id from public.shopping_carts
    where commerce_session_id = quote_row.commerce_session_id and status = 'active';
  if active_cart_id is not null then
    update public.shopping_carts set status = 'converted', converted_order_id = created_order.id,
      updated_at = now() where id = active_cart_id;
  end if;

  return query select created_order.id, created_order.public_token;
end;
$$;

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
    when 'manual_review' then p_to in ('ready_to_send', 'refund_pending')
    when 'refund_pending' then p_to in ('refunded', 'manual_review')
    else false
  end;
$$;

-- Keep the existing public RPC contract, but record every successful change.
create or replace function public.transition_order(p_order_id uuid, p_from text, p_to text, p_metadata jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
declare actor uuid;
begin
  if not public.is_valid_order_transition(p_from::public.order_status, p_to::public.order_status) then
    raise exception 'invalid order transition from % to %', p_from, p_to;
  end if;
  begin actor := nullif(p_metadata->>'actor_id', '')::uuid; exception when others then actor := null; end;
  update public.orders set status = p_to::public.order_status, metadata = metadata || (p_metadata - 'actor_id'), updated_at = now(),
    paid_at = case when p_to = 'paid' and paid_at is null then now() else paid_at end,
    delivered_at = case when p_to = 'delivered' and delivered_at is null then now() else delivered_at end
  where id = p_order_id and status = p_from::public.order_status;
  get diagnostics changed = row_count;
  if changed = 1 then
    if p_from = 'receipt_submitted' and p_to = 'transfer_review'
      and not exists (select 1 from public.transfer_receipts where order_id = p_order_id) then
      raise exception 'receipt_required';
    end if;
    if p_from = 'transfer_review' and p_to in ('information_required', 'paid', 'rejected') then
      update public.transfer_receipts set reviewed_by = actor, reviewed_at = now()
      where id = (
        select id from public.transfer_receipts where order_id = p_order_id
        order by created_at desc limit 1
      );
    end if;
    if p_from = 'transfer_review' and p_to = 'paid' then
      insert into public.payments (order_id, provider, status, amount_mxn_cents, confirmed_at)
      select id, 'bank_transfer', 'approved', amount_mxn_cents, now()
      from public.orders where id = p_order_id;
    end if;
    insert into public.audit_log(actor_id, action, entity_type, entity_id, before_data, after_data)
    values (actor, 'order.transition', 'order', p_order_id::text,
      jsonb_build_object('status', p_from), jsonb_build_object('status', p_to));
  end if;
  return changed = 1;
end;
$$;

create or replace function public.consume_commerce_rate_limit(
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare current_attempts integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or length(p_key_hash) <> 64 then
    raise exception 'invalid rate limit parameters';
  end if;
  insert into public.commerce_rate_limits (key_hash, action, window_started_at, attempts)
  values (p_key_hash, p_action, now(), 1)
  on conflict (key_hash, action) do update set
    attempts = case
      when public.commerce_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else public.commerce_rate_limits.attempts + 1
    end,
    window_started_at = case
      when public.commerce_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else public.commerce_rate_limits.window_started_at
    end
  returning attempts into current_attempts;
  return current_attempts <= p_limit;
end;
$$;

create or replace function public.replace_cart_items(p_session_id uuid, p_item_ids text[])
returns text[] language plpgsql security definer set search_path = '' as $$
declare active_cart_id uuid;
begin
  select id into active_cart_id from public.shopping_carts
  where commerce_session_id = p_session_id and status = 'active' for update;
  if active_cart_id is null then
    insert into public.shopping_carts (commerce_session_id, status)
    values (p_session_id, 'active') returning id into active_cart_id;
  end if;
  delete from public.shopping_cart_items where cart_id = active_cart_id;
  insert into public.shopping_cart_items (cart_id, item_main_id, quantity)
  select active_cart_id, item_id, 1 from unnest(p_item_ids) item_id;
  update public.shopping_carts set updated_at = now() where id = active_cart_id;
  return p_item_ids;
end;
$$;

alter table public.commerce_sessions enable row level security;
alter table public.game_id_validations enable row level security;
alter table public.friend_request_records enable row level security;
alter table public.shopping_carts enable row level security;
alter table public.shopping_cart_items enable row level security;
alter table public.customer_favorites enable row level security;
alter table public.checkout_quotes enable row level security;
alter table public.checkout_quote_items enable row level security;
alter table public.order_contact_events enable row level security;
alter table public.commerce_rate_limits enable row level security;

create policy "users read own commerce sessions" on public.commerce_sessions for select
using (auth.uid() = user_id);
create policy "users read own game validations" on public.game_id_validations for select
using (auth.uid() = user_id);
create policy "users read own carts" on public.shopping_carts for select
using (exists (select 1 from public.commerce_sessions s where s.id = commerce_session_id and s.user_id = auth.uid()));
create policy "users read own cart items" on public.shopping_cart_items for select
using (exists (
  select 1 from public.shopping_carts c join public.commerce_sessions s on s.id = c.commerce_session_id
  where c.id = cart_id and s.user_id = auth.uid()
));
create policy "users read own favorites" on public.customer_favorites for select
using (exists (select 1 from public.commerce_sessions s where s.id = commerce_session_id and s.user_id = auth.uid()));

revoke all on function public.create_order_from_quote(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_order_from_quote(uuid, uuid, text, text, text) to service_role;
revoke all on function public.consume_commerce_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_commerce_rate_limit(text, text, integer, integer) to service_role;
revoke all on function public.replace_cart_items(uuid, text[]) from public, anon, authenticated;
grant execute on function public.replace_cart_items(uuid, text[]) to service_role;

create or replace function public.cleanup_expired_commerce_sessions()
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from public.commerce_rate_limits
  where window_started_at < now() - interval '2 days';
  update public.shopping_carts set status = 'abandoned', updated_at = now()
  where status = 'active' and updated_at < now() - interval '24 hours';
  delete from public.commerce_sessions
  where user_id is null and last_seen_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.cleanup_expired_commerce_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_expired_commerce_sessions() to service_role;
