-- Phase 1 without FN Shop: retain recipient IDs for an operator review instead
-- of rejecting a checkout just because automated delivery checks are unavailable.
alter table public.game_id_validations drop constraint if exists game_id_validations_status_check;
alter table public.game_id_validations add constraint game_id_validations_status_check
  check (status in ('pending_friendship', 'waiting', 'ready', 'manual_review', 'blocked'));

alter table public.checkout_quotes alter column selected_agent_id drop not null;

create or replace function public.create_order_from_quote(
  p_quote_id uuid, p_validation_id uuid, p_whatsapp text, p_email text, p_idempotency_key text
) returns table(order_id uuid, public_token uuid)
language plpgsql security definer set search_path = '' as $$
declare
  quote_row public.checkout_quotes%rowtype;
  validation_row public.game_id_validations%rowtype;
  first_item public.checkout_quote_items%rowtype;
  created_order public.orders%rowtype;
  active_cart_id uuid;
begin
  select * into quote_row from public.checkout_quotes where id = p_quote_id for update;
  if quote_row.id is null then raise exception 'quote_expired'; end if;
  select * into created_order from public.orders where idempotency_key = p_idempotency_key;
  if created_order.id is not null then
    if created_order.commerce_session_id <> quote_row.commerce_session_id or created_order.recipient_validation_id <> p_validation_id then raise exception 'idempotency_mismatch'; end if;
    return query select created_order.id, created_order.public_token; return;
  end if;
  if quote_row.consumed_at is not null or quote_row.expires_at <= now() then raise exception 'quote_expired'; end if;
  if quote_row.validation_id <> p_validation_id then raise exception 'validation_mismatch'; end if;
  select * into validation_row from public.game_id_validations where id = p_validation_id and commerce_session_id = quote_row.commerce_session_id;
  if validation_row.id is null or validation_row.status not in ('ready', 'manual_review') then raise exception 'recipient_not_ready'; end if;
  select * into first_item from public.checkout_quote_items where quote_id = p_quote_id order by id limit 1;
  if first_item.id is null then raise exception 'empty_quote'; end if;

  insert into public.orders (
    status, customer_email, epic_account_id, epic_display_name, recipient_platform, contact_whatsapp,
    item_main_id, offer_id, item_name, item_image_url, vbucks_price, amount_mxn_cents, payment_method,
    price_expires_at, commerce_session_id, recipient_validation_id, checkout_quote_id,
    selected_delivery_agent_id, idempotency_key
  ) values (
    case when validation_row.status = 'manual_review' then 'manual_review'::public.order_status else 'awaiting_transfer'::public.order_status end,
    nullif(trim(p_email), ''), validation_row.epic_account_id, validation_row.display_name,
    validation_row.platform, p_whatsapp, first_item.item_main_id, first_item.offer_id, first_item.item_name,
    first_item.item_image_url, first_item.vbucks_price, quote_row.amount_mxn_cents, 'bank_transfer',
    quote_row.expires_at, quote_row.commerce_session_id, validation_row.id, quote_row.id,
    quote_row.selected_agent_id, p_idempotency_key
  ) returning * into created_order;

  insert into public.audit_log(action, entity_type, entity_id, after_data)
  values ('order.created', 'order', created_order.id::text, jsonb_build_object('status', created_order.status, 'quote_id', quote_row.id));
  insert into public.order_items (order_id, item_main_id, offer_id, item_name, item_image_url, vbucks_price, unit_amount_mxn_cents, quantity)
    select created_order.id, item_main_id, offer_id, item_name, item_image_url, vbucks_price, unit_amount_mxn_cents, quantity
    from public.checkout_quote_items where quote_id = p_quote_id;
  update public.checkout_quotes set consumed_at = now() where id = p_quote_id;
  update public.commerce_sessions set whatsapp = p_whatsapp, last_seen_at = now() where id = quote_row.commerce_session_id;
  select id into active_cart_id from public.shopping_carts where commerce_session_id = quote_row.commerce_session_id and status = 'active';
  if active_cart_id is not null then update public.shopping_carts set status = 'converted', converted_order_id = created_order.id, updated_at = now() where id = active_cart_id; end if;
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
    when 'manual_review' then p_to in ('awaiting_transfer', 'canceled')
    when 'refund_pending' then p_to in ('refunded', 'manual_review')
    else false
  end;
$$;
