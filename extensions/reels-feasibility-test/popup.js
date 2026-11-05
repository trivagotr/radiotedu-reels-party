const $=id=>document.getElementById(id), sleep=ms=>new Promise(r=>setTimeout(r,ms));
let playlist=[], index=-1, tabId=null, running=false, logs=[], commits=[];
for(let i=0;i<5;i++){const el=document.createElement('input');el.placeholder=`Reel ${i+1} URL`;el.id=`url${i}`;$('inputs').append(el)}
function code(s){try{const u=new URL(s);if(!['www.instagram.com','instagram.com'].includes(u.hostname)||u.protocol!=='https:')return null;return /^\/(?:reel|reels)\/([A-Za-z0-9_-]+)\/?$/.exec(u.pathname)?.[1]||null}catch{return null}}
function log(x){logs.push({...x,at:new Date().toISOString()});$('log').textContent=logs.map(e=>JSON.stringify(e)).join('\n');$('log').scrollTop=$('log').scrollHeight}
function show(s){$('status').textContent=`Reel ${index+1}/5\n${s}`}
chrome.webNavigation.onCommitted.addListener(d=>{if(d.tabId===tabId&&d.frameId===0) commits.push({time:Date.now(),url:d.url,transitionType:d.transitionType})});
async function send(type,extra={}){return chrome.tabs.sendMessage(tabId,{type,...extra})}
async function inspect(){try{return await send('inspect')}catch{return null}}
async function ensureTab(){if(tabId){try{await chrome.tabs.get(tabId);return}catch{tabId=null}}const tabs=await chrome.tabs.query({url:'https://www.instagram.com/*'});if(tabs.length)tabId=tabs.find(t=>t.active)?.id||tabs[0].id;else tabId=(await chrome.tabs.create({url:playlist[0]})).id}
async function observe(target,timeout=12000){const end=Date.now()+timeout;let a=null;while(Date.now()<end){a=await inspect();if(a?.shortcode===target&&a.video){let start=a.video.currentTime;await sleep(1200);let b=await inspect();if(b?.shortcode===target&&b.video){b.advancing=!b.video.paused&&b.video.currentTime>start+0.15;return b}}await sleep(400)}return a}
async function go(n,mode){if(n<0||n>=5)throw Error('End of playlist');await ensureTab();const target=code(playlist[n]);const before=await inspect();const start=Date.now();const commitsBefore=commits.length;let native=null;
 if(mode){try{native=await send('native',{direction:mode});await sleep(1800)}catch(e){native={ok:false,error:String(e)}}const seen=await observe(target,2500);const matched=seen?.shortcode===target;log({event:'native attempt',from:index+1,to:n+1,expected:target,detected:seen?.shortcode||null,method:mode,control:native,matched,elapsedMs:Date.now()-start,note:'Matching URL and video playback are not independent proof of identity or native animation.'});if(matched){index=n;show(`${seen.url}\nPlayback: ${seen.advancing?'advancing':'paused / buffering / unverified'}`);return seen}}
 const directStart=Date.now();await chrome.tabs.update(tabId,{url:playlist[n],active:true});const seen=await observe(target);index=n;let reload=commits.length>commitsBefore || (!!before&&!!seen&&before.documentEpoch!==seen.documentEpoch);log({event:'direct navigation',to:n+1,expected:target,detected:seen?.shortcode||null,url:seen?.url||null,method:'chrome.tabs.update (document navigation)',elapsedMs:Date.now()-directStart,fullDocumentNavigation:reload,commits:commits.slice(commitsBefore),video:seen?.video||null,advancing:seen?.advancing||false,visualBlank:'manual observation required',nativeAnimation:false,audio:'manual observation required',identity:'manual visual confirmation required'});show(`${seen?.url||'Not detected'}\nPlayback: ${seen?.advancing?'advancing':'paused / buffering / unverified'}\nDirect navigation; confirm video identity visually.`);return seen}
async function save(){let p=Array.from({length:5},(_,i)=>$(`url${i}`).value.trim());if(p.some(x=>!code(x)))throw Error('Enter five valid https://www.instagram.com/reel/SHORTCODE/ URLs.');playlist=p;await chrome.storage.local.set({playlist});show('Playlist saved.');}
async function action(fn){if(running){show('A test is already running.');return}running=true;try{await fn()}catch(e){log({event:'error',error:String(e)});show(String(e))}finally{running=false}}
$('save').onclick=()=>action(save);
$('start').onclick=()=>action(async()=>{await save();await go(0)});
$('next').onclick=()=>action(()=>go(index+1,'next'));
$('previous').onclick=()=>action(()=>go(index-1,'previous'));
$('jump').onclick=()=>action(()=>go(4));
async function routeExperiment(strategy){
 await save();await ensureTab();const before=await inspect();if(!before)throw Error('Open a loaded Instagram Reel first, then reopen the popup.');
 const target=code(playlist[1]);if(before.shortcode===target)throw Error('Start on another Reel before testing Reel 2.');
 const start=Date.now(),commitStart=commits.length;let response;
 try{response=await send('route-experiment',{strategy,url:playlist[1]})}catch(e){response={ok:false,error:String(e)}}
 if(!response?.ok){log({event:'route experiment',strategy,response});throw Error(response?.error||'Route request failed')}
 await sleep(2000);const seen=await observe(target,8000);const navigations=commits.slice(commitStart);const changed=!!seen&&seen.documentEpoch!==before.documentEpoch;
 const result={event:'route experiment',strategy,expected:target,detected:seen?.shortcode||null,currentUrl:seen?.url||null,elapsedMs:Date.now()-start,documentChanged:seen?changed:null,documentCommits:navigations,video:seen?.video||null,advancing:seen?.advancing||false,correctVideo:'manual verification required',nativeAnimation:'manual verification required',audio:'manual verification required',response};
 log(result);show(`${strategy}: ${seen?.url||'no response'}\nDocument ${seen?(changed?'changed':'unchanged'):'unknown'}; playback ${seen?.advancing?'advancing':'not verified'}. Copy log.`)
}
$('routeExisting').onclick=()=>action(()=>routeExperiment('existing-anchor'));
$('routeInjected').onclick=()=>action(()=>routeExperiment('injected-anchor'));
$('routeNavigation').onclick=()=>action(()=>routeExperiment('navigation-api'));
$('restart').onclick=()=>action(async()=>{const r=await send('restart');log({event:'restart',result:r});show(JSON.stringify(r))});
$('auto').onclick=()=>action(async()=>{await save();let s=await go(0);if(!s?.advancing)throw Error('Playback not verified. Click play in Instagram, then retry.');for(let i=1;i<5;i++){await sleep(5000);s=await go(i,'next');if(!s?.advancing)throw Error(`Reel ${i+1} not playing. Interact with Instagram and retry.`)}show('Automated sequence finished. Review logs and visually verify every video; no success level is assigned automatically.')});
$('reset').onclick=()=>action(async()=>{playlist=[];index=-1;logs=[];commits=[];await chrome.storage.local.remove('playlist');for(let i=0;i<5;i++)$(`url${i}`).value='';$('log').textContent='';show('Reset complete.')});
$('copy').onclick=()=>navigator.clipboard.writeText(logs.map(e=>JSON.stringify(e)).join('\n'));
chrome.storage.local.get('playlist').then(x=>{playlist=x.playlist||[];playlist.forEach((v,i)=>$(`url${i}`).value=v)});
