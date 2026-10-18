import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, Pause, Play, Send, ShieldCheck, WifiOff } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

type Segment = 'all' | '30' | '60' | '90';
type Campaign = { id: string; title: string; original: string; segment: Segment; recipients: { name: string; phone: string; text: string; simulatedAt?: string }[]; status: 'running' | 'paused' | 'completed'; createdAt: string; nextBatchAt: number };
const SAMPLE = [
  { name: 'Ana', phone: 'TESTE-001', inactive: 100 }, { name: 'Bruno', phone: 'TESTE-002', inactive: 95 },
  { name: 'Carla', phone: 'TESTE-003', inactive: 82 }, { name: 'Daniel', phone: 'TESTE-004', inactive: 75 },
  { name: 'Elisa', phone: 'TESTE-005', inactive: 65 }, { name: 'Felipe', phone: 'TESTE-006', inactive: 61 },
  { name: 'Gabriela', phone: 'TESTE-007', inactive: 56 }, { name: 'Hugo', phone: 'TESTE-008', inactive: 50 },
  { name: 'Isabela', phone: 'TESTE-009', inactive: 42 }, { name: 'João', phone: 'TESTE-010', inactive: 38 },
  { name: 'Karen', phone: 'TESTE-011', inactive: 34 }, { name: 'Leonardo', phone: 'TESTE-012', inactive: 31 },
  { name: 'Marina', phone: 'TESTE-013', inactive: 20 }, { name: 'Nicolas', phone: 'TESTE-014', inactive: 12 },
];
const intros = [
  (name: string) => `Olá, ${name}! 🍔`,
  (name: string) => `Oi, ${name}! 😋`,
  (name: string) => `Tudo bem, ${name}? 🍟`,
  (name: string) => `Ei, ${name}! 👋`,
  (name: string) => `Boa notícia, ${name}! 🍔`,
  (name: string) => `Olá, ${name}, confira esta novidade! ✨`,
];
const INTERVAL = 5 * 60 * 1000;
const BATCH = 6;

