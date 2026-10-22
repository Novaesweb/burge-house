# WhatsApp separado por loja — NovaesWeb

## Situação desta entrega

- Evolution local 2.3.7 acessível em `http://127.0.0.1:8080`.
- Burger House oficial: `e2ba2dff-0b92-497d-9b08-926c235c2934`.
- Instância exclusiva criada: `nw_e2ba2dff0b92497d9b08926c235c2934`.
- Telefone salvo: `(51) 99118-9293`. A instância ainda precisa de autorização no celular.
- A conexão legada `novaesweb_teste` foi preservada.
- Não houve migração, alteração de políticas, cadastro de outra loja ou envio de mensagens.
- O serviço de pedidos **instalado anteriormente ainda usa a configuração antiga**. O código novo foi preparado e testado; migrar esse serviço é uma etapa separada, após parear o novo remetente e revisar a fila. Conectar o painel sozinho não muda o processo antigo.
- O marketing existente tem telefone privado, consentimentos e cursor próprios. Não foi migrado nem ativado por esta entrega. Seu alinhamento deve preservar confirmações e cancelamentos, sem copiar consentimentos automaticamente para outra loja ou finalidade.

## Como o dono conecta

1. Entrar com sua conta no painel e abrir **Configurações da Loja**.
2. Salvar o **Telefone / WhatsApp de Atendimento** correto.
3. Na seção **WhatsApp da loja**, clicar **Conectar WhatsApp**.
4. No WhatsApp desse número, abrir **Aparelhos conectados → Conectar aparelho** e ler o QR Code. Quando disponível, também pode usar o código de pareamento.
5. Aguardar a tela confirmar **WhatsApp conectado** com o número correto. O sistema confere o telefone autenticado retornado pelo Evolution; gerar um QR Code não significa estar conectado.
6. Em uma troca futura, salvar o novo telefone e repetir. O painel pede confirmação antes de desconectar o número anterior da instância exclusiva desta loja. Não desconecta instâncias de outras lojas.

O QR fica apenas na memória e é ocultado em até 60 segundos. O telefone por si só não autoriza conexão. O dono precisa autorizar cada nova conta no celular.

## Como organizar outras lojas

Cada loja deve existir oficialmente no Master, com UUID próprio e vínculo ativo do proprietário em `store_members`. Não reutilizar o UUID ou os tokens da Burger House.

| Item | Regra |
|---|---|
| Nome da conexão | `nw_` + UUID oficial sem hífens, calculado no servidor |
| WhatsApp | Número exclusivo autorizado pelo dono daquela loja |
| Permissão | Usuário Supabase validado; vínculo ativo `owner` ou `admin` naquela loja |
| Fila de pedidos | Somente o `store_id` configurado e token privado correspondente |
| Credenciais Evolution | Somente no serviço, nunca no navegador ou GitHub |
| Recebimento de eventos | Quando houver automação de entrada, resolver a loja pela instância autenticada no servidor; nunca confiar em telefone/store_id arbitrários do evento |

O dono não precisa conhecer o nome técnico da instância. Ao clicar Conectar, o backend cria a conexão dedicada caso ainda não exista. Consultar o status não cria instâncias. Um telefone já vinculado a outra instância é recusado sem revelar os dados dessa instância.

Se o telefone pretendido ainda estiver conectado na instância legada, a nova conexão será recusada por esse mesmo motivo. O responsável precisa revisar o uso da conexão antiga e liberar esse telefone em uma migração autorizada; o painel não desconecta automaticamente outra instância.

Este projeto não provisiona automaticamente novos tokens de envio nem instala serviços para outras lojas. Para cada nova loja, o responsável deve habilitar a fila autorizada e um worker com o UUID/token daquela loja, diário próprio e `WHATSAPP_INSTANCE_MODE=store`. Não copiar `.env` ou diários de outra loja. Esse provisionamento depende do backend central existente e deve ser revisado antes da ativação.

## Serviço local de conexão

No projeto, iniciar `npm run whatsapp:connection`. O script lê somente no servidor o arquivo privado `~/NovaesWeb-WhatsApp-Bridge/.evolution-key` e as configurações públicas Supabase de `.env`/`.env.local`. É possível passar outro arquivo usando `backend/whatsapp/connection.ps1 -EvolutionKeyFile <caminho privado>`.

Escuta apenas `127.0.0.1:3012`. O Vite encaminha `/api/whatsapp` para esse serviço. O dono usa seu login normal da loja; nenhuma senha paralela é criada. O serviço verifica a sessão no Supabase e consulta as tabelas existentes com o JWT do próprio usuário, sob RLS.

