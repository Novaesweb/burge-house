# Burger House Delivery

Delivery da Burger House integrado ao Supabase central NovaesWeb Master.

## Incluído

- Cardápio público, carrinho e checkout.
- Pedidos, clientes e status armazenados por loja no Supabase.
- Painel do dono em `/#/admdono`, protegido por Supabase Auth.
- Categorias, produtos, taxa, horários, formas de pagamento, PIX e notificações configuráveis no painel.
- Isolamento de dados por `store_id` e políticas RLS.

## Executar localmente

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` e preencha somente a URL e a chave pública do Supabase, além dos identificadores oficiais retornados pelo Master. Nunca adicione chaves administrativas ao navegador ou ao repositório.

## Verificação

```bash
npm run lint
npm run build
npm run test:db
```

## Antes de publicar

1. O proprietário deve criar a senha, entrar em `/#/admdono` e concluir o primeiro check-in com o Master.
2. Preencha telefone, endereço, horário e, se for usar PIX, a chave PIX no painel.
3. Configure as mesmas variáveis públicas no provedor de hospedagem e inclua o endereço publicado nos redirecionamentos do Supabase Auth.

