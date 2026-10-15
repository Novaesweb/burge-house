import React, { useState } from 'react';
import { KeyRound, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useConnect } from '../../context/ConnectContext';

export function PasswordSetupGate() {
  const connection = useConnect();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { setError('Use uma senha com pelo menos 8 caracteres.'); return; }
    if (password !== confirmation) { setError('As senhas não são iguais.'); return; }
    if (!supabase) { setError('A conexão com o painel central não está configurada.'); return; }
    setBusy(true); setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError('Não foi possível salvar a senha. Peça um novo link e tente novamente.'); return; }
    connection.clearRecoveryMode();
  };

  return <main className="connect-page"><section className="connect-card">
    <div className="connect-icon"><Store size={28}/></div>
    <p className="connect-eyebrow">BURGER HOUSE · PAINEL DO DONO</p>
    <h1>Crie sua senha</h1>
    <p>Escolha uma senha para entrar no painel e receber os pedidos da sua loja.</p>
    <form onSubmit={submit}>
      <label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} required/></label>
      <label>Confirmar senha<input type="password" autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} required/></label>
      <button disabled={busy} type="submit"><KeyRound size={17}/>{busy ? 'Salvando…' : 'Salvar e abrir painel'}</button>
    </form>
    {error && <div className="connect-error" role="alert">{error}</div>}
  </section></main>;
}
