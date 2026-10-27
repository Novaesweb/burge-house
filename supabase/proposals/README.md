# Controles Master, consumo e Premium — revisão antes de aplicar

> **Atualização de 27/10/2026:** a proposta `20261025185555_store_plan_usage_and_reporting.sql` foi descartada para esta integração e **não deve ser aplicada**. Os prompts 3 e 5 agora reutilizam somente os contratos centrais existentes; consulte `INTEGRACAO-PROMPTS-3-4-5.md` na raiz. Nenhum dos SQLs desta pasta foi aplicado nesta tarefa. Os testes antigos da proposta não são evidência da integração atual.

Estes arquivos são **propostas locais não aplicadas**. Ficaram fora de `supabase/migrations` para não entrarem acidentalmente em um `db push`. O site e o GitHub não foram publicados nesta etapa.

## Arquivos e impacto

1. `20261025185555_store_plan_usage_and_reporting.sql`
   - Faz o helper operacional `delivery_has_role` exigir loja ativa. Conta, mensagens e consulta do plano continuam com as políticas próprias de vínculo ativo; não concedem acesso operacional durante manutenção/suspensão.
   - Reutiliza as tabelas centrais `store_order_usage_events` e `store_order_lifecycle_events`. Não recria cadastro, assinaturas, lojas ou tabelas centrais.
   - Registra transições reais da `delivery_orders`: criado, aceito (`recebido → preparando`), rejeitado, entregue, cancelado e excluído. Somente o aceite consome franquia. Cancelamento/exclusão não descontam consumo.
   - Cria **uma fila técnica privada necessária para retentativa**, `delivery_private.order_reporting_outbox`, contendo somente UUID da loja, referência técnica do pedido, evento, instante e estado de tentativa. Sem nome, telefone, endereço, valores, itens ou pagamento. RLS habilitada e nenhum acesso direto de anon/authenticated.
   - O trigger captura o evento na mesma transação. Falhas de gravação no demonstrativo deixam a fila pendente, sem reverter o aceite. Reenvio usa as mesmas chaves únicas; a primeira aceitação persistida define a competência.
   - Retentativa com backoff, até oito tentativas por evento; depois exige revisão técnica. O painel autorizado solicita reconciliação periódica da própria loja e consulta apenas totais de pendências.
   - Acrescenta RPCs novos `delivery_plan_usage`, `delivery_order_reporting_health` e `delivery_reconcile_order_reporting`. Exigem Auth e vínculo ativo owner/admin do store_id solicitado; não usam NX como autorização.
   - A competência vem do servidor em Brasília. Franquias de referência: Business340, Premium750, conforme os anexos. Start não recebe integração de eventos; Empresarial/outros retornam franquia desconhecida, não zero/Business por suposição.
   - **Tarifa contratual permanece não informada**: não há fonte autorizada confirmada para esse dado. Não lê tabelas privadas de contratos/cobrança e não gera faturas.

2. `20261025185604_premium_scheduled_orders.sql`
   - Usa o UUID oficial e `managed_sites.plan_code = NOVAES_PREMIUM` com loja ativa. Não presume Premium se os dados faltarem.
   - Estende o core existente `delivery_private.place_order` a partir do snapshot auditado. Preserva recálculo de preço, estoque/catálogo, adicionais, rate limits, hash/idempotência, token do pedido e atualização de clientes. Comparar o snapshot novamente antes de aplicar, para não sobrescrever mudanças posteriores do central.
   - Usa o payload existente de `delivery_orders`, sem criar uma segunda tabela de pedidos. Armazena `scheduledFor`, `preparationMinutes=30` e `fulfillmentMode` validados no servidor.
   - RPC público `delivery_schedule_options`: horários a cada15min, até7dias, antecedência mínima45min e preparo30min. Exige agenda semanal configurada, atendimento no horário de preparo e de entrega e `isOpen=true`. A pausa manual bloqueia novas solicitações. Respeita atendimento que atravessa meia-noite.
   - RPC `delivery_place_scheduled_order` usa o mesmo core de pedidos. Retirada não cobra entrega; desconto nunca reduz a taxa. Imediatos continuam no RPC existente.
   - Trigger impede preparo antecipado mesmo via API e impede alterar/injetar os campos de agendamento em pedidos existentes. Agendados entram na fila de atendimento30min antes; isso **não aceita nem prepara automaticamente** o pedido.
   - Reaproveita `delivery_coupons`. Validação da cotação e confirmação concordam em início, vencimento, limite de usos e mínimo. O início de validade também passa a ser conferido na confirmação final.
   - Restringe novas alterações de cupons a owner/admin Premium ativo, preservando dados. O contrato público `delivery_premium_features` retorna somente disponibilidade de recursos, sem dados comerciais. Não libera Fideliza ou outros adicionais.