Configurações opcionais, somente no servidor: `EVOLUTION_URL`, `EVOLUTION_KEY_FILE`, `WHATSAPP_PANEL_ORIGINS` (origens exatas separadas por vírgula). Nunca adicionar `VITE_` a uma chave Evolution, token de worker ou outra credencial privada. A chave pública Supabase pode ser usada normalmente sob RLS.

O processo local deve permanecer aberto durante o pareamento. Nenhuma nova tarefa automática do Windows foi instalada nesta entrega.

## Ativar o worker novo com revisão

Antes de alterar o serviço de envio já em uso, obter aprovação e:

1. Confirmar conexão dedicada aberta e telefone autenticado igual ao contato salvo.
2. Conferir a fila e o diário `.claim.json`. Não apagar o diário: resultado incerto ou ACK pendente exige recuperação, para evitar mensagens repetidas.
3. Parar o serviço da própria loja de forma controlada. Preservar `.env`, logs e diários em pasta protegida.
4. Copiar `worker.mjs` **e** `storeConnection.mjs` juntos para a pasta do serviço. Manter o token e o UUID já registrados, sem habilitar marketing ou alterar destinatários de teste por acidente.
5. Configurar `WHATSAPP_INSTANCE_MODE=store`. O worker passa a calcular a instância pelo UUID; não há fallback para a conta legada.
6. Reiniciar somente esse worker. Com número divergente, falha de leitura ou conexão fechada, ele mantém os avisos aguardando; não assume outro remetente. Erros com envio possivelmente aceito continuam exigindo revisão, como antes.
7. Fazer um teste de envio com destinatário autorizado e conferir o resultado. Esta entrega não realizou envio real.

O worker verifica o telefone salvo e o remetente antes de retirar um aviso da fila e novamente antes do envio. Isso reduz o intervalo de uma troca concorrente; uma mensagem já aceita pelo WhatsApp não pode ser recolhida pelo sistema.

## Site publicado e várias lojas remotas

O proxy do Vite funciona apenas no desenvolvimento local. Para o site publicado, é necessário um backend HTTPS capaz de alcançar este Evolution, com proxy de mesma origem para `/api/whatsapp`, origens autorizadas e credenciais exclusivamente no servidor. Não expor a chave ou a porta administrativa do Evolution aos lojistas. O endereço localhost no computador de outro lojista não aponta para este notebook.

O backend desta entrega é um processo único, com limite de requisições e trava por instância. Ao escalar para múltiplos processos/servidores, a trava e os limites precisam ser compartilhados. Não foi configurada hospedagem nem alterada a Vercel.

Instâncias separadas compartilham o servidor e seus recursos: uma queda ou sobrecarga do servidor pode afetar todas. A separação entre duas lojas reais ainda precisa de teste autorizado em ambiente de integração.

## Evidências e testes

`npm run test:whatsapp-connection` executa testes com usuários/lojas fictícios, sem rede externa ou envio real. Abrange autorização, vínculo inativo/ausente, funções sem permissão, loja suspensa, troca entre duas lojas, três mudanças de número, confirmação de logout só da própria instância, telefone já utilizado, concorrência, sanitização de respostas, QR, recuperação de fila e bloqueio por remetente divergente.

| Usuário/loja/recurso/operação | Esperado | Observado |
|---|---|---|
| Proprietário A / A / conexão / consultar-conectar | Permitido | Aprovado em fixtures de backend e frontend |
| Proprietário A sem vínculo B / B / conexão / consultar-conectar | Negado antes do Evolution | Aprovado em teste de autorização com fixtures |
| Vínculo inativo ou ausente / A / conexão / gerenciar | Negado | Aprovado com resposta RLS vazia simulada |
| Staff/viewer / A / conexão / gerenciar | Negado | Aprovado em fixture |
| Anônimo / Burger House / HTTP local / consultar | 401 | Observado no serviço local real |
| A muda telefone / A e B / instâncias / reconectar | Só A alterada | Aprovado em fixture de três trocas |
| Remetente divergente / A / fila / enviar | Nenhum envio e fila preservada | Aprovado em teste do worker |
| Dono real / Burger House / QR e envio / conectar-enviar | Autorização no celular e destinatário autorizado | Pendente; não executado |

Testes com fixtures não comprovam isolamento em produção. O layout não foi verificado em navegador nesta sessão, pois esse acesso estava bloqueado. Compilação e verificação de tipos foram executadas separadamente.
