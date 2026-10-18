# Marketing: preparação isolada

Esta integração não substitui o serviço de status de pedidos. A migração cria somente objetos novos em `marketing_private` e quatro RPCs com prefixo `bh_marketing_`. Nenhuma loja é habilitada automaticamente. A chave Evolution e o token do trabalhador nunca chegam ao navegador.

Compras não constituem autorização para promoções. O cliente solicita a inscrição usando o segredo de acesso ao próprio pedido e confirma enviando o código pelo WhatsApp. O processo confere remetente, horário e código de uso único. SAIR e o link individual revogam a autorização e suprimem a fila. Um envio já em trânsito no provedor pode terminar após o cancelamento.

Campanhas são preparadas como rascunhos imutáveis. Aprovação individual, configuração habilitada no banco e autorização local explícita são necessárias para transmitir. Por padrão, todas estão desativadas. Falhas ambíguas são colocadas em revisão, sem reenvio automático. Aceitação da API não significa entrega ou leitura.
