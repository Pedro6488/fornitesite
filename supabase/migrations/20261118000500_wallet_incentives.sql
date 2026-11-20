-- Fase 5 de pavos: tarifa por volumen, bonos por campaña y guardia de margen.
--
-- Tramo:  "desde X pavos, $Y por 100". Aplica el tramo válido más alto que alcance la recarga;
--         sin tramo, la tarifa base de wallet_rates.
-- Bono:   "+N % de regalo desde X pavos", con vigencia, tope opcional y opción de solo primera
--         recarga. Si coinciden varios, se aplica el mayor; no se acumulan.
-- Margen: un tramo o bono solo es válido si el precio efectivo (ya con el bono) queda arriba de
--         costo × (1 + margen mínimo) en todos los niveles de precio que puede alcanzar. Sin costo
--         capturado, ningún tramo ni bono es válido. La misma regla se usa al guardar, al mostrar
--         las ofertas al cliente y al crear la recarga.

alter table public.wallet_rates
  add column cost_cents_per_100 integer check (cost_cents_per_100 > 0 and cost_cents_per_100 <= 1000000),
  add column min_margin_bp integer not null default 0 check (min_margin_bp between 0 and 10000);

create table public.wallet_rate_tiers (
  id uuid primary key default gen_random_uuid(),
  region text not null references public.wallet_rates(region),
  min_vbucks integer not null check (min_vbucks between 100 and 50000 and min_vbucks % 100 = 0),
  cents_per_100 integer not null check (cents_per_100 > 0 and cents_per_100 <= 1000000),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (region, min_vbucks)
);

create table public.wallet_bonus_rules (
  id uuid primary key default gen_random_uuid(),
  region text not null references public.wallet_rates(region),
  label text not null check (length(trim(label)) between 3 and 80),
  min_vbucks integer not null check (min_vbucks between 100 and 50000 and min_vbucks % 100 = 0),
  bonus_bp integer not null check (bonus_bp between 1 and 5000),
  bonus_cap integer check (bonus_cap > 0),
  first_topup_only boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.wallet_rate_tiers enable row level security;
alter table public.wallet_bonus_rules enable row level security;
revoke all on public.wallet_rate_tiers, public.wallet_bonus_rules from anon, authenticated;
grant all on public.wallet_rate_tiers, public.wallet_bonus_rules to service_role;

-- El bono y el tramo se fijan al crear la recarga: el cliente recibe lo que vio aunque la campaña termine.
alter table public.wallet_topups
  add column bonus_vbucks integer not null default 0 check (bonus_vbucks >= 0),
  add column bonus_rule_id uuid references public.wallet_bonus_rules(id),
  add column tier_id uuid references public.wallet_rate_tiers(id) on delete set null;

-- El bono se acredita como movimiento propio, ligado a la misma recarga.
alter table public.wallet_ledger drop constraint wallet_ledger_topup_id_key;
alter table public.wallet_ledger add constraint wallet_ledger_topup_kind_key unique (topup_id, kind);
alter table public.wallet_ledger drop constraint wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check check (kind in ('topup','purchase','refund','adjustment','bonus'));
alter table public.wallet_ledger drop constraint wallet_ledger_check;
alter table public.wallet_ledger add constraint wallet_ledger_check check (
  (kind in ('topup','bonus') and delta > 0 and topup_id is not null and order_id is null and order_item_id is null)
  or (kind = 'purchase' and delta < 0 and order_id is not null and topup_id is null and order_item_id is null)
  or (kind = 'refund' and delta > 0 and order_id is not null and order_item_id is not null and topup_id is null)
  or (kind = 'adjustment' and actor_id is not null and length(trim(coalesce(reason,''))) >= 5
      and topup_id is null and order_item_id is null));

-- Un tramo es válido si su precio por 100 cubre costo × (1 + margen).
create function public.wallet_tier_valid(p_region text, p_cents integer)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select r.cost_cents_per_100 is not null and p_cents is not null
      and p_cents::numeric * 10000 >= r.cost_cents_per_100::numeric * (10000 + r.min_margin_bp)
    from public.wallet_rates r where r.region = p_region), false);
