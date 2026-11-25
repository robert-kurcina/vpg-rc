(()=>{'use strict';
const E=window.B4MEngine,B=window.B4MOpeningBook,L=window.B4MOutcomeLearning,conf=window.B4M_SCENARIO,profiles=window.B4M_RULES,ctx=document.getElementById('board').getContext('2d'),canvas=document.getElementById('board');
const c=E.buildScenario(window.B4M_VERIFIED_SCENARIO,profiles.profiles[profiles.defaultRuleset]);let s=null,history=[],selection=null,used=new Set(),combats=new Set(),busy=false,stopping=false,zoom=.75,latest=null,combatChoice=null;
// Opt-in migration pilot: movement uses the same WargameSession API as AI.
// Default browser path is unchanged. The legacy Undo stack remains the
// compatibility oracle until all UI actions have migrated together.
const sharedMovementEnabled=window.B4M_SHARED_SESSION_MOVEMENT===true;
// Checkpoint 39: opt-in persistent ownership pilot. Unlike the movement-only
// compatibility bridge, this mode owns movement/phase/Undo history in one
// WargameSession instance. It is intentionally not the production default.
const sharedOwnershipPilot=window.B4M_SHARED_SESSION_OWNERSHIP_PILOT===true;
let ownedSession=null;
// Combat declaration highlights are derived from the authoritative queue.
// Session.usedUnitIds tracks movement, not combat attacker commitments.
function syncOwnedCombatMarkers(){
 if(!sharedOwnershipPilot)return;
 combats.clear();
 if(s.phase==='combat')for(const battle of s.declaredBattles||[]){
  combats.add(battle.defender);
 }
}
function ownedAction(action){
 if(!sharedOwnershipPilot)return null;
 const API=window.WargameSession;
 if(!API)throw Error('Shared session API missing');
 // Never convert arbitrary legacy snapshots into partial shared snapshots.
 if(!ownedSession){
  if(history.length)throw Error('Shared ownership requires a clean legacy Undo boundary');
  ownedSession=API.create({scenarioId:'battle-for-moscow',config:c,state:s,usedUnitIds:[...used]});
 }
 // An unsupported legacy mutation after ownership starts must not be adopted.
 if(JSON.stringify(ownedSession.state)!==JSON.stringify(s))throw Error('Shared ownership state desynchronized');
 const result=API.execute(ownedSession,action);
 if(!result.ok)return false;
 ownedSession=result.session;s=ownedSession.state;
 used=new Set(ownedSession.usedUnitIds);
 syncOwnedCombatMarkers();
 return true;
}
function ownedUndo(){
 if(!ownedSession)return false;
 const result=window.WargameSession.undo(ownedSession);
 if(!result.ok)return false;
 ownedSession=result.session;s=ownedSession.state;
 used=new Set(ownedSession.usedUnitIds);
 syncOwnedCombatMarkers();
 return true;
}

function sharedMovement(action){
 if(!sharedMovementEnabled)return null;
 const API=window.WargameSession;
 if(!API)throw Error('Shared session API missing');
 const session=API.create({scenarioId:'battle-for-moscow',config:c,state:s,
  usedUnitIds:[...used],history:history.map(json=>({state:JSON.parse(json),usedUnitIds:[]}))});
 const result=API.execute(session,action);
 if(!result.ok)return false;
 s=result.session.state;
 used=new Set(result.session.usedUnitIds);
 history=result.session.history.map(entry=>JSON.stringify(entry.state));
 if(history.length>30)history=history.slice(-30);
 return true;
}
const $=id=>document.getElementById(id);const stackView=WargameStackView.create();
// These separate, live-rendered SVG fixtures exercise the same official counter
// art and stack-order controller as the game. They NEVER modify campaign state.
const exampleViews={two:WargameStackView.create(),three:WargameStackView.create()};
const exampleSelection={two:null,three:null};
// Printed designation is numeric on the supplied counter sheet. Engine IDs
// retain their g/s prefix internally; only the displayed label drops it.
function printedCounter(u){
 const palette=WargameCounterVisuals.PALETTES.battleForMoscow[u.army];
 const id=String(u.id||'');const designator=/^[gs](\d+)$/i.exec(id);
 return {...u,counter:{...(u.counter||{}),
  name:u.counter?.name??u.label??(designator?designator[1]:id),
  colors:{...palette,...(u.counter?.colors||{})}}};
}
function exampleUnits(which){
 if(!s)return [];
 const side=which==='two'?'german':'soviet',count=which==='two'?2:3;
 return s.units.filter(u=>u.army===side&&u.position&&u.strength!=='dead')
  .slice(0,count).map(u=>({...printedCounter(u),position:{x:0,y:0}}));
}
function renderStackExamples(){
 if(!s||!window.WargameCounterVisuals)return;
 for(const which of ['two','three']){
  const element=$('stack-example-'+which);if(!element)continue;
  const units=exampleUnits(which),ordered=exampleViews[which].ordered(units,{x:0,y:0});
  const top=ordered.at(-1),selected=exampleSelection[which];
  const layer=WargameCounterVisuals.layer(ordered,()=>({x:78,y:55}),()=>undefined,
   {width:64,height:64,stackOffsetX:15,stackOffsetY:13,selectedIds:selected?[selected]:[]});
  element.querySelector('.stack-example-art').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 156 110" aria-hidden="true"><polygon points="78,2 131,29 131,81 78,108 25,81 25,29" stroke="#50616d" stroke-width="1.5" fill="#a7bd96"/>${layer}</svg>`;
  element.querySelector('.stack-example-meta').textContent=ordered.length?`${ordered.length} ${which==='two'?'German':'Soviet'} counters · top: ${top.id}${selected?' · selected: '+selected:''}`:'No units available';
 }
}
function clickStackExample(which,shift){
 const members=exampleUnits(which),view=exampleViews[which];
 const top=shift?view.swapTopBottom(members,{x:0,y:0}):view.top(members,{x:0,y:0});
 exampleSelection[which]=top?.id||null;
 renderStackExamples();
}

// The terrain/presentation bridge reads the EXACT engine scenario already used
// for gameplay. It never mutates the state or controls movement/CRT/AI.
let cityLabels={};
function rebuildVectorTerrain(){
 const root=$('engine-terrain');if(!window.HexTerrainTiles||!window.WargameTerrainAdapter){root.textContent='SVG terrain renderer unavailable';return;}
 const T=HexTerrainTiles,A=WargameTerrainAdapter;
 const board=A.oberlabsBoard(c.raw,(x,y)=>point(x,y));
 const options=WargamePresentation.options('moscow',{id:'legacy-live',textures:WargamePresentation.textures('../supplied_assets/flat/'),width:1600,height:1139,rx:57.275,ry:101.9/Math.sqrt(3),gridOpacity:.95,gridStrokeColor:'#182126',gridStrokeWidth:1.8,riverWidthScale:2,riverWaveAmplitude:2.35,riverWaveLength:23,riverTerminalWidthRatio:.42,fortificationArtwork:'../supplied_assets/flat/fortification-overlay.svg',fortificationAlpha:.5,cityHexArtwork:'../supplied_assets/flat/city-hex-highlight.svg'});
 root.innerHTML=T.svgMap(board,options);
 const svg=root.querySelector('svg');
 for(const [id,name] of Object.entries(cityLabels)){
  const g=svg?.querySelector(`[data-label-hex="${id}"]`);
  if(!g||!svg.querySelector(`[data-symbol-hex="${id}"] .overlay-marker`))continue;
  const el=document.createElementNS('http://www.w3.org/2000/svg','text');
  el.setAttribute('class','city-label');el.setAttribute('x','9');el.setAttribute('y','-8');el.setAttribute('text-anchor','start');
  el.setAttribute('font-size','11');el.setAttribute('font-weight','700');
  el.setAttribute('fill','#19262c');el.setAttribute('stroke','#f5f0d8');el.setAttribute('stroke-width','2.7');
  el.setAttribute('paint-order','stroke');el.textContent=name;g.append(el);
 }
 const overlayRoot=$('engine-labels');if(overlayRoot&&svg){const nameLayer=svg.querySelector('[data-layer="city-labels"]');const topSvg=svg.cloneNode(false);if(nameLayer)topSvg.append(nameLayer.cloneNode(true));overlayRoot.replaceChildren(topSvg);}
}
function rebuildUnits(){
 const root=$('engine-units');if(!root||!s||!window.WargameCounterVisuals)return;
 const units=stackView.orderUnits(s.units.filter(u=>u.position&&u.strength!=='dead')).map(printedCounter);
 // Occupied setup symbols remain in source data but are hidden behind a counter.
 // This prevents the upper-right deployment glyph from appearing to be part
 // of the official counter SVG; vacated markers are visible again.
 const occupied=new Set(units.map(u=>String(u.position.x+1).padStart(2,'0')+String(u.position.y+1).padStart(2,'0')));
 for(const marker of document.querySelectorAll('#engine-terrain [data-deployment-hex]'))
  marker.style.visibility=occupied.has(marker.getAttribute('data-deployment-hex'))?'hidden':'visible';
 const markup=WargameCounterVisuals.layer(units,p=>point(p.x,p.y),()=>undefined,{width:54,height:54});
 // The overlay is pointer-transparent. All clicks still go to the original board canvas.
 const viewBox=root.closest('.mapCanvasStack')?.querySelector('#engine-terrain svg')?.getAttribute('viewBox')||'-45 -45 1690 1229';
 root.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">${markup}</svg>`;
 renderStackExamples();
}
const doctrine=()=> $('doctrine').value, gOpening=()=> $('germanOpening').value, sOpening=()=> $('sovietOpening').value;
let matrixResults=[];let stageResults=[];let outcomeModel=null;
const mode=()=> $('mode').value,depth=()=>Number($('depth').value),width=()=>Number($('width').value),human=()=>mode()==='hotseat'||mode()===s.side;
function point(x,y){let h=E.geom.get([x,y]);if(!h)return {x:-999,y:-999};let origin=h.toPoint(),center=h.center();return {x:origin.x+center.x,y:origin.y+center.y};}
function getClick(ev){let r=canvas.getBoundingClientRect(),x=(ev.clientX-r.left)*canvas.width/r.width,y=(ev.clientY-r.top)*canvas.height/r.height;let best=null,d2=3600;for(let h of c.raw.hexes){let p=point(h.x,h.y),d=(p.x-x)**2+(p.y-y)**2;if(d<d2){best=h;d2=d;}}return best;}
function eligible(){if(!s||s.over)return [];let t=s.phase;if(t==='special')return E.units(s,s.side).filter(u=>s.side==='german'?u.type==='tank':(E.hexAt(c,u.position.x,u.position.y).rail||[]).length);if(t==='movement')return E.units(s,s.side);return [];}
function options(){if(!s||busy||s.over||!human())return [];if(['movement','special'].includes(s.phase)&&selection?.type==='unit'){let u=s.units.find(u=>u.id===selection.id);if(!u||used.has(u.id))return [];return E.legalMoves(c,s,u,s.phase==='movement'?'normal':s.side==='german'?'panzer':'rail');}return [];}
function saveUndo(){if(sharedOwnershipPilot&&ownedSession)throw Error('Action not migrated to shared session ownership');history.push(JSON.stringify(s));if(history.length>30)history.shift();}
function countStrength(side){return E.units(s,side).reduce((a,u)=>a+E.strength(u),0)}
function render(){if(!s)return;ctx.clearRect(0,0,1600,1139);rebuildUnits();
let active=options(),high=new Set(active.map(p=>E.key(p.x,p.y)));for(let h of c.raw.hexes){let pt=point(h.x,h.y),k=E.key(h.x,h.y);if(high.has(k)){ctx.beginPath();ctx.arc(pt.x,pt.y,33,0,Math.PI*2);ctx.fillStyle='rgba(70,170,240,.30)';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#55ceef';ctx.stroke()}if(selection?.x===h.x&&selection?.y===h.y){ctx.beginPath();ctx.arc(pt.x,pt.y,41,0,Math.PI*2);ctx.lineWidth=4;ctx.strokeStyle='#f5c26e';ctx.stroke();}}
// All unit counters are drawn in the shared SVG counter layer.
$('statusPill').textContent=s.over?'Game over':`Turn ${s.turn}/7 · ${s.side==='german'?'Germany':'Soviet'} · ${s.phase}`;$('turnText').textContent=s.over?`Result: ${s.winner.toUpperCase()}`:`Turn ${s.turn}/7 — ${s.side==='german'?'Germany':'Soviet Union'}`;
let coverage=E.sweepMetrics(c,s);$('scorebar').textContent=`Germany: ${countStrength('german')} CF | Soviets: ${countStrength('soviet')} CF | Moscow: ${s.control['10,2']||'—'} | Soviet entry hexes denied by German units/ZOC: ${coverage.germanDenied}/${coverage.total}`;
let helps={setup:'Choose one of the 22 German counters below, then click a black-cross hex on the map. Occupied crosses can be exchanged. Finish setup only after all crosses are filled.',reinforcement:'Turn 4: Place the full-strength 1st Shock Army on an eligible eastern-edge hex before the four normal replacements.',replacement:`${s.side==='german'?'German':'Soviet'} replacements: ${Math.max(0,E.replacementBudget(c,s)-(s.replacementUsed||0))} remaining. Select a replacement action below.`,special:s.side==='german'?'Select a panzer to move during special panzer movement.':'Select a Soviet unit on rail and move along connected rail edges.',combat:'Announce all battles and attacker combinations before rolling any dice.', 'combat-resolution':'Combat dice are fixed and visible. Select losses, retreat and advance before resolving each announced battle.',movement:'Select a friendly counter, then a highlighted destination. Forest costs 2 movement points except during mud; enemy zones of control stop movement.',finished:'Victory is checked at the end of turn 7.'};$('phaseHelp').textContent=helps[s.phase]||'';
$('selected').textContent=selection?.id?'Selected '+selection.id:selection?.type==='defender'?'Attack target '+selection.id:'';
$('phase').disabled=busy||s.over||!human();$('phase').textContent=s.phase==='setup'?'Confirm opening deployment':s.phase==='combat-resolution'?'Resolve current battle':'Finish current phase';$('nextAI').disabled=busy||s.over;$('auto').disabled=busy||s.over;$('stop').disabled=!busy;$('undo').disabled=busy||(sharedOwnershipPilot&&ownedSession? !window.WargameSession.canUndo(ownedSession):history.length===0);
renderActions();renderLog();}
function renderActions(){const o=$('options');o.innerHTML='';if(!human()||s.over||busy)return;let action=(label,fn)=>{let b=document.createElement('button');b.textContent=label;b.addEventListener('click',fn);o.appendChild(b)};
if(s.phase==='setup'){
 const placed=E.units(s,'german').length;
 o.insertAdjacentHTML('beforeend',`<span class="hint">${placed}/22 German units deployed. Choose a counter and then a black cross on the board.</span>`);
 for(const u of s.units.filter(u=>u.army==='german').sort((a,b)=>E.strength(b)-E.strength(a))){
  action(`${selection?.id===u.id?'● ':''}${u.id} · ${E.strength(u)}-${u.movement}${u.position?' at '+(u.position.x+1)+','+(u.position.y+1):' · unplaced'}`,()=>{selection={type:'setup-unit',id:u.id};render();});
 }
}
if(s.phase==='combat-resolution'&&s.pendingBattle){
 if(!combatChoice){const a=s.pendingBattle.action;combatChoice={attackerLossId:a.attackers[0],exchangeOrder:[...a.attackers],retreatTo:null,advanceId:'none'};}
 const a=s.pendingBattle.action,die=s.pendingBattle.die,preview=E.battlePreview(c,s,a,die);
 if(!preview){o.textContent='Declared combat is no longer legal. Undo and inspect the declaration.';return;}
 const info=document.createElement('div');info.className='battle-info';info.textContent=`Battle ${(s.combatIndex||0)+1}/${s.combatQueue.length}: ${a.attackers.join(' + ')} vs ${a.defender} · ${preview.odds}:1 · die ${die} → ${preview.outcome}${preview.cityHold?' (city hold)':''}`;o.appendChild(info);
 const select=(caption,choices,value,update)=>{
  const label=document.createElement('label');label.textContent=caption;
  const el=document.createElement('select');
  for(const [v,n] of choices){const op=document.createElement('option');op.value=v;op.textContent=n;el.append(op);}
  el.value=value;el.onchange=()=>{update(el.value);render();};label.append(el);o.append(label);
 };
 if(preview.outcome==='AL')select('Attacker loss recipient',a.attackers.map(id=>[id,id]),combatChoice.attackerLossId,id=>combatChoice.attackerLossId=id);
 if(preview.outcome==='EX'){
  const label=document.createElement('div');label.className='hint';label.textContent='Exchange loss priority (first to last):';o.appendChild(label);
  combatChoice.exchangeOrder.forEach((id,i)=>action(`${i+1}. ${id}${i>0?' · move earlier':''}`,()=>{
   if(i>0){[combatChoice.exchangeOrder[i-1],combatChoice.exchangeOrder[i]]=[combatChoice.exchangeOrder[i],combatChoice.exchangeOrder[i-1]];render();}
  }));
 }
 if(['DR','DRL','EX'].includes(preview.outcome)&&!preview.cityHold&&preview.retreat.length){
  const rs=preview.retreat.map(r=>[E.key(r.x,r.y),`(${r.x+1},${r.y+1}) · ${r.path.length} hexes${r.cost?' · EZOC loss':''}`]);
  select('Defender retreat destination',rs,combatChoice.retreatTo||rs[0][0],v=>combatChoice.retreatTo=v);
 }
 if(preview.potentialAdvance)select('Attacker advance after combat', [['none','No advance'],...a.attackers.map(id=>[id,id])],combatChoice.advanceId,id=>combatChoice.advanceId=id);
 action('Resolve with selected choices',()=>resolveCurrentHumanBattle());
}
if(s.phase==='reinforcement'){for(const p of E.shockReinforcementOptions(c,s))action(`Place 1st Shock at (${p.x+1},${p.y+1})`,()=>{if(sharedOwnershipPilot){if(!ownedAction({type:'shock-reinforcement',x:p.x,y:p.y}))return;}else{saveUndo();E.performShockReinforcement(c,s,p);}selection=null;render();});}
if(s.phase==='replacement'){let left=E.replacementBudget(c,s)-(s.replacementUsed||0);if(left>0){let opts=E.replacementOptions(c,s).sort((a,b)=>a.type.localeCompare(b.type)).slice(0,70);for(let r of opts){let u=s.units.find(x=>x.id===r.id);action(`${r.type==='restore'?'Restore':'Enter'} ${r.id} ${r.x!==undefined?'at '+(r.x+1)+','+(r.y+1):''}`,()=>{if(sharedOwnershipPilot){if(!ownedAction({type:'replacement',operation:r.type,id:r.id,...(r.type==='enter'?{x:r.x,y:r.y}:{})}))return;selection=null;render();}else{saveUndo();if(E.applyReplacement(c,s,r)){s.replacementUsed=(s.replacementUsed||0)+1;selection=null;render();}}});}}}
if(s.phase==='combat'){if(selection?.type==='defender'){let candidates=E.attackCandidates(c,s).filter(a=>a.defender===selection.id&&!a.attackers.some(id=>used.has(id))).sort((a,b)=>b.odds-a.odds||a.attackers.length-b.attackers.length);for(let a of candidates.slice(0,8))action(`${a.odds}:1 — ${a.attackers.join(' + ')} (${a.modifiers.join(', ')||'open'})`,()=>doCombat(a));if(!candidates.length)o.insertAdjacentHTML('beforeend','<span class="hint">No legal attack available.</span>');}action('Choose attack automatically (best available)',()=>{let cand=E.attackCandidates(c,s).filter(a=>a.odds>=1&&!a.attackers.some(id=>used.has(id))&&!combats.has(a.defender)).sort((a,b)=>b.odds-a.odds);if(cand.length)doCombat(cand[0]);else alert('No additional legal attacks found.');});if((s.declaredBattles||[]).length)action('Remove last announced battle',()=>{if(sharedOwnershipPilot){if(!ownedAction({type:'remove-last-battle'}))return;}else{saveUndo();s.declaredBattles.pop();}used.clear();combats.clear();for(const a of s.declaredBattles||[]){combats.add(a.defender);a.attackers.forEach(id=>used.add(id));}render();});}
if(s.phase==='movement'||s.phase==='special'){let list=eligible().filter(u=>!used.has(u.id));o.insertAdjacentHTML('beforeend',`<span class="hint">${list.length} eligible units remaining. You may skip unused units.</span>`);}
}
function doCombat(a){
 if(sharedOwnershipPilot){if(!ownedAction({type:'declare-battle',defender:a.defender,attackers:[...a.attackers]}))return;}
 else{saveUndo();s.declaredBattles=s.declaredBattles||[];s.declaredBattles.push({defender:a.defender,attackers:[...a.attackers],declaredOdds:a.odds});}
 combats.add(a.defender);a.attackers.forEach(id=>used.add(id));selection=null;render();}
function handleBoardClick(e){if(busy||!s)return;let h=getClick(e);if(!h)return;const members=s.units.filter(u=>u.position&&u.strength!=='dead'&&u.position.x===h.x&&u.position.y===h.y);
 if(e.shiftKey&&members.length>1){const raised=stackView.swapTopBottom(members,{x:h.x,y:h.y});
  selection={type:'inspection',id:raised.id,x:h.x,y:h.y};render();return;}
 let unit=stackView.top(members,{x:h.x,y:h.y});
 if(s.over||!human()){if(unit){selection={type:'inspection',id:unit.id,x:h.x,y:h.y};render();}return;}
if(s.phase==='setup'){
 if(selection?.type==='setup-unit'){if(sharedOwnershipPilot){if(ownedAction({type:'setup-place',unitId:selection.id,x:h.x,y:h.y})){selection=null;render();}}else{saveUndo();if(E.setupPlace(c,s,selection.id,h.x,h.y)){selection=null;render();}else history.pop();}}
 else if(unit?.army==='german'){selection={type:'setup-unit',id:unit.id};render();}
 return;
}
if(s.phase==='combat'){if(unit&&unit.army!==s.side&&!combats.has(unit.id)){selection={type:'defender',id:unit.id,x:h.x,y:h.y};render();}return;}
if(!['movement','special'].includes(s.phase))return;let choices=options();if(selection?.type==='unit'&&choices.some(p=>p.x===h.x&&p.y===h.y)){let mode=s.phase==='movement'?'normal':s.side==='german'?'panzer':'rail';if(sharedOwnershipPilot){
   const moved=ownedAction({type:'move',unitId:selection.id,x:h.x,y:h.y,mode});
   if(moved){selection=null;render();}
  }else if(sharedMovementEnabled){
   const moved=sharedMovement({type:'move',unitId:selection.id,x:h.x,y:h.y,mode});
   if(moved){selection=null;render();}
  }else{saveUndo();if(E.move(c,s,selection.id,h.x,h.y,mode)){used.add(selection.id);selection=null;render();}}
  return;}
if(unit&&unit.army===s.side&&!used.has(unit.id)&&eligible().includes(unit)){selection={type:'unit',id:unit.id,x:h.x,y:h.y};render();}else{selection=null;render();}}
function prepareCurrentHumanBattle(){
 const a=s.combatQueue?.[s.combatIndex||0];
 if(!a){s.phase='movement';delete s.pendingBattle;delete s.combatQueue;delete s.declaredBattles;delete s.combatIndex;combatChoice=null;return;}
 s.pendingBattle={action:a,die:E.rollCombatDie(s)};
 combatChoice={attackerLossId:a.attackers[0],exchangeOrder:[...a.attackers].sort((x,y)=>{
  const ax=s.units.find(u=>u.id===x),by=s.units.find(u=>u.id===y);return E.strength(ax)-E.strength(by);
 }),retreatTo:null,advanceId:'none'};
}
function resolveCurrentHumanBattle(){
 if(!human()||s.phase!=='combat-resolution'||!s.pendingBattle)return;
 const a=s.pendingBattle.action,p=E.battlePreview(c,s,a,s.pendingBattle.die);
 if(!p)return alert('Combat is no longer legal in this position. Undo the previous step.');
 const options={advanceId:combatChoice.advanceId,avoidAdvanceIds:(s.combatQueue||[]).slice((s.combatIndex||0)+1).flatMap(q=>q.attackers)};
 if(p.outcome==='AL')options.attackerLossId=combatChoice.attackerLossId;
 if(p.outcome==='EX')options.exchangeOrder=[...combatChoice.exchangeOrder];
 if(!p.cityHold&&p.retreat.length&&['DR','DRL','EX'].includes(p.outcome)){
  const selected=p.retreat.find(r=>E.key(r.x,r.y)===(combatChoice.retreatTo||E.key(p.retreat[0].x,p.retreat[0].y)));
  if(selected)options.retreatTo={x:selected.x,y:selected.y};
 }
 if(sharedOwnershipPilot){
  // Consequence selections remain transient presentation state, as in B4M.
  // The committed die and queued battles are authoritative session state.
  if(!ownedAction({type:'resolve-pending',options})){alert('Invalid combat choice');return;}
  combatChoice=null;selection=null;used.clear();combats.clear();render();return;
 }
 saveUndo();
 try{const result=E.resolveAttack(c,s,a.attackers,a.defender,s.pendingBattle.die,options);
  if(!result)throw Error('Battle cannot resolve');
  s.combatIndex++;prepareCurrentHumanBattle();selection=null;used.clear();combats.clear();render();
 }catch(e){history.pop();alert('Invalid combat choice: '+e.message);}
}
function phaseAdvance(){
 if(!human()||busy||s.over)return;
 if(sharedOwnershipPilot&&['replacement','special','combat','movement','reinforcement'].includes(s.phase)){
  // The pilot covers phase transitions without active declarations only.
  // Combat resolution and other nonmigrated actions remain out of scope.
  // Shared session owns the declared queue, committed die, and action history.
  // The original (nonpilot) browser retains its Oberlabs event handlers.
  const advanced=ownedAction({type:'finish-phase'});
  if(!advanced){render();return;}
  selection=null;combats.clear();combatChoice=null;render();maybeAI();return;
 }
 if(s.phase==='combat-resolution'){resolveCurrentHumanBattle();return;}
 if(s.phase==='setup'){
  if(sharedOwnershipPilot){if(!ownedAction({type:'finish-setup'})){alert('All 22 designated German crosses must be occupied before continuing.');return;}}
  else{saveUndo();if(!E.finishSetup(c,s)){history.pop();alert('All 22 designated German crosses must be occupied before continuing.');return;}}
  selection=null;render();return;
 }
 if(s.phase==='reinforcement'&&E.shockReinforcementOptions(c,s).length&&
  !s.units.some(u=>u.type==='shock'&&u.position)){alert('Place the 1st Shock Army before continuing.');return;}
 saveUndo();selection=null;used.clear();combats.clear();s.replacementUsed=0;
 if(s.phase==='reinforcement')s.phase='replacement';
 else if(s.phase==='replacement')s.phase='special';
 else if(s.phase==='special')s.phase='combat';
 else if(s.phase==='combat'){
  if((s.declaredBattles||[]).length){s.combatQueue=s.declaredBattles.slice();s.combatIndex=0;s.phase='combat-resolution';prepareCurrentHumanBattle();}
  else s.phase='movement';
 }else if(s.phase==='movement'){
  E.endSide(c,s);if(s.side==='german'&&s.turn===1)s.phase='combat';
  if(s.side==='soviet'&&s.turn===4)s.phase='reinforcement';
 }
 render();maybeAI();
}
function aiStep(){if(s.over)return;if(s.side==='german'&&doctrine()==='assault-retention-v16'){const t=s.turn,active=t===2||t>=5;s=active?B4MAssaultRetentionV16.playSide(c,s,B.selectedPolicy(s,B.get('german',gOpening()))):B.play(c,s,gOpening(),sOpening());latest={policy:active?'assault-retention-v16':'openingbook',pv:[active?'assault-retention-v16':'openingbook'],score:0,stats:{nodes:1,prunes:0}};selection=null;used.clear();combats.clear();history.length=0;const a=B4MAssaultRetentionV16.retentionProjection(c,s);$('analysis').textContent=`German v1.6 · turn ${t} · retained capital ${a.held?'yes':'no'} · Soviet rail threat upper odds ${a.railThreatUpperOdds}`;render();return;}if(s.side==='german'&&doctrine()==='screen-breach-v15'){const t=s.turn,active=t===2||t>=5;s=active?B4MGermanAssaultV15.playSide(c,s,B.selectedPolicy(s,B.get('german',gOpening()))):B.play(c,s,gOpening(),sOpening());latest={policy:active?'screen-breach-v15':'openingbook',pv:[active?'screen-breach-v15':'openingbook'],score:0,stats:{nodes:1,prunes:0}};selection=null;used.clear();combats.clear();history.length=0;$('analysis').textContent=`German v1.5 screen breach · T${t} · ${active?'concentrated tactical planning':'original opening schedule'}`;render();return;}if(s.side==='german'&&doctrine()==='capital-assault'){
 const old=s,beginTurn=Number($('assaultBeginTurn').value)||5;
 s=B4MCapitalAssault.playFromOpening(c,s,gOpening(),sOpening(),{beginTurn});
 latest={policy:old.turn>=beginTurn?'capital-assault':B.selectedPolicy(old,B.get('german',gOpening())),pv:['capital-assault'],score:0,stats:{nodes:1,prunes:0}};
 selection=null;used.clear();combats.clear();history.length=0;
 const a=B4MCapitalAssault.combatSummary(c,s);
 $('analysis').textContent=`Capital planner · German turn ${old.turn} · Moscow ${a.moscowOwner} · garrison ${a.moscowGarrison||'none'} · ring screens ${a.screens.length}`;render();return;}
if(s.side==='soviet'&&$('sovietAI').value==='fortress-v14'){s=B4MSovietDefense.playSide(c,s);latest={policy:'fortress-v14',score:0,stats:{nodes:0,prunes:0},pv:['fortress-v14']};selection=null;used.clear();combats.clear();history.length=0;const m=B4MSovietDefense.screenMetrics(c,s);$('analysis').textContent=`Soviet defense v1.4 · garrison ${m.garrison||'none'} · ring ZOC ${m.ringZoc}/6`;render();return;}if(s.side==='german'&&doctrine()==='conditional-pivot'){const dec=B4MPivot.decide(c,s,$('pivotProfile').value);s=B4MPivot.play(c,s,'G2',sOpening(),$('pivotProfile').value);latest={policy:dec.policy,pv:[dec.policy],score:0,stats:{nodes:1,prunes:0}};selection=null;used.clear();combats.clear();history.length=0;$('analysis').textContent='Conditional pivot: '+dec.policy+' — '+dec.reason;render();return;}if((s.side==='german'&&doctrine()==='openingbook')||(s.side==='soviet'&&$('sovietAI').value==='openingbook')){let beforeSide=s.side;let p=$('allowDeviation').checked?B.deviation(c,s,gOpening(),sOpening()).policy:B.selectedPolicy(s,B.get(s.side,s.side==='german'?gOpening():sOpening()));s=$('allowDeviation').checked?B.playFlexible(c,s,gOpening(),sOpening()):B.play(c,s,gOpening(),sOpening());latest={policy:p,opening:beforeSide==='german'?gOpening():sOpening(),pv:[p],score:0,stats:{nodes:1,prunes:0}};selection=null;used.clear();combats.clear();history.length=0;$('analysis').textContent=`Opening book: ${p} · selected by preset (not adversarial-search optimized)`;render();return;}const n=s.side==='soviet'?($('sovietAI').value==='adversarial'?E.playSovietAdversarial(c,s,doctrine(),true):{state:E.playSide(c,s,'fortress'),decision:{policy:'fortress',score:0,pv:['fortress'],stats:{nodes:0,prunes:0}}}):doctrine()==='formation'?E.playAI(c,s,depth(),width(),false,'formation'):['adaptive','interdict','envelop','north-route'].includes(doctrine())&&s.side==='german'?{state:E.playSide(c,s,doctrine()),decision:{policy:doctrine(),score:0,pv:[doctrine()],stats:{nodes:0,prunes:0}}}:E.playAI(c,s,depth(),width(),doctrine()==='sweep','legacy');s=n.state;latest=n.decision;selection=null;used.clear();combats.clear();history.length=0;$('analysis').textContent=`${n.decision.pv.join(' → ')}\nScore: ${n.decision.score.toFixed(1)} · Search nodes: ${n.decision.stats.nodes} · Alpha–beta cutoffs: ${n.decision.stats.prunes}`;render();}
function maybeAI(){if(!human()&&!s.over&&!busy){setTimeout(()=>{busy=true;render();setTimeout(()=>{try{aiStep()}catch(e){console.error(e);alert(e.message)}finally{busy=false;render()}},20)},100);}}
function reset(){stackView.reset();if(busy)return;
 if(doctrine()==='conditional-pivot'&&$('germanOpening').value!=='G2'){$('germanOpening').value='G2';}
 const manual=mode()==='hotseat'||mode()==='german';
 const aiSetup=['sweep','formation','adaptive','interdict','envelop','north-route','openingbook','conditional-pivot','capital-assault','screen-breach-v15','assault-retention-v16'].includes(doctrine());
 s=E.makeState(c,Number($('seed').value)||1,manual||aiSetup?'manual':'automated');
 if(!manual&&aiSetup){if(['openingbook','conditional-pivot','capital-assault','screen-breach-v15','assault-retention-v16'].includes(doctrine()))s=B.setup(c,doctrine()==='conditional-pivot'?'G2':gOpening(),Number($('seed').value)||1,Number($('deploymentSeed').value)||0);else E.autoSetup(c,s,'sweep');}
 ownedSession=null;selection=null;combatChoice=null;used.clear();combats.clear();history=[];latest=null;
 $('analysis').textContent='No search run yet';$('batchOut').textContent='';render();
 if(mode()!=='hotseat'&&mode()!=='both'&&!human())maybeAI();
}
// Worker-driven simulation: workers yield after each full side turn, preserving
// a responsive board and allowing termination/checkpointing without server access.
let worker=null,workerJob=null,workerWatchdog=null,lastWorkerProgress=0;let pivotResults=[],assaultResults=[],defenseResults=[];
function startWorker(task){
 if(busy)return;
 if(typeof Worker==='undefined'){$('batchOut').textContent='Web Workers are unavailable. Serve this folder with python3 serve.py, then reload.';return;}
 busy=true;stopping=false;workerJob=task;lastWorkerProgress=Date.now();
 try{worker=new Worker('simulation-worker.js');}catch(e){busy=false;$('batchOut').textContent='Worker unavailable: '+e.message+' — run python3 serve.py and open http://localhost:8765/';render();return;}
 worker.onmessage=(ev)=>{
  lastWorkerProgress=Date.now();const d=ev.data;
  if(d.type==='defense-progress'){$('defenseOut').textContent=d.message;return;}
  if(d.type==='defense-row'){defenseResults.push(d.row);$('defenseOut').textContent=`${defenseResults.length} completed defense comparisons · last ${d.row.variant}, seed ${d.row.seed}: ${d.row.winner||d.row.status}`;return;}
  if(d.type==='capital-progress'){$('assaultOut').textContent=d.message;return;}
  if(d.type==='capital-row'){assaultResults.push(d.row);$('assaultOut').textContent=`${assaultResults.length} completed capital comparisons · last ${d.row.variant}, seed ${d.row.seed}: ${d.row.winner||d.row.status}`;return;}
  if(d.type==='pivot-progress'){$('pivotOut').textContent=d.message;return;}
  if(d.type==='pivot-row'){pivotResults.push(d.result);$('pivotOut').textContent=`${pivotResults.length} completed pivot comparisons · last: ${d.result.profile} ${d.result.seed} ${d.result.winner||'incomplete'}`;return;}
  if(d.type==='postmortem-progress'){$('postmortemOut').textContent=d.message;return;}
  if(d.type==='recommend-row'){$('matrixStatus').textContent=`Family opening preview ${d.completed}/64: ${d.pair}`;return;}
  if(d.type==='stage-row'){stageResults.push(d.result);$('stageStatus').textContent=`${stageResults.length} end-of-turn-2 positions computed · latest ${d.result.germanId}/${d.result.sovietId}: ${d.result.deniedEasternEntry}/17 eastern entry hexes denied`;return;}
  if(d.type==='matrix-row'){matrixResults.push(d.result);$('matrixStatus').textContent=`Completed ${matrixResults.length} matrix matches · last: ${d.result.germanId}/${d.result.sovietId} · ${d.result.winner||d.result.status}`;renderOpeningGrid();return;}
  if(d.type==='progress'){
   if(d.state&&task.kind==='single'){
    s=d.state;ownedSession=null;selection=null;used.clear();combats.clear();history=[];render();
   }
   $('batchOut').textContent=d.message;
  } else if(d.type==='completed'){
   if(d.state&&task.kind==='single')s=d.state;
   if(task.kind==='matrix'){$('matrixStatus').textContent=d.message;renderOpeningGrid();}
   if(task.kind==='stage')$('stageStatus').textContent=d.message;
   if(task.kind==='recommend'&&d.results?.recommended){$('germanOpening').value=d.results.recommended.germanId;$('matrixStatus').textContent=`2-side-turn maximin recommends ${d.results.recommended.germanId} vs worst reply ${d.results.recommended.worstResponse}; static score ${d.results.recommended.worstScore.toFixed(1)}. This is not a calibrated win probability.`;renderOpeningGrid();}
   if(task.kind==='defense-paired')$('defenseOut').textContent=JSON.stringify(d.results,null,2);
   if(task.kind==='capital-paired')$('assaultOut').textContent=JSON.stringify(d.results,null,2);
   if(task.kind==='pivot-compare'||task.kind==='pivot-probe')$('pivotOut').textContent=JSON.stringify(d.results,null,2);
   if(task.kind==='postmortem')$('postmortemOut').textContent=JSON.stringify(d.results,null,2);
   latest=d.results||null;
   $('batchOut').textContent=d.message;
   if(d.results) $('analysis').textContent=JSON.stringify(d.results,null,2);
   finishWorker();
  } else if(d.type==='failed'){
   $('batchOut').textContent='Worker failed: '+d.message;finishWorker();
  }
 };
 worker.onerror=ev=>{ $('batchOut').textContent='Worker error: '+ev.message+' (for file:// use python3 serve.py)';finishWorker(); };
 workerWatchdog=setInterval(()=>{if(worker&&Date.now()-lastWorkerProgress>(task.kind==='postmortem'?135000:task.kind==='pivot-probe'?90000:35000)){$('batchOut').textContent='Search aborted: one side-turn exceeded 35 seconds. Completed matrix results remain downloadable. Lower search depth or plans/ply.';finishWorker();}},1000);
 worker.postMessage({...task,germanOpening:gOpening(),sovietOpening:sOpening(),adaptiveBook:$('allowDeviation').checked,postmortemTrials:Number($('postmortemTrials').value)||1,pairedDice:$('pairedDice').checked,cmd:'start',scenario:conf,profile:profiles.profiles[profiles.defaultRuleset],depth:depth(),width:width(),doctrine:doctrine(),pivotProfile:$('pivotProfile').value,assaultBeginTurn:Number($('assaultBeginTurn').value)||5,seed:Number($('seed').value)||1,deploymentSeed:Number($('deploymentSeed').value)||0, state:task.kind==='single'?s:null,sovietAI:$('sovietAI').value,maxMatchMs:144000});render();
}
function finishWorker(){if(workerWatchdog){clearInterval(workerWatchdog);workerWatchdog=null;}if(worker){worker.terminate();worker=null;}busy=false;workerJob=null;stopping=false;render();}
function autoPlay(){if(s.over)return;startWorker({kind:'single'});}
function batch(){startWorker({kind:'batch',count:4});}
function matrix(){matrixResults=[];renderOpeningGrid();startWorker({kind:'matrix',scope:$('matrixScope').value,seedsEach:Number($('matrixSeeds').value)||1});}
function stage(){stageResults=[];startWorker({kind:'stage',scope:$('matrixScope').value});}
function download(name,obj){let blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
for(const which of ['two','three'])$('stack-example-'+which)?.addEventListener('click',e=>clickStackExample(which,e.shiftKey));
$('board').addEventListener('click',handleBoardClick);$('new').onclick=reset;$('phase').onclick=phaseAdvance;$('nextAI').onclick=()=>{if(busy||s.over)return;busy=true;render();setTimeout(()=>{try{aiStep()}finally{busy=false;render()}},20)};$('auto').onclick=autoPlay;$('stop').onclick=()=>{stopping=true;if(worker){$('batchOut').textContent='Stopped; latest completed side-turn remains on the board.';finishWorker();}};$('batch').onclick=batch;$('runMatrix').onclick=matrix;$('runStage').onclick=stage;$('downloadStage').onclick=()=>download('b4m-turn2-opening-positions.json',{version:12,canonicalRules:profiles.defaultRuleset,scope:$('matrixScope').value,combatSeed:Number($('seed').value)||1,deploymentSeed:Number($('deploymentSeed').value)||0,results:stageResults});$('recommendOpening').onclick=()=>startWorker({kind:'recommend'});$('downloadMatrix').onclick=()=>download('b4m-opening-matrix.json',{version:12,canonicalRules:profiles.defaultRuleset,deploymentSeed:Number($('deploymentSeed').value)||0,german:B.data.german,soviet:B.data.soviet,results:matrixResults});$('undo').onclick=()=>{if(sharedOwnershipPilot&&ownedSession){if(busy||!ownedUndo())return;selection=null;combats.clear();combatChoice=null;render();return;}if(!history.length||busy)return;s=JSON.parse(history.pop());selection=null;used.clear();combats.clear();combatChoice=null;if(s.pendingBattle){const a=s.pendingBattle.action;combatChoice={attackerLossId:a.attackers[0],exchangeOrder:[...a.attackers],retreatTo:null,advanceId:'none'};}render();};$('export').onclick=()=>{
 if(sharedOwnershipPilot){
  // Starting the ownership session here is safe only at a clean history boundary.
  if(!ownedSession){if(history.length)throw Error('Cannot export mixed legacy history through shared session');ownedSession=window.WargameSession.create({scenarioId:'battle-for-moscow',config:c,state:s,usedUnitIds:[...used]});}
  download('moscow-session-v2.json',window.WargameSession.serialize(ownedSession));
 }else download('moscow-save.json',{version:1,state:s,scenario:conf,ruleset:profiles.defaultRuleset});
};$('import').onclick=()=>$('file').click();$('file').onchange=async ev=>{try{
 const data=JSON.parse(await ev.target.files[0].text());
 // Validate the entire incoming session before modifying live board/UI state.
 let incoming=null,next=null;
 if(sharedOwnershipPilot&&data.format==='wargame-session'){
  incoming=window.WargameSession.restore(data,{scenarioId:'battle-for-moscow',config:c});next=incoming.state;
 }else if(data.version===1&&data.state){
  E.validate(c,data.state);next=data.state;
  if(sharedOwnershipPilot)incoming=window.WargameSession.create({scenarioId:'battle-for-moscow',config:c,state:next});
 }else throw Error('Unrecognized or incompatible save');
 if(!sharedOwnershipPilot&&data.format==='wargame-session')throw Error('Session v2 requires shared-session mode');
 s=next;ownedSession=incoming;selection=null;combatChoice=null;used=new Set(incoming?.usedUnitIds||[]);combats.clear();history=[];
 syncOwnedCombatMarkers();render();
 }catch(e){alert('Cannot import: '+e.message);}ev.target.value='';};$('mode').onchange=reset;$('doctrine').onchange=reset;$('sovietAI').onchange=reset;$('germanOpening').onchange=reset;$('sovietOpening').onchange=reset;function setZoom(){const w=Math.round(1600*zoom);canvas.style.width=w+'px';$('mapCanvasStack').style.width=w+'px';$('mapCanvasStack').style.height=(1139*w/1600)+'px';$('zoomval').textContent=Math.round(zoom*100)+'%';} $('plus').onclick=()=>{zoom=Math.min(1.5,zoom+.125);setZoom()};$('minus').onclick=()=>{zoom=Math.max(.35,zoom-.125);setZoom()};
function renderLog(){let logs=s.log.slice(-26).reverse();$('log').innerHTML=logs.map(ev=>{let detail=ev.type==='shock-reinforcement'?`1st Shock Army arrives at (${ev.at.x+1},${ev.at.y+1})`:ev.type==='combat-declaration'?`${ev.battles.length} battles announced`:ev.type==='combat'?`${ev.defender} ${ev.odds}:1 → ${ev.outcome} (die ${ev.die})`:ev.type==='move'?`${ev.unit}: (${ev.from.x+1},${ev.from.y+1}) → (${ev.to.x+1},${ev.to.y+1})`:ev.type==='replacement'?`${ev.action} ${ev.unit}`:ev.type==='decision'?`AI ${ev.pv.join(' → ')} (${ev.stats.nodes} nodes)`:ev.message||ev.policy||ev.type;return `<div><b>T${ev.t} ${ev.side==='german'?'GE':'SU'}</b> ${detail}</div>`}).join('');}
$('defenseCompare').onclick=()=>{if(!busy){defenseResults=[];startWorker({kind:'defense-paired',seedsEach:Number($('assaultSeeds').value)||1});}};
$('downloadDefense').onclick=()=>download('b4m-soviet-defense-paired-v14.json',{version:'1.4',ruleset:profiles.defaultRuleset,germanOpening:gOpening(),sovietOpening:sOpening(),results:defenseResults});
$('assaultCompare').onclick=()=>{if(!busy){assaultResults=[];startWorker({kind:'capital-paired',seedsEach:Number($('assaultSeeds').value)||1});}};
$('downloadAssault').onclick=()=>download('b4m-capital-assault-paired.json',{version:'1.3',ruleset:profiles.defaultRuleset,germanOpening:gOpening(),sovietOpening:sOpening(),results:assaultResults});
$('pivotProbe').onclick=()=>{if(!busy){if(s.side!=='german'||!['replacement','combat'].includes(s.phase)||s.pendingBattle){$('pivotOut').textContent='Select a German-to-move position at the beginning of its side-turn (before manual actions).';return;}startWorker({kind:'pivot-probe'});}};
$('pivotCompare').onclick=()=>{if(!busy){pivotResults=[];startWorker({kind:'pivot-compare',seedsEach:2});}};
$('downloadPivot').onclick=()=>download('b4m-pivot-comparisons.json',{version:'1.1',ruleset:profiles.defaultRuleset,results:pivotResults});
$('postmortem').onclick=()=>{if(!busy)startWorker({kind:'postmortem',forkTurn:Number($('forkTurn').value)||6});};
$('learnFromResults').onclick=()=>{const data=[...B4M_PILOT_RESULTS,...matrixResults],m=L.train(data,{prior:2,risk:.65}),cv=L.crossValidateBySeed(data,{prior:2,risk:.65});outcomeModel=m;const pct=n=>n===null?'n/a':(100*n).toFixed(1)+'%';$('learningOut').textContent=[`Completed observations: ${m.games}; distinct seeds: ${m.distinctSeeds.length}`,`Smoothed robust candidate: ${m.recommended} (not a verified improvement)`,`Seed-held-out average payoff — learned global: ${pct(cv.globalMeanPayoff)}, opponent-conditional: ${pct(cv.conditionalMeanPayoff)}, fixed G2: ${pct(cv.fixedG2MeanPayoff)}.`,`Training rank: ${m.ranking.map(r=>r.germanId+' '+r.score.toFixed(3)).join(', ')}`,m.warning,cv.warning].join('\n');};
$('useLearnedOpening').onclick=()=>{if(!outcomeModel){$('learnFromResults').click();}if(outcomeModel){$('germanOpening').value=outcomeModel.recommended;reset();showOpenings();renderOpeningGrid();$('matrixStatus').textContent=`Selected ${outcomeModel.recommended} based on exploratory smoothed results, NOT an established stronger strategy.`;}};
$('counterfactual').onclick=()=>{$('counterfactualOut').textContent=JSON.stringify({crt:E.crtThresholdAudit(c,s).slice(0,12),singlePointCRTChanges:E.onePointSensitivity(c,s).slice(0,18),plans:E.comparePlans(c,s).map(x=>({policy:x.policy,score:+x.score.toFixed(1),battles:x.battles,edgeDenied:x.edge.germanDenied}))},null,2);};

function renderOpeningGrid(){const el=$('openingGrid');el.innerHTML='';for(const g of B.data.german.filter(g=>$('matrixScope').value==='all'||g.variant===0))for(const sv of B.data.soviet){const b=document.createElement('button'),rows=matrixResults.filter(r=>r.germanId===g.id&&r.sovietId===sv.id&&r.complete);const gw=rows.filter(r=>r.winner==='german').length;b.textContent=`${g.id}/${sv.id}${rows.length?' '+gw+'/'+rows.length:''}`;b.title=`${g.name} vs ${sv.name} · ${rows.length} complete, ${gw} German victories`;b.className=(g.id===gOpening()&&sv.id===sOpening()?'chosen ':'')+(rows.length?'complete':'');b.onclick=()=>{$('germanOpening').value=g.id;$('sovietOpening').value=sv.id;reset();renderOpeningGrid();};el.append(b);}}
for(const [side,id] of [['german','germanOpening'],['soviet','sovietOpening']])for(const o of B.data[side]){const opt=document.createElement('option');opt.value=o.id;opt.textContent=o.id+' — '+o.name;$(id).append(opt);}
$('germanOpening').value='G2';$('sovietOpening').value='S2';$('matrixScope').onchange=renderOpeningGrid;
function showOpenings(){let g=B.get('german',gOpening()),so=B.get('soviet',sOpening());$('openingDescription').textContent=`${g.id}: ${g.focus}. ${so.id}: ${so.focus}. Soviet initial hexes unchanged.`;}
for(const id of ['germanOpening','sovietOpening'])$(id).addEventListener('change',()=>{showOpenings();renderOpeningGrid();});
$('applyPreset').onclick=()=>{if(s.phase!=='setup'||s.side!=='german'){ $('matrixStatus').textContent='To apply a preset, select Human Germany and start a new game first.';return;}let preset=B.setup(c,gOpening(),Number($('seed').value)||1,Number($('deploymentSeed').value)||0);saveUndo();s=preset;selection=null;render();};
$('previewOpening').onclick=()=>{try{const r=B.previewPair(c,Number($('seed').value)||1,gOpening(),sOpening(),Number($('deploymentSeed').value)||0);$('matrixStatus').textContent=`After opening two side-turns: ${gOpening()} vs ${sOpening()} | German evaluation ${r.score.toFixed(1)} | Moscow ${r.moscow} | Soviet garrison ${r.sovietGarrison}`;}catch(err){$('matrixStatus').textContent=err.message;}};
// Display-only names are raster-transcribed annotations, never scenario rules.
fetch('data/oberlabs_city_labels.json').then(r=>r.ok?r.json():null)
 .then(data=>{if(data?.labels){cityLabels=data.labels;rebuildVectorTerrain();}})
 .catch(()=>{});
showOpenings();renderOpeningGrid();setZoom();rebuildVectorTerrain();reset();})();

