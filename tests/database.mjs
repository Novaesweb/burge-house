import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
const root=new URL('../',import.meta.url);
const sql=async(path)=> (await readFile(new URL(path,root),'utf8')).replace(/^\uFEFF/,'');
let passed=0;
const test=async(name,run)=>{await run();passed++;console.log(`OK ${name}`);};
const query=(text,params=[])=>db.query(text,params);
const one=async(text,params=[])=> (await query(text,params)).rows[0];
async function role(name,user,run){await db.exec(`set role ${name}`);await query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);try{return await run();}finally{await db.exec('reset role');}}
async function denied(run){let rejected=false;try{await run();}catch{rejected=true;}assert.equal(rejected,true,'A operação deveria ter sido negada');}
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',M='10000000-0000-4000-8000-000000000003',S='10000000-0000-4000-8000-000000000004',V='10000000-0000-4000-8000-000000000005',X='10000000-0000-4000-8000-000000000006',Y='10000000-0000-4000-8000-000000000007';
try{
await db.exec(`
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create table public.master_profiles(user_id uuid primary key references auth.users,role text,is_active boolean);
alter table public.master_profiles enable row level security;
create policy profile_self on public.master_profiles for select to authenticated using(user_id=(select auth.uid()));
grant select on public.master_profiles to authenticated;
create table public.master_role_permissions(id uuid default gen_random_uuid());
create table public.master_audit_log(id uuid default gen_random_uuid(),actor_user_id uuid,action text,entity_type text,entity_id text,result text,reason text,metadata jsonb,created_at timestamptz default now());
create table public.master_notifications(id uuid default gen_random_uuid(),recipient_user_id uuid,category text,title text,body text,entity_type text,entity_id text);
`);
await db.exec(await sql('tests/fixtures/central_catalog.sql'));
await db.exec(await sql('tests/fixtures/central_registration.sql'));
await db.exec(await sql('supabase/migrations/20261014185902_delivery_operational_data.sql'));
await db.exec('grant all on all tables in schema public to service_role;grant all on all sequences in schema public to service_role;');
for(const id of [A,B,M,S,V,X,Y])await query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,`${id.slice(-1)}@test.invalid`]);
await query("insert into master_profiles values($1,'MASTER',true)",[M]);
const request=async(user,domain,key)=>role('service_role',null,async()=> (await one('select public.novaesweb_create_site_registration_request($1,$2,$3,null,$4,null,$5) as result',[user,'test@test.invalid','Fixture local',domain,key])).result);
const review=async(id,user,decision)=>role('service_role',null,async()=> (await one('select public.novaesweb_review_site_registration($1,$2,$3,$4) as result',[id,user,decision,'Teste local'])).result);
await test('anônimo e cliente autenticado não registram ou aprovam diretamente',async()=>{
  await role('anon',null,()=>denied(()=>query("select public.novaesweb_create_site_registration_request($1,null,'Fixture',null,'a.test.invalid',null,gen_random_uuid())",[A])));
  await role('authenticated',A,()=>denied(()=>query("select public.novaesweb_review_site_registration(gen_random_uuid(),$1,'approve',null)",[A])));
});
const requestWithoutDomain=await request(Y,null,'20000000-0000-4000-8000-000000000021');
await test('solicitação aceita cadastro sem domínio e não cria IDs oficiais',async()=>{assert.equal(requestWithoutDomain.status,'pending_approval');assert.equal(requestWithoutDomain.store_id,undefined);await review(requestWithoutDomain.request_id,M,'reject');});
const requestA=await request(A,'a.test.invalid','20000000-0000-4000-8000-000000000001');
await test('repetição de solicitação usa o mesmo registro',async()=>assert.equal((await request(A,'a.test.invalid','20000000-0000-4000-8000-000000000001')).request_id,requestA.request_id));
await test('solicitação pendente não cria loja ou IDs oficiais',async()=>{assert.equal((await one('select count(*)::int as count from managed_sites')).count,0);assert.equal(requestA.store_id,undefined);});
await test('domínio pendente não pode ser duplicado',()=>denied(()=>request(B,'a.test.invalid','20000000-0000-4000-8000-000000000002')));
await test('não MASTER é impedido mesmo no procedimento protegido',()=>denied(()=>review(requestA.request_id,A,'approve')));
const approvedA=await review(requestA.request_id,M,'approve');const storeA=approvedA.store_id;
await test('aprovação cria UUID/NX e todos os vínculos atomicamente',async()=>{
  assert.match(approvedA.nx_id,/^NX-[A-F0-9]{32}$/);
  for(const table of ['managed_sites','store_members','store_domains','store_integrations'])assert.equal((await one(`select count(*)::int as count from ${table} where ${table==='managed_sites'?'id':'store_id'}=$1`,[storeA])).count,1);
});
await test('aprovação repetida mantém o mesmo UUID',async()=>assert.equal((await review(requestA.request_id,M,'approve')).store_id,storeA));
await test('domínio aprovado não pode ser solicitado novamente',()=>denied(()=>request(B,'a.test.invalid','20000000-0000-4000-8000-000000000003')));
const requestB=await request(B,'b.test.invalid','20000000-0000-4000-8000-000000000004');const storeB=(await review(requestB.request_id,M,'approve')).store_id;
await test('recusa não cria loja',async()=>{const r=await request(X,'reject.test.invalid','20000000-0000-4000-8000-000000000005');await review(r.request_id,M,'reject');assert.equal((await one('select count(*)::int as count from managed_sites')).count,2);});
await test('limite de solicitações é aplicado',async()=>{for(let n=0;n<4;n++)await request(X,`rate${n}.test.invalid`,`20000000-0000-4000-8000-00000000001${n}`);await denied(()=>request(X,'rate99.test.invalid','20000000-0000-4000-8000-000000000019'));});
await test('falha em domínio não deixa cadastro parcial',async()=>{
  const r=await request(A,'atomic.test.invalid','20000000-0000-4000-8000-000000000020');
  await query("insert into store_domains(store_id,domain) values($1,'atomic.test.invalid')",[storeB]);
  await denied(()=>review(r.request_id,M,'approve'));
  assert.equal((await one('select count(*)::int as count from managed_sites')).count,2);
  assert.equal((await one('select status from site_registration_requests where id=$1',[r.request_id])).status,'pending_approval');
});
await query("update managed_sites set status='active' where id in ($1,$2)",[storeA,storeB]);
await query("insert into store_members(store_id,user_id,role,is_active) values($1,$2,'staff',true),($1,$3,'viewer',true)",[storeA,S,V]);
const settings={name:'Fixture',deliveryFee:5,isOpen:true,acceptedPaymentMethods:['pix','cash']};
const cats=[{id:'category',name:'Categoria',order:1,isActive:true}];const products=[{id:'product',categoryId:'category',name:'Produto',price:18.9,isActive:true,addons:[{id:'cheese',name:'Queijo',price:2}]}];
const importCatalog=(storeId,user)=>role('authenticated',user,()=>query('select delivery_import_catalog($1,$2,$3,$4)',[storeId,settings,cats,products]));
await test('catálogo importado mantém IDs e pode repetir sem duplicar',async()=>{await importCatalog(storeA,A);await importCatalog(storeA,A);await importCatalog(storeB,B);assert.equal((await one('select count(*)::int as count from delivery_products')).count,2);});
await test('staff, viewer e outra loja não alteram catálogo',async()=>{await denied(()=>importCatalog(storeA,S));await denied(()=>importCatalog(storeA,V));await denied(()=>importCatalog(storeB,A));});
await test('perfil sem vínculo não lê pedidos ou clientes',async()=>{await role('authenticated',X,async()=>{assert.equal((await one('select count(*)::int as count from delivery_orders')).count,0);assert.equal((await one('select count(*)::int as count from delivery_customers')).count,0);});});
await test('RLS limita solicitações ao próprio usuário',()=>role('authenticated',B,async()=>assert.equal((await one('select count(*)::int as count from site_registration_requests where id=$1',[requestA.request_id])).count,0)));
await test('catálogo ativo é público, informações privadas não',()=>role('anon',null,async()=>{assert.equal((await one('select count(*)::int as count from delivery_products')).count,2);await denied(()=>query('select * from delivery_orders'));await denied(()=>query('select * from delivery_customers'));}));
await test('FK composta impede produto ligado a categoria de outra loja',async()=>{
 await query("insert into delivery_categories(store_id,id,payload) values($1,'b-only',$2)",[storeB,{name:'Só B'}]);
 await role('authenticated',A,()=>denied(()=>query("insert into delivery_products(store_id,id,category_id,price_cents,payload) values($1,'bad','b-only',10,$2)",[storeA,{name:'Bad'}])));
});
await test('troca de store_id é proibida mesmo para dono de ambas',async()=>{
 await query("insert into store_members(store_id,user_id,role,is_active) values($1,$2,'owner',true)",[storeB,A]);
 await role('authenticated',A,()=>denied(()=>query('update delivery_categories set store_id=$1 where store_id=$2 and id=$3',[storeB,storeA,'category'])));
 await query('delete from store_members where store_id=$1 and user_id=$2',[storeB,A]);
});
const token='a'.repeat(64),tokenB='b'.repeat(64),orderKey='30000000-0000-4000-8000-000000000001';
const orderRequest={customerName:'Cliente Local',customerPhone:'11988887777',deliveryAddress:{street:'Rua de Teste',number:'1',neighborhood:'Centro'},paymentMethod:'pix',items:[{productId:'product',quantity:2,price:0.01,selectedAddons:[{id:'cheese',price:0}]}],total:0.01,isPaid:true};
let order;
await test('checkout calcula preço, taxa e pagamento no servidor',async()=>{
 order=(await role('anon',null,()=>one('select delivery_place_order($1,$2,$3,$4) as result',[storeA,orderRequest,orderKey,token]))).result;
 assert.equal(order.total,46.8);assert.equal(order.isPaid,false);assert.equal(order.status,'recebido');assert.equal(order.items[0].price,20.9);
});
await test('repetição de checkout não duplica pedido ou cliente',async()=>{const again=(await role('anon',null,()=>one('select delivery_place_order($1,$2,$3,$4) as result',[storeA,orderRequest,orderKey,token]))).result;assert.equal(again.id,order.id);assert.equal((await one('select count(*)::int as count from delivery_orders')).count,1);assert.equal((await one("select (payload->>'totalOrders')::int as count from delivery_customers where store_id=$1",[storeA])).count,1);});
await test('tentativa alterada com mesma chave não passa',()=>role('anon',null,()=>denied(()=>query('select delivery_place_order($1,$2,$3,$4)',[storeA,{...orderRequest,customerName:'Alterado'},orderKey,token]))));
await test('tracking exige loja correta e segredo correto',()=>role('anon',null,async()=>{await denied(()=>query('select delivery_track_order($1,$2,$3)',[storeB,order.id,token]));await denied(()=>query('select delivery_track_order($1,$2,$3)',[storeA,order.id,tokenB]));assert.equal((await one('select delivery_track_order($1,$2,$3) as result',[storeA,order.id,token])).result.id,order.id);}));
await test('loja B não lê nem altera pedidos da loja A',()=>role('authenticated',B,async()=>{assert.equal((await one('select count(*)::int as count from delivery_orders where id=$1',[order.id])).count,0);assert.equal((await query("update delivery_orders set status='entregue' where id=$1 returning id",[order.id])).rows.length,0);}));
await test('viewer não altera pedidos e staff só altera campos autorizados',async()=>{
 await role('authenticated',V,async()=>assert.equal((await query("update delivery_orders set status='preparando' where id=$1 returning id",[order.id])).rows.length,0));
 await role('authenticated',S,async()=>{await denied(()=>query('update delivery_orders set total_cents=1 where id=$1',[order.id]));await query("update delivery_orders set status='entregue' where id=$1",[order.id]);});
});
await test('avaliação só com chave do cliente, uma vez, após entrega',()=>role('anon',null,async()=>{await denied(()=>query('select delivery_review_order($1,$2,$3,$4)',[storeA,order.id,tokenB,{foodRating:5,deliveryRating:5}]));await query('select delivery_review_order($1,$2,$3,$4)',[storeA,order.id,token,{foodRating:5,deliveryRating:5}]);await denied(()=>query('select delivery_review_order($1,$2,$3,$4)',[storeA,order.id,token,{foodRating:4,deliveryRating:4}]));}));
await test('vínculo inativo bloqueia escrita',async()=>{await query('update store_members set is_active=false where store_id=$1 and user_id=$2',[storeA,A]);await denied(()=>importCatalog(storeA,A));await query('update store_members set is_active=true where store_id=$1 and user_id=$2',[storeA,A]);});
await test('loja suspensa não aceita checkout ou leitura pública',async()=>{await query("update managed_sites set status='suspended' where id=$1",[storeA]);await role('anon',null,async()=>{assert.equal((await one('select count(*)::int as count from delivery_products where store_id=$1',[storeA])).count,0);await denied(()=>query('select delivery_place_order($1,$2,gen_random_uuid(),$3)',[storeA,orderRequest,token]));});});
console.log(`\n${passed} testes locais passaram. Nenhum dado de teste foi enviado ao Supabase real.`);
}catch(error){console.error(error.message);if(error.internalQuery)console.error(error.internalQuery);process.exitCode=1;}finally{await db.close();}