export const AdminMarketingDemo: React.FC = () => {
  const { siteId } = useStore();
  const storageKey = `novaesweb-marketing-demo:${siteId}`;
  const [title, setTitle] = useState('Promoção especial Burger House');
  const [message, setMessage] = useState('Hoje temos hambúrguer com batata por R$ 29,90. Confira a promoção! Se não quiser mais receber novidades, responda SAIR.');
  const [segment, setSegment] = useState<Segment>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setReady(false);
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setCampaigns(Array.isArray(parsed) ? parsed : []);
    } catch { setCampaigns([]); }
    setSelected([]);
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (ready) try { localStorage.setItem(storageKey, JSON.stringify(campaigns)); } catch { /* unavailable storage */ }
  }, [campaigns, ready, storageKey]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  // Local simulation only. No WhatsApp credentials, HTTP requests or real dispatch.
  useEffect(() => {
    if (!ready) return;
    setCampaigns(previous => previous.map(campaign => {
      if (campaign.status !== 'running' || campaign.nextBatchAt > now) return campaign;
      const pending = campaign.recipients.filter(recipient => !recipient.simulatedAt);
      if (!pending.length) return { ...campaign, status: 'completed' };
      const ids = new Set(pending.slice(0, BATCH).map(recipient => recipient.phone));
      const recipients = campaign.recipients.map(recipient => ids.has(recipient.phone) ? { ...recipient, simulatedAt: new Date(now).toISOString() } : recipient);
      return { ...campaign, recipients, status: recipients.every(recipient => recipient.simulatedAt) ? 'completed' : 'running', nextBatchAt: now + INTERVAL };
    }));
  }, [now, ready]);
  const filtered = useMemo(() => SAMPLE.filter(c => segment === 'all' || c.inactive >= Number(segment)), [segment]);
  const recipients = filtered.filter(c => selected.includes(c.phone));
  const start = () => {
    if (!message.trim() || !title.trim() || !recipients.length) return;
    const createdAt = new Date().toISOString();
    setCampaigns(prev => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim(), original: message.trim(), segment,
      recipients: recipients.map((c, i) => ({ name: c.name, phone: c.phone, text: `${intros[i % intros.length](c.name)} ${message.trim()}` })),
      status: 'running', createdAt, nextBatchAt: Date.now(),
    }, ...prev]);
  };
  const changeStatus = (id: string, status: 'running' | 'paused') => setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status, nextBatchAt: status === 'running' ? Date.now() + INTERVAL : c.nextBatchAt } : c));
  return <div className="space-y-5 text-white">
    <header className="space-y-1"><h1 className="text-2xl font-black flex items-center gap-2"><Megaphone className="text-rose-400"/> Central de Marketing</h1><p className="text-sm text-neutral-400">Demonstração de campanhas WhatsApp da NovaesWeb</p></header>
    <div className="rounded-2xl border border-amber-700/70 bg-amber-950/30 p-4 text-sm text-amber-100 space-y-2">
      <p className="font-bold flex items-center gap-2"><WifiOff size={18}/> Modo simulação — nenhum WhatsApp será enviado</p>
      <p>Os contatos abaixo são fictícios e não vêm do cadastro real de clientes. A simulação acontece neste navegador; para envios automáticos reais, será necessário um serviço no servidor, conexão autorizada e registro de consentimento para marketing.</p>
      <p>Enviar em lotes não evita bloqueios. A conexão Evolution API ainda não está configurada.</p>
    </div>
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-6 space-y-4">
      <h2 className="font-extrabold text-lg">Nova campanha</h2>
      <label className="block text-sm space-y-1"><span>Nome da campanha</span><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={90} className="w-full rounded-xl bg-neutral-950 border border-neutral-700 p-3 text-white"/></label>
      <label className="block text-sm space-y-1"><span>Mensagem principal</span><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} maxLength={1000} className="w-full rounded-xl bg-neutral-950 border border-neutral-700 p-3 text-white"/></label>
      <p className="text-xs text-neutral-400">A saudação varia por destinatário; a oferta e o preço são preservados. Revise a mensagem antes de iniciar.</p>
      <label className="block text-sm space-y-1"><span>Selecionar clientes fictícios</span><select value={segment} onChange={e=>{setSegment(e.target.value as Segment);setSelected([]);}} className="w-full rounded-xl bg-neutral-950 border border-neutral-700 p-3 text-white"><option value="all">Todos os contatos de demonstração</option><option value="30">Sem comprar há 30+ dias</option><option value="60">Sem comprar há 60+ dias</option><option value="90">Sem comprar há 90+ dias</option></select></label>
      <div className="flex flex-wrap gap-2 items-center justify-between text-xs text-neutral-300"><span>{selected.length} de {filtered.length} selecionados</span><button type="button" className="rounded-lg border border-neutral-600 px-3 py-2 hover:bg-neutral-800" onClick={()=>setSelected(selected.length===filtered.length?[]:filtered.map(c=>c.phone))}>{selected.length===filtered.length?'Desmarcar todos':'Selecionar todos'}</button></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{filtered.map(c=><label key={c.phone} className="flex gap-2 items-center rounded-xl bg-neutral-950 border border-neutral-800 p-3 text-sm cursor-pointer"><input type="checkbox" checked={selected.includes(c.phone)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,c.phone]:prev.filter(p=>p!==c.phone))}/><span>{c.name} <small className="block text-neutral-500">{c.inactive} dias sem pedidos · fictício</small></span></label>)}</div>
      {recipients.length>0 && <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-3 space-y-2"><h3 className="font-bold text-sm">Prévia individual ({recipients.length})</h3><div className="max-h-48 overflow-y-auto space-y-2">{recipients.map((c,i)=><p key={c.phone} className="text-xs text-neutral-300 border-b border-neutral-800 pb-2"><strong>{c.name}:</strong> {intros[i%intros.length](c.name)} {message}</p>)}</div></div>}
      <div className="flex flex-wrap gap-3 items-center justify-between"><p className="text-sm text-neutral-400"><strong className="text-white">6 por lote</strong> · intervalo de <strong className="text-white">5 minutos</strong></p><button type="button" onClick={start} disabled={!recipients.length||!message.trim()||!title.trim()} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 font-bold text-white disabled:opacity-40"><Send size={17}/> Iniciar simulação</button></div>
    </section>
    <section className="space-y-3"><h2 className="text-lg font-extrabold">Histórico de campanhas neste navegador</h2>{!campaigns.length&&<p className="text-neutral-400 text-sm">Nenhuma campanha simulada ainda.</p>}
      {campaigns.map(c=>{const done=c.recipients.filter(r=>r.simulatedAt).length;const remaining=Math.max(0,Math.ceil((c.nextBatchAt-now)/1000));return <article key={c.id} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold">{c.title}</h3><p className="text-xs text-neutral-400">{new Date(c.createdAt).toLocaleString('pt-BR')} · {done}/{c.recipients.length} simulados</p></div><span className="text-xs text-amber-300 font-semibold">{c.status==='completed'?'Concluída':c.status==='paused'?'Pausada':'Simulando'}</span></div><div className="w-full h-2 rounded-full bg-neutral-700 overflow-hidden"><div className="bg-rose-500 h-full" style={{width:`${done/c.recipients.length*100}%`}}/></div>{c.status==='running'&&<p className="text-xs text-neutral-400">{done===0?'Próximo lote: agora':`Próximo lote em ${Math.floor(remaining/60)}m ${String(remaining%60).padStart(2,'0')}s`}</p>}<div className="flex flex-wrap gap-2">{c.status==='running'&&<button className="rounded-lg border border-neutral-600 px-3 py-2 text-sm flex gap-1 items-center" onClick={()=>changeStatus(c.id,'paused')}><Pause size={15}/> Pausar</button>}{c.status==='paused'&&<button className="rounded-lg border border-neutral-600 px-3 py-2 text-sm flex gap-1 items-center" onClick={()=>changeStatus(c.id,'running')}><Play size={15}/> Continuar</button>}</div><details className="text-xs text-neutral-300"><summary className="cursor-pointer flex items-center gap-1"><ShieldCheck size={14}/> Ver mensagens simuladas</summary><div className="space-y-2 mt-3">{c.recipients.map(r=><p key={r.phone} className="border-t border-neutral-800 pt-2"><strong>{r.name} — {r.simulatedAt?'Simulada':'Pendente'}:</strong> {r.text}</p>)}</div></details></article>})}
    </section>
    <section className="rounded-2xl border border-neutral-800 p-4 text-sm text-neutral-300 space-y-2"><h2 className="text-white font-bold">Conexão WhatsApp — próxima etapa no notebook</h2><p>Integração real desativada. Para ativar com segurança: configurar serviço de envio no servidor, credenciais protegidas, fila persistente, autorização para promoções, descadastro e limites do provedor. Nenhuma chave da Evolution API deve ser colocada no navegador.</p></section>
  </div>;
};
