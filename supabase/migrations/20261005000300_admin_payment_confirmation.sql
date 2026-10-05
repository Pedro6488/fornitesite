-- Staff may confirm a bank transfer from the operations panel even when the
-- customer delivered proof through another channel instead of uploading it.
create or replace function public.is_valid_order_transition(p_from public.order_status, p_to public.order_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'draft' then p_to in ('payment_pending', 'awaiting_transfer', 'canceled')
    when 'payment_pending' then p_to in ('paid', 'rejected', 'expired', 'canceled')
    when 'awaiting_transfer' then p_to in ('receipt_submitted', 'paid', 'expired', 'canceled')
    when 'receipt_submitted' then p_to in ('transfer_review', 'paid')
    when 'transfer_review' then p_to in ('information_required', 'paid', 'rejected')
    when 'information_required' then p_to in ('receipt_submitted', 'paid', 'rejected', 'canceled')
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
    insert into public.audit_log(actor_id, action, entity_type, entity_id, before_data, after_data)
    values (actor, 'order.transition', 'order', p_order_id::text,
      jsonb_build_object('status', p_from),
      jsonb_strip_nulls(jsonb_build_object('status', p_to, 'notes', p_metadata->>'notes')));
  end if;
  return changed = 1;
end;
$$;
