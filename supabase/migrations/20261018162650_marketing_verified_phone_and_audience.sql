-- Preserve existing stores, campaigns and consent history.
begin;
create or replace function marketing_private.admin(s uuid,op text,a jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c marketing_private.campaigns; r jsonb; rid uuid; seg int;
begin
 if not coalesce(public.delivery_has_role(s,array['owner','admin']),false) then raise exception 'MARKETING_FORBIDDEN'; end if;
 if op='dashboard' then
  return jsonb_build_object(
   'settings',(select jsonb_build_object('enabled',enabled,'consent_enabled',consent_enabled,'heartbeat_at',heartbeat_at,'synced_at',synced_at) from marketing_private.settings where store_id=s),
   'contacts',coalesce((select jsonb_agg(jsonb_build_object('phone',phone,'name',name,'state',state,'consent_at',consent_at) order by name) from marketing_private.contacts where store_id=s),'[]'::jsonb),
   'campaigns',coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (select jsonb_build_object('id',k.id,'title',k.title,'body',k.body,'state',k.state,'created_at',k.created_at,
    'counts',(select coalesce(jsonb_object_agg(state,n),'{}') from (select state,count(*) n from marketing_private.jobs j where j.store_id=s and j.campaign_id=k.id group by state) q)) x from marketing_private.campaigns k where k.store_id=s order by k.created_at desc limit 50) z),'[]'::jsonb),
   'events',coalesce((select jsonb_agg(x order by x->>'id' desc) from (select jsonb_build_object('id',id,'kind',kind,'entity',entity,'created_at',created_at,'detail',detail) x from marketing_private.events where store_id=s order by id desc limit 100) q),'[]'::jsonb));
 end if;
 if op='prepare' then
  if not exists(select 1 from marketing_private.settings where store_id=s) then raise exception 'MARKETING_NOT_CONFIGURED'; end if;
  rid:=(a->>'request_id')::uuid; seg:=(a->>'segment')::int;
  if rid is null or seg not in (0,30,60,90) or a->>'title' is null or a->>'body' is null then raise exception 'INVALID_CAMPAIGN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(s::text||rid::text,0));
  select * into c from marketing_private.campaigns where store_id=s and request_id=rid;
  if found then
   if c.title<>trim(a->>'title') or c.body<>trim(a->>'body') or c.segment<>seg then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('id',c.id);
  end if;
  insert into marketing_private.campaigns(store_id,request_id,title,body,segment,created_by)
   values(s,rid,trim(a->>'title'),trim(a->>'body'),seg,auth.uid()) returning * into c;
  insert into marketing_private.jobs(store_id,campaign_id,phone,text)
   select s,c.id,t.phone,c.body||E'\n\nPara cancelar promoções, responda SAIR ou acesse:\nhttps://burge-house.vercel.app/?marketing-unsubscribe='||t.unsubscribe_token::text||'&store='||s::text
   from marketing_private.contacts t where t.store_id=s and t.state='opted_in' and (seg=0 or (
    select max(d.created_at) from public.delivery_orders d where d.store_id=s and regexp_replace(d.payload->>'customerPhone','[^0-9]','','g') in (t.phone,substring(t.phone from 3))
   )<=now()-make_interval(days=>seg));
  if not found then raise exception 'NO_CONFIRMED_RECIPIENTS'; end if;
  insert into marketing_private.events(store_id,kind,entity) values(s,'campaign_prepared',c.id::text);
  return jsonb_build_object('id',c.id);
 end if;
 select * into c from marketing_private.campaigns where store_id=s and id=(a->>'id')::uuid for update;
 if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
 if op='details' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'phone',phone,'text',text,'state',state,'provider_id',provider_id,'result_code',result_code,'finished_at',finished_at)) from marketing_private.jobs where store_id=s and campaign_id=c.id),'[]');
 end if;
 if op='approve' then
  -- Global activation cannot be performed through this endpoint.
  if not exists(select 1 from marketing_private.settings where store_id=s and enabled) then raise exception 'SENDING_DISABLED'; end if;
  if a->>'body' is distinct from c.body or (a->>'count')::int is distinct from (select count(*)::int from marketing_private.jobs where store_id=s and campaign_id=c.id) then raise exception 'REVIEW_CHANGED'; end if;
  if not exists(select 1 from marketing_private.jobs j join marketing_private.contacts t on t.store_id=j.store_id and t.phone=j.phone where j.store_id=s and j.campaign_id=c.id and j.state in ('pending','claimed') and t.state='opted_in') then raise exception 'NO_CONFIRMED_RECIPIENTS'; end if;
  if c.state not in ('draft','paused') then raise exception 'INVALID_TRANSITION'; end if;
  update marketing_private.campaigns set state='approved',approved_at=now() where store_id=s and id=c.id;
 elsif op='pause' and c.state='approved' then
  update marketing_private.campaigns set state='paused' where store_id=s and id=c.id;
 elsif op='cancel' and c.state not in ('completed','cancelled') then
  update marketing_private.campaigns set state='cancelled' where store_id=s and id=c.id;
  update marketing_private.jobs set state='suppressed',result_code='CAMPAIGN_CANCELLED',finished_at=now() where store_id=s and campaign_id=c.id and state in ('pending','claimed');
 else raise exception 'INVALID_TRANSITION'; end if;
 insert into marketing_private.events(store_id,kind,entity,detail) values(s,'campaign_'||op,c.id::text,jsonb_build_object('actor',auth.uid()));
 return jsonb_build_object('ok',true);
