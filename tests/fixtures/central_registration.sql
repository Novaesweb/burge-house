-- Solicitacoes autenticadas de cadastro de sites, aprovacao MASTER e criacao atomica.
-- Nenhuma loja ou identificador oficial e criado ate a aprovacao no backend.

alter table public.managed_sites
  add column registration_key text;

create unique index managed_sites_registration_key_ci_unique
  on public.managed_sites (lower(registration_key))
  where registration_key is not null;

create table public.site_registration_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  requester_contact text,
  site_name text not null check (length(btrim(site_name)) between 1 and 160),
  owner_name text check (owner_name is null or length(btrim(owner_name)) <= 160),
  site_domain text check (
    site_domain is null or (
      length(btrim(site_domain)) between 4 and 253
      and site_domain = lower(btrim(site_domain))
    )
  ),
  plan_code text check (plan_code is null or length(btrim(plan_code)) <= 80),
  idempotency_key uuid not null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or length(review_note) <= 500),
  resulting_store_id uuid unique references public.managed_sites(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_user_id, idempotency_key)
);

comment on table public.site_registration_requests is
  'Solicitacoes autenticadas para cadastro de site. Somente uma aprovacao MASTER cria um registro oficial.';
comment on column public.managed_sites.registration_key is
  'Dominio canonico usado para impedir cadastro duplicado de um mesmo site.';

create index site_registration_requests_requester_created_idx
  on public.site_registration_requests(requester_user_id, created_at desc);
create index site_registration_requests_status_created_idx
  on public.site_registration_requests(status, created_at desc);
create unique index site_registration_requests_pending_domain_ci_unique
  on public.site_registration_requests(lower(site_domain))
  where status = 'pending_approval' and site_domain is not null;

create trigger site_registration_requests_touch_updated_at
before update on public.site_registration_requests
for each row execute function public.novaesweb_connect_touch_updated_at();

alter table public.site_registration_requests enable row level security;
revoke all on public.site_registration_requests from anon, authenticated;
grant select on public.site_registration_requests to authenticated;

create policy site_registration_requests_read_owner_or_master
  on public.site_registration_requests for select to authenticated
  using (
    requester_user_id = (select auth.uid())
    or (select public.novaesweb_connect_is_active_master())
  );

-- O navegador pode ler apenas suas solicitacoes (MASTER pode ler a fila).
-- Escritas sao realizadas pela Edge Function; nao existem policies de escrita para clientes.

