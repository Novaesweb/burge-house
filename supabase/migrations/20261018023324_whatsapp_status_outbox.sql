-- Draft additive migration. Apply only after publication approval.
create schema if not exists delivery_private;
create table delivery_private.whatsapp_stores (
  store_id uuid primary key references public.managed_sites(id),
  enabled boolean not null default false,
  worker_token_hash text not null check(worker_token_hash ~ '^[a-f0-9]{64}$')
);
create table delivery_private.whatsapp_outbox (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.managed_sites(id),
  order_id uuid not null,
  order_number bigint not null,
  status text not null,
  phone text not null,
  state text not null default 'pending' check (state in ('pending','sending','sent','blocked','uncertain')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  result_code text
);
create index whatsapp_pending on delivery_private.whatsapp_outbox(id) where state='pending';
alter table delivery_private.whatsapp_stores enable row level security;
alter table delivery_private.whatsapp_outbox enable row level security;
revoke all on delivery_private.whatsapp_stores,delivery_private.whatsapp_outbox from public,anon,authenticated;
grant all on delivery_private.whatsapp_stores,delivery_private.whatsapp_outbox to service_role;

-- Only committed, real status transitions enqueue events. No historical backfill.
create function delivery_private.enqueue_whatsapp_status() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status is distinct from old.status and exists (
    select 1 from delivery_private.whatsapp_stores where store_id=new.store_id and enabled
  ) then
    insert into delivery_private.whatsapp_outbox(store_id,order_id,order_number,status,phone)
    values(new.store_id,new.id,new.order_number,new.status,coalesce(new.payload->>'customerPhone',''));
  end if;
  return new;
end;
$$;
revoke all on function delivery_private.enqueue_whatsapp_status() from public,anon,authenticated;
create trigger whatsapp_status_changed after update of status on public.delivery_orders
for each row execute function delivery_private.enqueue_whatsapp_status();

-- One atomic claim per event, even with multiple worker processes.
create function delivery_private.claim_whatsapp(p_store_id uuid,p_token text) returns setof delivery_private.whatsapp_outbox
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from delivery_private.whatsapp_stores where store_id=p_store_id
    and enabled and worker_token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then
    raise exception 'WORKER_UNAUTHORIZED' using errcode='42501';
  end if;
  return query
  update delivery_private.whatsapp_outbox q set state='sending'
  where q.id=(select e.id from delivery_private.whatsapp_outbox e
    join delivery_private.whatsapp_stores s on s.store_id=e.store_id and s.enabled
    where e.store_id=p_store_id and e.state='pending'
      and not exists(select 1 from delivery_private.whatsapp_outbox prior
        where prior.order_id=e.order_id and prior.store_id=e.store_id and prior.id<e.id
          and prior.state in ('pending','sending','uncertain'))
    order by e.id for update of e skip locked limit 1)
  returning q.*;
end;
$$;
create function delivery_private.finish_whatsapp(p_store_id uuid,p_token text,p_id bigint,p_state text,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from delivery_private.whatsapp_stores where store_id=p_store_id
    and worker_token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then
    raise exception 'WORKER_UNAUTHORIZED' using errcode='42501';
  end if;
  if p_state not in ('sent','blocked','uncertain') then raise exception 'INVALID_STATE'; end if;
  update delivery_private.whatsapp_outbox set state=p_state,finished_at=now(),result_code=left(p_code,80)
    where id=p_id and store_id=p_store_id and state='sending';
  if not found then raise exception 'INVALID_CLAIM'; end if;
end;
$$;
create function public.delivery_claim_whatsapp(p_store_id uuid,p_token text) returns setof delivery_private.whatsapp_outbox
language sql security invoker set search_path='' as $$
  select * from delivery_private.claim_whatsapp(p_store_id,p_token);
$$;
create function public.delivery_finish_whatsapp(p_store_id uuid,p_token text,p_id bigint,p_state text,p_code text) returns void
language sql security invoker set search_path='' as $$
  select delivery_private.finish_whatsapp(p_store_id,p_token,p_id,p_state,p_code);
$$;
revoke all on function delivery_private.claim_whatsapp(uuid,text),delivery_private.finish_whatsapp(uuid,text,bigint,text,text),public.delivery_claim_whatsapp(uuid,text),public.delivery_finish_whatsapp(uuid,text,bigint,text,text) from public,anon,authenticated;
grant usage on schema delivery_private to anon,authenticated;
grant execute on function delivery_private.claim_whatsapp(uuid,text),delivery_private.finish_whatsapp(uuid,text,bigint,text,text),public.delivery_claim_whatsapp(uuid,text),public.delivery_finish_whatsapp(uuid,text,bigint,text,text) to anon,authenticated,service_role;
