// Heuristics are deliberately conservative: select the video occupying the
// largest visible area, and Instagram's accessible navigation control by label.
// Instagram can change its DOM, labels, or behavior at any time.
function visibleVideo() {
  return [...document.querySelectorAll('video')].map(v => {
    const r = v.getBoundingClientRect();
    return {v, area: Math.max(0, Math.min(innerWidth,r.right)-Math.max(0,r.left))*Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top))};
  }).sort((a,b)=>b.area-a.area)[0]?.v;
}
function shortcode(url) { return /\/(?:reel|reels)\/([A-Za-z0-9_-]+)(?:\/|$)/.exec(new URL(url).pathname)?.[1] || null; }
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'inspect') {
    const v=visibleVideo();
    reply({url:location.href, shortcode:shortcode(location.href), documentEpoch:performance.timeOrigin,
      video:v ? {paused:v.paused, ended:v.ended, readyState:v.readyState, currentTime:v.currentTime, muted:v.muted, volume:v.volume, error:v.error?.message || null} : null});
  } else if(msg.type === 'native') {
    // English accessible labels observed in the authenticated test session;
    // localized or changed labels intentionally fail instead of guessing.
    const label=msg.direction==='next'?'Navigate to next Reel':'Navigate to previous Reel';
    const b=[...document.querySelectorAll('button,[role="button"]')].find(e=>e.getAttribute('aria-label')===label);
    if(!b) reply({ok:false,error:'Native control not found; interface language or DOM may have changed.'});
    else {b.click();reply({ok:true});}
  } else if (msg.type === 'route-experiment') {
    // Diagnostic only: changing a URL is not evidence of changing the video.
    // The second strategy temporarily changes a real Instagram-created anchor,
    // so its existing event handler gets a chance to route the requested URL.
    let u; try { u=new URL(msg.url); } catch { reply({ok:false,error:'Invalid URL'}); return; }
    if(u.origin!=='https://www.instagram.com'||!/^\/(?:reel|reels)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)) {reply({ok:false,error:'Invalid Reel target'});return;}
    if(msg.strategy==='navigation-api') {
      if(!window.navigation?.navigate){reply({ok:false,error:'Chrome Navigation API unavailable in this content script.'});return;}
      reply({ok:true,strategy:msg.strategy,target:u.href});
      setTimeout(()=>{try{window.navigation.navigate(u.href)}catch(e){console.error('Navigation API experiment failed',e)}},100);
      return;
    }
    let a, original;
    if(msg.strategy==='existing-anchor') {
      a=[...document.querySelectorAll('a[href]')].find(e=>/^\/[A-Za-z0-9._]+\/reels\/$/.test(e.getAttribute('href')||'') && e.getBoundingClientRect().width>0);
      if(!a){reply({ok:false,error:'Visible Instagram profile-Reels anchor unavailable'});return;}
      original=a.getAttribute('href');a.setAttribute('href',u.pathname);
    } else if(msg.strategy==='injected-anchor') {
      a=document.createElement('a');a.href=u.href;a.textContent='Reel route test';a.style.display='none';document.body.append(a);
    } else {reply({ok:false,error:'Unknown strategy'});return;}
    reply({ok:true,strategy:msg.strategy,oldHref:original||null,target:u.href});
    setTimeout(()=>{a.click();setTimeout(()=>{if(original)a.setAttribute('href',original);else a.remove()},1000)},100);
  } else if(msg.type==='restart') {
    const v=visibleVideo(); if(!v) reply({ok:false,error:'No visible video'}); else {v.currentTime=0;v.play().then(()=>reply({ok:true})).catch(e=>reply({ok:false,error:String(e)}));return true;}
  }
});
