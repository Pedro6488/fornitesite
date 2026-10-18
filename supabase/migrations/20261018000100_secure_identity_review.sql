-- Keep manual delivery-identity review available to staff while ensuring that
-- browser roles cannot call the SECURITY DEFINER functions directly.
create or replace function public.review_game_id_validation(
  p_validation_id uuid,
  p_status text,
  p_actor_id uuid,
  p_note text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  validation_row public.game_id_validations%rowtype;
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
  next_giftable_at timestamptz;
  remaining_hours numeric;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_actor_id
      and role = 'admin'::public.app_role
  ) then
    raise exception 'admin_actor_required';
  end if;

  if p_status not in ('waiting', 'ready', 'blocked') then
    raise exception 'invalid_validation_review_status';
  end if;

  select * into validation_row
  from public.game_id_validations
  where id = p_validation_id
  for update;

  if validation_row.id is null then
    return false;
  end if;

  -- Repeated staff requests must be safe: never extend an existing wait or
  -- duplicate its operational audit event.
  if validation_row.status = p_status then
    return true;
  end if;

  if p_status = 'waiting' then
    if validation_row.status not in ('manual_review', 'pending_friendship') then
      raise exception 'invalid_validation_transition';
    end if;

    next_giftable_at := now() + interval '48 hours';
    update public.game_id_validations
    set status = 'waiting',
        giftable_at = next_giftable_at,
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        review_note = normalized_note,
        last_checked_at = now()
    where id = p_validation_id;

    insert into public.friend_request_records(
      epic_account_id,
      validation_id,
      requested_at,
      provider_response
    ) values (
      validation_row.epic_account_id,
      p_validation_id,
      now(),
      jsonb_build_object('mode', 'manual', 'status', 'sent_by_staff')
    )
    on conflict (epic_account_id) do update set
      validation_id = excluded.validation_id,
      requested_at = excluded.requested_at,
      provider_response = excluded.provider_response;

    insert into public.audit_log(
      actor_id, action, entity_type, entity_id, before_data, after_data
    ) values (
      p_actor_id,
      'delivery_identity.friend_request_sent',
      'game_id_validation',
      p_validation_id::text,
      jsonb_build_object('status', validation_row.status),
      jsonb_strip_nulls(jsonb_build_object(
        'status', 'waiting',
        'giftable_at', next_giftable_at,
        'notes', normalized_note
      ))
    );
    return true;
  end if;

  if p_status = 'ready' then
    if validation_row.status = 'waiting'
      and validation_row.giftable_at is not null
      and validation_row.giftable_at <= now() then
      update public.game_id_validations
      set status = 'ready',
          giftable_at = null,
          reviewed_by = p_actor_id,
          reviewed_at = now(),
          review_note = coalesce(normalized_note, review_note, 'La espera de 48 horas fue completada.'),
          last_checked_at = now()
      where id = p_validation_id;

      insert into public.audit_log(
        actor_id, action, entity_type, entity_id, before_data, after_data
      ) values (
        p_actor_id,
        'delivery_identity.wait_completed_by_staff',
        'game_id_validation',
        p_validation_id::text,
        jsonb_build_object('status', 'waiting', 'giftable_at', validation_row.giftable_at),
        jsonb_build_object('status', 'ready', 'reason', '48_hours_elapsed')
      );
      return true;
    end if;

    if validation_row.status not in ('manual_review', 'waiting') then
      raise exception 'invalid_validation_transition';
    end if;
    if normalized_note is null or char_length(normalized_note) < 10 then
      raise exception 'override_reason_required';
    end if;

    remaining_hours := case
      when validation_row.giftable_at is not null
        then greatest(extract(epoch from (validation_row.giftable_at - now())) / 3600, 0)
      else null
    end;

    update public.game_id_validations
    set status = 'ready',
        giftable_at = null,
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        review_note = normalized_note,
        last_checked_at = now()
    where id = p_validation_id;

    insert into public.audit_log(
      actor_id, action, entity_type, entity_id, before_data, after_data
    ) values (
      p_actor_id,
      'delivery_identity.ready_overridden',
      'game_id_validation',
      p_validation_id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'status', validation_row.status,
        'giftable_at', validation_row.giftable_at,
        'remaining_hours', remaining_hours
      )),
      jsonb_build_object(
        'status', 'ready',
        'override', true,
        'reason', normalized_note,
        'actor_id', p_actor_id
      )
    );
    return true;
  end if;

  if p_status = 'blocked' then
    if validation_row.status not in ('manual_review', 'pending_friendship', 'waiting', 'ready') then
      raise exception 'invalid_validation_transition';
    end if;
    if normalized_note is null or char_length(normalized_note) < 3 then
      raise exception 'block_reason_required';
    end if;

    update public.game_id_validations
    set status = 'blocked',
        giftable_at = null,
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        review_note = normalized_note,
        last_checked_at = now()
    where id = p_validation_id;

    insert into public.audit_log(
      actor_id, action, entity_type, entity_id, before_data, after_data
    ) values (
      p_actor_id,
      'delivery_identity.blocked',
      'game_id_validation',
      p_validation_id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'status', validation_row.status,
        'giftable_at', validation_row.giftable_at
      )),
      jsonb_build_object('status', 'blocked', 'reason', normalized_note)
    );
    return true;
  end if;

  raise exception 'invalid_validation_transition';
end;
$$;

revoke all on function public.review_game_id_validation(uuid, text, uuid, text)
from public, anon, authenticated;
grant execute on function public.review_game_id_validation(uuid, text, uuid, text)
to service_role;

revoke all on function public.advance_delivery_identity_waits(uuid)
from public, anon, authenticated;
grant execute on function public.advance_delivery_identity_waits(uuid)
to service_role;
