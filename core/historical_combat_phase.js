/* Shared, opt-in combat commitment/transaction pilot. Historical source
 * §10: declare all battles, then resolve them in selectable order. All dice
 * are explicitly injected at this boundary; no hidden RNG or partial write.
 * Air Corps/Fleet strike support is optional and marker-committed before dice.
 * This is not a full eight-turn historical campaign or human browser workflow.
 */
(function(root,factory){
 const D=typeof module==='object'&&module.exports?require('./historical_combat_declarations.js'):root.WargameHistoricalCombatDeclarations;
 const P=typeof module==='object'&&module.exports?require('./phase_runtime.js'):root.WargamePhaseRuntime;
 const O=typeof module==='object'&&module.exports?require('./historical_combat_odds.js'):root.WargameHistoricalCombatOdds;
 const G=typeof module==='object'&&module.exports?require('./historical_combat_geography.js'):root.WargameHistoricalCombatGeography;
 const X=typeof module==='object'&&module.exports?require('./historical_combat_consequences.js'):root.WargameHistoricalCombatConsequences;
 const R=typeof module==='object'&&module.exports?require('./historical_retreat_options.js'):root.WargameHistoricalRetreatOptions;
 const S=typeof module==='object'&&module.exports?require('./historical_port_support.js'):root.WargameHistoricalPortSupport;
 const Air=typeof module==='object'&&module.exports?require('./historical_air_support.js'):root.WargameHistoricalAirSupport;
 const api=factory(D,P,O,G,X,R,S,Air);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalCombatPhase=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D,P,O,G,X,R,S,Air){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const readonly=v=>Object.freeze(clone(v));
 function create({map,profile,config,cursor,actor,state,counterConfig=null,combatPolicy=null,enableAirSupport=false,rosterOverlay=null}){
  const declarations=D.create({map,profile,config,combatPolicy});
  const geography=G.create(map,profile,{cityMarkerMode:combatPolicy?.cityMarkerMode,fortificationMode:combatPolicy?.fortificationMode});
  const phase=P.current(config,cursor);
  if(phase?.kind!=='combat'||phase.owner!==actor||!phase.permissions?.includes('declare-attack'))throw Error('Not an authorized combat phase');
  if(state?.scenarioId!==config.scenarioId||!state.units||typeof state.units!=='object'||Array.isArray(state.units))throw Error('Invalid combat state');
  const air=enableAirSupport?Air.create({map,combatPolicy,counterConfig,phaseConfig:config,rosterOverlay}):null;
  const baseline=readonly({cursor,actor,state});
  const airSeaOpen=Boolean(air&&actor===combatPolicy.airSupport.owner&&
   combatPolicy.airSupport.navalAttackMode!=='none');
  return controller({status:airSeaOpen?'air-sea-open':'awaiting-declarations',declaration:null,selected:null,observed:[],baseline,resolved:[],airSeaEvents:[],pendingSeaFaceId:null,groundAirChoice:null,groundAirLocked:false,pendingFleetCombat:null,history:[]});
  function controller(s){
   // Fresh private snapshot for every object; no reference from user arguments is retained.
   const current=clone(s);
   function snapshot(){return clone({status:current.status,declaration:current.declaration,selected:current.selected,observed:current.observed,
    resolved:current.resolved,pendingFleetCombat:current.pendingFleetCombat,...(air?{airSeaEvents:current.airSeaEvents,pendingSeaFaceId:current.pendingSeaFaceId,groundAirChoice:current.groundAirChoice,groundAirLocked:current.groundAirLocked}:{}),cursor:current.baseline.cursor,actor:current.baseline.actor,state:current.baseline.state,
    historyDepth:current.history.length});}
   function pushHistory(next){
    const {history,...previous}=current;
    return controller({...next,history:[...current.history,previous]});
   }
   function availableAir(){
    if(!air||current.status!=='air-sea-open')throw Error('Air-sea phase not open');
    return air.available({state:current.baseline.state,cursor:current.baseline.cursor,actor:current.baseline.actor});
   }
   function declareFleetAttack(faceId){
    if(!air||current.status!=='air-sea-open'||current.pendingSeaFaceId!==null)
     throw Error('Fleet air attack must be declared before the damage roll');
    const eligible=air.available({state:current.baseline.state,cursor:current.baseline.cursor,
     actor:current.baseline.actor});
    if(!eligible.some(x=>x.faceId===faceId))throw Error('Air marker unavailable for Fleet declaration');
    S.create({map,policy:combatPolicy,counterConfig}).validateMarker(current.baseline.state,true);
    return pushHistory({...current,pendingSeaFaceId:faceId});
   }
   function resolveFleetAttack(die){
    if(!air||current.status!=='air-sea-open'||current.pendingSeaFaceId===null)
     throw Error('Fleet air attack must be declared before its die');
    const effect=air.attackFleet({state:current.baseline.state,cursor:current.baseline.cursor,
     actor:current.baseline.actor,faceId:current.pendingSeaFaceId,die});
    const next=pushHistory({...current,pendingSeaFaceId:null,baseline:{...current.baseline,state:effect.state},
     airSeaEvents:[...current.airSeaEvents,effect.event]});
    return Object.freeze({ok:true,session:next,event:clone(effect.event)});
   }
   function finishAirSea(){
    if(!air||current.status!=='air-sea-open'||current.pendingSeaFaceId!==null)throw Error('Air-sea phase not open or has unresolved die');
    return pushHistory({...current,status:'awaiting-declarations'});
   }
   function commit(battles){
    if(current.status!=='awaiting-declarations')throw Error('Combat declarations already committed');
    const declaration=declarations.declare({cursor:current.baseline.cursor,actor:current.baseline.actor,state:current.baseline.state},battles);
    return controller({...current,status:declaration.battles.length?'committed':'no-battles-declared',declaration:clone(declaration)});
   }
   function select(defenderHex){
    if(current.status!=='committed')throw Error('Combat not awaiting resolution');
    if(typeof defenderHex!=='string'||!current.declaration.battles.some(b=>b.defenderHex===defenderHex))throw Error('Battle was not declared');
    // Order is selectable; consequences are derived only from verified sources.
    return controller({...current,status:'battle-selected',selected:defenderHex,groundAirChoice:null,groundAirLocked:false});
   }
   function commitGroundAir(faceId=null){
    if(!air||current.status!=='battle-selected'||current.groundAirLocked||
       current.baseline.actor!==combatPolicy.airSupport.owner)
     throw Error('Ground air choice must be committed before combat die');
    if(faceId!==null){
     const available=air.available({state:current.baseline.state,cursor:current.baseline.cursor,
      actor:current.baseline.actor});
     if(!available.some(x=>x.faceId===faceId))throw Error('Air marker unavailable for ground battle');
    }
    return pushHistory({...current,groundAirChoice:faceId,groundAirLocked:true});
   }
   function evaluateSelected({strengths,defenderTerrain,allAttackersAcrossRiver,airSupportShift=0,fleetShift=0,die=null,majorRiverCrossers=[]}={}){
    if(current.status!=='battle-selected')throw Error('Select a committed battle before calculating odds');
    const battle=current.declaration.battles.find(x=>x.defenderHex===current.selected);
    if(!strengths||typeof strengths!=='object'||Array.isArray(strengths))throw Error('Explicit unit strengths required');
    const expected=[...battle.attackers,...battle.defenders];
    if(Object.keys(strengths).length!==expected.length||expected.some(id=>!Object.prototype.hasOwnProperty.call(strengths,id)))throw Error('Strengths must exactly match all committed battle participants');
    const attackers=battle.attackers.map(id=>strengths[id]);
    const defenders=battle.defenders.map(id=>strengths[id]);
    return O.evaluate({attackers,defenders,defenderTerrain,allAttackersAcrossRiver,airSupportShift,fleetShift,die,
     majorRiverCrossers,attackerIds:battle.attackers,policy:combatPolicy||null,
     actor:current.baseline.actor,turn:current.baseline.cursor.turn});
   }
   function evaluateSelectedFromMap({strengths,airSupportShift=0,airSupportId=null,fleetShift=null,die=null}={}){
    if(current.status!=='battle-selected')throw Error('Select a committed battle before calculating odds');
    const battle=current.declaration.battles.find(x=>x.defenderHex===current.selected);
    const located=geography.evaluate(battle,current.baseline.state.units);
    const boundNaval=combatPolicy?.portSupport?S.create({map,policy:combatPolicy,counterConfig}).inspect({
     state:current.baseline.state,battle,actor:current.baseline.actor}):null;
    if(boundNaval&&fleetShift!==null)throw Error('Fleet shift is determined by source-bound support state');
    if(air&&airSupportShift!==0)throw Error('Source-bound air support cannot accept arbitrary shift');
    if(airSupportId!==null){
     if(!air)throw Error('Air support marker must be enabled');
     const allowed=air.available({state:current.baseline.state,cursor:current.baseline.cursor,actor:current.baseline.actor})
      .find(x=>x.faceId===airSupportId);
     if(!allowed)throw Error('Air support unavailable for battle');
     airSupportShift=allowed.shiftRating;
    }
    const result=evaluateSelected({strengths,defenderTerrain:located.defenderTerrain,
     allAttackersAcrossRiver:located.allAttackersAcrossRiver,airSupportShift,
     majorRiverCrossers:located.evidence.crossings.filter(x=>x.majorRiver).map(x=>x.unitId),
     fleetShift:boundNaval?boundNaval.fleetShift:fleetShift===null?0:fleetShift,die});
    return Object.freeze({...result,navalSupport:boundNaval,geography:located.evidence,status:'certified-geography-calculation-only'});
   }
   // Advisory, safe-only choices for DR outcomes: no dice are rolled, no
   // counter is revealed or removed, and no user-supplied strengths enter.
   // DRL/EX losses, fleet exceptions and forced retreats must be adjudicated
   // separately after a result; these are pre-consequence candidates only.
   function safeRetreatOptions(){
    if(current.status!=='battle-selected')throw Error('Select a committed battle before previewing retreats');
    if(!counterConfig||!combatPolicy)throw Error('Source-backed counter and consequence policies required');
    const battle=current.declaration.battles.find(b=>b.defenderHex===current.selected);
    // Do not advertise routes for battles whose underlying terrain/hexside
    // geography is not yet certified by the consequence handler.
    geography.evaluate(battle,current.baseline.state.units);
    return R.create({map,profile,combatPolicy}).enumerate({state:current.baseline.state,
     defenderHex:battle.defenderHex,defenderIds:battle.defenders});
   }
   // A postcombat advance into an active Fleet port creates a separate
   // destination commitment, saved in the session BEFORE the Fleet damage die.
   // Source legality is verified with the real consequence resolver using a
   // temporary die of 6; that provisional outcome is never committed or shown.
   function commitFleetDisplacement({die,choices={},to}={}){
    if(current.status!=='battle-selected'||!combatPolicy?.portSupport)
     throw Error('Fleet combat displacement requires a selected source-configured battle');
    if(!choices||typeof choices!=='object'||Array.isArray(choices)||
       Object.prototype.hasOwnProperty.call(choices,'fleetDisplacement'))
     throw Error('Fleet destination commitment may not contain a damage die');
    if(typeof to!=='string'||!to)throw Error('Source-registered Fleet destination required');
    if(air&&current.baseline.actor===combatPolicy.airSupport.owner&&!current.groundAirLocked)
     throw Error('Commit ground air choice before CRT resolution');
    const battle=current.declaration.battles.find(b=>b.defenderHex===current.selected);
    if(!battle)throw Error('Selected battle missing');
    const evaluator=X.create({map,profile,counterConfig,combatPolicy,geography,phaseConfig:config,enableAirSupport,rosterOverlay});
    const provisional=evaluator.resolve({state:current.baseline.state,battle,actor:current.baseline.actor,
     die,choices:{...choices,fleetDisplacement:{to,die:6}},
     cursor:current.baseline.cursor,airSupportId:current.groundAirChoice});
    if(provisional.event.fleetDisplacement?.kind!=='forced-fleet-displacement'||
       provisional.event.fleetDisplacement.to!==to)
     throw Error('Commitment does not cause verified forced Fleet entry');
    return pushHistory({...current,status:'fleet-die-pending',
     pendingFleetCombat:{die,choices:clone(choices),to}});
   }
   function completeResolution({die,choices}){
    if(!counterConfig||!combatPolicy)throw Error('Source-backed counter and consequence policies required');
    const battle=current.declaration.battles.find(b=>b.defenderHex===current.selected);
    if(!battle||current.resolved.some(e=>e.battle.defenderHex===battle.defenderHex))throw Error('Battle already resolved');
    if(air&&current.baseline.actor===combatPolicy.airSupport.owner&&!current.groundAirLocked)
     throw Error('Commit ground air choice before combat die');
    const evaluator=X.create({map,profile,counterConfig,combatPolicy,geography,phaseConfig:config,enableAirSupport,rosterOverlay});
    const effect=evaluator.resolve({state:current.baseline.state,battle,actor:current.baseline.actor,die,choices,
     cursor:current.baseline.cursor,airSupportId:current.groundAirChoice});
    const nextResolved=[...current.resolved,effect.event];
    const allDone=nextResolved.length===current.declaration.battles.length;
    const next=pushHistory({...current,status:allDone?'battles-resolved':'committed',selected:null,
     resolved:nextResolved,pendingFleetCombat:null,baseline:{...current.baseline,state:effect.state},groundAirChoice:null,groundAirLocked:false});
    return Object.freeze({ok:true,session:next,event:clone(effect.event)});
   }
   function rollFleetDisplacement(die){
    if(current.status!=='fleet-die-pending'||!current.pendingFleetCombat)
     throw Error('Commit Fleet destination before Fleet damage die');
    if(!Number.isInteger(die)||die<1||die>6)throw Error('Fleet damage roll must be a d6');
    const pending=current.pendingFleetCombat;
    return completeResolution({die:pending.die,
     choices:{...pending.choices,fleetDisplacement:{to:pending.to,die}}});
   }
   function resolveSelected(request={}){
    if(!request||typeof request!=='object'||Array.isArray(request)||
      Object.keys(request).some(k=>!['die','choices'].includes(k)))throw Error('Unbound support or unexpected combat input');
    if(current.status!=='battle-selected')throw Error('Select a committed battle before resolution');
    return completeResolution({die:request.die,choices:request.choices||{}});
   }
   // Kept as the old, intentionally unsupported API: the only action path
   // is resolveSelected, which requires a verified source policy and die.
   function recordResolution(){throw Error('Unbound direct combat-result recording is prohibited');}
   function finish(){
    if(!['no-battles-declared','battles-resolved'].includes(current.status))
     throw Error('Combat completion requires source-verified battle outcome handlers');
    const cursor=P.advance(config,current.baseline.cursor,()=>true);
    const nextPhase=P.current(config,cursor);
    const next=pushHistory({...current,status:'phase-finished',selected:null,
     baseline:{...current.baseline,cursor,actor:nextPhase?.owner||current.baseline.actor}});
    return Object.freeze({ok:true,session:next,nextPhase:nextPhase?.id||null});
   }
   function undo(){
    if(!current.history.length)return Object.freeze({ok:false,reason:'nothing-to-undo',session:controller(current)});
    const past=current.history[current.history.length-1];
    return Object.freeze({ok:true,session:controller({...past,history:current.history.slice(0,-1)})});
   }
   return Object.freeze({snapshot,availableAir,declareFleetAttack,resolveFleetAttack,finishAirSea,commit,select,commitGroundAir,evaluateSelected,evaluateSelectedFromMap,safeRetreatOptions,resolveSelected,commitFleetDisplacement,rollFleetDisplacement,recordResolution,finish,undo});
  }
 }
 return Object.freeze({create});
});
