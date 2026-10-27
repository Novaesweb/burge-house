# Integração pelos contratos existentes — 27/10/2026

Escopo autorizado: complementar catálogo/solicitações (3) e contagem de aceites (5) somente no código. Prompt 4 condicionado à escolha e ao escopo de um adicional específico. Nenhuma alteração de schema, policy, função, trigger, catálogo, cadastro, contratação, Vercel ou produção. Nenhum SQL proposto foi aplicado. Fideliza e Gift não foram implementados ou ativados.

## Adicionais

Reutilizados `AdminAddons.tsx`, `addonService.ts` e a navegação existente. Acrescentado `addonCommercialState.ts` para tratar estados sem liberar módulos. Uma página comercial; nenhuma lista fixa de códigos ou preços. Os 29 registros observados no central são a fonte vigente, independentemente da quantidade citada nos prompts. Compatibilidade usa o tipo oficial; tipo ausente aceita somente compatibilidade `*`, sem inventar `delivery`.

Leitura autenticada das quatro tabelas: catálogo, solicitações, permissões e instalações. Realtime invalida a consulta; reconciliação a cada 60 segundos com aba visível e ao retornar. As quatro tabelas estão na publicação. Dados de conta anterior ficam ocultos; respostas atrasadas não substituem a consulta da conta atual. Detalhes e requisitos continuam recolhíveis. Recusa mostra `decision_reason`.

Solicitação escreve somente `store_id`, `addon_id`, `requested_by` em `addon_requests`, com status inicial definido pelo banco. Serviço revalida usuário, vínculo owner/admin ativo, status da loja e compatibilidade; previne reenvio quando já há solicitação em andamento/contratação. Não escreve catálogo, entitlement, condições comerciais, auditoria ou instalações. Corridas entre dispositivos continuam sujeitas às constraints centrais; sem schema novo.

`approved` permanece Em preparo. Módulo com entitlement ativo mas sem solicitação coerente, `ready` ou instalação `available` mostra revisão pendente; isso não cria implementação. Serviços da categoria `service` não exigem instalação de software fictícia. Desativado preserva histórico. Funções existentes de equipe, marketing, relatórios, cupons, impressão e WhatsApp não foram convertidas em adicionais pagos ou reimplementadas.

Estado observado: Fideliza aprovado, desenvolvimento planned; Gift awaiting_confirmation; nenhuma instalação e nenhum entitlement ativo. O check-in implantado foi lido, mas não invocado. Não há módulo escolhido/escopo aprovado para executar a etapa 4.

## Contagem

Ponto de chamada: `remoteStoreService.updateRemoteOrder`, somente após UPDATE condicional bem-sucedido `recebido → preparando`. Mantém condição de status anterior; concorrente que perde a atualização não enfileira. Atualização de pagamento, impressão, rejeição e outras etapas não enviam aceite.

`orderReportingService` guarda pendência técnica por usuário e UUID de loja no armazenamento deste navegador. Persiste somente referência técnica estável, instante original `updated_at` retornado pelo banco e estado de tentativa. Envia à RPC **existente** `novaesweb_record_order_event` apenas `p_store_id`, `p_order_ref`, `p_event_type='accepted'`, `p_occurred_at`. Sem preços, itens, dados pessoais ou pagamento. Resposta `already_counted=true` também conclui o reenvio, mesmo quando `recorded=false`.

Reenvio ao aceitar, retornar à aba, reconectar e periodicamente; backoff de 1 minuto até 15 minutos, máximo oito tentativas por evento. Erros permanentes/autorização/data ficam preservados para revisão, sem alterar o instante original. O central rejeita instantes anteriores a 48 horas ou mais de cinco minutos à frente. Não há reenvio como novo aceite para contornar essa regra. Cancelamento e exclusão do pedido não removem a pendência nem a contagem. Start não participa. Falha de relatório não desfaz o pedido. Falha de persistência local avisa o operador.

Sem trigger central de contagem, há uma janela entre a confirmação do pedido e a persistência local; fechar o navegador nessa janela ou limpar seu armazenamento pode perder a pendência. Sem alteração de backend não se promete captura transacional/durável no servidor. Pendências são deste navegador/conta, não de todos os funcionários ou dispositivos. A RPC é a autoridade de deduplicação entre abas/dispositivos.

