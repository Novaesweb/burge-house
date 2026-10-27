export const isStoreOperational = (status?: string | null): boolean => status === 'active';
export const canUseRestrictedAccount = (role?: string | null): boolean => role === 'owner' || role === 'admin';
export function storeStatusLabel(status?: string | null): string {
  return ({ active: 'Ativa', pending: 'Conexão pendente', maintenance: 'Em manutenção', suspended: 'Suspensa', archived: 'Arquivada' } as Record<string, string>)[status || ''] || 'Indisponível';
}
export function checkInRetryDelay(failures: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, failures - 1), 15 * 60_000);
}
