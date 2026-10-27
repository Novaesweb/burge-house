-- PROPOSTA LOCAL. Não aplicada. Rever em staging antes de executar no central.
-- Reutiliza as tabelas oficiais; não lê catálogo privado, contratos nem dados pessoais.
begin;

-- Operational RLS must agree with the restricted account UI. Account/messages
-- continue using their existing membership policies, independently of this helper.
create or replace function public.delivery_has_role(target uuid,allowed_roles text[])
returns boolean language sql stable security invoker set search_path='' as $$
  select auth.uid() is not null
    and exists(select 1 from public.managed_sites where id=target and status='active')
    and exists(select 1 from public.store_members where store_id=target and user_id=auth.uid() and is_active and role=any(allowed_roles));
$$;

create table delivery_private.order_reporting_outbox (
  store_id uuid not null references public.managed_sites(id) on delete restrict,
  order_ref text not null check(length(order_ref) between 1 and 120),
  event_type public.order_lifecycle_event_type not null,
  occurred_at timestamptz not null,
  attempts integer not null default 0 check(attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error_code text,
  primary key(store_id,order_ref,event_type)
);
alter table delivery_private.order_reporting_outbox enable row level security;
revoke all on delivery_private.order_reporting_outbox from public,anon,authenticated;
create index order_reporting_pending_idx on delivery_private.order_reporting_outbox(store_id,next_attempt_at)
  where completed_at is null;

create function delivery_private.flush_order_reporting(p_store_id uuid, p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare e record; v_accepted_at timestamptz; v_completed integer := 0;
begin
  for e in select * from delivery_private.order_reporting_outbox
    where store_id=p_store_id and completed_at is null and attempts<8 and next_attempt_at<=now()
    order by occurred_at,order_ref,event_type for update skip locked limit least(greatest(p_limit,1),100)
  loop
    begin
      perform pg_advisory_xact_lock(hashtextextended(e.store_id::text||':'||e.order_ref,0));
      v_accepted_at := e.occurred_at;
      if e.event_type='accepted' then
        insert into public.store_order_usage_events(store_id,order_ref,accepted_at,competence,source)
          values(e.store_id,e.order_ref,e.occurred_at,public.novaesweb_order_competence(e.occurred_at),'delivery_orders_trigger')
          on conflict(store_id,order_ref) do nothing;
        select accepted_at into v_accepted_at from public.store_order_usage_events
          where store_id=e.store_id and order_ref=e.order_ref;
      end if;
      insert into public.store_order_lifecycle_events(store_id,order_ref,event_type,occurred_at,competence,source)
        values(e.store_id,e.order_ref,e.event_type,v_accepted_at,to_char(public.novaesweb_order_competence(v_accepted_at),'YYYY-MM'),'delivery_orders_trigger')
        on conflict(store_id,order_ref,event_type) do nothing;
      update delivery_private.order_reporting_outbox set completed_at=now(),last_error_code=null
        where store_id=e.store_id and order_ref=e.order_ref and event_type=e.event_type;
      v_completed := v_completed+1;
    exception when others then
      -- The accepted order remains valid. Keep a durable, PII-free retry entry.
      update delivery_private.order_reporting_outbox
        set attempts=attempts+1,last_error_code=sqlstate,
          next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer))
        where store_id=e.store_id and order_ref=e.order_ref and event_type=e.event_type;
    end;
  end loop;
  return v_completed;
end $$;
revoke all on function delivery_private.flush_order_reporting(uuid,integer) from public,anon,authenticated;