$$;

-- Precio por 100 que paga una recarga de p_vbucks: el tramo válido más alto que alcanza, o la base.
create function public.wallet_price_per_100(p_region text, p_vbucks integer)
returns table(cents_per_100 integer, tier_id uuid) language sql stable security definer set search_path='' as $$
  select coalesce(t.cents_per_100, r.cents_per_100), t.id
  from public.wallet_rates r
  left join lateral (
    select x.id, x.cents_per_100 from public.wallet_rate_tiers x
    where x.region = r.region and x.active and x.min_vbucks <= p_vbucks and public.wallet_tier_valid(x.region, x.cents_per_100)
    order by x.min_vbucks desc limit 1
  ) t on true
  where r.region = p_region;
$$;

-- Un bono es válido si, con el bono completo, todos los niveles de precio alcanzables desde su
-- mínimo siguen cubriendo costo × (1 + margen). El tope solo reduce el bono, así que es el peor caso.
create function public.wallet_bonus_valid(p_region text, p_min integer, p_bp integer)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select r.cost_cents_per_100 is not null and not exists (
      select 1 from (
        select (select w.cents_per_100 from public.wallet_price_per_100(p_region, p_min) w) as price
        union all
        select x.cents_per_100 from public.wallet_rate_tiers x
        where x.region = p_region and x.active and x.min_vbucks > p_min and public.wallet_tier_valid(x.region, x.cents_per_100)
      ) levels
      where levels.price is null
        or levels.price::numeric * 100000000 < r.cost_cents_per_100::numeric * (10000 + r.min_margin_bp) * (10000 + p_bp))
    from public.wallet_rates r where r.region = p_region), false);
$$;

-- Lo que paga y recibe una recarga, con las mismas reglas que verá el cliente.
create function public.wallet_topup_quote(p_user uuid, p_region text, p_vbucks integer)
returns table(amount_cents integer, cents_per_100 integer, tier_id uuid, bonus_vbucks integer, bonus_rule_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare r public.wallet_rates%rowtype; price record; bonus record;
begin
  select * into r from public.wallet_rates where region = p_region;
  if r.region is null or not r.active or r.cents_per_100 is null then raise exception 'rate_disabled'; end if;
  select * into price from public.wallet_price_per_100(p_region, p_vbucks);
  select x.id, least(floor(p_vbucks::numeric * x.bonus_bp / 10000)::integer, coalesce(x.bonus_cap, 2147483647)) as amount into bonus
    from public.wallet_bonus_rules x
    where x.region = p_region and x.active and x.starts_at <= now() and x.ends_at > now() and x.min_vbucks <= p_vbucks
      and (not x.first_topup_only or not exists(select 1 from public.wallet_topups t where t.user_id = p_user and t.status = 'approved'))
      and public.wallet_bonus_valid(x.region, x.min_vbucks, x.bonus_bp)
    order by least(floor(p_vbucks::numeric * x.bonus_bp / 10000)::integer, coalesce(x.bonus_cap, 2147483647)) desc, x.id
    limit 1;
  return query select (p_vbucks / 100) * price.cents_per_100, price.cents_per_100, price.tier_id, coalesce(bonus.amount, 0), bonus.id;
end; $$;

-- Ofertas vigentes que el cliente puede ver: solo tramos y bonos válidos, igual que al cobrar.
create function public.wallet_offers(p_user uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'tiers', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'region', t.region, 'min_vbucks', t.min_vbucks, 'cents_per_100', t.cents_per_100) order by t.region, t.min_vbucks)
      from public.wallet_rate_tiers t join public.wallet_rates r on r.region = t.region
      where t.active and r.active and public.wallet_tier_valid(t.region, t.cents_per_100)), '[]'::jsonb),
    'bonuses', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'region', b.region, 'label', b.label, 'min_vbucks', b.min_vbucks, 'bonus_bp', b.bonus_bp,
        'bonus_cap', b.bonus_cap, 'first_topup_only', b.first_topup_only, 'ends_at', b.ends_at) order by b.region, b.min_vbucks)
      from public.wallet_bonus_rules b join public.wallet_rates r on r.region = b.region
      where b.active and r.active and b.starts_at <= now() and b.ends_at > now()
        and (not b.first_topup_only or p_user is null or not exists(select 1 from public.wallet_topups t where t.user_id = p_user and t.status = 'approved'))
        and public.wallet_bonus_valid(b.region, b.min_vbucks, b.bonus_bp)), '[]'::jsonb));
