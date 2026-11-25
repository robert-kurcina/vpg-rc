/* Checkpoint 153: replay-verified historical campaign CONTINUATION, not a
 * certified eight-turn game. Reuses the verified combat-phase journal,
 * movement rules and Fleet movement/reaction transactions. Buildup,
 * reinforcement and housekeeping are deliberately NOT bypassable.
 * Node-only developer engine interface; scenario rules are configuration data.
 */
'use strict';
const crypto=require('node:crypto');
const Phase=require('./phase_runtime');
const Combat=require('./historical_combat_session');
const Movement=require('./historical_movement_actions');
const Support=require('./historical_support_movement');
const Ports=require('./historical_port_support');
const NavalLogistics=require('./historical_naval_logistics');
const Buildup=require('./historical_buildup_phase');
const Housekeeping=require('./historical_housekeeping_phase');
const Territory=require('./territorial_state_transition');
const MovementBinding=require('./movement_binding');
const Rules=require('./movement_rules');
const FORMAT='wargame-historical-campaign-continuation', VERSION=1;
const MAX_ACTIONS=5000, MAX_BYTES=16*1024*1024;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function canonical(v){
 const seen=new WeakSet();
 function walk(x,depth){
  if(depth>64)throw Error('Campaign save nesting limit');
  if(x===null||typeof x==='string'||typeof x==='boolean')return x;
  if(typeof x==='number'&&Number.isFinite(x))return x;
  if(!Array.isArray(x)&&!obj(x))throw Error('Unsupported campaign save value');
  if(seen.has(x))throw Error('Cyclic campaign save value');
  seen.add(x);
  let result;
  if(Array.isArray(x)){
   if(Object.keys(x).length!==x.length)throw Error('Sparse campaign save array');
   result=x.map(y=>walk(y,depth+1));
  }else{
   // Null-prototype intermediate: safe own-key assignment without invoking
   // inherited setters. Sorted keys and the validated JSON representation stay identical.
   result=Object.create(null);
   for(const key of Object.keys(x).sort()){
    if(['__proto__','prototype','constructor'].includes(key))throw Error('Forbidden campaign save key');
    result[key]=walk(x[key],depth+1);
   }
  }
  seen.delete(x);return result;
 }
 const output=JSON.stringify(walk(v,0));
 if(Buffer.byteLength(output)>MAX_BYTES)throw Error('Campaign save too large');
 return output;
}
const clone=v=>JSON.parse(canonical(v));
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
function exact(value,keys,label){
 if(!obj(value)||Object.keys(value).length!==keys.length||keys.some(k=>!own(value,k)))
  throw Error('Invalid '+label+' fields');
}
function validateContext(context){
 if(!obj(context)||!obj(context.map)||!obj(context.profile)||!obj(context.config)||
  !obj(context.counterConfig)||!obj(context.combatPolicy)||!obj(context.cursor)||
  !obj(context.state)||typeof context.actor!=='string'||typeof context.enableAirSupport!=='boolean')
  throw Error('Explicit historical campaign source context required');
 const {config,profile,combatPolicy,actor,cursor,state}=context;
 Phase.validate(config);
 if(config.scenarioId!==profile.id||config.scenarioId!==combatPolicy.scenarioId||
    config.scenarioId!==state.scenarioId||config.scenarioId!==cursor.scenarioId)
  throw Error('Campaign scenario configuration mismatch');
 const phase=Phase.current(config,cursor);
 if(!phase||phase.owner!==actor||actor==='system')throw Error('Campaign opening must be a player phase');
 if(!obj(state.units)||Object.entries(state.units).some(([id,u])=>!obj(u)||id!==u.id||typeof u.hex!=='string'||u.owner!==config.players[0]&&u.owner!==config.players[1]))
  throw Error('Campaign ground-unit identity mismatch');
 if(Boolean(context.buildupPolicy)!==Boolean(context.buildupAllocation))
  throw Error('Buildup source policy and allocation must be supplied together');
 if(context.housekeepingPolicy&&!context.buildupPolicy)
  throw Error('Housekeeping victory requires source-bound buildup and city control');
 // A narrowly source-authorized empty first-turn buildup may run before the
 // remaining reinforcement/replacement roster has been integrated. It cannot
 // authorize a second-turn phase, placement, or extra replacement step.
 if(context.firstTurnEmptyBuildupPolicy){
  const p=context.firstTurnEmptyBuildupPolicy;
  const phase=config.phases.find(x=>x.id===p.phaseId);
  if(!obj(p)||p.schemaVersion!==1||p.scenarioId!==config.scenarioId||
     p.scope!=='source-verified-first-turn-empty-buildup-only'||
     p.status!=='experimental-journal-action-only-not-later-turn-buildup-or-full-campaign'||
     p.turn!==1||!config.players.includes(p.owner)||p.replacementSteps!==0||
     p.groundReinforcements!==0||p.supportArrivals!==0||
     phase?.kind!=='buildup'||phase.owner!==p.owner||
     !phase.permissions?.includes('reinforce')||!phase.permissions?.includes('replace')||
     !Array.isArray(p.source)||p.source.length<3||
     !Number.isInteger(p.initialGroundUnitCount)||p.initialGroundUnitCount<1||
     !Number.isInteger(p.initialSupportMarkerCount)||p.initialSupportMarkerCount<0||
     !Number.isInteger(p.initialCityCount)||p.initialCityCount<1||
     !obj(state.cityControl)||Object.keys(state.cityControl).length!==p.initialCityCount||
     !obj(state.supportMarkers)||Object.keys(state.supportMarkers).length!==p.initialSupportMarkerCount||
     Object.keys(state.units).length!==p.initialGroundUnitCount)
    throw Error('First-turn empty buildup is not source-authorized');
 }
 if(context.firstTurnEmptyBuildupPolicy&&context.buildupPolicy)
  throw Error('Cannot run overlapping buildup controllers');
 if(context.housekeepingPolicy)Housekeeping.create({map:context.map,config,policy:context.housekeepingPolicy,
  initialCityControl:context.buildupPolicy.initialCityControl});
 if(context.buildupPolicy)Buildup.create({map:context.map,profile,config,
  counterConfig:context.counterConfig,policy:context.buildupPolicy,allocation:context.buildupAllocation,fixedPolicy:context.fixedPolicy||null,
   combatPolicy:context.combatPolicy});
 const scope=clone({map:context.map,profile,config,counterConfig:context.counterConfig,
  combatPolicy,enableAirSupport:context.enableAirSupport,
  ...(context.rosterOverlay?{rosterOverlay:context.rosterOverlay}:{}),
  buildupPolicy:context.buildupPolicy||null,buildupAllocation:context.buildupAllocation||null,
  ...(context.housekeepingPolicy?{housekeepingPolicy:context.housekeepingPolicy}: {}),
  ...(context.fixedPolicy?{fixedPolicy:context.fixedPolicy}: {}),
  ...(context.firstTurnEmptyBuildupPolicy?{firstTurnEmptyBuildupPolicy:context.firstTurnEmptyBuildupPolicy}: {})});
 const origin=clone({cursor,actor,state});
 return {scopeHash:hash(scope),originHash:hash(origin)};
}
function normalizedAction(input){
 if(!obj(input)||typeof input.type!=='string')throw Error('Invalid campaign action');
 const byType={
  combat:['type','action'],
  'declare-ground-move':['type','request'],
  'commit-forced-port':['type','to'],
  'resolve-ground-move':['type'],
  'resolve-forced-ground-move':['type','die'],
  'declare-fleet-move':['type','to'],
  'roll-fleet-move':['type','die'],
  'finish-phase':['type'],
  'remove-overstack-unit':['type','unitId'],
  'place-reinforcement':['type','slotId','hex'],
  'place-evacuated-reinforcement':['type','unitId','hex'],
  'declare-naval-ground-transport':['type','unitId','destination'],
  'roll-naval-ground-transport':['type','die'],
  'apply-replacement':['type','unitId','hex'],
  'finish-buildup':['type'],
  'finish-housekeeping':['type']
 };
 if(!own(byType,input.type))throw Error('Unsupported campaign action');
 exact(input,byType[input.type],'campaign action');
 if(input.type==='declare-ground-move'){
  const request=input.request;
  if(!obj(request)||typeof request.unitId!=='string'||!Array.isArray(request.path)||
     Object.keys(request).some(k=>!['unitId','path','mode'].includes(k))||
     (request.mode!==undefined&&request.mode!=='rail'))throw Error('Invalid source movement request');
 }
 return clone(input);
}
function currentPhase(context,s){return Phase.current(context.config,s.cursor);}
function combatContext(context,s){
 return {map:context.map,profile:context.profile,config:context.config,
  counterConfig:context.counterConfig,combatPolicy:context.combatPolicy,
  enableAirSupport:context.enableAirSupport,rosterOverlay:context.rosterOverlay||null,cursor:s.cursor,actor:s.actor,state:s.state};
}
function phaseMovement(p){return p&&(p.kind==='movement'||p.kind==='special-movement')&&p.permissions?.includes('move');}
function navalPhase(p){return p?.kind==='naval-operations';}
function supportPhase(p){return p&&['special-movement','naval-operations'].includes(p.kind);}
function createMachine(context){
 const movement=Movement.create({map:context.map,profile:context.profile,
  config:context.config,supportPolicy:context.combatPolicy,counterConfig:context.counterConfig});
 const port=Ports.create({map:context.map,policy:context.combatPolicy,counterConfig:context.counterConfig});
 const support=context.combatPolicy.portSupport?Support.factory({map:context.map,policy:context.combatPolicy,counterConfig:context.counterConfig,
  phaseConfig:context.config}):null;
 const naval=context.buildupPolicy?.navalReplacementPolicy?NavalLogistics.create({
  map:context.map,combatPolicy:context.combatPolicy,counterConfig:context.counterConfig,
  sourcePolicy:context.buildupPolicy.navalReplacementPolicy}):null;
 const active=s=>currentPhase(context,s);
 const emptyBuildup=context.firstTurnEmptyBuildupPolicy||null;
 const emptyBuildupAllowed=s=>Boolean(emptyBuildup&&s.cursor.turn===emptyBuildup.turn&&
  active(s)?.id===emptyBuildup.phaseId&&s.actor===emptyBuildup.owner);
 const buildup=context.buildupPolicy?Buildup.create({map:context.map,profile:context.profile,config:context.config,
  counterConfig:context.counterConfig,policy:context.buildupPolicy,allocation:context.buildupAllocation,fixedPolicy:context.fixedPolicy||null,
  combatPolicy:context.combatPolicy}):null;
 const housekeeping=context.housekeepingPolicy?Housekeeping.create({map:context.map,config:context.config,
  policy:context.housekeepingPolicy,initialCityControl:context.buildupPolicy.initialCityControl,
  communicated:(hex,owner,units)=>buildup.communicated(hex,owner,units)}):null;
 // Only opt-in territorial profiles have this additional source-bound board.
 // MapMovementGraph's existing authorization gate remains authoritative.
 const territoryBoard=context.profile.territorialPolicy?
  MovementBinding.build(context.map,context.profile).board:null;
 const footprints=units=>JSON.stringify(Object.entries(units).sort(([a],[b])=>a.localeCompare(b))
  .map(([id,u])=>[id,u.hex]));
 function skipEmptyNaval(s){
  const phase=active(s);
  if(!navalPhase(phase))return s;
  const marker=context.combatPolicy.portSupport?port.validateMarker(s.state):null;
  let available=false;
  if(marker&&support&&phase.permissions.includes('move-support')){
   available=Object.values(port.portHexes).some(to=>{try{port.validateDestination({state:s.state,to});return true;}catch(_){return false;}});
  }
  if(marker&&naval&&buildup&&phase.permissions.includes('naval-ground-transport')&&!available){
   available=Object.values(s.state.units).some(unit=>{
    if(unit.owner!==s.actor||unit.hex!==marker.hex)return false;
    try{naval.transport({state:s.state,actor:s.actor,unitId:unit.id,destination:{kind:'off-map'},turn:s.cursor.turn,die:6});return true;}catch(_){return false;}
   });
  }
  if(!available){
   s.cursor=Phase.advance(context.config,s.cursor,()=>true);s.actor=active(s)?.owner||'system';
   s.lastEvent={...(s.lastEvent||{}),skippedPhase:phase.id};
   if(active(s)?.kind==='combat')s.combat=Combat.create(combatContext(context,s));
   if(active(s)?.kind==='buildup'&&buildup)s.buildup=buildup.openingPhase();
  }
  return s;
 }
 function finalizeTerritory(s,before,priorPhase){
  if(!territoryBoard||footprints(s.state.units)===before)return priorPhase!==active(s)?.id?skipEmptyNaval(s):s;
  const committed=Territory.commit({profile:context.profile,board:territoryBoard,state:s.state});
  if(!committed.ok)throw Error('Campaign territory transition unverified: '+committed.reason);
  s.state=committed.state;
  if(committed.event)s.lastEvent={...(s.lastEvent||{}),territoryEvent:committed.event};
  return priorPhase!==active(s)?.id?skipEmptyNaval(s):s;
 }
 function pendingReaction(s){
  const req=s.pendingGround;
  if(!req||!context.combatPolicy.portSupport)return {required:false};
  const marker=port.validateMarker(s.state);
  const u=s.state.units[req.unitId],to=req.path.at(-1);
  if(!marker||u.owner===context.combatPolicy.portSupport?.owner||to!==marker.hex||u.hex===to)
   return {required:false};
  const prospective=clone(s.state);
  prospective.units[req.unitId].hex=to;
  return {required:true,options:port.forcedDestinations({state:prospective})};
 }
 function initial(){
  const first=Phase.start(context.config);
  const opening=context.cursor.turn===first.turn&&context.cursor.index===first.index;
  const ground=buildup&&opening?buildup.initialize(context.state):clone(context.state);
  if(buildup&&!opening&&(!ground.cityControl||!ground.buildupDeployedIds))
   throw Error('Continuation buildup requires previously initialized campaign state');
  const state={cursor:clone(context.cursor),actor:context.actor,state:ground,
   usedUnitIds:[],fleetUsed:false,pendingGround:null,pendingPort:null,pendingFleet:null,pendingNavalGround:null,
   lastEvent:null,combat:null,buildup:null,terminal:null};
  if(active(state)?.kind==='combat')state.combat=Combat.create(combatContext(context,state));
  if(active(state)?.kind==='buildup'&&buildup)state.buildup=buildup.openingPhase();
  return state;
 }
 function groundDeclarationGuard(s){
  const phase=active(s);
  if(!phase||phase.owner!==s.actor||s.actor==='system')throw Error('Campaign phase actor mismatch');
  if(!phaseMovement(phase))throw Error('Ground movement not permitted in naval operations');
  if(s.stackingCleanup)throw Error('Movement closed: resolve end-phase overstacking');
  if(s.pendingGround||s.pendingFleet||s.pendingNavalGround)throw Error('Resolve pending movement decision first');
 }
 function validateGroundDeclaration(s,action){
  groundDeclarationGuard(s);
  const req=action.request;
  if(s.usedUnitIds.includes(req.unitId))throw Error('Unit already used this movement phase');
  if(!movement.legal({cursor:s.cursor,actor:s.actor,state:s.state},req))
   throw Error('Ground movement is not source-legal');
 }
 function validateGroundBatch(s,actions){
  groundDeclarationGuard(s);
  const result=actions.map(()=>false),requests=[],indices=[];
  actions.forEach((action,i)=>{
   if(action?.type==='declare-ground-move'&&!s.usedUnitIds.includes(action.request.unitId)){
    indices.push(i);requests.push(action.request);
   }
  });
  const legal=movement.legalBatch({cursor:s.cursor,actor:s.actor,state:s.state},requests);
  indices.forEach((i,j)=>{result[i]=legal[j];});
  return result;
 }
 function step(s,action){
  const priorFootprints=territoryBoard?footprints(s.state.units):null;
  const phase=active(s);
  if(!phase)throw Error('Historical campaign already complete');
  if(phase.owner==='system'){
   if(!housekeeping||phase.kind!=='housekeeping')
    throw Error('Historical phase not yet implemented: '+phase.id);
   if(action.type!=='finish-housekeeping')throw Error('Only housekeeping completion authorized');
   if(s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.pendingPort!==null||s.combat||s.buildup)
    throw Error('Housekeeping cannot bypass unresolved decisions');
   const ending=housekeeping.close({cursor:s.cursor,state:s.state,actor:s.actor});
   s.cursor=Phase.advance(context.config,s.cursor,()=>true);
   s.actor=active(s)?.owner||'system';
   s.terminal=ending.terminal;
   s.lastEvent=ending.event;
   s.usedUnitIds=[];s.fleetUsed=false;s.pendingGround=null;s.pendingFleet=null;s.pendingNavalGround=null;s.pendingPort=null;
   if(active(s)?.kind==='buildup'&&buildup)s.buildup=buildup.openingPhase();
   if(active(s)?.kind==='combat')s.combat=Combat.create(combatContext(context,s));
   return finalizeTerritory(s,priorFootprints,phase.id);
  }
  if(phase.owner!==s.actor)throw Error('Historical phase actor mismatch');
  if(phase.kind==='buildup'){
   if(!buildup&&emptyBuildupAllowed(s)){
    if(s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.combat||s.buildup)
     throw Error('Unresolved choice before zero-action buildup');
    if(action.type!=='finish-buildup')
     throw Error('No replacements or reinforcements on this first-turn buildup');
    s.lastEvent={kind:'buildup-finished',turn:s.cursor.turn,actor:s.actor,
     lostGroundSlotIds:[],supportArrivals:[],forfeitedReplacementSteps:0,
     sourceScope:emptyBuildup.scope};
    s.cursor=Phase.advance(context.config,s.cursor,()=>true);
    s.actor=active(s)?.owner||'system';
    if(active(s)?.kind==='combat')s.combat=Combat.create(combatContext(context,s));
    return finalizeTerritory(s,priorFootprints,phase.id);
   }
   if(!buildup)throw Error('Historical phase not yet implemented: '+phase.id);
   if(s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.combat)throw Error('Buildup phase has incomplete prior transaction');
   if(!s.buildup)s.buildup=buildup.openingPhase();
   if(action.type==='place-reinforcement'){
    const result=buildup.place({state:s.state,cursor:s.cursor,actor:s.actor,phase:s.buildup,slotId:action.slotId,hex:action.hex});
    s.state=result.state;s.buildup=result.phase;s.lastEvent=result.event;
   }else if(action.type==='place-evacuated-reinforcement'){
    const result=buildup.placeEvacuated({state:s.state,cursor:s.cursor,actor:s.actor,phase:s.buildup,unitId:action.unitId,hex:action.hex});
    s.state=result.state;s.buildup=result.phase;s.lastEvent=result.event;
   }else if(action.type==='apply-replacement'){
    const result=buildup.replace({state:s.state,cursor:s.cursor,actor:s.actor,phase:s.buildup,unitId:action.unitId,hex:action.hex});
    s.state=result.state;s.buildup=result.phase;s.lastEvent=result.event;
   }else if(action.type==='finish-buildup'){
    const result=buildup.close({state:s.state,cursor:s.cursor,actor:s.actor,phase:s.buildup});
    s.state=result.state;s.lastEvent=result.event;s.buildup=null;
    s.cursor=Phase.advance(context.config,s.cursor,()=>true);s.actor=active(s)?.owner||'system';
    if(active(s)?.kind==='combat')s.combat=Combat.create(combatContext(context,s));
   }else throw Error('Only source-bound buildup actions permitted during buildup phase');
   return finalizeTerritory(s,priorFootprints,phase.id);
  }
  if(phase.kind==='combat'){
   if(action.type!=='combat')throw Error('Only source-backed combat actions permitted in combat phase');
   if(!s.combat)s.combat=Combat.create(combatContext(context,s));
   const result=s.combat.execute(action.action);
   s.combat=result.session;
   const snapshot=s.combat.snapshot();
   s.cursor=snapshot.cursor;s.state=snapshot.state;
   s.lastEvent=result.event??null;
   if(snapshot.status==='phase-finished'){
    if(buildup)for(const event of snapshot.resolved||[]){
     for(const r of event.retreats||[]){
      const defenderOwner=event.battle?.defenders?.includes(r.unitId)?
       context.config.players.find(p=>p!==s.actor):null;
      if(defenderOwner)buildup.recordControl(s.state,defenderOwner,r.route||[]);
     }
     if(event.advanced)buildup.recordControl(s.state,s.actor,[event.battle.defenderHex]);
    }
    s.actor=active(s)?.owner||'system';
    s.combat=null;
    s.usedUnitIds=[];s.fleetUsed=false;
    if(active(s)?.kind==='buildup'&&buildup)s.buildup=buildup.openingPhase();
   }
   return finalizeTerritory(s,priorFootprints,phase.id);
  }
  if(!phaseMovement(phase)&&!navalPhase(phase))throw Error('Historical phase not yet implemented: '+phase.id);
  if(s.stackingCleanup&&!['remove-overstack-unit','finish-phase'].includes(action.type))throw Error('Resolve end-phase stacking before continuing');
  if(action.type==='remove-overstack-unit'){
   if(!s.stackingCleanup||!phaseMovement(phase)||!Rules.stackPenalty(context.profile,s.state.units,s.actor).choices.includes(action.unitId))
    throw Error('Select an excess friendly ground unit after committing phase completion');
   const hex=s.state.units[action.unitId].hex;delete s.state.units[action.unitId];
   s.lastEvent={kind:'overstack-unit-removed',unitId:action.unitId,hex};
  }else if(action.type==='declare-ground-move'){
   validateGroundDeclaration(s,action);
   const req=action.request;
   s.pendingGround=clone(req);s.pendingPort=null;
  }else if(action.type==='commit-forced-port'){
   if(!s.pendingGround||s.pendingPort||s.pendingFleet||s.pendingNavalGround)throw Error('No uncommitted forced Fleet destination');
   const reaction=pendingReaction(s);
   if(!reaction.required||!reaction.options.some(x=>x.hex===action.to))
    throw Error('Invalid forced Fleet destination');
   s.pendingPort=action.to;
  }else if(['resolve-ground-move','resolve-forced-ground-move'].includes(action.type)){
   if(!s.pendingGround||s.pendingFleet||s.pendingNavalGround)throw Error('No pending ground movement');
   const reaction=pendingReaction(s);
   let request=clone(s.pendingGround);
   if(reaction.required&&reaction.options.length){
    if(action.type!=='resolve-forced-ground-move'||!s.pendingPort||
       !Number.isInteger(action.die)||action.die<1||action.die>6)
     throw Error('Precommit forced Fleet destination before its die roll');
    request.fleetDisplacement={to:s.pendingPort,die:action.die};
   }else if(action.type!=='resolve-ground-move'||s.pendingPort!==null)
    throw Error('No Fleet damage die is authorized for this move');
   const outcome=movement.execute({cursor:s.cursor,actor:s.actor,state:s.state},request);
   if(!outcome.ok)throw Error('Ground movement rejected: '+outcome.reason);
   s.state=outcome.state;s.lastEvent=outcome.result;
   if(buildup)buildup.recordControl(s.state,s.actor,request.path.slice(1));
   s.usedUnitIds.push(request.unitId);s.pendingGround=null;s.pendingPort=null;
  }else if(action.type==='declare-fleet-move'){
   if(!support||!supportPhase(phase)||!phase.permissions?.includes('move-support')||
      s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.fleetUsed)
    throw Error('Fleet movement not available in current phase');
   // This verified transaction validates the owning phase and destination.
   support.create({cursor:s.cursor,actor:s.actor,state:s.state}).declareMove(action.to);
   s.pendingFleet=action.to;
  }else if(action.type==='roll-fleet-move'){
   if(s.pendingFleet===null||s.pendingGround||s.pendingNavalGround)throw Error('Commit Fleet destination before its die');
   const result=support.create({cursor:s.cursor,actor:s.actor,state:s.state})
    .declareMove(s.pendingFleet).resolveDamage(action.die).snapshot();
   s.state=result.state;s.lastEvent=result.event;s.pendingFleet=null;s.fleetUsed=true;
  }else if(action.type==='declare-naval-ground-transport'){
   // Explicit scenario configuration authorizes the timing convention.
   if(!naval||!buildup||!supportPhase(phase)||s.actor!=='soviet'||
      !phase.permissions?.includes('naval-ground-transport')||
      s.pendingGround||s.pendingFleet||s.pendingNavalGround||s.usedUnitIds.includes(action.unitId))
    throw Error('Naval ground transport lacks phase permission or has a pending action');
   if(!obj(action.destination)||!['port','off-map'].includes(action.destination.kind))
    throw Error('Invalid naval destination commitment');
   // A legal dry-run with a non-damaging die validates the destination without
   // consuming a roll or changing any live game state.
   naval.transport({state:s.state,actor:s.actor,unitId:action.unitId,
    destination:action.destination,turn:s.cursor.turn,die:6,
    canOccupyPort:args=>buildup.canReceiveNavalTransport(args)});
   s.pendingNavalGround={unitId:action.unitId,destination:clone(action.destination)};
   s.lastEvent={kind:'naval-ground-transport-declared',unitId:action.unitId,destination:clone(action.destination)};
  }else if(action.type==='roll-naval-ground-transport'){
   if(!naval||!buildup||!s.pendingNavalGround||s.pendingGround||s.pendingFleet||
      !supportPhase(phase)||s.actor!=='soviet'||
      !phase.permissions?.includes('naval-ground-transport'))
    throw Error('Naval transport destination must be committed before damage die');
   const pending=s.pendingNavalGround;
   const result=naval.transport({state:s.state,actor:s.actor,unitId:pending.unitId,
    destination:pending.destination,turn:s.cursor.turn,die:action.die,
    canOccupyPort:args=>buildup.canReceiveNavalTransport(args)});
   s.state=result.state;s.lastEvent=result.event;s.pendingNavalGround=null;
   s.usedUnitIds.push(pending.unitId);
   if(pending.destination.kind==='port'&&result.event.result!=='eliminated')
    buildup.recordControl(s.state,s.actor,[pending.destination.hex]);
  }else if(action.type==='finish-phase'){
   if(s.pendingGround||s.pendingFleet||s.pendingNavalGround)throw Error('Unresolved movement or damage die');
   const penalty=Rules.stackPenalty(context.profile,s.state.units,s.actor);
   if(phaseMovement(phase)&&penalty.excess){
    if(s.stackingCleanup)throw Error('Remove remaining excess units before completing phase');
    s.stackingCleanup=true;s.lastEvent={kind:'overstack-removal-required',hexes:penalty.hexes,excess:penalty.excess};
    return finalizeTerritory(s,priorFootprints,phase.id);
   }
   delete s.stackingCleanup;
   // Movement may be voluntarily omitted; no buildup/reinforcement/housekeeping
   // transition is inferred or silently advanced here.
   s.cursor=Phase.advance(context.config,s.cursor,()=>true);
   s.actor=active(s)?.owner||'system';
   s.usedUnitIds=[];s.fleetUsed=false;s.pendingPort=null;s.pendingNavalGround=null;s.lastEvent={kind:'phase-complete',phaseId:phase.id};
   if(active(s)?.kind==='combat'&&s.actor!=='system')s.combat=Combat.create(combatContext(context,s));
   if(active(s)?.kind==='buildup'&&buildup)s.buildup=buildup.openingPhase();
  }else throw Error('Unsupported movement-phase action: '+action.type);
  return finalizeTerritory(s,priorFootprints,phase.id);
 }
 return {initial,step,validateGroundDeclaration,validateGroundBatch,phase:active,buildupSupported:s=>Boolean(buildup)||emptyBuildupAllowed(s),
  housekeepingEnabled:Boolean(housekeeping)};
}
function snapshotValue(machine,s,length){
 const phase=machine.phase(s);
 return {cursor:s.cursor,actor:s.actor,state:s.state,phaseId:phase?.id||null,
  phaseKind:phase?.kind||null,phaseSupported:Boolean(phase?.kind==='combat'||phaseMovement(phase)||navalPhase(phase)||
   (phase?.kind==='buildup'&&machine.buildupSupported(s))||
   (phase?.kind==='housekeeping'&&Boolean(machine.housekeepingEnabled))),
  usedUnitIds:s.usedUnitIds,fleetUsed:s.fleetUsed,
  pendingGround:s.pendingGround,pendingPort:s.pendingPort,pendingFleet:s.pendingFleet,
  ...(s.pendingNavalGround?{pendingNavalGround:s.pendingNavalGround}:{}),
  combat:s.combat?.snapshot()||null,buildup:s.buildup,lastEvent:s.lastEvent,actionCount:length,
  ...(s.stackingCleanup?{stackingCleanup:true}:{}),
  ...(s.terminal?{terminal:s.terminal}: {})};
}
// Public snapshots remain detached and canonical. Hashing can serialize the
// same private value directly, without first serializing and parsing a copy.
function snapshotOf(machine,s,length){return clone(snapshotValue(machine,s,length));}
function snapshotHash(machine,s,length){return hash(snapshotValue(machine,s,length));}
function replay(context,journal,machine){
 if(!Array.isArray(journal)||journal.length>MAX_ACTIONS)throw Error('Campaign journal length limit');
 let s=machine.initial();const receipts=[];
 for(const item of journal){
  exact(item,['action','stateHash'],'campaign journal record');
  const action=normalizedAction(item.action);
  if(!/^[a-f0-9]{64}$/.test(item.stateHash))throw Error('Invalid campaign journal hash');
  s=machine.step(s,action);
  const actual=snapshotHash(machine,s,receipts.length+1);
  if(item.stateHash!==actual)throw Error('Campaign action replay mismatch');
  receipts.push({action,stateHash:actual});
 }
 return {s,receipts};
}
function makeSession(context,machine,s,records,binding){
 function snapshot(){return snapshotOf(machine,s,records.length);}
 // One authoritative transaction path for committed actions and disposable
 // read-only legality probes. The probe never creates a campaign journal entry,
 // computes a save hash, or returns mutable draft state to its caller.
 function draftStep(state,action){
  return machine.step({...state,state:clone(state.state),cursor:clone(state.cursor),
   usedUnitIds:[...state.usedUnitIds],pendingGround:clone(state.pendingGround),pendingPort:state.pendingPort,
   pendingFleet:state.pendingFleet,pendingNavalGround:clone(state.pendingNavalGround),combat:state.combat,buildup:clone(state.buildup)},action);
 }
 function adjudicate(input){
  if(records.length>=MAX_ACTIONS)throw Error('Campaign journal length limit');
  const action=normalizedAction(input);
  return {action,next:draftStep(s,action)};
 }
 // Search-only view: no commit, save, undo, journal, RNG or mutable state.
 // Its logical action count still observes the campaign journal limit.
 function projectGround(state,length,input){
  if(length+2>MAX_ACTIONS)throw Error('Campaign journal length limit');
  const action=normalizedAction(input);
  if(action.type!=='declare-ground-move')throw Error('Only deterministic ground movement can be projected');
  const pending=draftStep(state,action);
  const next=draftStep(pending,{type:'resolve-ground-move'}),count=length+2;
  return Object.freeze({snapshot:()=>snapshotOf(machine,next,count),
   canExecuteGroundBatch:inputs=>probeGroundBatch(next,count,inputs),
   projectGroundMove:input=>projectGround(next,count,input)});
 }
 function execute(input){
  const {action,next}=adjudicate(input);
  const record={action,stateHash:snapshotHash(machine,next,records.length+1)};
  return Object.freeze({session:makeSession(context,machine,next,[...records,record],binding),
   event:clone(next.lastEvent)});
 }
 function canExecute(input){
  try{
   // Ground declaration only checks legality and records a pending request.
   // The shared validator delegates to PhaseActions.legal, which detaches
   // its inputs. No board, cursor or territory transition is performed.
   if(records.length>=MAX_ACTIONS)throw Error('Campaign journal length limit');
   if(input?.type==='declare-ground-move')machine.validateGroundDeclaration(s,normalizedAction(input));
   else adjudicate(input);
   return true;
  }catch(_){return false;}
 }
 // Pure batch probe for the catalogue; malformed or non-ground actions
 // are independently false, and phase-wide rejection rejects the batch.
 function probeGroundBatch(state,length,inputs){
  if(!Array.isArray(inputs))throw Error('Invalid ground probe batch');
  try{
   if(length>=MAX_ACTIONS)throw Error('Campaign journal length limit');
   const actions=inputs.map(input=>{try{return normalizedAction(input);}catch(_){return null;}});
   return machine.validateGroundBatch(state,actions);
  }catch(_){return inputs.map(()=>false);}
 }
 function undo(){
  if(!records.length)return Object.freeze({ok:false,reason:'nothing-to-undo',session:makeSession(context,machine,s,records,binding)});
  const previous=replay(context,records.slice(0,-1),machine);
  return Object.freeze({ok:true,session:makeSession(context,machine,previous.s,previous.receipts,binding)});
 }
 function save(){
  const payload={format:FORMAT,version:VERSION,scenarioId:context.config.scenarioId,
   bindings:clone(binding),origin:clone({cursor:context.cursor,actor:context.actor,state:context.state}),
   journal:clone(records),finalStateHash:snapshotHash(machine,s,records.length)};
  return {...payload,integrity:{algorithm:'SHA-256',digest:hash(payload)}};
 }
 // Copy the small action ledger without rehashing the whole opening and save.
 function journal(){return clone(records);}
 return Object.freeze({snapshot,execute,canExecute,canExecuteGroundBatch:inputs=>probeGroundBatch(s,records.length,inputs),projectGroundMove:input=>projectGround(s,records.length,input),undo,save,journal});
}
function create(context){
 const binding=validateContext(context),source=clone(context),machine=createMachine(source);
 return makeSession(source,machine,machine.initial(),[],binding);
}
function restore(saved,context){
 canonical(saved);
 exact(saved,['format','version','scenarioId','bindings','origin','journal','finalStateHash','integrity'],'campaign save');
 if(saved.format!==FORMAT||saved.version!==VERSION||saved.scenarioId!==context?.config?.scenarioId)
  throw Error('Unsupported campaign save version or scenario');
 exact(saved.integrity,['algorithm','digest'],'campaign integrity');
 if(saved.integrity.algorithm!=='SHA-256'||!/^[a-f0-9]{64}$/.test(saved.integrity.digest))
  throw Error('Invalid campaign checksum');
 const {integrity,...payload}=saved,computed=hash(payload);
 if(!crypto.timingSafeEqual(Buffer.from(integrity.digest,'hex'),Buffer.from(computed,'hex')))
  throw Error('Campaign save checksum mismatch');
 const binding=validateContext(context);
 exact(saved.bindings,['scopeHash','originHash'],'campaign binding');
 if(saved.bindings.scopeHash!==binding.scopeHash){
  const legacy=clone(context);
  if(legacy.profile.allowTemporaryMovementOverstack!==true)throw Error('Campaign source/configuration mismatch');
  delete legacy.profile.allowTemporaryMovementOverstack;
  if(saved.bindings.scopeHash!==validateContext(legacy).scopeHash)throw Error('Campaign source/configuration mismatch');
 }
 if(saved.bindings.originHash!==binding.originHash||hash(saved.origin)!==binding.originHash)
  throw Error('Campaign opening state mismatch');
 const source=clone(context),machine=createMachine(source),result=replay(source,saved.journal,machine);
 if(!/^[a-f0-9]{64}$/.test(saved.finalStateHash)||
    snapshotHash(machine,result.s,result.receipts.length)!==saved.finalStateHash)
  throw Error('Campaign final replay mismatch');
 return makeSession(source,machine,result.s,result.receipts,binding);
}
module.exports=Object.freeze({FORMAT,VERSION,MAX_ACTIONS,create,restore});
