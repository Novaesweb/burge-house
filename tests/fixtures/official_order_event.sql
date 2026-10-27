-- Read-only snapshot of the central RPC audited 27/10/2026.
-- Test fixture only. Never apply this file to the central database.
CREATE OR REPLACE FUNCTION public.novaesweb_record_order_event(p_store_id uuid, p_order_ref text, p_event_type order_lifecycle_event_type, p_status_from text DEFAULT NULL::text, p_status_to text DEFAULT NULL::text, p_reason_category order_cancellation_category DEFAULT NULL::order_cancellation_category, p_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_timestamp timestamptz := coalesce(p_occurred_at, now());
  v_count bigint;
begin
  if auth.uid() is null or not public.novaesweb_connect_is_active_store_member(p_store_id)
     or not exists (select 1 from public.store_members sm where sm.store_id = p_store_id
       and sm.user_id = auth.uid() and sm.is_active and sm.role in ('owner', 'admin')) then
    raise exception 'Sessão com papel owner/admin e vínculo ativo obrigatórios.' using errcode = '42501';
  end if;
  if p_event_type is null or p_event_type = 'adjustment' then
    raise exception 'Correção exige RPC exclusivo do Master, com justificativa.' using errcode = '42501';
  end if;
  if p_order_ref is null or length(btrim(p_order_ref)) not between 1 and 120 then
    raise exception 'Identificador técnico inválido.' using errcode = '22023';
  end if;
  if v_timestamp < now() - interval '48 hours' or v_timestamp > now() + interval '5 minutes' then
    raise exception 'Data fora da janela permitida.' using errcode = '22023';
  end if;
  -- Serializa o mesmo pedido, inclusive chamadas simultâneas dos dois RPCs.
  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || btrim(p_order_ref), 0));
  if p_event_type = 'accepted' then
    insert into public.store_order_usage_events(store_id, order_ref, accepted_at, competence, source)
    values (p_store_id, btrim(p_order_ref), v_timestamp, public.novaesweb_order_competence(v_timestamp), 'store_rpc')
    on conflict (store_id, order_ref) do nothing;
    -- O primeiro aceite persistido define a competência, mesmo em replay com timestamp diferente.
    select accepted_at into v_timestamp from public.store_order_usage_events
      where store_id = p_store_id and order_ref = btrim(p_order_ref);
  end if;
  insert into public.store_order_lifecycle_events
    (store_id, order_ref, event_type, reason_category, occurred_at, competence, source)
  values (p_store_id, btrim(p_order_ref), p_event_type, p_reason_category, v_timestamp,
    to_char(public.novaesweb_order_competence(v_timestamp), 'YYYY-MM'), 'store_rpc')
  on conflict (store_id, order_ref, event_type) do nothing;
  get diagnostics v_count = row_count;
  -- Status livres recebidos não são copiados: não são evidência nem necessários à contagem.
  return jsonb_build_object('recorded', v_count = 1, 'already_counted', v_count = 0,
    'event_type', p_event_type, 'competence', to_char(public.novaesweb_order_competence(v_timestamp), 'YYYY-MM'));
end $function$
;

