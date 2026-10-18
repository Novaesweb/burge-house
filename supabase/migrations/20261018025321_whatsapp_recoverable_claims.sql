alter table delivery_private.whatsapp_outbox add column claim_id uuid unique;

create function delivery_private.claim_whatsapp(p_store_id uuid,p_token text,p_claim_id uuid)
returns setof delivery_private.whatsapp_outbox language plpgsql security definer set search_path='' as $$
begin
  if p_claim_id is null or not exists(select 1 from delivery_private.whatsapp_stores where store_id=p_store_id
    and enabled and worker_token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then
    raise exception 'WORKER_UNAUTHORIZED' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text||p_claim_id::text,11));
  if exists(select 1 from delivery_private.whatsapp_outbox where store_id=p_store_id and claim_id=p_claim_id) then
    return query select * from delivery_private.whatsapp_outbox where store_id=p_store_id and claim_id=p_claim_id;
    return;
  end if;
  return query update delivery_private.whatsapp_outbox q set state='sending',claim_id=p_claim_id
    where q.id=(select e.id from delivery_private.whatsapp_outbox e
      where e.store_id=p_store_id and e.state='pending'
      and not exists(select 1 from delivery_private.whatsapp_outbox prior
        where prior.order_id=e.order_id and prior.store_id=e.store_id and prior.id<e.id
          and prior.state in ('pending','sending','uncertain'))
      order by e.id for update of e skip locked limit 1) returning q.*;
end;
$$;
create function public.delivery_claim_whatsapp(p_store_id uuid,p_token text,p_claim_id uuid)
returns setof delivery_private.whatsapp_outbox language sql security invoker set search_path='' as $$
  select * from delivery_private.claim_whatsapp(p_store_id,p_token,p_claim_id);
$$;
revoke all on function delivery_private.claim_whatsapp(uuid,text,uuid),public.delivery_claim_whatsapp(uuid,text,uuid) from public,anon,authenticated;
grant execute on function delivery_private.claim_whatsapp(uuid,text,uuid),public.delivery_claim_whatsapp(uuid,text,uuid) to anon,authenticated,service_role;

create or replace function delivery_private.finish_whatsapp(p_store_id uuid,p_token text,p_id bigint,p_state text,p_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from delivery_private.whatsapp_stores where store_id=p_store_id
    and worker_token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then
    raise exception 'WORKER_UNAUTHORIZED' using errcode='42501';
  end if;
  if p_state not in ('sent','blocked','uncertain') then raise exception 'INVALID_STATE'; end if;
  update delivery_private.whatsapp_outbox set state=p_state,finished_at=now(),result_code=left(p_code,80)
    where id=p_id and store_id=p_store_id and state='sending';
  if not found and not exists(select 1 from delivery_private.whatsapp_outbox
    where id=p_id and store_id=p_store_id and state=p_state and result_code=left(p_code,80)) then
    raise exception 'INVALID_CLAIM';
  end if;
end;
$$;
