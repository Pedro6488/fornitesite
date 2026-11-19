-- Fase 3 de pavos: pausa automática del pago con pavos, devolución inmediata con la emisora caída,
-- teléfono del cliente para avisarle por WhatsApp y resumen para el admin.
-- No se envían correos: la tienda no tiene correo configurado. Los avisos se ven en el sitio y el
-- admin avisa al cliente con botones de WhatsApp que llevan el mensaje escrito.

-- Una sola fila: cuando la cuenta emisora falla (sin paVos, sin cupo, FN Shop caído) se pausa
-- el pago con pavos para no cobrar y devolver en ciclo.
create table public.wallet_settings (
  id boolean primary key default true check (id),
  paused_until timestamptz,
  pause_reason text,
  updated_at timestamptz not null default now()
);
insert into public.wallet_settings default values;
alter table public.wallet_settings enable row level security;
revoke all on public.wallet_settings from anon, authenticated;
grant all on public.wallet_settings to service_role;

create function public.pause_wallet_payments(p_minutes integer, p_reason text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare until timestamptz;
begin
  update public.wallet_settings
    set paused_until = greatest(coalesce(paused_until, now()), now() + make_interval(mins => greatest(1, least(p_minutes, 1440)))),
        pause_reason = left(coalesce(nullif(trim(p_reason), ''), 'Falla de la cuenta emisora'), 300), updated_at = now()
    where id returning paused_until into until;
  return until;
end; $$;

create function public.wallet_payments_paused()
returns boolean language sql security definer set search_path='' stable as $$
  select exists(select 1 from public.wallet_settings where paused_until > now());
$$;

create function public.resume_wallet_payments(p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'not_admin'; end if;
  update public.wallet_settings set paused_until=null, pause_reason=null, updated_at=now() where id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id) values(p_actor,'wallet.resume','wallet_settings','global');
  return true;
end; $$;

-- Compra con pavos: igual que la fase 2, más la pausa.
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

-- Devoluciones: igual que antes. Con p_include_unattempted (la cuenta emisora está caída) también se
-- devuelven al instante los objetos que nunca se intentaron: no tienen fila en fulfillments, así que
-- es seguro que no se regalaron. Sin esto, cada pasada del cron intentaba y devolvía un solo objeto.
drop function public.refund_wallet_failures(uuid);
create function public.refund_wallet_failures(p_order uuid, p_include_unattempted boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; i record; total integer:=0; n integer; resolved integer;
begin
  select * into o from public.orders where id=p_order for update;
  if o.payment_source<>'wallet' or o.status<>'manual_review' then return 0; end if;
  for i in select oi.id,oi.vbucks_price*oi.quantity as cost from public.order_items oi
    where oi.order_id=o.id and not oi.wallet_refunded and (
      exists(select 1 from public.fulfillments f where f.order_item_id=oi.id and f.status='failed'
        and (f.result_code in ('receiver_account_not_found','catalog_out_of_date','purchase_not_allowed',
          'receiver_owns_item_from_bundle','receiver_will_not_accept_gifts','final_price_not_match',
          'invalid_sender_account','account_not_in_group','no_accounts_in_group','plan_limit_reached','not_eligible_to_receive_gift')
          or f.result_code like 'not_sent:%'))
      or (p_include_unattempted and not exists(select 1 from public.fulfillments f where f.order_item_id=oi.id)))
    order by oi.created_at, oi.id
    for update of oi
  loop
    insert into public.wallet_ledger(user_id,delta,kind,order_id,order_item_id) values(o.user_id,i.cost,'refund',o.id,i.id);
    update public.order_items set wallet_refunded=true where id=i.id;
    total:=total+i.cost;
  end loop;
  if total>0 then update public.wallet_accounts set balance=balance+total,updated_at=now() where user_id=o.user_id; end if;
  select count(*),count(*) filter(where oi.wallet_refunded or f.status in ('sent','delivered')) into n,resolved
    from public.order_items oi left join public.fulfillments f on f.order_item_id=oi.id where oi.order_id=o.id;
  if n>0 and resolved=n then
    update public.orders set status=case when not exists(select 1 from public.order_items where order_id=o.id and not wallet_refunded)
      then 'refunded'::public.order_status else 'delivered'::public.order_status end,
      metadata=metadata||jsonb_build_object('notes','Los pavos de los objetos no enviados se devolvieron al saldo.'),updated_at=now() where id=o.id;
  end if;
  if total>0 then insert into public.audit_log(action,entity_type,entity_id,after_data)
    values('wallet.refund','order',o.id::text,jsonb_build_object('vbucks',total)); end if;
  return total;
end; $$;

-- Totales del admin con el WhatsApp del cliente (último pedido o, si no hay, su sesión),
-- para avisarle de recargas, entregas y devoluciones con un botón.
create or replace view public.wallet_customer_totals as
select a.user_id,a.balance,a.updated_at,p.email,
  coalesce(sum(l.delta) filter(where l.kind='topup'),0)::bigint as purchased,
  coalesce(-sum(l.delta) filter(where l.kind='purchase'),0)::bigint as spent,
  coalesce(sum(l.delta) filter(where l.kind='refund'),0)::bigint as refunded,
  coalesce(sum(l.delta) filter(where l.kind='adjustment'),0)::bigint as adjusted,
  a.frozen,a.frozen_reason,
  coalesce(
    (select o.contact_whatsapp from public.orders o where o.user_id=a.user_id and nullif(o.contact_whatsapp,'') is not null order by o.created_at desc limit 1),
    (select s.whatsapp from public.commerce_sessions s where s.user_id=a.user_id and nullif(s.whatsapp,'') is not null order by s.last_seen_at desc nulls last limit 1)
  ) as whatsapp
from public.wallet_accounts a left join public.profiles p on p.id=a.user_id
left join public.wallet_ledger l on l.user_id=a.user_id group by a.user_id,p.email;

-- Resumen del admin. "Hoy" es el día de Ciudad de México.
create function public.wallet_admin_summary()
returns table(liability bigint, accounts bigint, frozen_accounts bigint, spent_today bigint, refunded_today bigint,
  credited_today bigint, pending_topups bigint, attention_jobs bigint, paused_until timestamptz, pause_reason text)
language sql security definer set search_path='' stable as $$
  with today as (select (date_trunc('day', now() at time zone 'America/Mexico_City')) at time zone 'America/Mexico_City' as since)
  select
    (select coalesce(sum(balance),0) from public.wallet_accounts)::bigint,
    (select count(*) from public.wallet_accounts where balance > 0)::bigint,
    (select count(*) from public.wallet_accounts where frozen)::bigint,
    (select coalesce(-sum(delta),0) from public.wallet_ledger, today where kind='purchase' and created_at >= today.since)::bigint,
    (select coalesce(sum(delta),0) from public.wallet_ledger, today where kind='refund' and created_at >= today.since)::bigint,
    (select coalesce(sum(delta),0) from public.wallet_ledger, today where kind='topup' and created_at >= today.since)::bigint,
    (select count(*) from public.wallet_topups where status='submitted')::bigint,
    (select count(*) from public.outbox_jobs where job_type='wallet.deliver' and status in ('pending','processing','failed') and (status='failed' or attempts>3))::bigint,
    (select s.paused_until from public.wallet_settings s where s.paused_until > now()),
    (select s.pause_reason from public.wallet_settings s where s.paused_until > now());
$$;

revoke all on function public.pause_wallet_payments(integer,text),public.resume_wallet_payments(uuid),public.wallet_payments_paused(),
  public.refund_wallet_failures(uuid,boolean),public.wallet_admin_summary() from public,anon,authenticated;
grant execute on function public.pause_wallet_payments(integer,text),public.resume_wallet_payments(uuid),public.wallet_payments_paused(),
  public.refund_wallet_failures(uuid,boolean),public.wallet_admin_summary() to service_role;
