import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Shield,
  ShieldCheck,
  Headphones,
  CheckCircle2,
  Clock,
  HelpCircle,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Store,
  User,
  Zap,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { SupportMessage, TicketStatus } from '../../types';

export const AdminSupport: React.FC = () => {
  const {
    siteId,
    adminId,
    siteSettings,
    storeAdmin,
    ownerName,
    supportTicket,
    sendSupportMessageAction,
  } = useStore();

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [supportTicket?.messages]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(type);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    try {
      await sendSupportMessageAction(messageText);
    } catch (err) {
      console.error('Falha ao enviar mensagem:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInputMessage(question);
  };

  // Status Badge Helper
  const getStatusBadge = (status?: TicketStatus) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Em Atendimento
          </span>
        );
      case 'waiting_client':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            Aguardando Lojista
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Atendimento Resolvido
          </span>
        );
      case 'new':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            Chamado Aberto (Novo)
          </span>
        );
    }
  };

  const quickQuestions = [
    'Como configuro minha chave PIX para pagamentos automáticos?',
    'Preciso de ajuda para cadastrar novos produtos e categorias no cardápio.',
    'Como altero meu horário de funcionamento e taxa de entrega?',
    'Gostaria de solicitar suporte para configuração de domínio personalizado.',
  ];

  const messages: SupportMessage[] = supportTicket?.messages || [];
  const ticketId = `ticket-${siteId}`;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-neutral-900 p-6 rounded-3xl border border-neutral-800">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-red-950/50 flex-shrink-0">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Suporte Técnico & Mensagens
              </h1>
              {getStatusBadge(supportTicket?.status)}
            </div>
            <p className="text-sm text-neutral-400 mt-1">
              O suporte ficará disponível após a conexão do novo banco.
            </p>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-2 self-start lg:self-center px-3.5 py-2 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-neutral-300 font-semibold">Modo local — sem banco conectado</span>
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 flex flex-col overflow-hidden shadow-2xl min-h-[440px] sm:min-h-[500px] h-[65vh] sm:h-[70vh] max-h-[750px]">
        {/* Chat Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 font-bold text-sm flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-red-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                  Conversa com Suporte Master
                </h2>
                <span className="hidden sm:inline px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-800 text-neutral-300 flex-shrink-0">
                  {siteSettings.name}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-neutral-400 block truncate">
                Responsável: {storeAdmin.name || ownerName}
              </span>
            </div>
          </div>

          <div className="text-right hidden sm:block flex-shrink-0">
            <span className="text-[10px] text-neutral-500 block uppercase font-bold">
              Última atualização
            </span>
            <span className="text-xs text-neutral-300 font-medium">
              {supportTicket?.updatedAt
                ? new Date(supportTicket.updatedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Aguardando início'}
            </span>
          </div>
        </div>

        {/* Message History */}
        <div
          ref={chatContainerRef}
          className="flex-1 p-3.5 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto bg-neutral-950/40"
        >
          {messages.length === 0 ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-neutral-800/60 border border-neutral-700/60 flex items-center justify-center text-neutral-400">
                <MessageSquare className="w-8 h-8 text-neutral-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Nenhuma mensagem ainda
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mt-1">
                  Envie sua dúvida ou solicitação técnica abaixo. Nossa equipe responderá em tempo real diretamente neste painel.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwner = msg.sender === 'store_owner';
              return (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col ${isOwner ? 'items-end' : 'items-start'} space-y-1`}
                >
                  {/* Sender Header */}
                  <div className="flex items-center gap-1.5 px-1">
                    {isOwner ? (
                      <>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          {msg.timestamp || 'Agora'}
                        </span>
                        <span className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {msg.senderName || `${ownerName} (Lojista)`}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                          <ShieldCheck className="w-3 h-3 text-amber-400" />
                          🛡️ Suporte TI - Painel Master
                        </span>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          {msg.timestamp || 'Agora'}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] p-4 rounded-2xl text-sm leading-relaxed ${
                      isOwner
                        ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-tr-xs shadow-lg shadow-red-950/30'
                        : 'bg-neutral-800 text-neutral-100 border border-neutral-700/80 rounded-tl-xs shadow-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions Strip */}
        <div className="px-6 py-2.5 bg-neutral-950/80 border-t border-neutral-800/80 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <span className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Perguntas Frequentes:
            </span>
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickQuestion(q)}
                className="px-3 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 text-xs transition-all cursor-pointer truncate max-w-[280px]"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 sm:p-4 bg-neutral-950 border-t border-neutral-800 flex items-center gap-2 sm:gap-3"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled placeholder="Suporte indisponível nesta prévia"
            className="flex-1 px-3.5 sm:px-4 py-2.5 sm:py-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-red-500 placeholder:text-neutral-500"
            
          />

          <button
            type="submit"
            disabled={true}
            className="px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-950/40 transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
          >
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Enviando...</span>
              </>
            ) : (
              <>
                <span>Enviar</span>
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};




