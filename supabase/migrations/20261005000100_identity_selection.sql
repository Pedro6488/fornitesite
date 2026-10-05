-- Keep the identity selected for the current commercial session separate from
-- the validation history. A visitor may safely retain more than one platform ID.
alter table public.commerce_sessions
  add column if not exists active_game_id_validation_id uuid references public.game_id_validations(id) on delete set null;

create index if not exists commerce_sessions_active_validation_idx
  on public.commerce_sessions(active_game_id_validation_id)
  where active_game_id_validation_id is not null;
