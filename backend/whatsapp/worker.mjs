import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile,writeFile,rename,unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const labels = {
  recebido:'recebido', preparando:'em preparo', itens_separados:'com os itens separados',
  esperando_motoboy:'aguardando o entregador', saiu_para_entrega:'a caminho',
  entregue:'entregue', cancelado:'cancelado',
};
export function phone(value) {
  let number=String(value ?? '').replace(/\D/g,'');
  if (/^\d{10,11}$/.test(number)) number='55'+number;
  if (!/^55\d{10,11}$/.test(number)) throw new Error('INVALID_PHONE');
  return number;
}
export function config(env) {
  if(env.WHATSAPP_SEND_ENABLED!=='true') throw new Error('SEND_DISABLED');
  const testOnly=env.WHATSAPP_TEST_ONLY==='true';
  if(!testOnly && !(env.WHATSAPP_TEST_ONLY==='false' && env.WHATSAPP_CUSTOMER_SEND_APPROVED==='true')) throw new Error('CUSTOMER_SEND_NOT_APPROVED');
  const url=new URL(env.EVOLUTION_URL);
  if(url.username || url.password || url.search || url.hash || url.pathname!=='/' ||
    (url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) throw new Error('INVALID_EVOLUTION_URL');
  if(!/^[\w-]+$/.test(env.EVOLUTION_INSTANCE||'')) throw new Error('INVALID_INSTANCE');
  if(!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(env.WHATSAPP_STORE_ID||'')) throw new Error('INVALID_STORE');
  if(!env.EVOLUTION_API_KEY || !env.SUPABASE_PUBLISHABLE_KEY || !/^[a-f0-9]{64}$/.test(env.WHATSAPP_WORKER_TOKEN||'') || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(env.SUPABASE_URL||'')) throw new Error('MISSING_SERVER_CONFIG');
  return {url:url.origin,instance:env.EVOLUTION_INSTANCE,key:env.EVOLUTION_API_KEY,
    allowed:testOnly?phone(env.WHATSAPP_TEST_NUMBER):null,testOnly,store:env.WHATSAPP_STORE_ID,token:env.WHATSAPP_WORKER_TOKEN};
}
export async function deliver(event,cfg,request=fetch) {
  let number;
  try { number=phone(event.phone); } catch { return {state:'blocked',code:'INVALID_PHONE'}; }
  if(event.store_id!==cfg.store) return {state:'blocked',code:'STORE_MISMATCH'};
  if(cfg.testOnly && number!==cfg.allowed) return {state:'blocked',code:'TEST_ALLOWLIST'};
  if(!labels[event.status]) return {state:'blocked',code:'UNKNOWN_STATUS'};
  // No redirect or automatic retry: a timeout may happen after WhatsApp accepted the message.
  try {
    const response=await request(`${cfg.url}/message/sendText/${encodeURIComponent(cfg.instance)}`,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{apikey:cfg.key,'Content-Type':'application/json'},
      body:JSON.stringify({number,text:`Burge House: seu pedido #${event.order_number} está ${labels[event.status]}.`,linkPreview:false}),
    });
    if(!response.ok) return {state:'uncertain',code:`HTTP_${response.status}`};
    const body=await response.json();
    return body?.key?.id ? {state:'sent',code:'ACCEPTED'} : {state:'uncertain',code:'INVALID_RESPONSE'};
  } catch { return {state:'uncertain',code:'NETWORK_OR_TIMEOUT'}; }
}
export function fileJournal(path) {
  return {
    async load() {try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw new Error('JOURNAL_READ_FAILED');}},
    async save(value) {
      if(value===null){try{await unlink(path);}catch(error){if(error.code!=='ENOENT')throw new Error('JOURNAL_CLEAR_FAILED');}return;}
      await writeFile(path+'.tmp',JSON.stringify(value),{mode:0o600});await rename(path+'.tmp',path);
    },
  };
}
export async function tick(db,cfg,request=fetch,journal={load:async()=>null,save:async()=>{}}) {
  const job=await journal.load()||{id:randomUUID(),phase:'claim'};
  await journal.save(job);
  const {data,error}=await db.rpc('delivery_claim_whatsapp',{p_store_id:cfg.store,p_token:cfg.token,p_claim_id:job.id});
  if(error) throw new Error('CLAIM_FAILED');
  if(!data?.length) {await journal.save(null);return false;}
  const event=data[0];
  if(event.state && event.state!=='sending'){await journal.save(null);return false;}
  let result=job.result;
  if(job.phase==='dispatching') result={state:'uncertain',code:'RECOVERY_AFTER_DISPATCH'};
  if(!result) {
    await journal.save({...job,phase:'dispatching'});
    result=await deliver(event,cfg,request);
  }
  await journal.save({...job,phase:'finish',result});
  const {error:finishError}=await db.rpc('delivery_finish_whatsapp',{p_store_id:cfg.store,p_token:cfg.token,p_id:event.id,p_state:result.state,p_code:result.code});
  if(finishError) throw new Error('ACK_FAILED_REVIEW_REQUIRED');
  await journal.save(null);
  console.log(JSON.stringify({event:event.id,...result}));
  return true;
}
export function database(env,request=fetch) {
  return {async rpc(name,args) {
    try {
      const response=await request(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`,{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
        headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
        body:JSON.stringify(args),
      });
      if(!response.ok) return {error:true};
      return {data:response.status===204?null:await response.json()};
    } catch {return {error:true};}
  }};
}
async function main() {
  const cfg=config(process.env);
  const db=database(process.env);
  const journal=fileJournal(fileURLToPath(new URL('./.claim.json',import.meta.url)));
  let stop=false;
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{stop=true;});
  while(!stop) { await tick(db,cfg,fetch,journal); if(!stop) await sleep(2000); }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
