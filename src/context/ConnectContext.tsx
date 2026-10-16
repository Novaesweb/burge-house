import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { checkIn, getRegistrationStatus, validateOfficialStore, type OfficialStore, type RegistrationStatus } from '../services/connectService';

type Connection = { session: Session | null; loading: boolean; store: OfficialStore | null; registration: RegistrationStatus | null; error: string; recoveryMode: boolean; clearRecoveryMode: () => void; refresh: (requestId?: string) => Promise<void>; signOut: () => Promise<void> };
const Context = createContext<Connection | null>(null);
export function ConnectProvider({ children }: {children: React.ReactNode}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<OfficialStore | null>(null);
  const [registration, setRegistration] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const generation = useRef(0);
  const lastCheckIn = useRef(0);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) {setSession(data.session); setLoading(false);} });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      // Do not await Supabase calls inside this callback (Auth holds a lock).
      if (active) { setSession(next); setRecoveryMode(event === 'PASSWORD_RECOVERY'); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const refresh = useCallback(async (providedRequestId?: string) => {
    const revision = ++generation.current;
    if (!session || !supabase) { setStore(null); setRegistration(null); setError(''); return; }
    try {
      const requestId = providedRequestId || import.meta.env.VITE_NOVAESWEB_REQUEST_ID?.trim() || localStorage.getItem(`novaesweb:request:${session.user.id}`);
      const configuredStoreId = import.meta.env.VITE_NOVAESWEB_STORE_ID?.trim();
      const configuredNxId = import.meta.env.VITE_NOVAESWEB_NX_ID?.trim();
      let candidate: OfficialStore | null = null;
      // Once a store has official Master identifiers, they are authoritative.
      // An old browser request id must never send an established store back to
      // the legacy registration flow.
      if (configuredStoreId && configuredNxId) {
        candidate = await validateOfficialStore(configuredStoreId, configuredNxId);
      } else if (requestId) {
        const result = await getRegistrationStatus(requestId);
        if (revision !== generation.current) return;
        setRegistration(result);
        if (result.status === 'approved') candidate = await validateOfficialStore(result.store_id || '', result.nx_id || '');
      }
      if (revision !== generation.current) return;
      if (candidate && Date.now() - lastCheckIn.current > 240_000) {
        await checkIn(candidate);
        lastCheckIn.current = Date.now();
        candidate = { ...candidate, status:'active' };
      }
      if (revision !== generation.current) return;
      setStore(candidate); setError('');
    } catch (failure) {
      if (revision !== generation.current) return;
      setStore(null); setError(failure instanceof Error ? failure.message : 'Falha ao conferir a conexão.');
    }
  }, [session]);

  useEffect(() => {
    setStore(null); lastCheckIn.current = 0;
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { ++generation.current; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  const signOut = async () => {
    ++generation.current; setStore(null); setRegistration(null); setRecoveryMode(false);
    const result = await supabase?.auth.signOut();
    if (result?.error) throw result.error;
    setSession(null);
  };
  return <Context.Provider value={{session,loading,store,registration,error,recoveryMode,clearRecoveryMode:()=>setRecoveryMode(false),refresh,signOut}}>{children}</Context.Provider>;
}
export function useConnect() { const context = useContext(Context); if (!context) throw new Error('ConnectProvider ausente.'); return context; }
