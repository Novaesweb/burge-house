import { createClient } from '@supabase/supabase-js';

export const centralUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || '';
export const isSupabaseConfigured = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(centralUrl) && publicKey.startsWith('sb_publishable_');
export const supabase = isSupabaseConfigured ? createClient(centralUrl, publicKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null;

export function requireSupabase() {
  if (!supabase) throw new Error('Configure a URL e a chave pública publishable do Supabase.');
  return supabase;
}
