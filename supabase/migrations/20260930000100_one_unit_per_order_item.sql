alter table public.order_items drop constraint if exists order_items_quantity_check;
alter table public.order_items add constraint order_items_quantity_check check (quantity = 1) not valid;
alter table public.order_items add constraint order_items_one_of_each_unique unique (order_id, item_main_id);
