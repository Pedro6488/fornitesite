-- Read-only diagnostic. Run in QA and production and compare the results.
-- 1. All rules, including expired rules whose active flag is still true.
select id, min_vbucks, max_vbucks, mxn_per_hundred, active,
       effective_from, effective_until,
       active and effective_from <= now()
         and (effective_until is null or effective_until > now()) as effective_now
from public.price_rules
order by min_vbucks, effective_from, id;

-- 2. Rules that would block the UPDATE from the screenshot.
-- Matches the trigger's inclusive paVos bounds and [start, end) time bounds.
select target.id as target_id,
       target.effective_from as target_start,
       target.effective_until as current_target_end,
       other.id as conflicting_id,
       other.min_vbucks, other.max_vbucks, other.mxn_per_hundred,
       other.effective_from, other.effective_until
from public.price_rules target
join public.price_rules other
  on other.id <> target.id and other.active
 and int4range(other.min_vbucks, coalesce(other.max_vbucks, 2147483646), '[]')
     && int4range(target.min_vbucks, coalesce(target.max_vbucks, 2147483646), '[]')
 and tstzrange(other.effective_from, other.effective_until, '[)')
     && tstzrange(target.effective_from, null::timestamptz, '[)')
where target.min_vbucks = 1500 and target.max_vbucks is null and target.active
order by target.id, other.min_vbucks, other.effective_from;

-- 3. Is the same trigger installed and enabled in both databases?
select trigger.tgname, trigger.tgenabled,
       pg_get_triggerdef(trigger.oid) as trigger_definition,
       pg_get_functiondef(trigger.tgfoid) as function_definition
from pg_trigger trigger
where trigger.tgrelid = 'public.price_rules'::regclass
  and not trigger.tgisinternal
order by trigger.tgname;

-- 4. Compare applied migrations (run as a database administrator).
select version
from supabase_migrations.schema_migrations
order by version;
