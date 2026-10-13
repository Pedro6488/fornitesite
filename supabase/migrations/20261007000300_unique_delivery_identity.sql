-- A recipient identity may only exist once inside a commerce session. Rewire
-- historical duplicates before enforcing the invariant.
create temporary table duplicate_identity_map as
with ranked as (
  select id,
    first_value(id) over (
      partition by commerce_session_id, epic_account_id
      order by case status when 'blocked' then 6 when 'ready' then 5 when 'waiting' then 4 when 'manual_review' then 3 when 'pending_friendship' then 2 else 1 end desc,
        last_checked_at desc, created_at desc
    ) as keep_id,
    row_number() over (
      partition by commerce_session_id, epic_account_id
      order by case status when 'blocked' then 6 when 'ready' then 5 when 'waiting' then 4 when 'manual_review' then 3 when 'pending_friendship' then 2 else 1 end desc,
        last_checked_at desc, created_at desc
    ) as position
  from public.game_id_validations
)
select id as duplicate_id, keep_id from ranked where position > 1;

update public.orders as target set recipient_validation_id = map.keep_id
from duplicate_identity_map as map where target.recipient_validation_id = map.duplicate_id;
update public.checkout_quotes as target set validation_id = map.keep_id
from duplicate_identity_map as map where target.validation_id = map.duplicate_id;
update public.friend_request_records as target set validation_id = map.keep_id
from duplicate_identity_map as map where target.validation_id = map.duplicate_id;
update public.commerce_sessions as target set active_game_id_validation_id = map.keep_id
from duplicate_identity_map as map where target.active_game_id_validation_id = map.duplicate_id;
delete from public.game_id_validations as target using duplicate_identity_map as map
where target.id = map.duplicate_id;

create unique index if not exists game_id_validations_session_recipient_unique
  on public.game_id_validations(commerce_session_id, epic_account_id);

drop table duplicate_identity_map;
