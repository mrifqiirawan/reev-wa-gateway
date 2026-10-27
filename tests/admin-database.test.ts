import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import crypto from 'node:crypto';import {PGlite} from '@electric-sql/pglite';
const uid=()=>crypto.randomUUID();
test('Belajar admin upgrade: grants, teacher authorization, atomic writes, audit, idempotency and revocation',async t=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`);
 for(const name of (await fs.readdir(new URL('./fixtures/belajar-v1.5/',import.meta.url))).sort())await db.exec(await fs.readFile(new URL('./fixtures/belajar-v1.5/'+name,import.meta.url),'utf8'));
 const sql=await fs.readFile(new URL('../sql/BELAJAR_upgrade_v2.8.4.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const teacher=uid(),studentUser=uid(),sid=uid(),sem=uid(),cls=uid(),phone='+6281234567890';
 await db.query('insert into auth.users(id) values($1),($2)',[teacher,studentUser]);await db.query("insert into profiles(id,name,role) values($1,'Guru Uji','teacher'),($2,'Siswa Uji','student')",[teacher,studentUser]);
 await db.query("insert into semesters(id,name,active) values($1,'Semester Uji',true)",[sem]);await db.query("insert into classes(id,name) values($1,'9C')",[cls]);await db.query("insert into students(id,nisn,name) values($1,'0012345678','Siswa Uji')",[sid]);await db.query('insert into class_memberships values($1,$2,$3)',[sid,sem,cls]);await db.exec('update school_settings set initial_hearts=10');
 const settings=async(op='list',p=phone,id=teacher,active=true)=>(await db.query<any>('select reev_gateway_admin_settings($1,$2,$3,$4) r',[op,p,id,active])).rows[0].r;
 const run=async(action='profile',argument='0012345678',p=phone,event=uid(),chat='120363000000@g.us')=>(await db.query<any>('select reev_gateway_admin($1,$2,$3,$4,$5) r',[event,p,action,argument,chat])).rows[0].r;
 await t.test('anon and authenticated cannot manage admins, invoke privileged RPC, or read event payloads',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(()=>settings('save'));await assert.rejects(()=>run());await assert.rejects(()=>db.query('select * from reev_gateway_admin_events'));await db.exec('reset role');}
 });
 await db.exec('set role service_role');
 await t.test('non-admin denied without disclosing target; student cannot become teacher admin',async()=>{const r=await run();assert.equal(r.ok,false);assert.doesNotMatch(r.text,/Siswa Uji/);await assert.rejects(()=>settings('save',phone,studentUser));await settings('save');assert.equal((await settings()).admins.length,1)});
 await t.test('admin reads all six actions by NISN in private and group without student phone link',async()=>{for(const a of ['profile','tasks','grades','stars','hearts','attendance']){const r=await run(a);assert.equal(r.ok,true);assert.match(r.text,/Siswa Uji/)}assert.equal((await run('profile','0012345678',phone,uid(),'6281234567890@s.whatsapp.net')).ok,true)});
 await t.test('star transaction executed once per event, audit actor preserved; differing replay rejected',async()=>{
 const e=uid();const r=await run('star','0012345678#2#Membantu teman',phone,e);assert.equal(r.ok,true);assert.deepEqual(await run('star','0012345678#2#Membantu teman',phone,e),r);
 assert.equal((await db.query<any>('select sum(amount) n from star_transactions')).rows[0].n,2);
 assert.equal((await db.query<any>("select actor from audit_logs where entity='star_transactions' order by id desc limit 1")).rows[0].actor,teacher);
 await assert.rejects(()=>run('star','0012345678#3#Lain',phone,e));
 });
 await t.test('violation preserves remedy, initializes hearts and deducts one, duplicate does not deduct again',async()=>{
 const e=uid();const r=await run('violation','0012345678#Terlambat#Selesaikan tugas',phone,e);assert.equal(r.ok,true);await run('violation','0012345678#Terlambat#Selesaikan tugas',phone,e);
 const rows=(await db.query<any>('select * from violations')).rows;assert.equal(rows.length,1);assert.equal(rows[0].remedy,'Selesaikan tugas');assert.match(rows[0].code,/^WA-/);
 assert.equal((await db.query<any>('select sum(amount) n from heart_transactions')).rows[0].n,9);
 });
 await t.test('bad syntax, missing NISN, max stars, missing semester and unset hearts never partially write',async()=>{
 for(const arg of ['0012345678#0#x','0012345678#21#x','0012345678#2#','0012345678#2#x#y','9999999999#1#x'])assert.equal((await run('star',arg)).ok,false);
 await db.exec('update school_settings set initial_hearts=null');assert.equal((await run('violation','0012345678#Alasan#Tebusan')).ok,false);await db.exec('update school_settings set initial_hearts=10');
 await db.exec('update semesters set active=false');assert.equal((await run('star','0012345678#1#x')).ok,false);await db.exec('update semesters set active=true');
 assert.equal((await db.query<any>('select count(*) n from star_transactions')).rows[0].n,1);assert.equal((await db.query<any>('select count(*) n from violations')).rows[0].n,1);
 });
 await t.test('revoking number or teacher blocks even cached successful events',async()=>{
 // Remove the rate-test history to isolate revocation behavior.
 await db.exec('delete from reev_gateway_admin_events');const e=uid();assert.equal((await run('profile','0012345678',phone,e)).ok,true);
 await settings('save',phone,teacher,false);assert.equal((await run('profile','0012345678',phone,e)).ok,false);
 await settings('save');await db.query('update profiles set active=false where id=$1',[teacher]);assert.equal((await run()).ok,false);
 });
 }finally{await db.close()}
});
test('Gateway migration appends admin commands once and preserves old templates',async()=>{
 const db=new PGlite();try{await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');await db.exec(await fs.readFile(new URL('../supabase/migrations/001_bot_platform.sql',import.meta.url),'utf8'));
 await db.exec(`update gw_config set config=jsonb_set(config,'{commands,1,text}','"KEEP MY PROFILE"')`);
 const sql=await fs.readFile(new URL('../supabase/migrations/002_admin_commands.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 const c=(await db.query<any>('select config from gw_config')).rows[0].config;assert.equal(c.commands[1].text,'KEEP MY PROFILE');assert.equal(c.commands.filter((f:any)=>f.command==='.bintang').length,1);assert.equal(c.commands.find((f:any)=>f.command==='.pelanggaran').action,'belajar.violation');
 const rollback=await fs.readFile(new URL('../sql/GATEWAY_rollback_v2.8.4.sql',import.meta.url),'utf8');await db.exec(rollback);await db.exec(rollback);const reverted=(await db.query<any>('select config from gw_config')).rows[0].config;assert.equal(reverted.commands[1].text,'KEEP MY PROFILE');assert.ok(!reverted.commands.some((f:any)=>['belajar.star','belajar.violation'].includes(f.action)));
 }finally{await db.close()}
});
