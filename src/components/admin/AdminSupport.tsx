import React from 'react';
import { Headphones } from 'lucide-react';

export const AdminSupport: React.FC = () => <section className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
  <h1 className="flex items-center gap-3"><Headphones aria-hidden="true"/>Suporte</h1>
  <p className="text-sm leading-6 text-neutral-300">O envio de chamados por este painel ainda não possui um endpoint autorizado para a loja. Nenhuma mensagem de suporte é enviada por esta tela.</p>
  <p className="text-sm leading-6 text-neutral-400">Os comunicados recebidos do Master estão na seção Mensagens. Para solicitar atendimento, utilize o canal já combinado com a NovaesWeb.</p>
</section>;
