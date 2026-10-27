import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, RefreshCw } from 'lucide-react';
import { useConnect } from '../../context/ConnectContext';
import { getOwnerMessages, markOwnerMessageRead, type OwnerMessage } from '../../services/ownerMessageService';

export function AdminOwnerMessages() {
  const { store, session } = useConnect();
  const [messages, setMessages] = useState<OwnerMessage[]>([]);
  const [loadedIdentity,setLoadedIdentity]=useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const generation = useRef(0);
  const storeId = store?.id;
  const userId = session?.user.id;
  const identity=`${userId||''}:${storeId||''}`;
  const visibleMessages=loadedIdentity===identity?messages:[];
  const load = useCallback(async () => {
    if (!storeId || !userId) return;
    const revision = ++generation.current;
    try { const data = await getOwnerMessages(storeId); if (revision === generation.current) { setMessages(data);setLoadedIdentity(`${userId}:${storeId}`); setError(''); } }
    catch (failure) { if (revision === generation.current) { setMessages([]); setError(failure instanceof Error ? failure.message : 'Não foi possível consultar mensagens.'); } }
    finally { if (revision === generation.current) setLoading(false); }
  }, [storeId, userId]);
  useEffect(() => {
    setMessages([]); setLoading(true); void load();
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(visible, 60_000);
    document.addEventListener('visibilitychange', visible);
    return () => { ++generation.current; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [load]);
  const markRead = async (id: string) => {
    if (!storeId || marking) return;
    const revision = generation.current;
    setMarking(id);
    try { await markOwnerMessageRead(storeId, id); if (revision === generation.current) await load(); }
    catch (failure) { if (revision === generation.current) setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar a mensagem.'); }
    finally { setMarking(null); }
  };
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2"><Bell aria-hidden="true"/>Mensagens do Master</h1><p className="mt-2 text-sm text-neutral-400">Comunicados enviados à sua conta nesta loja. Atualização ao abrir, voltar à aba e a cada minuto.</p></div><button className="rounded-xl border border-neutral-700 px-4 py-2" onClick={() => void load()}><RefreshCw size={16} className="inline mr-2"/>Atualizar</button></header>
    {error && <p role="alert" className="rounded-xl border border-rose-500/40 p-4 text-rose-200">{error}</p>}
    {loading ? <p role="status">Carregando mensagens…</p> : !error && visibleMessages.length === 0 ? <p className="rounded-2xl border border-neutral-800 p-8 text-neutral-400">Nenhuma mensagem para esta conta.</p> : visibleMessages.map(message => <article key={message.id} className={`rounded-2xl border p-5 ${message.read_at ? 'border-neutral-800 bg-neutral-950' : 'border-violet-500/40 bg-violet-950/20'}`}><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-bold">{message.title}</h2><span className="text-xs text-neutral-400">{new Date(message.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-300">{message.body}</p>{!message.read_at && <button disabled={Boolean(marking)} onClick={() => void markRead(message.id)} className="mt-4 rounded-xl border border-neutral-700 px-3 py-2 text-sm disabled:opacity-50"><Check className="mr-2 inline" size={16}/>{marking === message.id ? 'Salvando…' : 'Marcar como lida'}</button>}</article>)}
  </section>;
}
