alter table public.orders drop constraint if exists orders_supervisor_status_check;
alter table public.orders add constraint orders_supervisor_status_check check (
  supervisor_status in ('pending_confirmation', 'submitted_to_administrator', 'payment_received', 'sent')
);

create table if not exists public.order_payment_tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  created_at timestamptz not null default now()
);
create index if not exists order_payment_tickets_order_idx on public.order_payment_tickets(order_id);
alter table public.order_payment_tickets enable row level security;
drop policy if exists "users read own payment tickets" on public.order_payment_tickets;
create policy "users read own payment tickets" on public.order_payment_tickets for select using (
  exists (select 1 from public.orders where orders.id = order_payment_tickets.order_id and orders.user_id = auth.uid())
);
