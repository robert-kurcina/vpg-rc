/* GENERATED. Do not edit. */
(function(root){"use strict";const r=root.__historicalBundle;if(!r||r.revision!=="21e0d2fdfbe41a9acb80d6567362ec91edcdacd315e8e24316858acb4feb7c41")throw Error("Historical bundle version mismatch");const defs=r.definitions,parts=r.parts;
defs["core/ai_difficulty.js"]=function(module,exports,require,Buffer){
/* Optional graded AI effort presets. No changes to rules, unit values or RNG. */
(function(root){
'use strict';
const unlimited=Number.MAX_SAFE_INTEGER;
// Grade zero is a compatibility sentinel, not an eleventh difficulty grade.
// These are uncalibrated effort presets; strength need not be monotonic.
// Historical optional moves, attacks, detailed candidates, trials, nodes;
// native optional moves and battles. Mandatory decisions are not budgeted here.
const rows=Object.freeze([
 [3,1,2,32,16,2,1], [5,1,3,40,20,3,1], [7,2,4,48,24,4,2],
 [10,2,5,56,28,5,2], [14,3,6,64,32,6,3], [18,4,8,64,32,8,3],
 [24,6,8,80,40,10,4], [unlimited,8,10,96,48,12,5],
 [unlimited,unlimited,12,112,56,16,6], [unlimited,unlimited,16,128,64,60,20]
].map(Object.freeze));
function validate(value){if(!Number.isInteger(value)||value<0||value>10)throw Error('Invalid AI difficulty');return value;}
function native(grade=0){validate(grade);if(!grade)return {};const row=rows[grade-1];return {maxMovesPerPhase:row[5],maxBattlesPerPhase:row[6],maxActions:400};}
function historical(grade=0){validate(grade);if(!grade)return {};const row=rows[grade-1];return {maxGroundMovesPerPhase:row[0],maxCombatsPerPhase:row[1]};}
function continuation(grade=0){validate(grade);if(!grade)return {};const row=rows[grade-1];return {maxCandidates:row[2],maxTrials:row[3],maxNodes:row[4]};}
// Player-facing presets do not change internal numerical profiles or saved values.
const expert=Object.freeze({'battle-for-moscow':8,arduous:4,leningrad:7,kiev:7,'kiev-odessa':7});
function presets(scenario){if(!Object.hasOwn(expert,scenario))throw Error('Unknown difficulty scenario');return Object.freeze([0,1,3,expert[scenario]]);}
function restoreSelect(select,value){
 validate(value);const key=String(value);
 for(const option of Array.from(select.options))if(option.dataset.legacyGrade==='true'&&option.value!==key)option.remove();
 if(!Array.from(select.options).some(option=>option.value===key)){
  const option=select.ownerDocument.createElement('option');option.value=key;option.textContent='Legacy grade '+key;option.dataset.legacyGrade='true';select.appendChild(option);
 }
 select.value=key;
 if(!select.dataset.legacyGradeBound){select.dataset.legacyGradeBound='true';select.addEventListener('change',()=>{for(const option of Array.from(select.options))if(option.dataset.legacyGrade==='true'&&option.value!==select.value)option.remove();});}
}
const api=Object.freeze({validate,native,historical,continuation,presets,restoreSelect});
if(typeof module==='object'&&module.exports)module.exports=api;else root.WargameAIDifficulty=api;
})(globalThis);

};
defs["core/historical_attack_utility.js"]=function(module,exports,require,Buffer){
/* Shared pre-roll attack decision arithmetic. No state, random draws or hidden faces.
 * Utilities are comparable position values, not odds or calibrated probabilities.
 * Threat forecasts must be supplied by a separate observable-state evaluator.
 */
'use strict';
const CRT=require('./historical_crt');
const REASONS=Object.freeze(['conventional','desperation','preemptive','breakout','relief','objective','attrition','disruption','last-turn']);
function evaluate({odds,variant='standard',outcomeUtility,inactionUtility,opportunityCost=0,reason='conventional',eliminationRisk=null}={}){
 CRT.normalizeVariant(variant);
 if(!Number.isFinite(odds)||odds<0||!Number.isFinite(inactionUtility)||!Number.isFinite(opportunityCost)||opportunityCost<0||!REASONS.includes(reason)||
 (eliminationRisk!==null&&(!Number.isFinite(eliminationRisk)||eliminationRisk<0||eliminationRisk>1)))throw Error('Invalid attack utility inputs');
 if(odds===0)return {eligible:false,reason:'automatic-NE',expectedUtility:inactionUtility,delta:0,distribution:{}};
 const rolls=CRT.columns(variant)[String(odds)];
 if(!rolls)throw Error('Invalid attack utility CRT column');
 const distribution={};let total=0;
 for(const result of rolls){
  if(!Number.isFinite(outcomeUtility?.[result]))throw Error('Missing finite utility for '+result);
  total+=outcomeUtility[result];distribution[result]=(distribution[result]||0)+1;
 }
 const expectedUtility=total/6-opportunityCost,delta=expectedUtility-inactionUtility;
 // These are consideration gates, not permission to attack at negative utility.
 // Risk estimates are optional and must not be invented from isolation alone.
 const desperationThreshold=odds===0.5?0.75:odds===1?0.5:0;
 const justified=odds>1||(reason!=='conventional'&&(reason!=='desperation'||(eliminationRisk!==null&&eliminationRisk>=desperationThreshold)));
 return {eligible:justified&&delta>0,reason:!justified?'low-odds-justification-required':delta<=0?'nonpositive-utility':reason,expectedUtility,delta,distribution};
}
module.exports=Object.freeze({evaluate,REASONS});

};
defs["core/historical_campaign_autoplay.js"]=function(module,exports,require,Buffer){
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
// Shared evaluation primitives. No command execution or random draws here.
function createCombatEvaluator(context){
 const geography=Geography.create(context.map,context.profile,{cityMarkerMode:context.combatPolicy?.cityMarkerMode,fortificationMode:context.combatPolicy?.fortificationMode});
 return Consequences.create({...context,phaseConfig:context.config,geography});
}
function categoryUtility(context,odds){
 return AttackUtility.evaluate({odds,variant:context.combatPolicy?.crtVariant||'standard',outcomeUtility:{NE:0,AL:-1,EX:0,DR:0.5,DRL:1.5,DE:2},inactionUtility:0});
}
function defenderIds(s,battle){
 return Object.values(s.state.units).filter(u=>u.hex===battle.defenderHex&&u.owner!==s.actor).map(u=>u.id);
}
function comparePostRoll(a,b){
 return b.score-a.score||b.cityDelta-a.cityDelta||Number(!!a.option.advanced)-Number(!!b.option.advanced)||a.index-b.index;
}
function createCommunicationEvaluator(context){
 return require('./historical_buildup_phase').create({map:context.map,profile:context.profile,config:context.config,counterConfig:context.counterConfig,policy:context.buildupPolicy,allocation:context.buildupAllocation,fixedPolicy:context.fixedPolicy||null,combatPolicy:context.combatPolicy});
}
// Each call owns a fresh cache. Only an explicitly supplied, still-valid field
// may be reused; post-combat projections must rebuild all owner fields.
function communicationLinks(buildup,units,reusableFields=[]){
 const cache=new Map(reusableFields);
 return Object.fromEntries(Object.values(units).filter(u=>u.hex&&!u.marker).map(u=>{
  if(!cache.has(u.owner))cache.set(u.owner,buildup.communicationIndex(u.owner,units));
  return [u.id,cache.get(u.owner)(u.hex)];
 }));
}
// A conservative baseline, not strategic AI: no hidden counter faces or dice.
// Known attacks must reach the active CRT without speculative air allocation.
// Concealed engagements remain possible, but rank behind known viable ones.
function screenBattles({snapshot:s,context,proposals,utilityPilot=false,threatDiagnostics=false,withdrawalDiagnostics=false,coordinatedWithdrawalDiagnostics=false,forecastDiagnostics=false,survivalDiagnostics=false,forecastSurvivalDiagnostics=false}){
 const evaluator=createCombatEvaluator(context);
 const known=[],uncertain=[],rejected=[],assessments=[];
 const threat=(threatDiagnostics||withdrawalDiagnostics||coordinatedWithdrawalDiagnostics||forecastDiagnostics||survivalDiagnostics||forecastSurvivalDiagnostics)?Threat.create(context):null, threatByHex=new Map();
 for(const b of proposals){
  if(threat)for(const id of b.attackers){const hex=s.state.units[id].hex;if(!threatByHex.has(hex)){const args={state:s.state,cursor:s.cursor,owner:s.actor,hex};const report=threat.assess(args);if(withdrawalDiagnostics)report.withdrawal=threat.withdrawal(args);if(coordinatedWithdrawalDiagnostics)report.coordinatedWithdrawal=threat.coordinatedWithdrawal(args);if(forecastDiagnostics)report.forecast=threat.forecast(args);if(survivalDiagnostics)report.survival=threat.survival(args);if(forecastSurvivalDiagnostics)report.forecastSurvival=threat.forecastSurvival(args);threatByHex.set(hex,report);}}
  const defenders=defenderIds(s,b);
  const odds=evaluator.previewKnownOdds({state:s.state,battle:{...b,defenders},actor:s.actor,cursor:s.cursor});
  if(utilityPilot){
   // First-stage conservative policy: known outcome-category proxy only.
   // No threat forecast exists yet; do not fabricate an elimination risk.
   // Uncertain engagements need a separate public-information estimator.
   if(odds===null){rejected.push(b);assessments.push({battle:b,reason:'concealed-strength-unestimated'});continue;}
   const assessment=categoryUtility(context,odds.finalOdds);
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
 const evaluator=createCombatEvaluator(context);
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
  const delta=categoryUtility(context,odds).delta;
  if(!Number.isFinite(delta)||delta<=0)return false;
  fallback.push({battle,odds,delta,eligible:true,method:'known-odds-proxy',source});return true;
 };
 for(const battle of proposals){
  const defenders=defenderIds(s,battle);
  const odds=evaluator.previewKnownOdds({state:s.state,battle:{...battle,defenders},actor:s.actor,cursor:s.cursor});
  if(!odds){
   const estimate=evaluator.previewEstimatedOdds({state:s.state,battle:{...battle,defenders},actor:s.actor,cursor:s.cursor});
   if(!estimate?.complete){record(battle,'concealed-estimate-unavailable',{estimate});continue;}
   const columns=Object.entries(estimate.distribution).map(([o,n])=>[Number(o),n]);
   // Conservative interim policy: every possible assignment must be above 1:1.
   // Category utility is a fallback, not a substitute for positional simulation.
   if(columns.some(([o])=>o<=1)){record(battle,'concealed-low-odds-risk',{estimate});continue;}
   const delta=columns.reduce((sum,[o,n])=>sum+n*categoryUtility(context,o).delta,0)/estimate.assignments;
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
 const evaluator=createCombatEvaluator(context);
 const resolved=new Set(s.combat.resolved.map(e=>e.battle.defenderHex));
 const battles=s.combat.declaration.battles.filter(b=>!resolved.has(b.defenderHex));
 const value=odds=>categoryUtility(context,odds).delta;
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
 }).sort(comparePostRoll);
}
// Use the fixed-die validated transactions to compare post-roll positions.
// If any candidate has unknown pressure, retain the material/city ordering
// rather than treating unknown threats as safe. Bound the expensive probes.
function rankOperationalPostRoll({session,snapshot:s,context,post}){
 const ranked=rankPostRoll({snapshot:s,context,post});
 if(ranked.length>32||ranked.length<2)return ranked;
 const t=Threat.create(context);
 const buildup=createCommunicationEvaluator(context);
 const battle=s.combat.declaration.battles.find(b=>b.defenderHex===post.defenderHex);
 const origins=new Set(battle.attackers.map(id=>s.state.units[id]?.hex));
 const focal=Object.values(s.state.units).filter(u=>u.owner===s.actor&&!u.marker&&origins.has(u.hex)).map(u=>u.id);
 const original=Object.values(s.state.units).filter(u=>u.hex&&!u.marker);
 const before=communicationLinks(buildup,s.state.units);
 const scored=[];
 for(const x of ranked){
  const current=session.execute(x.option.action).session.snapshot().state;
  const surviving=focal.filter(id=>current.units[id]);let pressure=0;
  for(const hex of new Set(surviving.map(id=>current.units[id].hex))){
   const r=t.assess({state:current,cursor:s.cursor,owner:s.actor,hex});
   if(r.unknownPlans)return ranked;
   pressure+=surviving.filter(id=>current.units[id].hex===hex).length*Math.min(1,(r.strongest?.odds||0)/6);
  }
  const after=communicationLinks(buildup,current.units);let net=0;
  for(const u of original)if(Object.hasOwn(after,u.id)&&after[u.id]!==before[u.id])net+=(Number(after[u.id])-Number(before[u.id]))*(u.owner===s.actor?1:-1);
  scored.push({...x,pressure,communicationNet:net,score:x.score-pressure+0.25*net});
 }
 return scored.sort(comparePostRoll);
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
 const buildup=createCommunicationEvaluator(context);
 // communicationIndex depends only on opposing units and static entry edges.
 // Moving one friendly formation cannot change the friendly safe-cell field;
 // its new hex is queried against the same field. Enemy fields must be rebuilt.
 const friendlyIndex=buildup.communicationIndex(s.actor,s.state.units);
 const links=units=>communicationLinks(buildup,units,[[s.actor,friendlyIndex]]);
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

};
defs["core/historical_threat_assessment.js"]=function(module,exports,require,Buffer){
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

};
})(globalThis);
