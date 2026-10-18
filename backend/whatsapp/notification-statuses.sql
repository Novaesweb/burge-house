create or replace function delivery_private.enqueue_whatsapp_status() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status is distinct from old.status
    and new.status in ('preparando','saiu_para_entrega','entregue')
    and exists(select 1 from delivery_private.whatsapp_stores where store_id=new.store_id and enabled) then
    insert into delivery_private.whatsapp_outbox(store_id,order_id,order_number,status,phone)
    values(new.store_id,new.id,new.order_number,new.status,coalesce(new.payload->>'customerPhone',''));
  end if;
  return new;
end;
$$;
-- Suppress obsolete, unclaimed notifications. Preserve sent history and active claims.
update delivery_private.whatsapp_outbox set state='blocked',result_code='STATUS_NOT_NOTIFIED',finished_at=now()
where state='pending' and status not in ('preparando','saiu_para_entrega','entregue');
