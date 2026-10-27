create table if not exists public.delivery_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  comment text check (char_length(comment) <= 1000),
  image_storage_path text,
  image_mime_type text,
  image_size_bytes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (comment is not null or image_storage_path is not null)
);

create index if not exists delivery_feedback_created_at_idx
  on public.delivery_feedback(created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-feedback',
  'delivery-feedback',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