$$;

drop function public.create_wallet_topup(uuid,text,integer,integer,uuid);
create function public.create_wallet_topup(p_user uuid,p_region text,p_vbucks integer,p_expected_cents integer,p_key uuid,p_expected_bonus integer default 0)
returns public.wallet_topups language plpgsql security definer set search_path='' as $$
declare t public.wallet_topups%rowtype; q record;
begin
  if p_user is null or p_key is null or p_vbucks is null or p_vbucks < 100 or p_vbucks > 50000 or p_vbucks % 100 <> 0 then raise exception 'invalid_topup'; end if;
  insert into public.wallet_accounts(user_id) values(p_user) on conflict do nothing;
  perform 1 from public.wallet_accounts where user_id=p_user for update;
  select * into t from public.wallet_topups where idempotency_key=p_key;
  if t.id is not null then
    if t.user_id<>p_user or t.region<>p_region or t.vbucks<>p_vbucks or t.amount_cents<>p_expected_cents or t.bonus_vbucks<>coalesce(p_expected_bonus,0) then raise exception 'idempotency_mismatch'; end if;
    return t;
  end if;
  select * into q from public.wallet_topup_quote(p_user, p_region, p_vbucks);
  if p_expected_cents is distinct from q.amount_cents then raise exception 'rate_changed'; end if;
  if coalesce(p_expected_bonus,0) <> q.bonus_vbucks then raise exception 'promo_changed'; end if;
  insert into public.wallet_topups(user_id,region,vbucks,amount_cents,idempotency_key,bonus_vbucks,bonus_rule_id,tier_id)
  values(p_user,p_region,p_vbucks,q.amount_cents,p_key,q.bonus_vbucks,q.bonus_rule_id,q.tier_id) returning * into t;
  return t;
end; $$;

create or replace function public.review_wallet_topup(p_id uuid,p_actor uuid,p_approve boolean,p_note text)
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
    update public.wallet_accounts set balance=balance+t.vbucks+t.bonus_vbucks,updated_at=now() where user_id=t.user_id;
    insert into public.wallet_ledger(user_id,delta,kind,topup_id) values(t.user_id,t.vbucks,'topup',t.id);
    if t.bonus_vbucks > 0 then
      insert into public.wallet_ledger(user_id,delta,kind,topup_id) values(t.user_id,t.bonus_vbucks,'bonus',t.id);
    end if;
  end if;
  update public.wallet_topups set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=t.id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,after_data)
  values(p_actor,'wallet.topup.review','wallet_topup',t.id::text,jsonb_build_object('approved',p_approve,'vbucks',t.vbucks,'bonus',t.bonus_vbucks));
  return true;
end; $$;

