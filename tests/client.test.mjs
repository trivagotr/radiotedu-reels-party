import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const tick=()=>new Promise(r=>setImmediate(r));
test('group signup does not offer a group name field',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),script=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://radiotedu.com/reels-party/',runScripts:'outside-only'}),w=dom.window;w.setInterval=()=>0;
 const state={initialized:true,event:{round:1,current_reel:'A',phase:'idle'},reels:[{id:'A',label:'A',url:'https://www.instagram.com/reel/A/'}],groups:[],ownGroup:null,ownScore:null,results:null,qrRows:[]};
 w.fetch=async()=>({ok:true,json:async()=>structuredClone(state)});w.eval(script);await tick();await tick();
 assert.ok(w.document.querySelector('#group-form'));assert.equal(w.document.querySelector('#group-form input'),null);dom.window.close();
});
test('a score selected in one round is not carried into the next',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),script=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://radiotedu.com/reels-party/',runScripts:'outside-only'}),w=dom.window;
 w.setInterval=()=>0;w.localStorage.setItem('rtp-group-token','token');
 let state={initialized:true,event:{round:1,current_reel:'A',phase:'voting'},reels:[{id:'A',label:'A',url:'https://www.instagram.com/reel/A/'}],groups:[{id:'g',name:'Grup 1'}],ownGroup:{id:'g',name:'Grup 1'},ownScore:null,results:null,qrRows:[]};
 w.fetch=async()=>({ok:true,json:async()=>structuredClone(state)});w.eval(script);await tick();await tick();
 w.document.querySelector('[data-score="8"]').click();assert.equal(w.document.querySelector('[data-score="8"]').getAttribute('aria-pressed'),'true');
 state={...state,event:{round:2,current_reel:'B',phase:'voting'},reels:[{id:'B',label:'B',url:'https://www.instagram.com/reel/B/'}]};
 await w.refresh();assert.equal(w.document.querySelector('[data-score="8"]').getAttribute('aria-pressed'),'false');
 dom.window.close();
});
test('a delayed score response does not claim the next round was scored',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),script=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://radiotedu.com/reels-party/',runScripts:'outside-only'}),w=dom.window;w.setInterval=()=>0;w.localStorage.setItem('rtp-group-token','token');
 let state={initialized:true,event:{round:1,current_reel:'A',phase:'voting'},reels:[{id:'A',label:'A',url:'https://www.instagram.com/reel/A/'}],groups:[{id:'g',name:'Grup 1'}],ownGroup:{id:'g',name:'Grup 1'},ownScore:null,results:null,qrRows:[]};
 let release;const pending=new Promise(r=>release=r);w.fetch=async url=>{if(url.endsWith('/api/score')){await pending;return {ok:true,json:async()=>({ok:true})}}return {ok:true,json:async()=>structuredClone(state)}};
 w.eval(script);await tick();await tick();w.document.querySelector('[data-score="8"]').click();w.document.querySelector('[data-action="submit-score"]').click();await tick();
 state={...state,event:{round:2,current_reel:'B',phase:'voting'},reels:[{id:'B',label:'B',url:'https://www.instagram.com/reel/B/'}]};await w.refresh();release();await tick();await tick();
 assert.doesNotMatch(w.document.body.textContent,/Grubun puanı kaydedildi/,'the new round must not display a successful score for the previous round');
 dom.window.close();
});
