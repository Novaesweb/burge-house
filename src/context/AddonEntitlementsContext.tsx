import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AddonCode } from '../addons/registry';
import { useConnect } from './ConnectContext';
import { checkInInstalledAddons, getStoreAddonCatalog, isAddonTechnicallyAvailable, type StoreAddonCatalog } from '../services/addonService';
import { supabase } from '../lib/supabase';

type AddonEntitlements = {
  loading: boolean;
  activeCodes: ReadonlySet<string>;
  hasAny: (codes: readonly AddonCode[]) => boolean;
  refresh: () => Promise<void>;
};

const Context = createContext<AddonEntitlements | null>(null);

export function AddonEntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { store } = useConnect();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StoreAddonCatalog | null>(null);
  const lastCheckIn = useRef(0);

  const refresh = useCallback(async () => {
    if (!store || !['owner', 'admin'].includes(store.role)) {
      setData(null); setLoading(false); return;
    }
    setLoading(true);
    try {
      // Local development never declares a deployment. The production bundle
      // performs one authenticated declaration at most every four minutes.
      if (import.meta.env.PROD && Date.now() - lastCheckIn.current > 240_000) {
        await checkInInstalledAddons(store.nx_id);
        lastCheckIn.current = Date.now();
      }
      setData(await getStoreAddonCatalog(store.id));
    }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [store]);

  useEffect(() => {
    void refresh();
    const client = supabase;
    if (!store || !client) return;
    const refreshOnChange = () => { void refresh(); };
    const channel = client.channel(`novaesweb-addons:${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_addons', filter: `store_id=eq.${store.id}` }, refreshOnChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_addon_installations', filter: `store_id=eq.${store.id}` }, refreshOnChange)
      .subscribe();
    const poll = window.setInterval(refreshOnChange, 30_000);
    return () => { window.clearInterval(poll); void client.removeChannel(channel); };
  }, [refresh, store]);

  const activeCodes = useMemo(() => {
    const active = new Set<string>();
    if (!data) return active;
    for (const addon of data.catalog) {
      const subscription = data.subscriptions.find(item => item.addon_id === addon.id);
      const installation = data.installations.find(item => item.addon_id === addon.id);
      if (isAddonTechnicallyAvailable(addon, subscription, installation)) active.add(addon.code);
    }
    return active;
  }, [data]);

  const value = useMemo<AddonEntitlements>(() => ({
    loading,
    activeCodes,
    hasAny: (codes) => codes.some(code => activeCodes.has(code)),
    refresh,
  }), [activeCodes, loading, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAddonEntitlements() {
  const value = useContext(Context);
  if (!value) throw new Error('AddonEntitlementsProvider ausente.');
  return value;
}