## Meu Plano

`planUsageService` reutiliza `managed_sites`, vínculo próprio em `store_members`, as views `store_order_usage_monthly`/`store_order_lifecycle_summary` e leitura mínima paginada de `store_order_usage_events(id,accepted_at)` para histórico diário. Nenhuma escrita direta nas tabelas de eventos. Leituras levam filtro de UUID e RLS; não consultam tabelas comerciais restritas do Master.

Competência atual pela RPC já existente `novaesweb_order_competence(p_ts='now')`: PostgreSQL interpreta `now` no servidor e a função calcula o mês em Brasília. Permissão EXECUTE autenticada e resultado foram conferidos no central por consulta somente leitura. Não calcula mês com relógio do navegador. Histórico diário usa datas de aceite do servidor convertidas para Brasília; paginação e checagem de consistência evitam exibir total parcial como completo.

Franquias Business 340 e Premium 750 conforme prompt; Empresarial sem valor autorizado fica A confirmar. Tarifa contratual não foi encontrada em fonte de leitura autorizada: mostra não informada, sem inventar R$ 0,15/R$ 0,20 nem criar cobrança. Alertas 80%/100% mantêm Zero Bloqueio. Não há informação de franquia no site público.

## Matriz de verificação e limites

| Usuário/recurso/operação | Esperado | Evidência observada |
|---|---|---|
| Owner A / loja A / registrar aceite | Uma contagem mesmo em reenvio | RPC implantada copiada em PGlite: passou |
| Owner A / loja A / rejeitar, cancelar após aceite e excluir pedido | Rejeição zero; aceite permanece um | PGlite: passou |
| Owner A / loja B / registrar/consultar | Negado ou nenhuma linha | PGlite com RLS modelada do central: passou |
| Sem sessão, vínculo inativo ou staff / RPC de aceite | Negado | PGlite: passou |
| Owner A / eventos / escrita direta | Negada | PGlite: passou |
| Owner/admin / catálogo e solicitação | Somente UUID/vínculo próprios e campos permitidos | Serviço com mocks: passou |
| Staff / catálogo e solicitação via interface/serviço | Negado | Mocks: passou; política central é mais ampla, ver abaixo |
| Solicitação aprovada sem entitlement / acesso | Em preparo, sem instalar módulo | Teste de estados: passou |
| Entitlement contraditório/degradado / estado | Revisão pendente | Teste de estados: passou |

**Pendências do contrato central, sem alterações nesta tarefa:** a policy de solicitação aceita membro ativo sem restringir papel; o frontend/serviço owner/admin não substitui proteção contra chamadas diretas à API. A RPC de contagem exige owner/admin; aceites por staff não são sincronizados automaticamente pelo banco e geram aviso de revisão. Não foram ampliadas permissões nem adicionada impersonação. Não é possível declarar integração completa desses cenários sem ajuste autorizado no central.

Verificação local: `test:master-controls` 56 testes; `test:orders` 28 testes; TypeScript, build e checagem de diferenças aprovados. Build mantém aviso de pacote grande. Testes incluem a cópia somente leitura da RPC implantada em banco local, não SQLs propostos. `tests/fixtures/official_order_event.sql` é fixture, nunca migration. Testes antigos ligados à proposta foram retirados do comando principal e preservados como histórico.

Não executados: fluxo funcional em staging com sessões reais de duas lojas, entrega efetiva por Realtime entre Master e lojista, aprovação/ativação real e teste visual no navegador. Nenhuma fixture ou pedido enviado à produção. Não se declara isolamento em produção comprovado por mocks/PGlite.

## Publicação e rollback

Não houve commit, push, deploy ou alteração de banco nesta etapa. Após autorização separada, validar em staging com duas lojas e sessões reais antes de publicar. Se houver regressão, restaurar somente os arquivos desta correção à revisão imediatamente anterior e reconstruir o site; não aplicar SQL, apagar pedidos ou zerar contadores. Preservar/exportar pendências técnicas locais para revisão, sem reenviar instantes novos. Eventos já aceitos permanecem no central; correção somente pelo Master.
