import { requireSupabase } from '../lib/supabase';

export interface OwnerMessage {
  id: string; store_id: string; recipient_user_id: string; category: string;
  title: string; body: string; created_at: string; read_at: string | null;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function identity(storeId: string) {
  if (!uuid.test(storeId)) throw new Error('Loja oficial inválida.');
  const client = requireSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Entre novamente para consultar suas mensagens.');
  return { client, user };
}
export async function getOwnerMessages(storeId: string): Promise<OwnerMessage[]> {
  const { client, user } = await identity(storeId);
  // Filters organize the mailbox; RLS remains the authorization boundary.
  const { data, error } = await client.from('store_owner_messages')
    .select('id,store_id,recipient_user_id,category,title,body,created_at,read_at')
    .eq('store_id', storeId).eq('recipient_user_id', user.id)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Não foi possível consultar suas mensagens. Tente novamente.');
  return (data || []) as OwnerMessage[];
}
export async function markOwnerMessageRead(storeId: string, id: string): Promise<void> {
  if (!uuid.test(id)) throw new Error('Mensagem inválida.');
  const { client, user } = await identity(storeId);
  const { data, error } = await client.from('store_owner_messages')
    .update({ read_at: new Date().toISOString() }).eq('store_id', storeId)
    .eq('recipient_user_id', user.id).eq('id', id).select('id').maybeSingle();
  if (error || !data) throw new Error('Não foi possível marcar esta mensagem como lida.');
}
