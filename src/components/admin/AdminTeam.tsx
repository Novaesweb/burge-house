import React, { useEffect, useState } from 'react';
import { useConnect } from '../../context/ConnectContext';
import { useStore } from '../../context/StoreContext';
import { requireSupabase } from '../../lib/supabase';

type Member = { user_id: string; role: string; is_active: boolean };
const roles: Record<string,string> = { owner:'Proprietário', admin:'Administrador', staff:'Funcionário', viewer:'Visualizador' };
export const AdminTeam: React.FC = () => {
  const { siteId } = useStore();
  const { store } = useConnect();
  const [members,setMembers] = useState<Member[]>([]);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const [refresh,setRefresh] = useState(0);
  const [saving,setSaving] = useState('');
  const [email,setEmail] = useState('');
  const [newRole,setNewRole] = useState('staff');
  useEffect(() => {
    let active=true;
    setLoading(true);setError('');setMembers([]);
    if (!siteId || store?.id !== siteId || !['owner','admin'].includes(store.role)) {setLoading(false);return;}
    requireSupabase().rpc('delivery_list_store_team',{p_store_id:siteId}).then(({data,error})=>{
      if(!active)return;
      if(error)setError('Não foi possível consultar os membros autorizados desta loja.');
      else setMembers((data||[]) as Member[]);
      setLoading(false);
    });
    return ()=>{active=false;};
  },[siteId,store?.id,store?.role,refresh]);
  const updateMember = async (m: Member, role: string, active: boolean) => {
    if (store?.role !== 'owner' || m.role === 'owner') return;
    setSaving(m.user_id); setError('');
    const { data, error } = await requireSupabase().rpc('delivery_update_team_member', {p_store_id:siteId,p_user_id:m.user_id,p_role:role,p_active:active});
    if (error || !data) setError('Não foi possível alterar o acesso. Apenas o proprietário pode realizar essa ação.');
    else setRefresh(v => v + 1);
    setSaving('');
  };
  const addMember = async (e:React.FormEvent) => {
    e.preventDefault(); if(store?.role!=='owner')return;
    setSaving('new');setError('');
    const {data,error}=await requireSupabase().rpc('delivery_add_existing_team_member',{p_store_id:siteId,p_email:email.trim(),p_role:newRole});
    if(error || !data)setError('Não foi possível adicionar. A pessoa precisa ter uma conta confirmada no Supabase e não pode já estar vinculada à loja.');
    else {setEmail('');setRefresh(v=>v+1);}
    setSaving('');
  };
  return <section className="space-y-5 text-white">
    <header><h1 className="text-2xl font-black">Equipe e acessos</h1><p className="text-neutral-400 text-sm">Visualize os acessos vinculados à sua loja no NovaesWeb Master.</p></header>
    <div className="rounded-2xl border border-amber-700 bg-amber-950/30 p-4 text-sm">A consulta e a edição de acessos são verificadas no Supabase. Apenas o proprietário pode alterar funções. O proprietário pode adicionar contas existentes e alterar funções. Novas contas devem ser criadas e confirmadas antes.</div>
    {store?.id === siteId && store?.role === 'owner' && <form onSubmit={addMember} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3"><h2 className="font-bold">Adicionar usuário existente</h2><p className="text-xs text-neutral-400">A pessoa precisa já ter uma conta com e-mail confirmado. Esta opção não cria senha nem envia convite.</p><div className="flex flex-wrap gap-2"><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail da conta" className="min-w-48 flex-1 rounded-lg bg-neutral-950 p-2"/><select value={newRole} onChange={e=>setNewRole(e.target.value)} className="rounded-lg bg-neutral-950 p-2"><option value="staff">Funcionário</option><option value="admin">Administrador</option><option value="viewer">Visualizador</option></select><button disabled={!!saving} className="rounded-lg bg-red-600 p-2 font-bold">Adicionar</button></div></form>}
    {store?.id !== siteId || !['owner','admin'].includes(store?.role||'') ? <p className="rounded-xl border border-neutral-700 p-4">Somente o proprietário ou administrador autorizado pode consultar a equipe.</p> :
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
        {loading && <p>Carregando equipe...</p>}
        {error && <p role="alert" className="text-red-400">{error}</p>}
        {!loading && !error && members.length===0 && <p className="text-neutral-400">Nenhum membro visível para sua conta.</p>}
        {members.map(m=><div key={m.user_id} className="flex flex-wrap justify-between gap-2 border-b border-neutral-800 pb-3">
          <div><p className="font-bold">{roles[m.role]||m.role}</p><p className="text-xs text-neutral-400 break-all">Usuário: {m.user_id}</p></div>
          {store?.role === 'owner' && m.role !== 'owner' ? <div className="flex gap-2 items-center"><select aria-label="Função do funcionário" disabled={saving===m.user_id} value={m.role} onChange={e=>void updateMember(m,e.target.value,m.is_active)} className="bg-neutral-800 rounded-lg p-2"><option value="admin">Administrador</option><option value="staff">Funcionário</option><option value="viewer">Visualizador</option></select><button disabled={saving===m.user_id} className="rounded-lg bg-neutral-700 p-2" onClick={()=>void updateMember(m,m.role,!m.is_active)}>{m.is_active?'Desativar':'Ativar'}</button></div> : <span className={m.is_active?'text-emerald-400':'text-neutral-400'}>{m.is_active?'Ativo':'Inativo'}</span>}
        </div>)}
      </div>}
  </section>;
};
