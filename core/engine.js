/* Hex Wargame v2.0: a small, deterministic, configuration-driven rules kernel.
   NOT a replacement for the canonical Battle for Moscow engine yet. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const modules=typeof WargameRuleModules!=='undefined'?WargameRuleModules:(typeof require==='function'?require('./modules.js'):{});
const CRT=typeof WargameHistoricalCRT!=='undefined'?WargameHistoricalCRT:(typeof require==='function'?require('./historical_crt.js'):null);
const Graduated=typeof WargameGraduatedMode!=='undefined'?WargameGraduatedMode:(typeof require==='function'?require('./graduated_mode.js'):null);
const copy=x=>JSON.parse(JSON.stringify(x));
const rosterContract=typeof WargameRoster!=='undefined'?WargameRoster:(typeof require==='function'?require('./roster.js'):null);
const xy=(x,y)=>`${x},${y}`;
const minimumCombatOdds=g=>g.rules.combat.crtVariant==='advanced'?0.5:1;
const DIRECTION_NAMES=['SE','S','SW','NW','N','NE'];
function neighbors(x,y){ // even-q (flat-topped), verified against Oberlabs Honeycomb topology
 const delta=x%2===0?[[1,1],[0,1],[-1,1],[-1,0],[0,-1],[1,0]]:[[1,0],[0,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
 return delta.map(([dx,dy],i)=>({x:x+dx,y:y+dy,dir:DIRECTION_NAMES[i]}));
}
function distance(x,y,a,b){const r=y-Math.floor((x+1)/2),t=b-Math.floor((a+1)/2);return Math.max(Math.abs(x-a),Math.abs(r-t),Math.abs((x-a)+(r-t)));}
const KNOWN_MODULES=new Set(['reinforcement-event-v1','scheduled-reinforcement-v1','defender-holds-on-retreat-v1','replacement-budget-v1','communication-path-v1','retreat-radial-zoc-v1','rail-path-zoc-v1','stacking-capacity-v1','counter-state-v1','attacker-hexside-cap-v1','stacked-battle-v1','per-unit-terrain-factors-v1','turn-attack-multiplier-v1','first-turn-combat-restrictions-v1','air-support-v1']);
const EXECUTED_MODULES=new Set(Object.keys(modules));
const VALID_PREDICATES=new Set(['controls','all','any','not','turn-at-least','some-other-controlled-city','score-at-least']);
function validatePackage(p){
 const errors=[],g=p.game||{},m=p.map||{},u=p.units||{},r=p.rules||{},o=p.objectives||{};
 const fail=(t)=>errors.push(t);
 if(g.schemaVersion!==1)fail('Unsupported schemaVersion');
 if(!/^[a-z0-9-]+$/.test(g.id||''))fail('Invalid game ID');
 if(!['generic-hex-v1','legacy-b4m-v1'].includes(g.engine))fail('Unknown engine adapter');
 const sides=(g.factions||[]).map(f=>f.id);
 if(sides.length!==2||new Set(sides).size!==2)fail('v2.0 core requires exactly two distinct factions');
 if(m.topology!=='even-q-flat')fail('Unsupported topology: even-q-flat required');
 if(!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<2||m.height<2)fail('Invalid board dimensions');
 const cs=new Set();for(const h of m.cells||[]){if(!Number.isInteger(h.x)||!Number.isInteger(h.y)||h.x<0||h.y<0||h.x>=m.width||h.y>=m.height)fail('Cell outside board');const k=xy(h.x,h.y);if(cs.has(k))fail('Duplicate cell '+k);cs.add(k);}
 if(!cs.size)fail('No playable cells');
 const ids=new Set(),initialGroups=new Map();for(const a of u.units||[]){if(ids.has(a.id))fail('Duplicate unit '+a.id);ids.add(a.id);const side=a.faction||a.army;if(!sides.includes(side))fail('Unknown unit faction '+side);
 if(a.counterClass==='support'&&!(r.specialRules||[]).some(x=>x.module==='stacking-capacity-v1'&&(x.freeCounterClasses||[]).includes('support')))fail('Support counter requires free stacking rule '+a.id);
 if(a.states&&!a.states[a.counterState])fail('Missing counter face '+a.id);
 if(a.states&&g.engine==='generic-hex-v1'&&!(r.specialRules||[]).some(x=>x.module==='counter-state-v1'))fail('Counter states require counter-state-v1: '+a.id);
 if(a.stepLoss!=null&&!['reduce','remove'].includes(a.stepLoss))fail('Unsupported stepLoss for '+a.id);
 if(a.stepLoss==='remove'&&a.strength==='reduced')fail('One-step remove-on-damage unit cannot start reduced: '+a.id);
 if(a.counter?.template&&!['army-2','army-3','stuka','air','fleet'].includes(a.counter.template))fail('Unknown counter template '+a.id);
 if(a.position){const k=xy(a.position.x,a.position.y);if(!cs.has(k))fail('Unit outside playable board '+a.id);if(!initialGroups.has(k))initialGroups.set(k,[]);initialGroups.get(k).push(a);}}
 for(const [key,group] of initialGroups){const bad=stackViolation({rules:r},group);if(bad)fail(bad+': '+key);} 
 if(!Number.isInteger(r.turns)||r.turns<1)fail('Invalid turn limit');
 if(!Array.isArray(r.turnOrder)||r.turnOrder.length!==sides.length||new Set(r.turnOrder).size!==sides.length||r.turnOrder.some(f=>!sides.includes(f)))fail('Turn order must contain each faction exactly once');
 if((!Array.isArray(r.phases)||!r.phases.length)&&!r.phasesBySide)fail('No phases');
 const allPhases=[...(r.phases||[]),...Object.values(r.phasesBySide||{}).flat()];
 for(const ph of allPhases){if(!['move','combat','replacement'].includes(ph.kind))fail('Unknown phase kind '+ph.kind);
  if(ph.kind==='combat'&&ph.declarationMode&&!['simultaneous'].includes(ph.declarationMode))fail('Unsupported combat declaration mode');
  if(ph.kind==='move'&&ph.movementMode&&!['normal','rail','panzer'].includes(ph.movementMode))fail('Unknown movement mode');}
 if(r.phasesBySide){for(const side of sides){const phases=r.phasesBySide[side];if(!Array.isArray(phases)||!phases.length)fail('Missing side-specific phases: '+side);}}
 if(g.engine==='generic-hex-v1'&&allPhases.some(x=>x.kind==='replacement')){
  if(!(r.specialRules||[]).some(x=>x.module==='replacement-budget-v1'))fail('Replacement phase requires replacement-budget-v1');
  if(!(r.specialRules||[]).some(x=>x.module==='communication-path-v1'))fail('Replacement phase requires communication-path-v1');
 }
 for(const side of sides){const list=r.phasesBySide?.[side]||r.phases||[],ids=new Set();for(const ph of list){if(!ph.id||ids.has(ph.id))fail('Missing or duplicate phase id for '+side+': '+ph.id);ids.add(ph.id);}}
 for(const mod of r.specialRules||[]){
  if(!KNOWN_MODULES.has(mod.module))fail('Unknown rule module '+mod.module);
  if(g.engine==='generic-hex-v1'&&!EXECUTED_MODULES.has(mod.module))fail('Rule module not implemented: '+mod.module);
  if(mod.module==='stacking-capacity-v1'){
   if(!Number.isInteger(mod.maxCombatUnits)||mod.maxCombatUnits<1||mod.maxCombatUnits>8)fail('Invalid stacking capacity');
   if(mod.maxArmies!=null&&(!Number.isInteger(mod.maxArmies)||mod.maxArmies<0))fail('Invalid army limit');
   for(const pair of mod.incompatibleNationalities||[])if(!Array.isArray(pair)||pair.length!==2||pair.some(v=>typeof v!=='string'))fail('Invalid nationalities exclusion');
  }
  if(mod.module==='counter-state-v1'&&(!mod.transitions||typeof mod.transitions!=='object'))fail('Missing counter-state transitions');
  if(mod.module==='attacker-hexside-cap-v1'&&(!Number.isInteger(mod.perHexside)||mod.perHexside<1))fail('Invalid attacker hexside capacity');
  if(mod.module==='stacked-battle-v1'){
   const stack=(r.specialRules||[]).find(m=>m.module==='stacking-capacity-v1');
   if(mod.maxDefenders!==2||!stack||stack.maxCombatUnits>2)fail('stacked-battle-v1 requires maxDefenders: 2 and stacking capacity <= 2');
   if(mod.cityHoldPolicy!==undefined&&mod.cityHoldPolicy!=='one-step-choice')fail('Invalid stacked city hold policy');
   if(mod.strictMinimumOdds!==undefined&&typeof mod.strictMinimumOdds!=='boolean')fail('Invalid stacked odds policy');
   if((r.specialRules||[]).some(m=>m.module==='defender-holds-on-retreat-v1'&&m.singleDefenderOnly!==true)&&mod.cityHoldPolicy!=='one-step-choice')
    fail('Stacked combat with city DR-hold requires explicit singleDefenderOnly: true');
  }
  if(mod.module==='per-unit-terrain-factors-v1'){
   if(!mod.majorRiverFeature||!Number.isFinite(mod.majorRiverMultiplier)||mod.majorRiverMultiplier<=0||mod.majorRiverMultiplier>1)fail('Invalid major river factor');
   if(typeof mod.swampTerrain!=='string'||!mod.swampTerrain||!Array.isArray(mod.swampTankTypes)||!mod.swampTankTypes.length||!mod.swampTankTypes.every(x=>typeof x==='string')||!Number.isFinite(mod.swampTankMultiplier)||mod.swampTankMultiplier<=0||mod.swampTankMultiplier>1)fail('Invalid swamp tank factor');
  }
  if(mod.module==='turn-attack-multiplier-v1'){
   if(!sides.includes(mod.side)||!Array.isArray(mod.unitTypes)||!mod.unitTypes.length||!mod.multiplierByTurn||!Object.keys(mod.multiplierByTurn).length)fail('Invalid turn multiplier actor');
   for(const [k,v] of Object.entries(mod.multiplierByTurn||{}))if(!/^[1-9]\d*$/.test(k)||!Number.isFinite(v)||v<=0)fail('Invalid turn multiplier '+k);
  }
  if(mod.module==='first-turn-combat-restrictions-v1'){
   if(!sides.includes(mod.noAttack?.side)||!sides.includes(mod.borderDefense?.side))fail('Invalid combat restriction factions');
   const validCoords=a=>Array.isArray(a)&&a.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isInteger));
   if(!validCoords(mod.noAttack?.initialHexes)||!validCoords(mod.borderDefense?.allowedInitialHexes)||!mod.borderDefense?.targetRegion)fail('Invalid first turn restrictions');
  }
  if(mod.module==='air-support-v1'){
   if(!sides.includes(mod.side)||mod.maxPerBattle!==1||!Array.isArray(mod.markers)||!mod.markers.length)fail('Invalid air support registration');
   for(const id of mod.markers){const piece=(u.units||[]).find(a=>a.id===id);if(!piece||piece.counterClass!=='support'||(piece.faction||piece.army)!==mod.side||!Number.isInteger(piece.airShift)||piece.airShift<=0)fail('Invalid air support marker '+id);}
  }
  if(mod.module==='replacement-budget-v1'){
   for(const config of Object.values(mod.budgets||Object.fromEntries(sides.map(side=>[side,mod[side]||{}]))))for(const [field,val] of Object.entries(config||{}))
    if(!Number.isInteger(val)||val<0)fail('Invalid replacement budget for '+field);
  }
  if(mod.module==='retreat-radial-zoc-v1'&&(!Number.isInteger(mod.distance)||mod.distance<1||!Number.isInteger(mod.zocTransitBudget)||mod.zocTransitBudget<0))fail('Invalid radial retreat parameters');
  if(['reinforcement-event-v1','scheduled-reinforcement-v1'].includes(mod.module)&&(!Number.isInteger(mod.when?.turn)||!sides.includes(mod.when?.side)||!mod.when?.phase||!mod.entryCells&&!mod.entryTag))fail('Invalid reinforcement event');
 }
 if(r.initialPhaseId!=null&&!(r.phasesBySide?.[r.turnOrder?.[0]]||r.phases||[]).some(ph=>ph.id===r.initialPhaseId))fail('Initial phase is not available to the starting faction');
 if(g.engine==='generic-hex-v1'){
  if(!r.movement||!r.combat||!r.combat.table)fail('Missing generic movement/combat rules');
  if(r.combat?.crtVariant!==undefined&&r.combat.crtVariant!=='advanced')fail('Unknown CRT variant');
  if(r.combat?.crtVariant==='advanced'&&(!CRT||JSON.stringify(r.combat.table)!==JSON.stringify(CRT.tableFor(g.id,'advanced'))))fail('Advanced CRT must match the authenticated eight-column matrix');
  if(r.combat?.retreatModule&&!['one-hex-open-v1','retreat-radial-zoc-v1'].includes(r.combat.retreatModule))fail('Unknown retreat module');
  for(const factions of Object.values(r.combat?.terrainDefenderFactions||{}))if(!Array.isArray(factions)||factions.some(f=>!sides.includes(f)))fail('Invalid terrain defender faction filter');
  if(r.combat?.retreatModule==='retreat-radial-zoc-v1'&&!(r.specialRules||[]).some(x=>x.module==='retreat-radial-zoc-v1'))fail('Missing retreat-radial-zoc-v1 configuration');
 if(r.combat?.exchangeMode!==undefined&&!['match-defender-step-loss','one-step'].includes(r.combat.exchangeMode))fail('Invalid exchange loss mode');
 for(const k of ['defaultLossPriority','defaultAdvancePriority'])if(r.combat?.[k]!==undefined&&!['weakest','first'].includes(r.combat[k]))fail('Invalid combat default priority');
 if(r.combat?.retreatTieBreakByFaction!==undefined){
  const table=r.combat.retreatTieBreakByFaction;
  if(!table||typeof table!=='object'||Array.isArray(table)||Object.entries(table).some(([side,v])=>!sides.includes(side)||!['x-asc','x-desc'].includes(v)))fail('Invalid retreat tie-break');
 }

  if(r.replacements?.preventSameTurnEntryRestore!==undefined&&typeof r.replacements.preventSameTurnEntryRestore!=='boolean')fail('Invalid same-turn replacement restore policy');
  if(r.replacements&&!(r.specialRules||[]).some(x=>x.module==='communication-path-v1'))fail('Replacement rules require communication-path-v1');
  if(!['highest-vp','priority-predicates'].includes(o.victory?.mode))fail('Unsupported victory mode');
  if(o.graduatedVictory!==undefined){try{Graduated.validate(g.id,o.graduatedVictory);}catch(e){fail(e.message);}}
  for(const v of o.points||[])if(!['control','enemy-steps-lost'].includes(v.type))fail('Unsupported VP source '+v.type);
  const verifyPred=q=>{if(!q||!VALID_PREDICATES.has(q.type)){fail('Unknown victory predicate '+q?.type);return;}if(['all','any'].includes(q.type)){if(!q.children?.length)fail('Empty compound victory predicate');else q.children.forEach(verifyPred);}if(q.type==='not')verifyPred(q.child);};
  for(const d of o.victory?.decisions||[])verifyPred(d.if);
  for(const [col,table] of Object.entries(r.combat?.table||{}))if(!Array.isArray(table)||table.length!==6||!table.every(x=>['AL','NE','DR','EX','DE','DRL'].includes(x)))fail('Invalid CRT column '+col);
 }
 if(g.engine==='generic-hex-v1'){
  const dep=p.deployments||{},manual=dep.manualSetup;
  if(manual!==undefined){
   if(!manual||!sides.includes(manual.side)||typeof manual.phaseId!=='string'||!manual.phaseId||
      typeof manual.zoneTag!=='string'||!manual.zoneTag||!Number.isInteger(manual.unitCount)||manual.unitCount<1||
      (u.units||[]).filter(v=>(v.faction||v.army)===manual.side&&v.counterClass!=='support').length!==manual.unitCount||
      (m.cells||[]).filter(h=>h[manual.zoneTag]===true).length!==manual.unitCount||
      !r.turnOrder||r.turnOrder[0]!==manual.side)fail('Invalid manual setup policy');
  }
  for(const event of dep.interactiveReinforcements||[]){
   const unit=(u.units||[]).find(x=>x.id===event.unitId);
   const supported=(r.specialRules||[]).some(rule=>
     ['reinforcement-event-v1','scheduled-reinforcement-v1'].includes(rule.module)&&
     rule.unit===event?.unitId&&rule.when?.turn===event.turn&&rule.when?.side===event.side&&
     rule.entryTag===event.entryTag&&rule.strength===event.strength&&rule.notInEnemyZoc===true&&
     (rule.cost??0)===0);
   if(!event||typeof event.id!=='string'||!event.id||!Number.isInteger(event.turn)||event.turn<1||event.turn>r.turns||
     !sides.includes(event.side)||unit?.army!==event.side&&unit?.faction!==event.side||
     typeof event.phaseId!=='string'||!event.phaseId||typeof event.beforePhase!=='string'||
     (r.phasesBySide?.[event.side]||r.phases||[])[0]?.id!==event.beforePhase||
     !event.entryTag||!(m.cells||[]).some(h=>h[event.entryTag]===true)||
     event.strength!=='full'||event.requiresEmpty!==true||event.forbidEnemyZoc!==true||!supported)
      fail('Invalid interactive reinforcement policy');
  }
  if(new Set((dep.interactiveReinforcements||[]).map(e=>e.id)).size!==(dep.interactiveReinforcements||[]).length)fail('Duplicate reinforcement event IDs');
  const open=dep.openingRedeployment;
  if(open!==undefined){
   const roster=(u.units||[]), ids=open?.unitIds, positions=open?.initialPositions;
   if(!open||!/^[a-z0-9-]+$/.test(open.id||'')||!/^[a-z0-9-]+$/.test(open.phaseId||'')||
      open.certification!=='candidate-unverified'||open.eastPolicy!=='strictly-east-of-all-nonreserve-friendly-opening-hexes'||
      !sides.includes(open.side)||open.afterSetupSide!==r.turnOrder[0]||open.side===open.afterSetupSide||
      !Array.isArray(ids)||ids.length<1||ids.length>16||new Set(ids).size!==ids.length||
      !positions||!Array.isArray(ids)||Object.keys(positions).sort().join('|')!==[...ids].sort().join('|')||
      !Array.isArray(open.sourceHexes)||open.sourceHexes.length!==ids?.length||
      open.sourceHexes.some(h=>!/^\d{4}$/.test(h))||
      !Array.isArray(open.registeredHexes)||open.registeredHexes.length!==ids?.length||
      open.registeredHexes.some((h,i)=>!/^\d{4}$/.test(h)||
        !Array.isArray(positions?.[ids[i]])||h!==String(positions[ids[i]][0]+1).padStart(2,'0')+String(positions[ids[i]][1]+1).padStart(2,'0'))||
      open.requiresEmpty!==true||open.forbidEnemyZoc!==true||
      (!Array.isArray(ids)||ids.some(id=>{const unit=roster.find(t=>t.id===id),v=positions[id];return !unit||unit.faction!==open.side&&unit.army!==open.side||
         unit.counterClass==='support'||unit.strength==='dead'||!unit.position||!Array.isArray(v)||v.length!==2||
         !v.every(Number.isInteger)||unit.position.x!==v[0]||unit.position.y!==v[1]||!cs.has(xy(...v));})))
     fail('Invalid opening redeployment candidate');
  }
 }
 if(g.engine==='generic-hex-v1'){
  const setups=p.deployments||{};
  for(const preset of setups.presets||[]){const final=Object.fromEntries((u.units||[]).filter(t=>t.position).map(t=>[t.id,t.position]));Object.assign(final,preset.units||{});const stackGroups=new Map();
   for(const [id,pos] of Object.entries(final)){
    if(!cs.has(xy(pos.x,pos.y)))fail('Preset outside playable map '+id);
    const k=xy(pos.x,pos.y);const presetUnit=(u.units||[]).find(a=>a.id===id);if(!presetUnit){fail('Unknown preset unit '+id);continue;}if(!stackGroups.has(k))stackGroups.set(k,[]);stackGroups.get(k).push(presetUnit);
   }
   for(const [key,group] of stackGroups){const bad=stackViolation({rules:r},group);if(bad)fail('Preset '+bad+': '+key);}for(const [id,pos] of Object.entries(preset.units||{})){
   const unit=(u.units||[]).find(t=>t.id===id);if(!unit)fail('Unknown preset unit '+id);
   if(!cs.has(xy(pos.x,pos.y)))fail('Preset outside playable map '+id);
   const tag=setups.placementTags?.[unit?.faction||unit?.army];
   if(tag&&!(m.cells||[]).find(h=>h.x===pos.x&&h.y===pos.y)?.[tag])fail('Preset violates placement zone '+id);
  }}
 }
 if(errors.length){const e=new Error('Invalid game package:\n'+errors.join('\n'));e.errors=errors;throw e;}
 return {ok:true,engine:g.engine,playable:g.engine==='generic-hex-v1',executedModules:(r.specialRules||[]).filter(s=>EXECUTED_MODULES.has(s.module)).map(s=>s.module),legacyOnlyModules:(r.specialRules||[]).filter(s=>!EXECUTED_MODULES.has(s.module)).map(s=>s.module)};
}
function build(p,verifiedRoster=null){
 const prepared=verifiedRoster===null?p:{...p,units:{...p.units,units:rosterContract.bindExecutable(verifiedRoster,p.units.units,p.game.id)}};
 validatePackage(prepared);const map=new Map(prepared.map.cells.map(h=>[xy(h.x,h.y),copy(h)]));
 return {...prepared,cells:map,playable:(x,y)=>map.has(xy(x,y))&&map.get(xy(x,y))?.terrain!=='sea'};}
function unitSide(u){return u.faction||u.army;}
function power(u,role='defense'){
 if(support(u))return null;
 if(u.strength==='dead')return 0;
 const face=u.states?.[u.counterState];
 if(face?.concealed)return null;
 if(u.strength==='reduced'&&face){const r=role==='attack'?'reducedAttack':'reducedDefense';if(Number.isFinite(face[r]))return face[r];
  if(Number.isFinite(u[r]))return u[r];if(Number.isFinite(u.reduced))return u.reduced;}
 if(face&&Number.isFinite(face[role]))return face[role];
 return u.strength==='full'?(u.full??u.combatFull):u.strength==='reduced'?(u.reduced??u.combatReduced):0;
}
function support(u){return u.counterClass==='support';}
function active(u){return !!u.position&&u.strength!=='dead';}
function unitsAt(s,x,y){return s.units.filter(u=>active(u)&&u.position.x===x&&u.position.y===y);}
function unitAt(s,x,y){return unitsAt(s,x,y).find(u=>!support(u))||unitsAt(s,x,y)[0]||null;}
function stackingRule(g){return (g.rules.specialRules||[]).find(e=>e.module==='stacking-capacity-v1')||null;}
function stackViolation(g,group){
 if(!group.length)return null;
 const rule=stackingRule(g);const sides=[...new Set(group.map(unitSide))];
 if(sides.length>1)return 'Enemy factions cannot occupy the same hex';
 if(!rule&&group.length>1)return 'Initial stacking';
 const free=new Set(rule?.freeCounterClasses||[]),ground=group.filter(u=>!free.has(u.counterClass||'ground'));
 if(ground.length>(rule?.maxCombatUnits??1))return 'Stacking capacity exceeded';
 const size=rule?.armySize||'army';if(ground.filter(u=>u.size===size).length>(rule?.maxArmies??Infinity))return 'Army-size limit exceeded';
 for(const pair of rule?.incompatibleNationalities||[]){if(pair.length!==2)continue;
  if(ground.some(u=>u.nationality===pair[0])&&ground.some(u=>u.nationality===pair[1]))return 'Incompatible nationalities: '+pair.join('/');}
 return null;
}
function canOccupy(g,s,u,x,y){if(!g.playable(x,y))return false;return !stackViolation(g,[...unitsAt(s,x,y).filter(a=>a.id!==u.id),u]);}
function visibleCounter(u){
 const hidden=u.states?.[u.counterState]?.concealed===true;
 return {id:u.id,type:u.type,nationality:u.nationality||null,counterClass:u.counterClass||'ground',
  face:u.counterState||u.strength,combat: support(u)?'—':hidden?'?':String(power(u)),movement:u.movement??null,hidden};
}
function transitionCounter(g,s,id,next,trigger){
 const u=s.units.find(v=>v.id===id),rule=(g.rules.specialRules||[]).find(e=>e.module==='counter-state-v1');
 if(!u||!rule||s.over||!u.states?.[next])return false;
 if(trigger==='battle-reveal'&&currentPhase(g,s)?.kind!=='combat')return false;
 const target=rule.transitions?.[u.counterState]?.[trigger];if(!Array.isArray(target)||!target.includes(next))return false;
 const old=u.counterState;u.counterState=next;s.log.push({type:'counter-state',unit:id,from:old,to:next,trigger,turn:s.turn,side:s.side});return true;
}
function opposite(g,side){return g.game.factions.find(f=>f.id!==side)?.id;}
function enemyZoc(g,s,x,y,side){return neighbors(x,y).some(n=>unitsAt(s,n.x,n.y).some(u=>!support(u)&&unitSide(u)!==side));}
function rng(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function phasesFor(g,side){return g.rules.phasesBySide?.[side]||g.rules.phases;}
function interactiveReinforcement(g,s){
 if(s.over||s.manualSetupActive)return null;
 const phase=phasesFor(g,s.side)?.[s.phaseIndex];
 const index=g.rules.turnOrder.indexOf(s.side),previousSide=g.rules.turnOrder[(index+g.rules.turnOrder.length-1)%g.rules.turnOrder.length];
 const previousTurn=index===0?s.turn-1:s.turn;
 return (g.deployments?.interactiveReinforcements||[]).find(e=>
  e.turn===s.turn&&e.side===s.side&&phase?.id===e.beforePhase&&
  s.log.some(rec=>rec.turn===previousTurn&&rec.side===previousSide&&rec.type==='end-phase'&&rec.phase===
    phasesFor(g,previousSide).at(-1)?.id)&&
  !s.log.some(rec=>rec.turn===s.turn&&rec.side===s.side&&rec.type==='interactive-reinforcement-complete'&&rec.eventId===e.id))||null;
}
function currentPhase(g,s){
 // Finished campaigns do not expose a playable phase cursor.
 if(s.over)return null;
 if(s.manualSetupActive===true){const e=g.deployments?.manualSetup;return e?{id:e.phaseId,kind:'setup'}:null;}
 if(s.openingRedeployment?.completed===false){const e=g.deployments?.openingRedeployment;return e?{id:e.phaseId,kind:'redeployment',actor:e.side}:null;}
 const event=interactiveReinforcement(g,s);
 return event?{id:event.phaseId,kind:'reinforcement',eventId:event.id}:phasesFor(g,s.side)[s.phaseIndex];
}

function weather(g,s){return (g.rules.weather||[]).find(w=>w.turns?.includes(s.turn))||null;}
function claim(g,s,unit){if(!unit.position||support(unit))return;const h=g.cells.get(xy(unit.position.x,unit.position.y));if(h?.city&&h.city!=='none')s.control[xy(h.x,h.y)]=unitSide(unit);}
function start(g,seed=1,setup='default',options={}){
 if(g.game.engine!=='generic-hex-v1')throw Error('This package requires the legacy adapter');
 const s={turn:1,side:g.rules.turnOrder[0],phaseIndex:Math.max(0,phasesFor(g,g.rules.turnOrder[0]).findIndex(ph=>ph.id===g.rules.initialPhaseId)),units:copy(g.units.units),control:{},seed:seed>>>0||1,over:false,winner:null,log:[],ply:0,stepsLost:{},committed:[],moved:[],eventsDone:[],declarations:[],declarationLocked:false,pendingRoll:null,replacementUsed:0,airUsed:{},setupPositions:{}};
 for(const faction of g.game.factions)s.stepsLost[faction.id]=0;
 const manual=setup==='manual';
 if(manual&&!g.deployments?.manualSetup)throw Error('Manual setup not configured');
 const preset=(g.deployments?.presets||[]).find(x=>x.id===setup);
 if(preset)for(const unit of s.units)if(preset.units?.[unit.id])unit.position=copy(preset.units[unit.id]);
 if(manual){
  s.manualSetupActive=true;
  for(const unit of s.units)if(unitSide(unit)===g.deployments.manualSetup.side&&!support(unit))unit.position=null;
 }else checkSetup(g,s);
 if(options?.openingRedeployment===true){
  const policy=g.deployments?.openingRedeployment;
  if(!policy)throw Error('No opening redeployment policy');
  // An opt-in preview is independent of the real tournament scoring mode.
  for(const id of policy.unitIds){const u=s.units.find(u=>u.id===id),[x,y]=policy.initialPositions[id];
   if(!u?.position||u.position.x!==x||u.position.y!==y)throw Error('Reserve source slot mismatch: '+id);
  }
  s.openingRedeployment={id:policy.id,completed:false};
 }else if(options?.openingRedeployment!==undefined&&options.openingRedeployment!==false)throw Error('Invalid opening redeployment option');

 s.setupPositions=Object.fromEntries(s.units.filter(u=>u.position).map(u=>[u.id,copy(u.position)]));
 for(const h of g.cells.values())if(h.city&&h.city!=='none'&&(h.owner||h.control))s.control[xy(h.x,h.y)]=h.owner||h.control;
 for(const unit of s.units)claim(g,s,unit);
 applyEvents(g,s,'start');applyEvents(g,s,currentPhase(g,s).id);checkState(g,s);return s;
}
function applyEvents(g,s,stage='start'){
 for(let i=0;i<(g.rules.specialRules||[]).length;i++){
  const e=g.rules.specialRules[i],module=modules[e.module];if(!module?.onSideStart||s.eventsDone.includes(i))continue;
  if(e.when?.turn!==s.turn||e.when?.side!==s.side||e.when?.phase!==stage)continue;
  // A configured human-choice reinforcement owns this event; the generic
  // automatic scheduler must never silently choose its arrival hex instead.
  if((g.deployments?.interactiveReinforcements||[]).some(v=>v.unitId===e.unit&&v.turn===s.turn&&v.side===s.side))continue;
  const event=module.onSideStart({g,s,unitAt,canOccupy,enemyZoc,claim,copy},e);
  if(event)s.log.push(event);s.eventsDone.push(i);
 }
}
function checkSetup(g,s){
 const tagBySide=g.deployments?.placementTags||{};
 if(g.game.engine!=='generic-hex-v1')return true;
 for(const [side,required] of Object.entries(g.deployments?.requiredCounts||{})){
  const actual=s.units.filter(u=>unitSide(u)===side&&!support(u)&&u.position&&u.strength!=='dead').length;
  if(actual!==required)throw Error(`Invalid initial unit count for ${side}: ${actual} expected ${required}`);
 }
 for(const u of s.units){const tag=tagBySide[unitSide(u)];if(!tag||!u.position)continue;
  if(!g.cells.get(xy(u.position.x,u.position.y))?.[tag])throw Error('Unit outside setup zone: '+u.id);
 }
 return true;
}
function finishManualSetup(g,s){
 const policy=g.deployments?.manualSetup;
 if(!s.manualSetupActive||!policy||s.turn!==1||s.side!==policy.side)return false;
 try{checkSetup(g,s);checkState(g,s);
  const open=g.deployments?.openingRedeployment;
  if(s.openingRedeployment&&open)for(const id of open.unitIds){
   const u=s.units.find(u=>u.id===id);
   if(!u?.position||enemyZoc(g,s,u.position.x,u.position.y,open.side))return false;
  }
 }catch{return false;}
 s.manualSetupActive=false;
 s.setupPositions=Object.fromEntries(s.units.filter(u=>u.position).map(u=>[u.id,copy(u.position)]));
 s.log.push({turn:s.turn,side:s.side,type:'setup',message:`${policy.side} deployed ${policy.unitCount} units manually`});
 return true;
}
function legalSetupPositions(g,s,id){
 const policy=g.deployments?.manualSetup;
 if(!s.manualSetupActive||!policy||s.turn!==1||s.side!==policy.side)return [];
 const u=s.units.find(x=>x.id===id);
 if(!u||unitSide(u)!==policy.side||support(u)||u.strength!=='full')return [];
 return [...g.cells.values()].filter(h=>h[policy.zoneTag]===true&&
  (!unitsAt(s,h.x,h.y).length||unitsAt(s,h.x,h.y).length===1&&unitSide(unitAt(s,h.x,h.y))===policy.side))
  .map(h=>({x:h.x,y:h.y}));
}
function relocateSetup(g,s,id,x,y){
 if(!legalSetupPositions(g,s,id).some(v=>v.x===x&&v.y===y))return false;
 const unit=s.units.find(u=>u.id===id),old=unit.position?copy(unit.position):null;
 const other=unitAt(s,x,y);
 if(other?.id===unit.id)return true;
 if(other&&unitSide(other)!==unitSide(unit))return false;
 if(other)other.position=old;
 unit.position={x,y};
 try{checkState(g,s);}catch{unit.position=old;if(other)other.position={x,y};return false;}
 s.setupPositions[id]=copy(unit.position);
 if(other){if(old)s.setupPositions[other.id]=copy(old);else delete s.setupPositions[other.id];}
 // Legacy setup immediately recomputes all city ownership from the original
 // source control and currently positioned units, rather than accruing claims.
 for(const h of g.cells.values())if(h.city&&h.city!=='none')s.control[xy(h.x,h.y)]=h.owner||h.control||s.control[xy(h.x,h.y)];
 for(const u of s.units)if(unitSide(u)===unitSide(unit)&&u.position)claim(g,s,u);
 return true;
}
function openingRedeploymentOptions(g,s,id){
 const policy=g.deployments?.openingRedeployment;
 if(!policy||!s.openingRedeployment||s.openingRedeployment.completed||s.turn!==1||
    s.side!==policy.afterSetupSide||s.manualSetupActive===true||!policy.unitIds.includes(id))return [];
 const unit=s.units.find(u=>u.id===id);
 if(!unit||!unit.position||unitSide(unit)!==policy.side||unit.strength==='dead')return [];
 const frontline=s.units.filter(u=>unitSide(u)===policy.side&&!support(u)&&u.position&&
   u.strength!=='dead'&&!policy.unitIds.includes(u.id));
 if(!frontline.length)return [];
 const eastOf=Math.max(...frontline.map(u=>u.position.x)),origin=policy.initialPositions[id];
 return [...g.cells.values()].filter(h=>g.playable(h.x,h.y)&&
  (h.x>eastOf||h.x===origin[0]&&h.y===origin[1]||h.x===unit.position.x&&h.y===unit.position.y)&&
  (h.x===unit.position.x&&h.y===unit.position.y||
    (!unitsAt(s,h.x,h.y).length&&!enemyZoc(g,s,h.x,h.y,policy.side)&&canOccupy(g,s,unit,h.x,h.y))))
  .map(h=>({x:h.x,y:h.y}));
}
// Diagnostic only: classify every playable hex using the SAME legal-action
// function that governs placement. Never present this preview as a source-
// certified Oberlabs destination set until external executable parity exists.
function openingRedeploymentAudit(g,s,id){
 const policy=g.deployments?.openingRedeployment;
 if(!policy||!s.openingRedeployment||s.openingRedeployment.completed||
    !policy.unitIds.includes(id)||currentPhase(g,s)?.kind!=='redeployment')return null;
 const unit=s.units.find(u=>u.id===id);
 if(!unit?.position)return null;
 const frontline=s.units.filter(u=>unitSide(u)===policy.side&&!support(u)&&u.position&&
   u.strength!=='dead'&&!policy.unitIds.includes(u.id));
 if(!frontline.length)return null;
 const eastOf=Math.max(...frontline.map(u=>u.position.x));
 const origin=policy.initialPositions[id],current=unit.position;
 const legal=openingRedeploymentOptions(g,s,id);
 const keys=new Set(legal.map(h=>xy(h.x,h.y)));
 const counts={legal:0,current:0,original:0,westOrOnFront:0,occupied:0,enemyZoc:0,otherRestriction:0};
 for(const h of g.cells.values()){
  if(!g.playable(h.x,h.y))continue;
  const k=xy(h.x,h.y),here=h.x===current.x&&h.y===current.y;
  const source=h.x===origin[0]&&h.y===origin[1];
  let reason;
  if(here)reason='current';
  else if(source&&keys.has(k))reason='original';
  else if(h.x<=eastOf&&!source)reason='westOrOnFront';
  else if(unitsAt(s,h.x,h.y).length)reason='occupied';
  else if(enemyZoc(g,s,h.x,h.y,policy.side))reason='enemyZoc';
  else if(!keys.has(k))reason='otherRestriction';
  else reason='legal';
  counts[reason]++;
  // Candidate actions and the diagnostic MUST never disagree about legality.
  if(keys.has(k)!==['current','original','legal'].includes(reason))
   throw Error('Opening redeployment classification differs from legal actions');
 }
 return {unitId:id,origin:{x:origin[0],y:origin[1]},current:copy(current),
  frontlineMaxColumn:eastOf+1,frontlineUnits:frontline.length,
  registeredHexes:copy(policy.registeredHexes),publishedHexes:copy(policy.sourceHexes),
  counts,legalDestinations:legal.length,certification:policy.certification};
}
function redeployOpeningUnit(g,s,id,x,y){
 if(!openingRedeploymentOptions(g,s,id).some(h=>h.x===x&&h.y===y))return false;
 const unit=s.units.find(u=>u.id===id);
 if(unit.position.x===x&&unit.position.y===y)return true;
 const old=copy(unit.position);unit.position={x,y};
 try{checkState(g,s);}catch{unit.position=old;return false;}
 // The new opening position governs subsequent first-turn restrictions.
 s.setupPositions[id]={x,y};claim(g,s,unit);
 s.log.push({turn:1,side:g.deployments.openingRedeployment.side,type:'opening-redeployment',unit:id,from:old,to:{x,y}});
 return true;
}
function finishOpeningRedeployment(g,s){
 const policy=g.deployments?.openingRedeployment;
 if(!policy||!s.openingRedeployment||s.openingRedeployment.completed||s.manualSetupActive||
    s.turn!==1||s.side!==policy.afterSetupSide)return false;
 // The zero-move option is legal, including all three reserves standing fast.
 s.openingRedeployment.completed=true;
 s.log.push({turn:1,side:policy.side,type:'opening-redeployment-complete',eventId:policy.id});
 return true;
}
function reinforcementOptions(g,s){
 const event=interactiveReinforcement(g,s);if(!event||currentPhase(g,s)?.kind!=='reinforcement')return [];
 const unit=s.units.find(u=>u.id===event.unitId);if(!unit||unit.position||unit.strength==='dead')return [];
 return [...g.cells.values()].filter(h=>h[event.entryTag]===true&&!unitsAt(s,h.x,h.y).length&&
  !enemyZoc(g,s,h.x,h.y,event.side)&&canOccupy(g,s,unit,h.x,h.y)).map(h=>({x:h.x,y:h.y}));
}
function placeReinforcement(g,s,id,x,y){
 const event=interactiveReinforcement(g,s);
 if(!event||id!==event.unitId||!reinforcementOptions(g,s).some(p=>p.x===x&&p.y===y))return false;
 const unit=s.units.find(u=>u.id===id);unit.position={x,y};unit.strength=event.strength;claim(g,s,unit);
 s.log.push({turn:s.turn,side:s.side,type:'interactive-reinforcement',eventId:event.id,unit:id,at:{x,y},replacementCost:0});
 return true;
}
function legalMoves(g,s,id){
 if(currentPhase(g,s)?.kind!=='move')return [];
 const u=s.units.find(x=>x.id===id),phase=currentPhase(g,s);
 if(!u?.position||unitSide(u)!==s.side||s.moved.includes(id)||phase.allowedUnitTypes&&!phase.allowedUnitTypes.includes(u.type)||phase.allowedFactions&&!phase.allowedFactions.includes(s.side))return [];
 let limit=phase.movementMode==='rail'?(phase.maxDistance??u.railMovement??g.rules.movement.railAllowance??u.movement??2):u.movement??2;
 const w=weather(g,s);if(w?.normalMovementLimit!=null&&phase.movementMode!=='rail')limit=Math.min(limit,w.normalMovementLimit);
 const best=new Map([[xy(u.position.x,u.position.y),0]]),q=[{...u.position,cost:0,path:[]}],out=[];
 while(q.length){q.sort((a,b)=>a.cost-b.cost);const cur=q.shift();if(cur.cost!==best.get(xy(cur.x,cur.y)))continue;
  for(const n of neighbors(cur.x,cur.y)){
   if(!g.playable(n.x,n.y))continue;const occupants=unitsAt(s,n.x,n.y);if(occupants.some(v=>unitSide(v)!==s.side)||occupants.some(v=>v.id!==id)&&!g.rules.movement.friendlyTransit)continue;const canEnd=canOccupy(g,s,u,n.x,n.y);
   const tile=g.cells.get(xy(n.x,n.y)),origin=g.cells.get(xy(cur.x,cur.y));
   if(phase.movementMode==='rail'&&!(origin?.rail||[]).includes(n.dir))continue;
   if(phase.movementMode==='rail'&&g.rules.movement.railRequiresReciprocal){const reverse={SE:'NW',NW:'SE',S:'N',N:'S',SW:'NE',NE:'SW'}[n.dir];if(!(tile.rail||[]).includes(reverse))continue;}
   const cost=cur.cost+(phase.movementMode==='rail'||(w?.normalMovementLimit!=null&&w.mudIgnoresTerrainCosts)?1:(g.rules.movement.terrainCosts?.[tile.terrain]??1));
   if(cost>limit||cost>=(best.get(xy(n.x,n.y))??Infinity))continue;
   const route=cur.path.concat({x:n.x,y:n.y});best.set(xy(n.x,n.y),cost);if(canEnd)out.push({x:n.x,y:n.y,cost,path:route});
   const railRule=(g.rules.specialRules||[]).find(e=>e.module==='rail-path-zoc-v1');
   const mayContinue=!(g.rules.movement.zocStops&&enemyZoc(g,s,n.x,n.y,s.side))&&
     (!railRule||modules['rail-path-zoc-v1'].canContinueMove({g,s,phase,enemyZoc,side:s.side},railRule,n));
   if(mayContinue)q.push({x:n.x,y:n.y,cost,path:route});
  }
 }
 return out.sort((a,b)=>a.cost-b.cost||a.x-b.x||a.y-b.y);
}
function move(g,s,id,x,y){if(s.over)return false;const legal=legalMoves(g,s,id);if(!legal.some(v=>v.x===x&&v.y===y))return false;const u=s.units.find(v=>v.id===id),from=copy(u.position);u.position={x,y};claim(g,s,u);s.moved.push(id);s.log.push({turn:s.turn,side:s.side,type:'move',unit:id,from,to:{x,y}});return true;}
function stackedPolicy(g){return (g.rules.specialRules||[]).find(v=>v.module==='stacked-battle-v1');}
function stackedBattle(g){return !!stackedPolicy(g);}
function stackedHoldOptions(g,s,outcome,defenders,attackers){
 if(stackedPolicy(g)?.cityHoldPolicy!=='one-step-choice')return [];
 return defenders.filter(d=>d.strength==='full'&&d.stepLoss!=='remove'&&(g.rules.specialRules||[]).some(e=>e.module==='defender-holds-on-retreat-v1'&&e.singleDefenderOnly!==true&&modules[e.module].onCombatResult({g,s,outcome,defender:d,cell:g.cells.get(xy(d.position.x,d.position.y)),attackers},e))).map(d=>d.id);
}
function battleDefenders(s,d){return d?.position?unitsAt(s,d.position.x,d.position.y).filter(u=>!support(u)&&unitSide(u)===unitSide(d)):[];}
const REVERSE_DIR={SE:'NW',NW:'SE',S:'N',N:'S',SW:'NE',NE:'SW'};
function acrossFeature(g,source,target,feature){
 if(!source||!target)return false;
 const n=neighbors(target.x,target.y).find(v=>v.x===source.x&&v.y===source.y);
 if(!n)return false;
 const back=g.cells.get(xy(target.x,target.y)),front=g.cells.get(xy(source.x,source.y));
 return !!((back?.[feature]||[]).includes(n.dir)||(front?.[feature]||[]).includes(REVERSE_DIR[n.dir]));
}
function attackAllowed(g,s,attackerIds,defender){
 const rule=(g.rules.specialRules||[]).find(v=>v.module==='first-turn-combat-restrictions-v1');
 if(!rule||s.turn!==1)return true;
 return attackerIds.every(id=>modules[rule.module].allowedAttack({g,s,attacker:s.units.find(u=>u.id===id),defender,initial:s.setupPositions?.[id],cell:g.cells.get(xy(defender.position.x,defender.position.y))},rule));
}
function attackerFactor(g,s,u,defender){
 const w=weather(g,s);let val=power(u,'attack')*(w?.combatMultipliers?.[u.type]??1);
 const ctx={g,s,unit:u,defender,cell:g.cells.get(xy(defender.position.x,defender.position.y)),acrossFeature:(feature)=>acrossFeature(g,u.position,defender.position,feature)};
 // Turn-specific bonuses first; crossing penalties and individual rounding second.
 for(const moduleName of ['turn-attack-multiplier-v1','per-unit-terrain-factors-v1']){
  const rule=(g.rules.specialRules||[]).find(v=>v.module===moduleName);
  if(rule)val=modules[moduleName].attackerFactor(ctx,rule,val);
 }
 return val;
}
function airRule(g){return (g.rules.specialRules||[]).find(v=>v.module==='air-support-v1');}
function validAir(g,s,id,defenderId){
 const rule=airRule(g),marker=s.units.find(u=>u.id===id);
 return !!(rule&&rule.side===s.side&&rule.markers.includes(id)&&marker&&support(marker)&&unitSide(marker)===s.side&&marker.strength!=='dead'&&
  !s.airUsed?.[`${s.turn}:${id}`]&&marker.airShift>0&&s.declarations.every(d=>d.airSupportId!==id||d.defender===defenderId));
}
function availableAirSupport(g,s,defenderId){
 if(currentPhase(g,s)?.kind!=='combat'||s.pendingRoll!==null)return [];
 return (airRule(g)?.markers||[]).filter(id=>validAir(g,s,id,defenderId)).map(id=>({id,shift:s.units.find(u=>u.id===id).airShift}));
}
function assignAirSupport(g,s,id,defenderId){
 if(!s.declarationLocked||s.pendingRoll!==null||!s.declarations.length)return false;
 const battle=s.declarations[0];if(battle.defender!==defenderId)return false;
 if(id==='none'||id===null){battle.airSupportId=null;battle.odds=null;return true;}
 if(!validAir(g,s,id,defenderId))return false;
 battle.airSupportId=id;battle.odds=null;return true;
}
function battleShape(g,s,attackerIds,defenderId){
 const d=s.units.find(u=>u.id===defenderId),aa=(attackerIds||[]).map(id=>s.units.find(u=>u.id===id));
 if(!d?.position||support(d)||!aa.length||new Set(attackerIds).size!==attackerIds.length)return null;
 const defenders=battleDefenders(s,d),group=defenders.length>1;
 if(!defenders.length||(group&&!stackedBattle(g))||defenders.length>2)return null;
 if(aa.some(u=>!u?.position||support(u)||unitSide(u)!==s.side||unitSide(u)===unitSide(d)||distance(u.position.x,u.position.y,d.position.x,d.position.y)!==1)||!attackAllowed(g,s,attackerIds,d))return null;
 const cap=(g.rules.specialRules||[]).find(v=>v.module==='attacker-hexside-cap-v1')?.perHexside;
 if(cap){const counts=new Map();for(const a of aa){const k=xy(a.position.x,a.position.y);counts.set(k,(counts.get(k)||0)+1);}if([...counts.values()].some(n=>n>cap))return null;}
 return {d,aa,defenders,group,hidden:[...aa,...defenders].some(u=>u.states?.[u.counterState]?.concealed)};
}
function revealBattle(g,s,ids){
 // Kiev 10.1.1: attackers reveal during combat Step 1; defenders at Step 2, before odds or die.
 const rule=(g.rules.specialRules||[]).find(e=>e.module==='counter-state-v1');
 for(const id of ids){const u=s.units.find(v=>v.id===id);if(!u?.states?.[u.counterState]?.concealed)continue;
  const targets=rule?.transitions?.[u.counterState]?.['battle-reveal'];
  if(!targets||targets.length!==1||!u.states[targets[0]]||!transitionCounter(g,s,id,targets[0],'battle-reveal'))return false;
 }
 return true;
}
function combatOdds(g,s,attackerIds,defenderId,airSupportId=null){
 const d=s.units.find(u=>u.id===defenderId),aa=attackerIds.map(id=>s.units.find(u=>u.id===id));
 if(!d?.position||support(d)||(!stackedBattle(g)&&unitsAt(s,d.position.x,d.position.y).filter(u=>!support(u)).length!==1)||!aa.length||aa.some(u=>!u?.position||support(u)||unitSide(u)===unitSide(d)||unitSide(u)!==s.side||distance(u.position.x,u.position.y,d.position.x,d.position.y)!==1)||!attackAllowed(g,s,attackerIds,d)||aa.some(u=>power(u,'attack')===null)||power(d,'defense')===null)return null;
 // A stacked defending hex must be resolved as a single multi-unit battle under printed Kiev rules.
 // Fail closed until stacked-battle loss allocation, advance and group retreat are implemented.
 const edgeLimit=(g.rules.specialRules||[]).find(v=>v.module==='attacker-hexside-cap-v1')?.perHexside;
 if(edgeLimit){const byHex=new Map();for(const a of aa){const key=xy(a.position.x,a.position.y);byHex.set(key,(byHex.get(key)||0)+1);}if([...byHex.values()].some(n=>n>edgeLimit))return null;}
 const defenders=battleDefenders(s,d),w=weather(g,s);if(defenders.length>2||defenders.some(u=>power(u,'defense')===null)||aa.some(u=>power(u,'attack')===null))return null;
 const atk=aa.reduce((sum,u)=>sum+attackerFactor(g,s,u,d),0),def=defenders.reduce((sum,u)=>sum+power(u,'defense'),0);if(!Number.isFinite(def)||def<=0)return null;
 const variant=g.rules.combat.crtVariant||'standard';let raw=Math.min(g.rules.combat.oddsCap||6,variant==='advanced'?CRT.columnForRatio(atk/def,variant):Math.floor(atk/def));const cell=g.cells.get(xy(d.position.x,d.position.y));const shifts=[];
 const terrainShift=(g.rules.combat.terrainDefenderFactions?.[cell.terrain]&&!g.rules.combat.terrainDefenderFactions[cell.terrain].includes(unitSide(d)))?0:(g.rules.combat.terrainShifts?.[cell.terrain]||0);if(terrainShift)shifts.push({type:'terrain',value:terrainShift});
 const cityShift=g.rules.combat.cityShifts?.[cell.city]||0;if(cityShift)shifts.push({type:'city',value:cityShift});
 if(aa.every(u=>acrossFeature(g,u.position,d.position,'river')||acrossFeature(g,u.position,d.position,'majorRiver')))shifts.push({type:'river',value:g.rules.combat.allAttackersAcrossRiverShift||0});
 const airMarker=airSupportId?s.units.find(u=>u.id===airSupportId):null;
 if(airSupportId&&!validAir(g,s,airSupportId,defenderId))return null;
 const airShift=airMarker?.airShift||0;
 return {raw,odds:variant==='advanced'?CRT.shiftColumn(raw,airShift-shifts.reduce((n,x)=>n+x.value,0),g.rules.combat.oddsCap||6,variant):Math.min(g.rules.combat.oddsCap||6,Math.max(0,raw-shifts.reduce((n,x)=>n+x.value,0)+airShift)),attackerStrength:atk,defenderStrength:def,shifts,defenderIds:defenders.map(u=>u.id),airSupportId,airShift,attackerFactors:Object.fromEntries(aa.map(u=>[u.id,attackerFactor(g,s,u,d)]))};
}
function loseStep(g,s,u){
 if(u.strength==='dead')return;
 // A scenario must explicitly mark counters that disappear on the first hit.
 // Default counters retain the two-step full -> reduced -> dead behavior.
 if(u.strength==='full'&&u.stepLoss!=='remove')u.strength='reduced';
 else{u.strength='dead';u.position=null;}
 s.stepsLost[unitSide(u)]++;
}
function eliminate(g,s,u){while(u.strength!=='dead')loseStep(g,s,u);}
function retreatOptions(g,s,d,attackers=[]){
 if(!d?.position)return [];
 const id=g.rules.combat.retreatModule||'one-hex-open-v1';
 if(id==='retreat-radial-zoc-v1'){
  const e=(g.rules.specialRules||[]).find(x=>x.module===id);
  return modules[id].onRetreatOptions({g,s,neighbors,distance,unitAt,canOccupy,enemyZoc,unitSide},e,d);
 }
 const options=neighbors(d.position.x,d.position.y).filter(n=>g.playable(n.x,n.y)&&canOccupy(g,s,d,n.x,n.y)&&!enemyZoc(g,s,n.x,n.y,unitSide(d))).map(n=>({x:n.x,y:n.y,cost:0,path:[{x:n.x,y:n.y}]}));
 const separation=p=>attackers.length?Math.min(...attackers.filter(a=>a.position).map(a=>distance(p.x,p.y,a.position.x,a.position.y))):0;
 return options.sort((a,b)=>separation(b)-separation(a)||a.x-b.x||a.y-b.y);
}
function combatPreview(g,s,attackerIds,defenderId,die,airSupportId=null){
 const o=combatOdds(g,s,attackerIds,defenderId,airSupportId);if(!o||o.odds<minimumCombatOdds(g)||!Number.isInteger(die)||die<1||die>6)return null;
 const outcome=g.rules.combat.table[String(o.odds)]?.[die-1];if(!outcome)return null;
 const d=s.units.find(u=>u.id===defenderId),aa=attackerIds.map(id=>s.units.find(u=>u.id===id)),defenders=battleDefenders(s,d);
 if(defenders.length>1){
  // Preview contains possible destinations only; exchange attacker losses may subsequently change ZOCs.
  const byDefender=Object.fromEntries(defenders.map(u=>[u.id,retreatOptions(g,s,u,aa)]));
  return {...o,outcome,cityHold:false,...(stackedPolicy(g)?.cityHoldPolicy==='one-step-choice'?{cityHoldOptions:stackedHoldOptions(g,s,outcome,defenders,aa)}:{}),defenders:defenders.map(u=>u.id),defenderLossOptions:['DRL','EX'].includes(outcome)?defenders.map(u=>u.id):[],
   retreatByDefender:byDefender,retreat:[],potentialAdvance:['DR','DRL','EX','DE'].includes(outcome)};
 }
 const cityHold=(g.rules.specialRules||[]).some(e=>modules[e.module]?.onCombatResult?.({g,s,outcome,defender:d,cell:g.cells.get(xy(d.position.x,d.position.y)),attackers:aa},e)===true);
 const defenderDies=outcome==='DE'||(['DRL','EX'].includes(outcome)&&(d.strength==='reduced'||d.stepLoss==='remove'));
 return {...o,outcome,cityHold,defenders:[d.id],defenderLossOptions:[],retreat:!cityHold&&!defenderDies&&['DR','DRL','EX'].includes(outcome)?retreatOptions(g,s,d,aa):[],potentialAdvance:['DR','DRL','EX','DE'].includes(outcome)&&!cityHold};
}
// Atomic two-defender combat. Invalid choices never mutate the caller's game state or RNG.
function resolveStackedAttack(g,s,attackerIds,defenderId,die=null,choices={},frozenOdds=null,airSupportId=null){
 if(s.over||currentPhase(g,s)?.kind!=='combat'||attackerIds.some(id=>s.committed.includes(id)))return null;
 const t=copy(s),shape=battleShape(g,t,attackerIds,defenderId);
 if(!shape?.group||t.committed.some(id=>id.startsWith('def:')&&shape.defenders.some(u=>u.id===id.slice(4))))return null;
 if(shape.hidden)return null; // hidden units must be revealed at the prescribed battle step first
 const o=combatOdds(g,t,attackerIds,defenderId,airSupportId);if(!o||o.odds<minimumCombatOdds(g))return null; // compute at Kiev combat Step 2, never at announcement
 if(die!==null&&(!Number.isInteger(die)||die<1||die>6))return null;
 const roll=die??(Math.floor(rng(t)*6)+1),outcome=g.rules.combat.table[String(o.odds)]?.[roll-1];if(!outcome)return null;
 if(choices.attackerLossId!=null&&(!attackerIds.includes(choices.attackerLossId)||outcome!=='AL'))return null;
 if(choices.defenderLossId!=null&&(!['DRL','EX'].includes(outcome)||!shape.defenders.some(u=>u.id===choices.defenderLossId)))return null;
 if(choices.exchangeOrder!==undefined&&(!Array.isArray(choices.exchangeOrder)||outcome!=='EX'||new Set(choices.exchangeOrder).size!==choices.exchangeOrder.length||choices.exchangeOrder.some(id=>!attackerIds.includes(id))))return null;
 if(choices.retreatTo!==undefined)return null; // stacked units need separately chosen legal endpoints
 if(choices.retreats!==undefined&&(!choices.retreats||typeof choices.retreats!=='object'||Array.isArray(choices.retreats)||!['DR','DRL','EX'].includes(outcome)||Object.keys(choices.retreats).some(id=>!shape.defenders.some(u=>u.id===id))))return null;
 if(choices.advanceId!==undefined&&choices.advanceId!==null&&choices.advanceId!=='none'&&!attackerIds.includes(choices.advanceId))return null;
 const first=shape.d,hex={...first.position},defenders=shape.defenders.map(u=>t.units.find(v=>v.id===u.id)),attackers=shape.aa.map(u=>t.units.find(v=>v.id===u.id));
 let defenderLossId=null,attackerLossId=null,exchangeLosses=[];
 const holdOptions=stackedHoldOptions(g,t,outcome,defenders,attackers);
 const holdId=choices.standFastId;
 if(holdId!==undefined&&holdId!=='none'&&!holdOptions.includes(holdId))return null;
 const cityHold=holdId!==undefined&&holdId!=='none';
 if(cityHold&&(Object.keys(choices.retreats||{}).length||choices.advanceId&&choices.advanceId!=='none'))return null;
 if(cityHold){defenderLossId=holdId;loseStep(g,t,defenders.find(u=>u.id===holdId));}
 if(outcome==='AL'){const a=attackers.find(u=>u.id===choices.attackerLossId)||attackers[0];attackerLossId=a.id;loseStep(g,t,a);}
 if(outcome==='DE')for(const u of defenders)eliminate(g,t,u);
 if(['DRL','EX'].includes(outcome)){
  const loss=defenders.find(u=>u.id===choices.defenderLossId)||defenders.slice().sort((a,b)=>power(a,'defense')-power(b,'defense'))[0];
  const before=power(loss,'defense');loseStep(g,t,loss);defenderLossId=loss.id;
  if(outcome==='EX'){
   const need=g.rules.combat.exchangeMode==='match-defender-step-loss'?before-power(loss,'defense'):1;
   const specified=(choices.exchangeOrder||[]).map(id=>attackers.find(u=>u.id===id)),remainder=attackers.filter(u=>!specified.includes(u));
   if(g.rules.combat.defaultLossPriority==='weakest')remainder.sort((a,b)=>power(a,'attack')-power(b,'attack'));
   let matched=0;for(const u of [...specified,...remainder]){if(matched>=need)break;
    const orig=power(u,'attack');loseStep(g,t,u);matched+=g.rules.combat.exchangeMode==='match-defender-step-loss'?orig-power(u,'attack'):1;exchangeLosses.push(u.id);
   }
  }
 }
 const retreats={},survivors=defenders.filter(u=>u.position);
 if(!cityHold&&['DR','DRL','EX'].includes(outcome)&&survivors.length){
  // Two defenders: enumerate possible independent retreat assignments; score globally so the
  // first unit cannot consume the only legal endpoint needed by the second.
  const choiceRoutes=choices.retreats||{},lim=5000;let explored=0,best=null;
  const consider=(local,idx,assign,lost,zoc,extra)=>{
   if(++explored>lim)return;
   if(idx===survivors.length){const score=lost*1000+zoc*100+extra;
    if(!best||score<best.score)best={state:local,assign,score};return;}
   const id=survivors[idx].id,u=local.units.find(x=>x.id===id),provided=choiceRoutes[id];
   let routes=retreatOptions(g,local,u,attackers.map(a=>local.units.find(x=>x.id===a.id)));
   const distanceRequired=(g.rules.specialRules||[]).find(e=>e.module===g.rules.combat.retreatModule)?.distance??1;
   // Printed Kiev 10.6: two hexes exactly; extend only when there is no legal exact-distance endpoint.
   if(routes.some(r=>r.path.length===distanceRequired))routes=routes.filter(r=>r.path.length===distanceRequired);
   if(provided!==undefined){
    const point=Array.isArray(provided)?{x:provided[0],y:provided[1]}:provided;
    if(!point||!Number.isInteger(point.x)||!Number.isInteger(point.y))return;
    routes=routes.filter(r=>r.x===point.x&&r.y===point.y);
   }
   if(!routes.length){if(provided!==undefined)return;
    const next=copy(local),v=next.units.find(x=>x.id===id);eliminate(g,next,v);
    consider(next,idx+1,{...assign,[id]:{eliminated:true,reason:'no-legal-retreat'}},lost+1,zoc,extra);return;
   }
   for(const r of routes.slice(0,80)){
    const next=copy(local),v=next.units.find(x=>x.id===id);
    if(r.cost)loseStep(g,next,v);
    if(v.position){v.position={x:r.x,y:r.y};claim(g,next,v);}
    consider(next,idx+1,{...assign,[id]:v.position?{to:{x:r.x,y:r.y},cost:r.cost,path:r.path}:{eliminated:true,reason:'zoc-step'}},
     lost+Number(!v.position),zoc+r.cost,extra+Math.max(0,(r.path?.length||2)-2));
   }
  };
  consider(t,0,{},0,0,0);
  if(!best)return null;
  Object.assign(t,best.state);Object.assign(retreats,best.assign);
 }
 const remained=unitsAt(t,hex.x,hex.y).filter(u=>!support(u)&&unitSide(u)!==t.side);
 const vacated=remained.length===0,allAttackers=attackerIds.map(id=>t.units.find(u=>u.id===id));
 let advanceId=null;
 if(vacated&&choices.advanceId!=='none'){
  const selected=choices.advanceId?allAttackers.find(u=>u.id===choices.advanceId):
   g.rules.combat.defaultAdvancePriority==='weakest'?allAttackers.filter(u=>u.position).sort((a,b)=>power(a,'attack')-power(b,'attack'))[0]:allAttackers.find(u=>u.position);
  if(choices.advanceId&&(!selected?.position||!canOccupy(g,t,selected,hex.x,hex.y)))return null;
  if(selected?.position&&canOccupy(g,t,selected,hex.x,hex.y)){selected.position=hex;claim(g,t,selected);advanceId=selected.id;}
 }else if(choices.advanceId&&choices.advanceId!=='none'&&!vacated)return null;
 if(Object.keys(choices.retreats||{}).some(id=>!retreats[id]))return null;
 for(const id of attackerIds)t.committed.push(id);for(const u of defenders)t.committed.push('def:'+u.id);
 const rec={turn:t.turn,side:t.side,type:'combat',attackers:[...attackerIds],defender:defenderId,defenders:defenders.map(u=>u.id),odds:o.odds,roll,result:outcome,defenderLossId,attackerLoss:attackerLossId,exchangeLosses,retreats,advanceId,cleared:vacated,stacked:true,...(stackedPolicy(g)?.cityHoldPolicy==='one-step-choice'?{cityHold}: {})};
 if(airSupportId){t.airUsed[`${t.turn}:${airSupportId}`]=true;rec.airSupportId=airSupportId;rec.airShift=o.airShift;}
 t.log.push(rec);try{checkState(g,t);}catch(_err){return null;}Object.assign(s,t);return rec;
}
function resolveAttack(g,s,attackerIds,defenderId,die=null,choices={},frozenOdds=null,airSupportId=null){
 const target=s.units.find(u=>u.id===defenderId);if(target?.position&&battleDefenders(s,target).length>1)return stackedBattle(g)?resolveStackedAttack(g,s,attackerIds,defenderId,die,choices,frozenOdds,airSupportId):null;
 if(choices.standFastId!==undefined||s.over||currentPhase(g,s)?.kind!=='combat'||new Set(attackerIds).size!==attackerIds.length||attackerIds.some(id=>s.committed.includes(id))||s.committed.includes('def:'+defenderId))return null;
 const o=frozenOdds||combatOdds(g,s,attackerIds,defenderId,airSupportId);if(!o||o.odds<minimumCombatOdds(g))return null;
 if(die!==null&&(!Number.isInteger(die)||die<1||die>6))return null;
 // Explicit choices must be checked BEFORE consuming a random die or changing any state.
 const d=s.units.find(u=>u.id===defenderId),aa=attackerIds.map(id=>s.units.find(u=>u.id===id));
 if(!d?.position||aa.some(u=>!u?.position||unitSide(u)!==s.side))return null;
 if(choices.attackerLossId!==undefined&&!attackerIds.includes(choices.attackerLossId))return null;
 if(choices.exchangeOrder!==undefined&&(!Array.isArray(choices.exchangeOrder)||new Set(choices.exchangeOrder).size!==choices.exchangeOrder.length||choices.exchangeOrder.some(id=>!attackerIds.includes(id))))return null;
 if(choices.advanceId!==undefined&&choices.advanceId!==null&&choices.advanceId!=='none'&&!attackerIds.includes(choices.advanceId))return null;
 const seedBefore=s.seed;const roll=die??(Math.floor(rng(s)*6)+1),result=g.rules.combat.table[String(o.odds)]?.[roll-1];if(!result)throw Error('CRT result missing');
 const hex={...d.position},p=combatPreview(g,s,attackerIds,defenderId,roll,airSupportId);
 if(!p)return null;
 if(choices.attackerLossId!==undefined&&result!=='AL'){if(die===null)s.seed=seedBefore;return null;}
 if(choices.exchangeOrder!==undefined&&result!=='EX'){if(die===null)s.seed=seedBefore;return null;}
 let retreatRoute=null;
 if(choices.retreatTo!==undefined){if(!choices.retreatTo||!Number.isInteger(choices.retreatTo.x)||!Number.isInteger(choices.retreatTo.y))return null;
  retreatRoute=p.retreat.find(v=>v.x===choices.retreatTo.x&&v.y===choices.retreatTo.y);if(!retreatRoute){if(die===null)s.seed=seedBefore;return null;}}
 let attackerLoss=null,exchangeLosses=[],cityHold=false,retreatTo=null,retreatZocCost=0,advanceId=null;
 const beforeDef=power(d),fullDef=d.strength==='full';
 if(result==='AL'){const a=aa.find(u=>u.id===choices.attackerLossId)||(g.rules.combat.defaultLossPriority==='weakest'?aa.slice().sort((x,y)=>power(x)-power(y))[0]:aa[0]);attackerLoss=a.id;loseStep(g,s,a);}
 if(['DRL','EX'].includes(result))loseStep(g,s,d);
 if(result==='DE')eliminate(g,s,d);
 if(result==='DR'&&p.cityHold){loseStep(g,s,d);cityHold=true;}
 else if(['DR','DRL','EX'].includes(result)&&d.position){
  const route=retreatRoute||p.retreat[0];
  if(!route||route.cost&&d.strength==='reduced'){eliminate(g,s,d);}
  else{if(route.cost){retreatZocCost=route.cost;loseStep(g,s,d);}
   if(d.position){d.position={x:route.x,y:route.y};claim(g,s,d);retreatTo={...d.position};}}
 }
 if(result==='EX'){
  const need=g.rules.combat.exchangeMode==='match-defender-step-loss'?(fullDef&&d.stepLoss!=='remove'?beforeDef-(d.reduced??d.combatReduced??0):beforeDef):1;
  let matched=0;const explicit=(choices.exchangeOrder||[]).map(id=>aa.find(u=>u.id===id));
  const rest=aa.filter(u=>!explicit.includes(u));if(g.rules.combat.defaultLossPriority==='weakest')rest.sort((x,y)=>power(x)-power(y));
  for(const u of [...explicit,...rest]){if(matched>=need)break;const prev=power(u);loseStep(g,s,u);matched+=g.rules.combat.exchangeMode==='match-defender-step-loss'?prev-power(u):1;exchangeLosses.push(u.id);}
 }
 const vacated=!d.position||d.position.x!==hex.x||d.position.y!==hex.y;
 if(vacated){const selected=choices.advanceId==='none'?null:choices.advanceId?aa.find(u=>u.id===choices.advanceId):g.rules.combat.defaultAdvancePriority==='weakest'?aa.filter(u=>u.position).sort((x,y)=>power(x)-power(y))[0]:aa.find(u=>u.position);
  if(selected?.position){selected.position=hex;claim(g,s,selected);advanceId=selected.id;}}
 for(const id of attackerIds)s.committed.push(id);s.committed.push('def:'+defenderId);
 const record={turn:s.turn,side:s.side,type:'combat',attackers:[...attackerIds],defender:defenderId,odds:o.odds,roll,result,retreatTo,retreatZocCost,cityHold,attackerLoss,exchangeLosses,advanceId,cleared:vacated};
 if(airSupportId){s.airUsed[`${s.turn}:${airSupportId}`]=true;record.airSupportId=airSupportId;record.airShift=o.airShift;}
 s.log.push(record);return record;
}
function combat(g,s,attackers,defender,die=null,choices={}){
 if(currentPhase(g,s)?.declarationMode==='simultaneous')return null;
 const shape=battleShape(g,s,attackers,defender);if(!shape)return null;
 if(!shape.hidden)return resolveAttack(g,s,attackers,defender,die,choices);
 const t=copy(s);
 if(!revealBattle(g,t,attackers)||!revealBattle(g,t,shape.defenders.map(u=>u.id)))return null;
 const odds=combatOdds(g,t,attackers,defender);if(!odds)return null;
 if(odds.odds<minimumCombatOdds(g)){const record={turn:t.turn,side:t.side,type:'combat',attackers:[...attackers],defender,result:'NE',odds:0,roll:null,concealedRevealed:true};
  t.committed.push(...attackers,'def:'+defender);t.log.push(record);Object.assign(s,t);return record;}
 const rec=resolveAttack(g,t,attackers,defender,die,choices);if(rec)Object.assign(s,t);return rec;
}
function declareCombat(g,s,attackerIds,defenderId){
 if(s.over||currentPhase(g,s)?.kind!=='combat'||currentPhase(g,s)?.declarationMode!=='simultaneous'||s.declarationLocked)return false;
 const shape=battleShape(g,s,attackerIds,defenderId);if(!shape)return false;
 const used=s.declarations.flatMap(d=>d.attackers),hex={...shape.d.position};
 if(attackerIds.some(id=>used.includes(id))||s.declarations.some(d=>d.hex?.x===hex.x&&d.hex?.y===hex.y))return false;
 const odds=combatOdds(g,s,attackerIds,defenderId);
 if(!shape.hidden&&(!odds||(odds.odds<minimumCombatOdds(g)&&(!stackedBattle(g)||stackedPolicy(g)?.strictMinimumOdds===true)&&!availableAirSupport(g,s,defenderId).some(a=>a.shift>=minimumCombatOdds(g)-odds.odds))))return false;
 s.declarations.push({attackers:[...attackerIds],defender:defenderId,hex,odds:shape.hidden?null:copy(odds)});
 s.log.push({turn:s.turn,side:s.side,type:'declare-combat',attackers:[...attackerIds],defender:defenderId,hidden:shape.hidden});return true;
}
function lockDeclarations(g,s){
 if(s.over||currentPhase(g,s)?.declarationMode!=='simultaneous')return false;
 s.declarationLocked=true;return true;
}
function clearDeclarations(g,s){
 if(s.over||currentPhase(g,s)?.declarationMode!=='simultaneous'||s.declarationLocked)return false;
 s.declarations=[];return true;
}
function previewNextDeclaration(g,s,die=null){
 if(s.over||!s.declarationLocked||!s.declarations.length)return null;
 let d=s.declarations[0];if(die!==null&&(!Number.isInteger(die)||die<1||die>6))return null;
 // Reveal only when the battle is begun, never at declaration time or during odds inspection.
 const shape=battleShape(g,s,d.attackers,d.defender);if(!shape)return null;
 if(shape.hidden){
  const t=copy(s);
  if(!revealBattle(g,t,d.attackers)||!revealBattle(g,t,shape.defenders.map(u=>u.id)))return null;
  Object.assign(s,t);d=s.declarations[0];
 }
 const o=combatOdds(g,s,d.attackers,d.defender,d.airSupportId||null);if(!o)return null;
 if(o.odds<minimumCombatOdds(g)){s.pendingRoll=0;return {...o,roll:null,outcome:'NE',belowOdds:true,attackers:d.attackers,defender:d.defender,defenders:o.defenderIds};}
 if(!d.odds)d.odds=copy(o); // cache revealed odds for the declared battle
 if(s.pendingRoll===null)s.pendingRoll=die??(Math.floor(rng(s)*6)+1);
 else if(die!==null&&die!==s.pendingRoll)return null;
 const p=combatPreview(g,s,d.attackers,d.defender,s.pendingRoll,d.airSupportId||null);
 return p?{...p,roll:s.pendingRoll,attackers:d.attackers,defender:d.defender}:null;
}
function resolveDeclared(g,s,die=null,choices={}){
 if(!s.declarationLocked||!s.declarations.length)return null;
 const d=s.declarations[0];if(s.pendingRoll!==null&&die!==null&&die!==s.pendingRoll)return null;
 if(s.pendingRoll===0){
  if(Object.keys(choices||{}).length)return null;
  const rec={turn:s.turn,side:s.side,type:'combat',attackers:[...d.attackers],defender:d.defender,
   defenders:combatOdds(g,s,d.attackers,d.defender)?.defenderIds||[d.defender],odds:0,roll:null,result:'NE',belowOdds:true};
  s.committed.push(...d.attackers,...rec.defenders.map(id=>'def:'+id));s.log.push(rec);s.declarations.shift();s.pendingRoll=null;return rec;
 }
 const actual=s.pendingRoll??die;
 const rec=resolveAttack(g,s,d.attackers,d.defender,actual,choices,d.odds,d.airSupportId||null);
 if(rec){s.declarations.shift();s.pendingRoll=null;}return rec;
}
function communication(g,s,unit,side=unitSide(unit),options=null){
 const e=(g.rules.specialRules||[]).find(x=>x.module==='communication-path-v1');
 if(!e)return false;
 // Standard replacement checks retain their capital exception. Optional victory
 // checks use the same traversability kernel but explicitly omit that exception.
 return modules[e.module].onCommunication({g,s,side,neighbors,unitAt,enemyZoc,
  ignoreCapitalException:options?.ignoreCapitalException===true},e,unit);
}
function replacementBudget(g,s){
 const e=(g.rules.specialRules||[]).find(x=>x.module==='replacement-budget-v1');
 return e?modules[e.module].onReplacementBudget({g,s,weather:weather(g,s)},e):0;
}
function replacementCandidates(g,s){
 const cfg=g.rules.replacements||{},entryTag=cfg.entryTags?.[s.side]||s.side+'Replacement',out=[];
 for(const u of s.units.filter(u=>unitSide(u)===s.side&&!support(u))){
  if(cfg.excludedTypesUntilTurn?.[u.type]!=null&&s.turn<=cfg.excludedTypesUntilTurn[u.type])continue;
  if(u.position){
   const enteredThisTurn=g.rules.replacements?.preventSameTurnEntryRestore===true&&
    s.log.some(ev=>ev.type==='replacement'&&ev.action==='enter'&&ev.unit===u.id&&ev.turn===s.turn&&ev.side===s.side);
   if(u.strength==='reduced'&&!enteredThisTurn&&communication(g,s,u))out.push({type:'restore',id:u.id});
  }
  else for(const h of g.cells.values()){
   if(!canOccupy(g,s,u,h.x,h.y))continue;
   const edge=!!h[entryTag],city=!!h.city&&h.city!=='none'&&s.control[xy(h.x,h.y)]===s.side;
   if((edge&&!enemyZoc(g,s,h.x,h.y,s.side))||(city&&communication(g,s,{position:{x:h.x,y:h.y}},s.side)))out.push({type:'enter',id:u.id,x:h.x,y:h.y});
  }
 }
 return out;
}
function replacementOptions(g,s){
 if(s.over||currentPhase(g,s)?.kind!=='replacement'||s.replacementUsed>=replacementBudget(g,s))return [];
 return replacementCandidates(g,s);
}
function applyReplacement(g,s,choice){
 const legal=replacementOptions(g,s).find(o=>o.id===choice?.id&&o.type===choice?.type&&(o.type==='restore'||o.x===choice.x&&o.y===choice.y));
 if(!legal)return false;
 const u=s.units.find(u=>u.id===choice.id);if(legal.type==='restore')u.strength='full';else{u.position={x:legal.x,y:legal.y};u.strength=u.stepLoss==='remove'?'full':(g.rules.replacements?.entryStrength||'reduced');claim(g,s,u);}
 s.replacementUsed++;s.log.push({turn:s.turn,side:s.side,type:'replacement',unit:u.id,action:legal.type,at:copy(u.position)});return true;
}
function evaluatePredicate(g,s,p){if(!p)return false;switch(p.type){
 case 'controls':return s.control[xy(...p.cell)]===p.faction;
 case 'all':return p.children.every(x=>evaluatePredicate(g,s,x));
 case 'any':return p.children.some(x=>evaluatePredicate(g,s,x));
 case 'not':return !evaluatePredicate(g,s,p.child);
 case 'turn-at-least':return s.turn>=p.turn;
 case 'some-other-controlled-city':return [...g.cells.values()].some(h=>h.city&&h.city!=='none'&&(h.x!==p.exclude?.[0]||h.y!==p.exclude?.[1])&&s.control[xy(h.x,h.y)]===p.faction);
 case 'score-at-least':return score(g,s)[p.faction]>=p.value;
 default:throw Error('Unsupported victory predicate '+p.type);
}}
function score(g,s){if(g.objectives.graduatedVictory){const r=Graduated.evaluate(g.objectives.graduatedVictory,s.control);return {german:r.germanVP,soviet:r.sovietVP};}const scores=Object.fromEntries(g.game.factions.map(f=>[f.id,0]));for(const v of g.objectives.points||[]){if(v.type==='control'){const side=s.control[xy(...v.cell)];if(side in scores)scores[side]+=v.points;}else if(v.type==='enemy-steps-lost'){for(const f of g.game.factions){const other=opposite(g,f.id);scores[f.id]+=(s.stepsLost[other]||0)*v.pointsPerStep;}}else throw Error('Unsupported VP source '+v.type);}return scores;}
function result(g,s){if(g.objectives.graduatedVictory)return Graduated.evaluate(g.objectives.graduatedVictory,s.control).winner;const v=g.objectives.victory;
 if(v.mode==='priority-predicates'){for(const p of v.decisions||[])if(evaluatePredicate(g,s,p.if))return p.winner;return v.otherwise||'draw';}
 if(v.mode==='highest-vp'){const sc=score(g,s),a=g.game.factions[0].id,b=g.game.factions[1].id;return sc[a]===sc[b]?'draw':sc[a]>sc[b]?a:b;}
 throw Error('Unsupported victory mode '+v.mode);
}
function endPhase(g,s){
 if(s.over)return false;
 const ph=currentPhase(g,s);if(!ph)return false;
 if(ph.kind==='setup'||ph.kind==='redeployment')return false; // These setup phases require explicit confirmation.
 if(ph.kind==='reinforcement'){
  const event=interactiveReinforcement(g,s),unit=s.units.find(u=>u.id===event?.unitId);
  if(!event||!unit||!unit.position&&reinforcementOptions(g,s).length)return false;
  s.log.push({turn:s.turn,side:s.side,type:'interactive-reinforcement-complete',eventId:event.id});
  applyEvents(g,s,phasesFor(g,s.side)[s.phaseIndex].id);
  return true;
 }
 if(ph.kind==='combat'&&ph.declarationMode==='simultaneous'&&s.declarations.length)return false;
 s.log.push({turn:s.turn,side:s.side,type:'end-phase',phase:ph.id});s.phaseIndex++;
 s.moved=[];s.committed=[];s.declarations=[];s.declarationLocked=false;s.pendingRoll=null;
 if(s.phaseIndex===phasesFor(g,s.side).length){
  s.phaseIndex=0;s.ply++;const i=g.rules.turnOrder.indexOf(s.side);
  if(i===g.rules.turnOrder.length-1){s.turn++;
   // Advance the side cursor even on the terminal boundary, matching the
   // ordinary end-of-side transition before evaluating campaign victory.
   s.side=g.rules.turnOrder[0];
   if(s.turn>g.rules.turns){s.over=true;s.winner=result(g,s);s.log.push({type:'finished',winner:s.winner,score:score(g,s),...(g.objectives.graduatedVictory?{graduated:Graduated.evaluate(g.objectives.graduatedVictory,s.control)}:{})});return true;}
  }else s.side=g.rules.turnOrder[i+1];
  s.replacementUsed=0;applyEvents(g,s,'start');
 }
 applyEvents(g,s,currentPhase(g,s).id);return true;
}
function checkState(g,s){const groups=new Map();for(const u of s.units){if(!active(u))continue;const k=xy(u.position.x,u.position.y);if(!g.cells.has(k))throw Error('Illegal unit geometry: '+u.id);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(u);}
 for(const [k,group] of groups){const bad=stackViolation(g,group);if(bad)throw Error(bad+' at '+k);}
 return true;}
return {validatePackage,build,start,unitAt,unitsAt,unitSide,power,support,stackViolation,canOccupy,visibleCounter,transitionCounter,neighbors,distance,enemyZoc,currentPhase,phasesFor,weather,
 legalMoves,move,combatOdds,combat,combatPreview,availableAirSupport,assignAirSupport,declareCombat,clearDeclarations,lockDeclarations,previewNextDeclaration,resolveDeclared,retreatOptions,
 replacementCandidates,replacementOptions,replacementBudget,applyReplacement,communication,legalSetupPositions,relocateSetup,finishManualSetup,openingRedeploymentOptions,openingRedeploymentAudit,redeployOpeningUnit,finishOpeningRedeployment,reinforcementOptions,placeReinforcement,checkSetup,
 endPhase,score,result,evaluatePredicate,checkState};
});
