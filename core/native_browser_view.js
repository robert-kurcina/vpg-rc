/* Shared-engine browser workflow. Scenario content lives in JSON.
 * All legality/transactions/save/Undo are delegated to WargameSession and
 * WargameCore. No independent combat, phase or movement adjudication here.
 */
(function(root,factory){
 const api=factory(root.WargameCore,root.WargameSession,root.WargameNativePreviewConfig,
  root.HexTerrainTiles,root.WargamePresentation,root.WargameCounterVisuals,root.WargameNativeSessionAI,root.WargameNativeCombatUI,root.WargameNativeCityStatus);
 root.WargameNativeBrowserView=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(E,S,Project,T,P,Counters,AI,CombatUI,CityStatus){
'use strict';
const ns='http://www.w3.org/2000/svg';
const Display=globalThis.WargameDisplaySettings;
const Graduated=globalThis.WargameGraduatedMode;
const Activation=globalThis.WargameCounterPhaseActivation;
const keys=['game','map','units','deployments','rules','objectives'];
const $=id=>document.getElementById(id);
const fetchJson=async path=>{const r=await fetch(path);if(!r.ok)throw Error('Unable to load '+path+': '+r.status);return r.json();};
// Use the exact same self-contained SVG image inputs as scripts/export-campaign-maps.js.
// Relative URLs inside an inline SVG silently disappear in isolated DOM previews
// (about:blank) and can be blocked by cross-origin SVG image security rules.
// Reject missing artwork rather than show a plausible but visually incomplete map.
async function embeddedArtwork(url){
 const result=await fetch(url);
 if(!result.ok)throw Error('Required shared map artwork unavailable: '+url+' ('+result.status+')');
 const blob=await result.blob();
 if(!blob.size)throw Error('Required shared map artwork empty: '+url);
 const data=await new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(Error('Cannot embed required shared map artwork: '+url));
  reader.onload=()=>{
   if(typeof reader.result!=='string'||!reader.result.startsWith('data:image/'))
    return reject(Error('Invalid embedded map artwork: '+url));
   resolve(reader.result);
  };
  reader.readAsDataURL(blob);
 });
 // A successful HTTP response with a broken image is not a successful render.
 await new Promise((resolve,reject)=>{
  const img=new Image();img.onload=resolve;
  img.onerror=()=>reject(Error('Required shared map artwork cannot be decoded: '+url));
  img.src=data;
 });
 return data;
}
async function embeddedRenderAssets(projectRoot,entry){
 const textures=Object.fromEntries(await Promise.all(P.KINDS.map(async k=>
  [k,await embeddedArtwork(projectRoot+P.textures()[k])])));
 const source=entry.renderOptions||{};
 const pair=await Promise.all(['fortificationArtwork','cityHexArtwork'].map(async k=>
  [k,typeof source[k]==='string'&&source[k]?await embeddedArtwork(projectRoot+source[k]):undefined]));
 return {textures,...Object.fromEntries(pair.filter(([,value])=>value!==undefined))};
}

const labelLoc=p=>p?`${String(p.x+1).padStart(2,'0')}${String(p.y+1).padStart(2,'0')}`:'—';
function begin({rootDir,profilePath,mapPath,registryPath,projectRoot,aiProfilePath,aiObjectiveProfilePath,aiCaptureProfilePath,uiProfilePath}){
 let g=null,basePackage=null,baseProfile=null,session=null,board=null,mapBase=null,selection=[],legalCells=[],aiProfiles={},combatTarget=null,referenceTab='sequence';
 const redoHistory=globalThis.WargameMissionStorage?.redoHistory();
 let displayControl=null,selectPanel=null,terrainTooltip=null,referenceDialog=null;
 const playerStrategies=['baseline','objective','capture'];
 let aiAssignment='manual',aiPaused=true,aiRunning=false,aiTimer=null,aiStop=false,pausedRun=null;
 function playerConfig(){return {assignment:aiAssignment,german:$('ai-strategy')?.value||'baseline',soviet:$('ai-strategy-soviet')?.value||'baseline',germanDifficulty:Number($('ai-difficulty')?.value||0),sovietDifficulty:Number($('ai-difficulty-soviet')?.value||0)};}
 function pauseAutomatic(){aiPaused=true;aiStop=true;if(aiTimer!==null){clearTimeout(aiTimer);aiTimer=null;}}
 function computerOwns(side){return aiAssignment==='both'||aiAssignment===side;}
 function autoEligible(){return !!session&&!aiPaused&&!aiRunning&&!current().over&&current().pendingRoll===null&&phase()?.kind!=='setup'&&phase()?.kind!=='redeployment'&&computerOwns(current().side);}
 function syncHistory(){redoHistory?.observe(session);if($('undo'))$('undo').disabled=aiRunning||!S.canUndo(session);if($('redo'))$('redo').disabled=aiRunning||!redoHistory?.available(session);}
 function syncAutomatic(){syncHistory();syncPhaseBar();if(!$('native-ai-assignment'))return;
  $('native-ai-assignment').disabled=aiRunning;$('native-ai-resume').disabled=!aiRunning&&aiAssignment==='manual';
  $('native-ai-resume').textContent=aiRunning?'Stop AI':aiPaused?'Resume automatic play':'Pause automatic play';
  $('native-ai-status').textContent=aiAssignment==='manual'?'Manual handoff':aiPaused?'Automatic play paused':current()?.over?'Campaign complete':current()?.pendingRoll!==null?'Waiting for committed die resolution':computerOwns(current()?.side)?'Computer controls current side (manual setup remains human)':'Human controls current side';
  if(autoEligible()&&aiTimer===null)aiTimer=setTimeout(()=>{aiTimer=null;if(autoEligible())playAISide();},0);
 }
 function syncPhaseBar(){
  if(!session)return;
  const state=current(),p=phase(),finish=$('finish-phase');
  const label=state.over?$('phase-status').textContent:
   'Turn '+state.turn+' / '+g.rules.turns+' · '+(p?.kind==='redeployment'?'SOVIET RESERVES':state.side.toUpperCase())+' · '+String(p?.id||'').replaceAll('-',' ');
  let action=null;
  if(!state.over){
   if(aiRunning)action={label:'Stop AI',run:()=>$('native-ai-resume').click()};
   else if(humanBlocked())action={label:'Pause AI',run:()=>$('native-ai-resume').click()};
   else if(p?.kind==='combat'&&state.declarationLocked)action={label:'Combat decision',run:()=>globalThis.WargameResponsiveShell?.openAt('battle-panel')};
   else if(finish&&!finish.disabled)action={label:finish.textContent,run:()=>finish.click()};
   else action={label:'Required orders',run:()=>globalThis.WargameResponsiveShell?.openAt('options-panel')};
  }
  globalThis.WargameResponsiveShell?.setPhase({label,action});
 }
 function applyPlayers(players){pauseAutomatic();aiAssignment=players.assignment;for(const [id,value] of [['native-ai-assignment',players.assignment],['ai-strategy',players.german],['ai-strategy-soviet',players.soviet],['ai-difficulty',players.germanDifficulty??0],['ai-difficulty-soviet',players.sovietDifficulty??0]])if($(id)){if(id.startsWith('ai-difficulty'))globalThis.WargameAIDifficulty.restoreSelect($(id),value);else $(id).value=value;}}
 function portableSave(){const raw=S.serialize(session);return globalThis.WargamePlayerSaveConfig?globalThis.WargamePlayerSaveConfig.pack(raw,playerConfig(),playerStrategies):raw;}
 function humanBlocked(){return aiRunning||autoEligible();}

 let ui={combatSelectionMode:'attacker-first',showGuidedPhases:false,showRuleReferences:false};
 function uiPolicy(value){
  if(!value||value.schemaVersion!==1||!['defender-first','attacker-first'].includes(value.combatSelectionMode)||
   typeof value.showGuidedPhases!=='boolean'||typeof value.showRuleReferences!=='boolean'||
   Object.keys(value).some(k=>!['schemaVersion','combatSelectionMode','showGuidedPhases','showRuleReferences'].includes(k)))
   throw Error('Invalid universal browser UX configuration');
  return value;
 }
 function defenderFirst(){return ui.combatSelectionMode==='defender-first';}
 function cleanSelection(){selection=[];legalCells=[];combatTarget=null;}
 const show=(message,isError=false)=>{const el=$('message');el.textContent=message;el.classList.toggle('error',isError);globalThis.WargameResponsiveShell?.feedback(message,isError);};
 const current=()=>session?.state;
 const phase=()=>session?E.currentPhase(g,current()):null;
 const findUnit=id=>current()?.units.find(u=>u.id===id);
 const selectable=unit=>unit&&unit.strength!=='dead'&&(E.unitSide(unit)===current().side||phase()?.kind==='setup'||phase()?.kind==='redeployment'&&g.deployments.openingRedeployment.unitIds.includes(unit.id));
 const change=(action)=>{
  if(humanBlocked()){show("Pause automatic play before submitting a human action.",true);return false;}
  try{const output=S.execute(session,action);if(!output.ok){show('Not legal: '+output.reason,true);return false;}
   session=output.session;cleanSelection();
   show(`${action.type} accepted${action.unitId?' · '+action.unitId:''}.`);render();return true;
  }catch(e){show('Action rejected: '+e.message,true);return false;}
 };
 const mkSvg=(tag,attrs={})=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
 function unitSelect(id,shift=false){
  if(!session||current().over)return show('No active game orders.',true);
  if(humanBlocked())return show('Computer controls this side. Pause automatic play to issue orders.',true);
  const unit=findUnit(id);if(!unit||!selectable(unit))return show(`Cannot select ${id} in this phase.`,true);
  if(phase()?.kind==='combat'){
   if(E.unitSide(unit)!==current().side)return show('This counter is a defender; select its hex as a target.',true);
   if(defenderFirst()){
    if(!combatTarget)return show('Select an enemy defender before choosing attacking counters.',true);
    const allowed=CombatUI.adjacent(session,combatTarget);
    if(!allowed.includes(id))return show('This counter cannot attack the selected defender.',true);
    selection=selection.includes(id)?selection.filter(v=>v!==id):[...selection,id];
   }else if(shift){selection=selection.includes(id)?selection.filter(v=>v!==id):[...selection,id];}
   else selection=[id];
  }else selection=[id];
  const type=phase()?.kind;
  legalCells=(type==='setup'?S.legal(session,{type:'setup-place',unitId:id}):type==='redeployment'?S.legal(session,{type:'redeploy-reserve',unitId:id}):type==='move'?S.legal(session,{type:'move',unitId:id}):[]);
  if(type==='combat')show(defenderFirst()?`${selection.length} attacker(s) selected against ${combatTarget}. ${selection.length&&CombatUI.legal(session,combatTarget,selection)?'Legal group — declare battle in Orders.':'Choose a legal group in Orders.'}`:`${selection.length} attacker(s) selected. Choose an enemy defender.`);
  else show(`${unit.id} selected · ${legalCells.length} legal destinations`);
  render();
 }
 function cellClick(x,y,clickedId=null,shift=false){
  if(!session)return show('Game is not ready.',true);
  if(current().over)return show('Campaign complete. Start a new mission to play again.');
  if(humanBlocked())return show('Computer controls this side. Pause automatic play to issue orders.',true);
  const p=phase();if(!p)return show('No active phase.',true);
  const occupant=(clickedId?findUnit(clickedId):null)||current().units.find(u=>u.position?.x===x&&u.position?.y===y&&u.strength!=='dead');
  if(p.kind==='reinforcement'){
   const opts=S.legal(session,{type:'place-reinforcement'}),entry=opts.find(o=>o.x===x&&o.y===y);
   if(entry)change({type:'place-reinforcement',unitId:entry.unitId,x,y});else show('Not an eligible reinforcement hex.',true);
   return;
  }
  if(p.kind==='replacement'){
   const options=S.legal(session,{type:'replacement'});
   const selected=options.find(o=>o.type==='restore'&&findUnit(o.id)?.position?.x===x&&findUnit(o.id)?.position?.y===y)||
    options.find(o=>o.type==='enter'&&o.x===x&&o.y===y);
   if(selected)change({type:'replacement',choice:selected});
   else show('This hex has no presently legal resupply or rebuild target.',true);
   return;
  }
  if(p.kind==='combat'){
   if(current().declarationLocked)return show('Declarations are locked. Resolve the committed battle.',true);
   if(occupant&&E.unitSide(occupant)!==current().side){
    if(defenderFirst()){
     // The target is an inspection state only: selection never consumes a die.
     if(!CombatUI.adjacent(session,occupant.id).length)return show('No uncommitted adjacent attackers for this defender.',true);
     combatTarget=occupant.id;selection=[];show(`Defender ${occupant.id} selected. Choose a legal attacker combination.`);render();globalThis.WargameResponsiveShell?.openAt('combat-target-controls');return;
    }
    if(!selection.length)return show('Choose one or more attacking units first.',true);
    change({type:'declare-battle',attackers:[...selection],defender:occupant.id});return;
   }
   if(occupant&&E.unitSide(occupant)===current().side){unitSelect(occupant.id,shift);return;}
   return show(defenderFirst()?'Select an enemy defender to declare a battle.':'Select friendly attackers, then an enemy defender.',true);
  }
  if(['setup','move','redeployment'].includes(p.kind)){
   // A direct counter click selects that counter, even when its occupied hex
   // is also a legal stacking destination. Click the exposed hex to move there.
   if(clickedId&&occupant&&selectable(occupant)){unitSelect(occupant.id,shift);return;}
   if(selection.length&&legalCells.some(q=>q.x===x&&q.y===y)){
    const unitId=selection[0];change({type:p.kind==='setup'?'setup-place':p.kind==='redeployment'?'redeploy-reserve':'move',unitId,x,y});return;
   }
   if(occupant&&selectable(occupant)){unitSelect(occupant.id,shift);return;}
   return show('Choose a friendly unit and an outlined legal destination.',true);
  }
  show('No map action is available in this phase. Use the phase controls.');
 }
 const displayColor=side=>g.game.factions.find(f=>f.id===side)?.color||'#8c9b97';
 function mapDraw(cityData=null){
  const holder=$('map');
  if(!holder.dataset.ready){holder.innerHTML=T.svgMap(board,mapBase);holder.dataset.ready='true';}
  const svg=holder.querySelector('svg');
  if(displayControl)Display.applyCoast(svg,board,displayControl.get());
  const shell=globalThis.WargameResponsiveShell,focused=shell?.captureMapFocus(svg);
  const previous=svg.querySelector('[data-native-interactive="true"]');if(previous)previous.remove();
  const layer=mkSvg('g',{'data-native-interactive':'true','class':'native-preview-overlays'});
  const byHex=new Map(board.cells.map(c=>[`${c.sourceRef.x},${c.sourceRef.y}`,c]));
  const pos=(x,y)=>byHex.get(`${x},${y}`)?.pixelCenter;
  for(const city of (displayControl?.get().cityOwnership===false?[]:(cityData||CityStatus.read(session,board)).cities)){
   if(!city.owner)continue;
   const [x,y]=city.id.split(',').map(Number),center=pos(x,y);if(!center)continue;
   const badge=mkSvg('g',{'data-city-control':city.hex,'data-city-owner':city.owner,'pointer-events':'none','aria-label':city.name+' — '+city.owner+' control'});
   const bx=center[0]-mapBase.rx*.62,by=center[1]-mapBase.ry*.45,r=mapBase.ry*.16;
   badge.append(mkSvg('circle',{cx:bx,cy:by,r,fill:city.owner==='german'?'#284b74':'#963d3d',stroke:'white','stroke-width':1}));
   const label=mkSvg('text',{x:bx,y:by,dy:'.34em','text-anchor':'middle','font-size':r*1.4,'font-weight':'bold',fill:'white'});label.textContent=city.owner==='german'?'G':'S';badge.append(label);layer.append(badge);
  }
  for(const {x,y} of legalCells){const center=pos(x,y);if(!center)continue;
   layer.append(mkSvg('circle',{cx:center[0],cy:center[1],r:31,
    class:phase()?.kind==='reinforcement'?'native-reinforcement-halo':'native-option-halo','pointer-events':'none'}));
  }
  if(phase()?.kind==='replacement'){
   const options=S.legal(session,{type:'replacement'}),highlights=new Set();
   for(const o of options){
    const unit=findUnit(o.id),where=o.type==='restore'?unit?.position:o;
    if(!where)continue;
    const key=where.x+','+where.y+','+o.type;
    if(highlights.has(key))continue;highlights.add(key);
    const center=pos(where.x,where.y);if(center)layer.append(mkSvg('circle',{
     cx:center[0],cy:center[1],r:31,
     class:o.type==='restore'?'native-resupply-halo':'native-rebuild-halo','pointer-events':'none'}));
   }
  }
  if(phase()?.kind==='combat'&&combatTarget&&!current().declarationLocked){
   const target=findUnit(combatTarget),at=target?.position?pos(target.position.x,target.position.y):null;
   if(at)layer.append(mkSvg('circle',{cx:at[0],cy:at[1],r:34,class:'native-defender-halo','pointer-events':'none'}));
   for(const id of CombatUI.adjacent(session,combatTarget)){
    const unit=findUnit(id),center=pos(unit.position.x,unit.position.y);
    if(center)layer.append(mkSvg('circle',{cx:center[0],cy:center[1],r:26,class:'native-attacker-halo','pointer-events':'none'}));
   }
  }
  const activated=Activation?.native(current(),phase())||new Set();
  const counterSize=Counters.sizeForHexHeight(Math.sqrt(3)*mapBase.ry)*(displayControl?Display.counterScale(displayControl.get()):1);
  for(const u of current().units.filter(u=>u.position&&u.strength!=='dead')){
   const c=pos(u.position.x,u.position.y);if(!c)continue;
   const peers=current().units.filter(v=>v.position?.x===u.position.x&&v.position?.y===u.position.y&&v.strength!=='dead');
   const offset=peers.length>1?(peers.indexOf(u)-(peers.length-1)/2)*counterSize*0.30:0;
   const hit=mkSvg('g',{'data-native-unit':u.id,'class':'native-counter-layer',role:'button',tabindex:0,'aria-label':`Counter ${u.id}`,'aria-pressed':selection.includes(u.id)});
   hit.innerHTML=Counters.piece(u,c[0]-counterSize/2+offset,c[1]-counterSize/2+offset,displayColor(E.unitSide(u)),{width:counterSize,height:counterSize,selected:selection.includes(u.id),activated:activated.has(u.id)});
   hit.addEventListener('click',ev=>{ev.stopPropagation();cellClick(u.position.x,u.position.y,u.id,ev.shiftKey);});
   hit.addEventListener('keydown',ev=>{if(!['Enter',' '].includes(ev.key))return;ev.preventDefault();ev.stopPropagation();cellClick(u.position.x,u.position.y,u.id,ev.shiftKey);});
   layer.append(hit);
  }
  // Invisible interactive hex areas are constructed from the same source
  // cell centers as the shared renderer; no alternate hex geometry is inferred.
  for(const h of board.cells){
   const c=h.pixelCenter;
   const hit=mkSvg('path',{d:T.hexPoints(mapBase.rx,mapBase.ry).map((p,i)=>(i?'L':'M')+[p[0]+c[0],p[1]+c[1]].join(',')).join(' ')+' Z',class:'native-board-hit',
    'data-board-cell':h.id,'aria-label':h.id,...(legalCells.some(q=>q.x===h.sourceRef.x&&q.y===h.sourceRef.y)?{role:'button',tabindex:0}:{})});
   hit.addEventListener('click',ev=>cellClick(h.sourceRef.x,h.sourceRef.y,null,ev.shiftKey));
   hit.addEventListener('keydown',ev=>{if(!['Enter',' '].includes(ev.key))return;ev.preventDefault();ev.stopPropagation();cellClick(h.sourceRef.x,h.sourceRef.y,null,ev.shiftKey);});
   // Overlay after counters would intercept them: place board click targets
   // before the counter sprites, and behind the official labels.
   layer.insertBefore(hit,layer.firstChild);
  }
  const cityLabel=svg.querySelector('[data-layer="city-labels"]');
  svg.insertBefore(layer,cityLabel||null);
  shell?.restoreMapFocus(svg,focused);
 }
 function menuSelect(id,label,options){const wrap=document.createElement('label');wrap.textContent=label;
  const el=document.createElement('select');el.id=id;
  options.forEach(([value,text])=>{const opt=document.createElement('option');opt.value=value;opt.textContent=text;el.append(opt);});wrap.append(el);return wrap;}
 function uiOrders(){
  const p=phase(),s=current(),options=$('options-panel');options.replaceChildren();
  const slot=$('unit-selection');slot.replaceChildren();
  const evidence=$('redeployment-evidence');if(evidence){evidence.replaceChildren();evidence.hidden=true;}
  if(!p)return;
  if(p.kind==='redeployment'){
   const policy=g.deployments.openingRedeployment;
   const help=document.createElement('p');help.textContent=`Optional pre-combat reserve moves (${policy.unitIds.length} available). Select a reserve or confirm without moving. Conservative east-of-front-line candidate; coordinates and perimeter have not been verified against the Oberlabs executable.`;options.append(help);
   // Source-coordinate conflicts must be visible alongside phase status,
   // rather than buried in a scrollable action list. No legality is computed
   // or changed by this presentation of engine diagnostics.
   if(evidence){
    evidence.hidden=false;
    const published=document.createElement('p');published.className='redeployment-audit';
    published.textContent=`Published: ${policy.sourceHexes.join(', ')}. Registered: ${policy.registeredHexes.join(', ')}. Two positions differ; this candidate is not certified.`;
    evidence.append(published);
    if(selection.length){
     const audit=E.openingRedeploymentAudit(g,s,selection[0]);
     if(audit){const status=document.createElement('p');status.id='redeployment-audit';status.className='redeployment-audit';
      const c=audit.counts;
      status.textContent=`${audit.unitId}: ${audit.legalDestinations} candidates (${c.legal} new, ${c.current} current, ${c.original} return); exclusions: ${c.westOrOnFront} west/on column ${audit.frontlineMaxColumn}, ${c.occupied} occupied, ${c.enemyZoc} enemy ZOC, ${c.otherRestriction} other. Eastern boundary unverified.`;
      evidence.append(status);
     }
    }
   }
   for(const id of policy.unitIds){const u=findUnit(id),b=document.createElement('button');
    b.textContent=`${u.id} ${labelLoc(u.position)}`;b.classList.toggle('active',selection.includes(id));
    b.onclick=()=>unitSelect(id);slot.append(b);
   }
  }
  if(p.kind==='setup'){
   for(const u of s.units.filter(u=>E.unitSide(u)===s.side)){
    const b=document.createElement('button');b.textContent=`${u.id}${u.position?' '+labelLoc(u.position):' (unplaced)'}`;
    b.classList.toggle('active',selection.includes(u.id));b.onclick=()=>unitSelect(u.id);slot.append(b);
   }
  }
  if(p.kind==='move'&&g.rules.specialRules.some(x=>x.module==='stacked-battle-v1')){
   for(const u of s.units.filter(u=>u.position&&selectable(u)&&E.unitsAt(s,u.position.x,u.position.y).length>1)){const b=document.createElement('button');b.textContent=`Select ${u.id} · ${labelLoc(u.position)}`;b.onclick=()=>unitSelect(u.id);slot.append(b);}
  }
  if(p.kind==='replacement'){
   const opts=S.legal(session,{type:'replacement'});
   const note=document.createElement('p');note.textContent='Amber hexes show units eligible for repair; green hexes show legal rebuild positions. Click a highlighted hex, or choose a legal replacement below.';options.append(note);
   for(const choice of opts){const b=document.createElement('button');b.textContent=`${choice.type} ${choice.id}${choice.x!==undefined?' to '+labelLoc(choice):''}`;
    b.onclick=()=>change({type:'replacement',choice});options.append(b);
   }
  }
  if(p.kind==='reinforcement'){
   const opts=S.legal(session,{type:'place-reinforcement'});
   const para=document.createElement('p');para.textContent=`${opts.length} legal entry hexes. Select a highlighted entry hex on the map.`;options.append(para);
   legalCells=opts;
  }
  if(p.kind==='combat'){
   const para=document.createElement('p');para.textContent=s.declarationLocked?
    `Locked queue: ${s.declarations.length} battle(s). Committed dice cannot be changed.`:
    `Declared battles: ${s.declarations.length}. ${defenderFirst()?'Select an enemy defender first, then choose a legal attacker group.':'Select attacker(s), then click an enemy.'} Lock all declarations before any die is rolled.`;
   options.append(para);
   const wrap=$('combat-target-controls');wrap.replaceChildren();
   if(defenderFirst()&&!s.declarationLocked&&combatTarget){
    const h=document.createElement('p');h.textContent=`Selected defender: ${combatTarget}`;wrap.append(h);
    const nearby=CombatUI.adjacent(session,combatTarget);
    const help=document.createElement('p');help.textContent=`${nearby.length} adjacent uncommitted attacker(s). Click counters to build a custom group, or select a verified combination below.`;wrap.append(help);
    if(selection.length){
     const valid=CombatUI.legal(session,combatTarget,selection);
     const btn=document.createElement('button');btn.id='declare-selected-battle';btn.textContent=`Declare ${selection.join(' + ')} vs ${combatTarget}`;
     btn.disabled=!valid;btn.onclick=()=>change({type:'declare-battle',defender:combatTarget,attackers:[...selection]});wrap.append(btn);
     if(!valid){const msg=document.createElement('p');msg.textContent='This attacker group is not legal at its current odds and position.';wrap.append(msg);}
    }
    const groups=CombatUI.suggestions(session,combatTarget);
    for(const [i,candidate] of groups.options.entries()){
     const b=document.createElement('button');b.type='button';b.dataset.combatSuggestion=String(i);
     b.textContent=`${candidate.odds===null?'Untried':(globalThis.WargameHistoricalCRT?.label(candidate.odds)||candidate.odds+':1')} · ${candidate.attackers.join(' + ')}`;
     b.onclick=()=>change({type:'declare-battle',defender:combatTarget,attackers:[...candidate.attackers]});wrap.append(b);
    }
    if(groups.manualOnly){const note=document.createElement('p');note.textContent='Too many adjacent units to enumerate all combinations; select attackers manually.';wrap.append(note);}
    else if(groups.total>groups.options.length){const note=document.createElement('p');note.textContent=`${groups.total} legal groups. Showing ${groups.options.length} suggestions; build any other group by clicking its attackers.`;wrap.append(note);}
    else if(!groups.options.length){const note=document.createElement('p');note.textContent='No presently legal attacker group.';wrap.append(note);}
   }
  }else $('combat-target-controls').replaceChildren();
 }
 function uiBattle(){
  const el=$('battle-panel');el.replaceChildren();const s=current(),p=phase();
  const can=p?.kind==='combat'&&s.declarationLocked&&s.pendingRoll!==null&&s.declarations.length;
  $('resolve-battle').disabled=!can;
  if(!can)return;
  const decl=s.declarations[0];const preview=s.pendingRoll===0?{outcome:'NE',retreat:[],potentialAdvance:false}:E.combatPreview(g,s,decl.attackers,decl.defender,s.pendingRoll,decl.airSupportId||null);
  const head=document.createElement('p');head.textContent=`${decl.attackers.join(' + ')} vs ${(preview?.defenders||[decl.defender]).join(' + ')}; die ${s.pendingRoll===0?'none':s.pendingRoll}; outcome ${preview?.outcome||'unavailable'}`;el.append(head);
  if(!preview)return;
  const attackers=decl.attackers.map(id=>[id,id]);
  if(preview.outcome==='AL')el.append(menuSelect('choice-attacker','Attacker to lose a step',[['','Default'],...attackers]));
  if(preview.outcome==='EX'){
   const label=document.createElement('label');label.textContent='Exchange loss priority (comma-separated unit IDs, optional)';
   const input=document.createElement('input');input.id='choice-exchange';input.type='text';input.placeholder=decl.attackers.join(',');label.append(input);el.append(label);
  }
  if(preview.defenderLossOptions?.length)el.append(menuSelect('choice-defender-loss','Defender to lose a step',[['','Default'],...preview.defenderLossOptions.map(id=>[id,id])]));
  if(preview.cityHoldOptions?.length)el.append(menuSelect('choice-stand-fast','Defender Stand Fast',[['none','Retreat'],...preview.cityHoldOptions.map(id=>[id,`Hold: ${id} loses a step`])]));
  if(['DR','DRL','EX'].includes(preview.outcome))for(const [id,routes] of Object.entries(preview.retreatByDefender||{}))if(routes.length){const control=menuSelect('choice-retreat-'+id,`Retreat ${id}`,[['','Default'],...routes.map(q=>[`${q.x},${q.y}`,`${labelLoc(q)} · ZOC cost ${q.cost??0}`])]);control.querySelector('select').dataset.stackRetreat=id;el.append(control);}
  if(preview.retreat?.length)el.append(menuSelect('choice-retreat','Defender retreat',[['','Default'],...preview.retreat.map(q=>[`${q.x},${q.y}`,`${labelLoc(q)} · ZOC cost ${q.cost??0}`])]));
  if(preview.potentialAdvance)el.append(menuSelect('choice-advance','Advance after combat',[['','Default'],['none','No advance'],...attackers]));
  // A city hold and retreat/advance are mutually exclusive. Keep prior draft
  // choices available if the player switches back to retreat before committing.
  const hold=$('choice-stand-fast');
  if(hold){const sync=()=>{const holding=hold.value!=='none';for(const select of el.querySelectorAll('[data-stack-retreat],#choice-retreat,#choice-advance'))select.disabled=holding;};hold.addEventListener('change',sync);sync();}
 }
 function getChoices(){
  const out={};const byId=id=>$(id)?.value;
  if(byId('choice-attacker'))out.attackerLossId=byId('choice-attacker');
  if(byId('choice-exchange'))out.exchangeOrder=byId('choice-exchange').split(',').map(v=>v.trim()).filter(Boolean);
  if(byId('choice-retreat')&&!$('choice-retreat').disabled){const [x,y]=byId('choice-retreat').split(',').map(Number);out.retreatTo={x,y};}
  if(byId('choice-defender-loss'))out.defenderLossId=byId('choice-defender-loss');
  if(byId('choice-stand-fast'))out.standFastId=byId('choice-stand-fast');
  if(out.standFastId&&out.standFastId!=='none'){out.advanceId='none';return out;}
  for(const select of document.querySelectorAll('#battle-panel [data-stack-retreat]'))if(select.value){const [x,y]=select.value.split(',').map(Number);(out.retreats??={})[select.dataset.stackRetreat]={x,y};}
  if(byId('choice-advance'))out.advanceId=byId('choice-advance');
  return out;
 }
 function phaseGuide(p,s){
  if(!p)return 'Victory is calculated from the configured end-game conditions.';
  if(p.kind==='setup')return 'Place the required starting counters on legal markers, then confirm the complete setup.';
  if(p.kind==='redeployment')return 'Optionally move any of the three Soviet reserves to a highlighted empty hex east of all original frontline Soviet armies and outside German ZOC. Confirm to begin Turn 1 German combat. Candidate region is not yet source-certified.';
  if(p.kind==='reinforcement')return 'Blue highlighted hexes are the currently legal entry destinations for the scheduled reinforcement. Occupied or enemy-controlled border hexes may be excluded.';
  if(p.kind==='replacement')return `Amber hexes identify reduced counters eligible for resupply; green hexes identify legal rebuilt-unit entry locations. Select a highlighted hex or the corresponding action. ${S.legal(session,{type:'replacement'}).length} legal actions remain.`;
  if(p.kind==='move')return `Select a friendly counter, then a highlighted legal destination. Movement mode: ${p.movementMode||'normal'}.`;
  if(p.kind==='combat')return s.declarationLocked?'A die has been committed for the current declared battle. Choose consequences, then resolve before the next die.':
   `Declare all battles before locking them. ${defenderFirst()?'Select defender first, then a legal attacker group.':'Select attackers, then defender.'} No die is consumed by selection.`;
  return 'Follow the configured phase sequence.';
 }
 function referenceContent(holder=$('reference-content'),tab=referenceTab){
  if(!holder||!ui.showRuleReferences||!g)return;
  const s=current(),rules=g.rules;holder.replaceChildren();
  const add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;holder.append(el);return el;};
  if(tab==='sequence'){
   for(const side of rules.turnOrder){add('h3',`${side.toUpperCase()} phases`);
    const list=document.createElement('ol');for(const p of E.phasesFor(g,side)){const li=document.createElement('li');li.textContent=p.id.replace(/-/g,' ')+' ('+p.kind+')';list.append(li);}holder.append(list);}
   add('p',`Turn 1 begins with ${rules.turnOrder[0]} ${rules.initialPhaseId}. Full campaign: ${rules.turns} turns.`);
  }else if(tab==='howto'){
   for(const step of [
    'Setup: select a counter, choose a legal deployment hex and confirm all required placements.',
    'Combat: declare the complete set of battles before locking the queue; dice commit only when battles are locked.',
    defenderFirst()?'Combat selection: click an enemy defender, then choose a legal group of adjacent attackers.':'Combat selection: choose friendly attackers, then click the defender.',
    'Combat consequences: select any legal loss, retreat or advance and resolve each committed battle.',
    'Movement: choose a friendly unit and a highlighted legal destination. End the phase when finished.',
    'Undo and Redo restore committed actions. Use Save JSON to export a versioned session.'
   ])add('p',step);
   globalThis.WargameReferenceDialog.originalRules(holder,'battle-for-moscow');
  }else if(tab==='terrain'){
   globalThis.WargameReferenceDialog.terrain(holder,{scenario:'battle-for-moscow',movement:rules.movement,combat:rules.combat,weather:rules.weather});
  }else if(tab==='crt'){
   const scroll=document.createElement('div');scroll.className='crt-reference-scroll';
   scroll.append(Display.renderCRT(rules.combat.table,rules.combat.crtVariant||'standard'));holder.append(scroll);
   add('p',(rules.combat.crtVariant==='advanced'?'Advanced CRT (user-supplied eight-column matrix). ':'Standard B4M CRT. ')+'Attacks below the active CRT minimum cannot be declared.');
  }
  for(const button of document.querySelectorAll('[data-reference]')){
   const active=button.dataset.reference===referenceTab;
   button.setAttribute('aria-selected',String(active));button.classList.toggle('active',active);
  }
 }
 function renderCityStatus(){
  const target=$('city-status');if(!target||!CityStatus)throw Error('Native city status view unavailable');
  target.replaceChildren();
  const data=CityStatus.read(session,board),s=current();
  const summary=document.createElement('p');summary.className='city-summary';
  summary.textContent=[...g.game.factions.map(f=>`${f.label||f.name||f.id}: ${data.counts[f.id]}`),
   `Unclaimed: ${data.counts.unclaimed}`].join(' · ');
  $('city-summary-inline').textContent='City control · '+summary.textContent+(g.objectives.graduatedVictory?' · '+Graduated.description(g.objectives.graduatedVictory,s.control,s.over):'');
  target.append(summary);
  const table=document.createElement('table');table.className='native-city-table';
  const head=document.createElement('tr');
  for(const h of ['City / hex','Last entrant controls','On hex']){
   const th=document.createElement('th');th.textContent=h;head.append(th);
  }
  table.append(head);
  for(const city of data.cities){
   const tr=document.createElement('tr');tr.dataset.cityHex=city.hex;
   const name=document.createElement('th');name.textContent=`${city.name} (${city.hex})${city.objective?' *':''}${g.objectives.graduatedVictory?' · '+g.objectives.graduatedVictory.weights[city.id]+' VP':''}`;tr.append(name);
   const owner=document.createElement('td');owner.textContent=city.owner||'Unclaimed';
   owner.dataset.cityOwner=city.owner||'unclaimed';
   if(city.owner)owner.style.color=displayColor(city.owner);tr.append(owner);
   const occupied=document.createElement('td');occupied.textContent=city.occupants.join(', ')||'—';tr.append(occupied);
   table.append(tr);
  }
  target.append(table);
  const note=document.createElement('p');note.className='city-caption';
  note.textContent=data.evaluated?`Final ${data.verdict} result (engine adjudicated).`:
   `If victory were evaluated now: ${data.verdict}. Informational only: actual adjudication is ${data.evaluationPolicy}.`;
  target.append(note);
  if(g.objectives.graduatedVictory){const grade=document.createElement('p');grade.id='graduated-score';grade.textContent=Graduated.description(g.objectives.graduatedVictory,s.control,s.over);target.append(grade);}
  if(Graduated&&$('victory-criteria'))$('victory-criteria').textContent='Active game: '+(g.objectives.graduatedVictory?'Experimental graduated':'Historical')+'. Selection applies to next game. '+Graduated.criteria(Graduated.profile(g.game.id));
  if(data.tournamentPreview){
   const t=data.tournamentPreview;
   const title=document.createElement('h3');title.textContent='Tournament rules — reference score only';target.append(title);
   const score=document.createElement('p');score.className='city-caption';
   score.textContent=t.ambiguous?
    `Tournament rule-text ambiguity: ${t.eligible.map(e=>e.id.replaceAll('-',' ')).join(' AND ')} both qualify. `+
    'The published rules do not resolve this overlap; no primary result or total points are assigned.':
    `If play ended in this position: ${t.primary.id.replaceAll('-',' ')} (${t.primary.points} base points for ${t.primary.side}). `+
     g.game.factions.map(f=>`${f.name||f.id}: ${t.points[f.id]}`).join(' · ')+'.';target.append(score);
   const details=document.createElement('p');details.className='city-caption';
   details.textContent=t.stepCounts.map(c=>`${c.side} ${c.unitType} steps on map: ${c.count}`).join(' · ')+'. '+
    `Bonuses: ${t.bonuses.map(b=>`${b.id.replaceAll('-',' ')} (+${b.points} ${b.side})`).join(', ')||'none'}. `+
    `Soviet east-edge communication: `+
    Object.entries(t.connections).map(([cell,connected])=>`${data.cities.find(c=>c.id===cell.split(':')[1])?.name||cell.split(':')[1]} ${connected?'connected':'cut off'}`).join(' · ')+'.';
   target.append(details);
   const warning=document.createElement('p');warning.className='city-caption';
   warning.textContent='Preview only: optional reserve redeployment is a conservative, unverified candidate. Tournament scoring remains disabled; standard victory remains active. These are not final tournament results.';target.append(warning);
  } else if(data.tournamentStatus){
   const variant=document.createElement('p');variant.className='city-caption';
   variant.textContent=`Tournament variant: ${data.tournamentStatus} (not active in this native preview).`;target.append(variant);
  }
  return data;
 }
 function render(){
  if(pausedRun&&pausedRun.session!==session)pausedRun=null;
  if(!session)return;
  const s=current(),p=phase();
  $('phase-status').textContent=s.over?`Game finished · ${g.objectives.graduatedVictory?Graduated.evaluate(g.objectives.graduatedVictory,s.control).grade.replaceAll('-',' ').toUpperCase():String(s.winner).toUpperCase()}`:
   `Turn ${s.turn} · ${p?.kind==='redeployment'?'SOVIET RESERVES (pre-combat)':s.side.toUpperCase()} · ${p?.id||'finished'}${s.pendingRoll!==null?' · committed die '+s.pendingRoll:''}`;
  $('game-status').textContent=`${s.units.filter(u=>u.position&&u.strength!=='dead').length} counters on board · ${session.history.length} Undo steps · ${s.log.length} events · ${g.rules.combat.crtVariant==='advanced'?'Advanced':'Standard'} CRT · ${g.rules.specialRules.some(x=>x.module==='stacked-battle-v1')?'Double-stack variant':'Historical stacking'}`;
  $('phase-guidance').textContent=ui.showGuidedPhases?phaseGuide(p,s):'';
  $('history').textContent=s.log.slice(-14).map(r=>`${r.turn} ${r.side} ${r.type} ${r.unit||r.defender||r.phase||''}`).join('\n');
  syncHistory();
  $('finish-phase').disabled=!!s.over||p?.kind==='setup'&&!S.legal(session,{type:'finish-setup'}).length||p?.kind==='redeployment'&&!S.legal(session,{type:'finish-redeployment'}).length||p?.kind==='reinforcement'&&!S.legal(session,{type:'finish-phase'}).length||p?.kind==='combat'&&s.declarationLocked;
  $('finish-phase').textContent=p?.kind==='setup'?'Confirm setup':p?.kind==='redeployment'?'Confirm reserves':p?.kind==='combat'&&s.declarations.length?'Lock declarations and roll':'Finish phase';
  $('remove-battle').disabled=p?.kind!=='combat'||s.declarationLocked||!s.declarations.length;
  uiOrders();uiBattle();referenceContent();mapDraw(renderCityStatus());syncAutomatic();
 }
 async function load(){
  try{
   const [registry,source,profile,visual,uiSource]=await Promise.all([
    fetchJson(registryPath),Promise.all(keys.map(k=>fetchJson(rootDir+k+'.json'))).then(parts=>Object.fromEntries(keys.map((k,i)=>[k,parts[i]]))),
    profilePath?fetchJson(profilePath):Promise.resolve(null),fetchJson(mapPath),
    uiProfilePath?fetchJson(uiProfilePath):Promise.resolve(null)]);
   if(!CityStatus)throw Error('Native city-status adapter is not loaded');
   if(uiSource)ui=uiPolicy(uiSource);
   $('reference-section').hidden=!ui.showRuleReferences;
   if(ui.showRuleReferences)referenceDialog=globalThis.WargameReferenceDialog.mount(document.querySelector('#game-sidebar > section'),(tab,holder)=>referenceContent(holder,tab));
   P.configureProfiles(registry.maps);
   const nativePackage=profile?Project.project(source,profile):source;
   if(nativePackage.game.engine!=='generic-hex-v1')throw Error('Requires a native package or a validated scenario projection');
   basePackage=nativePackage;baseProfile=profile;g=E.build(nativePackage);board=visual;
   const entry=registry.maps.find(x=>x.id===g.game.id);
   if(!entry)throw Error('Missing shared map registry profile');
   // Registry-owned presentation config; only image resolution differs from
   // the Node exporter. The terrain, city, river, fort and hex-grid renderer
   // is the *same* HexTerrainTiles.svgMap function in both environments.
   if(typeof projectRoot!=='string'||!projectRoot)throw Error('Native map asset root missing');
   const imageInputs=await embeddedRenderAssets(projectRoot,entry);
   const profileOptions=P.options(g.game.id,{
    id:'native-browser-map',width:entry.width,height:entry.height,...imageInputs
   });
   mapBase=profileOptions;
   if(!Display)throw Error('Shared display settings unavailable');
   selectPanel=Display.setupTabs($('game-sidebar'));
   displayControl=Display.mount($('settings-display'),board,{onChange:()=>{terrainTooltip?.hide();if(session)mapDraw()}});
   terrainTooltip=globalThis.WargameTerrainTooltips.mount({surface:$('map-scroll'),board,settings:displayControl,
    gameRules:{movement:g.rules.movement,combat:g.rules.combat},unitsAtHex:el=>{
     const id=el?.closest?.('[data-native-unit]')?.getAttribute('data-native-unit');
     const u=id?current()?.units.find(x=>x.id===id):null;return u?.position?labelLoc(u.position):null;}});
   globalThis.WargameTouchMap.mount({scroll:$('map-scroll'),stage:$('map'),toolbar:$('map-navigation'),minimumWidth:0});
   start();
  }catch(err){$('game-status').textContent='Game unavailable: '+err.message;show(err.message,true);console.error(err);}
 }
 function start(){
  if(aiRunning)return show("Wait for the current AI side to finish.",true);pauseAutomatic();
  const input=$('seed').value.trim();
  let seed=Number(input);
  if(!input){const bytes=new Uint32Array(1);do{globalThis.crypto.getRandomValues(bytes);seed=bytes[0];}while(!seed);}
  if(!Number.isSafeInteger(seed)||seed<1||seed>0xffffffff)return show('Seed must be an unsigned nonzero 32-bit integer.',true);
  const variant=$('advanced-crt')?.checked?'advanced':'standard';
  const stackedPackage=Project.withStacking(basePackage,baseProfile,$('stacking-mode')?.value||'historical');
  const packageForGame=Graduated?Graduated.withNative(stackedPackage,$('victory-mode')?.value||'historical'):stackedPackage;
  if(variant==='advanced'){
   const CRT=globalThis.WargameHistoricalCRT;
   if(!CRT)throw Error('Shared Advanced CRT unavailable');
   packageForGame.rules.combat.crtVariant='advanced';
   packageForGame.rules.combat.table=CRT.tableFor(g.game.id,'advanced');
  }
  g=E.build(packageForGame);
  session=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:{...E.start(g,seed,$('manual-setup').checked?'manual':'auto-reference',{openingRedeployment:$('candidate-redeployment').checked}),missionSeed:seed}});
  cleanSelection();show('Native session started. Select a counter or finish the phase.');render();
 }
 async function playAISide(){
  if(!session)return show('Start a native game before running AI.',true);
  if(aiRunning)return null;
  if(current().pendingRoll!==null)return show('Resolve the committed human die before AI play.',true);
  if(!aiPaused&&!computerOwns(current().side))return show('Pause automatic play before overriding a human side.',true);
  aiRunning=true;aiStop=false;for(const id of ['ai-strategy','ai-strategy-soviet','ai-difficulty','ai-difficulty-soviet','ai-play-side'])if($(id))$(id).disabled=true;syncAutomatic();
  try{
   if(!AI)throw Error('Native shared-session AI is not loaded');
   // Every strategy uses the same legal-action contract and game state.
   // A policy selection is metadata, not executable scenario-specific code.
   const strategy=$(current().side==='soviet'?'ai-strategy-soviet':'ai-strategy')?.value||$('ai-strategy')?.value||'baseline';
   if(!['baseline','objective','capture'].includes(strategy))throw Error('Unknown AI strategy');
   if(!aiProfiles[strategy]){
    const file=strategy==='objective'?aiObjectiveProfilePath:strategy==='capture'?aiCaptureProfilePath:aiProfilePath;
    if(!file&&strategy!=='baseline')throw Error('No selected AI policy configured');
    aiProfiles[strategy]=AI.policy(file?await fetchJson(file):{});
    if(strategy==='objective'&&aiProfiles[strategy].mode!=='objective-guard-v1'||strategy==='capture'&&aiProfiles[strategy].mode!=='objective-advance-v1')throw Error('Incorrect objective AI policy');
   }
   // Retain the iterator only for an unchanged paused position and strategy.
   // Yield between transactions, but finish already committed combat dice.
   const difficulty=Number($(current().side==='soviet'?'ai-difficulty-soviet':'ai-difficulty')?.value||0);
   const steps=pausedRun?.session===session&&pausedRun.strategy===strategy&&pausedRun.difficulty===difficulty?pausedRun.steps:AI.sideSteps(session,{...aiProfiles[strategy],...(difficulty?{difficulty}:{})});
   pausedRun=null;
   const runSide=current().side;
   let next;
   while(true){
    if(aiStop&&!current().over&&current().side===runSide&&current().pendingRoll===null){pausedRun={session,strategy,difficulty,steps};cleanSelection();render();show('AI paused at a legal action boundary.');return null;}
    next=steps.next();if(next.done)break;
    session=next.value.after;redoHistory?.observe(session);
    if(!current().over&&current().side===runSide)await new Promise(resolve=>setTimeout(resolve,0));
   }
   const out=next.value;
   session=out.session;cleanSelection();
   render();
   const name=strategy==='objective'?'Objective-guard AI':strategy==='capture'?'Objective-advance AI':'Baseline AI';
   show(`${name} ${out.summary.side} · ${out.actions.length} legal actions · ${out.summary.moves} moves · ${out.summary.battles} battles. Not legacy strategic-policy parity.`);
   return out.summary;
  }catch(err){pauseAutomatic();pausedRun=null;cleanSelection();render();show('AI action rejected: '+err.message,true);return null;}
  finally{aiRunning=false;for(const id of ['ai-strategy','ai-strategy-soviet','ai-difficulty','ai-difficulty-soviet','ai-play-side'])if($(id))$(id).disabled=false;syncAutomatic();}
 }
 for(const button of document.querySelectorAll('[data-reference]'))button.addEventListener('click',()=>{referenceTab=button.dataset.reference;referenceContent();});
 $('ai-play-side')?.addEventListener('click',playAISide);
 $('native-ai-assignment')?.addEventListener('change',()=>{pauseAutomatic();aiAssignment=$('native-ai-assignment').value;syncAutomatic();});
 $('native-ai-resume')?.addEventListener('click',()=>{if(aiRunning){pauseAutomatic();syncAutomatic();return;}if(aiAssignment==='manual')return;if(aiPaused)aiPaused=false;else pauseAutomatic();syncAutomatic();});
 $('advanced-crt')?.addEventListener('change',()=>show(($('advanced-crt').checked?'Advanced':'Standard')+' CRT selected for the next new game. Active combat rules remain unchanged.'));
 $('new-game').addEventListener('click',start);
 $('undo').addEventListener('click',()=>{if(aiRunning)return show('Wait for the current AI side to finish.',true);pauseAutomatic();const out=S.undo(session);if(!out.ok)return show('Nothing to Undo.',true);redoHistory?.recordUndo(session,out.session);session=out.session;cleanSelection();show('Previous committed action restored.');render();});
 function redo(){if(aiRunning)return;const next=redoHistory?.take(session);if(!next)return;pauseAutomatic();session=next;cleanSelection();show('Next committed action restored.');render();}
 if(document.documentElement.dataset.missionId)globalThis.WargameMissionStorage?.mountToolbar({undo:$('undo'),redo,settings:()=>selectPanel?.('settings')});
 $('finish-phase').addEventListener('click',()=>change({type:phase()?.kind==='setup'?'finish-setup':phase()?.kind==='redeployment'?'finish-redeployment':'finish-phase'}));
 $('remove-battle').addEventListener('click',()=>change({type:'remove-last-battle'}));
 $('resolve-battle').addEventListener('click',()=>change({type:'resolve-pending',options:getChoices()}));
 $('save-game').addEventListener('click',()=>{try{
  const data=JSON.stringify(portableSave(),null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='native-'+g.game.id+'-turn-'+current().turn+'.json';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
  show('Versioned native session exported.');
 }catch(err){show('Save rejected: '+err.message,true);}});
 function restorePortable(input){
   if(aiRunning)throw Error('Wait for the current AI side to finish');pauseAutomatic();
   const decoded=globalThis.WargamePlayerSaveConfig?globalThis.WargamePlayerSaveConfig.unpack(input,playerStrategies):{save:input,players:{assignment:'manual',german:'baseline',soviet:'baseline'}};const payload=decoded.save;
   // Select the ruleset by its authenticated source fingerprint; never trust
   // unverified save content to supply new executable rules.
   const CRT=globalThis.WargameHistoricalCRT;
   const alternatives=[JSON.parse(JSON.stringify(basePackage)),JSON.parse(JSON.stringify(basePackage))];
   alternatives[1].rules.combat.crtVariant='advanced';
   alternatives[1].rules.combat.table=CRT.tableFor(basePackage.game.id,'advanced');
   if(baseProfile?.stackingVariant)for(const candidate of alternatives.slice())alternatives.push(Project.withStacking(candidate,baseProfile,'double'));
   if(Graduated)for(const candidate of alternatives.slice())alternatives.push(Graduated.withNative(candidate,'graduated'));
   // Previously saved campaigns retain their original forced-hold and destination-only policy.
   if(basePackage.rules.adjudications)for(const candidate of alternatives.slice()){const legacy=JSON.parse(JSON.stringify(candidate));delete legacy.rules.adjudications;alternatives.push(legacy);}
   let restored=null,chosen=null;
   for(const candidate of alternatives){
    const engine=E.build(candidate);
    try{restored=S.restore(payload,{scenarioId:engine.game.id,engine:'generic-hex-v1',config:engine});chosen=engine;break;}catch(e){if(e.message!=='Native save scenario-package mismatch')throw e;}
   }
   if(!restored)throw Error('Save does not match any supported CRT and stacking combination');
   if(aiRunning)throw Error('Wait for the current AI side to finish');
   g=chosen;session=restored;applyPlayers(decoded.players);if($('advanced-crt'))$('advanced-crt').checked=g.rules.combat.crtVariant==='advanced';
   if($('stacking-mode'))$('stacking-mode').value=g.rules.specialRules.some(x=>x.module==='stacked-battle-v1')?'double':'historical';
   if($('victory-mode'))$('victory-mode').value=g.objectives.graduatedVictory?'graduated':'historical';
   cleanSelection();show('Validated native session restored.');render();return true;
 }
 $('load-game').addEventListener('change',async ev=>{const file=ev.target.files?.[0];if(!file)return;
  try{restorePortable(JSON.parse(await file.text()));}
  catch(err){show('Restore rejected: '+err.message,true);}finally{ev.target.value='';}
 });
 const ready=load().then(async()=>{if(session&&document.documentElement.dataset.missionId)await globalThis.WargameMissionStorage?.mount({id:document.documentElement.dataset.missionId,anchor:$('save-game').parentElement,save:portableSave,restore:restorePortable,busy:()=>aiRunning,pause:()=>{pauseAutomatic();syncAutomatic()},reference:referenceDialog?.open,notice:text=>show(text,true)});});
 return {ready,getSession:()=>session,configuration:()=>g,start,render,perform:change,select:unitSelect,playAISide,uxConfig:()=>({...ui}),displaySettings:()=>displayControl?.get(),
  setDisplaySettings:next=>displayControl.set(next),selectTab:name=>selectPanel(name)};
 }
 if(typeof document!=='undefined'&&document.body?.dataset?.nativeScenario){
  const a=document.body.dataset;globalThis.__nativePreview=begin({rootDir:a.nativeScenario,profilePath:a.nativeProfile,mapPath:a.nativeMap,registryPath:a.nativeRegistry,projectRoot:a.nativeProjectRoot,aiProfilePath:a.nativeAiProfile,aiObjectiveProfilePath:a.nativeAiObjectiveProfile,aiCaptureProfilePath:a.nativeAiCaptureProfile,uiProfilePath:a.nativeUiProfile});
  // async load is kept private until initialization;
  // the browser page exposes the API for deterministic smoke tests.
  globalThis.__nativePreviewReady=globalThis.__nativePreview.ready;
 }
 return {begin};
});