create function public.save_wallet_tier(p_actor uuid,p_id uuid,p_region text,p_min integer,p_cents integer,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'not_admin'; end if;
  if p_active and not public.wallet_tier_valid(p_region,p_cents) then
    raise exception '%', case when (select cost_cents_per_100 from public.wallet_rates where region=p_region) is null then 'cost_required' else 'below_margin' end;
  end if;
  if p_id is null then
    insert into public.wallet_rate_tiers(region,min_vbucks,cents_per_100,active) values(p_region,p_min,p_cents,p_active)
    on conflict (region,min_vbucks) do update set cents_per_100=excluded.cents_per_100,active=excluded.active,updated_at=now()
    returning id into saved;
  else
    update public.wallet_rate_tiers set region=p_region,min_vbucks=p_min,cents_per_100=p_cents,active=p_active,updated_at=now()
      where id=p_id returning id into saved;
    if saved is null then raise exception 'not_found'; end if;
  end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,after_data)
  values(p_actor,'wallet.tier.save','wallet_rate_tier',saved::text,jsonb_build_object('region',p_region,'min_vbucks',p_min,'cents_per_100',p_cents,'active',p_active));
  return saved;
end; $$;

create function public.save_wallet_bonus(p_actor uuid,p_id uuid,p_region text,p_label text,p_min integer,p_bp integer,p_cap integer,
  p_first_only boolean,p_starts timestamptz,p_ends timestamptz,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved uuid;
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'not_admin'; end if;
  if p_active and not public.wallet_bonus_valid(p_region,p_min,p_bp) then
    raise exception '%', case when (select cost_cents_per_100 from public.wallet_rates where region=p_region) is null then 'cost_required' else 'below_margin' end;
  end if;
  if p_id is null then
    insert into public.wallet_bonus_rules(region,label,min_vbucks,bonus_bp,bonus_cap,first_topup_only,starts_at,ends_at,active,created_by)
    values(p_region,trim(p_label),p_min,p_bp,p_cap,p_first_only,coalesce(p_starts,now()),p_ends,p_active,p_actor) returning id into saved;
  else
    update public.wallet_bonus_rules set region=p_region,label=trim(p_label),min_vbucks=p_min,bonus_bp=p_bp,bonus_cap=p_cap,
      first_topup_only=p_first_only,starts_at=coalesce(p_starts,starts_at),ends_at=p_ends,active=p_active,updated_at=now()
      where id=p_id returning id into saved;
    if saved is null then raise exception 'not_found'; end if;
  end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,after_data)
  values(p_actor,'wallet.bonus.save','wallet_bonus_rule',saved::text,jsonb_build_object('region',p_region,'label',p_label,'min_vbucks',p_min,'bonus_bp',p_bp,'cap',p_cap,'first_only',p_first_only,'ends_at',p_ends,'active',p_active));
  return saved;
end; $$;

-- Totales del admin: se agrega lo regalado en bonos (columna al final).
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
  ) as whatsapp,
  coalesce(sum(l.delta) filter(where l.kind='bonus'),0)::bigint as bonus
from public.wallet_accounts a left join public.profiles p on p.id=a.user_id
left join public.wallet_ledger l on l.user_id=a.user_id group by a.user_id,p.email;

revoke all on function public.wallet_tier_valid(text,integer),public.wallet_price_per_100(text,integer),public.wallet_bonus_valid(text,integer,integer),
  public.wallet_topup_quote(uuid,text,integer),public.wallet_offers(uuid),
  public.create_wallet_topup(uuid,text,integer,integer,uuid,integer),public.review_wallet_topup(uuid,uuid,boolean,text),
  public.save_wallet_tier(uuid,uuid,text,integer,integer,boolean),
  public.save_wallet_bonus(uuid,uuid,text,text,integer,integer,integer,boolean,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.wallet_tier_valid(text,integer),public.wallet_price_per_100(text,integer),public.wallet_bonus_valid(text,integer,integer),
  public.wallet_topup_quote(uuid,text,integer),public.wallet_offers(uuid),
  public.create_wallet_topup(uuid,text,integer,integer,uuid,integer),public.review_wallet_topup(uuid,uuid,boolean,text),
  public.save_wallet_tier(uuid,uuid,text,integer,integer,boolean),
  public.save_wallet_bonus(uuid,uuid,text,text,integer,integer,integer,boolean,timestamptz,timestamptz,boolean) to service_role;
