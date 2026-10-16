import React, { useState } from 'react';
import { Store, LogIn, RefreshCw, ArrowLeft, LogOut, KeyRound } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useConnect } from '../../context/ConnectContext';

export function ConnectGate() {
  const connection = useConnect();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const hasOfficialStore = Boolean(import.meta.env.VITE_NOVAESWEB_STORE_ID?.trim() && import.meta.env.VITE_NOVAESWEB_NX_ID?.trim());
  const run = async (action: () => Promise<void>) => { setBusy(true);setError('');setNotice('');try { await action(); }catch(failure){setError(failure instanceof Error ? failure.message : 'Não foi possível concluir.');}finally{setBusy(false);} };
  const login = (event: React.FormEvent) => { event.preventDefault();void run(async () => {
    if (!supabase) throw new Error('Conexão não configurada.');
    const result = await supabase.auth.signInWithPassword({email:email.trim(),password});
    if (result.error) throw new Error('Não foi possível entrar. Confira e-mail, senha e a confirmação da sua conta central.');
    setPassword('');
  }); };
  const requestPasswordSetup = () => { void run(async () => {
    if (!supabase || !email.trim()) throw new Error('Informe seu e-mail para receber o link de criação de senha.');
    const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/#/admdono` });
    if (result.error) throw result.error;
    setNotice('Se houver uma conta para este e-mail, enviaremos um link seguro para criar ou trocar a senha.');
  }); };
  return <main className="connect-page"><section className="connect-card">
    <a href="/" className="connect-back"><ArrowLeft size={16}/> Voltar à loja</a>
    <div className="connect-icon"><Store size={28}/></div>
    <p className="connect-eyebrow">BURGER HOUSE · NOVAESWEB CONNECT</p>
    <h1>{!connection.session ? 'Acesse sua loja' : hasOfficialStore ? 'Validar acesso ao painel' : connection.registration?.status === 'pending_approval' ? 'Aguardando o Master' : 'Conectar ao Painel Master'}</h1>
    {!isSupabaseConfigured ? <p role="alert">Configure a URL e a chave pública do projeto central para continuar.</p> : connection.loading ? <p>Conferindo sua sessão…</p> : !connection.session ? <>
      <p>Entre com sua conta confirmada do Supabase central para gerenciar a loja e solicitar a conexão.</p>
      <form onSubmit={login}><label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button disabled={busy} type="submit"><LogIn size={17}/>{busy ? 'Entrando…' : 'Entrar'}</button></form>
      <button className="connect-secondary" type="button" disabled={busy} onClick={requestPasswordSetup}><KeyRound size={16}/>Criar ou recuperar senha</button>
      <p className="connect-help">Use a conta central do proprietário. O link de senha abre este painel novamente.</p>
    </> : hasOfficialStore ? <>
      <p className="connect-account">Conectado como {connection.session.user.email}</p>
      <div className="connect-status"><strong>Loja já conectada ao Master</strong><p>Vamos conferir se esta conta tem vínculo ativo com a Burger House.</p><button disabled={busy} onClick={()=>void run(()=>connection.refresh())}><RefreshCw size={16}/>Validar acesso novamente</button></div>
      <p className="connect-help">Entre com a conta central vinculada à loja. Se o aviso continuar, peça ao Master para liberar seu acesso.</p>
      <button className="connect-secondary" disabled={busy} onClick={()=>void run(connection.signOut)}><LogOut size={16}/>Sair da conta</button>
    </> : <>
      <p className="connect-account">Conectado como {connection.session.user.email}</p>
      {connection.registration?.status === 'pending_approval' ? <div className="connect-status"><strong>Solicitação enviada</strong><p>O Master precisa aprovar o cadastro. A loja ainda não recebeu identificadores oficiais.</p><small>O andamento é atualizado automaticamente a cada 30 segundos.</small><button disabled={busy} onClick={()=>void run(()=>connection.refresh())}><RefreshCw size={16}/>Atualizar andamento</button></div> : <>
        {connection.registration?.status === 'rejected' && <div className="connect-error" role="alert">Solicitação recusada. {connection.registration.review_note || 'Procure o administrador do Master para revisar o cadastro.'}</div>}
        {connection.registration?.status === 'approved' && <button disabled={busy} onClick={()=>void run(()=>connection.refresh())}><RefreshCw size={16}/>Validar conexão novamente</button>}
      </>}
      <button className="connect-secondary" disabled={busy} onClick={()=>void run(connection.signOut)}><LogOut size={16}/>Sair da conta</button>
    </>}
    {notice && <div className="connect-status" role="status">{notice}</div>}
    {(error || connection.error) && <div className="connect-error" role="alert">{error || connection.error}</div>}
  </section></main>;
}
