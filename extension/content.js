// Only the tab explicitly bound by the operator receives the optional panel.
// It never covers the video to disguise navigation or extracts Instagram media.
let host=null,refs=null;
function removePanel(){if(host)host.remove();host=null;refs=null}
function createPanel(){
 host=document.createElement('div');host.setAttribute('data-radiotedu-panel','');
 const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style');
 style.textContent=':host{all:initial;position:fixed;left:76px;bottom:18px;z-index:2147483647;font-family:Arial,sans-serif;color:#f4f3eb} .panel{box-sizing:border-box;width:205px;background:#111114ed;border:1px solid #6b6b6b;border-radius:2px;padding:12px;box-shadow:0 8px 30px #0008} .brand{font-size:11px;font-weight:900;letter-spacing:.08em;color:#ed1c24} .phase{font-size:11px;margin:8px 0;color:#e8eee7} svg{display:block;background:white;width:160px;height:160px} .help,.reel{font-size:10px;line-height:1.35;margin:7px 0 0;color:#d7ded8;overflow-wrap:anywhere} .counts{font-size:12px;font-weight:700;margin-top:8px;color:white;white-space:pre-line;max-height:20vh;overflow:auto} @media(max-width:720px){:host{left:8px;bottom:8px}.panel{width:130px;padding:8px}svg{width:72px;height:72px}}';
 const panel=document.createElement('section');panel.className='panel';panel.setAttribute('aria-label','RadioTEDU etkinlik bilgileri');
 const brand=document.createElement('div');brand.className='brand';brand.textContent='RADIOTEDU / REELS';
 const phase=document.createElement('div');phase.className='phase';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 41 41');svg.setAttribute('shape-rendering','crispEdges');svg.setAttribute('role','img');svg.setAttribute('aria-label','Katılımcı sayfası QR kodu');
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('fill','#111');svg.append(path);
 const help=document.createElement('div');help.className='help';help.textContent='Katılmak için QR kodunu okut.';
 const reel=document.createElement('div');reel.className='reel';const counts=document.createElement('div');counts.className='counts';
 panel.append(brand,phase,svg,help,reel,counts);shadow.append(style,panel);document.documentElement.append(host);refs={phase,reel,counts,svg,path};
}
function showState(data){if(!host||!host.isConnected){removePanel();createPanel()}const e=data.event||{},r=data.reel||{},rows=data.qrRows||[];refs.phase.textContent=({idle:'Sıradaki Reel',voting:'Oylama açık',result:'Grup puanları'}[e.phase]||'Etkinlik hazırlanıyor');refs.reel.textContent='Seçilen: '+String(r.label||'Reel');let d='';if(rows.length>=21&&rows.length<=177&&rows.every(row=>typeof row==='string'&&row.length===rows.length&&/^[01]+$/.test(row))){rows.forEach((row,y)=>[...row].forEach((cell,x)=>{if(cell==='1')d+='M'+(x+4)+' '+(y+4)+'h1v1h-1z'}));refs.svg.setAttribute('viewBox','0 0 '+(rows.length+8)+' '+(rows.length+8))}refs.path.setAttribute('d',d);const results=e.phase==='result'?data.results:null;refs.counts.textContent=results?'ORTALAMA: '+(results.average??'—')+'/10\n'+results.scores.map(x=>String(x.name)+': '+(x.score??'—')).join('\n'):''}
const audioAttempted=new WeakSet();
let audioTimer=null,audioDeadline=0,fastRetry=null;
let continuityStarted=false,continuityTimer=null,continuityGuard=null;
const continuityInputs=['pointerdown','wheel','touchstart','keydown'];
function onContinuityInput(e){if(e.isTrusted)stopContinuity()}
function stopContinuity(){if(continuityTimer!==null)clearTimeout(continuityTimer);continuityTimer=null;if(continuityGuard)continuityGuard.cancel();for(const name of continuityInputs)document.removeEventListener(name,onContinuityInput,true)}
function startContinuity(){if(continuityStarted)return;continuityStarted=true;continuityGuard=createContinuity();const path=location.pathname,deadline=Date.now()+10000;const scan=()=>{continuityTimer=null;if(location.pathname!==path||Date.now()>=deadline){stopContinuity();return}const video=largestVisibleVideo(document.querySelectorAll('video'),innerWidth,innerHeight);if(continuityGuard.observe(video)){stopContinuity();return}continuityTimer=setTimeout(scan,100)};for(const name of continuityInputs)document.addEventListener(name,onContinuityInput,true);scan()}
function stopAudio(){if(audioTimer!==null)clearTimeout(audioTimer);audioTimer=null}
function startAudio(){if(audioTimer!==null)return;audioDeadline=Date.now()+8000;const scan=()=>{audioTimer=null;if(restoreAudio(document.querySelectorAll('video'),true,audioAttempted,innerWidth,innerHeight)||Date.now()>=audioDeadline)return;audioTimer=setTimeout(scan,200)};scan()}
async function tick(){try{const r=await chrome.runtime.sendMessage({type:'projection-tick'});if(!r?.bound){stopAudio();stopContinuity();removePanel();return}if(r.state||r.audioReady)startContinuity();if(r.audioEnabled&&(r.state||r.audioReady))startAudio();else if(r.audioEnabled===false)stopAudio();if(r.waiting&&!r.audioReady&&fastRetry===null)fastRetry=setTimeout(()=>{fastRetry=null;tick()},350);if(r.panelEnabled===false){removePanel();return}if(r.state&&r.panelEnabled)showState(r.state);else if(r.error&&refs)refs.phase.textContent='Bağlantı bekleniyor'}catch{stopAudio();stopContinuity();if(refs)refs.phase.textContent='Bağlantı bekleniyor'}}
chrome.runtime.onMessage.addListener(message=>{if(message.type==='projection-start')tick()});
tick();setInterval(tick,3000);
