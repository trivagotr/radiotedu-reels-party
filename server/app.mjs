import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import QRCode from 'qrcode';

const ROOT=fileURLToPath(new URL('..',import.meta.url));
const BASE='/reels-party';
const SEED=[['DfPudnVq6pu','@yoursoofunnyy'],['DfSFj47srKA','@dr.baglama_'],['DfRFLs8x2Gj','@mh.aviation_'],['De-G2fFMUbw','@gatewaytomarz'],['DfKP_LdPzIm','@cosmiccraft_r47']];
const digest=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const equal=(a,b)=>timingSafeEqual(Buffer.from(digest(a),'hex'),Buffer.from(digest(b),'hex'));
const code=value=>{try{const u=new URL(value);if(u.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(u.hostname))return null;return /^\/(?:reel|reels)\/([\w-]{1,32})\/?$/.exec(u.pathname)?.[1]||null}catch{return null}};
const fail=(status,message)=>Object.assign(new Error(message),{status});

export function createApp({dbPath,publicUrl,adminPassword,sessionSecret}) {
 if(!dbPath||!publicUrl||typeof adminPassword!=='string'||adminPassword.length<12||adminPassword==='REPLACE_WITH_UNIQUE_PASSWORD'||typeof sessionSecret!=='string'||sessionSecret.length<32||sessionSecret.startsWith('REPLACE_WITH_'))throw Error('PUBLIC_URL, DATA_FILE, en az 12 karakterli benzersiz ADMIN_PASSWORD ve en az 32 karakterli rastgele SESSION_SECRET gereklidir.');
 const publicAddress=new URL(publicUrl);if(publicAddress.pathname.replace(/\/$/,'')!==BASE||!['https:','http:'].includes(publicAddress.protocol)||publicAddress.username||publicAddress.password||publicAddress.search||publicAddress.hash)throw Error('PUBLIC_URL /reels-party ile biten geçerli bir adres olmalı.');
 if(publicAddress.protocol==='http:'&&!['localhost','127.0.0.1','test.local'].includes(publicAddress.hostname))throw Error('Herkese açık kurulum HTTPS gerektirir.');
 const origin=publicAddress.origin,secure=publicAddress.protocol==='https:',url=origin+BASE+'/';
 mkdirSync(dirname(dbPath),{recursive:true});const db=new DatabaseSync(dbPath);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS event_state(id INTEGER PRIMARY KEY CHECK(id=1),current_reel TEXT,phase TEXT NOT NULL,round INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS reels(id TEXT PRIMARY KEY,url TEXT NOT NULL,label TEXT NOT NULL,sort_order INTEGER NOT NULL,created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,token_hash TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS event_settings(id INTEGER PRIMARY KEY CHECK(id=1),registration_open INTEGER NOT NULL CHECK(registration_open IN (0,1)));
 CREATE TABLE IF NOT EXISTS scores(round INTEGER NOT NULL,reel_id TEXT NOT NULL,group_id TEXT NOT NULL REFERENCES groups(id),score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 10),updated_at INTEGER NOT NULL,PRIMARY KEY(round,group_id));`);
 db.prepare('INSERT OR IGNORE INTO event_settings VALUES(1,1)').run();
 // Keep existing group IDs, tokens and scores; only replace legacy names with unused numbers.
 db.exec('BEGIN IMMEDIATE');try{const groups=db.prepare('SELECT id,name FROM groups ORDER BY created_at,id').all(),used=new Set(groups.filter(g=>/^[1-9]\d*$/.test(g.name)).map(g=>g.name)),rename=db.prepare('UPDATE groups SET name=? WHERE id=?');let n=1;for(const g of groups){if(/^[1-9]\d*$/.test(g.name))continue;while(used.has(String(n)))n++;const name=String(n++);rename.run(name,g.id);used.add(name)}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 if(!db.prepare('SELECT id FROM event_state WHERE id=1').get()){db.exec('BEGIN IMMEDIATE');try{let now=Date.now();const ins=db.prepare('INSERT INTO reels VALUES(?,?,?,?,?)');SEED.forEach(([id,label],i)=>ins.run(id,`https://www.instagram.com/reel/${id}/`,label,i,now+i));db.prepare("INSERT INTO event_state VALUES(1,?,'idle',1,?)").run(SEED[0][0],now);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
 const sign=x=>createHmac('sha256',sessionSecret).update(x).digest('base64url');
 const session=()=>{const expires=Date.now()+12*60*60*1000,nonce=token();const body=`${expires}.${nonce}`;return `${body}.${sign(body)}`};
 const isAdmin=req=>{const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rt_admin='))?.slice(9);if(!raw)return false;const parts=raw.split('.');if(parts.length!==3||!/^\d+$/.test(parts[0])||Number(parts[0])<Date.now())return false;return equal(parts[2],sign(parts[0]+'.'+parts[1]))};
 const cookie=v=>`rt_admin=${v}; Path=${BASE}/; HttpOnly; SameSite=Strict; Max-Age=43200${secure?'; Secure':''}`;
 const qr=QRCode.create(url,{errorCorrectionLevel:'M'}).modules;
 const qrRows=Array.from({length:qr.size},(_,y)=>Array.from({length:qr.size},(_,x)=>qr.get(y,x)?'1':'0').join(''));
 const groupFor=req=>{const raw=req.headers['x-group-token'];if(typeof raw!=='string'||!/^[\w-]{43}$/.test(raw))return null;return db.prepare('SELECT id,name FROM groups WHERE token_hash=?').get(digest(raw))||null};
 const state=(req,admin=false)=>{const event=db.prepare('SELECT current_reel,phase,round,updated_at FROM event_state WHERE id=1').get();event.registration_open=Boolean(db.prepare('SELECT registration_open FROM event_settings WHERE id=1').get().registration_open);const reels=db.prepare('SELECT id,url,label,sort_order FROM reels ORDER BY sort_order,created_at').all();const groups=db.prepare('SELECT id,name FROM groups ORDER BY created_at,id').all();const own=groupFor(req);const ownScore=own?db.prepare('SELECT score FROM scores WHERE round=? AND group_id=?').get(event.round,own.id)?.score??null:null;let results=null;if(event.phase==='result'||admin){const scores=db.prepare('SELECT groups.id,groups.name,scores.score FROM groups LEFT JOIN scores ON scores.group_id=groups.id AND scores.round=? AND scores.reel_id=? ORDER BY groups.created_at,groups.id').all(event.round,event.current_reel);const voted=scores.filter(x=>x.score!==null);results={scores,average:voted.length?Math.round(voted.reduce((sum,x)=>sum+x.score,0)/voted.length*10)/10:null,voted:voted.length,total:groups.length}}return {initialized:true,event,reels,groups,ownGroup:own,ownScore,results,qrRows,joinUrl:url}};
 const assets={'/': ['index.html','text/html; charset=utf-8'],'/admin':['index.html','text/html; charset=utf-8'],'/stage':['index.html','text/html; charset=utf-8'],'/assets/app.css':['app.css','text/css; charset=utf-8'],'/assets/app.js':['app.js','text/javascript; charset=utf-8']};
 const requests=new Map();
 const write=(res,status,data,extra={})=>{const body=JSON.stringify(data);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra});res.end(body)};
 async function handle(req,res){
  const requestUrl=new URL(req.url,origin);let p=requestUrl.pathname;
  if(p===BASE){res.writeHead(308,{location:BASE+'/'});res.end();return}
  if(!p.startsWith(BASE+'/'))throw fail(404,'Bulunamadı.');p=p.slice(BASE.length)||'/';if(p.length>1&&p.endsWith('/'))p=p.slice(0,-1);
  if(req.method==='GET'&&assets[p]){const [file,type]=assets[p];let body=readFileSync(join(ROOT,'public',file));res.writeHead(200,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://radiotedu.com; font-src 'self' https://radiotedu.com; img-src 'self' data: https://radiotedu.com; frame-src https://www.instagram.com; script-src 'self'; base-uri 'self'; frame-ancestors 'none'"});res.end(body);return}
  if(req.method==='GET'&&p==='/api/state'){write(res,200,state(req,isAdmin(req)),{'access-control-allow-origin':'*'});return}
  if(req.method==='GET'&&p==='/api/me'){write(res,200,{admin:isAdmin(req),group:groupFor(req)});return}
  if(req.method!=='POST')throw fail(404,'Bulunamadı.');if(req.headers.origin!==origin)throw fail(403,'Geçersiz istek kaynağı.');
  let raw='';req.setEncoding('utf8');for await(const chunk of req){raw+=chunk;if(raw.length>32768)throw fail(413,'İstek çok büyük.')}let body;try{body=JSON.parse(raw||'{}')}catch{throw fail(400,'Geçersiz istek.')};if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Geçersiz istek.');
  if(p==='/api/admin/login') {const key=req.socket.remoteAddress||'unknown',now=Date.now(),entry=requests.get(key)||{start:now,count:0};if(now-entry.start>60000){entry.start=now;entry.count=0}entry.count++;requests.set(key,entry);if(requests.size>2000)requests.delete(requests.keys().next().value);if(entry.count>12)throw fail(429,'Çok fazla deneme. Bir dakika bekleyin.');if(typeof body.password!=='string'||!equal(body.password,adminPassword))throw fail(401,'Parola hatalı.');requests.delete(key);write(res,200,{ok:true},{'set-cookie':cookie(session())});return}
  if(p==='/api/admin/logout'){write(res,200,{ok:true},{'set-cookie':`rt_admin=; Path=${BASE}/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`});return}
  if(p==='/api/groups'){let name;const id=randomUUID(),secret=token();db.exec('BEGIN IMMEDIATE');try{if(!db.prepare('SELECT registration_open FROM event_settings WHERE id=1').get().registration_open)throw fail(409,'Grup oluşturma kapalı. Moderatörle iletişime geçin.');let n=1;while(db.prepare('SELECT 1 FROM groups WHERE name=?').get(String(n)))n++;name=String(n);db.prepare('INSERT INTO groups VALUES(?,?,?,?)').run(id,name,digest(secret),Date.now());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}write(res,201,{id,name,token:secret});return}
  if(p==='/api/score'){const group=groupFor(req);if(!group)throw fail(401,'Önce grup oluşturun.');const e=db.prepare('SELECT * FROM event_state WHERE id=1').get();if(e.phase!=='voting'||body.round!==e.round||body.reel!==e.current_reel)throw fail(409,'Tur değişti veya oylama kapandı.');if(!Number.isInteger(body.score)||body.score<1||body.score>10)throw fail(400,'1 ile 10 arasında bir puan seçin.');db.prepare('INSERT INTO scores VALUES(?,?,?,?,?) ON CONFLICT(round,group_id) DO UPDATE SET score=excluded.score,updated_at=excluded.updated_at').run(e.round,e.current_reel,group.id,body.score,Date.now());write(res,200,{ok:true});return}
  if(!isAdmin(req))throw fail(401,'Moderatör girişi gerekli.');
  if(p==='/api/admin/registration'){if(typeof body.open!=='boolean')throw fail(400,'Geçersiz katılım durumu.');db.prepare('UPDATE event_settings SET registration_open=? WHERE id=1').run(body.open?1:0);write(res,200,{ok:true});return}
  if(p==='/api/admin/phase'){if(!['idle','voting','result'].includes(body.phase))throw fail(400,'Geçersiz aşama.');db.prepare('UPDATE event_state SET phase=?,updated_at=? WHERE id=1').run(body.phase,Date.now());write(res,200,{ok:true});return}
  if(p==='/api/admin/remove-group'){const id=String(body.id||'');if(!db.prepare('SELECT id FROM groups WHERE id=?').get(id))throw fail(404,'Grup bulunamadı.');db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM scores WHERE group_id=?').run(id);db.prepare('DELETE FROM groups WHERE id=?').run(id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}write(res,200,{ok:true});return}
  if(p==='/api/admin/select'){const row=db.prepare('SELECT id FROM reels WHERE id=?').get(String(body.id||''));if(!row)throw fail(404,'Reel bulunamadı.');const current=db.prepare('SELECT current_reel FROM event_state WHERE id=1').get();if(row.id!==current.current_reel)db.prepare("UPDATE event_state SET current_reel=?,phase='idle',round=round+1,updated_at=? WHERE id=1").run(row.id,Date.now());write(res,200,{ok:true});return}
  if(p==='/api/admin/add'){const id=code(body.url);if(!id)throw fail(400,'Geçerli bir Instagram Reel bağlantısı girin.');const label=typeof body.label==='string'?body.label.trim().slice(0,80):'';try{db.prepare('INSERT INTO reels VALUES(?,?,?,?,?)').run(id,`https://www.instagram.com/reel/${id}/`,label||`Reel ${id}`,Date.now(),Date.now())}catch(e){if(String(e).includes('UNIQUE'))throw fail(409,'Bu Reel zaten havuzda.');throw e}write(res,201,{ok:true});return}
  if(p==='/api/admin/rename'){const label=typeof body.label==='string'?body.label.trim().slice(0,80):'';if(!label)throw fail(400,'Reel adı boş olamaz.');if(!db.prepare('UPDATE reels SET label=? WHERE id=?').run(label,String(body.id||'')).changes)throw fail(404,'Reel bulunamadı.');write(res,200,{ok:true});return}
  if(p==='/api/admin/remove'){if(!db.prepare('DELETE FROM reels WHERE id=? AND id<>(SELECT current_reel FROM event_state WHERE id=1)').run(String(body.id||'')).changes)throw fail(409,'Önce başka bir Reel seçin.');write(res,200,{ok:true});return}
  if(p==='/api/admin/move'){if(![-1,1].includes(body.direction))throw fail(400,'Geçersiz yön.');const list=db.prepare('SELECT id FROM reels ORDER BY sort_order,created_at').all(),from=list.findIndex(x=>x.id===body.id),to=from+body.direction;if(from<0||to<0||to>=list.length)throw fail(409,'Reel bu yönde taşınamaz.');[list[from],list[to]]=[list[to],list[from]];db.exec('BEGIN IMMEDIATE');try{const s=db.prepare('UPDATE reels SET sort_order=? WHERE id=?');list.forEach((r,i)=>s.run(i,r.id));db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}write(res,200,{ok:true});return}
  throw fail(404,'Bulunamadı.');
 }
 const server=createServer((req,res)=>handle(req,res).catch(e=>{if(!res.headersSent)write(res,e.status||500,{error:e.status?e.message:'Sunucu hatası.'});else res.destroy()}));
 return {listen:(...args)=>server.listen(...args),close:()=>db.close(),inspect:()=>({groups:db.prepare('SELECT COUNT(*) n FROM groups').get().n,reels:db.prepare('SELECT COUNT(*) n FROM reels').get().n})};
}
