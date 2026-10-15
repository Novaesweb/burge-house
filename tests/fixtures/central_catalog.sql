-- NovaesWeb Connect: catálogo oficial multi-loja e leitura isolada por RLS.
-- Nenhum dado/ID de loja é criado por esta migration.

create table public.managed_sites (
  id uuid primary key default gen_random_uuid(),
  nx_id text not null unique check (length(btrim(nx_id)) between 1 and 64),
  name text not null check (length(btrim(name)) between 1 and 160),
  owner_id uuid references auth.users(id) on delete set null,
  owner_name text check (owner_name is null or length(btrim(owner_name)) <= 160),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'archived')),
  plan_code text check (plan_code is null or length(btrim(plan_code)) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.managed_sites is 'Cadastro oficial das lojas NovaesWeb. nx_id é fornecido pelo fluxo oficial e nunca é gerado em buscas.';
comment on column public.managed_sites.nx_id is 'Identificador público estável da loja; não é credencial nem autorização.';

create table public.store_members (
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'staff', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index store_members_user_active_idx on public.store_members(user_id, store_id) where is_active;

create table public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  domain text not null check (length(btrim(domain)) between 1 and 253),
  is_primary boolean not null default false,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed')),
  created_at timestamptz not null default now(),
  unique (store_id, domain)
);
create unique index store_domains_domain_ci_unique on public.store_domains(lower(domain));
create unique index store_domains_one_primary_per_store on public.store_domains(store_id) where is_primary;
create index store_domains_store_idx on public.store_domains(store_id);

create table public.store_integrations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.managed_sites(id) on delete cascade,
  provider text not null check (length(btrim(provider)) between 1 and 80),
  project_ref text check (project_ref is null or length(btrim(project_ref)) <= 120),
  contract_version text not null default '1.0',
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'error', 'disabled')),
  last_seen_at timestamptz,
  last_error_code text check (last_error_code is null or length(last_error_code) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, provider)
);
create index store_integrations_store_idx on public.store_integrations(store_id);

create table public.store_settings (
  store_id uuid primary key references public.managed_sites(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);
comment on column public.store_settings.settings is 'Somente preferências não secretas. Credenciais devem ficar em secrets do backend.';

alter table public.master_audit_log
  add column store_id uuid references public.managed_sites(id) on delete set null;
create index master_audit_log_store_created_idx
  on public.master_audit_log(store_id, created_at desc) where store_id is not null;

create or replace function public.novaesweb_connect_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.novaesweb_connect_touch_updated_at() from public, anon, authenticated;
grant execute on function public.novaesweb_connect_touch_updated_at() to service_role;

create trigger managed_sites_touch_updated_at
before update on public.managed_sites
for each row execute function public.novaesweb_connect_touch_updated_at();
create trigger store_integrations_touch_updated_at
before update on public.store_integrations
for each row execute function public.novaesweb_connect_touch_updated_at();
create trigger store_settings_touch_updated_at
before update on public.store_settings
for each row execute function public.novaesweb_connect_touch_updated_at();

-- SECURITY INVOKER: autorização vem do perfil/membership ativo, sem bypass de RLS.
create or replace function public.novaesweb_connect_is_active_master()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.master_profiles p
    where p.user_id = (select auth.uid())
      and p.is_active
      and p.role = 'MASTER'
  );
$$;

create or replace function public.novaesweb_connect_is_active_store_member(target_store_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.store_members sm
    where sm.store_id = target_store_id
      and sm.user_id = (select auth.uid())
      and sm.is_active
  );
$$;
revoke all on function public.novaesweb_connect_is_active_master() from public, anon;
revoke all on function public.novaesweb_connect_is_active_store_member(uuid) from public, anon;
grant execute on function public.novaesweb_connect_is_active_master() to authenticated;
grant execute on function public.novaesweb_connect_is_active_store_member(uuid) to authenticated;

alter table public.managed_sites enable row level security;
alter table public.store_members enable row level security;
alter table public.store_domains enable row level security;
alter table public.store_integrations enable row level security;
alter table public.store_settings enable row level security;

revoke all on public.managed_sites, public.store_members, public.store_domains,
  public.store_integrations, public.store_settings from anon, authenticated;
grant select on public.managed_sites, public.store_members, public.store_domains,
  public.store_integrations, public.store_settings to authenticated;

create policy managed_sites_read_authorized
  on public.managed_sites for select to authenticated
  using (
    (select public.novaesweb_connect_is_active_master())
    or (select public.novaesweb_connect_is_active_store_member(id))
  );

create policy store_members_read_self_or_master
  on public.store_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.novaesweb_connect_is_active_master()));

create policy store_domains_read_store_authorized
  on public.store_domains for select to authenticated
  using ((select public.novaesweb_connect_is_active_master()) or (select public.novaesweb_connect_is_active_store_member(store_id)));

create policy store_integrations_read_store_authorized
  on public.store_integrations for select to authenticated
  using ((select public.novaesweb_connect_is_active_master()) or (select public.novaesweb_connect_is_active_store_member(store_id)));

create policy store_settings_read_store_authorized
  on public.store_settings for select to authenticated
  using ((select public.novaesweb_connect_is_active_master()) or (select public.novaesweb_connect_is_active_store_member(store_id)));

-- Only the trusted Edge Function (service role) may write these tables/audit rows.
-- Authenticated browser clients receive SELECT only; there are no broad write policies.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'managed_sites'
     ) then
    alter publication supabase_realtime add table public.managed_sites;
  end if;
end;
$$;
