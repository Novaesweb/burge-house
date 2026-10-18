import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {configuration,rpcClient,synchronize,tick,STORE} from '../backend/marketing/worker.mjs';
const db=new PGlite();
const S='e2ba2dff-0b92-497d-9b08-926c235c2934',B=randomUUID(),U=randomUUID(),OTHER=randomUUID(),ORDER=randomUUID(),TOKEN='a'.repeat(64),SECRET='b'.repeat(64),P='5551999991111';
let passed=0;
const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
const one=async(sql,args=[])=>(await q(sql,args))[0];
const test=async(name,run)=>{await run();passed++;console.log('OK '+name);};
async function role(r,u,run){await db.exec(`set role ${r}`);await q("select set_config('request.jwt.claim.sub',$1,false)",[u||'']);try{return await run();}finally{await db.exec('reset role');}}
async function denied(run){await assert.rejects(run);}
const admin=(op,args={},s=S,u=U)=>role('authenticated',u,async()=>(await one('select public.bh_marketing_admin($1,$2,$3) v',[s,op,args])).v);
const worker=(op,args={},s=S,t=SECRET)=>role('anon',null,async()=>(await one('select public.bh_marketing_worker($1,$2,$3,$4) v',[s,t,op,args])).v);
const consent=(s=S,o=ORDER,t=TOKEN)=>role('anon',null,async()=>(await one('select public.bh_marketing_request_consent($1,$2,$3) v',[s,o,t])).v);
try{
await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create table public.managed_sites(id uuid primary key,status text);
create table public.store_members(store_id uuid,user_id uuid,role text,is_active boolean);
create table public.delivery_orders(id uuid primary key,store_id uuid,access_hash text,payload jsonb,created_at timestamptz default now());
create function public.delivery_has_role(s uuid,roles text[]) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.store_members m join public.managed_sites x on x.id=m.store_id where m.store_id=s and m.user_id=auth.uid() and m.role=any(roles) and m.is_active and x.status='active')$$;`);
await q("insert into managed_sites values($1,'active'),($2,'active')",[S,B]);
await q("insert into store_members values($1,$2,'owner',true),($3,$4,'owner',true)",[S,U,B,OTHER]);
await q("insert into delivery_orders values($1,$2,encode(sha256(convert_to($3,'UTF8')),'hex'),$4,now()-interval '35 days')",[ORDER,S,TOKEN,{customerName:'Cliente fixture',customerPhone:P}]);
await db.exec(await readFile(new URL('../supabase/migrations/20261018131153_marketing_consent_queue.sql',import.meta.url),'utf8'));
await test('migração não ativa nem cria configurações de lojas',async()=>assert.equal((await one('select count(*)::int n from marketing_private.settings')).n,0));
await q("insert into marketing_private.settings(store_id,worker_hash,whatsapp_phone,consent_enabled) values($1,encode(sha256(convert_to($2,'UTF8')),'hex'),'5551999990000',true),($3,repeat('c',64),'5551999992222',true)",[S,SECRET,B]);
await test('anônimos não leem tabelas nem usam painel',async()=>{
 await role('anon',null,()=>denied(()=>q('select * from marketing_private.contacts')));
 await role('anon',null,()=>denied(()=>q("select public.bh_marketing_admin($1,'dashboard','{}')",[S])));
});
await test('dono de outra loja não acessa dados ou prepara campanha',async()=>{await denied(()=>admin('dashboard',{},S,OTHER));await denied(()=>admin('prepare',{request_id:randomUUID(),title:'x',body:'y',segment:0},B));});
await test('token do trabalhador não autoriza outra loja nem token incorreto',async()=>{await denied(()=>worker('status',{},B));await denied(()=>worker('status',{},S,'c'.repeat(64)));});
await test('compra não é consentimento e segredo de pedido é obrigatório',async()=>{
 assert.equal((await admin('dashboard')).contacts.length,0);await denied(()=>consent(S,ORDER,'d'.repeat(64)));await denied(()=>consent(B));
});
let request;
await test('solicitação é idempotente e não confirma inscrição',async()=>{request=await consent();assert.equal(request.state,'pending');assert.equal((await consent()).challenge,request.challenge);assert.equal((await admin('dashboard')).contacts[0].state,'pending');});
const inbound=(id,text,phone=P,time=new Date())=>worker('inbound',{provider_id:id,phone,text,timestamp:time.toISOString()});
await test('código errado, remetente errado e mensagem anterior não consentem',async()=>{
 await inbound('wrong','ACEITO PROMOCOES '+randomUUID());await inbound('other','ACEITO PROMOCOES '+request.challenge,'5551999992222');await inbound('old','ACEITO PROMOCOES '+request.challenge,P,new Date(Date.now()-60000));
 assert.equal((await admin('dashboard')).contacts[0].state,'pending');
});
await test('confirmação com código, telefone e horário válidos registra evidência',async()=>{
 await inbound('right','ACEITO PROMOCOES '+request.challenge);await inbound('right','ACEITO PROMOCOES '+request.challenge);
 assert.equal((await admin('dashboard')).contacts[0].state,'opted_in');assert.equal((await one("select count(*)::int n from marketing_private.events where kind='consent_confirmed'")).n,1);
});
let campaign;const rid=randomUUID();
await test('rascunho prepara fila imutável uma única vez e inclui cancelamento',async()=>{
 campaign=await admin('prepare',{request_id:rid,title:'Fixture',body:'Oferta fixture',segment:30});
 assert.equal((await admin('prepare',{request_id:rid,title:'Fixture',body:'Oferta fixture',segment:30})).id,campaign.id);
 await denied(()=>admin('prepare',{request_id:rid,title:'Fixture',body:'Alterada',segment:30}));
 const jobs=await admin('details',campaign);assert.equal(jobs.length,1);assert.match(jobs[0].text,/SAIR/);assert.match(jobs[0].text,/marketing-unsubscribe=/);
 await denied(()=>admin('details',campaign,B,OTHER));
});
await test('envio desabilitado bloqueia aprovação e reserva',async()=>{await denied(()=>admin('approve',{id:campaign.id,body:'Oferta fixture',count:1}));assert.equal(await worker('claim',{claim_id:randomUUID()}),null);});
// Only the isolated fixture is enabled. No network or live database is used.
await q('update marketing_private.settings set enabled=true where store_id=$1',[S]);
await worker('synced',{until:new Date().toISOString()});
await test('aprovação exige revisar o texto e a quantidade',async()=>{await denied(()=>admin('approve',{id:campaign.id,body:'Alterada',count:1}));await denied(()=>admin('approve',{id:campaign.id,body:'Oferta fixture',count:2}));await admin('approve',{id:campaign.id,body:'Oferta fixture',count:1});});
let claim=randomUUID(),job;
await test('reserva recuperável não duplica job',async()=>{job=await worker('claim',{claim_id:claim});assert.equal(job.state,'claimed');assert.equal((await worker('claim',{claim_id:claim})).id,job.id);assert.equal(await worker('claim',{claim_id:randomUUID()}),null);});
await test('pausa impede autorização e retomada exige aprovação',async()=>{await admin('pause',campaign);assert.equal((await worker('authorize',{claim_id:claim})).allowed,false);await admin('approve',{id:campaign.id,body:'Oferta fixture',count:1});});
await test('SAIR com variação do nono dígito após reserva impede envio; replay não reinscreve',async()=>{
 await inbound('stop',' SAIR ',P.slice(0,4)+P.slice(5));assert.equal((await worker('authorize',{claim_id:claim})).allowed,false);
 await inbound('right','ACEITO PROMOCOES '+request.challenge);assert.equal((await admin('dashboard')).contacts[0].state,'unsubscribed');
});
await test('link de cancelamento é isolado por loja e não revela contato',async()=>{
 const c=await one('select * from marketing_private.contacts where store_id=$1',[S]);
 await role('anon',null,()=>q('select public.bh_marketing_unsubscribe($1,$2)',[B,c.unsubscribe_token]));
 assert.equal((await one('select state from marketing_private.contacts where store_id=$1',[S])).state,'unsubscribed');
 await role('anon',null,()=>q('select public.bh_marketing_unsubscribe($1,$2)',[S,c.unsubscribe_token]));
});
await test('cancelamento persistente suprime campanha sem apagar histórico',async()=>{await admin('cancel',campaign);assert.equal((await admin('dashboard')).campaigns[0].state,'cancelled');assert.ok((await admin('dashboard')).events.length>0);});
await q("update marketing_private.contacts set state='opted_in' where store_id=$1",[S]);
for(let i=0;i<7;i++)await q("insert into marketing_private.contacts(store_id,phone,name,state) values($1,$2,'Fixture','opted_in')",[S,`555199999333${i}`]);
const batch=await admin('prepare',{request_id:randomUUID(),title:'Lote',body:'Mensagem',segment:0});await admin('approve',{id:batch.id,body:'Mensagem',count:8});
await test('limite persistente 6/5min e confirmação idempotente',async()=>{
 for(let i=0;i<6;i++){
  const id=randomUUID();const j=await worker('claim',{claim_id:id});assert.ok(j);assert.equal((await worker('authorize',{claim_id:id})).allowed,true);assert.equal((await worker('authorize',{claim_id:id})).allowed,true);
  await worker('finish',{claim_id:id,state:i===0?'uncertain':'accepted',code:'FIXTURE',provider_id:'mock-'+i});
  await worker('finish',{claim_id:id,state:'accepted',code:'FIXTURE',provider_id:'mock-'+i});
 }
 const id=randomUUID();await worker('claim',{claim_id:id});assert.equal((await worker('authorize',{claim_id:id})).allowed,false);
 assert.equal((await one('select window_count from marketing_private.settings where store_id=$1',[S])).window_count,6);
 assert.equal((await one("select count(*)::int n from marketing_private.jobs where state='uncertain'")).n,1);
});
await test('sincronização antiga bloqueia reserva mesmo com envio liberado',async()=>{await q("update marketing_private.settings set synced_at=now()-interval '1 minute' where store_id=$1",[S]);assert.equal(await worker('claim',{claim_id:randomUUID()}),null);});
await test('fluxo completo: transporte RPC, Postgres, sincronização, envio mock e histórico',async()=>{
 await q("update marketing_private.settings set window_start=now()-interval '6 minutes' where store_id=$1",[S]);
 const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',MARKETING_STORE_ID:STORE,MARKETING_WORKER_TOKEN:SECRET,EVOLUTION_URL:'http://127.0.0.1:8080',EVOLUTION_INSTANCE:'fixture',EVOLUTION_API_KEY:'mock',MARKETING_SEND_ENABLED:'true',MARKETING_ACTIVATION_CONFIRMED:STORE};
 const cfg=configuration(env);let transmissions=0,saved=null;
 const http=async(url,options)=>{
  if(url.includes('/rest/v1/rpc/')){
   const args=JSON.parse(options.body);assert.equal(args.p_store_id,S);
   return new Response(JSON.stringify(await worker(args.p_operation,args.p_args,args.p_store_id,args.p_token)),{headers:{'Content-Type':'application/json'}});
  }
  if(url.includes('fetchInstances'))return new Response(JSON.stringify([{name:'fixture',connectionStatus:'open',ownerJid:'5551999990000@s.whatsapp.net'}]));
  if(url.includes('findMessages'))return new Response(JSON.stringify({messages:{pages:0,total:0,records:[]}}));
  assert.match(url,/\/message\/sendText\/fixture$/);const payload=JSON.parse(options.body);assert.match(payload.text,/SAIR/);transmissions++;
  return new Response(JSON.stringify({key:{id:'END_TO_END_MOCK_ONLY'}}));
 };
 const rpc=rpcClient(env,cfg,http);
 await synchronize(rpc,cfg,http);
 await tick(rpc,cfg,{load:async()=>saved,save:async(v)=>{saved=v;}},http);
 assert.equal(transmissions,1);assert.equal(saved,null);
 assert.equal((await one("select count(*)::int n from marketing_private.jobs where provider_id='END_TO_END_MOCK_ONLY' and state='accepted'")).n,1);
});
await test('loja inativa rejeita trabalhador e administração',async()=>{await q("update managed_sites set status='suspended' where id=$1",[S]);await denied(()=>worker('status'));await denied(()=>admin('dashboard'));});
console.log(`${passed} verificações de banco aprovadas; nenhum banco externo foi acessado.`);
}finally{await db.close();}
