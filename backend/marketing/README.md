# Marketing real da Burger House — preparado, desativado

Base: `Novaesweb/burge-house`, commit `177e9fd2563c6d20ec2b49ae1402bad247be5903`. Esta pasta não altera o serviço existente `BurgeHouseWhatsApp`, os IDs oficiais, preços ou pedidos. A demonstração original permanece em outra aba.

## Fluxo

1. Cliente solicita promoções **opcionalmente** no acompanhamento ou após a entrega. O servidor confere o segredo do pedido e obtém o telefone do próprio pedido.
2. Cliente envia `ACEITO PROMOCOES <código>` a partir desse WhatsApp. Somente mensagem recebida pela instância vinculada, código correto e recente concluem a autorização. Não se importa consentimento de pedidos ou da demonstração.
3. Dono prepara rascunho com público confirmado. Mensagem, destinatários e link de cancelamento ficam persistidos. O dono revisa as mensagens completas antes de aprovar.
4. São necessárias três liberações: configuração no banco, configuração local e aprovação individual. Nenhuma está ativada por esta entrega.
5. SAIR ou confirmação no link individual cancelam o marketing e suprimem os jobs pendentes/reservados. Abrir o link sozinho não cancela. Avisos transacionais permanecem independentes.

## Preparar no PowerShell

Requer PowerShell 7, Node 22+, Supabase existente e Evolution local conectada em `127.0.0.1:8080`. Não exponha essa porta à internet. Não use chave `service_role`. A chave pública do projeto não é secreta; o token de trabalhador gerado é privado e distinto do serviço de pedidos.

```powershell
./backend/marketing/prepare.ps1 `
 -SupabaseUrl 'https://mabkzkawziqlmgfikwmh.supabase.co' `
 -PublishableKey '<chave pública existente>' `
 -WhatsAppPhone '<55 + DDD + número conectado>'
```

O script confere a conexão por leitura, cria uma pasta protegida por ACL para usuário atual e SYSTEM, gera token aleatório e prepara SQL com apenas seu hash. Lê a chave Evolution de arquivo privado existente; não a copia ao projeto. Não executa migrações, inicia processos, registra tarefas, altera outras lojas ou manda mensagens. Recusa sobrescrever instalação existente. Não cole segredos em comandos, histórico, chat ou `VITE_*`.

## Etapas que ainda exigem aprovação antes de produção

- Revisar e aplicar `supabase/migrations/20261018131153_marketing_consent_queue.sql`. A migração é aditiva, sem registros de loja. Aplicar depois o `provision-after-approval.sql` gerado exclusivamente para `e2ba2dff-0b92-497d-9b08-926c235c2934`, com envio `false`.
- Publicar o frontend revisado. Conferir login, acesso da loja e link de cancelamento no domínio oficial antes de liberar qualquer campanha. Não alterar o `store_id` e não recriar tabelas existentes.
- Executar `run.ps1 -Check` na instalação privada. Esse comando faz leituras da Evolution e atualiza apenas heartbeat do trabalhador. Executar `run.ps1` com flags padrão processa somente consentimentos e cancelamentos, **sem enviar**.
- Teste real de envio exige confirmação do número de teste e autorização específica. Enquanto isso, testes usam somente mocks e banco em memória.
- Somente após autorização explícita, habilitar `settings.enabled` apenas nessa loja e, na configuração privada, `MARKETING_SEND_ENABLED=true` e `MARKETING_ACTIVATION_CONFIRMED=<UUID oficial>`. Cada campanha ainda exige revisão e aprovação no painel. Não há botão público para habilitar a loja.

## Operação e recuperação

O notebook, Docker, Evolution, internet e processo precisam estar ligados. A fila continua no Supabase quando o notebook está desligado. Não há instalação automática de tarefa neste pacote. Para serviço permanente, use hospedagem protegida e adapte a restrição de origem da Evolution após revisão; não abra a porta local.

O serviço sincroniza mensagens recebidas antes de cada envio, incluindo todas as páginas do histórico retido na Evolution. Não filtra pelo horário de envio: um SAIR de cliente offline pode chegar atrasado. Falha de leitura, vínculo da instância incorreto, histórico acima de 10.000 registros ou resposta inconsistente interrompem o processo, sem disparar. Histórico maior exige implantação revisada de captura persistente de eventos; não apague conversas para contornar o limite. A Evolution precisa reter as mensagens enquanto o serviço estiver offline. Mensagens de grupos e do próprio número não autorizam inscrição. Remetentes `@lid` precisam do telefone alternativo autenticado fornecido pela Evolution; SAIR sem esse vínculo interrompe envios para revisão, em vez de ignorar o cancelamento. Nesta versão, remetentes devem coincidir exatamente com o telefone brasileiro confirmado no pedido; variações do nono dígito ficam pendentes, sem autorização presumida.

Limite persistente: 6 autorizações por janela de 5 minutos por loja, inclusive após reinício. O limite não evita bloqueios do WhatsApp. Não há alteração automática do texto da oferta. `accepted` significa somente que a Evolution retornou um protocolo; não há métricas fictícias de entrega ou leitura.

Para **cancelar**, SAIR suprime conservadoramente as duas formas brasileiras com e sem nono dígito no mesmo DDD. Essa equivalência nunca concede autorização nem inclui novos destinatários.

O arquivo `.marketing-claim.json` é salvo antes de transmitir. Retomada depois de timeout ou crash não repete o envio: registra `uncertain` para revisão humana. ACK perdido retoma somente a confirmação. Não apague o diário para tentar reenviar. Claims órfãos há 30 minutos também ficam em revisão. Não há retry automático de resultados ambíguos. Não execute duas instalações ou reutilize token em outra loja. O lock exclusivo impede duas instâncias locais; após crash, revise diário e histórico antes de remover manualmente o `.marketing.lock` antigo.

Pausa/cancelamento e revogação são reconferidos antes de transmitir. Mensagem já em trânsito na Evolution pode concluir após o cancelamento. Para interromper: pare o processo e desabilite a configuração da loja; preserve fila e histórico. Rotação de token exige novo hash no banco e troca protegida no serviço parado. Não exclua dados para reverter a interface.

## Verificação sem mensagens

```powershell
node tests/marketing-database.mjs
node --test --test-isolation=none tests/marketing-worker.mjs
npm run lint
npm run build
```

As tabelas privadas usam RLS e não têm acesso direto de `anon`/`authenticated`. RPCs públicas são invoker; funções privadas definer usam `search_path` vazio, verificam papel proprietário/administrador ou capacidade de trabalhador vinculada à loja. Consentimento exige segredo do pedido; cancelamento usa capacidade individual que permite somente revogação. Configurações privadas nunca fazem parte do bundle.
