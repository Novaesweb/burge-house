import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { useConnect } from '../../context/ConnectContext';
import { useStore } from '../../context/StoreContext';
import { connectWhatsApp, getWhatsAppConnectionStatus, WhatsAppConnectionError, type WhatsAppConnectionStatus } from '../../services/whatsappConnectionService';

const descriptions = {
  not_created: 'Nenhum WhatsApp conectado',
  disconnected: 'WhatsApp desconectado',
  connecting: 'Aguardando autorização no celular',
  connected: 'WhatsApp conectado',
  number_mismatch: 'O WhatsApp conectado é diferente do número salvo',
};

export function WhatsAppConnection() {
  const { store, session } = useConnect();
  const { siteSettings } = useStore();
  const [status, setStatus] = useState<WhatsAppConnectionStatus | null>(null);
  const [pairing, setPairing] = useState<{ qr?: string; pairingCode?: string; expiresAt: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [expired, setExpired] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const storeId = store?.id;
  const userId = session?.user.id;
  const savedPhone = siteSettings.phone;
  const canManage = store?.role === 'owner' || store?.role === 'admin';

  useEffect(() => {
    const revision = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    inFlight.current = false;
    setStatus(null); setPairing(null); setConfirmSwitch(false); setExpired(false); setError(''); setLoading(true); setBusy(false);
    if (!storeId || !userId) { setLoading(false); return () => controller.current?.abort(); }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (signal.aborted || revision !== generation.current) return;
      if (document.visibilityState === 'visible' && !inFlight.current) {
        inFlight.current = true;
        try {
          const result = await getWhatsAppConnectionStatus(storeId, signal);
          if (signal.aborted || revision !== generation.current) return;
          setStatus(result); setError('');
          if (result.state === 'connected') { setPairing(null); setConfirmSwitch(false); setExpired(false); }
        } catch (failure) {
          if (!signal.aborted && revision === generation.current) {
            setStatus(null); setError(failure instanceof Error ? failure.message : 'Não foi possível conferir a conexão.');
          }
        } finally {
          if (revision === generation.current) { inFlight.current = false; setLoading(false); }
        }
      }
      if (!signal.aborted) timer = setTimeout(poll, 5_000);
    };
    void poll();
    return () => { controller.current?.abort(); clearTimeout(timer); ++generation.current; };
  }, [storeId, userId, savedPhone]);

  useEffect(() => {
    if (!pairing) return;
    const timer = setTimeout(() => { setPairing(null); setExpired(true); }, Math.max(0, pairing.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [pairing]);

  const handleConnect = async (confirmed = false) => {
    if (!storeId || !canManage || inFlight.current) return;
    const revision = generation.current;
    const signal = controller.current?.signal;
    inFlight.current = true; setBusy(true); setError(''); setConfirmSwitch(false); setPairing(null); setExpired(false);
    try {
      const result = await connectWhatsApp(storeId, confirmed, signal);
      if (signal?.aborted || revision !== generation.current) return;
      setStatus(result);
      if (result.state !== 'connected' && (result.qr || result.pairingCode)) setPairing({ qr: result.qr, pairingCode: result.pairingCode, expiresAt: Date.now() + 60_000 });
    } catch (failure) {
      if (signal?.aborted || revision !== generation.current) return;
      if (failure instanceof WhatsAppConnectionError && failure.code === 'CONFIRM_SWITCH_REQUIRED') setConfirmSwitch(true);
      else setError(failure instanceof Error ? failure.message : 'Não foi possível iniciar a conexão.');
    } finally {
      if (revision === generation.current) { inFlight.current = false; setBusy(false); }
    }
  };

  return (
    <section aria-labelledby="whatsapp-connection-heading" className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5 sm:p-6 space-y-5 text-zinc-100">
      <div className="flex items-start gap-3">
        <Smartphone className="w-6 h-6 mt-1 shrink-0 text-emerald-400" aria-hidden="true" />
        <div>
          <h3 id="whatsapp-connection-heading" className="text-lg font-bold">WhatsApp da loja</h3>
          <p className="text-sm text-zinc-400 mt-1">Conecte o número que enviará as mensagens automáticas desta loja. Cada loja tem sua própria conexão.</p>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4 space-y-2">
        <p className="text-sm text-zinc-400">WhatsApp salvo: <strong className="text-zinc-100 break-all">{savedPhone || 'Não informado'}</strong></p>
        <p className="text-xs text-zinc-400">Para trocar o número, salve primeiro o contato de atendimento nas configurações acima. Depois, autorize o novo WhatsApp no celular.</p>
        <p className="flex gap-2 items-center text-sm font-medium" role="status" aria-live="polite">
          {loading || busy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" /> : status?.state === 'connected' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" /> : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />}
          {busy ? 'Preparando a conexão…' : loading ? 'Consultando a conexão…' : status ? descriptions[status.state] : 'Conexão não confirmada'}
        </p>
        {status?.connectedPhone && <p className="text-xs text-zinc-400 break-all">Número conectado: {status.connectedPhone}</p>}
        {status?.state === 'number_mismatch' && <p className="text-sm text-amber-300">Os envios devem aguardar a conexão do número salvo. Conecte o novo WhatsApp para concluir a troca.</p>}
      </div>
      {error && <p role="alert" className="text-sm text-red-300 rounded-xl border border-red-900 bg-red-950/30 p-3">{error}</p>}
      {confirmSwitch && <div role="alert" className="rounded-xl border border-amber-700 bg-amber-950/30 p-4 space-y-3">
        <p className="text-sm text-amber-100">Deseja desconectar o WhatsApp anterior e iniciar a conexão do número salvo? Durante a troca, esta loja ficará sem enviar mensagens. As conexões de outras lojas não serão alteradas.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void handleConnect(true)} className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-zinc-950 disabled:opacity-50">Confirmar troca desta loja</button>
          <button type="button" onClick={() => setConfirmSwitch(false)} className="rounded-lg border border-zinc-600 px-4 py-2">Cancelar</button>
        </div>
      </div>}
      {pairing && <div className="rounded-xl border border-zinc-700 p-4 space-y-4">
        {pairing.qr && <div className="mx-auto w-fit max-w-full rounded-xl bg-white p-3"><img src={pairing.qr} width={256} height={256} alt="QR Code para conectar o WhatsApp desta loja" className="w-64 max-w-full h-auto" referrerPolicy="no-referrer" /></div>}
        {pairing.pairingCode && <p className="text-center">Código de pareamento: <strong className="block text-2xl tracking-widest break-all mt-2">{pairing.pairingCode}</strong></p>}
        <ol className="list-decimal pl-5 text-sm text-zinc-300 space-y-2">
          <li>Abra o WhatsApp do número salvo no celular.</li>
          <li>Acesse <strong>Aparelhos conectados</strong> e toque em <strong>Conectar aparelho</strong>.</li>
          <li>Leia o QR Code ou escolha a opção de conectar com número de telefone e informe o código, quando disponível.</li>
        </ol>
        <p className="text-xs text-zinc-400">Por segurança, esta tela oculta o código em até 60 segundos. A conexão só será confirmada após a autorização e a conferência do número.</p>
      </div>}
      {expired && <p role="status" className="text-sm text-amber-300">O código foi ocultado por segurança. Gere um novo QR Code para continuar.</p>}
      {canManage ? <button type="button" disabled={busy || loading || !savedPhone || !!confirmSwitch || status?.state === 'connected'} onClick={() => void handleConnect()} className="w-full sm:w-auto rounded-xl bg-emerald-500 text-zinc-950 px-5 py-3 font-bold hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed">
        {status?.state === 'connected' ? 'WhatsApp conectado' : busy ? 'Conectando…' : pairing || expired || status?.state === 'connecting' ? 'Gerar novo QR Code' : 'Conectar WhatsApp'}
      </button> : <p className="text-sm text-zinc-400">Somente o proprietário ou um administrador autorizado pode conectar o WhatsApp.</p>}
      <p className="text-xs text-zinc-400">A conexão não envia mensagens de teste. Os avisos de pedidos também dependem do serviço de envio estar ativo.</p>
    </section>
  );
}
