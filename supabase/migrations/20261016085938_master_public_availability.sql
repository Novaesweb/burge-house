-- Public, read-only availability for a known official store. This exposes no
-- owner, billing, catalogue, customer, or administrative information.
create or replace function public.delivery_public_availability(p_store_id uuid)
returns table (
  status text,
  block_mode text,
  block_message text,
  block_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.status,
    s.block_mode,
    nullif(left(s.block_message, 2000), ''),
    s.block_until
  from public.managed_sites s
  where s.id = p_store_id;
$$;

revoke all on function public.delivery_public_availability(uuid) from public, anon, authenticated;
grant execute on function public.delivery_public_availability(uuid) to anon, authenticated;
