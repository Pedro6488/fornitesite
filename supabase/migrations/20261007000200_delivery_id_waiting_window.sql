-- A staff member may either confirm an already proven ID, or record that the
-- friendship request was sent. Only the latter starts the 48-hour window.
create or replace function public.review_game_id_validation(
  p_validation_id uuid,
  p_status text,
  p_actor_id uuid,
  p_note text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare previous_status text;
declare next_giftable_at timestamptz;
begin
  if p_status not in ('waiting', 'ready', 'blocked') then
    raise exception 'invalid validation review status';
  end if;
  select status into previous_status from public.game_id_validations where id = p_validation_id for update;
  if previous_status is null then return false; end if;

  next_giftable_at := case when p_status = 'waiting' then now() + interval '48 hours' else null end;
  update public.game_id_validations
  set status = p_status,
      giftable_at = next_giftable_at,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      last_checked_at = now()
  where id = p_validation_id;

  if p_status = 'waiting' then
    insert into public.friend_request_records(epic_account_id, validation_id, requested_at, provider_response)
    select epic_account_id, id, now(), jsonb_build_object('mode', 'manual', 'status', 'sent_by_staff')
    from public.game_id_validations where id = p_validation_id
    on conflict (epic_account_id) do update set
      validation_id = excluded.validation_id,
      requested_at = excluded.requested_at,
      provider_response = excluded.provider_response;
  end if;

  insert into public.audit_log(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id,
    case when p_status = 'waiting' then 'delivery_identity.friend_request_sent' else 'delivery_identity.reviewed' end,
    'game_id_validation', p_validation_id::text,
    jsonb_build_object('status', previous_status),
    jsonb_strip_nulls(jsonb_build_object('status', p_status, 'giftable_at', next_giftable_at, 'notes', nullif(trim(coalesce(p_note, '')), '')))
  );
  return true;
end;
$$;

create or replace function public.advance_delivery_identity_waits(p_session_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare validation_row record;
declare advanced integer := 0;
begin
  for validation_row in
    update public.game_id_validations
    set status = 'ready', giftable_at = null, last_checked_at = now(),
        review_note = coalesce(review_note, 'La espera de 48 horas fue completada.')
    where commerce_session_id = p_session_id
      and status = 'waiting'
      and giftable_at is not null
      and giftable_at <= now()
    returning id
  loop
    advanced := advanced + 1;
    insert into public.audit_log(action, entity_type, entity_id, before_data, after_data)
    values ('delivery_identity.wait_completed', 'game_id_validation', validation_row.id::text,
      jsonb_build_object('status', 'waiting'), jsonb_build_object('status', 'ready', 'reason', '48_hours_elapsed'));
  end loop;
  return advanced;
end;
$$;

-- A delivery identity is eligible for checkout only once it is ready. This is
-- enforced in the database in addition to the interface and API checks.
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
  if validation_row.id is null or validation_row.status <> 'ready' then raise exception 'recipient_not_ready'; end if;
  select * into first_item from public.checkout_quote_items where quote_id = p_quote_id order by id limit 1;
  if first_item.id is null then raise exception 'empty_quote'; end if;

  update public.commerce_sessions
  set whatsapp = p_whatsapp, last_seen_at = now()
  where id = quote_row.commerce_session_id;

  insert into public.orders (
    status, customer_email, epic_account_id, epic_display_name, recipient_platform, contact_whatsapp,
    item_main_id, offer_id, item_name, item_image_url, vbucks_price, amount_mxn_cents, payment_method,
    price_expires_at, commerce_session_id, recipient_validation_id, checkout_quote_id,
    selected_delivery_agent_id, idempotency_key
  ) values (
    'awaiting_transfer'::public.order_status,
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
  select id into active_cart_id from public.shopping_carts where commerce_session_id = quote_row.commerce_session_id and status = 'active';
  if active_cart_id is not null then update public.shopping_carts set status = 'converted', converted_order_id = created_order.id, updated_at = now() where id = active_cart_id; end if;
  return query select created_order.id, created_order.public_token;
end;
$$;
