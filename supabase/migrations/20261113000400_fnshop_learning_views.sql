-- Vistas de análisis sobre la bitácora cruda (provider_api_calls). No hay tablas
-- derivadas: si a mitad de mes aparece un campo nuevo, se cambia la vista y sirve
-- también para lo ya guardado. Solo el servidor las lee.

-- ¿Qué respuestas existen? Por acción y code: veces, primer y último caso,
-- campos presentes y el ejemplo más reciente.
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
    where sample.action = calls.action
      and sample.code is not distinct from calls.code
      and sample.simulated = calls.simulated
  ) as response_fields,
  (array_agg(calls.response_body order by calls.created_at desc))[1] as latest_example
from public.provider_api_calls as calls
group by calls.action, calls.code, calls.result, calls.simulated;

-- ¿Cuánto tarda un cliente en aceptar? ¿La espera es de 48 h exactas?
create or replace view public.fnshop_friendship_timeline with (security_invoker = true) as
select
  validation_id,
  min(created_at) filter (where action = 'friend_add') as friend_add_at,
  (array_agg(code order by created_at) filter (where action = 'friend_add'))[1] as friend_add_code,
  (array_agg(response_body -> 'giftable_at' order by created_at) filter (where action = 'friend_add'))[1] as friend_add_giftable_at,
  count(*) filter (where action = 'friend_status') as status_checks,
  max(created_at) filter (where action = 'friend_status') as last_status_at,
  (array_agg(response_body -> 'accounts' order by created_at desc) filter (where action = 'friend_status'))[1] as last_status_accounts,
  (array_agg(decision order by created_at desc) filter (where decision is not null))[1] as last_decision,
  bool_or(simulated) as simulated
from public.provider_api_calls
where validation_id is not null
group by validation_id;

-- ¿Qué cuenta remitente se usa, cuándo y con qué resultado?
create or replace view public.fnshop_sender_activity with (security_invoker = true) as
select
  coalesce(response_body ->> 'sender_id', '(sin cuenta)') as sender_id,
  (created_at at time zone 'America/Mexico_City')::date as day,
  action,
  coalesce(code, '(sin code)') as code,
  count(*) as calls,
  min(created_at) as first_at,
  max(created_at) as last_at,
  (array_agg(response_body -> 'reasons' order by created_at desc) filter (where response_body ? 'reasons'))[1] as latest_reasons,
  bool_or(simulated) as simulated
from public.provider_api_calls
where action in ('gift_check', 'gift_send')
group by 1, 2, 3, 4;

-- ¿El offerId de Fortnite-API es el que acepta Epic? ¿Cuándo cambia el precio?
create or replace view public.fnshop_offer_checks with (security_invoker = true) as
select
  request_params ->> 'offerId' as offer_id,
  action,
  coalesce(code, '(sin code)') as code,
  count(*) as calls,
  min(case when jsonb_typeof(response_body -> 'final_price') = 'number' then (response_body ->> 'final_price')::numeric end) as min_final_price,
  max(case when jsonb_typeof(response_body -> 'final_price') = 'number' then (response_body ->> 'final_price')::numeric end) as max_final_price,
  max(created_at) as last_at,
  bool_or(simulated) as simulated
from public.provider_api_calls
where action in ('gift_check', 'gift_send') and request_params ? 'offerId'
group by 1, 2, 3;

-- ¿Qué porcentaje sale bien, rechazado o dudoso, y por qué?
create or replace view public.fnshop_delivery_outcomes with (security_invoker = true) as
select
  (created_at at time zone 'America/Mexico_City')::date as day,
  coalesce(code, '(sin code)') as code,
  coalesce(decision, '(sin decisión)') as decision,
  count(*) as calls,
  bool_or(simulated) as simulated
from public.provider_api_calls
where action = 'gift_send'
group by 1, 2, 3;

-- ¿Qué tiempos debemos cumplir?
create or replace view public.fnshop_latency with (security_invoker = true) as
select
  action,
  simulated,
  count(*) as calls,
  percentile_cont(0.5) within group (order by duration_ms) as p50_ms,
  percentile_cont(0.95) within group (order by duration_ms) as p95_ms,
  max(duration_ms) as max_ms
from public.provider_api_calls
where duration_ms is not null
group by action, simulated;

-- Consumo de cuota por día y acción.
create or replace view public.fnshop_usage_daily with (security_invoker = true) as
select
  (created_at at time zone 'America/Mexico_City')::date as day,
  action,
  count(*) as calls,
  count(*) filter (where counted and not simulated) as counted,
  count(*) filter (where simulated) as simulated
from public.provider_api_calls
group by 1, 2;

revoke all on public.fnshop_contract_catalog, public.fnshop_friendship_timeline, public.fnshop_sender_activity,
  public.fnshop_offer_checks, public.fnshop_delivery_outcomes, public.fnshop_latency, public.fnshop_usage_daily
  from anon, authenticated;
