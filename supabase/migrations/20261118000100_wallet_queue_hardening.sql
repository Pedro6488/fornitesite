-- Fase 1 de pavos: una sola cola dueña de las entregas y recargas que vencen.

-- El worker general (cron diario) ya no toma entregas con pavos: solo claim_wallet_job,
-- que sí recupera trabajos interrumpidos, procesa wallet.deliver.
create or replace function public.claim_outbox_jobs(p_limit integer default 25)
returns setof public.outbox_jobs
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with candidates as (
    select id from public.outbox_jobs
    where status = 'pending' and available_at <= now() and job_type <> 'wallet.deliver'
    order by available_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  update public.outbox_jobs as job
  set status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;
revoke all on function public.claim_outbox_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_outbox_jobs(integer) to service_role;

-- Una recarga sin comprobante vence a las 48 horas: no conserva para siempre la tarifa con que se creó.
alter table public.wallet_topups add column expires_at timestamptz not null default (now() + interval '48 hours');
alter table public.wallet_topups drop constraint wallet_topups_status_check;
alter table public.wallet_topups add constraint wallet_topups_status_check
  check (status in ('awaiting_payment','submitted','approved','rejected','expired'));
create index wallet_topups_expiring on public.wallet_topups(expires_at) where status = 'awaiting_payment';

-- Defensa en la base: ninguna ruta puede adjuntar comprobante a una recarga vencida.
create function public.guard_wallet_topup_expiry()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'awaiting_payment' and new.status = 'submitted' and old.expires_at <= now() then
    raise exception 'topup_expired';
  end if;
  return new;
end; $$;
create trigger wallet_topups_expiry before update of status on public.wallet_topups
  for each row execute function public.guard_wallet_topup_expiry();

create function public.expire_wallet_topups()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.wallet_topups set status = 'expired'
    where status = 'awaiting_payment' and expires_at <= now();
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.expire_wallet_topups() from public, anon, authenticated;
grant execute on function public.expire_wallet_topups() to service_role;
