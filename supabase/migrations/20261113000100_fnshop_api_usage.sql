-- Bitácora de cada llamada a FN Shop. Sirve para tres cosas:
-- 1) medir y limitar la cuota (5,000 requests por periodo en el plan Basic),
-- 2) conservar la evidencia de qué se pidió y qué respondió el proveedor,
-- 3) aprender el contrato de la API para construir la entrega propia.
-- Solo se agrega: no se edita ni se borra. Nunca guarda la API key.

create table if not exists public.provider_api_calls (
  id bigint generated always as identity primary key,
  provider text not null default 'fnshop',
  action text not null,
  environment text not null,
  simulated boolean not null default false,
  trigger text not null check (trigger in ('customer', 'admin', 'system')),
  actor_id uuid,
  correlation_id text,
  validation_id uuid,
  order_id uuid,
  order_item_id uuid,
  request_params jsonb not null default '{}'::jsonb,
  http_status integer,
  response_body jsonb,
  response_headers jsonb,
  result boolean,
  code text,
  decision text,
  counted boolean not null,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now()
);

comment on table public.provider_api_calls is
  'Bitácora inmutable de llamadas a FN Shop. Sin llaves foráneas a propósito: borrar un pedido no puede tocar la evidencia.';
comment on column public.provider_api_calls.counted is
  'Si la llamada consume cuota. verify_license, plan_limit_reached y las simuladas no cuentan.';
comment on column public.provider_api_calls.decision is
  'Lo que concluyó nuestro código con la respuesta (ready, waiting, sent, unknown…). Se puede fijar una sola vez.';

create index if not exists provider_api_calls_created_idx on public.provider_api_calls(created_at desc);
create index if not exists provider_api_calls_counted_idx on public.provider_api_calls(created_at) where counted and not simulated;
create index if not exists provider_api_calls_order_idx on public.provider_api_calls(order_id) where order_id is not null;
create index if not exists provider_api_calls_validation_idx on public.provider_api_calls(validation_id) where validation_id is not null;
create index if not exists provider_api_calls_action_code_idx on public.provider_api_calls(action, code);

-- Solo se permite fijar `decision` una vez; todo lo demás queda como se guardó.
create or replace function public.protect_provider_api_calls()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'provider_api_calls_is_append_only';
  end if;
  if old.decision is null and new.decision is not null
    and (to_jsonb(new) - 'decision') = (to_jsonb(old) - 'decision') then
    return new;
  end if;
  raise exception 'provider_api_calls_is_append_only';
end;
$$;

drop trigger if exists provider_api_calls_append_only on public.provider_api_calls;
create trigger provider_api_calls_append_only
  before update or delete on public.provider_api_calls
  for each row execute function public.protect_provider_api_calls();

alter table public.provider_api_calls enable row level security;
revoke all on public.provider_api_calls from anon, authenticated;

-- Consumo del periodo: lo usa el control de cuota antes de cada llamada.
create or replace function public.fnshop_usage_summary(p_since timestamptz)
returns table(counted_total bigint, counted_today bigint, last_call_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select
    count(*) filter (where counted and not simulated),
    count(*) filter (where counted and not simulated
      and created_at >= date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City'),
    max(created_at)
  from public.provider_api_calls
  where provider = 'fnshop' and created_at >= p_since;
$$;

revoke all on function public.fnshop_usage_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.fnshop_usage_summary(timestamptz) to service_role;
