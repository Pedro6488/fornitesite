-- Entrega por objeto. Un pedido con varios objetos hace un gift_send por objeto,
-- y cada envío tiene su propia fila. La fila se crea en `sending` antes de llamar
-- a FN Shop: si ya existe en sending, unknown o sent, no se vuelve a enviar.

alter table public.fulfillments drop constraint if exists fulfillments_order_id_key;

alter table public.fulfillments
  add column if not exists order_item_id uuid references public.order_items(id) on delete restrict,
  add column if not exists offer_id text,
  add column if not exists receiver text,
  add column if not exists receiver_id text,
  add column if not exists sender_account_id text,
  add column if not exists sender_name text,
  add column if not exists track_id text,
  add column if not exists result_code text,
  add column if not exists final_price_vbucks integer,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists actor_id uuid references auth.users(id) on delete set null;

create unique index if not exists fulfillments_order_item_unique
  on public.fulfillments(order_item_id) where order_item_id is not null;
create index if not exists fulfillments_order_idx on public.fulfillments(order_id);
create index if not exists fulfillments_status_idx on public.fulfillments(status, started_at);

alter table public.fulfillments drop constraint if exists fulfillments_status_check;
alter table public.fulfillments add constraint fulfillments_status_check
  check (status in ('queued', 'sending', 'sent', 'unknown', 'failed', 'delivered')) not valid;

comment on column public.fulfillments.status is
  'sending: llamada en curso · sent: FN Shop confirmó · unknown: resultado dudoso, conciliar antes de reintentar · failed: rechazado, se puede reintentar · queued/delivered: filas anteriores a la entrega por objeto.';

-- Salidas de revisión manual: reintentar el envío, entregarlo a mano o reembolsar.
create or replace function public.is_valid_order_transition(p_from public.order_status, p_to public.order_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'draft' then p_to in ('payment_pending', 'awaiting_transfer', 'canceled')
    when 'payment_pending' then p_to in ('paid', 'rejected', 'expired', 'canceled')
    when 'awaiting_transfer' then p_to in ('receipt_submitted', 'paid', 'expired', 'canceled')
    when 'receipt_submitted' then p_to in ('transfer_review', 'paid')
    when 'transfer_review' then p_to in ('information_required', 'paid', 'rejected')
    when 'information_required' then p_to in ('receipt_submitted', 'paid', 'rejected', 'canceled')
    when 'paid' then p_to in ('ready_to_send', 'refund_pending', 'manual_review')
    when 'ready_to_send' then p_to in ('validating_delivery', 'refund_pending', 'manual_review')
    when 'validating_delivery' then p_to in ('delivering', 'manual_review', 'refund_pending')
    when 'delivering' then p_to in ('delivered', 'reconciling', 'manual_review')
    when 'reconciling' then p_to in ('delivered', 'manual_review')
    when 'manual_review' then p_to in ('awaiting_transfer', 'canceled', 'ready_to_send', 'delivered', 'refund_pending')
    when 'refund_pending' then p_to in ('refunded', 'manual_review')
    else false
  end;
$$;