create or replace function public.novaesweb_create_site_registration_request(
  p_requester_user_id uuid,
  p_requester_contact text,
  p_site_name text,
  p_owner_name text,
  p_site_domain text,
  p_plan_code text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.site_registration_requests%rowtype;
  v_request public.site_registration_requests%rowtype;
  v_recent_count integer;
begin
  if p_requester_user_id is null or p_idempotency_key is null
     or p_site_name is null or length(btrim(p_site_name)) not between 1 and 160
     or (p_site_domain is not null and (
       length(btrim(p_site_domain)) not between 4 and 253
       or p_site_domain <> lower(btrim(p_site_domain))
     )) then
    raise exception using errcode = '22023', message = 'INVALID_REGISTRATION_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_requester_user_id::text, 0));

  select * into v_existing
  from public.site_registration_requests r
  where r.requester_user_id = p_requester_user_id
    and r.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('request_id', v_existing.id, 'status', v_existing.status);
  end if;

  select count(*) into v_recent_count
  from public.site_registration_requests r
  where r.requester_user_id = p_requester_user_id
    and r.created_at > now() - interval '24 hours';
  if v_recent_count >= 5 then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_RATE_LIMIT';
  end if;

  if p_site_domain is not null and (exists (
    select 1 from public.managed_sites s
    where lower(s.registration_key) = lower(p_site_domain)
  ) or exists (
    select 1 from public.store_domains d
    where lower(d.domain) = lower(p_site_domain)
  )) then
    raise exception using errcode = '23505', message = 'SITE_ALREADY_REGISTERED';
  end if;

  insert into public.site_registration_requests (
    requester_user_id, requester_contact, site_name, owner_name, site_domain,
    plan_code, idempotency_key
  ) values (
    p_requester_user_id, nullif(btrim(p_requester_contact), ''), btrim(p_site_name),
    nullif(btrim(p_owner_name), ''), nullif(btrim(p_site_domain), ''), nullif(btrim(p_plan_code), ''),
    p_idempotency_key
  ) returning * into v_request;

  insert into public.master_audit_log (
    actor_user_id, action, entity_type, entity_id, result, metadata
  ) values (
    p_requester_user_id, 'site_registration_request', 'site_registration_request',
    v_request.id::text, 'success', jsonb_build_object('site_domain', v_request.site_domain)
  );

  insert into public.master_notifications (
    recipient_user_id, category, title, body, entity_type, entity_id
  )
  select p.user_id, 'site_registration', 'Nova solicitação de site',
    v_request.site_name || coalesce(' · ' || v_request.site_domain, ''),
    'site_registration_request', v_request.id::text
  from public.master_profiles p
  where p.role = 'MASTER' and p.is_active;

  return jsonb_build_object('request_id', v_request.id, 'status', v_request.status);
end;
$$;

revoke all on function public.novaesweb_create_site_registration_request(uuid, text, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.novaesweb_create_site_registration_request(uuid, text, text, text, text, text, uuid)
  to service_role;

create or replace function public.novaesweb_review_site_registration(
  p_request_id uuid,
  p_reviewer_user_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.site_registration_requests%rowtype;
  v_store_id uuid;
  v_nx_id text;
begin
  if p_decision not in ('approve', 'reject') or p_reviewer_user_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REVIEW_DECISION';
  end if;
  if not exists (
    select 1 from public.master_profiles p
    where p.user_id = p_reviewer_user_id and p.role = 'MASTER' and p.is_active
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_MASTER_REQUIRED';
  end if;

  select * into v_request
  from public.site_registration_requests r
  where r.id = p_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND';
  end if;

  -- A repeated approval is idempotent and returns the original official identifiers.
  if v_request.status = 'approved' then
    select s.id, s.nx_id into v_store_id, v_nx_id
    from public.managed_sites s where s.id = v_request.resulting_store_id;
    return jsonb_build_object(
      'request_id', v_request.id, 'status', 'approved',
      'store_id', v_store_id, 'nx_id', v_nx_id
    );
  end if;
  if v_request.status <> 'pending_approval' then
    raise exception using errcode = 'P0001', message = 'REQUEST_ALREADY_REVIEWED';
  end if;
  if p_review_note is not null and length(p_review_note) > 500 then
    raise exception using errcode = '22023', message = 'REVIEW_NOTE_TOO_LONG';
  end if;

  if p_decision = 'reject' then
    update public.site_registration_requests
    set status = 'rejected', reviewed_by = p_reviewer_user_id,
        reviewed_at = now(), review_note = nullif(btrim(p_review_note), '')
    where id = v_request.id;

    insert into public.master_audit_log (
      actor_user_id, action, entity_type, entity_id, result, reason, metadata
    ) values (
      p_reviewer_user_id, 'site_registration_rejected', 'site_registration_request',
      v_request.id::text, 'success', nullif(btrim(p_review_note), ''),
      jsonb_build_object('requester_user_id', v_request.requester_user_id,
        'site_domain', v_request.site_domain)
    );
    insert into public.master_notifications (
      recipient_user_id, category, title, body, entity_type, entity_id
    ) values (
      v_request.requester_user_id, 'site_registration', 'Solicitação de site recusada',
      coalesce(nullif(btrim(p_review_note), ''), 'O MASTER recusou a solicitação.'),
      'site_registration_request', v_request.id::text
    );
    return jsonb_build_object('request_id', v_request.id, 'status', 'rejected');
  end if;

  if v_request.site_domain is not null and (exists (
    select 1 from public.managed_sites s
    where lower(s.registration_key) = lower(v_request.site_domain)
  ) or exists (
    select 1 from public.store_domains d
    where lower(d.domain) = lower(v_request.site_domain)
  )) then
    raise exception using errcode = '23505', message = 'SITE_ALREADY_REGISTERED';
  end if;

  v_store_id := gen_random_uuid();
  v_nx_id := 'NX-' || upper(replace(v_store_id::text, '-', ''));

  insert into public.managed_sites (
    id, nx_id, name, owner_id, owner_name, status, plan_code, registration_key
  ) values (
    v_store_id, v_nx_id, v_request.site_name, v_request.requester_user_id,
    v_request.owner_name, 'pending', v_request.plan_code, v_request.site_domain
  );

  insert into public.store_members (store_id, user_id, role, is_active)
  values (v_store_id, v_request.requester_user_id, 'owner', true);

  if v_request.site_domain is not null then
    insert into public.store_domains (store_id, domain, is_primary, verification_status)
    values (v_store_id, v_request.site_domain, true, 'pending');
  end if;

  insert into public.store_integrations (store_id, provider, contract_version, status)
  values (v_store_id, 'novaesweb', '1.1', 'pending');

  update public.site_registration_requests
  set status = 'approved', reviewed_by = p_reviewer_user_id,
      reviewed_at = now(), review_note = nullif(btrim(p_review_note), ''),
      resulting_store_id = v_store_id
  where id = v_request.id;

  insert into public.master_audit_log (
    actor_user_id, store_id, action, entity_type, entity_id, result, metadata
  ) values (
    p_reviewer_user_id, v_store_id, 'site_registration_approved', 'managed_site',
    v_store_id::text, 'success', jsonb_build_object(
      'request_id', v_request.id, 'requester_user_id', v_request.requester_user_id,
      'nx_id', v_nx_id, 'site_domain', v_request.site_domain
    )
  );

  insert into public.master_notifications (
    recipient_user_id, category, title, body, entity_type, entity_id
  ) values (
    v_request.requester_user_id, 'site_registration', 'Cadastro do site aprovado',
    'ID NX: ' || v_nx_id || ' · UUID: ' || v_store_id::text,
    'managed_site', v_store_id::text
  );

  return jsonb_build_object(
    'request_id', v_request.id, 'status', 'approved',
    'store_id', v_store_id, 'nx_id', v_nx_id
  );
end;
$$;

revoke all on function public.novaesweb_review_site_registration(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.novaesweb_review_site_registration(uuid, uuid, text, text)
  to service_role;

create or replace function public.novaesweb_register_manual_site(
  p_actor_user_id uuid,
  p_nx_id text,
  p_name text,
  p_owner_id uuid,
  p_site_domain text,
  p_owner_name text default null,
  p_plan_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store public.managed_sites%rowtype;
begin
  if not exists (
    select 1 from public.master_profiles p
    where p.user_id = p_actor_user_id and p.role = 'MASTER' and p.is_active
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_MASTER_REQUIRED';
  end if;
  if p_nx_id is null or length(btrim(p_nx_id)) not between 1 and 64
     or p_name is null or length(btrim(p_name)) not between 1 and 160
     or p_owner_id is null or p_site_domain is null
     or length(btrim(p_site_domain)) not between 4 and 253
     or p_site_domain <> lower(btrim(p_site_domain)) then
    raise exception using errcode = '22023', message = 'INVALID_MANUAL_REGISTRATION';
  end if;

  if exists (
    select 1 from public.managed_sites s
    where lower(s.registration_key) = lower(p_site_domain)
  ) or exists (
    select 1 from public.store_domains d
    where lower(d.domain) = lower(p_site_domain)
  ) or exists (
    select 1 from public.site_registration_requests r
    where lower(r.site_domain) = lower(p_site_domain)
      and r.status = 'pending_approval'
  ) then
    raise exception using errcode = '23505', message = 'SITE_ALREADY_REGISTERED_OR_PENDING';
  end if;

  insert into public.managed_sites (
    nx_id, name, owner_id, owner_name, plan_code, status, registration_key
  ) values (
    btrim(p_nx_id), btrim(p_name), p_owner_id, nullif(btrim(p_owner_name), ''),
    nullif(btrim(p_plan_code), ''), 'pending', btrim(p_site_domain)
  ) returning * into v_store;

  insert into public.store_members (store_id, user_id, role, is_active)
  values (v_store.id, p_owner_id, 'owner', true);
  insert into public.store_domains (store_id, domain, is_primary, verification_status)
  values (v_store.id, btrim(p_site_domain), true, 'pending');
  insert into public.store_integrations (store_id, provider, contract_version, status)
  values (v_store.id, 'novaesweb', '1.1', 'pending');
  insert into public.master_audit_log (
    actor_user_id, store_id, action, entity_type, entity_id, result, metadata
  ) values (
    p_actor_user_id, v_store.id, 'official_site_registration', 'managed_site',
    v_store.id::text, 'success', jsonb_build_object('nx_id', v_store.nx_id, 'owner_id', p_owner_id)
  );

  return jsonb_build_object(
    'site', jsonb_build_object(
      'id', v_store.id, 'nx_id', v_store.nx_id, 'name', v_store.name,
      'owner_id', v_store.owner_id, 'owner_name', v_store.owner_name,
      'status', v_store.status, 'plan_code', v_store.plan_code,
      'created_at', v_store.created_at
    )
  );
end;
$$;

revoke all on function public.novaesweb_register_manual_site(uuid, text, text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.novaesweb_register_manual_site(uuid, text, text, uuid, text, text, text)
  to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'site_registration_requests'
     ) then
    alter publication supabase_realtime add table public.site_registration_requests;
  end if;
end;
$$;
