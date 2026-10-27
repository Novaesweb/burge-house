import { test, after } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
const db=new PGlite();after(async()=>await db.close());
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
const UA='20000000-0000-4000-8000-000000000001',UB='20000000-0000-4000-8000-000000000002';
await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated;
create table public.store_members(store_id uuid,user_id uuid,is_active boolean);
grant select on store_members to authenticated;alter table store_members enable row level security;
create policy member_self on store_members for select to authenticated using(user_id=auth.uid());
create table public.store_owner_messages(id uuid default gen_random_uuid() primary key,store_id uuid,recipient_user_id uuid,category text,title text,body text,created_by uuid,created_at timestamptz default now(),read_at timestamptz);
alter table store_owner_messages enable row level security;
grant select on store_owner_messages to authenticated;grant update(read_at) on store_owner_messages to authenticated;
create policy recipient_read on store_owner_messages for select to authenticated using(recipient_user_id=auth.uid() and exists(select 1 from store_members sm where sm.store_id=store_owner_messages.store_id and sm.user_id=auth.uid() and sm.is_active));
create policy recipient_update on store_owner_messages for update to authenticated using(recipient_user_id=auth.uid() and exists(select 1 from store_members sm where sm.store_id=store_owner_messages.store_id and sm.user_id=auth.uid() and sm.is_active)) with check(recipient_user_id=auth.uid() and exists(select 1 from store_members sm where sm.store_id=store_owner_messages.store_id and sm.user_id=auth.uid() and sm.is_active));`);
await db.query('insert into store_members values($1,$2,true),($3,$4,true)',[A,UA,B,UB]);
await db.query("insert into store_owner_messages(store_id,recipient_user_id,title,body) values($1,$2,'Mensagem A','Texto A'),($3,$4,'Mensagem B','Texto B'),($3,$2,'Sem vínculo B','Texto privado')",[A,UA,B,UB]);
const user=async(id,run)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await run();}finally{await db.exec('reset role');}};
test('recipient and active membership isolate two real PostgreSQL fixture mailboxes',async()=>{
  for(const [id,title] of [[UA,'Mensagem A'],[UB,'Mensagem B']])await user(id,async()=>{
    const rows=(await db.query('select title from store_owner_messages')).rows;assert.deepEqual(rows,[{title}]);
    const changed=await db.query('update store_owner_messages set read_at=now() returning title');assert.deepEqual(changed.rows,[{title}]);
  });
});
test('only read_at is writable; client cannot send or change message content/recipient/store',async()=>{
  await user(UA,async()=>{
    for(const column of ['title','body','recipient_user_id','store_id'])await assert.rejects(db.query(`update store_owner_messages set ${column}=null`),/permission/);
    await assert.rejects(db.query("insert into store_owner_messages(title) values('forged')"),/permission/);
    await assert.rejects(db.query('delete from store_owner_messages'),/permission/);
  });
});
test('revoked membership and anonymous requests cannot read messages',async()=>{
  await db.query('update store_members set is_active=false where user_id=$1',[UA]);
  await user(UA,async()=>assert.equal((await db.query('select * from store_owner_messages')).rows.length,0));
  await db.exec('set role anon');try{await assert.rejects(db.query('select * from store_owner_messages'),/permission/);}finally{await db.exec('reset role');}
});
