export interface ScheduleOptions {
  enabled: boolean;
  server_now: string;
  slots: string[];
  preparation_minutes: number;
  fulfillment_modes: Array<'delivery' | 'pickup'>;
}

export function parseScheduleOptions(value: unknown): ScheduleOptions | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (data.enabled !== true || typeof data.server_now !== 'string' || !Number.isFinite(Date.parse(data.server_now))) return null;
  if (!Array.isArray(data.slots) || !data.slots.every(slot => typeof slot === 'string' && Number.isFinite(Date.parse(slot)))) return null;
  const modes = Array.isArray(data.fulfillment_modes) ? data.fulfillment_modes.filter((mode): mode is 'delivery' | 'pickup' => mode === 'delivery' || mode === 'pickup') : [];
  if (!modes.length || typeof data.preparation_minutes !== 'number' || data.preparation_minutes < 0 || data.preparation_minutes > 1440) return null;
  return { enabled: true, server_now: data.server_now, slots: data.slots as string[], preparation_minutes: data.preparation_minutes, fulfillment_modes: modes };
}

export function formatScheduledTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
