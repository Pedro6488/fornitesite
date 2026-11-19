-- Fase 4 de pavos: precio coherente entre pago habitual y pavos.
-- Política: 1 pavo de la tienda = 1 pavo del precio de Fortnite. Un precio especial (override en MXN)
-- no se traslada a pavos, así que el admin decide por objeto si se puede pagar con pavos.
alter table public.offer_price_overrides add column wallet_allowed boolean not null default true;

-- Objetos de una cotización que no se pueden pagar con pavos (precio especial vigente con wallet_allowed=false).
create function public.wallet_blocked_items(p_main_ids text[])
returns setof text language sql security definer set search_path='' stable as $$
  select distinct po.main_id from public.offer_price_overrides po
  where po.main_id = any(p_main_ids) and po.active and not po.wallet_allowed
    and po.effective_from <= now() and (po.effective_until is null or po.effective_until > now());
$$;
revoke all on function public.wallet_blocked_items(text[]) from public,anon,authenticated;
grant execute on function public.wallet_blocked_items(text[]) to service_role;

-- Compra con pavos: igual que la fase 3, más el rechazo de objetos que no admiten pavos.
create or replace function public.create_wallet_order(p_user uuid,p_session uuid,p_quote uuid,p_validation uuid,p_whatsapp text,p_email text,p_key text)
returns table(order_id uuid,public_token uuid) language plpgsql security definer set search_path='' as $$
declare q public.checkout_quotes%rowtype; o public.orders%rowtype; b integer; f boolean; cost integer; made record;
begin
  if p_user is null or not exists(select 1 from public.commerce_sessions where id=p_session and user_id=p_user and merged_into is null) then raise exception 'login_required'; end if;
  insert into public.wallet_accounts(user_id) values(p_user) on conflict do nothing;
  select balance,frozen into b,f from public.wallet_accounts where user_id=p_user for update;
  select * into o from public.orders where idempotency_key=p_key;
  if o.id is not null then
    if o.user_id<>p_user or o.payment_source<>'wallet' or o.checkout_quote_id<>p_quote or o.recipient_validation_id<>p_validation then raise exception 'idempotency_mismatch'; end if;
    return query select o.id,o.public_token; return;
  end if;
  if f then raise exception 'account_frozen'; end if;
  if exists(select 1 from public.wallet_settings where paused_until > now()) then raise exception 'wallet_paused'; end if;
  select * into q from public.checkout_quotes where id=p_quote and commerce_session_id=p_session for update;
  if q.id is null or q.consumed_at is not null or q.expires_at<=now() then raise exception 'quote_expired'; end if;
  if exists(select 1 from public.wallet_blocked_items(array(select item_main_id from public.checkout_quote_items where quote_id=q.id))) then
    raise exception 'wallet_not_allowed';
  end if;
  select sum(vbucks_price*quantity) into cost from public.checkout_quote_items where quote_id=q.id;
  if cost is null or cost <= 0 or cost<>q.total_vbucks then raise exception 'empty_quote'; end if;
  if b < cost then raise exception 'insufficient_balance'; end if;
  select * into made from public.create_order_from_quote(p_quote,p_validation,p_whatsapp,p_email,p_key);
  update public.orders set user_id=p_user,payment_source='wallet',wallet_vbucks=cost,status='paid',paid_at=now(),
    supervisor_status='payment_received',paypal_fee_usd_cents=null,updated_at=now() where id=made.order_id;
  update public.wallet_accounts set balance=balance-cost,updated_at=now() where user_id=p_user;
  insert into public.wallet_ledger(user_id,delta,kind,order_id) values(p_user,-cost,'purchase',made.order_id);
  insert into public.outbox_jobs(job_type,aggregate_id,payload,dedupe_key)
  values('wallet.deliver',made.order_id,jsonb_build_object('orderId',made.order_id),'wallet:deliver:'||made.order_id::text);
  insert into public.audit_log(actor_id,action,entity_type,entity_id,after_data)
  values(p_user,'wallet.purchase','order',made.order_id::text,jsonb_build_object('vbucks',cost));
  return query select made.order_id,made.public_token;
end; $$;
