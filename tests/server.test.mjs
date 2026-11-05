import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.mjs';
import {DatabaseSync} from 'node:sqlite';

test('group scoring, moderator controls, access checks and persistence under the subpath', async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rt-reels-'));let app,server;
 const options={dbPath:join(dir,'party.sqlite'),publicUrl:'http://test.local/reels-party',adminPassword:'test-password-123',sessionSecret:'test-secret-at-least-thirty-two-characters'};
 try {
  app=createApp(options);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/reels-party`;
  async function request(path,{method='GET',body,token,cookie,origin='http://test.local'}={}){
   const headers={};if(method==='POST'){headers.origin=origin;headers['content-type']='application/json'}if(token)headers['x-group-token']=token;if(cookie)headers.cookie=cookie;
   const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});let data;try{data=await response.json()}catch{}return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  assert.equal((await request('/')).status,200);
  let state=(await request('/api/state')).data;assert.equal(state.reels.length,5);assert.equal(state.event.phase,'idle');assert.equal(state.joinUrl,'http://test.local/reels-party/');assert.ok(state.qrRows.length>=21);
  assert.equal((await request('/api/admin/phase',{method:'POST',body:{phase:'voting'}})).status,401);
  assert.equal((await request('/api/groups',{method:'POST',body:{},origin:'https://evil.invalid'})).status,403);
  let bad=await request('/api/admin/login',{method:'POST',body:{password:'wrong'}});assert.equal(bad.status,401);
  const login=await request('/api/admin/login',{method:'POST',body:{password:options.adminPassword}});assert.equal(login.status,200);assert.ok(login.cookie);
  const initial=await request('/api/state');await request('/api/admin/select',{method:'POST',cookie:login.cookie,body:{id:initial.data.event.current_reel}});assert.equal((await request('/api/state')).data.event.round,initial.data.event.round,'selecting the already active Reel must not erase the current round');
  const g1=(await request('/api/groups',{method:'POST',body:{name:'Özel ad'}})).data,g2=(await request('/api/groups',{method:'POST',body:{name:'Özel ad'}})).data;
  assert.notEqual(g1.id,g2.id);assert.notEqual(g1.token,g2.token);assert.equal(g1.name,'1');assert.equal(g2.name,'2');
  state=(await request('/api/state')).data;assert.equal(state.groups.length,2);
  assert.equal((await request('/api/admin/phase',{method:'POST',cookie:login.cookie,body:{phase:'voting'}})).status,200);
  let target={round:state.event.round,reel:state.event.current_reel};
  assert.equal((await request('/api/score',{method:'POST',body:{...target,score:8}})).status,401);
  assert.equal((await request('/api/score',{method:'POST',token:g1.token,body:{...target,score:11}})).status,400);
  assert.equal((await request('/api/score',{method:'POST',token:g1.token,body:{...target,score:8}})).status,200);
  assert.equal((await request('/api/score',{method:'POST',token:g1.token,body:{...target,score:9}})).status,200);
  assert.equal((await request('/api/score',{method:'POST',token:g2.token,body:{...target,score:5}})).status,200);
  state=(await request('/api/state')).data;assert.equal(state.results,null,'scores stay hidden until reveal');
  assert.equal((await request('/api/admin/phase',{method:'POST',cookie:login.cookie,body:{phase:'result'}})).status,200);
  state=(await request('/api/state')).data;assert.equal(state.results.scores.length,2);assert.equal(state.results.average,7);
  assert.equal((await request('/api/admin/select',{method:'POST',cookie:login.cookie,body:{id:state.reels[1].id}})).status,200);
  assert.equal((await request('/api/score',{method:'POST',token:g1.token,body:{...target,score:1}})).status,409);
  assert.equal((await request('/api/admin/add',{method:'POST',cookie:login.cookie,body:{url:'https://www.instagram.com/reel/test_ABC/',label:'Yeni'}})).status,201);
  assert.equal((await request('/api/admin/rename',{method:'POST',cookie:login.cookie,body:{id:'test_ABC',label:'Yeni ad'}})).status,200);
  assert.equal((await request('/api/admin/move',{method:'POST',cookie:login.cookie,body:{id:'test_ABC',direction:-1}})).status,200);
  assert.equal((await request('/api/admin/remove',{method:'POST',cookie:login.cookie,body:{id:'test_ABC'}})).status,200);
  assert.equal((await request('/api/admin/remove-group',{method:'POST',cookie:login.cookie,body:{id:g2.id}})).status,200);
  assert.equal((await request('/api/me',{token:g2.token})).data.group,null);
  await new Promise(r=>server.close(r));app.close();server=null;app=createApp(options);
  assert.equal(app.inspect().groups,1,'groups survive restart');assert.equal(app.inspect().reels,5);
 } finally {if(server)await new Promise(r=>server.close(r));app?.close();await rm(dir,{recursive:true,force:true})}
});

test('sample placeholders cannot be used as production credentials',()=>{
 const options={dbPath:join(tmpdir(),'unused-rt.sqlite'),publicUrl:'https://radiotedu.com/reels-party',adminPassword:'REPLACE_WITH_UNIQUE_PASSWORD',sessionSecret:'REPLACE_WITH_UNIQUE_RANDOM_SECRET_AT_LEAST_32_CHARACTERS'};
 assert.throws(()=>createApp(options),/benzersiz/);
});

test('existing custom names migrate to numbers without deleting group identities or scores',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rt-migration-'));const options={dbPath:join(dir,'party.sqlite'),publicUrl:'http://test.local/reels-party',adminPassword:'test-password-123',sessionSecret:'test-secret-at-least-thirty-two-characters'};
 try {let app=createApp(options);app.close();let db=new DatabaseSync(options.dbPath);
 db.prepare('INSERT INTO groups VALUES(?,?,?,?)').run('old1','Özel ad','hash1',1);
 db.prepare('INSERT INTO groups VALUES(?,?,?,?)').run('old2','Grup 2','hash2',2);
 db.prepare('INSERT INTO scores VALUES(?,?,?,?,?)').run(1,'DfPudnVq6pu','old1',8,1);db.close();
 app=createApp(options);app.close();db=new DatabaseSync(options.dbPath);
 try {assert.deepEqual(db.prepare('SELECT id,name,token_hash FROM groups ORDER BY created_at').all().map(x=>({...x})),[{id:'old1',name:'1',token_hash:'hash1'},{id:'old2',name:'2',token_hash:'hash2'}]);
 assert.equal(db.prepare('SELECT score FROM scores WHERE group_id=?').get('old1').score,8)} finally {db.close()}
 } finally {await rm(dir,{recursive:true,force:true})}
});
