-- Repair historical two-way merges before enforcing the session graph invariant.
-- The most recently active session remains canonical; all delivery identities are
-- retained there so they continue to be visible to the operator queue.
do $$
declare
  cycle_row record;
  canonical_session_id uuid;
  source_session_id uuid;
  canonical_user_id uuid;
  source_validation public.game_id_validations%rowtype;
  target_validation public.game_id_validations%rowtype;
  active_validation_id uuid;
begin
  for cycle_row in
    select left_session.id as left_id, right_session.id as right_id,
      case
        when left_session.last_seen_at > right_session.last_seen_at then left_session.id
        when left_session.last_seen_at < right_session.last_seen_at then right_session.id
        when left_session.id < right_session.id then left_session.id
        else right_session.id
      end as canonical_id
    from public.commerce_sessions as left_session
    join public.commerce_sessions as right_session on right_session.id = left_session.merged_into
    where right_session.merged_into = left_session.id
      and left_session.id < right_session.id
  loop
    canonical_session_id := cycle_row.canonical_id;
    source_session_id := case when canonical_session_id = cycle_row.left_id then cycle_row.right_id else cycle_row.left_id end;
    select user_id into canonical_user_id from public.commerce_sessions where id = canonical_session_id;

    for source_validation in
      select * from public.game_id_validations where commerce_session_id = source_session_id order by last_checked_at desc
    loop
      select * into target_validation
      from public.game_id_validations
      where commerce_session_id = canonical_session_id and epic_account_id = source_validation.epic_account_id
      for update;

      if target_validation.id is null then
        update public.game_id_validations
        set commerce_session_id = canonical_session_id,
          user_id = coalesce(user_id, canonical_user_id)
        where id = source_validation.id;
      else
        if (case source_validation.status when 'blocked' then 5 when 'ready' then 4 when 'waiting' then 3 when 'manual_review' then 2 when 'pending_friendship' then 1 else 0 end)
          > (case target_validation.status when 'blocked' then 5 when 'ready' then 4 when 'waiting' then 3 when 'manual_review' then 2 when 'pending_friendship' then 1 else 0 end) then
          update public.game_id_validations
          set status = source_validation.status,
            giftable_at = source_validation.giftable_at,
            reviewed_at = source_validation.reviewed_at,
            review_note = source_validation.review_note,
            last_checked_at = source_validation.last_checked_at
          where id = target_validation.id;
        end if;

        update public.orders set recipient_validation_id = target_validation.id where recipient_validation_id = source_validation.id;
        update public.checkout_quotes set validation_id = target_validation.id where validation_id = source_validation.id;
        update public.friend_request_records set validation_id = target_validation.id where validation_id = source_validation.id;
        update public.commerce_sessions set active_game_id_validation_id = target_validation.id where active_game_id_validation_id = source_validation.id;
        delete from public.game_id_validations where id = source_validation.id;
      end if;
    end loop;

    select id into active_validation_id
    from public.game_id_validations
    where commerce_session_id = canonical_session_id
    order by last_checked_at desc
    limit 1;
    update public.commerce_sessions
    set merged_into = null, active_game_id_validation_id = active_validation_id
    where id = canonical_session_id;
    update public.commerce_sessions
    set merged_into = canonical_session_id
    where id = source_session_id;
  end loop;
end;
$$;

create or replace function public.prevent_commerce_session_merge_cycles()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ancestor_id uuid := new.merged_into;
  depth integer := 0;
begin
  if new.merged_into is null then return new; end if;
  if new.merged_into = new.id then
    raise exception 'a commerce session cannot merge into itself';
  end if;

  while ancestor_id is not null loop
    if ancestor_id = new.id then
      raise exception 'commerce session merge would create a cycle';
    end if;
    depth := depth + 1;
    if depth > 64 then
      raise exception 'commerce session merge chain is too deep';
    end if;
    select merged_into into ancestor_id from public.commerce_sessions where id = ancestor_id;
  end loop;
  return new;
end;
$$;

drop trigger if exists commerce_sessions_prevent_merge_cycles on public.commerce_sessions;
create trigger commerce_sessions_prevent_merge_cycles
before insert or update of merged_into on public.commerce_sessions
for each row execute function public.prevent_commerce_session_merge_cycles();
