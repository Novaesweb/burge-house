import React from 'react';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export type LegalPageKind = 'privacy' | 'terms';

export const LegalPage: React.FC<{ kind: LegalPageKind; onBack: () => void }> = ({ kind, onBack }) => {
  const { siteSettings } = useStore();
  const name = siteSettings.name || 'a loja';
  return (
    <article className="mx-auto max-w-2xl space-y-5 text-sm leading-relaxed text-neutral-300">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-white"><ArrowLeft size={16}/> Voltar ao site</button>
      <header className="flex items-center gap-3 border-b border-neutral-800 pb-4">
        {kind === 'privacy' ? <ShieldCheck className="text-red-400" size={28}/> : <FileText className="text-red-400" size={28}/>}
        <div><h1 className="text-2xl font-black text-white">{kind === 'privacy' ? 'Política de Privacidade' : 'Termos de Uso'}</h1><p className="text-xs text-neutral-400">Demonstração NovaesWeb · Atualizado em 18/10/2026</p></div>
      </header>
      <p className="rounded-xl border border-amber-700/60 bg-amber-950/30 p-3 text-amber-100"><strong>Ambiente fictício:</strong> {name} é uma demonstração desenvolvida pela NovaesWeb, sem vendas, cobranças ou entregas reais. Faça testes somente com dados fictícios. Os pedidos simulados podem ser armazenados para testar o sistema.</p>
      {kind === 'privacy' ? <>
        <section><h2 className="text-lg font-bold text-white">1. Dados utilizados</h2><p>Para simular o registro e atendimento de pedidos, o sistema pode armazenar nome, número de WhatsApp, endereço de entrega, itens comprados, instruções e informações de pagamento selecionado (sem solicitar dados completos do cartão). Também podem existir dados técnicos necessários à segurança e ao funcionamento do site.</p></section>
        <section><h2 className="text-lg font-bold text-white">2. Finalidades e bases legais</h2><p>No ambiente de demonstração, as informações de teste são utilizadas para simular pedidos, acompanhar seus estados, avaliar o funcionamento do sistema e verificar a segurança. Não há contratação, entrega ou cobrança real. Conforme a finalidade, o tratamento pode se basear na execução do contrato, no cumprimento de obrigação legal ou em outra hipótese prevista na LGPD. Não consideramos a realização do pedido uma autorização automática para mensagens publicitárias.</p></section>
        <section><h2 className="text-lg font-bold text-white">3. Armazenamento e fornecedores</h2><p>Os dados operacionais podem ser armazenados em serviços de infraestrutura e banco de dados utilizados pelo site, incluindo Supabase e Vercel. O acesso deve ser limitado a pessoas autorizadas da loja e a fornecedores necessários à prestação do serviço. Os serviços podem envolver tratamento ou transferência internacional de dados conforme suas configurações e contratos.</p></section>
        <section><h2 className="text-lg font-bold text-white">4. Armazenamento local e cookies</h2><p>O site pode usar armazenamento do navegador para lembrar informações preenchidas, preferências e códigos de acesso aos próprios pedidos. Cookies e mecanismos técnicos também podem ser utilizados para sessão e segurança. Tecnologias opcionais de publicidade ou análise, se adicionadas futuramente, precisarão ser descritas e avaliadas separadamente.</p></section>
        <section><h2 className="text-lg font-bold text-white">5. Prazo de conservação</h2><p>As informações são mantidas pelo período necessário ao atendimento, suporte, segurança e cumprimento de obrigações aplicáveis. A exclusão pode estar sujeita à conservação legalmente exigida. A loja deve definir e aplicar prazos concretos de retenção antes de operar com clientes reais.</p></section>
        <section><h2 className="text-lg font-bold text-white">6. Seus direitos</h2><p>Você pode solicitar informações sobre o tratamento, acesso, correção e, quando cabível, exclusão de dados, além de exercer outros direitos previstos na LGPD. Para sua segurança, podemos solicitar confirmação de identidade antes de atender pedidos envolvendo dados pessoais.</p></section>
        <section><h2 className="text-lg font-bold text-white">7. Contato e responsável</h2><p>A NovaesWeb desenvolve este ambiente demonstrativo. Para solicitações relacionadas a dados de teste, utilize o contato oficial da NovaesWeb. Quando o sistema for contratado por uma loja real, a identificação do estabelecimento e as responsabilidades pelo tratamento de dados serão definidas para aquela operação.</p></section>
      </> : <>
        <section><h2 className="text-lg font-bold text-white">1. Uso do cardápio</h2><p>Este site demonstra produtos, preços e opções fictícias de {name}. Informações, disponibilidade, áreas de entrega e horários podem ser atualizados. Confira o resumo e o valor total antes de enviar seu pedido.</p></section>
        <section><h2 className="text-lg font-bold text-white">2. Pedidos e confirmação</h2><p>Ao enviar um pedido fictício, utilize somente dados de teste. O registro serve exclusivamente para simular o funcionamento da plataforma e não constitui compra ou solicitação de entrega real.</p></section>
        <section><h2 className="text-lg font-bold text-white">3. Entrega, pagamento e cancelamento</h2><p>Preços, formas de pagamento, taxas e prazos exibidos são exemplos. O ambiente não realiza cobrança, emissão de nota fiscal ou entrega. Uma futura loja real deverá publicar suas próprias condições comerciais e cumprir a legislação aplicável.</p></section>
        <section><h2 className="text-lg font-bold text-white">4. Uso responsável</h2><p>Não utilize o site para pedidos fraudulentos, tentativas de acesso a dados de terceiros ou atividades que comprometam o funcionamento do serviço.</p></section>
        <section><h2 className="text-lg font-bold text-white">5. Privacidade e contato</h2><p>O tratamento de dados pessoais é explicado na Política de Privacidade. Para dúvidas sobre esta demonstração, entre em contato com a NovaesWeb pelo seu canal oficial.</p></section>
      </>}
      <p className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">Modelo demonstrativo: antes de ativar uma loja real, é necessário personalizar as políticas, identificar o responsável, definir prazos de retenção e validar as práticas de tratamento de dados.</p>
    </article>
  );
};
