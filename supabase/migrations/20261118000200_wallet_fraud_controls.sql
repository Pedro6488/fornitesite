-- Fase 2 de pavos: congelar cuentas, ajustes manuales con motivo y referencia de pago por recarga.

-- Congelar una cuenta bloquea sus compras con pavos (contracargo, cuenta robada, error en revisión).
alter table public.wallet_accounts
  add column frozen boolean not null default false,
  add column frozen_reason text,
  add column frozen_at timestamptz,
  add column frozen_by uuid references auth.users(id);

-- Ajustes manuales: entrada o salida de saldo hecha por un admin, siempre con motivo y autor.
alter table public.wallet_ledger add column reason text, add column actor_id uuid references auth.users(id);
alter table public.wallet_ledger drop constraint wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check check (kind in ('topup','purchase','refund','adjustment'));
alter table public.wallet_ledger drop constraint wallet_ledger_check;
alter table public.wallet_ledger add constraint wallet_ledger_check check (
  (kind = 'topup' and delta > 0 and topup_id is not null and order_id is null and order_item_id is null)
  or (kind = 'purchase' and delta < 0 and order_id is not null and topup_id is null and order_item_id is null)
  or (kind = 'refund' and delta > 0 and order_id is not null and order_item_id is not null and topup_id is null)
  or (kind = 'adjustment' and actor_id is not null and length(trim(coalesce(reason,''))) >= 5
      and topup_id is null and order_item_id is null));

-- La referencia que el cliente escribe en el concepto de la transferencia o la nota de PayPal.
-- Es la misma que ya mostraba el panel (RECARGA- + primeros 8 caracteres del ID).
alter table public.wallet_topups add column reference_code text
  generated always as ('RECARGA-' || upper(left(id::text, 8))) stored;
create index wallet_topups_reference on public.wallet_topups(reference_code);

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
  select * into q from public.checkout_quotes where id=p_quote and commerce_session_id=p_session for update;
  if q.id is null or q.consumed_at is not null or q.expires_at<=now() then raise exception 'quote_expired'; end if;
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

create function public.adjust_wallet(p_user uuid,p_actor uuid,p_delta integer,p_reason text,p_order uuid default null)
returns integer language plpgsql security definer set search_path='' as $$
declare b integer;
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'not_admin'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 1000000 then raise exception 'invalid_adjustment'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'reason_required'; end if;
  if not exists(select 1 from auth.users where id=p_user) then raise exception 'not_found'; end if;
  insert into public.wallet_accounts(user_id) values(p_user) on conflict do nothing;
  select balance into b from public.wallet_accounts where user_id=p_user for update;
  -- Nunca saldo negativo: si ya se gastó, el admin congela la cuenta en lugar de dejar deuda.
  if b + p_delta < 0 then raise exception 'adjustment_exceeds_balance'; end if;
  update public.wallet_accounts set balance=balance+p_delta,updated_at=now() where user_id=p_user;
  insert into public.wallet_ledger(user_id,delta,kind,order_id,reason,actor_id) values(p_user,p_delta,'adjustment',p_order,trim(p_reason),p_actor);
  insert into public.audit_log(actor_id,action,entity_type,entity_id,before_data,after_data)
  values(p_actor,'wallet.adjust','wallet_account',p_user::text,jsonb_build_object('balance',b),
    jsonb_build_object('balance',b+p_delta,'delta',p_delta,'reason',trim(p_reason)));
  return b + p_delta;
end; $$;

create function public.set_wallet_frozen(p_user uuid,p_actor uuid,p_frozen boolean,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'not_admin'; end if;
  if p_frozen and length(trim(coalesce(p_reason,''))) < 5 then raise exception 'reason_required'; end if;
  if not exists(select 1 from auth.users where id=p_user) then raise exception 'not_found'; end if;
  insert into public.wallet_accounts(user_id) values(p_user) on conflict do nothing;
  update public.wallet_accounts set frozen=p_frozen,
    frozen_reason=case when p_frozen then trim(p_reason) else null end,
    frozen_at=case when p_frozen then now() else null end,
    frozen_by=case when p_frozen then p_actor else null end,
    updated_at=now() where user_id=p_user;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,after_data)
  values(p_actor,case when p_frozen then 'wallet.freeze' else 'wallet.unfreeze' end,'wallet_account',p_user::text,
    jsonb_build_object('reason',nullif(trim(coalesce(p_reason,'')),'')));
  return p_frozen;
end; $$;

revoke all on function public.adjust_wallet(uuid,uuid,integer,text,uuid),public.set_wallet_frozen(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.adjust_wallet(uuid,uuid,integer,text,uuid),public.set_wallet_frozen(uuid,uuid,boolean,text) to service_role;

-- Totales del admin: se agregan los ajustes y el estado de congelamiento (columnas al final).
create or replace view public.wallet_customer_totals as
select a.user_id,a.balance,a.updated_at,p.email,
  coalesce(sum(l.delta) filter(where l.kind='topup'),0)::bigint as purchased,
  coalesce(-sum(l.delta) filter(where l.kind='purchase'),0)::bigint as spent,
  coalesce(sum(l.delta) filter(where l.kind='refund'),0)::bigint as refunded,
  coalesce(sum(l.delta) filter(where l.kind='adjustment'),0)::bigint as adjusted,
  a.frozen,a.frozen_reason
from public.wallet_accounts a left join public.profiles p on p.id=a.user_id
left join public.wallet_ledger l on l.user_id=a.user_id group by a.user_id,p.email;
