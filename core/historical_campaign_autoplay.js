/* Shared historical campaign baseline action controller (Checkpoint 165).
 * An engine-completion harness, not a strategic AI or Oberlabs UX.
 * It only executes actions accepted by the authoritative campaign transaction
 * and the read-only source-bound action catalog. Mandatory choices fail closed.
 * Dice are fixed by the supplied seed BEFORE post-roll consequences are listed.
 */
'use strict';
const crypto=require('node:crypto');
const Random=require('./mission_random');
const Catalog=require('./historical_campaign_action_catalog');
const Campaign=require('./historical_campaign_session');
const Consequences=require('./historical_combat_consequences');
const Geography=require('./historical_combat_geography');
const AttackUtility=require('./historical_attack_utility');
const Threat=require('./historical_threat_assessment');
const Rules=require('./movement_rules');
const Difficulty=require('./ai_difficulty');
const {clone:copy}=require('./historical_campaign_json');
function policyOf(input={}){
 if(input===null||typeof input!=='object'||Array.isArray(input))throw Error('Controller policy must be an object');
 const allowed=['missionSeed','seed','maxActions','maxCombatsPerPhase','maxCombatPhases',
  'maxGroundMovesPerPhase','maxReinforcementsPerPhase','maxFleetMoves','maxFleetAttacks','fleetBudgetScope','selectionMode','attackSelection','phaseScope','objectivePolicy','movementLookahead','coordinatedAttacks','difficulty'];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Unknown controller policy');
 const grade=Difficulty.validate(Object.hasOwn(input,'difficulty')?input.difficulty:0);
 const full=input.phaseScope==='operational'||(input.phaseScope===undefined&&grade>0);
 if(grade&&!full)throw Error('Graded AI requires operational policy');
 const unlimited=Number.MAX_SAFE_INTEGER;
 const p={seed:137,maxActions:full?Campaign.MAX_ACTIONS:700,maxCombatsPerPhase:full?unlimited:1,maxCombatPhases:full?unlimited:2,
  maxGroundMovesPerPhase:full?unlimited:1,maxReinforcementsPerPhase:full?unlimited:2,
  maxFleetMoves:1,maxFleetAttacks:2,fleetBudgetScope:'campaign',objectivePolicy:'baseline',movementLookahead:false,selectionMode:'first',attackSelection:full?'continuation-pilot':'screen-known-futile',phaseScope:full?'operational':'diagnostic',coordinatedAttacks:input.objectivePolicy==='reserve-relief',...input,...Difficulty.historical(grade)};
 const names=['maxActions','maxCombatsPerPhase','maxCombatPhases','maxGroundMovesPerPhase',
  'maxReinforcementsPerPhase','maxFleetMoves','maxFleetAttacks'];
 if(typeof p.coordinatedAttacks!=='boolean'||(p.coordinatedAttacks&&!full)||typeof p.movementLookahead!=='boolean'||(p.movementLookahead&&(!full||p.objectivePolicy!=='reserve-relief'))||!['baseline','reserve-relief'].includes(p.objectivePolicy)||(p.objectivePolicy==='reserve-relief'&&!full)||!['campaign','turn'].includes(p.fleetBudgetScope)||!['diagnostic','operational'].includes(p.phaseScope)||(full&&p.attackSelection!=='continuation-pilot')||!Number.isSafeInteger(p.seed)||p.seed<0||names.some(k=>!Number.isSafeInteger(p[k])||p[k]<0||(Object.hasOwn(input,k)&&(!Number.isSafeInteger(input[k])||input[k]<0)))||p.maxActions<1||p.maxActions>Campaign.MAX_ACTIONS||!['first','seeded'].includes(p.selectionMode)||!['screen-known-futile','coverage','utility-pilot','continuation-pilot'].includes(p.attackSelection))
  throw Error('Invalid deterministic controller policy');
 if(p.missionSeed!==undefined)Random.validate(p.missionSeed);
 return p;
}
// Housekeeping completion is the authoritative turn boundary recorded in the
// append-only journal. Count declarations in the current turn without guessing
// which combat/movement phases are present in a scenario configuration.
function fleetDeclarationCount(history,type,scope='campaign'){
 if(!['campaign','turn'].includes(scope))throw Error('Invalid Fleet budget scope');
 const start=scope==='turn'?history.map(a=>a.type).lastIndexOf('finish-housekeeping')+1:0;
 return history.slice(start).filter(a=>(a.type==='combat'?a.action?.type:a.type)===type).length;
}
function dieFor(seed,snap,purpose){
 const payload=String(seed)+'|'+snap.cursor.turn+'|'+snap.phaseId+'|'+snap.actionCount+'|'+purpose;
 // Seeded, auditable *test* dice, never selected after observing a result.
 return crypto.createHash('sha256').update(payload).digest()[0]%6+1;
}
// A conservative baseline, not strategic AI: no hidden counter faces or dice.
// Known attacks must reach the active CRT without speculative air allocation.
// Concealed engagements remain possible, but rank behind known viable ones.
function screenBattles({snapshot:s,context,proposals,utilityPilot=false,threatDiagnostics=false,withdrawalDiagnostics=false,coordinatedWithdrawalDiagnostics=false,forecastDiagnostics=false,survivalDiagnostics=false,forecastSurvivalDiagnostics=false}){
 const geography=Geography.create(context.map,context.profile,{cityMarkerMode:context.combatPolicy?.cityMarkerMode,fortificationMode:context.combatPolicy?.fortificationMode});
 const evaluator=Consequences.create({...context,phaseConfig:context.config,geography});
 const known=[],uncertain=[],rejected=[],assessments=[];
 const threat=(threatDiagnostics||withdrawalDiagnostics||coordinatedWithdrawalDiagnostics||forecastDiagnostics||survivalDiagnostics||forecastSurvivalDiagnostics)?Threat.create(context):null, threatByHex=new Map();
 for(const b of proposals){
  if(threat)for(const id of b.attackers){const hex=s.state.units[id].hex;if(!threatByHex.has(hex)){const args={state:s.state,cursor:s.cursor,owner:s.actor,hex};const report=threat.assess(args);if(withdrawalDiagnostics)report.withdrawal=threat.withdrawal(args);if(coordinatedWithdrawalDiagnostics)report.coordinatedWithdrawal=threat.coordinatedWithdrawal(args);if(forecastDiagnostics)report.forecast=threat.forecast(args);if(survivalDiagnostics)report.survival=threat.survival(args);if(forecastSurvivalDiagnostics)report.forecastSurvival=threat.forecastSurvival(args);threatByHex.set(hex,report);}}
  const defenders=Object.values(s.state.units).filter(u=>u.hex===b.defenderHex&&u.owner!==s.actor).map(u=>u.id);
  const odds=evaluator.previewKnownOdds({state:s.state,battle:{...b,defenders},actor:s.actor,cursor:s.cursor});
  if(utilityPilot){
   // First-stage conservative policy: known outcome-category proxy only.
   // No threat forecast exists yet; do not fabricate an elimination risk.
   // Uncertain engagements need a separate public-information estimator.
   if(odds===null){rejected.push(b);assessments.push({battle:b,reason:'concealed-strength-unestimated'});continue;}
   const assessment=AttackUtility.evaluate({odds:odds.finalOdds,variant:context.combatPolicy?.crtVariant||'standard',
    outcomeUtility:{NE:0,AL:-1,EX:0,DR:0.5,DRL:1.5,DE:2},inactionUtility:0});
   assessments.push({battle:b,odds:odds.finalOdds,...assessment});
   (assessment.eligible?known:rejected).push(b);
  }else (odds===null?uncertain:odds.noEffect?rejected:known).push(b);
 }
 if(utilityPilot){
  const scores=new Map(assessments.map(x=>[x.battle,x.delta]));
  known.sort((a,b)=>scores.get(b)-scores.get(a));
 }
 return {known,uncertain,rejected,...(utilityPilot?{assessments}:{}),...(threat?{threats:[...threatByHex.values()]}:{})};
}
// Opt-in bounded stationary continuation policy. No forecast risk is treated
// as calibrated desperation probability. All participating origins are scored;
// no speculative support or Fleet advance credit.
function rankContinuations({snapshot:s,context,proposals,maxCandidates=8,maxTrials=64,maxNodes=32,includeFallback=false,nonCityAdvance=false,supportPlanning=false}){
 const geography=Geography.create(context.map,context.profile,{cityMarkerMode:context.combatPolicy?.cityMarkerMode,fortificationMode:context.combatPolicy?.fortificationMode});
 const evaluator=Consequences.create({...context,phaseConfig:context.config,geography});
 const candidates=[],assessments=[],decisions=[],estimated=[],fallback=[],supportedCandidates=[],supported=[];
 // At most one support-dependent battle is committed; resolve it first with
 // the strongest available marker. Do not speculate on concealed faces.
 const airMarkers=supportPlanning&&context.enableAirSupport&&context.combatPolicy?.airSupport?.owner===s.actor?
  require('./historical_air_support').create({...context,phaseConfig:context.config}).available({state:s.state,cursor:s.cursor,actor:s.actor}):[];
 const strongestMarker=[...airMarkers].sort((a,b)=>b.shiftRating-a.shiftRating||a.faceId.localeCompare(b.faceId))[0];
 const record=(battle,reason,extra={})=>decisions.push({battle,reason,...extra});
 // A deliberately conservative category proxy for known favorable odds only.
 // Never override a completed nonpositive continuation assessment.
 const considerFallback=(battle,odds,source)=>{
  if(odds<3)return false;
  const delta=AttackUtility.evaluate({odds,variant:context.combatPolicy?.crtVariant||'standard',outcomeUtility:{NE:0,AL:-1,EX:0,DR:0.5,DRL:1.5,DE:2},inactionUtility:0}).delta;
  if(!Number.isFinite(delta)||delta<=0)return false;
  fallback.push({battle,odds,delta,eligible:true,method:'known-odds-proxy',source});return true;
 };
 for(const battle of proposals){
  const defenders=Object.values(s.state.units).filter(u=>u.hex===battle.defenderHex&&u.owner!==s.actor).map(u=>u.id);
  const odds=evaluator.previewKnownOdds({state:s.state,battle:{...battle,defenders},actor:s.actor,cursor:s.cursor});
  if(!odds){
   const estimate=evaluator.previewEstimatedOdds({state:s.state,battle:{...battle,defenders},actor:s.actor,cursor:s.cursor});
   if(!estimate?.complete){record(battle,'concealed-estimate-unavailable',{estimate});continue;}
   const columns=Object.entries(estimate.distribution).map(([o,n])=>[Number(o),n]);
   // Conservative interim policy: every possible assignment must be above 1:1.
   // Category utility is a fallback, not a substitute for positional simulation.
   if(columns.some(([o])=>o<=1)){record(battle,'concealed-low-odds-risk',{estimate});continue;}
   const delta=columns.reduce((sum,[o,n])=>sum+n*AttackUtility.evaluate({odds:o,variant:context.combatPolicy?.crtVariant||'standard',outcomeUtility:{NE:0,AL:-1,EX:0,DR:0.5,DRL:1.5,DE:2},inactionUtility:0}).delta,0)/estimate.assignments;
   const eligible=delta>0;
   record(battle,eligible?'concealed-positive-proxy':'concealed-nonpositive-proxy',{estimate,delta});
   if(eligible)estimated.push({battle,delta,estimate,eligible,method:'public-roster-proxy'});
   continue;
  }
  if(odds.noEffect||odds.finalOdds<=1){
   if(strongestMarker){
    const aided=evaluator.previewKnownOdds({state:s.state,battle:{...battle,defenders},actor:s.actor,cursor:s.cursor,airSupportId:strongestMarker.faceId});
    if(aided&&!aided.noEffect&&aided.finalOdds>1){supportedCandidates.push({battle,odds:odds.finalOdds,supportedOdds:aided.finalOdds,airSupportId:strongestMarker.faceId});continue;}
   }
   record(battle,odds.noEffect?'below-minimum':'low-odds-policy',{odds:odds.finalOdds});continue;
  }
  candidates.push({battle,odds:odds.finalOdds});
 }
 candidates.sort((a,b)=>b.odds-a.odds);
 for(const {battle,odds} of candidates.slice(maxCandidates))record(battle,'candidate-budget',{odds,fallbackEligible:considerFallback(battle,odds,'candidate-budget')});
 const t=Threat.create(context);
 for(const {battle,odds} of candidates.slice(0,maxCandidates)){
  const r=t.compareContinuations({state:s.state,cursor:s.cursor,owner:s.actor,hex:s.state.units[battle.attackers[0]].hex,battle,allAttackerOrigins:true,positionUtility:true,objectiveUtility:true,communicationUtility:true,cityAdvance:true,nonCityAdvance,maxTrials,maxNodes});
  // An incomplete withdrawal search cannot establish a reliable comparator.
  const delta=r.withdrawal?.search?.truncated?null:r.utility?.delta??null;
  const eligible=Number.isFinite(delta)&&delta>0;
  record(battle,r.withdrawal?.search?.truncated?'withdrawal-budget':!Number.isFinite(delta)?'utility-unavailable':eligible?'positive-utility':'nonpositive-utility',{odds,delta,fallbackEligible:!Number.isFinite(delta)&&considerFallback(battle,odds,'incomplete-utility')});
  assessments.push({battle,odds,delta,utility:r.utility,eligible});
 }
 // Separate small budget; support-dependent attacks require complete utility.
 supportedCandidates.sort((a,b)=>b.supportedOdds-a.supportedOdds);
 for(const a of supportedCandidates.slice(4))record(a.battle,'supported-candidate-budget',{odds:a.odds,supportedOdds:a.supportedOdds});
 for(const a of supportedCandidates.slice(0,4)){
  const r=t.compareContinuations({state:s.state,cursor:s.cursor,owner:s.actor,hex:s.state.units[a.battle.attackers[0]].hex,battle:a.battle,allAttackerOrigins:true,positionUtility:true,objectiveUtility:true,communicationUtility:true,cityAdvance:true,nonCityAdvance,airSupportId:a.airSupportId,maxTrials,maxNodes});
  const delta=r.withdrawal?.search?.truncated?null:r.utility?.delta??null;
  const eligible=Number.isFinite(delta)&&delta>0;
  record(a.battle,eligible?'supported-positive-utility':!Number.isFinite(delta)?'supported-utility-unavailable':'supported-nonpositive-utility',{odds:a.odds,supportedOdds:a.supportedOdds,delta,airSupportId:a.airSupportId});
  if(eligible)supported.push({...a,delta,eligible,utility:r.utility,method:'supported-detailed-utility'});
 }
 const ranked=assessments.filter(a=>a.eligible).sort((a,b)=>b.delta-a.delta);
 const proxies=[...fallback,...estimated].sort((a,b)=>b.delta-a.delta);
 return {ranked:[...(ranked.length?(includeFallback?[...ranked,...proxies]:ranked):proxies),...supported.sort((a,b)=>b.delta-a.delta)],assessments,decisions,omitted:candidates.length-assessments.length};
}
// Allocate available ground air by marginal CRT utility over the remaining
// known commitments. Never inspect concealed faces.
function chooseGroundAir({snapshot:s,context,commands}){
 const choices=commands.filter(a=>a.action?.type==='commit-ground-air');
 const hold=choices.find(a=>a.action.faceId===null);
 const geography=Geography.create(context.map,context.profile,{cityMarkerMode:context.combatPolicy?.cityMarkerMode,fortificationMode:context.combatPolicy?.fortificationMode});
 const evaluator=Consequences.create({...context,phaseConfig:context.config,geography});
 const resolved=new Set(s.combat.resolved.map(e=>e.battle.defenderHex));
 const battles=s.combat.declaration.battles.filter(b=>!resolved.has(b.defenderHex));
 const value=odds=>AttackUtility.evaluate({odds,variant:context.combatPolicy?.crtVariant||'standard',outcomeUtility:{NE:0,AL:-1,EX:0,DR:0.5,DRL:1.5,DE:2},inactionUtility:0}).delta;
 const gain=(b,id)=>{try{
  const args={state:s.combat.state,battle:b,actor:s.actor,cursor:s.cursor};
  const a=evaluator.previewKnownOdds(args),z=evaluator.previewKnownOdds({...args,airSupportId:id});
  return a&&z?value(z.finalOdds)-value(a.finalOdds):null;
 }catch{return null;}};
 const selected=battles.find(b=>b.defenderHex===s.combat.selected);
 if(!selected)return hold;
 const markers=choices.filter(a=>a.action.faceId!==null);
 // Reproduce the exact marker evaluated for a support-dependent first battle.
 // Earlier engagements can alter the projected position; if a preview is
 // no longer valid, keep the existing fail-closed assignment behavior.
 try{
 const base=markers.length?evaluator.previewKnownOdds({state:s.combat.state,battle:selected,actor:s.actor,cursor:s.cursor}):null;
 if(base&&base.finalOdds<=1){
  const ordered=[...markers].sort((a,b)=>{
   const rating=id=>context.combatPolicy.airSupport.markers.find(m=>m.faceId===id)?.shiftRating||0;
   return rating(b.action.faceId)-rating(a.action.faceId)||a.action.faceId.localeCompare(b.action.faceId);
  });
  const best=ordered[0];
  if(best){const aided=evaluator.previewKnownOdds({state:s.combat.state,battle:selected,actor:s.actor,cursor:s.cursor,airSupportId:best.action.faceId});if(aided&&!aided.noEffect&&aided.finalOdds>1)return best;}
 }
 }catch{/* Known-odds preview is unavailable; do not infer support benefit. */}
 // The source rosters have few markers. Solve the known assignment exactly
 // with a bitmask; leave unsupported large rosters unallocated.
 if(markers.length>8)return hold;
 const ordered=[selected,...battles.filter(b=>b!==selected)];
 const gains=ordered.map(b=>markers.map(m=>gain(b,m.action.faceId)??0));
 const memo=new Map();
 function solve(i,mask){
  if(i===ordered.length)return {score:0,choice:-1};
  const k=i+':'+mask;if(memo.has(k))return memo.get(k);
  let best={score:solve(i+1,mask).score,choice:-1};
  for(let j=0;j<markers.length;j++)if(!(mask&(1<<j))&&gains[i][j]>1e-9){
   const score=gains[i][j]+solve(i+1,mask|(1<<j)).score;
   if(score>best.score+1e-9)best={score,choice:j};
  }
  memo.set(k,best);return best;
 }
 const best=solve(0,0);return markers[best.choice]||hold;
}
// Rank already validated, fixed-die outcomes. Never sample another die or
// assume a Fleet displacement result. Compare material and actual city passage.
function rankPostRoll({snapshot:s,context,post}){
 const cityByHex=new Map(context.map.cells.filter(c=>c.city?.name).map(c=>[c.id,c.city.name]));
 const before=s.state.cityControl||{};
 const other=context.config.players.find(p=>p!==s.actor);
 return post.options.map((option,index)=>{
  const control={...before};
  for(const r of option.retreats||[])for(const hex of r.route||[]){const city=cityByHex.get(hex);if(city)control[city]=other;}
  if(option.advanced){const city=cityByHex.get(post.defenderHex);if(city)control[city]=s.actor;}
  const cityDelta=Object.keys(before).reduce((sum,city)=>sum+Number(control[city]===s.actor)-Number(before[city]===s.actor),0);
  const material=(option.losses||[]).reduce((sum,l)=>sum+(s.state.units[l.unitId]?.owner===s.actor?-1:1)*(l.removed?1:0.5),0);
  return {option,index,cityDelta,material,score:material+0.5*cityDelta};
 }).sort((a,b)=>b.score-a.score||b.cityDelta-a.cityDelta||Number(!!a.option.advanced)-Number(!!b.option.advanced)||a.index-b.index);
}
// Use the fixed-die validated transactions to compare post-roll positions.
// If any candidate has unknown pressure, retain the material/city ordering
// rather than treating unknown threats as safe. Bound the expensive probes.
function rankOperationalPostRoll({session,snapshot:s,context,post}){
 const ranked=rankPostRoll({snapshot:s,context,post});
 if(ranked.length>32||ranked.length<2)return ranked;
 const t=Threat.create(context);
 const buildup=require('./historical_buildup_phase').create({map:context.map,profile:context.profile,config:context.config,counterConfig:context.counterConfig,policy:context.buildupPolicy,allocation:context.buildupAllocation,fixedPolicy:context.fixedPolicy||null,combatPolicy:context.combatPolicy});
 const battle=s.combat.declaration.battles.find(b=>b.defenderHex===post.defenderHex);
 const origins=new Set(battle.attackers.map(id=>s.state.units[id]?.hex));
 const focal=Object.values(s.state.units).filter(u=>u.owner===s.actor&&!u.marker&&origins.has(u.hex)).map(u=>u.id);
 const original=Object.values(s.state.units).filter(u=>u.hex&&!u.marker);
 const links=state=>{const cache=new Map();return Object.fromEntries(Object.values(state.units).filter(u=>u.hex&&!u.marker).map(u=>{if(!cache.has(u.owner))cache.set(u.owner,buildup.communicationIndex(u.owner,state.units));return [u.id,cache.get(u.owner)(u.hex)];}));};
 const before=links(s.state);
 const scored=[];
 for(const x of ranked){
  const current=session.execute(x.option.action).session.snapshot().state;
  const surviving=focal.filter(id=>current.units[id]);let pressure=0;
  for(const hex of new Set(surviving.map(id=>current.units[id].hex))){
   const r=t.assess({state:current,cursor:s.cursor,owner:s.actor,hex});
   if(r.unknownPlans)return ranked;
   pressure+=surviving.filter(id=>current.units[id].hex===hex).length*Math.min(1,(r.strongest?.odds||0)/6);
  }
  const after=links(current);let net=0;
  for(const u of original)if(Object.hasOwn(after,u.id)&&after[u.id]!==before[u.id])net+=(Number(after[u.id])-Number(before[u.id]))*(u.owner===s.actor?1:-1);
  scored.push({...x,pressure,communicationNet:net,score:x.score-pressure+0.25*net});
 }
 return scored.sort((a,b)=>b.score-a.score||b.cityDelta-a.cityDelta||Number(!!a.option.advanced)-Number(!!b.option.advanced)||a.index-b.index);
}
// Advisory distance over the authorized physical graph, not a legal route or
// a threat prediction. Only already validated catalogue commands are ranked.
// Local, stationary concentration potential. Compare the best known legal
// attack from distinct origins, not the number of counters near a target.
// No hidden strengths, hypothetical dice or support allocation.
function concentrationEvaluator({snapshot:s,context,board,geography}){
 const index=context.config.phases.findIndex((p,i)=>i>s.cursor.index&&p.owner===s.actor&&p.kind==='combat');
 if(index<0)return ()=>0;
 const cursor={...s.cursor,index};
 const declarations=require('./historical_combat_declarations').create({map:context.map,profile:context.profile,config:context.config,combatPolicy:context.combatPolicy});
 const odds=Consequences.create({...context,phaseConfig:context.config,geography});
 const adj=new Map();
 for(const e of board.edges)if(e.verified&&!e.impassable&&!e.allSea&&!e.lake)for(const [a,b] of [[e.a,e.b],[e.b,e.a]]){if(!adj.has(a))adj.set(a,new Set());adj.get(a).add(b);}
 const baseline=new Map(),targets=Object.values(s.state.units).filter(u=>u.owner!==s.actor&&!u.marker).map(u=>u.hex);
 const potential=(units,hex)=>{
  const defenders=Object.values(units).filter(u=>u.hex===hex);
  if(defenders.some(u=>u.strengthStatus==='untried'||u.marker))return null;
  const groups=new Map();
  for(const u of Object.values(units))if(u.owner===s.actor&&!u.marker&&u.strengthStatus!=='untried'&&adj.get(hex)?.has(u.hex)){
   if(!groups.has(u.hex))groups.set(u.hex,[]);groups.get(u.hex).push(u.id);
  }
  const origins=[...groups.values()];
  if(origins.reduce((n,g)=>n*(g.length+1),1)>128)return null;
  let best=0;const selected=[];
  function walk(i){
   if(i<origins.length){walk(i+1);for(const id of origins[i]){selected.push(id);walk(i+1);selected.pop();}return;}
   if(!selected.length)return;
   try{
    const state={...s.state,units};
    const battle=declarations.declare({cursor,actor:s.actor,state},[{defenderHex:hex,attackers:selected}]).battles[0];
    const o=odds.previewKnownOdds({state,battle,actor:s.actor,cursor});
    if(!o||o.finalOdds<=1)return;
    const value=AttackUtility.evaluate({odds:o.finalOdds,variant:context.combatPolicy?.crtVariant||'standard',outcomeUtility:{NE:0,AL:-1,EX:0,DR:0.5,DRL:1.5,DE:2},inactionUtility:0}).delta;
    best=Math.max(best,value);
   }catch{/* Uncertified or prohibited battle supplies no credit. */}
  }
  walk(0);return best;
 };
 return (unitId,to)=>{
  const unit=s.state.units[unitId],from=unit.hex;
  if(unit.strengthStatus==='untried')return 0;
  const projected={...s.state.units,[unitId]:{...unit,hex:to}};
  let gain=0,loss=0;
  for(const hex of new Set(targets))if(adj.get(hex)?.has(from)||adj.get(hex)?.has(to)){
   if(!baseline.has(hex))baseline.set(hex,potential(s.state.units,hex));
   const a=baseline.get(hex),b=potential(projected,hex);
   if(a===null||b===null)continue;
   gain=Math.max(gain,b-a);loss=Math.max(loss,a-b);
  }
  // Avoid adding benefits for mutually exclusive attacks by one formation.
  return gain-loss;
 };
}
// One reverse breadth-first field serves every formation in the ranking pass.
// Advisory only: physical adjacency is not an authoritative legal route.
function objectiveDistanceField(adj,targets){
 const dist=new Map(),queue=[];
 for(const h of targets)if(adj.has(h)&&!dist.has(h)){dist.set(h,0);queue.push(h);}
 for(let i=0;i<queue.length;i++)for(const h of adj.get(queue[i]))if(!dist.has(h)){dist.set(h,dist.get(queue[i])+1);queue.push(h);}
 return dist;
}
function distanceProgress(dist,from,to){return dist.has(from)&&dist.has(to)?dist.get(from)-dist.get(to):0;}
function rankObjectiveMoves({snapshot:s,context,commands,communication=false,operational=false,objectivePolicy='baseline'}){
 const board=require('./movement_binding').build(context.map,context.profile).board;
 const cities=new Map(context.map.cells.filter(c=>c.city?.name&&s.state.cityControl?.[c.city.name]&&s.state.cityControl[c.city.name]!==s.actor).map(c=>[c.id,c.city.name]));
 const weights=new Map(context.map.cells.filter(c=>c.city?.name).map(c=>[c.id,context.housekeepingPolicy?.graduatedVictory?.weights[c.city.name]??(operational&&(c.tileMarkers||[]).some(m=>m.kind==='majorCity')?1.5:1)]));
 const adj=new Map(Object.keys(board.cells).map(h=>[h,[]]));
 for(const e of board.edges)if(!e.impassable&&!e.allSea&&!e.lake){adj.get(e.a).push(e.b);adj.get(e.b).push(e.a);}
 // Public occupancy only: adjacent enemy presence is a local warning,
 // not a predicted attack, legal ZOC, or probability of capture.
 const units=Object.values(s.state.units), enemyHexes=new Set(units.filter(u=>u.owner!==s.actor).map(u=>u.hex));
 const friendlyCounts=new Map();
 for(const u of units)if(u.owner===s.actor)friendlyCounts.set(u.hex,(friendlyCounts.get(u.hex)||0)+1);
 const threatened=new Set(context.map.cells.filter(c=>c.city?.name&&s.state.cityControl?.[c.city.name]===s.actor&&adj.get(c.id)?.some(h=>enemyHexes.has(h))).map(c=>c.id));
 const dist=objectiveDistanceField(adj,cities.keys());
 // A reserve should be able to approach an exposed, ungarrisoned friendly
 // city over successive moves, even if it cannot reach the city this phase.
 // Use only public ground occupancy; support markers are not garrisons or threats.
 const reliefEnabled=operational&&objectivePolicy==='reserve-relief';
 const groundFriends=new Set(reliefEnabled?units.filter(u=>u.owner===s.actor&&!u.marker).map(u=>u.hex):[]);
 const groundEnemies=new Set(reliefEnabled?units.filter(u=>u.owner!==s.actor&&!u.marker).map(u=>u.hex):[]);
 const reliefTargets=reliefEnabled?context.map.cells.filter(c=>c.city?.name&&s.state.cityControl?.[c.city.name]===s.actor&&!groundFriends.has(c.id)&&adj.get(c.id)?.some(h=>groundEnemies.has(h))).map(c=>c.id):[];
 // Score marginal relief coverage rather than every unit's progress toward
 // the same city. A closer reserve already covers the approach; do not send
 // another merely for reducing its own distance. Sole city garrisons are not
 // counted as available reserves. Fields are advisory, not legal routes.
 const friendlyCityHexes=new Set(reliefEnabled?context.map.cells.filter(c=>c.city?.name&&s.state.cityControl?.[c.city.name]===s.actor).map(c=>c.id):[]);
 const groundCounts=new Map();
 if(reliefEnabled)for(const u of units)if(u.owner===s.actor&&!u.marker)groundCounts.set(u.hex,(groundCounts.get(u.hex)||0)+1);
 const reserves=reliefEnabled?units.filter(u=>u.owner===s.actor&&!u.marker&&u.hex&&!(friendlyCityHexes.has(u.hex)&&groundCounts.get(u.hex)===1)):[];
 // Only count competing reserves with an available, marker-free move
 // toward this particular objective. A nearer but immobile formation must
 // not suppress the approach of a mobile reserve. The catalogue supplies
 // legal paths; distances themselves remain advisory.
 const reserveMoves=new Map();
 const markerHexes=reliefTargets.length?new Set([...units.filter(u=>u.marker),...Object.values(s.state.supportMarkers||{})].map(u=>u.hex)):null;
 if(reliefTargets.length){
  for(const a of commands)if(a.type==='declare-ground-move'&&!a.request.path.slice(1).some(h=>markerHexes.has(h))){
   const {unitId,path}=a.request;
   if(!reserveMoves.has(unitId))reserveMoves.set(unitId,new Set());
   reserveMoves.get(unitId).add(path.at(-1));
  }
 }
 const reliefFields=reliefTargets.map(h=>{
  const field=objectiveDistanceField(adj,[h]);
  // Keep two nearest distances so the moving unit can be excluded in O(1).
  const nearest=reserves.filter(u=>field.has(u.hex)&&[...(reserveMoves.get(u.id)||[])].some(to=>distanceProgress(field,u.hex,to)>0)).map(u=>({id:u.id,d:field.get(u.hex)})).sort((a,b)=>a.d-b.d).slice(0,2);
  return {field,nearest};
 });
 const reserveIds=new Set(reserves.map(u=>u.id));
 const reliefScore=(id,from,to)=>{
  if(!reserveIds.has(id))return 0;
  let gain=0,loss=0;
  for(const {field,nearest} of reliefFields){
   if(!field.has(from)||!field.has(to))continue;
   const other=nearest.find(x=>x.id!==id)?.d??Infinity;
   const delta=Math.min(other,field.get(from))-Math.min(other,field.get(to));
   gain=Math.max(gain,delta);loss=Math.max(loss,-delta);
  }
  // A single formation cannot cover several cities at once; avoid summing
  // overlapping gains. Do not abandon a nearer approach for an equal gain.
  return gain-loss;
 };
 // Compare configured defensive column protection only where an enemy is
 // immediately adjacent. No strength reads, attack probability or future ZOC.
 const geography=communication?Geography.create(context.map,context.profile,{cityMarkerMode:context.combatPolicy?.cityMarkerMode,fortificationMode:context.combatPolicy?.fortificationMode}):null;
 const modifiers=context.combatPolicy?.modifiers;
 const protection=(hex,unit)=>{
  if(!geography||!modifiers)return null;
  const attackers=units.filter(u=>u.owner!==s.actor&&!u.marker&&adj.get(hex)?.includes(u.hex)).map(u=>u.id);
  if(!attackers.length)return null;
  try{
   const g=geography.evaluate({attackers,defenders:[unit.id],defenderHex:hex},{...s.state.units,[unit.id]:{...unit,hex}});
   return -(modifiers.terrainColumnShifts[g.defenderTerrain]||0)-(g.allAttackersAcrossRiver?modifiers.allAttackersAcrossRiverShift:0);
  }catch{return null;} // Uncertified geography supplies no comparative credit.
 };
 const concentration=communication?concentrationEvaluator({snapshot:s,context,board,geography}):()=>0;
 const candidates=commands.filter(a=>a.type==='declare-ground-move').map((action,index)=>{
  const path=action.request.path,from=path[0],to=path[path.length-1];
  const capturedHexes=new Set(path.slice(1).filter(h=>cities.has(h)));
  const captured=capturedHexes.size;
  const captureValue=[...capturedHexes].reduce((sum,h)=>sum+weights.get(h),0);
  const progress=distanceProgress(dist,from,to);
  const reliefProgress=reliefEnabled&&!captured&&!path.slice(1).some(h=>markerHexes?.has(h))?reliefScore(action.request.unitId,from,to):0;
  const abandoned=Number(from!==to&&threatened.has(from)&&friendlyCounts.get(from)===1);
  const reinforced=Number(from!==to&&threatened.has(to)&&!friendlyCounts.get(to));
  // Flag the last-garrison departure for the conservative diagnostic guard
  // or the operational comparative-threat and objective-cost evaluation.
  const unit=s.state.units[action.request.unitId];
  const before=protection(from,unit),after=protection(to,unit);
  const protectionDelta=before===null||after===null?0:after-before;
  return {action,index,captured,captureValue,progress,abandoned,reinforced,reinforceValue:reinforced*(weights.get(to)||1),protectionDelta,...(reliefEnabled?{reliefProgress}:{})};
 }).filter(x=>operational||!x.abandoned).sort((a,b)=>b.reinforceValue-a.reinforceValue||b.captureValue-a.captureValue||(0.1*b.progress+0.15*b.protectionDelta+0.35*(b.reliefProgress||0))-(0.1*a.progress+0.15*a.protectionDelta+0.35*(a.reliefProgress||0))||a.index-b.index);
 if(!communication)return candidates.filter(x=>!x.abandoned).filter(x=>x.reinforced>0||x.captured>0||x.progress>0||x.reliefProgress>0);
 const buildup=require('./historical_buildup_phase').create({map:context.map,profile:context.profile,config:context.config,counterConfig:context.counterConfig,policy:context.buildupPolicy,allocation:context.buildupAllocation,fixedPolicy:context.fixedPolicy||null,combatPolicy:context.combatPolicy});
 // communicationIndex depends only on opposing units and static entry edges.
 // Moving one friendly formation cannot change the friendly safe-cell field;
 // its new hex is queried against the same field. Enemy fields must be rebuilt.
 const friendlyIndex=buildup.communicationIndex(s.actor,s.state.units);
 const links=units=>{const cache=new Map([[s.actor,friendlyIndex]]);return Object.fromEntries(Object.values(units).filter(u=>u.hex&&!u.marker).map(u=>{if(!cache.has(u.owner))cache.set(u.owner,buildup.communicationIndex(u.owner,units));return [u.id,cache.get(u.owner)(u.hex)];}));};
 const before=links(s.state.units);
 const threat=operational?Threat.create(context):null;
 const pressure=(state,hex)=>{if(!threat)return null;try{
  const count=Object.values(state.units).filter(u=>u.owner===s.actor&&u.hex===hex&&!u.marker).length;
  if(!count)return 0;
  const report=threat.assess({state,cursor:s.cursor,owner:s.actor,hex});
  return report.unknownPlans?null:count*Math.min(1,(report.strongest?.odds||0)/6);
 }catch{return null;}};
 const pressureCache=new Map(),endpointCache=new Map();
 // Bound expensive board scans. Exclude support-marker interactions rather
 // than speculate about forced displacement or its random consequences.
 const markers=new Set([...units.filter(u=>u.marker),...Object.values(s.state.supportMarkers||{})].map(u=>u.hex));
 const eligible=candidates.filter(x=>!x.action.request.path.slice(1).some(h=>markers.has(h)));
 // Reserve one top-ranked candidate per formation before filling remaining slots.
 const seen=new Set();
 const diverse=operational?eligible.filter(x=>{const id=x.action.request.unitId;if(seen.has(id))return false;seen.add(id);return true;}):[];
 const shortlist=operational?[...new Set([...diverse,...eligible])].slice(0,32):eligible.slice(0,32);
 return shortlist.map(x=>{
  const {unitId,path}=x.action.request;
  // Endpoint-only projections are deliberately advisory (route capture remains
  // separately scored). Reuse only within this unchanged snapshot.
  const key=JSON.stringify([unitId,path[0],path.at(-1)]);
  let endpoint=endpointCache.get(key);
  if(!endpoint){
   const projected={...s.state.units,[unitId]:{...s.state.units[unitId],hex:path.at(-1)}};
   const after=links(projected);
   let friendlyRestored=0,friendlyCut=0,enemyRestored=0,enemyCut=0;
   for(const [id,linked] of Object.entries(before))if(after[id]!==linked){
    if(s.state.units[id].owner===s.actor){if(after[id])friendlyRestored++;else friendlyCut++;}
    else {if(after[id])enemyRestored++;else enemyCut++;}
   }
   const net=friendlyRestored-friendlyCut+enemyCut-enemyRestored;
   const concentrationDelta=concentration(unitId,path.at(-1));
   let threatDelta=null;
   if(operational){const from=path[0],to=path.at(-1);
    const affected=[...new Set([from,to])];
    for(const h of affected)if(!pressureCache.has(h))pressureCache.set(h,pressure(s.state,h));
    const a=affected.map(h=>pressureCache.get(h)),b=affected.map(h=>pressure({...s.state,units:projected},h));
    if([...a,...b].every(Number.isFinite))threatDelta=a.reduce((x,y)=>x+y,0)-b.reduce((x,y)=>x+y,0);
   }
   endpoint={friendlyRestored,friendlyCut,enemyRestored,enemyCut,net,concentrationDelta,threatDelta};
   endpointCache.set(key,endpoint);
  }
  const {friendlyRestored,friendlyCut,enemyRestored,enemyCut,net,concentrationDelta,threatDelta}=endpoint;
  if(x.abandoned&&!(threatDelta>0))return {...x,score:-Infinity};
  return {...x,threatDelta,concentrationDelta,communication:{friendlyRestored,friendlyCut,enemyRestored,enemyCut,net},score:2*x.reinforceValue+x.captureValue+0.1*x.progress+0.35*(x.reliefProgress||0)+0.25*net+(threatDelta===null?0.15*x.protectionDelta:threatDelta)+0.25*concentrationDelta-(x.abandoned?(weights.get(path[0])||1):0)};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);

}
// Greedy bounded joint declaration: never reuse an attacker or target.
// Each added engagement must pass the authoritative transaction. This is
// not an exhaustive joint-utility search; ranked engagements can interact.
function selectRankedPlan({ranked,limit,validate,supportDependent=new Set()}){
 const chosen=[],spent=new Set(),targets=new Set();let supported=null;
 for(const battle of ranked){
  if(chosen.length>=limit)break;
  if(targets.has(battle.defenderHex)||battle.attackers.some(id=>spent.has(id)))continue;
  if(supportDependent.has(battle)&&supported)continue;
  if(!validate([...chosen,battle]))continue;
  chosen.push(battle);targets.add(battle.defenderHex);battle.attackers.forEach(id=>spent.add(id));
  if(supportDependent.has(battle))supported=battle;
 }
 return supported?[supported,...chosen.filter(b=>b!==supported)]:chosen;
}
// Experimental bounded joint attack selection. Only detailed continuation
// scores share the same utility scale; proxy scores are not added to them.
// The sum is an ordering heuristic, not a simulation of interacting battles.
function selectCoordinatedPlan({evaluated,limit,validate,maxTrials=64,maxCandidates=12}){
 if(limit<=0)return [];
 const detailed=evaluated.filter(x=>Number.isFinite(x.delta)&&x.delta>0&&(!x.method||x.method==='supported-detailed-utility'));
 const proxies=evaluated.filter(x=>!detailed.includes(x));
 const supported=x=>x.method==='supported-detailed-utility';
 const order=xs=>[...xs.filter(supported),...xs.filter(x=>!supported(x))];
 const legal=(xs,x)=>xs.length<limit&&!xs.some(y=>y.battle.defenderHex===x.battle.defenderHex||y.battle.attackers.some(id=>x.battle.attackers.includes(id))||(supported(y)&&supported(x)));
 const valid=xs=>validate(order(xs).map(x=>x.battle));
 // Establish a deterministic legal incumbent, even when search is exhausted.
 let best=[];
 for(const x of detailed)if(legal(best,x)&&valid([...best,x]))best.push(x);
 let bestScore=best.reduce((n,x)=>n+x.delta,0),trials=0;
 const pool=[...detailed].sort((a,b)=>b.delta-a.delta).slice(0,maxCandidates);
 const visit=(start,chosen,score)=>{
  if(score>bestScore){best=[...chosen];bestScore=score;}
  if(chosen.length>=limit||trials>=maxTrials)return;
  // Optimistic bound ignores conflicts; cannot prune an improving subset.
  const upper=score+pool.slice(start,start+limit-chosen.length).reduce((n,x)=>n+x.delta,0);
  if(upper<=bestScore)return;
  for(let i=start;i<pool.length&&trials<maxTrials;i++){
   const x=pool[i];if(!legal(chosen,x))continue;
   const next=[...chosen,x];trials++;
   if(valid(next))visit(i+1,next,score+x.delta);
  }
 };
 visit(0,[],0);
 // Lower-confidence proposals may fill unused slots, never displace a
 // detailed selection on the basis of incomparable category proxy scores.
 for(const x of proxies)if(legal(best,x)&&valid([...best,x]))best.push(x);
 return order(best).map(x=>x.battle);
}
// Repair an incomplete comparison in the joint planner: a weak attack
// assessed WITH air must also compete against a stronger legal attack at
// the same target assessed WITH that same marker. Only use idle attackers;
// do not undo the joint allocation or assume support the executor will hold.
// Bounded to four already detailed ground alternatives. Never roll dice.
function strengthenSupportedPlan({session,snapshot:s,context,chosen,evaluated,maxCandidates=4}){
 const weak=evaluated.find(x=>x.battle===chosen[0]&&x.method==='supported-detailed-utility');
 if(!weak||!Number.isFinite(weak.delta)||!weak.airSupportId)return chosen;
 const spent=new Set(chosen.slice(1).flatMap(b=>b.attackers));
 const alternatives=evaluated.filter(x=>!x.method&&Number.isFinite(x.delta)&&x.delta>0&&x.odds>weak.odds&&
  x.battle.defenderHex===weak.battle.defenderHex&&x.battle.attackers.length>weak.battle.attackers.length&&
  weak.battle.attackers.every(id=>x.battle.attackers.includes(id))&&!x.battle.attackers.some(id=>spent.has(id))).slice(0,maxCandidates);
 if(!alternatives.length)return chosen;
 const threat=Threat.create(context);let best=chosen,bestDelta=weak.delta;
 for(const x of alternatives){
  const battle=x.battle,plan=[battle,...chosen.slice(1)];
  try{
   // Same public state and utility model as rankContinuations. The stronger
   // attack is not a new historical action type or an implicit air commitment.
   const r=threat.compareContinuations({state:s.state,cursor:s.cursor,owner:s.actor,hex:s.state.units[battle.attackers[0]].hex,battle,
    allAttackerOrigins:true,positionUtility:true,objectiveUtility:true,communicationUtility:true,cityAdvance:true,nonCityAdvance:true,
    airSupportId:weak.airSupportId,maxTrials:64,maxNodes:32});
   const delta=r.withdrawal?.search?.truncated?null:r.utility?.delta;
   if(!Number.isFinite(delta)||delta<=bestDelta+1e-9)continue;
   const declared=session.execute({type:'combat',action:{type:'commit-battles',battles:plan}}).session;
   const selected=declared.execute({type:'combat',action:{type:'select-battle',defenderHex:battle.defenderHex}}).session;
   const options=Catalog.discover({session:selected,context,enumerateCombinedPlans:false});
   const air=chooseGroundAir({snapshot:selected.snapshot(),context,commands:options.commands});
   // Reject if the actual, reproducible allocator would choose a different
   // marker or reserve it for another attack. No transient plan state needed.
   if(air?.action?.faceId!==weak.airSupportId)continue;
   best=plan;bestDelta=delta;
  }catch{/* Unavailable or rejected projections leave the legal incumbent. */}
 }
 return best;
}
// Two-move deterministic lookahead for the experimental doctrine. Reuse the
// ranked catalogue as a bounded candidate pool, but revalidate and rescore
// each continuation on the actual projected position. No hypothetical dice.
// The winning first action alone is committed; the next decision is replanned.
function selectMovementContinuation({ranked,project,rankNext,maxFirst=3,maxNext=8}){
 const greedy=ranked[0];if(!greedy||maxFirst<1||maxNext<1)return greedy;
 if(!ranked.some(x=>x.action.request.unitId!==greedy.action.request.unitId))return greedy;
 let best=greedy,bestScore=greedy.score;
 // Include different formations before alternative paths for the same unit.
 const seen=new Set(),diverse=ranked.filter(x=>{const id=x.action.request.unitId;if(seen.has(id))return false;seen.add(id);return true;});
 const firsts=[...new Set([...diverse,...ranked])].slice(0,maxFirst);
 for(const x of firsts){
  const next=project(x.action);if(!next)continue;
  const pool=ranked.filter(y=>y.action.request.unitId!==x.action.request.unitId).slice(0,maxNext).map(y=>y.action);
  const continuation=rankNext(next,pool)[0];
  const score=x.score+(continuation?.score||0);
  if(score>bestScore){best=x;bestScore=score;}
 }
 return best;
}
function chooseOperationalMovement({session,snapshot:s,context,ranked,policy:p}){
 if(!p.movementLookahead||p.objectivePolicy!=='reserve-relief'||p.maxGroundMovesPerPhase-s.usedUnitIds.length<2||p.maxActions-s.actionCount<4)return ranked[0];
 const first=ranked[0],other=ranked.find(x=>x.action.request.unitId!==first?.action.request.unitId);
 if(!first||!other)return first;
 // Only spend lookahead on an apparent conflict between the leading moves
 // of two different formations. Independent routine advances do not need it.
 const a=first.action.request.path,b=other.action.request.path;
 const enemyCities=new Set(context.map.cells.filter(c=>c.city?.name&&s.state.cityControl?.[c.city.name]&&s.state.cityControl[c.city.name]!==s.actor).map(c=>c.id));
 const conflict=a.includes(b.at(-1))||b.includes(a.at(-1))||a.slice(1).some(h=>enemyCities.has(h)&&b.slice(1).includes(h));
 if(!conflict)return first;
 // Avoid predicting forced Fleet displacement; the only allowed projection
 // consists of declaration and ordinary deterministic resolution.
 const projectMove=(base,a)=>{
  try{
   const next=base.projectGroundMove(a);
   return next.snapshot().phaseId===s.phaseId?next:null;
  }catch{return null;}
 };
 const rankNext=(next,pool)=>{
  const snap=next.snapshot();
  const valid=next.canExecuteGroundBatch(pool);
  const before=Rules.stackPenalty(context.profile,snap.state.units,snap.actor).excess;
  const legal=pool.filter((a,i)=>{
   if(!valid[i])return false;
   if(!context.profile.allowTemporaryMovementOverstack)return true;
   const {unitId,path}=a.request,u=snap.state.units[unitId];
   return Rules.stackPenalty(context.profile,{...snap.state.units,[unitId]:{...u,hex:path.at(-1)}},snap.actor).excess<=before;
  });
  if(!legal.length)return [];
  // Recompute objective ownership, communication and threats after move one.
  // Candidate paths not present in the original shortlist are deliberately
  // omitted; this is bounded search, not complete phase optimization.
  const rankedNext=rankObjectiveMoves({snapshot:snap,context,commands:legal,communication:true,operational:true,objectivePolicy:p.objectivePolicy});
  // A declaration is not proof of a deterministic resolution. Verify the
  // chosen continuation on a disposable session as well.
  const best=rankedNext.find(x=>projectMove(next,x.action));
  return best?[best]:[];
 };
 return selectMovementContinuation({ranked,project:a=>projectMove(session,a),rankNext});
}
function decide({session,context,policy={}}){
 const p=policyOf(policy);
 if(!session||typeof session.snapshot!=='function'||typeof session.execute!=='function'||typeof session.save!=='function')
  throw Error('Campaign session with save and execute required');
 const s=session.snapshot();
 if(s.cursor.complete)return {status:'complete',terminal:copy(s.terminal||null)};
 if(s.actionCount>=p.maxActions)return {status:'blocked',reason:'controller-action-budget',phase:s.phaseId};
 if(!s.phaseSupported)return {status:'blocked',reason:'unsupported-historical-phase',phase:s.phaseId};
 const action=(a,reason)=>a?({status:'action',action:copy(a),reason}):
  ({status:'blocked',reason:'no-authoritative-action',detail:reason,phase:s.phaseId});
 // Selection is deterministic for a saved state; it never samples future dice.
 const pick=(choices,purpose)=>{
  if(!choices.length)return undefined;
  if(p.selectionMode==='first')return choices[0];
  const key=[p.seed,s.cursor.turn,s.phaseId,s.actionCount,purpose].join('|');
  const n=crypto.createHash('sha256').update(key).digest().readUInt32BE(0);
  return choices[p.missionSeed===undefined?n%choices.length:Random.integer(p.missionSeed,'ai',s.actionCount,choices.length)];
 };
 const journal=typeof session.journal==='function'?session.journal():session.save().journal;
 const missionDie=purpose=>p.missionSeed===undefined?dieFor(p.seed,s,purpose):Random.die(p.missionSeed,journal,purpose==='ground'?'combat':'naval');
 const history=journal.map(x=>x.action);
 const historyCount=t=>history.filter(a=>(a.type==='combat'?a.action.type:a.type)===t).length;
 // The discoverer is intentionally run at a source-defined decision point,
 // not used to inspect alternative die outcomes before the die is fixed.
 let options;
 // Multi-battle search is unnecessary when this run permits at most one
 // attack per phase. Individual proposals remain source-validated, and the
 // eventual declaration still goes through the authoritative transaction.
 try{options=Catalog.discover({session,context,
  enumerateCombinedPlans:p.maxCombatsPerPhase>1&&p.attackSelection!=='continuation-pilot'});}
 catch(e){return {status:'blocked',reason:'action-discovery-failed',detail:e.message,phase:s.phaseId};}
 if(options.blocked)return {status:'blocked',reason:options.blocked,phase:s.phaseId};
 const byType=t=>pick(options.commands.filter(a=>(a.type==='combat'?a.action.type:a.type)===t),t);
 if(s.phaseKind==='housekeeping')return action(byType('finish-housekeeping'),'finish-turn');
 if(s.phaseKind==='buildup'){
  const phaseJournal=history.slice(history.map(a=>a.type).lastIndexOf('finish-buildup')+1);
  const already=phaseJournal.filter(a=>['place-reinforcement','place-evacuated-reinforcement'].includes(a.type)).length;
  if(already<p.maxReinforcementsPerPhase){
   const placement=byType('place-reinforcement')||byType('place-evacuated-reinforcement');if(placement)return action(placement,'source-legal-reinforcement');
  }
  const replacement=byType('apply-replacement');
  // Conservative: one replacement action per buildup phase.
  if(replacement&&(p.phaseScope==='operational'||!phaseJournal.some(a=>a.type==='apply-replacement')))return action(replacement,'source-legal-replacement');
  return action(byType('finish-buildup'),'finish-buildup');
 }
 if(s.phaseKind==='combat'){
  const c=s.combat;
  if(c.status==='air-sea-open'){
   if(c.pendingSeaFaceId!==null)return action({type:'combat',action:{type:'roll-fleet-attack',
    die:missionDie('naval')}},'committed-naval-die');
   if(fleetDeclarationCount(history,'declare-fleet-attack',p.fleetBudgetScope)<p.maxFleetAttacks){
    const attack=byType('declare-fleet-attack');if(attack)return action(attack,'source-legal-naval-commitment');
   }
   return action(byType('finish-air-sea'),'finish-naval-window');
  }
  if(c.status==='awaiting-declarations'){
   const usedPhases=historyCount('commit-battles');
   let chosen=[],pilotDecisions=null,pilotMethod=null;
   if(usedPhases<p.maxCombatPhases&&p.maxCombatsPerPhase>0){
    let proposals=options.proposals, eligible=null,supportDependent=new Set(), rankedEvaluations=[];
    if(p.attackSelection==='continuation-pilot'){
     const evaluated=rankContinuations({snapshot:s,context,proposals,...Difficulty.continuation(p.difficulty??0),includeFallback:p.phaseScope==='operational',nonCityAdvance:p.phaseScope==='operational',supportPlanning:p.phaseScope==='operational'});
     pilotDecisions=evaluated.decisions;
     rankedEvaluations=evaluated.ranked;
     pilotMethod=evaluated.ranked[0]?.method||(evaluated.ranked.length?'detailed-utility':null);
     supportDependent=new Set(evaluated.ranked.filter(a=>a.method==='supported-detailed-utility').map(a=>a.battle));
     proposals=evaluated.ranked.map(a=>a.battle);
    }else if(p.attackSelection!=='coverage'){
     const screened=screenBattles({snapshot:s,context,proposals,utilityPilot:p.attackSelection==='utility-pilot'});
     proposals=screened.known.length?screened.known:screened.uncertain;
     eligible=new Set(proposals);
    }
    if(p.attackSelection==='continuation-pilot'&&p.maxCombatsPerPhase>1){
     const validate=battles=>{
      return typeof session.canExecute==='function'?session.canExecute({type:'combat',action:{type:'commit-battles',battles}}):(()=>{try{session.execute({type:'combat',action:{type:'commit-battles',battles}});return true;}catch{return false;}})();
     };
     chosen=p.coordinatedAttacks?selectCoordinatedPlan({evaluated:rankedEvaluations,limit:p.maxCombatsPerPhase,validate}):selectRankedPlan({ranked:proposals,limit:p.maxCombatsPerPhase,supportDependent,validate});
     if(p.coordinatedAttacks)chosen=strengthenSupportedPlan({session,snapshot:s,context,chosen,evaluated:rankedEvaluations});
    }else if(['utility-pilot','continuation-pilot'].includes(p.attackSelection)){
     chosen=proposals.length?[proposals[0]]:[];
    }else if(p.selectionMode==='first'){
     // Preserve the established v399 first-proposal selection contract.
     const spent=new Set(),targets=new Set();
     for(const b of proposals.slice(0,p.maxCombatsPerPhase)){
      if(targets.has(b.defenderHex)||b.attackers.some(id=>spent.has(id)))continue;
      chosen.push(b);targets.add(b.defenderHex);b.attackers.forEach(id=>spent.add(id));
     }
    }else{
     // Multi-battle combinations must be validated by the authoritative catalog.
     // Never splice together individually legal battles that conflict jointly.
     const valid=plans=>(plans||[]).filter(plan=>!eligible||plan.every(b=>eligible.has(b)));
     const triples=p.maxCombatsPerPhase>=3?valid(options.expandedPlans):[];
     const pairs=p.maxCombatsPerPhase>=2?valid(options.plans):[];
     const candidates=triples.length?triples:pairs.length?pairs:proposals.map(b=>[b]);
     chosen=pick(candidates,'battle-plan')||[];
    }
   }
   const declaration={type:'combat',action:{type:'commit-battles',battles:chosen}};
   try{session.execute(declaration);}catch(e){return {status:'blocked',reason:'combat-plan-not-legal',detail:e.message};}
   const decision=action(declaration,chosen.length?(p.attackSelection==='continuation-pilot'?'continuation-pilot-positive-utility':p.attackSelection==='utility-pilot'?'utility-pilot-positive-conventional':'source-legal-combat-plan'):'no-optional-attack');
   if(pilotDecisions!==null){decision.attackDiagnostics=pilotDecisions;decision.attackMethod=pilotMethod;}
   return decision;
  }
  if(c.status==='committed')return action(p.phaseScope==='operational'?options.commands.find(a=>a.action?.type==='select-battle'):byType('select-battle'),'select-committed-battle');
  if(c.status==='battle-selected'){
   const air=byType('commit-ground-air');
   if(air)return action(p.phaseScope==='operational'?chooseGroundAir({snapshot:s,context,commands:options.commands}):p.attackSelection==='continuation-pilot'?options.commands.find(a=>a.action?.type==='commit-ground-air'&&a.action.faceId===null):p.selectionMode==='first'?
    options.commands.find(a=>a.action?.type==='commit-ground-air'&&a.action.faceId===null)||air:
    air,'precommit-air-support');
   const die=missionDie('ground');
   let post;
   try{post=Catalog.discoverPostRoll({session,context,die});}
   catch(e){
    if(e.message==='No die is rolled when odds produce automatic NE'){
     // The rules resolve this battle without rolling; no supplied d6 is consumed.
     try{post=Catalog.discoverPostRoll({session,context,die:null});}
     catch(error){return {status:'blocked',reason:'automatic-result-discovery-failed',detail:error.message,phase:s.phaseId};}
    }else return {status:'blocked',reason:'post-roll-discovery-failed',detail:e.message,die,phase:s.phaseId};
   }
   if(post.options.length){
    if(p.attackSelection==='continuation-pilot'){const best=(p.phaseScope==='operational'?rankOperationalPostRoll({session,snapshot:s,context,post}):rankPostRoll({snapshot:s,context,post}))[0];return action(best.option.action,'post-roll-material-city-utility');}
    return action(pick(post.options,'combat-consequence').action,'post-roll-validated-consequence');
   }
   if(post.fleetCommitments.length)return action(pick(post.fleetCommitments,'postcombat-fleet').action,'precommit-fleet-displacement');
   return {status:'blocked',reason:'no-authorized-post-roll-decision',die,phase:s.phaseId,
    outcome:post.crtOutcome};
  }
  if(c.status==='fleet-die-pending')return action({type:'combat',action:{type:'roll-fleet-displacement',
   die:missionDie('fleet-reaction')}},'committed-fleet-displacement-die');
  if(c.status==='battles-resolved'||c.status==='no-battles-declared')return action(byType('finish-combat'),'finish-combat');
  return {status:'blocked',reason:'unknown-combat-status',detail:c.status,phase:s.phaseId};
 }
 if(['movement','special-movement','naval-operations'].includes(s.phaseKind)){
  if(s.stackingCleanup){
   const losses=options.commands.filter(a=>a.type==='remove-overstack-unit');
   if(losses.length){
    const value=a=>{const u=s.state.units[a.unitId];return u.printedCombatStrength??Number.MAX_SAFE_INTEGER;};
    losses.sort((a,b)=>value(a)-value(b)||a.unitId.localeCompare(b.unitId));
    return action(losses[0],'mandatory-owner-selected-overstack-removal');
   }
   return action(byType('finish-phase'),'finish-cleaned-movement-phase');
  }
  if(s.pendingNavalGround)return action({type:'roll-naval-ground-transport',die:missionDie('naval-ground')},'committed-naval-ground-die');
  if(s.phaseKind==='naval-operations'&&s.usedUnitIds.length<p.maxGroundMovesPerPhase){
   const transport=byType('declare-naval-ground-transport');if(transport)return action(transport,'source-legal-naval-ground-transport');
  }
  if(s.pendingFleet!==null)return action({type:'roll-fleet-move',die:missionDie('fleet-move')},'committed-fleet-move-die');
  if(s.pendingGround){
   if(s.pendingPort!==null)return action({type:'resolve-forced-ground-move',die:missionDie('forced-port')},'committed-forced-port-die');
   const move=byType('resolve-ground-move');if(move)return action(move,'finish-pending-movement');
   const port=byType('commit-forced-port');if(port)return action(port,'precommit-forced-fleet-port');
   return {status:'blocked',reason:'pending-ground-move-has-no-legal-resolution',phase:s.phaseId};
  }
  // Conservative AI policy: do not incur new compulsory losses without
  // a proven continuation. Prefer immediately resolving any existing excess.
  let moveCommands=options.commands;
  if(context.profile.allowTemporaryMovementOverstack===true){
   // Only the origin and destination stacks change, so compute a local
   // delta rather than scanning the whole roster for every legal route.
   const stacks=new Map();
   for(const u of Object.values(s.state.units))if(u.owner===s.actor&&!u.marker){
    if(!stacks.has(u.hex))stacks.set(u.hex,[]);stacks.get(u.hex).push(u);
   }
   const at=h=>stacks.get(h)||[];
   const penalty=group=>Rules.stackPenalty(context.profile,group,s.actor).excess;
   const before=new Map([...stacks].map(([h,group])=>[h,penalty(group)]));
   const improving=[];
   moveCommands=moveCommands.filter(a=>{
    if(a.type!=='declare-ground-move')return true;
    const {unitId,path}=a.request,from=path[0],to=path.at(-1);
    const unit=s.state.units[unitId];
    const delta=penalty(at(from).filter(u=>u.id!==unitId))+penalty([...at(to),{...unit,hex:to}])-(before.get(from)||0)-(before.get(to)||0);
    if(delta<0)improving.push(a);
    return delta<=0;
   });
   if(improving.length&&s.usedUnitIds.length<p.maxGroundMovesPerPhase)return action(improving[0],'resolve-temporary-overstack-before-phase-end');
  }
  if(s.usedUnitIds.length<p.maxGroundMovesPerPhase){
   if(p.attackSelection==='continuation-pilot'){
    const ranked=rankObjectiveMoves({snapshot:s,context,commands:moveCommands,communication:true,operational:p.phaseScope==='operational',objectivePolicy:p.objectivePolicy});
    const best=chooseOperationalMovement({session,snapshot:s,context,ranked,policy:p});
    if(best)return action(best.action,'objective-directed-ground-movement');
   }else{const move=pick(moveCommands.filter(a=>a.type==='declare-ground-move'),'declare-ground-move');if(move)return action(move,'source-legal-ground-movement');}
  }
  if(fleetDeclarationCount(history,'declare-fleet-move',p.fleetBudgetScope)<p.maxFleetMoves&&!s.fleetUsed){
   const fleet=byType('declare-fleet-move');if(fleet)return action(fleet,'source-legal-fleet-movement');
  }
  return action(byType('finish-phase'),'finish-movement-phase');
 }
 return {status:'blocked',reason:'unsupported-controller-phase',phase:s.phaseId};
}
function run({session,context,policy={},policyForActor,onStep}={}){
 const p=policyOf(policy);
 if(!session||!context)throw Error('Source-bound historical campaign session and context required');
 context=require('./movement_binding').prepareContext(context);
 let current=session;const trace=[],stats={moves:0,combats:0,reinforcements:0,navalRolls:0,turns:0};
 for(let i=0;i<p.maxActions;i++){
  const activePolicy=policyForActor?policyOf({...policyForActor(current.snapshot().actor),maxActions:p.maxActions}):p;
  const d=decide({session:current,context,policy:activePolicy});
  if(d.status!=='action')return {status:d.status,reason:d.reason||null,detail:d.detail||null,
   decision:d,session:current,trace,stats};
  if(!d.action)return {status:'blocked',reason:'no-committable-action',decision:d,session:current,trace,stats};
  let result;
  try{result=current.execute(d.action);}catch(e){return {status:'blocked',reason:'action-rejected',detail:e.message,
   decision:d,session:current,trace,stats};}
  current=result.session;
  trace.push({turn:current.snapshot().cursor.turn,reason:d.reason,action:d.action,
   event:result.event||null});
  if(d.action.type==='resolve-ground-move'||d.action.type==='resolve-forced-ground-move')stats.moves++;
  if(d.action.action?.type==='resolve-battle')stats.combats++;
  if(d.action.type==='place-reinforcement')stats.reinforcements++;
  if(d.action.action?.type==='roll-fleet-attack')stats.navalRolls++;
  if(d.action.type==='finish-housekeeping')stats.turns++;
  if(onStep)onStep({session:current,decision:d,event:result.event||null,stats:copy(stats)});
 }
 if(current.snapshot().cursor.complete)return {status:'complete',reason:null,decision:{status:'complete'},session:current,trace,stats};
 return {status:'blocked',reason:'controller-action-budget',session:current,trace,stats};
}
module.exports=Object.freeze({policyOf,fleetDeclarationCount,dieFor,screenBattles,rankContinuations,rankPostRoll,rankOperationalPostRoll,chooseGroundAir,objectiveDistanceField,rankObjectiveMoves,concentrationEvaluator,selectRankedPlan,selectCoordinatedPlan,strengthenSupportedPlan,selectMovementContinuation,chooseOperationalMovement,decide,run});
