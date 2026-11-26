-- Una sola regla por apartado. Solo el backend autorizado puede escribirla.
begin;
create table public.collection_price_rules (
  collection text primary key check (length(btrim(collection)) between 1 and 200),
  mxn_per_hundred numeric(10,2) not null check (mxn_per_hundred > 0),
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.collection_price_rules enable row level security;
revoke all on public.collection_price_rules from anon, authenticated;
grant select, insert, update on public.collection_price_rules to service_role;

create function public.audit_collection_price() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log(actor_id, action, entity_type, entity_id, before_data, after_data)
  values(new.updated_by, 'price.collection_price', 'collection_price', new.collection,
    case when tg_op='UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end;
$$;
revoke all on function public.audit_collection_price() from public, anon, authenticated;
create trigger collection_price_audit after insert or update on public.collection_price_rules
  for each row execute function public.audit_collection_price();
commit;
