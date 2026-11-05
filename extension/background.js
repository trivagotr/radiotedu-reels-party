const EVENT_URL='https://radiotedu.com/reels-party/api/state';
let busy=false,lastCheck=0;
const extract=url=>{try{const u=new URL(url);if(u.origin!=='https://www.instagram.com')return null;return /^\/(?:reel|reels)\/([A-Za-z0-9_-]+)\/?$/.exec(u.pathname)?.[1]||null}catch{return null}};
async function fetchEvent(){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);try{const response=await fetch(EVENT_URL,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('Etkinlik verisi alınamadı');return await response.json()}catch(e){if(controller.signal.aborted)throw Error('Etkinlik bağlantısı zaman aşımına uğradı');throw e}finally{clearTimeout(timer)}}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message.type!=='projection-tick'||!sender.tab?.id)return;
 (async()=>{
  const {projectionTab,panelEnabled,audioEnabled,bridgeStatus}=await chrome.storage.local.get(['projectionTab','panelEnabled','audioEnabled','bridgeStatus']);
  if(projectionTab!==sender.tab.id)return {bound:false};
  if(busy||Date.now()-lastCheck<2500)return {bound:true,waiting:true,audioEnabled:audioEnabled===true,audioReady:bridgeStatus?.ok===true&&extract(sender.tab.url)===bridgeStatus.id};
  busy=true;lastCheck=Date.now();
  try{
   const data=await fetchEvent();const id=data.event?.current_reel;
   if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id)||!data.reels?.some(r=>r.id===id))throw Error('Geçerli Reel seçilmedi');
   const tab=await chrome.tabs.get(projectionTab);if(!tab.url?.startsWith('https://www.instagram.com/'))throw Error('Seçili sekme Instagram değil');
   const latest=await chrome.storage.local.get(['projectionTab','panelEnabled','audioEnabled']);if(latest.projectionTab!==projectionTab)return {bound:false};
   if(extract(tab.pendingUrl)===id)return {bound:true,navigating:true};
   if(tab.pendingUrl||extract(tab.url)!==id){await chrome.tabs.update(projectionTab,{url:'https://www.instagram.com/reel/'+id+'/'});if((await chrome.storage.local.get('projectionTab')).projectionTab!==projectionTab)return {bound:false};await chrome.storage.local.set({bridgeStatus:{ok:true,id,at:Date.now()}});return {bound:true,navigating:true};}
   await chrome.storage.local.set({bridgeStatus:{ok:true,id,at:Date.now()}});
   const reel=data.reels.find(r=>r.id===id);const rows=Array.isArray(data.qrRows)&&data.qrRows.length>=21&&data.qrRows.length<=177&&data.qrRows.every(row=>typeof row==='string'&&row.length===data.qrRows.length&&/^[01]+$/.test(row))?data.qrRows:[];const results=data.event.phase==='result'&&data.results&&Array.isArray(data.results.scores)?{average:Number.isFinite(data.results.average)?data.results.average:null,scores:data.results.scores.slice(0,100).map(x=>({name:String(x.name||'Grup').slice(0,40),score:Number.isInteger(x.score)&&x.score>=1&&x.score<=10?x.score:null}))}:null;return {bound:true,panelEnabled:latest.panelEnabled!==false,audioEnabled:latest.audioEnabled===true,state:{event:{current_reel:id,phase:data.event.phase,round:data.event.round},reel:{id,label:String(reel.label||'Reel').slice(0,80)},results,qrRows:rows}};
  }catch(e){if((await chrome.storage.local.get('projectionTab')).projectionTab!==projectionTab)return {bound:false};await chrome.storage.local.set({bridgeStatus:{ok:false,error:String(e.message||e),at:Date.now()}});return {bound:true,error:String(e.message||e)}}finally{busy=false}
 })().then(result=>reply(result)).catch(e=>reply({bound:true,error:String(e)}));return true;
});
