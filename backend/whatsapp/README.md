# WhatsApp automático — Burge House

Mudanças efetivas de status em `delivery_orders` geram eventos em uma fila privada, na mesma transação do pedido. Um serviço Node 22+ no notebook consulta a fila e envia pela Evolution API. Funciona com o navegador fechado; o notebook deve permanecer ligado, conectado e sem suspender. O Docker Desktop já inicia ao entrar no Windows e os contêineres existentes têm `restart: unless-stopped`.

## Instalação ativa

- Supabase: `mabkzkawziqlmgfikwmh`.
- Loja existente preservada: `e2ba2dff-0b92-497d-9b08-926c235c2934`, Burger House.
- Evolution local: `http://127.0.0.1:8080`, instância `novaesweb_teste`.
- Pasta do serviço: `C:/Users/camil/Documents/Codex/Services/BurgeHouseWhatsApp`.
- Tarefa do Windows: `NovaesWeb-BurgeHouse-WhatsApp`, inicia no login da conta camil, sem janela, com reinício supervisionado.
- Autorização do usuário em 17/10/2026: instalação, um envio de teste e, em seguida, liberação para todos os clientes da loja.

A migration aplicada é `20261018023324_whatsapp_status_outbox.sql`. Não altera IDs, dados históricos, funções de negócio existentes, checkout ou RLS dos pedidos. Não depende de mudança visual nem de nova publicação Vercel.

## Credenciais e destinatários

O arquivo privado `.env` fica apenas na pasta do serviço, protegido para a conta do usuário e SYSTEM. Nunca versionar esse arquivo. A chave Evolution e o token aleatório exclusivo da fila permanecem no backend. Não é usada chave `service_role`: o worker usa chave pública Supabase e um token de 256 bits, cuja hash fica na configuração privada da loja. As funções privadas validam o token e limitam a operação à loja vinculada. As funções expostas são `SECURITY INVOKER`.

O padrão de `.env.example` mantém envios desligados e modo de teste. O modo de clientes só é ativado por `WHATSAPP_SEND_ENABLED=true`, `WHATSAPP_TEST_ONLY=false` e `WHATSAPP_CUSTOMER_SEND_APPROVED=true`. O notebook instalado usa esse modo após autorização explícita. O modo de teste exige o telefone autorizado e bloqueia qualquer outro destinatário. Telefones brasileiros com DDD são normalizados para incluir 55; telefones inválidos são bloqueados.

Cada alteração real de status gera um aviso: recebido, preparando, itens separados, esperando motoboy, saiu para entrega, entregue ou cancelado. Inserir um pedido em `recebido` não dispara mensagem inicial; a automação solicitada observa mudanças de status. Alterações de pagamento e repetição do mesmo status não geram avisos. Não há envio retroativo de pedidos anteriores à ativação.

Contrato Evolution instalado: POST `/message/sendText/{instance}`, cabeçalho `apikey`, JSON `{number,text,linkPreview:false}`. A URL aceita HTTPS ou HTTP de loopback; não expor a API local na internet.

## Verificação

`node --test --test-isolation=none tests/whatsapp.mjs`: 8 testes locais com banco PostgreSQL embarcado e HTTP simulado. Cobrem modo de teste, autorização do modo de clientes, isolamento de loja, proteção do token, fila transacional, ordem e tratamento de falhas. As verificações existentes de banco, tipos e compilação também passaram.

O único teste real autorizado foi o pedido temporário #4, evento 1, enviado apenas ao número terminado em 2414. Resultado: fila `sent/ACCEPTED`; consulta somente de leitura na Evolution confirmou `SERVER_ACK` e `DELIVERY_ACK`. O pedido temporário foi removido por ID e marcador exclusivos após a verificação, sem alterar pedidos reais. Nenhum outro destinatário foi usado nos testes.

## Operação

Para consultar o serviço: `Get-ScheduledTask -TaskName 'NovaesWeb-BurgeHouse-WhatsApp'`. Para parar: `Stop-ScheduledTask -TaskName 'NovaesWeb-BurgeHouse-WhatsApp'`; para iniciar: `Start-ScheduledTask -TaskName 'NovaesWeb-BurgeHouse-WhatsApp'`. O log `worker.log` contém apenas IDs de eventos e códigos fixos; o supervisor limita o arquivo e mantém uma cópia anterior. Não imprime telefone, mensagem, token ou chave.

Claims atômicos usam `FOR UPDATE SKIP LOCKED`. Eventos de um pedido mantêm ordem; voltar a um status anterior depois de outro status gera evento novo. Aceitação pela Evolution não significa entrega: no teste, a entrega foi confirmada separadamente.

Timeout, resposta inválida ou falha HTTP deixam `uncertain`; queda após o claim pode deixar `sending`. Esses estados bloqueiam os próximos eventos daquele pedido até revisão no provedor, para evitar duplicatas. Não há reenvio automático de envios incertos. Falha na consulta ao banco encerra o worker e o supervisor tenta reiniciá-lo após 30 segundos. O serviço se recupera de quedas de rede sem depender da sessão do navegador.

Para pausar completamente a coleta, desabilitar a loja em `delivery_private.whatsapp_stores` além de parar o serviço. Antes de retomar, revisar pendências para evitar avisos antigos. Definir retenção e excluir eventos finalizados após o prazo operacional adotado, pois a fila guarda telefone. Nenhuma mudança de status é revertida por indisponibilidade do WhatsApp.

Advisors após instalação: as novas tabelas privadas têm RLS sem políticas e sem acesso direto de clientes, intencionalmente. Os avisos de função pública de disponibilidade e proteção de senhas eram anteriores e não foram alterados.

Documentação consultada: https://supabase.com/docs/guides/functions/schedule-functions e https://supabase.com/docs/guides/database/extensions/pg_net. A fila persistente e o worker dispensam URL pública para a Evolution local.
