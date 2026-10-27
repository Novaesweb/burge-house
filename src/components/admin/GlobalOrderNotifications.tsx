import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useConnect } from '../../context/ConnectContext';
import {
  getAudioContextState, getOrderSoundMuteUntil, isOrderSoundMuted,
  muteOrderSoundTemporarily, ORDER_SOUND_EVENT, setOrderSoundMuted,
  startOrderAlertLoop, stopOrderAlertLoop, unlockAudio,
} from '../../utils/audioAlert';
import { newUnseenOrderIds, pendingOrderQueue, ordersForStore, orderStageUrl } from '../../utils/adminOrders';

export const GlobalOrderNotifications: React.FC = () => {
  const { orders: allOrders, siteId, appMode, setAdminView, setSelectedAdminOrder } = useStore();
  const connection = useConnect();
  const authorized = Boolean(appMode === 'admin' && connection.session && connection.store?.id === siteId && connection.store.status === 'active' && !connection.checkInDenied && ['owner','admin','staff'].includes(connection.store.role));
  const orders = useMemo(() => ordersForStore(allOrders, siteId), [allOrders, siteId]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const pendingCount = pendingOrderQueue(orders, now).length;
  const [audioState, setAudioState] = useState(() => ({
    ready: getAudioContextState() === 'running',
    muted: isOrderSoundMuted(),
    until: getOrderSoundMuteUntil(),
    remainingMinutes: Math.max(0, Math.ceil((getOrderSoundMuteUntil() - Date.now()) / 60000)),
  }));
  const [audioError, setAudioError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const seenRef = useRef<{ site: string; ids: Set<string> }>({ site: '', ids: new Set() });
  const openQueue = useCallback(() => {
    const href = orderStageUrl(window.location.href, 'recebido');
    if (href !== window.location.href) window.history.pushState(window.history.state, '', href);
    setSelectedAdminOrder(null);
    setAdminView('orders');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [setAdminView, setSelectedAdminOrder]);

  useEffect(() => {
    const sync = () => {
      const until = getOrderSoundMuteUntil();
      const next = {
        ready: getAudioContextState() === 'running', muted: isOrderSoundMuted(), until,
        remainingMinutes: Math.max(0, Math.ceil((until - Date.now()) / 60000)),
      };
      setAudioState(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    sync();
    const timer = setInterval(sync, 1000);
    window.addEventListener('storage', sync);
    window.addEventListener(ORDER_SOUND_EVENT, sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', sync);
      window.removeEventListener(ORDER_SOUND_EVENT, sync);
    };
  }, []);

  // Accepting one of several pending orders keeps the same alarm alive.
  const shouldAlert = authorized && pendingCount > 0 && audioState.ready && !audioState.muted;
  useEffect(() => {
    if (shouldAlert) startOrderAlertLoop(7000, siteId);
    else stopOrderAlertLoop();
    return stopOrderAlertLoop;
  }, [shouldAlert, siteId]);

  useEffect(() => {
    if (!authorized) return;
    if (seenRef.current.site !== siteId) {
      let ids: string[] = [];
      try {
        const saved = JSON.parse(sessionStorage.getItem(`admin-notified:${siteId}`) || '[]');
        if (Array.isArray(saved)) ids = saved.filter(id => typeof id === 'string');
      } catch {}
      seenRef.current = { site: siteId, ids: new Set(ids) };
    }
    const ids = newUnseenOrderIds(orders, seenRef.current.ids, now);
    if (!ids.length) return;
    ids.forEach(id => seenRef.current.ids.add(id));
    try { sessionStorage.setItem(`admin-notified:${siteId}`, JSON.stringify([...seenRef.current.ids].slice(-2000))); } catch {}
    setAnnouncement(`${ids.length === 1 ? 'Novo pedido recebido' : `${ids.length} novos pedidos recebidos`}.`);
    openQueue();
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(ids.length === 1 ? 'Novo pedido recebido' : `${ids.length} novos pedidos recebidos`, {
          body: 'Abra a fila para iniciar o atendimento.', tag: `orders-${siteId}`,
        });
      } catch {}
    }
  }, [authorized, orders, siteId, openQueue, now]);

  const enableSound = async () => {
    if (!authorized) return;
    const ready = await unlockAudio();
    setAudioError(ready ? '' : 'O navegador não liberou o áudio. Confira as permissões de som e tente novamente.');
    if (!ready) return;
    setOrderSoundMuted(false);
    setAudioState({ ready: true, muted: false, until: 0, remainingMinutes: 0 });
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
  };
  const paused = audioState.muted && audioState.until > Date.now();
  if (!authorized) return null;
  return <section className={`order-notification-center ${pendingCount ? 'has-pending' : ''}`} aria-label="Central de novos pedidos">
    <div className="notification-summary">
      <span className="notification-bell"><BellRing size={17}/></span>
      <div>
        <strong aria-live="polite">{pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'pedido aguarda' : 'pedidos aguardam'} atendimento` : 'Fila de novos pedidos vazia'}</strong>
        <small>{paused ? `Som pausado por mais ${audioState.remainingMinutes} min. A fila continua recebendo pedidos.` : audioState.ready && !audioState.muted ? 'O alerta se repete enquanto houver pedidos aguardando.' : 'Ative o som para ouvir os novos pedidos.'}</small>
      </div>
      <div className="notification-controls">
        {audioState.ready && !audioState.muted
          ? <button className="order-sound-toggle" onClick={() => muteOrderSoundTemporarily()} title="Silenciar por 5 minutos"><VolumeX size={16}/><span>Silenciar 5 min</span></button>
          : <button className="order-sound-toggle" onClick={() => void enableSound()}><Volume2 size={16}/><span>{paused ? `Retomar som (${audioState.remainingMinutes} min)` : 'Ativar som'}</span></button>}
        {pendingCount > 0 && <button className="notification-open-queue" onClick={openQueue}>Atender fila ({pendingCount})</button>}
      </div>
    </div>
    <span className="sr-only" role="status">{announcement}</span>
    {audioError && <p className="order-error" role="alert">{audioError}</p>}
  </section>;
};
