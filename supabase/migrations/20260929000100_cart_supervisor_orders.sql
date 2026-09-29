alter table public.orders add column if not exists recipient_platform text check (recipient_platform in ('epic', 'xbox', 'playstation', 'nintendo'));
alter table public.orders add column if not exists contact_whatsapp text;
alter table public.orders add column if not exists supervisor_status text not null default 'pending_confirmation' check (supervisor_status in ('pending_confirmation', 'payment_received', 'sent'));
alter table public.orders add column if not exists supervisor_status_updated_at timestamptz not null default now();
alter table public.orders add column if not exists supervisor_status_updated_by uuid references auth.users(id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_main_id text not null,
  offer_id text not null,
  item_name text not null,
  item_image_url text,
  vbucks_price integer not null check (vbucks_price > 0),
  unit_amount_mxn_cents integer not null check (unit_amount_mxn_cents > 0),
  quantity integer not null check (quantity between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);
alter table public.order_items enable row level security;
create policy "users read own order items" on public.order_items for select using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));

create table if not exists public.order_supervisor_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.order_supervisor_events enable row level security;

create or replace function public.assign_order_to_existing_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is null then
    select id into new.user_id from auth.users where lower(email) = lower(new.customer_email) limit 1;
  end if;
  return new;
end;
$$;
drop trigger if exists on_order_created_assign_user on public.orders;
create trigger on_order_created_assign_user before insert on public.orders for each row execute procedure public.assign_order_to_existing_user();

update public.orders as order_row set user_id = auth_user.id from auth.users as auth_user
where order_row.user_id is null and lower(order_row.customer_email) = lower(auth_user.email);

drop policy if exists "users read own order items" on public.order_items;
create policy "users read own order items" on public.order_items for select using (
  exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
);
drop policy if exists "users read own supervisor events" on public.order_supervisor_events;
create policy "users read own supervisor events" on public.order_supervisor_events for select using (
  exists (select 1 from public.orders where orders.id = order_supervisor_events.order_id and orders.user_id = auth.uid())
);
