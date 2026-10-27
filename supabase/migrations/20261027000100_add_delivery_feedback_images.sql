create table if not exists public.delivery_feedback_images (
  id uuid primary key default gen_random_uuid(),
  delivery_feedback_id uuid not null references public.delivery_feedback(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  sort_order smallint not null check (sort_order between 1 and 3),
  created_at timestamptz not null default now(),
  unique(delivery_feedback_id, sort_order)
);

create index if not exists delivery_feedback_images_feedback_idx
  on public.delivery_feedback_images(delivery_feedback_id, sort_order);
