-- Internal store credit. All monetary mutations run through service-only transactions.
create table public.wallet_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table public.wallet_rates (
  region text primary key check (region in ('mx','us')),
  cents_per_100 integer check (cents_per_100 > 0 and cents_per_100 <= 1000000),
  active boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.wallet_rates(region) values ('mx'),('us');
create table public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wallet_accounts(user_id),
  vbucks integer not null check (vbucks between 100 and 50000 and vbucks % 100 = 0),
  region text not null references public.wallet_rates(region),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','submitted','approved','rejected')),
  idempotency_key uuid not null unique,
  receipt_path text,
  receipt_checksum text unique,
  reviewed_by uuid references auth.users(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.orders add column payment_source text not null default 'external' check (payment_source in ('external','wallet'));
alter table public.orders add column wallet_vbucks integer check (wallet_vbucks > 0);
alter table public.order_items add column wallet_refunded boolean not null default false;
create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wallet_accounts(user_id),
  delta integer not null check (delta <> 0),
  kind text not null check (kind in ('topup','purchase','refund')),
  topup_id uuid unique references public.wallet_topups(id),
  order_id uuid references public.orders(id),
  order_item_id uuid unique references public.order_items(id),
  created_at timestamptz not null default now(),
  check ((kind = 'topup' and delta > 0 and topup_id is not null and order_id is null and order_item_id is null)
    or (kind = 'purchase' and delta < 0 and order_id is not null and topup_id is null and order_item_id is null)
    or (kind = 'refund' and delta > 0 and order_id is not null and order_item_id is not null and topup_id is null))
);
create unique index wallet_purchase_unique on public.wallet_ledger(order_id) where kind = 'purchase';
create index wallet_ledger_user_date on public.wallet_ledger(user_id,created_at desc);
create index wallet_topups_status on public.wallet_topups(status,created_at desc);
create index wallet_orders_user on public.orders(user_id,created_at desc) where payment_source='wallet';
alter table public.wallet_accounts enable row level security;
alter table public.wallet_rates enable row level security;
alter table public.wallet_topups enable row level security;
alter table public.wallet_ledger enable row level security;
revoke all on public.wallet_accounts,public.wallet_rates,public.wallet_topups,public.wallet_ledger from anon, authenticated;
grant all on public.wallet_accounts,public.wallet_rates,public.wallet_topups,public.wallet_ledger to service_role;
create view public.wallet_customer_totals as
select a.user_id,a.balance,a.updated_at,p.email,
  coalesce(sum(l.delta) filter(where l.kind='topup'),0)::bigint as purchased,
  coalesce(-sum(l.delta) filter(where l.kind='purchase'),0)::bigint as spent,
  coalesce(sum(l.delta) filter(where l.kind='refund'),0)::bigint as refunded
from public.wallet_accounts a left join public.profiles p on p.id=a.user_id
left join public.wallet_ledger l on l.user_id=a.user_id group by a.user_id,p.email;
revoke all on public.wallet_customer_totals from public,anon,authenticated;
grant select on public.wallet_customer_totals to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('wallet-receipts','wallet-receipts',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

create function public.create_wallet_topup(p_user uuid,p_region text,p_vbucks integer,p_expected_cents integer,p_key uuid)
returns public.wallet_topups language plpgsql security definer set search_path='' as $$
declare r public.wallet_rates%rowtype; t public.wallet_topups%rowtype; cost integer;
begin
  if p_user is null or p_key is null or p_vbucks is null or p_vbucks < 100 or p_vbucks > 50000 or p_vbucks % 100 <> 0 then raise exception 'invalid_topup'; end if;
  insert into public.wallet_accounts(user_id) values(p_user) on conflict do nothing;
  perform 1 from public.wallet_accounts where user_id=p_user for update;
  select * into t from public.wallet_topups where idempotency_key=p_key;
  if t.id is not null then
    if t.user_id<>p_user or t.region<>p_region or t.vbucks<>p_vbucks or t.amount_cents<>p_expected_cents then raise exception 'idempotency_mismatch'; end if;
    return t;
  end if;
  select * into r from public.wallet_rates where region=p_region for share;
  if r.region is null or not r.active or r.cents_per_100 is null then raise exception 'rate_disabled'; end if;
  cost := (p_vbucks / 100) * r.cents_per_100;
  if p_expected_cents is distinct from cost then raise exception 'rate_changed'; end if;
  insert into public.wallet_topups(user_id,region,vbucks,amount_cents,idempotency_key)
  values(p_user,p_region,p_vbucks,cost,p_key) returning * into t;
  return t;
end; $$;

create function public.review_wallet_topup(p_id uuid,p_actor uuid,p_approve boolean,p_note text)
returns boolean language plpgsql security definer set search_path='' as $$
declare t public.wallet_topups%rowtype;
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'not_admin'; end if;
  select * into t from public.wallet_topups where id=p_id for update;
  if t.id is null then raise exception 'not_found'; end if;
  if t.status=(case when p_approve then 'approved' else 'rejected' end) then return false; end if;
  if t.status<>'submitted' or t.receipt_path is null then raise exception 'receipt_required'; end if;
  if not p_approve and length(trim(coalesce(p_note,''))) < 5 then raise exception 'reason_required'; end if;
  if p_approve then
    update public.wallet_accounts set balance=balance+t.vbucks,updated_at=now() where user_id=t.user_id;
    insert into public.wallet_ledger(user_id,delta,kind,topup_id) values(t.user_id,t.vbucks,'topup',t.id);
  end if;
  update public.wallet_topups set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=t.id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,after_data)
  values(p_actor,'wallet.topup.review','wallet_topup',t.id::text,jsonb_build_object('approved',p_approve,'vbucks',t.vbucks));
  return true;
end; $$;

create function public.create_wallet_order(p_user uuid,p_session uuid,p_quote uuid,p_validation uuid,p_whatsapp text,p_email text,p_key text)
returns table(order_id uuid,public_token uuid) language plpgsql security definer set search_path='' as $$
declare q public.checkout_quotes%rowtype; o public.orders%rowtype; b integer; cost integer; made record;
begin
  if p_user is null or not exists(select 1 from public.commerce_sessions where id=p_session and user_id=p_user and merged_into is null) then raise exception 'login_required'; end if;
  insert into public.wallet_accounts(user_id) values(p_user) on conflict do nothing;
  select balance into b from public.wallet_accounts where user_id=p_user for update;
  select * into o from public.orders where idempotency_key=p_key;
  if o.id is not null then
    if o.user_id<>p_user or o.payment_source<>'wallet' or o.checkout_quote_id<>p_quote or o.recipient_validation_id<>p_validation then raise exception 'idempotency_mismatch'; end if;
    return query select o.id,o.public_token; return;
  end if;
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

-- Only definitive rejections (never unknown/history-not-found) can be refunded.
-- Lock the order before checking fulfillment so a concurrent retry cannot race a refund.
create function public.refund_wallet_failures(p_order uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; i record; total integer:=0; n integer; resolved integer;
begin
  select * into o from public.orders where id=p_order for update;
  if o.payment_source<>'wallet' or o.status<>'manual_review' then return 0; end if;
  for i in select oi.id,oi.vbucks_price*oi.quantity as cost from public.order_items oi
    join public.fulfillments f on f.order_item_id=oi.id
    where oi.order_id=o.id and not oi.wallet_refunded and f.status='failed'
    and (f.result_code in ('receiver_account_not_found','catalog_out_of_date','purchase_not_allowed',
      'receiver_owns_item_from_bundle','receiver_will_not_accept_gifts','final_price_not_match',
      'invalid_sender_account','account_not_in_group','no_accounts_in_group','plan_limit_reached','not_eligible_to_receive_gift')
      or f.result_code like 'not_sent:%')
    for update of oi,f
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

create function public.claim_wallet_job(p_order uuid default null)
returns setof public.outbox_jobs language plpgsql security definer set search_path='' as $$
begin
  return query with candidate as (
    select id from public.outbox_jobs where job_type='wallet.deliver'
      and (p_order is null or aggregate_id=p_order)
      and ((status='pending' and available_at<=now()) or (status='processing' and locked_at<now()-interval '5 minutes'))
      order by available_at for update skip locked limit 1
  ) update public.outbox_jobs j set status='processing',locked_at=now(),attempts=attempts+1,updated_at=now()
    from candidate c where j.id=c.id returning j.*;
end; $$;
revoke all on function public.claim_wallet_job(uuid) from public,anon,authenticated;
grant execute on function public.claim_wallet_job(uuid) to service_role;

create function public.claim_wallet_delivery_item(p_order uuid,p_item uuid,p_receiver text,p_receiver_id text,p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; claimed uuid;
begin
  select * into o from public.orders where id=p_order for update;
  if o.payment_source<>'wallet' or o.status<>'delivering' then return false; end if;
  if not exists(select 1 from public.order_items where id=p_item and order_id=o.id and not wallet_refunded) then return false; end if;
  insert into public.fulfillments(order_id,order_item_id,provider,attempts,offer_id,receiver,receiver_id,actor_id,status,started_at)
  select o.id,oi.id,'fnshop',1,oi.offer_id,p_receiver,p_receiver_id,p_actor,'sending',now() from public.order_items oi where oi.id=p_item
  on conflict (order_item_id) where order_item_id is not null do update set status='sending',started_at=now(),finished_at=null,
    attempts=public.fulfillments.attempts+1,updated_at=now(),result_code=null,last_error=null
  where public.fulfillments.status='failed'
  returning id into claimed;
  return claimed is not null;
end; $$;

revoke all on function public.claim_wallet_delivery_item(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_wallet_delivery_item(uuid,uuid,text,text,uuid) to service_role;
revoke all on function public.create_wallet_topup(uuid,text,integer,integer,uuid),public.review_wallet_topup(uuid,uuid,boolean,text),
  public.create_wallet_order(uuid,uuid,uuid,uuid,text,text,text),public.refund_wallet_failures(uuid) from public,anon,authenticated;
grant execute on function public.create_wallet_topup(uuid,text,integer,integer,uuid),public.review_wallet_topup(uuid,uuid,boolean,text),
  public.create_wallet_order(uuid,uuid,uuid,uuid,text,text,text),public.refund_wallet_failures(uuid) to service_role;
