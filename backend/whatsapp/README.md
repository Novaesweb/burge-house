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

Somente mudanças para `preparando`, `saiu_para_entrega` e `entregue` geram avisos: em preparo, a caminho e entregue. Os demais status continuam disponíveis no painel sem notificação por WhatsApp. Inserir um pedido em `recebido` não dispara mensagem inicial. Alterações de pagamento e repetição do mesmo status não geram avisos. Não há envio retroativo de pedidos anteriores à ativação. O banco filtra a fila e o worker também bloqueia outros status.

Contrato Evolution instalado: POST `/message/sendText/{instance}`, cabeçalho `apikey`, JSON `{number,text,linkPreview:false}`. A URL aceita HTTPS ou HTTP de loopback; não expor a API local na internet.

## Verificação

`node --test --test-isolation=none tests/whatsapp.mjs`: 11 testes locais com banco PostgreSQL embarcado e HTTP simulado. Cobrem modo de teste, autorização do modo de clientes, isolamento de loja, proteção do token, fila transacional, ordem, recuperação de resposta perdida e tratamento de falhas. As verificações existentes de banco, tipos e compilação também passaram.

O único teste real autorizado foi o pedido temporário #4, evento 1, enviado apenas ao número terminado em 2414. Resultado: fila `sent/ACCEPTED`; consulta somente de leitura na Evolution confirmou `SERVER_ACK` e `DELIVERY_ACK`. O pedido temporário foi removido por ID e marcador exclusivos após a verificação, sem alterar pedidos reais. Nenhum outro destinatário foi usado nos testes.

## Operação

Para consultar o serviço: `Get-ScheduledTask -TaskName 'NovaesWeb-BurgeHouse-WhatsApp'`. Para parar: `Stop-ScheduledTask -TaskName 'NovaesWeb-BurgeHouse-WhatsApp'`; para iniciar: `Start-ScheduledTask -TaskName 'NovaesWeb-BurgeHouse-WhatsApp'`. O log `worker.log` contém apenas IDs de eventos e códigos fixos; o supervisor limita o arquivo e mantém uma cópia anterior. Não imprime telefone, mensagem, token ou chave.

Claims atômicos usam `FOR UPDATE SKIP LOCKED`. Eventos de um pedido mantêm ordem; voltar a um status anterior depois de outro status gera evento novo. Aceitação pela Evolution não significa entrega: no teste, a entrega foi confirmada separadamente.

Após a migration `20261018025321_whatsapp_recoverable_claims.sql`, cada consulta usa um ID persistido em `.claim.json`. Se a resposta do banco se perder, o worker recupera o mesmo evento após reiniciar. O resultado do envio é persistido antes da confirmação no banco, permitindo repetir apenas a confirmação, sem reenviar a mensagem. A confirmação é idempotente. O diário contém apenas o ID da consulta, fase e códigos de resultado.

Timeout, resposta inválida ou falha HTTP na Evolution deixam `uncertain`. Interrupção durante o envio também exige revisão, pois a mensagem pode ter sido aceita. Esses estados bloqueiam os próximos eventos daquele pedido para evitar duplicatas. Não há reenvio automático de envios incertos. Falha na consulta ao banco encerra o worker e o supervisor tenta reiniciá-lo após 30 segundos, retomando o diário salvo. O serviço se recupera de quedas de rede sem depender da sessão do navegador.

Para pausar completamente a coleta, desabilitar a loja em `delivery_private.whatsapp_stores` além de parar o serviço. Antes de retomar, revisar pendências para evitar avisos antigos. Definir retenção e excluir eventos finalizados após o prazo operacional adotado, pois a fila guarda telefone. Nenhuma mudança de status é revertida por indisponibilidade do WhatsApp.

Advisors após instalação: as novas tabelas privadas têm RLS sem políticas e sem acesso direto de clientes, intencionalmente. Os avisos de função pública de disponibilidade e proteção de senhas eram anteriores e não foram alterados.

Documentação consultada: https://supabase.com/docs/guides/functions/schedule-functions e https://supabase.com/docs/guides/database/extensions/pg_net. A fila persistente e o worker dispensam URL pública para a Evolution local.

# Conexão dedicada por loja

O worker possui dois modos. `WHATSAPP_INSTANCE_MODE=legacy` (padrão quando a variável não está definida) conserva a instância fixa já instalada. `WHATSAPP_INSTANCE_MODE=store` deriva exclusivamente do UUID oficial o nome `nw_<UUID sem hífens>`, ignora `EVOLUTION_INSTANCE` e verifica o contato atual em `delivery_settings` e o `ownerJid` conectado no Evolution antes de cada novo processamento. Não existe autorização por número de telefone ou ID NX.

Neste modo, o cadastro deve retornar exatamente uma configuração pública da loja com `payload.phone` e `payload.name`. A consulta utiliza a chave pública e respeita as políticas existentes; configuração inacessível, loja suspensa, telefone inválido, instância desconectada ou telefone divergente suspendem novos envios. O worker tenta conferir novamente após 30 segundos, mantendo os pedidos pendentes. A configuração é consultada novamente depois de obter o evento, imediatamente antes do envio. Se o número mudar nesse intervalo, o mesmo identificador de claim é mantido no diário para recuperação.

As fases `dispatching` e `finish` do diário são recuperadas mesmo sem conexão, pois confirmar um envio já realizado ou marcar um resultado incerto não exige nova mensagem. Não apague nem mova `.claim.json` durante a migração. Nunca execute dois workers para a mesma loja simultaneamente. O texto usa o nome atual da loja no modo `store`; o modo legado preserva o texto anterior.

Para migrar uma instalação, primeiro conecte e confira a instância dedicada, pare o worker antigo, preserve seu diário e instale juntos `worker.mjs` e `storeConnection.mjs`, alterando somente a configuração privada para `WHATSAPP_INSTANCE_MODE=store`. A conexão do novo número exige autorização no celular. Alterar o telefone público não cria uma sessão WhatsApp autorizada. Não desconecte a instância legada compartilhada para migrar uma loja.

Esta entrega prepara o código do worker; não modifica automaticamente o serviço já instalado. O worker de marketing continua com configuração própria e não foi migrado: seu telefone privado, consentimentos, cursor de entrada e vínculo da instância precisam ser alinhados separadamente antes de ativar envios pelo novo remetente. Não altere esses dados automaticamente com base no telefone público.

Verificação local sem envios reais: `node --test --test-isolation=none tests/store-connection.mjs tests/whatsapp.mjs`. Os testes cobrem instâncias de duas lojas, telefone divergente, três trocas consecutivas, mudança entre claim e dispatch, recuperação sem conexão e mensagens de erro sem credenciais. Não comprovam pareamento real nem isolamento de duas contas WhatsApp reais.

