-- Friendship with our gift accounts belongs to the recipient (epic_account_id),
-- not to the browser session that registered it. The same gamertag registered
-- from another device or guest session must keep the staff decision instead of
-- returning to manual review.

create index if not exists game_id_validations_epic_account_idx
  on public.game_id_validations(epic_account_id);

-- Backfill: pending duplicates of a blocked recipient stay blocked.
update public.game_id_validations as target
set status = 'blocked',
    giftable_at = null,
    reviewed_by = source.reviewed_by,
    reviewed_at = source.reviewed_at,
    review_note = source.review_note,
    last_checked_at = now()
from (
  select distinct on (epic_account_id) epic_account_id, reviewed_by, reviewed_at, review_note
  from public.game_id_validations
  where status = 'blocked'
  order by epic_account_id, reviewed_at desc nulls last
) as source
where target.epic_account_id = source.epic_account_id
  and target.status in ('manual_review', 'pending_friendship', 'waiting');

-- Backfill: pending duplicates of a ready recipient become ready.
update public.game_id_validations as target
set status = 'ready',
    giftable_at = null,
    reviewed_by = source.reviewed_by,
    reviewed_at = source.reviewed_at,
    review_note = source.review_note,
    last_checked_at = now()
from (
  select distinct on (epic_account_id) epic_account_id, reviewed_by, reviewed_at, review_note
  from public.game_id_validations
  where status = 'ready'
  order by epic_account_id, reviewed_at desc nulls last
) as source
where target.epic_account_id = source.epic_account_id
  and target.status in ('manual_review', 'pending_friendship', 'waiting');

-- Backfill: duplicates still in review share the earliest running wait.
update public.game_id_validations as target
set status = 'waiting',
    giftable_at = source.giftable_at,
    last_checked_at = now()
from (
  select epic_account_id, min(giftable_at) as giftable_at
  from public.game_id_validations
  where status = 'waiting' and giftable_at is not null
  group by epic_account_id
) as source
where target.epic_account_id = source.epic_account_id
  and target.status in ('manual_review', 'pending_friendship');

create or replace function public.sync_recipient_identity_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Sibling updates fire this trigger again; only the original change propagates.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.status = 'blocked' then
    update public.game_id_validations
    set status = 'blocked', giftable_at = null, reviewed_by = new.reviewed_by,
        reviewed_at = new.reviewed_at, review_note = new.review_note, last_checked_at = now()
    where epic_account_id = new.epic_account_id and id <> new.id and status <> 'blocked';
  elsif new.status = 'ready' then
    update public.game_id_validations
    set status = 'ready', giftable_at = null, reviewed_by = new.reviewed_by,
        reviewed_at = new.reviewed_at, review_note = new.review_note, last_checked_at = now()
    where epic_account_id = new.epic_account_id and id <> new.id
      and status in ('manual_review', 'pending_friendship', 'waiting');
  elsif new.status = 'waiting' then
    update public.game_id_validations
    set status = 'waiting', giftable_at = new.giftable_at, reviewed_by = new.reviewed_by,
        reviewed_at = new.reviewed_at, review_note = new.review_note, last_checked_at = now()
    where epic_account_id = new.epic_account_id and id <> new.id
      and status in ('manual_review', 'pending_friendship');
  end if;
  return new;
end;
$$;
revoke all on function public.sync_recipient_identity_status() from public, anon, authenticated;

drop trigger if exists game_id_validations_sync_recipient_status on public.game_id_validations;
create trigger game_id_validations_sync_recipient_status
  after update of status on public.game_id_validations
  for each row
  when (old.status is distinct from new.status)
  execute function public.sync_recipient_identity_status();
