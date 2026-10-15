# Segurança

O cliente usa apenas a URL e a chave pública do Supabase. A chave `service_role` nunca deve entrar no navegador, no GitHub ou em arquivos de ambiente públicos.

Os dados operacionais usam `store_id` oficial com integridade referencial e RLS. O checkout público chama uma função limitada que calcula preço, taxa e disponibilidade no servidor; clientes não gravam tabelas diretamente.

O painel do dono exige uma sessão Supabase Auth e um vínculo ativo em `store_members`. O identificador NX identifica a loja, mas não dá acesso aos dados.
