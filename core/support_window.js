/* One source-neutral Support Window for air and Fleet in historical/browser game shells.
 * Display and drag state are presentation-only. Every combat decision must come
 * from a caller-supplied exact legal action; this module never adjudicates rules.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameSupportWindow=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const clamp=(v,a,b)=>Math.min(Math.max(v,a),b);
 const make=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;};
 function mount({host=document.body,scenario='shared',onAction,onSelect=null,onCancel=null,mapTargeting=false}={}){
  if(!host||typeof onAction!=='function')throw Error('Support Window needs host and legal-action callback');
  const key='hex-game-support-window-v1:'+String(scenario).replace(/[^a-z0-9_-]/gi,'');
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(key)||'null');return x&&typeof x==='object'?x:{}}catch{return {}}};
  const saved=read();
  let hidden=saved.hidden===true,collapsed=saved.collapsed===true,manuallyCollapsed=collapsed;
  let pos=finite(saved.x)&&finite(saved.y)?{x:saved.x,y:saved.y}:null;
  let model={markers:[],turn:null,owner:'',phase:'',actions:[],noSupportAction:null,pending:false,fleet:null,fleetActions:[],finishNavalAction:null,navalPending:false,fleetChoiceCount:0};
  let available=true;
  let dragging=null;
  const launcher=make('button','support-launcher','Air Support');launcher.type='button';launcher.dataset.supportLauncher='true';
  launcher.setAttribute('aria-controls','game-support-window');launcher.setAttribute('aria-label','Show Air Support window');
  const panel=make('section','support-window');panel.id='game-support-window';panel.dataset.supportWindow='true';panel.setAttribute('aria-label','Air Support');
  const title=make('div','support-window-head');title.dataset.supportDragHandle='true';title.tabIndex=0;title.setAttribute('aria-label','Move Air Support window using Alt plus arrow keys, or drag this header');
  const info=make('div','support-window-heading');
  const heading=make('strong','support-window-title','Air Support');
  const count=make('span','support-window-summary');count.setAttribute('aria-live','polite');
  info.append(heading,count);
  const tools=make('div','support-window-tools');
  const collapse=make('button','support-window-tool','−');collapse.type='button';collapse.dataset.supportCollapse='true';collapse.setAttribute('aria-controls','support-window-body');
  const close=make('button','support-window-tool','×');close.type='button';close.dataset.supportClose='true';close.setAttribute('aria-label','Hide Air Support window');
  tools.append(collapse,close);title.append(info,tools);
  const body=make('div','support-window-body');body.id='support-window-body';
  const caption=make('p','support-window-caption');
  const list=make('div','support-window-list');
  const footer=make('div','support-window-footer');
  body.append(caption,list,footer);panel.append(title,body);
  host.append(launcher,panel);
  const small=()=>matchMedia('(max-width: 800px), (pointer: coarse)').matches||document.body?.dataset.layoutMode==='mobile';
  // Start with a compact bottom tab on touch screens unless the user has saved
  // an explicit preference. Expand automatically for a new legal decision.
  if(!Object.prototype.hasOwnProperty.call(saved,'collapsed')&&small()){collapsed=true;manuallyCollapsed=false;}
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify({hidden,collapsed,x:pos?.x,y:pos?.y}))}catch{}};
  function fit(){
   if(small()){panel.style.left='';panel.style.top='';return;}
   const width=panel.offsetWidth||330,height=panel.offsetHeight||240;
   if(!pos)pos={x:Math.max(12,window.innerWidth-width-24),y:Math.min(152,Math.max(12,window.innerHeight-height-12))};
   pos.x=clamp(pos.x,8,Math.max(8,window.innerWidth-width-8));
   pos.y=clamp(pos.y,8,Math.max(8,window.innerHeight-Math.min(height,52)-8));
   panel.style.left=pos.x+'px';panel.style.top=pos.y+'px';
  }
  function sync(){
   panel.hidden=hidden||!available;launcher.hidden=!hidden||!available;
   panel.classList.toggle('is-collapsed',collapsed);
   body.hidden=collapsed;
   collapse.textContent=collapsed?'+':'−';
   collapse.setAttribute('aria-expanded',String(!collapsed));
   collapse.setAttribute('aria-label',collapsed?'Expand Air Support':'Collapse Air Support');
   if(!hidden)fit();
  }
  function show(){hidden=false;collapsed=false;manuallyCollapsed=false;sync();persist();}
  function setAvailable(enabled){available=!!enabled;sync();}
  function hide(){hidden=true;sync();persist();}
  function toggleCollapse(){collapsed=!collapsed;manuallyCollapsed=collapsed;sync();persist();}
  launcher.addEventListener('click',show);
  close.addEventListener('click',hide);
  collapse.addEventListener('click',toggleCollapse);
  // Allow re-positioning without stealing a map pointer gesture or dragging a
  // control, and preserve placement across collapse/resizing and reloads.
  title.addEventListener('pointerdown',e=>{
   if(small()||e.button!==0||e.target.closest('button'))return;
   dragging={id:e.pointerId,ox:e.clientX-(pos?.x||0),oy:e.clientY-(pos?.y||0)};
   title.setPointerCapture(e.pointerId);panel.classList.add('is-dragging');
  });
  title.addEventListener('pointermove',e=>{
   if(!dragging||dragging.id!==e.pointerId)return;
   pos={x:e.clientX-dragging.ox,y:e.clientY-dragging.oy};fit();
  });
  function finishDrag(e){if(!dragging||dragging.id!==e.pointerId)return;dragging=null;panel.classList.remove('is-dragging');persist();}
  title.addEventListener('pointerup',finishDrag);title.addEventListener('pointercancel',finishDrag);
  title.addEventListener('keydown',e=>{
   if(e.key==='Escape'){if(!collapsed)toggleCollapse();return;}
   if(!e.altKey||small()||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
   e.preventDefault();const step=e.shiftKey?32:12;
   if(!pos)fit();
   pos={x:pos.x+({'ArrowLeft':-step,'ArrowRight':step}[e.key]||0),y:pos.y+({'ArrowUp':-step,'ArrowDown':step}[e.key]||0)};
   fit();persist();
  });
  window.addEventListener('resize',fit);
  function update(next){
   model={...model,...next};
   const markers=Array.isArray(model.markers)?model.markers:[];
   const fleet=model.fleet||null;
   const hasFleet=!!fleet;
   const windowName=hasFleet?'Support':'Air Support';
   heading.textContent=windowName;
   launcher.textContent=windowName;
   launcher.setAttribute('aria-label','Show '+windowName+' window');
   panel.setAttribute('aria-label',windowName);
   close.setAttribute('aria-label','Hide '+windowName+' window');
   count.textContent=(model.targetSelection?model.targetSelection.label+' selected · ':'')+`${markers.filter(m=>m.status==='available').length} air ready · ${markers.filter(m=>m.status==='committed').length} committed`+(fleet?' · Fleet '+(fleet.statusLabel||fleet.status||'unknown'):'');
   caption.textContent=[model.owner,model.turn!==null?'Turn '+model.turn:null,model.phase].filter(Boolean).join(' · ');
   list.replaceChildren();footer.replaceChildren();
   if(markers.length)list.append(make('h3','support-window-group-title','Air Corps'));
   for(const m of markers){
    const card=make('article','support-window-card');card.dataset.supportFace=m.id;
    card.dataset.supportStatus=m.status||'unknown';
    const imageHolder=make('div','support-window-counter');
    if(m.vectorSvg)imageHolder.innerHTML=m.vectorSvg;
    else {imageHolder.textContent=m.label||m.id;imageHolder.classList.add('support-art-fallback');}
    const details=make('div','support-window-details');
    const top=make('div','support-window-card-title');top.append(make('strong','',m.label||m.id),make('span','support-window-badge',m.statusLabel||m.status||'Unknown'));
    details.append(top,make('div','support-window-effect',m.shift?`+${m.shift} CRT column${m.shift===1?'':'s'}`:'Support marker'));
    if(m.note)details.append(make('div','support-window-note',m.note));
    if(m.navalAction&&Number.isFinite(m.shift))details.append(make('div','support-window-note','Naval strike hits Fleet on d6 ≤ '+m.shift));
    card.append(imageHolder,details);
    if(mapTargeting&&m.status==='available'){
     card.classList.add('support-window-pickable');
     card.dataset.supportPick='air:'+m.id;
     card.setAttribute('role','button');card.tabIndex=0;
     card.setAttribute('aria-label','Select '+(m.label||m.id)+' and show legal targets on map');
     card.setAttribute('aria-pressed',String(model.targetSelection?.kind==='air'&&model.targetSelection.id===m.id));
     if(model.targetSelection?.kind==='air'&&model.targetSelection.id===m.id)card.classList.add('is-selected');
     const pick=()=>onSelect?.({kind:'air',id:m.id,label:m.label||m.id});
     card.addEventListener('click',pick);
     card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}});
    }
    const buttons=make('div','support-window-card-actions');
    if(!mapTargeting&&m.action){const button=make('button','support-window-assign','Assign');button.type='button';button.dataset.supportAssign=m.id;button.setAttribute('aria-label',`Assign ${m.label||m.id} to selected battle`);button.addEventListener('click',()=>onAction(m.action));buttons.append(button);}
    if(!mapTargeting&&m.navalAction){const naval=make('button','support-window-assign support-window-naval-attack','Strike Fleet');naval.type='button';naval.dataset.supportNavalStrike=m.id;naval.setAttribute('aria-label',`Commit ${m.label||m.id} naval air strike against Fleet`);naval.addEventListener('click',()=>onAction(m.navalAction));buttons.append(naval);}
    if(buttons.childElementCount)card.append(buttons);
    list.append(card);
   }
   if(!markers.length&&!fleet)list.append(make('p','support-window-empty','No Air Support registered for this scenario.'));
   if(fleet){
    list.append(make('h3','support-window-group-title','Fleet'));
    const card=make('article','support-window-card support-window-fleet');card.dataset.supportFleet=fleet.id||'fleet';card.dataset.fleetStatus=fleet.status||'unknown';
    const holder=make('div','support-window-counter');
    if(fleet.vectorSvg)holder.innerHTML=fleet.vectorSvg;
    else {holder.textContent=fleet.label||'Fleet';holder.classList.add('support-art-fallback');}
    const details=make('div','support-window-details');
    const top=make('div','support-window-card-title');top.append(make('strong','',fleet.label||'Fleet'),make('span','support-window-badge',fleet.statusLabel||fleet.status||'Unknown'));
    details.append(top);
    if(fleet.port)details.append(make('div','support-window-effect','Port: '+fleet.port));
    if(fleet.effect)details.append(make('div','support-window-effect',fleet.effect));
    if(fleet.note)details.append(make('div','support-window-note',fleet.note));
    card.append(holder,details);
    if(mapTargeting&&fleet.status!=='eliminated'&&Array.isArray(model.fleetActions)&&model.fleetActions.length){
     card.classList.add('support-window-pickable');card.dataset.supportPick='fleet:'+fleet.id;
     card.setAttribute('role','button');card.tabIndex=0;
     card.setAttribute('aria-label','Select '+(fleet.label||'Fleet')+' and show legal destination ports on map');
     card.setAttribute('aria-pressed',String(model.targetSelection?.kind==='fleet'&&model.targetSelection.id===fleet.id));
     if(model.targetSelection?.kind==='fleet'&&model.targetSelection.id===fleet.id)card.classList.add('is-selected');
     const pick=()=>onSelect?.({kind:'fleet',id:fleet.id,label:fleet.label||'Fleet'});
     card.addEventListener('click',pick);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}});
    }
    list.append(card);
    const fleetActions=Array.isArray(model.fleetActions)?model.fleetActions:[];
    if(fleetActions.length&&!mapTargeting){
     const controls=make('div','support-window-fleet-actions');
     for(const item of fleetActions){
      if(!item?.action||!item.label)continue;
      const btn=make('button','support-window-skip',item.label);btn.type='button';btn.dataset.supportFleetAction=item.kind||'fleet';
      btn.addEventListener('click',()=>onAction(item.action));controls.append(btn);
     }
     if(controls.childElementCount)list.append(controls);
    }
    if(model.navalPending)list.append(make('p','support-window-footnote','Naval attack committed. Roll the damage die in the combat controls.'));
    if(model.fleetChoiceCount)list.append(make('p','support-window-footnote',model.fleetChoiceCount+' validated Fleet combat consequence'+(model.fleetChoiceCount===1?' is':'s are')+' available on this page in the action catalogue.'));
   }
   if(mapTargeting&&model.targetSelection){
    const context=make('div','support-window-target-status');context.dataset.supportTargetStatus='true';
    context.textContent=model.targetHelp||'Select a highlighted legal hex on the map.';footer.append(context);
    if(Array.isArray(model.targetChoices)&&model.targetChoices.length){
     const confirmation=make('div','support-window-confirm');confirmation.dataset.supportTargetConfirm='true';
     confirmation.append(make('strong','',`Target ${model.targetHex}`));
     for(const item of model.targetChoices){
      const confirm=make('button','support-window-assign',item.label||'Confirm assignment');
      confirm.type='button';confirm.dataset.supportConfirm='true';
      confirm.addEventListener('click',()=>onAction(item.action));confirmation.append(confirm);
     }
     footer.append(confirmation);
    }
    const cancel=make('button','support-window-skip','Cancel map selection');cancel.type='button';cancel.dataset.supportTargetCancel='true';cancel.addEventListener('click',()=>onCancel?.());footer.append(cancel);
   }
   if(model.noSupportAction){const none=make('button','support-window-skip','Commit no air support');none.type='button';none.dataset.supportNone='true';none.addEventListener('click',()=>onAction(model.noSupportAction));footer.append(none);}
   if(model.finishNavalAction){const done=make('button','support-window-skip','Finish naval air-attack window');done.type='button';done.dataset.supportNavalFinish='true';done.addEventListener('click',()=>onAction(model.finishNavalAction));footer.append(done);}
   else if(!model.finishNavalAction&&!model.targetSelection)footer.append(make('p','support-window-footnote',mapTargeting?'Select a ready Support counter to reveal legal map targets.':model.pending?'Support decision pending: use the legal action catalogue.':fleet?'Only engine-legal Air and Fleet actions are enabled.':'Assignment is enabled only during an eligible battle.'));
   if(model.pending&&!manuallyCollapsed&&hidden===false&&collapsed&&!(mapTargeting&&model.targetSelection)){collapsed=false;}
   sync();
  }
  function focusMap(){if(!mapTargeting)return;hidden=false;collapsed=true;manuallyCollapsed=false;sync();persist();}
  function revealTarget(){if(!mapTargeting)return;hidden=false;collapsed=false;sync();persist();}
  sync();
  return Object.freeze({update,show,hide,setAvailable,collapse:toggleCollapse,focusMap,revealTarget,getState:()=>({hidden,collapsed,available,position:pos&&{...pos},markerCount:(model.markers||[]).length}),element:panel});
 }
 return Object.freeze({mount});
});