create function delivery_private.capture_order_lifecycle()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_store uuid; v_order_ref text; v_type public.order_lifecycle_event_type; v_at timestamptz:=now();
begin
  if tg_op='DELETE' then v_store:=old.store_id; v_order_ref:=old.id::text;
  else v_store:=new.store_id; v_order_ref:=new.id::text; end if;
  -- No START integration, backfill, historical guessing or automatic contract changes.
  if not exists(select 1 from public.managed_sites where id=v_store
    and plan_code in ('NOVAES_BUSINESS','NOVAES_PREMIUM','NOVAES_EMPRESARIAL')) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='INSERT' then v_type:='created'; v_at:=new.created_at;
  elsif tg_op='DELETE' then v_type:='hidden';
  elsif new.status is distinct from old.status then
    if old.status='recebido' and new.status='preparando' then v_type:='accepted';
    elsif new.status='cancelado' and old.status='recebido' then v_type:='rejected';
    elsif new.status='cancelado' then v_type:='cancelled';
    elsif new.status='entregue' then v_type:='delivered'; end if;
  end if;
  if v_type is not null then
    insert into delivery_private.order_reporting_outbox(store_id,order_ref,event_type,occurred_at)
      values(v_store,v_order_ref,v_type,v_at) on conflict do nothing;
    perform delivery_private.flush_order_reporting(v_store,20);
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function delivery_private.capture_order_lifecycle() from public,anon,authenticated;
create trigger novaesweb_order_lifecycle AFTER INSERT OR UPDATE OF status OR DELETE on public.delivery_orders
  for each row execute function delivery_private.capture_order_lifecycle();

create function public.delivery_reconcile_order_reporting(p_store_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.store_members
    where store_id=p_store_id and user_id=auth.uid() and is_active and role in ('owner','admin')) then
    raise exception 'NOT_AUTHORIZED' using errcode='42501';
  end if;
  return delivery_private.flush_order_reporting(p_store_id,100);
end $$;
revoke all on function public.delivery_reconcile_order_reporting(uuid) from public,anon,authenticated;
grant execute on function public.delivery_reconcile_order_reporting(uuid) to authenticated;

create function public.delivery_plan_usage(p_store_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare s record; v_month date:=public.novaesweb_order_competence(now()); v_count bigint; v_voided bigint; v_daily jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.store_members
    where store_id=p_store_id and user_id=auth.uid() and is_active and role in ('owner','admin')) then
    raise exception 'NOT_AUTHORIZED' using errcode='42501';
  end if;
  select id,nx_id,name,plan_code,billing_active,plan_started_at,plan_expires_at,payment_status into s
    from public.managed_sites where id=p_store_id;
  if not found then raise exception 'NOT_AUTHORIZED' using errcode='42501'; end if;
  select count(*) filter(where not is_voided),count(*) filter(where is_voided) into v_count,v_voided
    from public.store_order_usage_events where store_id=p_store_id and competence=v_month;
  select coalesce(jsonb_agg(jsonb_build_object('day',d.day,'accepted_count',d.n) order by d.day),'[]'::jsonb)
    into v_daily from (
      select (accepted_at at time zone 'America/Sao_Paulo')::date as day,count(*) as n
      from public.store_order_usage_events where store_id=p_store_id and competence=v_month and not is_voided
      group by (accepted_at at time zone 'America/Sao_Paulo')::date
    ) d;
  return jsonb_build_object('store_id',s.id,'nx_id',s.nx_id,'store_name',s.name,'plan_code',s.plan_code,
    'competence',v_month,'franchise_orders',case s.plan_code when 'NOVAES_BUSINESS' then 340 when 'NOVAES_PREMIUM' then 750 else null end,
    'accepted_count',v_count,'voided_count',v_voided,'daily',v_daily,'overage_tariff',null,
    'billing_active',coalesce(s.billing_active,false),'plan_started_at',s.plan_started_at,'plan_expires_at',s.plan_expires_at,'payment_status',s.payment_status);
end $$;
revoke all on function public.delivery_plan_usage(uuid) from public,anon,authenticated;
grant execute on function public.delivery_plan_usage(uuid) to authenticated;

-- Summary only. Never expose pending order_refs, retry metadata or customer data.
create function public.delivery_order_reporting_health(p_store_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_pending integer; v_review integer;
begin
  if auth.uid() is null or not exists(select 1 from public.store_members
    where store_id=p_store_id and user_id=auth.uid() and is_active and role in ('owner','admin')) then
    raise exception 'NOT_AUTHORIZED' using errcode='42501';
  end if;
  select count(*) filter(where completed_at is null),count(*) filter(where completed_at is null and attempts>=8)
    into v_pending,v_review from delivery_private.order_reporting_outbox where store_id=p_store_id;
  return jsonb_build_object('pending_count',v_pending,'review_count',v_review);
end $$;
revoke all on function public.delivery_order_reporting_health(uuid) from public,anon,authenticated;
grant execute on function public.delivery_order_reporting_health(uuid) to authenticated;
commit;
