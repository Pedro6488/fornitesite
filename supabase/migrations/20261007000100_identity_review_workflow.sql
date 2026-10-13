-- An approved ID belongs to the customer, not to a single order. Keep the
-- staff decision auditable and allow a successfully delivered order to prove
-- that the recipient can receive future deliveries.
alter table public.game_id_validations
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

create index if not exists game_id_validations_review_queue_idx
  on public.game_id_validations(status, last_checked_at desc);

create or replace function public.review_game_id_validation(
  p_validation_id uuid,
  p_status text,
  p_actor_id uuid,
  p_note text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare previous_status text;
begin
  if p_status not in ('ready', 'blocked') then
    raise exception 'invalid validation review status';
  end if;

  select status into previous_status
  from public.game_id_validations
  where id = p_validation_id
  for update;

  if previous_status is null then return false; end if;

  update public.game_id_validations
  set status = p_status,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      last_checked_at = now()
  where id = p_validation_id;

  insert into public.audit_log(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id,
    'delivery_identity.reviewed',
    'game_id_validation',
    p_validation_id::text,
    jsonb_build_object('status', previous_status),
    jsonb_strip_nulls(jsonb_build_object('status', p_status, 'notes', nullif(trim(coalesce(p_note, '')), '')))
  );
  return true;
end;
$$;

-- Keep the current staff payment workflow and add the delivery proof rule.
create or replace function public.transition_order(p_order_id uuid, p_from text, p_to text, p_metadata jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare changed integer;
declare actor uuid;
declare recipient_validation uuid;
declare validation_previous_status text;
begin
  if not public.is_valid_order_transition(p_from::public.order_status, p_to::public.order_status) then
    raise exception 'invalid order transition from % to %', p_from, p_to;
  end if;
  begin actor := nullif(p_metadata->>'actor_id', '')::uuid; exception when others then actor := null; end;
  update public.orders set status = p_to::public.order_status, metadata = metadata || (p_metadata - 'actor_id'), updated_at = now(),
    paid_at = case when p_to = 'paid' and paid_at is null then now() else paid_at end,
    delivered_at = case when p_to = 'delivered' and delivered_at is null then now() else delivered_at end
  where id = p_order_id and status = p_from::public.order_status
  returning recipient_validation_id into recipient_validation;
  get diagnostics changed = row_count;
  if changed = 1 then
    if p_from = 'receipt_submitted' and p_to = 'transfer_review'
      and not exists (select 1 from public.transfer_receipts where order_id = p_order_id) then
      raise exception 'receipt_required';
    end if;
    if p_to in ('information_required', 'paid', 'rejected') then
      update public.transfer_receipts set reviewed_by = actor, reviewed_at = now()
      where id = (
        select id from public.transfer_receipts where order_id = p_order_id
        order by created_at desc limit 1
      );
    end if;
    if p_to = 'paid' then
      insert into public.payments (order_id, provider, status, amount_mxn_cents, provider_payload, confirmed_at)
      select id, 'bank_transfer', 'approved', amount_mxn_cents,
        jsonb_build_object('confirmation', 'staff', 'actor_id', actor), now()
      from public.orders
      where id = p_order_id
        and not exists (select 1 from public.payments where order_id = p_order_id and status = 'approved');
    end if;
    if p_to = 'delivered' and recipient_validation is not null then
      select status into validation_previous_status
      from public.game_id_validations where id = recipient_validation for update;
      if validation_previous_status is not null and validation_previous_status <> 'ready' then
        update public.game_id_validations
        set status = 'ready',
            reviewed_by = coalesce(reviewed_by, actor),
            reviewed_at = coalesce(reviewed_at, now()),
            review_note = coalesce(review_note, 'ID validado automáticamente tras una entrega completada.'),
            last_checked_at = now()
        where id = recipient_validation;
        insert into public.audit_log(actor_id, action, entity_type, entity_id, before_data, after_data)
        values (actor, 'delivery_identity.proven_by_delivery', 'game_id_validation', recipient_validation::text,
          jsonb_build_object('status', validation_previous_status),
          jsonb_build_object('status', 'ready', 'reason', 'order_delivered'));
      end if;
    end if;
    insert into public.audit_log(actor_id, action, entity_type, entity_id, before_data, after_data)
    values (actor, 'order.transition', 'order', p_order_id::text,
      jsonb_build_object('status', p_from),
      jsonb_strip_nulls(jsonb_build_object('status', p_to, 'notes', p_metadata->>'notes')));
  end if;
  return changed = 1;
end;
$$;
