-- Desde que la tienda también llama a nuestra API (provider = 'own'), las vistas de FN Shop
-- deben contar solo las llamadas a FN Shop. Las de nuestra API se ven en /admin/api-propia.
-- Mismas columnas que antes: solo se agrega el filtro por proveedor.

create or replace view public.fnshop_contract_catalog with (security_invoker = true) as
select
  calls.action,
  coalesce(calls.code, '(sin code)') as code,
  calls.result,
  calls.simulated,
  count(*) as calls,
  min(calls.created_at) as first_seen,
  max(calls.created_at) as last_seen,
  (
    select array_agg(distinct field order by field)
    from public.provider_api_calls as sample,
      lateral jsonb_object_keys(case when jsonb_typeof(sample.response_body) = 'object' then sample.response_body else '{}'::jsonb end) as field
    where sample.provider = 'fnshop'
      and sample.action = calls.action
      and sample.code is not distinct from calls.code
      and sample.simulated = calls.simulated
  ) as response_fields,
  (array_agg(calls.response_body order by calls.created_at desc))[1] as latest_example
from public.provider_api_calls as calls
where calls.provider = 'fnshop'
group by calls.action, calls.code, calls.result, calls.simulated;

create or replace view public.fnshop_usage_daily with (security_invoker = true) as
select
  (created_at at time zone 'America/Mexico_City')::date as day,
  action,
  count(*) as calls,
  count(*) filter (where counted and not simulated) as counted,
  count(*) filter (where simulated) as simulated
from public.provider_api_calls
where provider = 'fnshop'
group by 1, 2;

revoke all on public.fnshop_contract_catalog, public.fnshop_usage_daily from anon, authenticated;