end $$;

create or replace function marketing_private.worker(s uuid,t text,op text,a jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg marketing_private.settings; j marketing_private.jobs; p text; alternate text; c marketing_private.contacts;
 stamp timestamptz; content text; cid uuid; campaign_state text; result text; is_new boolean;
begin
 select k.* into cfg from marketing_private.settings k join public.managed_sites m on m.id=k.store_id
 where k.store_id=s and m.status='active' and t ~ '^[a-f0-9]{64}$' and k.worker_hash=encode(sha256(convert_to(t,'UTF8')),'hex') for update of k;
 if not found then raise exception 'WORKER_DENIED'; end if;
 update marketing_private.settings set heartbeat_at=now() where store_id=s;
 if op='status' then return jsonb_build_object('enabled',cfg.enabled,'cursor',cfg.inbound_cursor,'phone',cfg.whatsapp_phone); end if;
 if op='consent_target' then
  return coalesce((select jsonb_build_object('phone',phone) from marketing_private.contacts where store_id=s and state='pending' and challenge=(a->>'challenge')::uuid and requested_at>now()-interval '48 hours'),'null'::jsonb);
 end if;
 if op='inbound' then
  if length(a->>'provider_id') not between 1 and 150 then raise exception 'INVALID_MESSAGE'; end if;
  p:=marketing_private.phone(a->>'phone'); stamp:=(a->>'timestamp')::timestamptz;
  if stamp is null or stamp>now()+interval '1 minute' then raise exception 'INVALID_TIMESTAMP'; end if;
  insert into marketing_private.inbound(store_id,provider_id) values(s,a->>'provider_id') on conflict do nothing;
  is_new:=found;
  content:=upper(trim(a->>'text'));
  select * into c from marketing_private.contacts where store_id=s and phone=p for update;
  -- A previously ignored message can be reconciled only while its exact nonce
  -- is still pending. Confirmed/revoked nonces rotate, preventing replay.
  if not is_new and not coalesce(c.state='pending' and stamp>=date_trunc('second',c.requested_at) and c.requested_at>now()-interval '48 hours' and content='ACEITO PROMOCOES '||upper(c.challenge::text),false) then return jsonb_build_object('duplicate',true); end if;
  if content='SAIR' then
   -- Withdrawal may conservatively suppress both Brazilian ninth-digit forms.
   -- This equivalence is NEVER used to grant consent.
   alternate:=case when length(p)=13 and substring(p from 5 for 1)='9' then substring(p from 1 for 4)||substring(p from 6)
                   when length(p)=12 then substring(p from 1 for 4)||'9'||substring(p from 5) else p end;
   update marketing_private.contacts set state='unsubscribed',revoked_at=now(),challenge=gen_random_uuid() where store_id=s and phone in (p,alternate);
   update marketing_private.jobs set state='suppressed',result_code='UNSUBSCRIBED',finished_at=now() where store_id=s and phone in (p,alternate) and state in ('pending','claimed');
   insert into marketing_private.events(store_id,kind,entity,detail)
    select s,'unsubscribe_whatsapp',p,jsonb_build_object('provider_id',a->>'provider_id','timestamp',stamp)
    where exists(select 1 from marketing_private.contacts where store_id=s and phone in (p,alternate));
  elsif c.state='pending' and stamp>=date_trunc('second',c.requested_at) and c.requested_at>now()-interval '48 hours'
    and content='ACEITO PROMOCOES '||upper(c.challenge::text) then
   update marketing_private.contacts set state='opted_in',consent_at=now(),revoked_at=null,challenge=gen_random_uuid() where store_id=s and phone=p;
   insert into marketing_private.events(store_id,kind,entity,detail) values(s,'consent_confirmed',p,jsonb_build_object('provider_id',a->>'provider_id','timestamp',stamp,'policy',c.policy,'sender_phone',coalesce(a->>'sender_phone',p),'verification',coalesce(a->>'verification','exact_number')));
  end if;
  return '{}'::jsonb;
 end if;
 if op='synced' then
  stamp:=(a->>'until')::timestamptz;
  if stamp is null or stamp>now()+interval '1 minute' or stamp<cfg.inbound_cursor then raise exception 'INVALID_CURSOR'; end if;
  update marketing_private.settings set inbound_cursor=stamp,synced_at=now() where store_id=s;
  return '{}'::jsonb;
 end if;
 cid:=(a->>'claim_id')::uuid;
 if cid is null then raise exception 'CLAIM_REQUIRED'; end if;
 select * into j from marketing_private.jobs where store_id=s and claim_id=cid for update;
 if op='claim' then
  if found then return to_jsonb(j); end if;
  if not cfg.enabled or cfg.synced_at is null or cfg.synced_at<now()-interval '30 seconds' then return 'null'::jsonb; end if;
  -- Lost journals never cause an automatic resend. They remain visible for review.
  update marketing_private.jobs set state='uncertain',result_code='ORPHANED_CLAIM',finished_at=now() where store_id=s and state in ('claimed','sending') and claimed_at<now()-interval '30 minutes';
  select q.* into j from marketing_private.jobs q join marketing_private.campaigns k on k.store_id=q.store_id and k.id=q.campaign_id
   join marketing_private.contacts x on x.store_id=q.store_id and x.phone=q.phone
   where q.store_id=s and q.state='pending' and k.state='approved' and x.state='opted_in'
   order by k.created_at,q.id limit 1 for update of q skip locked;
  if not found then return 'null'::jsonb; end if;
  update marketing_private.jobs set state='claimed',claim_id=cid,claimed_at=now() where store_id=s and id=j.id returning * into j;
  insert into marketing_private.events(store_id,kind,entity) values(s,'job_claimed',j.id::text);
  return to_jsonb(j);
 end if;
 if j.id is null then raise exception 'CLAIM_NOT_FOUND'; end if;
 if op='authorize' then
  if j.state not in ('claimed','sending') then return jsonb_build_object('allowed',false,'terminal',true); end if;
  select state into campaign_state from marketing_private.campaigns where store_id=s and id=j.campaign_id;
  if not exists(select 1 from marketing_private.contacts where store_id=s and phone=j.phone and state='opted_in') or campaign_state='cancelled' then
   update marketing_private.jobs set state='suppressed',finished_at=now(),result_code='CONSENT_OR_CAMPAIGN_REVOKED' where store_id=s and id=j.id;
   return jsonb_build_object('allowed',false,'terminal',true);
  end if;
  if not cfg.enabled or campaign_state<>'approved' or cfg.synced_at is null or cfg.synced_at<now()-interval '30 seconds' then return jsonb_build_object('allowed',false); end if;
  if j.authorized_at is null then
   if cfg.window_start<=now()-interval '5 minutes' then cfg.window_count:=0; cfg.window_start:=now(); end if;
   if cfg.window_count>=6 then return jsonb_build_object('allowed',false); end if;
   update marketing_private.settings set window_start=cfg.window_start,window_count=cfg.window_count+1 where store_id=s;
   update marketing_private.jobs set state='sending',authorized_at=now() where store_id=s and id=j.id;
   insert into marketing_private.events(store_id,kind,entity) values(s,'dispatch_authorized',j.id::text);
  end if;
  return jsonb_build_object('allowed',true);
 end if;
 if op='finish' then
  result:=a->>'state';
  if result not in ('accepted','uncertain') or length(coalesce(a->>'code',''))>100 then raise exception 'INVALID_RESULT'; end if;
  if j.state in ('accepted','uncertain','suppressed') then return jsonb_build_object('ok',true); end if;
  if j.state<>'sending' then raise exception 'NOT_AUTHORIZED'; end if;
  if result='accepted' and (length(coalesce(a->>'provider_id','')) not between 1 and 150) then raise exception 'PROVIDER_ID_REQUIRED'; end if;
  update marketing_private.jobs set state=result,provider_id=left(a->>'provider_id',150),result_code=a->>'code',finished_at=now() where store_id=s and id=j.id;
  insert into marketing_private.events(store_id,kind,entity,detail) values(s,'job_'||result,j.id::text,jsonb_build_object('code',a->>'code','provider_id',a->>'provider_id'));
  update marketing_private.campaigns set state='completed' where store_id=s and id=j.campaign_id and state='approved'
   and not exists(select 1 from marketing_private.jobs where store_id=s and campaign_id=j.campaign_id and state in ('pending','claimed','sending'));
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'UNKNOWN_OPERATION';
end $$;
notify pgrst,'reload schema';
commit;
