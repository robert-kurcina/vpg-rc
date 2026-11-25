/* Observable, stationary counterattack exposure. Conditional CRT probabilities,
 * NOT an estimate of actual next-turn elimination or an authorization to attack.
 * No hypothetical movement, hidden face lookup, support allocation or dice.
 */
'use strict';
const Phase=require('./phase_runtime');
const Binding=require('./movement_binding');
const Movement=require('./movement_rules');
const Declarations=require('./historical_combat_declarations');
const Geography=require('./historical_combat_geography');
const Consequences=require('./historical_combat_consequences');
const CRT=require('./historical_crt');
function horizon(config,cursor,owner){
 let next=cursor, friendlyMovement=[],opposingPreparation=[];
 while(!next.complete){
  next=Phase.advance(config,next,()=>true);
  if(next.complete)break;
  const p=Phase.current(config,next);
  if(p.owner!==owner&&p.owner!=='system'&&p.kind==='combat')return {cursor:next,actor:p.owner,friendlyMovement,opposingPreparation};
  if(p.owner===owner&&['movement','special-movement','naval-operations'].includes(p.kind))friendlyMovement.push(p.id);
  if(p.owner!==owner&&p.owner!=='system')opposingPreparation.push(p.id);
 }
 return {cursor:null,actor:null,friendlyMovement,opposingPreparation};
}
function create(context){
 const {map,profile,config,combatPolicy}=context;
 const binding=Binding.build(map,profile), board=binding.board;
 const dec=Declarations.create({map,profile,config,combatPolicy});
 const geo=Geography.create(map,profile,{cityMarkerMode:combatPolicy?.cityMarkerMode,fortificationMode:combatPolicy?.fortificationMode});
 const evaluator=Consequences.create({...context,phaseConfig:config,geography:geo});
 const variant=combatPolicy?.crtVariant||'standard';
 // Independent one-unit withdrawal candidates on the unchanged board.
 // No prediction of joint stack escape, enemy movement or future survival.
 function withdrawal({state,cursor,owner,hex,maxStates=50000}){
  const units=Object.values(state.units).filter(u=>u.hex===hex&&u.owner===owner&&!u.marker);
  if(!units.length)throw Error('Withdrawal target must contain friendly ground units');
  let next=cursor, opportunity=null, intervening=[];
  while(!next.complete){
   next=Phase.advance(config,next,()=>true);
   if(next.complete)break;
   const p=Phase.current(config,next);
   if(p.owner!==owner&&p.owner!=='system'&&p.kind==='combat')break;
   if(p.owner===owner&&['movement','special-movement'].includes(p.kind)){
    opportunity={cursor:next,phase:p.id,kind:p.kind};break;
   }
   intervening.push(p.id);
  }
  const result={scope:'independent-single-phase-static-board',opportunity,intervening,units:[],jointEscape:null,survivalRisk:null};
  if(!opportunity)return result;
  const phase={kind:opportunity.kind,owner},turn=opportunity.cursor.turn;
  const moveContext=Binding.context(binding,phase,state.units,turn,state.territory);
  for(const u of units){
   const modes=[null];
   if(phase.kind==='special-movement'&&owner==='soviet'&&u.class==='infantry')modes.push('rail');
   const routes=[];let truncated=false;
   for(const mode of modes){
    let search;
    try{search=Binding.legalRoutes(binding,phase,state.units,turn,u.id,{mode,maxStates,territory:state.territory});}
    catch(e){if(e.message==='legal-pathfinding: search-limit-exceeded'){truncated=true;continue;}throw e;}
    for(const r of search.reachable())routes.push({destination:r.id,path:r.path,cost:r.cost,mode,outsideCurrentEnemyZOC:!Movement.enemyZOC(moveContext,r.id,owner)});
   }
   result.units.push({unitId:u.id,routes,truncated,hasOutsideCurrentEnemyZOC:routes.some(r=>r.outsideCurrentEnemyZOC)?true:truncated?null:false});
  }
  return result;
 }
 // Search ordered withdrawals in one future friendly ground phase. A witness
 // proves legal relocation, not safety against subsequent enemy preparation.
 function coordinatedWithdrawal({state,cursor,owner,hex,unitIds=null,originHexes=null,maxNodes=128,maxStates=5000,maxRouteSearches=256}){
  for(const v of [maxNodes,maxStates,maxRouteSearches])if(!Number.isSafeInteger(v)||v<1)throw Error('Invalid withdrawal budget');
  const ids=Object.values(state.units).filter(u=>(originHexes?originHexes.includes(u.hex):u.hex===hex)&&u.owner===owner&&!u.marker&&(!unitIds||unitIds.includes(u.id))).map(u=>u.id).sort();
  if(!ids.length)throw Error('Withdrawal target must contain friendly ground units');
  let next=cursor,opportunity=null;
  while(!next.complete){next=Phase.advance(config,next,()=>true);if(next.complete)break;
   const p=Phase.current(config,next);
   if(p.owner!==owner&&p.owner!=='system'&&p.kind==='combat')break;
   if(p.owner===owner&&['movement','special-movement'].includes(p.kind)){opportunity={cursor:next,phase:p.id,kind:p.kind};break;}
  }
  const out={scope:'bounded-coordinated-single-phase-static-board',opportunity,nodes:0,routeSearches:0,truncated:false,best:null,jointEscape:null,survivalRisk:null};
  if(!opportunity)return out;
  const phase={kind:opportunity.kind,owner},turn=opportunity.cursor.turn;
  const visited=new Set();
  function visit(current,moves){
   const key=JSON.stringify([ids.map(id=>[id,current.units[id].hex]),moves.map(m=>m.unitId).sort(),current.territory||null]);
   if(visited.has(key))return;
   if(out.nodes>=maxNodes){out.truncated=true;return;}
   visited.add(key);out.nodes++;
   const mc=Binding.context(binding,phase,current.units,turn,current.territory);
   const escaped=ids.filter(id=>current.units[id].hex!==state.units[id].hex&&!Movement.enemyZOC(mc,current.units[id].hex,owner));
   if(!out.best||escaped.length>out.best.escaped.length)out.best={escaped,moves:[...moves]};
   if(escaped.length===ids.length)return;
   for(const id of ids){
    if(moves.some(m=>m.unitId===id))continue;
    const u=current.units[id];
    const modes=[null];if(phase.kind==='special-movement'&&owner==='soviet'&&u.class==='infantry')modes.push('rail');
    for(const mode of modes){
     if(out.best.escaped.length===ids.length)return;
     if(out.routeSearches>=maxRouteSearches||out.nodes>=maxNodes){out.truncated=true;return;}
     out.routeSearches++;
     let search;try{search=Binding.legalRoutes(binding,phase,current.units,turn,id,{mode,maxStates,territory:current.territory});}
     catch(e){if(e.message==='legal-pathfinding: search-limit-exceeded'){out.truncated=true;continue;}throw e;}
     for(const r of search.reachable()){
      if(Movement.enemyZOC(mc,r.id,owner))continue;
      const fleet=current.supportMarkers?.[combatPolicy?.portSupport?.markerKey];
      if(fleet&&fleet.owner!==owner&&fleet.hex===r.id){out.truncated=true;continue;}
      const valid=Binding.move(binding,phase,current.units,turn,{unitId:id,path:r.path,mode},current.territory);
      if(!valid.ok)continue;
      const moved={...current,units:{...current.units,[id]:{...u,hex:r.id}}};
      const transition=require('./territorial_state_transition').commit({profile,board,state:moved});
      if(!transition.ok){out.truncated=true;continue;}
      visit(transition.state,[...moves,{unitId:id,destination:r.id,path:r.path,mode}]);
      if(out.best.escaped.length===ids.length)return;
      if(out.nodes>=maxNodes){out.truncated=true;return;}
     }
    }
   }
  }
  visit(state,[]);
  // A negative search result is scoped to direct withdrawals outside current ZOC.
  out.jointEscape=out.best.escaped.length===ids.length?true:out.truncated?null:false;
  return out;
 }
 function assess({state,cursor,owner,hex}){
  const defenders=Object.values(state.units).filter(u=>u.hex===hex);
  if(!defenders.length||defenders.some(u=>u.owner!==owner))throw Error('Threat target must contain friendly ground units');
  const h=horizon(config,cursor,owner);
  const result={...h,hex,knownPlans:0,unknownPlans:0,strongest:null,eliminationRisk:null,scope:'stationary-unsupported-conditional-DE-only'};
  if(!h.cursor)return result;
  const groups=[];
  for(const e of board.edges){
   const neighbor=e.a===hex?e.b:e.b===hex?e.a:null;
   if(!neighbor||!e.verified||e.impassable||e.lake||e.allSea)continue;
   const units=Object.values(state.units).filter(u=>u.hex===neighbor&&u.owner===h.actor);
   if(units.length)groups.push(units.map(u=>u.id));
  }
  function visit(i,attackers){
   if(i<groups.length){visit(i+1,attackers);for(const id of groups[i])visit(i+1,[...attackers,id]);return;}
   if(!attackers.length)return;
   let b;try{b=dec.declare({cursor:h.cursor,actor:h.actor,state},[{defenderHex:hex,attackers}]).battles[0];}catch{return;}
   const odds=evaluator.previewKnownOdds({state,battle:b,actor:h.actor,cursor:h.cursor});
   if(odds===null){result.unknownPlans++;return;}
   result.knownPlans++;
   const column=odds.finalOdds;
   const de=column===0?0:CRT.columns(variant)[String(column)].filter(x=>x==='DE').length;
   const candidate={attackers:[...attackers],odds:column,conditionalDE:de/6};
   if(!result.strongest||column>result.strongest.odds)result.strongest=candidate;
  }
  visit(0,[]);return result;
 }
 // Bounded, single opposing ground phase, direct approach-only forecast.
 // Every move is revalidated against the preceding hypothetical board. No
 // clearing moves, future arrivals, friendly responses, support or casualty dice.
 function forecast({state,cursor,owner,hex,maxNodes=64,maxStates=5000,maxRouteSearches=128}){
  for(const v of [maxNodes,maxStates,maxRouteSearches])if(!Number.isSafeInteger(v)||v<1)throw Error('Invalid forecast budget');
  const h=horizon(config,cursor,owner), stationary=assess({state,cursor,owner,hex});
  const out={scope:'bounded-single-opposing-ground-phase-direct-approach',stationary:stationary.strongest,
   strongest:stationary.strongest?{...stationary.strongest,moves:[]}:null,phase:null,nodes:0,routeSearches:0,
   truncated:false,concealedMovementOmitted:false,concealedCombatOmitted:stationary.unknownPlans>0,fleetReactionOmitted:false,eliminationRisk:null};
  if(!h.cursor)return out;
  let next=cursor;
  while(!next.complete){next=Phase.advance(config,next,()=>true);if(next.complete)break;
   const p=Phase.current(config,next);
   if(p.owner===h.actor&&p.kind==='combat')break;
   if(p.owner===h.actor&&['movement','special-movement'].includes(p.kind)){out.phase={cursor:next,id:p.id,kind:p.kind};break;}
  }
  if(!out.phase)return out;
  const phase={kind:out.phase.kind,owner:h.actor},turn=out.phase.cursor.turn;
  const approaches=new Set(board.edges.filter(e=>(e.a===hex||e.b===hex)&&e.verified&&!e.impassable&&!e.lake&&!e.allSea).map(e=>e.a===hex?e.b:e.a));
  const ids=Object.values(state.units).filter(u=>u.owner===h.actor&&!u.marker).map(u=>u.id).sort();
  const visited=new Set();
  function visit(current,moves){
   const key=JSON.stringify(moves.map(m=>[m.unitId,m.destination]).sort());
   // Different movement orders can matter; preserve them when territory changes.
   const signature=key+JSON.stringify(current.territory||null);
   if(visited.has(signature))return;
   if(out.nodes>=maxNodes){out.truncated=true;return;}
   visited.add(signature);out.nodes++;
   const a=assess({state:current,cursor,owner,hex});
   if(a.unknownPlans)out.concealedCombatOmitted=true;
   if(a.strongest&&(!out.strongest||a.strongest.odds>out.strongest.odds))out.strongest={...a.strongest,moves:[...moves]};
   for(const id of ids){
    if(moves.some(m=>m.unitId===id))continue;
    const u=current.units[id];
    // Do not derive movement allowance from concealed counter identity.
    if(u.strengthStatus==='untried'){out.concealedMovementOmitted=true;continue;}
    if(!Number.isSafeInteger(u.mp)||u.mp<1)continue;
    const modes=[null];if(phase.kind==='special-movement'&&h.actor==='soviet'&&u.class==='infantry')modes.push('rail');
    for(const mode of modes){
     if(out.nodes>=maxNodes||out.routeSearches>=maxRouteSearches){out.truncated=true;return;}
     out.routeSearches++;
     let search;try{search=Binding.legalRoutes(binding,phase,current.units,turn,id,{mode,maxStates,territory:current.territory});}
     catch(e){if(e.message==='legal-pathfinding: search-limit-exceeded'){out.truncated=true;continue;}throw e;}
     for(const r of search.reachable()){
      if(!approaches.has(r.id))continue;
      const fleet=current.supportMarkers?.[combatPolicy?.portSupport?.markerKey];
      if(fleet&&fleet.owner!==h.actor&&fleet.hex===r.id){out.fleetReactionOmitted=true;continue;}
      if(out.nodes>=maxNodes){out.truncated=true;return;}
      const valid=Binding.move(binding,phase,current.units,turn,{unitId:id,path:r.path,mode},current.territory);
      if(!valid.ok)continue;
      const moved={...current,units:{...current.units,[id]:{...u,hex:r.id}}};
      const transition=require('./territorial_state_transition').commit({profile,board,state:moved});
      if(!transition.ok){out.truncated=true;continue;}
      visit(transition.state,[...moves,{unitId:id,destination:r.id,path:r.path,mode}]);
     }
    }
   }
  }
  visit(state,[]);return out;
 }
 // Consequence witnesses for a particular legal, known, unsupported attack.
 // No advance is chosen: later Fleet displacement and pursuit are not modeled.
 // Ranges describe sampled legal choices, not an enemy policy or risk forecast.
 function survival({state,cursor,owner,hex,maxTrials=512}, witness=null){
  if(!Number.isSafeInteger(maxTrials)||maxTrials<1)throw Error('Invalid survival budget');
  const h=witness?.h||horizon(config,cursor,owner), a=witness?.assessment||assess({state,cursor,owner,hex});
  const out={scope:'stationary-known-attack-no-advance-consequence-witnesses',plan:a.strongest,
   rolls:[],trials:0,truncated:false,eliminationRisk:null};
  if(!a.strongest)return out;
  const battle=dec.declare({cursor:h.cursor,actor:h.actor,state},[{defenderHex:hex,attackers:a.strongest.attackers}]).battles[0];
  const solver=combatPolicy.retreatMode==='source-forced-ezoc-v1'?require('./historical_forced_retreat').create({map,profile,combatPolicy,counterConfig:context.counterConfig}):null;
  const port=require('./historical_port_support').create({map,policy:combatPolicy,counterConfig:context.counterConfig});
  const canHold=port.inspect({state,battle,actor:h.actor}).ignoreRetreatEligible;
  for(const die of a.strongest.odds===0?[null]:[1,2,3,4,5,6]){
   const base={state,battle,actor:h.actor,cursor:h.cursor,die,...(witness?.airSupportId?{airSupportId:witness.airSupportId}:{})};
   const outcome=evaluator.previewPostCasualty(base).outcome;
   const row={die,outcome,witnesses:0,minDefendersRemoved:null,maxDefendersRemoved:null,minAttackersRemoved:null,maxAttackersRemoved:null,complete:true};
   function offer(choices){
    if(out.trials>=maxTrials){out.truncated=true;row.complete=false;return;}
    out.trials++;
    const resolved=evaluator.resolve({...base,choices});
    const d=battle.defenders.filter(id=>!resolved.state.units[id]).length;
    const f=battle.attackers.filter(id=>!resolved.state.units[id]).length;
    if(witness?.observe){
     const advances=[];
     // Optional attacker choices belong to this casualty/retreat branch, not
     // to the adversarial minimum across branches. Do not speculate on Fleet dice.
     if(witness.cityAdvance&&['DR','DRL','EX','DE'].includes(outcome)&&!battle.defenders.some(id=>resolved.state.units[id]?.hex===hex)&&
        !Object.values(state.supportMarkers||{}).some(m=>m?.hex===hex)){
      for(const id of battle.attackers.filter(id=>resolved.state.units[id])){
       try{const a=evaluator.resolve({...base,choices:{...choices,advanceUnitId:id}});advances.push(a);}
       catch(e){if(!/^Advance violates territory:/.test(e.message))throw e;}
      }
     }
     witness.observe(die,resolved.state,resolved.event,advances);
    }
    row.witnesses++;
    for(const [k,v] of [['DefendersRemoved',d],['AttackersRemoved',f]]){
     row['min'+k]=row['min'+k]===null?v:Math.min(row['min'+k],v);
     row['max'+k]=row['max'+k]===null?v:Math.max(row['max'+k],v);
    }
   }
   function branch(choices){
    if(out.trials>=maxTrials){out.truncated=true;row.complete=false;return;}
    let stage;try{stage=evaluator.previewPostCasualty({...base,choices});}catch(e){if(e.message==='Exchange attacker losses do not meet defender loss')return;throw e;}
    if(!['DR','DRL','EX'].includes(outcome)||!stage.survivingDefenderIds.length){offer(choices);return;}
    if(canHold)offer({...choices,ignoreRetreat:true});
    if(!solver){row.complete=false;return;}
    const report=solver.enumerate({state:stage.state,defenderHex:hex,defenderIds:stage.survivingDefenderIds});
    if(!report.exhaustive){row.complete=false;return;}
    for(const combo of report.combinations){
     if(out.trials>=maxTrials){out.truncated=true;row.complete=false;break;}
     const paths={};for(const [id,v] of Object.entries(combo))if(v)paths[id]=v.route;
     offer({...choices,retreatPaths:paths});
    }
   }
   if(outcome==='AL')for(const id of battle.attackers)branch({lossUnitId:id});
   else if(outcome==='DRL')for(const id of battle.defenders)branch({defenderLossId:id});
   else if(outcome==='EX'){
    // Partial subsets are order-independent; full-set exhaustion may not be.
    // Enumerate full-set permutations, stopping on the existing trial budget.
    const ids=battle.attackers;
    function full(prefix,remaining,id){
     if(out.trials>=maxTrials){out.truncated=true;row.complete=false;return;}
     if(!remaining.length){branch({defenderLossId:id,attackerLossIds:prefix});return;}
     for(const a of remaining){full([...prefix,a],remaining.filter(x=>x!==a),id);if(out.truncated)return;}
    }
    for(let bits=1;bits<2**ids.length-1;bits++){
     if(out.trials>=maxTrials){out.truncated=true;row.complete=false;break;}
     for(const id of battle.defenders)branch({defenderLossId:id,attackerLossIds:ids.filter((_,i)=>bits&(2**i))});
    }
    for(const id of battle.defenders)full([],ids,id);
   }else branch({});
   if(!row.witnesses)row.complete=false;
   out.rolls.push(row);
  }
  // Only certified complete rows contribute to the lower bound; incomplete
  // rows remain unknown even when every sampled choice was fatal.
  const n=battle.defenders.length;
  out.conditionalStackElimination={lower:out.rolls.filter(r=>r.complete&&r.minDefendersRemoved===n).length/out.rolls.length,
   upper:out.rolls.filter(r=>!r.complete||r.maxDefendersRemoved===n).length/out.rolls.length};
  return out;
 }
 // Evaluate the actual strongest-odds witness, not the original stationary board.
 // This is not a maximum casualty-risk search over every possible enemy plan.
 function forecastSurvival(args){
  const f=forecast(args);
  const result={scope:'bounded-approach-witness-conditional-survival',forecast:f,survival:null,eliminationRisk:null};
  if(!f.strongest)return result;
  let current=args.state;
  const h=horizon(config,args.cursor,args.owner);
  const used=new Set();
  for(const m of f.strongest.moves){
   if(!f.phase||used.has(m.unitId))throw Error('Invalid forecast movement witness');
   used.add(m.unitId);
   const phase={kind:f.phase.kind,owner:h.actor};
   const u=current.units[m.unitId];
   if(!u||m.path[m.path.length-1]!==m.destination)throw Error('Invalid forecast destination witness');
   const valid=Binding.move(binding,phase,current.units,f.phase.cursor.turn,{unitId:m.unitId,path:m.path,mode:m.mode},current.territory);
   if(!valid.ok)throw Error('Forecast movement witness failed replay');
   const moved={...current,units:{...current.units,[m.unitId]:{...u,hex:m.destination}}};
   const transition=require('./territorial_state_transition').commit({profile,board,state:moved});
   if(!transition.ok)throw Error('Forecast territorial witness failed replay');
   current=transition.state;
  }
  const report=survival({...args,state:current});
  if(!report.plan||report.plan.odds!==f.strongest.odds||JSON.stringify(report.plan.attackers)!==JSON.stringify(f.strongest.attackers))throw Error('Forecast combat witness failed replay');
  result.survival=report;
  return result;
 }
 // Compare concrete continuation witnesses, not probability of enemy action.
 // Stationary exposure is evaluated on each resulting board; do not rank
 // alternatives by that exposure alone or treat missing plans as safety.
 function compareContinuations({state,cursor,owner,hex,battle,allAttackerOrigins=false,maxTrials=64,maxNodes=32,maxStates=5000,maxRouteSearches=64,combinedWithdrawal=false,enemyResponse=false,positionUtility=false,objectiveUtility=false,communicationUtility=false,cityAdvance=false,nonCityAdvance=false,airSupportId=null,maxResponseEvaluations=12,responseMaxNodes=16,responseMaxRouteSearches=32,responseMaxTrials=64}){
  for(const v of [maxResponseEvaluations,responseMaxNodes,responseMaxRouteSearches,responseMaxTrials])if(!Number.isSafeInteger(v)||v<1)throw Error('Invalid continuation response budget');
  if(cityAdvance&&(!objectiveUtility||combinedWithdrawal))throw Error('City advance requires objective utility and hold-only combat continuation');
  if((objectiveUtility||communicationUtility)&&!positionUtility)throw Error('Objective or communication utility requires position utility');
  const buildup=(objectiveUtility||communicationUtility)?require('./historical_buildup_phase').create({map,profile,config,counterConfig:context.counterConfig,policy:context.buildupPolicy,allocation:context.buildupAllocation,fixedPolicy:context.fixedPolicy||null,combatPolicy}):null;
  const housekeeping=objectiveUtility?require('./historical_housekeeping_phase').create({map,config,policy:context.housekeepingPolicy,initialCityControl:context.buildupPolicy.initialCityControl,communicated:buildup.communicated}):null;
  const initialObjective=housekeeping?.evaluate(state);
  function objective(current,at){
   const projected=housekeeping.evaluate(current);
   const direction=owner===context.housekeepingPolicy.axisOwner?1:-1;
   const cityDelta=direction*((projected.graduated?.germanVP??projected.axisControlledCount)-(initialObjective.graduated?.germanVP??initialObjective.axisControlledCount))||0;
   // Terminal classification of this static board, not a forecast of the final campaign.
   const value=o=>o===owner+'-victory'?1:o==='draw'?0:config.players.some(p=>o===p+'-victory')?-1:null;
   const a=value(initialObjective.outcome),b=value(projected.outcome);
   const terminalDelta=at.turn===config.turns?(a===null||b===null?null:b-a):0;
   return {cityDelta,projectedOutcome:projected.outcome,terminalDelta,net:terminalDelta===null?null:0.5*cityDelta+2*terminalDelta,cityControl:projected.cityControl};
  }
  const responseBudget={evaluations:0,skipped:0};
  const origins=allAttackerOrigins?[...new Set(battle.attackers.map(id=>state.units[id]?.hex))]:[hex];
  const ids=Object.values(state.units).filter(u=>u.owner===owner&&origins.includes(u.hex)&&!u.marker).map(u=>u.id).sort();
  if(!ids.length)throw Error('Continuation target must contain friendly ground units');
  const phase=Phase.current(config,cursor);
  if(phase.owner!==owner||phase.kind!=='combat')throw Error('Continuation comparison requires friendly Combat Phase');
  const target=dec.declare({cursor,actor:owner,state},[{defenderHex:battle.defenderHex,attackers:battle.attackers}]).battles[0];
  if(!target.attackers.some(id=>ids.includes(id)))throw Error('Attack must involve threatened formation');
  const known=evaluator.previewKnownOdds({state,battle:target,actor:owner,cursor,airSupportId});
  // Score observable unit removals and reductions for every participating ground unit, not just
  // the focal stack. Removal costs one unit-equivalent, reduction half;
  // these are provisional weights, not actual steps or strength points.
  function material(current){
   let friendlyLost=0,enemyLost=0;
   for(const u of Object.values(state.units)){
    if(u.marker||!u.hex)continue;
    const after=current.units[u.id];
    const loss=!after?1:u.strengthStatus==='printed-full'&&after.strengthStatus==='printed-reduced'?0.5:0;
    if(u.owner===owner)friendlyLost+=loss;else enemyLost+=loss;
   }
   return {friendlyLost,enemyLost,net:enemyLost-friendlyLost};
  }
  // Score connectivity transitions only for surviving original ground units.
  // A casualty is already accounted for by material; it cannot restore a line.
  function connectivity(current){
   const cache=new Map();
   const linked=u=>{if(!cache.has(u.owner))cache.set(u.owner,buildup.communicationIndex(u.owner,current.units));return cache.get(u.owner)(u.hex);};
   return Object.fromEntries(Object.values(current.units).filter(u=>u.hex&&!u.marker).map(u=>[u.id,linked(u)]));
  }
  const initialLinks=communicationUtility?connectivity(state):null;
  function communication(current){
   const links=connectivity(current);
   let friendlyRestored=0,friendlyCut=0,enemyRestored=0,enemyCut=0;
   for(const [id,before] of Object.entries(initialLinks)){
    if(!Object.hasOwn(links,id)||links[id]===before)continue;
    if(state.units[id].owner===owner){if(links[id])friendlyRestored++;else friendlyCut++;}
    else {if(links[id])enemyRestored++;else enemyCut++;}
   }
   return {friendlyRestored,friendlyCut,enemyRestored,enemyCut,net:0.25*(friendlyRestored-friendlyCut+enemyCut-enemyRestored)};
  }
  function exposure(current,at=cursor){
   const surviving=ids.filter(id=>current.units[id]);
   const locations=[...new Set(surviving.map(id=>current.units[id].hex))].sort();
   return {...(positionUtility?{material:material(current)}:{}),...(objectiveUtility?{objective:objective(current,at)}:{}),...(communicationUtility?{communication:communication(current)}:{}),surviving,removed:ids.length-surviving.length,positions:locations.map(location=>({hex:location,
    units:surviving.filter(id=>current.units[id].hex===location),threat:assess({state:current,cursor:at,owner,hex:location}),
    ...(enemyResponse?{response:response(current,location,at)}:{})}))};
  }
  function response(current,location,at){
   if(responseBudget.evaluations>=maxResponseEvaluations){responseBudget.skipped++;return {status:'budget-exhausted',eliminationRisk:null};}
   responseBudget.evaluations++;
   return {status:'conditional-forecast',...forecastSurvival({state:current,cursor:at,owner,hex:location,maxNodes:responseMaxNodes,maxStates,maxRouteSearches:responseMaxRouteSearches,maxTrials:responseMaxTrials})};
  }
  const result={...(combinedWithdrawal?{combinedWithdrawal:true}:{}),scope:cityAdvance?'bounded-continuation-witnesses-city-advance':enemyResponse?'bounded-continuation-witnesses-enemy-response-no-advance':'bounded-continuation-witnesses-stationary-exposure-no-advance',...(enemyResponse?{responseBudget}:{}),inaction:exposure(state),withdrawal:null,attack:null,recommendation:null,eliminationRisk:null};
  function replayWithdrawal(current,w){
   if(!w.best?.moves.length)return current;const movePhase={kind:w.opportunity.kind,owner};
   for(const m of w.best.moves){
    const valid=Binding.move(binding,movePhase,current.units,w.opportunity.cursor.turn,{unitId:m.unitId,path:m.path,mode:m.mode},current.territory);
    if(!valid.ok)throw Error('Withdrawal witness failed replay');
    const moved={...current,units:{...current.units,[m.unitId]:{...current.units[m.unitId],hex:m.destination}}};
    const transition=require('./territorial_state_transition').commit({profile,board,state:moved});
    if(!transition.ok)throw Error('Withdrawal territory witness failed replay');
    current=transition.state;
    if(buildup){current={...current,cityControl:{...current.cityControl}};buildup.recordControl(current,owner,m.path.slice(1));}
   }
   return current;
  }
  const w=coordinatedWithdrawal({state,cursor,owner,hex,originHexes:origins,maxNodes,maxStates,maxRouteSearches});
  result.withdrawal={search:w,exposure:w.best?.moves.length?exposure(replayWithdrawal(state,w),combinedWithdrawal?w.opportunity.cursor:cursor):null};
  if(known===null){result.attack={status:'concealed-strength-unestimated'};if(positionUtility)result.utility=scoreContinuations(result,{forecastPressure:enemyResponse,objectiveUtility,communicationUtility});return result;}
  if(known.finalOdds===0){result.attack={status:'automatic-NE'};if(positionUtility)result.utility=scoreContinuations(result,{forecastPressure:enemyResponse,objectiveUtility,communicationUtility});return result;}
  const witnesses=[];
  const report=survival({state,cursor,owner:owner==='german'?'soviet':'german',hex:target.defenderHex,maxTrials},
   {h:{cursor,actor:owner},airSupportId,assessment:{strongest:{attackers:target.attackers,odds:known.finalOdds}},cityAdvance:cityAdvance&&(nonCityAdvance||map.cells.some(c=>c.id===target.defenderHex&&c.city?.name)),observe:(die,current,event,advances)=>{
    if(buildup){current={...current,cityControl:{...current.cityControl}};for(const r of event.retreats||[])buildup.recordControl(current,config.players.find(p=>p!==owner),r.route||[]);}
    let combined;
    if(combinedWithdrawal){
     const surviving=ids.filter(id=>current.units[id]);
     // No advance is modeled: surviving focal attackers remain at the origin.
     if(!surviving.length)combined={status:'no-survivors',search:null,exposure:null};
     else if(surviving.some(id=>!origins.includes(current.units[id].hex)))combined={status:'unsupported-split-origin',search:null,exposure:null};
     else {
      const search=coordinatedWithdrawal({state:current,cursor,owner,hex,originHexes:origins,unitIds:surviving,maxNodes,maxStates,maxRouteSearches});
      combined={status:search.best?.moves.length?'withdrawal-witness':search.truncated?'withdrawal-search-incomplete':search.opportunity?'no-withdrawal-witness':'no-movement-phase',search,exposure:search.best?.moves.length?exposure(replayWithdrawal(current,search),search.opportunity.cursor):null};
     }
    }
    const advanceOptions=cityAdvance?advances.map(a=>{
     const advanced={...a.state,cityControl:{...current.cityControl}};
     buildup.recordControl(advanced,owner,[target.defenderHex]);
     return {unitId:a.event.advanced,exposure:exposure(advanced)};
    }):null;
    witnesses.push({die,...(cityAdvance?{advanceOptions}:{}),...(combinedWithdrawal?{combined}:{}),exposure:exposure(current),enemyRemoved:target.defenders.filter(id=>!current.units[id]).length,
     attackingUnitsRemoved:target.attackers.filter(id=>!current.units[id]).length});
   }});
  result.attack={status:'conditional-witnesses',odds:known.finalOdds,report,witnesses};
  if(positionUtility)result.utility=scoreContinuations(result,{forecastPressure:enemyResponse,objectiveUtility,communicationUtility});
  return result;
 }
 return {assess,withdrawal,coordinatedWithdrawal,forecast,survival,forecastSurvival,compareContinuations};
}
// Conservative sampled-branch comparison. No inference of enemy attack probability.
// Worst sampled casualty/retreat choice per die; best available hold/withdrawal
// witness for that choice. Missing or incomplete dice are not zero-valued.
function scoreContinuations(report,{forecastPressure=false,objectiveUtility=false,communicationUtility=false}={}){
 function score(e){
  if(!e?.material)return null;
  let pressure=0;
  for(const p of e.positions){
   if(p.threat.unknownPlans)return null;
   let odds=p.threat.strongest?.odds||0;
   if(forecastPressure){
    const r=p.response, f=r?.forecast;
    if(r?.status!=='conditional-forecast'||!f||f.truncated||f.concealedMovementOmitted||f.concealedCombatOmitted||f.fleetReactionOmitted)return null;
    // Use the discovered approach odds, not an independent additive penalty.
    // This is still only a bounded pressure proxy, not elimination probability.
    odds=Math.max(odds,f.strongest?.odds||0);
   }
   // Dimensionless pressure proxy; not a calibrated expected casualty count.
   pressure+=p.units.length*Math.min(1,odds/6);
  }
  if(objectiveUtility&&!Number.isFinite(e.objective?.net))return null;
  if(communicationUtility&&!Number.isFinite(e.communication?.net))return null;
  return e.material.net-pressure+(objectiveUtility?e.objective.net:0)+(communicationUtility?e.communication.net:0);
 }
 const hold=score(report.inaction),withdraw=score(report.withdrawal?.exposure);
 const out={...(communicationUtility?{communicationUtility:true}:{}),...(objectiveUtility?{objectiveUtility:true}:{}),scope:forecastPressure?'sampled-material-and-bounded-forecast-pressure-utility':'sampled-material-and-stationary-pressure-utility',hold,withdraw,attack:null,delta:null,decision:null};
 if(hold===null||(report.withdrawal?.exposure&&withdraw===null)||report.attack?.status!=='conditional-witnesses')return out;
 const rows=report.attack.report.rolls;
 if(rows.length!==6||rows.some(r=>!r.complete))return out;
 const perDie=[];
 for(const row of rows){
  const values=[];
  for(const w of report.attack.witnesses.filter(w=>w.die===row.die)){
   const h=score(w.exposure),v=score(w.combined?.exposure);
   if(h===null||((forecastPressure||communicationUtility||objectiveUtility)&&w.combined?.exposure&&v===null))return out;
   // Advance is optional and chosen by the attacker after the die. Unknown
   // alternatives receive no credit; the validated hold remains available.
   const advances=(w.advanceOptions||[]).map(a=>score(a.exposure)).filter(Number.isFinite);
   values.push(Math.max(h,v??h,...advances));
  }
  if(!values.length)return out;
  perDie.push(Math.min(...values));
 }
 out.perDie=perDie;
 out.attack=perDie.reduce((a,b)=>a+b,0)/6;
 out.delta=out.attack-Math.max(hold,withdraw??hold);
 return out;
}
module.exports=Object.freeze({create,horizon,scoreContinuations});
