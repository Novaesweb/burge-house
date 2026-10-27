import { requireSupabase } from '../lib/supabase';
import { parseScheduleOptions, type ScheduleOptions } from '../utils/scheduling';
export { formatScheduledTime, parseScheduleOptions, type ScheduleOptions } from '../utils/scheduling';

/** Unavailable contracts leave immediate checkout untouched; never simulate enablement. */
export async function loadScheduleOptions(storeId: string): Promise<ScheduleOptions | null> {
  const { data, error } = await requireSupabase().rpc('delivery_schedule_options', { p_store_id: storeId });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') return null;
    throw new Error('Não foi possível consultar os horários. Tente atualizar os horários.');
  }
  return parseScheduleOptions(data);
}

