-- Datos del destinatario que devuelve FN Shop. La llave `epic_account_id`
-- (`manual:<hash>` de plataforma + gamertag) no cambia: es la que comparte el
-- estado entre sesiones y dispositivos. El Epic ID real se guarda aparte.

alter table public.game_id_validations
  add column if not exists provider_receiver_id text,
  add column if not exists friend_requested_at timestamptz,
  add column if not exists friendship_checks integer not null default 0,
  add column if not exists friendship_checked_at timestamptz;

comment on column public.game_id_validations.provider_receiver_id is
  'Epic account ID de 32 caracteres que devuelve FN Shop (receiver_id). No cambia si el cliente renombra su cuenta.';
comment on column public.game_id_validations.friend_requested_at is
  'Cuándo se envió la solicitud de amistad desde las cuentas remitentes con friend_add.';
comment on column public.game_id_validations.friendship_checks is
  'Veces que el cliente pulsó «Ya acepté» (friend_status). Máximo 3 por ID.';

alter table public.game_id_validations drop constraint if exists game_id_validations_receiver_id_format;
alter table public.game_id_validations add constraint game_id_validations_receiver_id_format
  check (provider_receiver_id is null or provider_receiver_id ~ '^[0-9a-f]{32}$');

create index if not exists game_id_validations_provider_receiver_idx
  on public.game_id_validations(provider_receiver_id) where provider_receiver_id is not null;
