(function(){
'use strict';const E=window.WargameCore,$=id=>document.getElementById(id);let game=null,state=null,chosen=[],highlights=[],setupMode=false,inspectedUnit=null;const stackView=WargameStackView.create();let supportWindow=null;
const center=(x,y)=>window.WargamePresentation.genericCenter(x,y),ns='http://www.w3.org/2000/svg';
function node(tag,attrs={},text=null){const n=document.createElementNS(ns,tag);if(tag==='text')n.setAttribute('pointer-events','none');for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n;}
function show(text){$('selection').textContent=text;}
function factionColor(side){return game?.game.factions.find(f=>f.id===side)?.color||(['#2363ac','#b44643'][game.game.factions.findIndex(f=>f.id===side)]||'#64748b');}
async function loadGame(directory){try{
 const folder='games/'+directory+'/';const response=await fetch(folder+'game.json');if(!response.ok)throw Error('Missing game.json');const meta=await response.json();
 if(meta.browserEntry){window.location.assign(folder+meta.browserEntry);return;}
 const p={game:meta};for(const [key,filename] of Object.entries({map:meta.boardFile,units:meta.unitsFile,deployments:meta.deploymentsFile,rules:meta.rulesFile,objectives:meta.objectivesFile})){const resp=await fetch(folder+filename);if(!resp.ok)throw Error('Cannot load '+filename);p[key]=await resp.json();}
 game=E.build(p);state=E.start(game,7041);stackView.reset();
 if(!supportWindow&&window.WargameSupportWindow&&(p.rules.specialRules||[]).some(r=>r.module==='air-support-v1')) supportWindow=window.WargameSupportWindow.mount({scenario:'generic-browser',onAction:action=>{
  if(!state||!game||action?.type!=='commit-ground-air')return;
  const next=state.declarations?.[0];if(!next)return;
  const allowed=action.faceId===null||E.availableAirSupport(game,state,next.defender).some(a=>a.id===action.faceId);
  if(!allowed)return show('Air support is not legal in this battle.');
  const ok=E.assignAirSupport(game,state,action.faceId||'none',next.defender);
  show(ok?(action.faceId?`Air support ${action.faceId} assigned before rolling.`:'No air support assigned.'):'Air support allocation is not legal.');render();
 }});
inspectedUnit=null;chosen=[];highlights=[];setupMode=false;$('workspace').hidden=false;$('scenario-name').textContent=meta.title;
 document.querySelectorAll('.game-card').forEach(b=>b.classList.toggle('active',b.dataset.directory===directory));$('modules').replaceChildren();for(const item of [`Hex movement: ${p.map.topology}`,`CRT: odds table (${Object.keys(p.rules.combat.table).length} columns)`,`Victory: ${p.objectives.victory.mode}`,`Weather: ${p.rules.weather.length} schedule(s)`,...p.rules.specialRules.map(s=>s.module)]){const t=document.createElement('span');t.className='chip';t.textContent=item;$('modules').append(t);}
 show('Select a friendly counter to begin.');render();
 }catch(err){$('workspace').hidden=false;show('Unable to load game package: '+err.message);console.error(err);}}
function clearSelection(){chosen=[];highlights=[];inspectedUnit=null;}
function clickHex(x,y,shift=false,clickedId=null){
 const pieces=E.unitsAt(state,x,y).filter(u=>!E.support(u));
 const stacked=pieces.length>1;
 // Visual stack ordering is independent of side, turn, and combat legality.
 if(shift&&stacked){const raised=stackView.swapTopBottom(pieces,{x,y});inspectedUnit=raised.id;
  show(`Stack order swapped at ${x},${y}. Top: ${raised.id}.`);render();return;}
 const unit=stackView.top(pieces,{x,y})||null;
 if(unit)inspectedUnit=unit.id;
 if(state.over){if(unit){show(`Top counter: ${unit.id} (game over).`);render();}return;}
 const phase=E.currentPhase(game,state),ph=phase.kind;
 if(!setupMode&&ph==='move'&&chosen.length&&!clickedId&&E.legalMoves(game,state,chosen[0]).some(v=>v.x===x&&v.y===y)){
  const id=chosen[0];if(E.move(game,state,id,x,y)){show(`${id} moved to ${x},${y}.`);clearSelection();render();return;}
 }
 if(setupMode){
  if(chosen.length){const id=chosen[0];if(E.relocateSetup(game,state,id,x,y)){show(`${id} placed at ${x},${y}.`);clearSelection();}else if(unit&&unit.id===id){clearSelection();show('Setup selection cleared.');}else show('Illegal setup placement or swap.');}
  else if(unit){chosen=[unit.id];highlights=E.legalSetupPositions(game,state,unit.id);show(`${unit.id}: ${highlights.length} legal setup locations (occupied friendly spaces swap).`);}
  else show('Select a counter to set up.');render();return;
 }
 if(ph==='combat'&&phase.declarationMode==='simultaneous'&&state.declarationLocked){show('Declarations locked. Resolve the selected battles using the controls.');return;}
 if(unit&&E.unitSide(unit)===state.side&&!E.support(unit)){if(ph==='move'){chosen=[unit.id];highlights=E.legalMoves(game,state,unit.id);show(`${unit.id} · ${unit.type} · CF ${E.visibleCounter(unit).combat} · ${highlights.length} legal destinations`);}
 else if(ph==='combat'&&!E.support(unit)){const i=chosen.indexOf(unit.id);if(shift){if(i>=0)chosen.splice(i,1);else chosen.push(unit.id);}else chosen=[unit.id];highlights=[];show(`Attackers: ${chosen.join(', ')}. Select an adjacent enemy counter.`);}render();return;}
 if(!chosen.length){if(unit){show(`Top counter: ${unit.id} · ${unit.type}. Not selectable for orders in this phase.`);render();}else show('Select a friendly counter first.');return;}
 if(ph==='move'&&(!unit||E.unitSide(unit)===state.side)){const id=chosen[0];if(E.move(game,state,id,x,y)){show(`${id} moved to ${x},${y}.`);clearSelection();}else show('That is not a legal destination.');}
 else if(ph==='combat'&&unit&&E.unitSide(unit)!==state.side){const odds=E.combatOdds(game,state,chosen,unit.id);
  if(phase.declarationMode==='simultaneous'){
   const ok=E.declareCombat(game,state,chosen,unit.id);
   show(ok?`Battle declared against ${odds?.defenderIds?.join(' + ')||unit.id}${odds?` at ${odds.odds}:1`:' (untried strength to be revealed)'}. Commit remaining battles before locking.`:
     'Cannot declare that battle: check adjacency, participant commitments, hexside limit or stacking module.');
  }else{
   const rec=E.combat(game,state,chosen,unit.id);
   show(rec?`Attack ${rec.odds}:1 · ${rec.roll==null?'no die':`d6=${rec.roll}`} · ${rec.result}`:
     'No legal attack at positive odds, or it was already committed.');
  }
  clearSelection();}
 render();}
function render(){if(!game||!state)return;
 const svg=$('board');svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${100+game.map.width*63} ${110+game.map.height*71}`);
 // One renderer for every configurable game: no alternate generated/manual hex map.
 {
  const tileBoard=WargameTerrainAdapter.nativeBoard(game,center,{artworkSource:'supplied'}),theme='kiev';
  const tex=WargamePresentation.textures();
  const width=100+game.map.width*63,height=110+game.map.height*71;
  // Presentation assets never enter the rules engine or influence movement/CRT.
  const markup=HexTerrainTiles.svgMap(tileBoard,WargamePresentation.options('generic',{id:game.game.id+'-shared',theme,textures:tex,width,height,rx:42,ry:42,tileOpacity:1,tileFit:'stretch',showGrid:$('terrain-grid-toggle')?.checked===true,showNumbers:$('terrain-number-toggle')?.checked===true}));
  const parsed=new DOMParser().parseFromString(markup,'image/svg+xml');
  for(const child of Array.from(parsed.documentElement.children))svg.append(document.importNode(child,true));
  for(const hex of svg.querySelectorAll('[data-hex-id]')){
    const p=hex.querySelector('[data-interaction="hex-body"]'),id=hex.getAttribute('data-hex-id');
    const h=tileBoard.cells.find(c=>c.id===id),x=h.sourceRef.x,y=h.sourceRef.y;
    if(highlights.some(v=>v.x===x&&v.y===y)){p.setAttribute('stroke','#c9a334');p.setAttribute('stroke-width','2.5');}
    hex.addEventListener('click',ev=>{if(!ev.target.closest('[data-interaction="hex-body"]'))return;clickHex(x,y,ev.shiftKey);});
    const owner=state.control[`${x},${y}`];if(owner&&game.map.cells.find(c=>c.x===x&&c.y===y)?.city!=='none'){
      const c=center(x,y);svg.append(node('circle',{cx:c.x+22,cy:c.y-19,r:4,fill:factionColor(owner)}));
    }
  }
 }

 // Common counter component, placed below topmost city labels (layer 16).
 const counters=stackView.orderUnits(state.units.filter(u=>u.position&&u.strength!=='dead'&&!E.support(u))).map(u=>({
  ...u, army:E.unitSide(u),counter:u.counter||{},
  // Unit strength and the damage state come directly from game state, not CSS.
  combatFull:u.combatFull??u.full,combatReduced:u.combatReduced??u.reduced
 }));
 const genericCounterSize=WargameCounterVisuals.sizeForHexHeight(42*Math.sqrt(3));
 const tmp=document.createElementNS(ns,'svg');tmp.innerHTML=WargameCounterVisuals.layer(counters,p=>center(p.x,p.y),factionColor,{width:genericCounterSize,height:genericCounterSize,stackOffsetX:genericCounterSize*(7/44),stackOffsetY:genericCounterSize*(6/44),selectedIds:[...chosen,inspectedUnit].filter(Boolean)});
 const counterNode=tmp.querySelector('[data-layer="unit-counters"]');
 const labelLayer=svg.querySelector('[data-layer="city-labels"]');
 if(counterNode){svg.insertBefore(counterNode,labelLayer||null);
  for(const el of counterNode.querySelectorAll('[data-unit-id]')){
   const uid=el.dataset.unitId,u=state.units.find(u=>u.id===uid);
   el.style.cursor='pointer';el.addEventListener('click',event=>{if(!event.target.closest('[data-interaction="counter-body"]'))return;event.stopPropagation();clickHex(u.position.x,u.position.y,event.shiftKey,uid)});
  }
 }
 // Support counters use the same official vector templates as ground units.
 // They do not occupy a combat stacking slot, and do not become a ground target.
 for(const u of state.units.filter(u=>u.position&&u.strength!=='dead'&&E.support(u))){
  const c=center(u.position.x,u.position.y),fg=factionColor(E.unitSide(u));
  const template=u.counter?.template||'air';
  const marker=document.createElementNS(ns,'g');marker.innerHTML=WargameCounterVisuals.piece({
   ...u,counter:{...(u.counter||{}),template},army:E.unitSide(u)
  },c.x-14,c.y+18,fg,{width:25,height:25});
  const sprite=marker.querySelector('.official-counter');
  if(sprite){sprite.style.pointerEvents='none';svg.append(sprite);}
 }
 // Air markers are displayed as a temporary battle overlay. They are not ground
 // occupants and must not trigger the enemy-faction stacking prohibition.
 for(const declaration of state.declarations||[]){if(!declaration.airSupportId||!declaration.hex)continue;
  const c=center(declaration.hex.x,declaration.hex.y);
  svg.append(node('rect',{x:c.x+12,y:c.y-39,width:47,height:17,rx:3,fill:'#6d5420',stroke:'#fff','stroke-width':1}));
  svg.append(node('text',{x:c.x+35,y:c.y-27,class:'counter-sub'},declaration.airSupportId));
 }
 const p=E.currentPhase(game,state);$('phase-status').textContent=state.over?`Finished: ${state.winner.toUpperCase()}`:`Turn ${state.turn} · ${state.side.toUpperCase()} · ${p.id.toUpperCase()}`;
 const setupAvailable=!!game.deployments?.placementTags&&state.turn===1&&state.ply===0&&state.phaseIndex===Math.max(0,E.phasesFor(game,state.side).findIndex(p=>p.id===game.rules.initialPhaseId))&&!state.log.some(e=>['move','combat','replacement'].includes(e.type));
 $('setup-toggle').hidden=!setupAvailable;$('setup-toggle').textContent=setupMode?'Finish setup':'Edit initial deployment';if(!setupAvailable)setupMode=false;
 const replacement=p?.kind==='replacement'&&!state.over;const rp=$('replacement-panel');rp.hidden=!replacement;
 if(replacement){const old=$('replacement-choice').value,options=E.replacementOptions(game,state);$('replacement-choice').replaceChildren();
  for(const a of options){const opt=document.createElement('option');opt.value=JSON.stringify(a);opt.textContent=a.type==='restore'?`Restore ${a.id}`:`Enter ${a.id} at (${a.x},${a.y})`;$('replacement-choice').append(opt);}
  if(options.some(a=>JSON.stringify(a)===old))$('replacement-choice').value=old;
  $('apply-replacement').disabled=!options.length;
 }
 const simultaneous=p?.kind==='combat'&&p.declarationMode==='simultaneous'&&!state.over;
 $('combat-controls').hidden=!simultaneous;
 if(supportWindow){
  const rule=(game.rules.specialRules||[]).find(r=>r.module==='air-support-v1');
  supportWindow.setAvailable(!!rule);
  if(rule){
   const battle=simultaneous&&state.declarationLocked&&state.pendingRoll===null?state.declarations[0]:null;
   const available=battle?E.availableAirSupport(game,state,battle.defender):[];
   const availableById=new Map(available.map(a=>[a.id,a]));
   const markers=rule.markers.map(id=>{
    const unit=state.units.find(u=>u.id===id),used=!!state.airUsed?.[`${state.turn}:${id}`];
    const assigned=state.declarations.some(d=>d.airSupportId===id);
    return {id,label:id,shift:unit?.airShift||0,status:used||assigned?'committed':'available',
     statusLabel:used?'Committed':assigned?'Assigned':'Ready',
     note:used?'Used this turn':assigned?'Assigned to current battle':battle?'Eligible only while choosing support':'Waiting for combat',
     action:availableById.has(id)?{type:'commit-ground-air',faceId:id}:null};
   });
   supportWindow.update({turn:state.turn,owner:rule.side,phase:p?.kind||'—',markers,pending:!!battle,
    noSupportAction:battle?{type:'commit-ground-air',faceId:null}:null});
  }
 }

 if(simultaneous){
  const n=state.declarations.length;
  $('declaration-status').textContent=`${n} pending battle(s) · ${state.declarationLocked?'Locked':'Declare all battles before resolution'}`;
  // Source-neutral floating Support Window owns the presentation; the engine owns eligibility.
  const preview=state.pendingRoll!==null?E.previewNextDeclaration(game,state,state.pendingRoll):null;
  $('combat-choices').hidden=!preview;
  $('combat-command').textContent=!state.declarationLocked?'Lock declarations':!preview?'Roll / reveal next battle':'Resolve selected choices';
  $('combat-command').disabled=state.declarationLocked&&!n;
  $('clear-declarations').hidden=state.declarationLocked;
  if(preview){
   $('declaration-status').textContent=`${n} battle(s): ${(preview.defenders||[preview.defender]).join(' + ')} · ${preview.odds}:1 · ${preview.roll==null?'No die':`d6=${preview.roll}`} → ${preview.outcome}`;
   const select=(id,opts)=>{const el=$(id),old=el.value;el.replaceChildren();for(const [value,text] of opts){const o=document.createElement('option');o.value=value;o.textContent=text;el.append(o);}if(opts.some(([value])=>value===old))el.value=old;};
   select('loss-choice',[['auto','Automatic'],...preview.attackers.map(id=>[id,id])]);
   select('retreat-choice',[['auto','Automatic'],...preview.retreat.map(r=>[`${r.x},${r.y}`,`(${r.x},${r.y}) — ZOC cost ${r.cost}`])]);
   select('advance-choice',[['auto','Automatic'],['none','Decline advance'],...preview.attackers.map(id=>[id,id])]);
   $('loss-choice').disabled=preview.outcome!=='AL';$('exchange-choice').disabled=preview.outcome!=='EX';$('retreat-choice').disabled=!preview.retreat.length;
   const grouped=(preview.defenders||[]).length>1,stackUI=$('stacked-choices');stackUI.hidden=!grouped;
   const custom=$('stacked-retreat-controls');custom.replaceChildren();
   if(grouped){
    select('defender-loss-choice',[['auto','Automatic'],...(preview.defenderLossOptions||[]).map(id=>[id,id])]);
    $('defender-loss-choice').disabled=!['DRL','EX'].includes(preview.outcome);
    if(['DR','DRL','EX'].includes(preview.outcome))for(const id of preview.defenders){
     const label=document.createElement('label');label.textContent=`${id} retreat destination`;
     const select=document.createElement('select');select.className='group-retreat-choice';select.dataset.unit=id;
     for(const item of [['auto','Automatic'],...(preview.retreatByDefender?.[id]||[]).map(r=>[`${r.x},${r.y}`,`(${r.x},${r.y}) — ZOC cost ${r.cost}`])]){
      const opt=document.createElement('option');opt.value=item[0];opt.textContent=item[1];select.append(opt);
     }custom.append(label,select);
    }
   }

  }
 }

 $('weather-status').textContent=state.over?'Final score recorded':E.weather(game,state)?`Weather: ${E.weather(game,state).name}`:'Weather: clear';
 const pts=E.score(game,state);$('score-box').replaceChildren();for(const f of game.game.factions){const d=document.createElement('div');const label=document.createElement('span'),b=document.createElement('b');label.textContent=f.name.toUpperCase();b.textContent=(pts[f.id]||0)+' VP';d.style.borderTop='3px solid '+factionColor(f.id);d.append(label,b);$('score-box').append(d);}$('end-phase').disabled=state.over||(p?.declarationMode==='simultaneous'&&state.declarations.length>0);$('auto-side').disabled=state.over;
 $('log').replaceChildren();for(const e of state.log.slice(-65).reverse()){const div=document.createElement('div');div.textContent=`T${e.turn||'?'} ${e.side||''}: ${e.type}${e.unit?' '+e.unit:''}${e.result?' '+e.result:''}${e.winner?' '+e.winner:''}`;$('log').append(div);}
}
function autoSide(){
 if(!state||state.over)return;
 try{const report=window.WargameAI.playSide(E,game,state);clearSelection();show(`Auto-play ${report.side}: ${report.phases} phases, ${report.moves} moves, ${report.combats} attacks, ${report.replacements} replacements. Baseline heuristic, not a competitive AI.`);render();}
 catch(e){show('AI error: '+e.message);console.error(e);render();}
}
async function loadCatalog(){try{const res=await fetch('games/catalog.json');if(!res.ok)throw Error('Missing catalog');const catalog=await res.json();const area=$('game-catalog');area.replaceChildren();for(const item of catalog.games){const link=typeof item.entryPath==='string'&&item.entryPath.length>0;const b=document.createElement(link?'a':'button');if(link)b.setAttribute('href',item.entryPath);b.className='game-card';b.dataset.directory=item.directory;for(const [cls,content] of [['card-overline',item.type==='historical'?'HISTORICAL · SHARED ENGINE':'GENERIC RULES ENGINE'],['game-title',item.label],['game-subtitle',item.subtitle],['card-action',item.type==='historical'?'Play historical game →':'Load configuration →']]){const span=document.createElement(cls==='game-title'?'strong':'span');if(cls!=='game-title')span.className=cls;span.textContent=content;b.append(span);}if(!link)b.addEventListener('click',()=>loadGame(item.directory));area.append(b);}
 // Do not auto-launch a mechanics lab. The historical game is first in the catalog.
 }catch(err){show('Catalog error: '+err.message);console.error(err);}}
$('terrain-tiles-toggle')?.addEventListener('change',()=>render());


$('terrain-number-toggle')?.addEventListener('change',()=>{const layer=$('board').querySelector('[data-overlay="hex-numbers"]');if(layer)layer.style.display=$('terrain-number-toggle').checked?'inline':'none';else render();});
$('terrain-grid-toggle')?.addEventListener('change',()=>{const layer=$('board').querySelector('[data-layer="hex-grid"]');if(layer)layer.style.display=$('terrain-grid-toggle').checked?'inline':'none';else render();});
$('restart').addEventListener('click',()=>{if(game){state=E.start(game,7041);stackView.reset();setupMode=false;clearSelection();show('Game reset');render();}});
$('setup-toggle').addEventListener('click',()=>{setupMode=!setupMode;clearSelection();show(setupMode?'Setup: select a counter and then a legal location.':'Setup finished.');render();});
$('apply-replacement').addEventListener('click',()=>{const raw=$('replacement-choice').value;if(!raw)return;
 const a=JSON.parse(raw);show(E.applyReplacement(game,state,a)?`Applied ${a.type} for ${a.id}.`:'Replacement not legal.');render();});
$('clear-declarations').addEventListener('click',()=>{if(E.clearDeclarations(game,state)){clearSelection();show('Combat declarations cleared.');render();}});
$('combat-command').addEventListener('click',()=>{
 if(!state.declarationLocked){E.lockDeclarations(game,state);show('All declarations locked. Roll the first battle.');}
 else if(state.pendingRoll===null){const r=E.previewNextDeclaration(game,state);show(r?`Rolled ${r.roll} → ${r.outcome}; select legal combat decisions.`:'No pending battles.');}
 else{
  const ch={},loss=$('loss-choice').value,retreat=$('retreat-choice').value,advance=$('advance-choice').value,exchange=$('exchange-choice').value.trim();
  if(loss!=='auto'&&!$('loss-choice').disabled)ch.attackerLossId=loss;
  if(retreat!=='auto'&&!$('retreat-choice').disabled){const [x,y]=retreat.split(',').map(Number);ch.retreatTo={x,y};}
  if(advance!=='auto')ch.advanceId=advance;
  if(exchange&&!$('exchange-choice').disabled)ch.exchangeOrder=exchange.split(',').map(s=>s.trim()).filter(Boolean);
  if(!$('stacked-choices').hidden){const defender=$('defender-loss-choice').value;if(defender!=='auto'&&!$('defender-loss-choice').disabled)ch.defenderLossId=defender;
   const retreats={};for(const opt of $('stacked-retreat-controls').querySelectorAll('select[data-unit]'))if(opt.value!=='auto'){const [x,y]=opt.value.split(',').map(Number);retreats[opt.dataset.unit]={x,y};}
   if(Object.keys(retreats).length)ch.retreats=retreats;} 
  const r=E.resolveDeclared(game,state,null,ch);show(r?`Battle ${r.defender} · ${r.odds}:1 · d6=${r.roll} · ${r.result}`:'Invalid combat choice.');
  if(r)$('exchange-choice').value='';
 }
 clearSelection();render();
});
$('end-phase').addEventListener('click',()=>{if(!state||state.over)return;E.endPhase(game,state);clearSelection();show('Phase advanced');render();});$('auto-side').addEventListener('click',autoSide);loadCatalog();
})();