## Sequência de aprovação e implantação

1. Revisar os dois arquivos e os efeitos no helper compartilhado. Ele afeta operações dos outros deliveries do mesmo banco: precisam de testes em staging e aprovação antes de aplicar. Nenhum registro de outra loja é alterado pelos scripts, mas as funções/políticas são compartilhadas.
2. Comparar novamente assinaturas, constraints, policies, enums, funções do core e triggers implantados; abortar se houve mudança desde a auditoria. Não duplicar um sincronizador criado por outro projeto nesse intervalo.
3. Executar os testes em staging com usuários reais de duas lojas de teste. As fixtures desta entrega não comprovam autorização em produção.
4. Aplicar primeiro controles/contagem; depois Premium/agendamento. Observar erros e saúde da fila. Não executar `db push` indiscriminado: o histórico local anterior está incompleto em relação ao central.
5. Publicar somente após autorização. Atualizar o navegador após implantação. Enquanto as RPCs novas faltarem, Meu Plano mostra “Demonstrativo aguardando atualização central”, e o agendamento fica oculto. A integração de cupons existente é preservada até o novo contrato central estar disponível; após isso, o servidor e a interface exigem o recurso Premium.
6. Confirmar no painel Master o consumo e os eventos de um pedido de teste autorizado. Não enviar dados pessoais/comerciais ao Master. Esta etapa ainda não foi executada.

Não há backfill automático de pedidos antigos: um status atual não prova a data histórica do aceite. Se necessário, preparar reconciliação separada usando evidência existente, sem inventar instantes de aceitação.

## Rollback preservando dados

Voltar o código da aplicação à revisão anterior. No banco, restaurar `delivery_has_role`, `delivery_private.place_order`, `delivery_quote_coupon` e as policies de cupons a partir do snapshot pré-implantação; remover os triggers novos se necessário. Revogar acesso aos RPCs novos antes de desativá-los. Não apagar tabelas de eventos, filas pendentes, pedidos, payloads agendados, clientes, mensagens, cupons ou histórico. Eventos já contabilizados permanecem válidos; correção somente pelo fluxo oficial do Master. Agendados já recebidos precisam de um procedimento de atendimento antes de retirar o suporte operacional.

## Evidências locais e limitações

- Verificação final em 25/10/2026: **119 testes locais aprovados** — controles/mensagens/consumo47; agendamento/impressão13; fila/alertas28; regressão do banco31. `npm run lint`, `npm run build` e `git diff --check` concluídos. O build mantém aviso de tamanho do pacote JavaScript; não impede a compilação.
- Comanda e acompanhamento do cliente mostram o horário agendado em Brasília. Comanda de retirada não imprime um endereço de entrega. Consulta de horários evita requisições sobrepostas e pausa com a aba oculta.
- Testes TypeScript/SSR/mocks: conta reduzida, bloqueio por rota, respostas403 com prazo, backoff, sessão, mensagens e formulário de plano sem exposição de dados de outra identidade.
- PostgreSQL em memória (PGlite): RLS/grants de mensagens entre dois destinatários; contagem idempotente, rejeição, cancelamento e exclusão; escrita direta e loja alheia negadas; virada do mês em Brasília; falha simulada de relatório não reverte aceite; zero bloqueio além da franquia; slots e recálculo do agendamento; imutabilidade do horário e início de cupons.
- Regressão da fila/botões rápidos e alerta sonoro existente.
- `npm run lint`, `npm run build`, `npm run test:master-controls`, `npm run test:scheduling`, `npm run test:orders`.
- Nenhum dado de produção foi alterado. Nenhuma cobrança, mensagem real, publicação, aprovação de adicional ou check-in técnico de Fideliza foi feito. Nenhuma tabela/catálogo administrativo de cobrança foi consultado pelo frontend.
- Suporte continua informativo porque não há endpoint autorizado confirmado para abrir/responder chamado pelo lojista. Mensagens do proprietário usam reconciliação60s; não se afirma Realtime dessa tabela.
- Layout preparado para celular e computador, mas não verificado visualmente em navegador nesta sessão: o acesso ao navegador estava bloqueado. Pareamento de WhatsApp não faz parte desta etapa.
