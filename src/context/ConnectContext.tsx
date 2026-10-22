import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { checkIn, getRegistrationStatus, validateOfficialStore, type OfficialStore, type RegistrationStatus } from '../services/connectService';

type Connection = { session: Session | null; loading: boolean; store: OfficialStore | null; registration: RegistrationStatus | null; error: string; recoveryMode: boolean; clearRecoveryMode: () => void; refresh: (requestId?: string) => Promise<void>; signOut: () => Promise<void> };
const Context = createContext<Connection | null>(null);
export function ConnectProvider({ children }: {children: React.ReactNode}) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [validationIdentity, setValidationIdentity] = useState<string | null>(null);
  const [store, setStore] = useState<OfficialStore | null>(null);
  const [registration, setRegistration] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const generation = useRef(0);
  const lastCheckIn = useRef(0);
  const currentSession = useRef<Session | null>(null);
  const userId = session?.user.id || null;
  const loading = authLoading || Boolean(userId && validationIdentity !== userId);
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let active = true;
    let receivedAuthEvent = false;
    const applySession = (next: Session | null) => {
      if (!active) return;
      // Refreshing a token (or returning to this tab) is not a new login.
      // Only an identity change invalidates access already checked for this user.
      if (currentSession.current?.user.id !== next?.user.id) {
        ++generation.current;
        lastCheckIn.current = 0;
        setStore(null); setRegistration(null); setError(''); setValidationIdentity(null);
        setRecoveryMode(false);
      }
      currentSession.current = next;
      setSession(next); setAuthLoading(false);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      // Do not await Supabase calls inside this callback (Auth holds a lock).
      receivedAuthEvent = true;
      applySession(next);
      if (active && event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      // A late session read must not overwrite a newer sign-in or sign-out event.
      if (!active || receivedAuthEvent) return;
      applySession(sessionError ? null : data.session);
      if (sessionError) setError('Não foi possível recuperar sua sessão. Entre novamente.');
    }).catch(() => {
      if (!active || receivedAuthEvent) return;
      applySession(null);
      setError('Não foi possível recuperar sua sessão. Entre novamente.');
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const refresh = useCallback(async (providedRequestId?: string) => {
    const revision = ++generation.current;
    if (!userId || !supabase) { setStore(null); setRegistration(null); setError(''); setValidationIdentity(null); return; }
    try {
      const requestId = providedRequestId || import.meta.env.VITE_NOVAESWEB_REQUEST_ID?.trim() || localStorage.getItem(`novaesweb:request:${userId}`);
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
      }
      if (revision !== generation.current) return;
      setStore(candidate); setError('');
    } catch (failure) {
      if (revision !== generation.current) return;
      setStore(null); setError(failure instanceof Error ? failure.message : 'Falha ao conferir a conexão.');
    } finally {
      if (revision === generation.current) setValidationIdentity(userId);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { ++generation.current; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  const signOut = async () => {
    ++generation.current; setStore(null); setRegistration(null); setValidationIdentity(null); setRecoveryMode(false);
    const result = await supabase?.auth.signOut();
    if (result?.error) { await refresh(); throw result.error; }
    currentSession.current = null;
    setSession(null);
  };
  return <Context.Provider value={{session,loading,store,registration,error,recoveryMode,clearRecoveryMode:()=>setRecoveryMode(false),refresh,signOut}}>{children}</Context.Provider>;
}
export function useConnect() { const context = useContext(Context); if (!context) throw new Error('ConnectProvider ausente.'); return context; }
