/* Shared startup boundary; intentionally independent of the game engine. */
(function(root){
'use strict';
const panel=document.getElementById('mission-loading');
if(!panel)return;
const status=panel.querySelector('[data-loading-status]'),actions=panel.querySelector('[data-loading-actions]');
const content=[...document.querySelectorAll('body > header,body > main')];
let state='loading';
function block(busy){for(const el of content){el.inert=busy;el.setAttribute('aria-busy',String(busy));}}
function stage(label){if(state==='loading')status.textContent=label;}
function fail(error){
 if(state!=='loading')return;state='error';panel.dataset.state='error';panel.setAttribute('aria-busy','false');
 panel.querySelector('h2').textContent='Mission could not load';status.setAttribute('role','alert');
 status.textContent=String(error?.message||error||'A required mission resource failed.');
 actions.hidden=false;actions.querySelector('button').focus();
}
function ready(){
 if(state!=='loading')return;state='ready';panel.dataset.state='ready';panel.setAttribute('aria-busy','false');block(false);panel.hidden=true;
}
block(true);
actions.querySelector('button').addEventListener('click',()=>root.location.reload());
// Script and stylesheet failures may occur before the game controller runs.
// Only required scripts/styles are fatal here; map image decoding is handled
// by the historical controller, and optional images do not block startup.
root.addEventListener('error',event=>{
 if(state!=='loading')return;
 const target=event.target;
 if(target?.tagName==='SCRIPT'||target?.tagName==='LINK'&&target.rel==='stylesheet')fail('Unable to load '+(target.src||target.href));
 else if(event instanceof ErrorEvent)fail(event.message);
},true);
root.addEventListener('unhandledrejection',event=>fail(event.reason));
root.WargameMissionLoading=Object.freeze({stage,ready,fail,state:()=>state});
})(globalThis);
