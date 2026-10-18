import test from 'node:test';
import assert from 'node:assert/strict';
import {configuration,STORE,incoming,deliver,tick,synchronize,resolveConsent,brazilianVariants} from '../backend/marketing/worker.mjs';
const env={MARKETING_STORE_ID:STORE,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',MARKETING_WORKER_TOKEN:'a'.repeat(64),EVOLUTION_URL:'http://127.0.0.1:8080',EVOLUTION_INSTANCE:'fixture',EVOLUTION_API_KEY:'mock'};
const cfg=configuration(env),enabled={...cfg,sendEnabled:true};
const job={store_id:STORE,id:'job',phone:'5551999991111',text:'Fixture',state:'sending'};
test('nono dígito só é conciliado com confirmação do número pela Evolution',async()=>{
 const target='5551999991111',sender='555199991111',event={phone:sender,text:'ACEITO PROMOCOES 10000000-0000-4000-8000-000000000001'};
 assert.equal(brazilianVariants(target,sender),true);assert.equal(brazilianVariants(target,'555199991112'),false);
 const rpc=async(op,args)=>{assert.equal(op,'consent_target');assert.ok(args.challenge);return{phone:target};};
 const http=async(url,options)=>{assert.match(url,/chat\/whatsappNumbers/);assert.deepEqual(JSON.parse(options.body),{numbers:[target]});return{ok:true,json:async()=>[{number:target,jid:sender+'@s.whatsapp.net',exists:true}]};};
 const result=await resolveConsent(event,rpc,cfg,http);assert.equal(result.phone,target);assert.equal(result.sender_phone,sender);assert.equal(result.verification,'evolution_on_whatsapp');
 for(const record of [{number:target,jid:'555199991112@s.whatsapp.net',exists:true},{number:target,jid:sender+'@s.whatsapp.net',exists:false}])assert.equal((await resolveConsent(event,rpc,cfg,async()=>({ok:true,json:async()=>[record]}))).phone,sender);
 await assert.rejects(()=>resolveConsent(event,rpc,cfg,async()=>{throw Error('offline');}));
});
function journal(value=null){return{async load(){return value;},async save(v){value=v;}};}
test('envio exige ambas as autorizações locais e loja exata',()=>{
 assert.equal(cfg.sendEnabled,false);assert.equal(configuration({...env,MARKETING_SEND_ENABLED:'true'}).sendEnabled,false);
 assert.equal(configuration({...env,MARKETING_SEND_ENABLED:'true',MARKETING_ACTIVATION_CONFIRMED:STORE}).sendEnabled,true);
 assert.throws(()=>configuration({...env,MARKETING_STORE_ID:'outra'}));assert.throws(()=>configuration({...env,EVOLUTION_URL:'http://0.0.0.0:8080'}));
});
test('desabilitado não reserva nem chama provedor',async()=>{
 let calls=0;await tick(async()=>{calls++;},cfg,journal());await deliver(job,cfg,async()=>{calls++;});assert.equal(calls,0);
});
test('remetente próprio, grupos, LID e mensagens irrelevantes não consentem',()=>{
 const record={key:{id:'id',fromMe:false,remoteJid:'5551999991111@s.whatsapp.net'},message:{conversation:'SAIR'},messageTimestamp:Math.floor(Date.now()/1000)};
 assert.equal(incoming(record).text,'SAIR');for(const key of [{...record.key,fromMe:true},{...record.key,remoteJid:'group@g.us'}])assert.equal(incoming({...record,key}),null);
 assert.throws(()=>incoming({...record,key:{...record.key,remoteJid:'123@lid'}}),/UNRESOLVED_OPTOUT/);
 assert.equal(incoming({...record,key:{...record.key,remoteJid:'123@lid',remoteJidAlt:record.key.remoteJid}}).phone,'5551999991111');
 assert.equal(incoming({...record,message:{conversation:'Oi'}}),null);
});
test('timeout é incerto e nunca dispara repetição automática',async()=>{
 let sends=0;const j=journal();let finish=0;
 const rpc=async(op)=>op==='claim'?job:op==='authorize'?{allowed:true}:(finish++,{});
 await tick(rpc,enabled,j,async()=>{sends++;throw Error('timeout');});assert.equal(sends,1);assert.equal(finish,1);assert.equal(await j.load(),null);
});
test('falha no ACK retoma apenas confirmação, sem novo envio',async()=>{
 let sends=0,fail=true,record;const j=journal();
 const rpc=async(op,args)=>{if(op==='claim')return job;if(op==='authorize')return{allowed:true};record=args;if(fail)throw Error('ACK');return{};};
 const http=async()=>{sends++;return{ok:true,json:async()=>({key:{id:'mock-provider-id'}})};};
 await assert.rejects(()=>tick(rpc,enabled,j,http));assert.equal((await j.load()).phase,'finish');fail=false;await tick(rpc,enabled,j,http);assert.equal(sends,1);assert.equal(record.state,'accepted');
});
test('reinício durante envio coloca em revisão sem retransmitir',async()=>{
 let sends=0,record;const j=journal({claim_id:'mock',phase:'dispatching'});
 await tick(async(op,args)=>op==='claim'?job:(record=args,{}),enabled,j,async()=>{sends++;});assert.equal(sends,0);assert.equal(record.state,'uncertain');
});
test('cancelamento antes da transmissão limpa reserva e não chama HTTP',async()=>{
 let calls=0;const j=journal();await tick(async(op)=>op==='claim'?job:{allowed:false,terminal:true},enabled,j,async()=>{calls++;});assert.equal(calls,0);assert.equal(await j.load(),null);
});
test('sincronização lê conjunto completo em uma consulta, inclui SAIR atrasado e filtra fromMe',async()=>{
 const events=[];const rpc=async(op,args)=>{events.push([op,args]);if(op==='status')return{phone:'5551999990000',cursor:new Date(Date.now()-60000).toISOString()};return{};};
 const record={id:'db-in-1',key:{id:'in-1',fromMe:false,remoteJid:'5551999991111@s.whatsapp.net'},message:{conversation:'SAIR'},messageTimestamp:Math.floor(Date.now()/1000)-86400};
 const own=Array.from({length:50},(_,i)=>({...record,id:'db-own-'+i,key:{...record.key,id:'own-'+i,fromMe:true}}));
 const http=async(url,opt)=>{if(!url.includes('fetchInstances'))assert.deepEqual(JSON.parse(opt.body),{where:{},page:1,offset:10000});return{ok:true,json:async()=>url.includes('fetchInstances')?[{name:'fixture',connectionStatus:'open',ownerJid:'5551999990000@s.whatsapp.net'}]:{messages:{pages:1,total:51,records:[record,...own]}}};};
 await synchronize(rpc,cfg,http);assert.equal(events.filter(x=>x[0]==='inbound').length,1);assert.equal(events.at(-1)[0],'synced');
 await assert.rejects(()=>synchronize(rpc,cfg,async()=>({ok:true,json:async()=>[]})));
});
test('resposta incompleta impede avançar cursor',async()=>{
 const calls=[];const rpc=async(op)=>{calls.push(op);return{phone:'5551999990000',cursor:new Date().toISOString()};};
 const http=async(url)=>({ok:true,json:async()=>url.includes('fetchInstances')?[{name:'fixture',connectionStatus:'open',ownerJid:'5551999990000@s.whatsapp.net'}]:{messages:{pages:1,total:51,records:[]}}});
 await assert.rejects(()=>synchronize(rpc,cfg,http));assert.ok(!calls.includes('synced'));
});
