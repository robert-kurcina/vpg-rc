/* Shared historical campaign legal-action discovery (v393).
 * Read-only, bounded API for human/AI controllers. Every concrete action is
 * validated by the authoritative campaign transaction; no alternate rules
 * engine, scenario-ID branch, random die, or result-dependent guess is used.
 * Combat declarations are exposed as individually legal PROPOSALS because
 * the player must commit a coherent collection before rolling any battle.
 */
'use strict';
const Binding=require('./movement_binding');
const Retreat=require('./historical_forced_retreat');
const Consequences=require('./historical_combat_consequences');
const Geography=require('./historical_combat_geography');
const Ports=require('./historical_port_support');
const Rules=require('./movement_rules');
const {clone,object:obj}=require('./historical_campaign_json');
function discover({session,context,enumerateCombinedPlans=true}){
 if(typeof enumerateCombinedPlans!=='boolean')throw Error('Invalid combined-plan enumeration policy');
 if(!session||typeof session.snapshot!=='function'||typeof session.execute!=='function'||
    !obj(context)||!obj(context.config)||!obj(context.map)||!obj(context.profile))
  throw Error('Source-bound session and historical campaign context required');
 const s=session.snapshot();
 if(s.cursor?.scenarioId!==context.config.scenarioId||s.state?.scenarioId!==context.config.scenarioId)
  throw Error('Action catalog scenario mismatch');
 const commands=[],proposals=[],plans=[],expandedPlans=[],prompts=[];
 const limits={maxPlans:128,maxThreeBattlePlans:128,maxThreeBattleSearch:25000,
  maxCombatProposals:4096,maxCombatSearch:25000,maxSearchStatesPerUnit:50000};
 const trial=(a)=>typeof session.canExecute==='function'?session.canExecute(a):
  (()=>{try{session.execute(a);return true;}catch(_){return false;}})();
 const add=(a)=>{if(!trial(a))return false;commands.push(a);return true;};
 const combat=a=>({type:'combat',action:a});
 const diePrompt=(type,extra={})=>prompts.push({kind:'die-and-choice',type,min:1,max:6,...extra});
 if(s.cursor.complete)return {phaseId:null,phaseKind:null,commands,proposals,prompts,complete:true};
 if(!s.phaseSupported)return {phaseId:s.phaseId,phaseKind:s.phaseKind,commands,proposals,prompts,blocked:'phase-not-supported'};
 if(s.stackingCleanup){
  const penalty=Rules.stackPenalty(context.profile,s.state.units,s.actor);
  if(penalty.excess)for(const unitId of penalty.choices)add({type:'remove-overstack-unit',unitId});
  else add({type:'finish-phase'});
  return clone({phaseId:s.phaseId,phaseKind:s.phaseKind,actor:s.actor,turn:s.cursor.turn,commands,proposals,plans,expandedPlans,prompts,complete:false,stackingCleanup:true,stackPenalty:penalty.excess});
 }
 if(s.phaseKind==='housekeeping')add({type:'finish-housekeeping'});
 if(s.phaseKind==='buildup'){
  add({type:'finish-buildup'});
  const policy=context.buildupPolicy;
  if(policy&&Array.isArray(policy.reinforcements)){
   for(const r of policy.reinforcements.filter(r=>r.kind==='ground'&&r.owner===s.actor&&r.turn===s.cursor.turn)){
    const city=r.placement==='named-city'?context.map.cells.find(c=>c.city?.name===r.city)?.id:null;
    const hexes=city?[city]:policy.entryEdge?.[s.actor]||[];
    for(const hex of hexes)add({type:'place-reinforcement',slotId:r.slotId,hex});
   }
   const positions=[...new Set([...(policy.entryEdge?.[s.actor]||[]),...context.map.cells.filter(c=>c.city?.name).map(c=>c.id)])];
   // Include printed replacement-only reserves in the same source-validated
   // legal-action catalogue as damaged/eliminated units. Previously these
   // were executable via API but invisible to human players.
   const reserve=policy.replacementOnlyReserveGroup&&s.cursor.turn>=policy.replacementOnlyEarliestTurn?
    context.buildupAllocation?.[policy.replacementOnlyReserveGroup]||[]:[];
   for(const unitId of new Set([...(s.state.buildupDeployedIds||[]),...reserve])){
    if(Object.hasOwn(s.state.evacuatedNavalUnits||{},unitId))continue;
    if(s.state.units[unitId])add({type:'apply-replacement',unitId,hex:null});
    else for(const hex of positions)add({type:'apply-replacement',unitId,hex});
   }
   // A surviving naval evacuee is admitted only through the existing
   // authoritative reinforcement transaction at a source-approved edge.
   if(s.actor==='soviet')for(const unitId of Object.keys(s.state.evacuatedNavalUnits||{}).sort())
    for(const hex of policy.entryEdge?.soviet||[])
     add({type:'place-evacuated-reinforcement',unitId,hex});
  }
 }
 if(s.phaseKind==='combat'&&s.combat){
  const c=s.combat;
  if(c.status==='air-sea-open'){
   if(c.pendingSeaFaceId!==null)diePrompt('roll-fleet-attack',{faceId:c.pendingSeaFaceId});
   else{
    add(combat({type:'finish-air-sea'}));
    for(const marker of context.combatPolicy?.airSupport?.markers||[])
     add(combat({type:'declare-fleet-attack',faceId:marker.faceId}));
   }
  }else if(c.status==='awaiting-declarations'){
   add(combat({type:'commit-battles',battles:[]}));
   const board=Binding.build(context.map,context.profile).board;
   const adjacent=new Map();
   for(const e of board.edges){
    if(!e.verified||e.impassable||e.lake||e.allSea)continue;
    for(const [from,to] of [[e.a,e.b],[e.b,e.a]]){
     if(!adjacent.has(from))adjacent.set(from,[]);
     adjacent.get(from).push(to);
    }
   }
   const enemyHexes=[...new Set(Object.values(s.state.units)
    .filter(u=>u.owner!==s.actor).map(u=>u.hex))].sort();
   // Source rule: at most one counter from a single adjacent origin hex may
   // participate in a particular attack. Choose zero or one at each adjacent
   // origin, and validate every resulting nonempty set against the actual
   // declaration transaction. No synthetic combat strength or new rule path.
   let examined=0;
   for(const hex of enemyHexes){
    const byOrigin=new Map();
    for(const u of Object.values(s.state.units).filter(u=>u.owner===s.actor&&adjacent.get(u.hex)?.includes(hex))){
     if(!byOrigin.has(u.hex))byOrigin.set(u.hex,[]);
     byOrigin.get(u.hex).push(u.id);
    }
    const origins=[...byOrigin.keys()].sort(),selected=[];
    for(const ids of byOrigin.values())ids.sort();
    function walk(i){
     if(++examined>limits.maxCombatSearch)throw Error('combat-proposal-search-limit-exceeded');
     if(i===origins.length){
      if(!selected.length)return;
      const battle={defenderHex:hex,attackers:[...selected]};
      if(trial(combat({type:'commit-battles',battles:[battle]}))){
       if(proposals.length===limits.maxCombatProposals)throw Error('combat-proposal-limit-exceeded');
       proposals.push(battle);
      }
      return;
     }
     walk(i+1);
     for(const id of byOrigin.get(origins[i])){
      selected.push(id);walk(i+1);selected.pop();
     }
    }
    walk(0);
   }
   // Preserve the legacy catalog's first single-attacker candidate for each
   // defender hex. Existing action clients may select the first proposal and
   // must not silently be switched to a different battle composition.
   const insertionOrder=new Map(Object.values(s.state.units).map((u,i)=>[u.id,i]));
   proposals.sort((a,b)=>a.defenderHex.localeCompare(b.defenderHex)||
    a.attackers.length-b.attackers.length||
    (a.attackers.length===1?insertionOrder.get(a.attackers[0])-insertionOrder.get(b.attackers[0]):
    a.attackers.join(':').localeCompare(b.attackers.join(':'))));
   // TWO-battle plans are still bounded, but now may combine independently
   // committed multi-attacker engagements. Include an incomplete flag when
   // a third legal two-battle plan exceeds the configured result budget.
   if(enumerateCombinedPlans){
   let plansTruncated=false;
   for(let i=0;i<proposals.length;i++){
    for(let j=i+1;j<proposals.length;j++){
     const first=proposals[i],second=proposals[j];
     if(first.defenderHex===second.defenderHex||
        first.attackers.some(id=>second.attackers.includes(id)))continue;
     const battles=[first,second];
     if(!trial(combat({type:'commit-battles',battles})))continue;
     if(plans.length===limits.maxPlans){plansTruncated=true;break;}
     plans.push(battles);
    }
    if(plansTruncated)break;
   }
   if(plansTruncated)prompts.push({kind:'enumeration-incomplete',type:'combined-battle-plans',limit:limits.maxPlans});
   // The existing `plans` contract is deliberately kept as TWO battles for
   // older consumers. Three-battle plans are a separate, explicitly bounded
   // collection, with their own completeness marker. The authoritative
   // declaration transaction—not an inferred compatibility rule—validates
   // each combination before it is shown to a human or AI controller.
   // Fixed ascending proposal indices and source-sorted proposals make
   // results deterministic without committing a battle or rolling dice.
   let expandedTruncated=false,expandedExamined=0,expandedVisited=0;
   const chosen=[],spent=new Set(),targets=new Set();
   function chooseThree(start){
    if(expandedTruncated)return;
    // Bound the search tree itself, not merely valid leaf declarations:
    // conflicting attackers or duplicate targets could otherwise create
    // millions of rejected prefixes without spending the leaf budget.
    if(++expandedVisited>limits.maxThreeBattleSearch){expandedTruncated=true;return;}
    if(chosen.length===3){
     expandedExamined++;
     const battles=[...chosen];
     if(!trial(combat({type:'commit-battles',battles})))return;
     if(expandedPlans.length===limits.maxThreeBattlePlans){expandedTruncated=true;return;}
     expandedPlans.push(battles);
     return;
    }
    for(let i=start;i<proposals.length;i++){
     if(proposals.length-i<3-chosen.length)break;
     const p=proposals[i];
     if(targets.has(p.defenderHex)||p.attackers.some(id=>spent.has(id)))continue;
     chosen.push(p);targets.add(p.defenderHex);
     for(const id of p.attackers)spent.add(id);
     chooseThree(i+1);
     for(const id of p.attackers)spent.delete(id);
     targets.delete(p.defenderHex);chosen.pop();
     if(expandedTruncated)break;
    }
   }
   if(new Set(proposals.map(p=>p.defenderHex)).size>=3)chooseThree(0);
   if(expandedTruncated)prompts.push({kind:'enumeration-incomplete',
    type:'three-battle-plans',limit:limits.maxThreeBattlePlans,
    searchLimit:limits.maxThreeBattleSearch});
   }
  }else if(c.status==='committed'){
   const resolved=new Set(c.resolved.map(e=>e.battle.defenderHex));
   for(const b of c.declaration.battles||[])if(!resolved.has(b.defenderHex))
    add(combat({type:'select-battle',defenderHex:b.defenderHex}));
  }else if(c.status==='battle-selected'){
   if(c.groundAirLocked===false&&s.actor===context.combatPolicy?.airSupport?.owner){
    add(combat({type:'commit-ground-air',faceId:null}));
    for(const marker of context.combatPolicy.airSupport.markers||[])
     add(combat({type:'commit-ground-air',faceId:marker.faceId}));
   }else{
    // An understrength attack can be automatic NE. Test the authoritative
    // transaction itself, without evaluating a second copy of the CRT.
    // A normal battle rejects a null die; the UI must not ask for a d6 when
    // the historical rules prescribe no roll at all.
    const automaticNoDie=trial(combat({type:'resolve-battle',die:null,choices:{}}));
    diePrompt('resolve-battle',{defenderHex:c.selected,automaticNoDie,
     min:automaticNoDie?null:1,max:automaticNoDie?null:6,
     note:automaticNoDie?'Automatic NE: no die is rolled; commit the result without a d6.':
      'CRT die and result-dependent choices must be resolved by the authoritative combat transaction'});
   }
  }else if(c.status==='fleet-die-pending'){
   diePrompt('roll-fleet-displacement',{to:c.pendingFleetCombat.to,
    note:'The Fleet destination has been committed; supply a fresh damage die'});
  }else if(c.status==='no-battles-declared'||c.status==='battles-resolved')add(combat({type:'finish-combat'}));
 }
 if(['movement','special-movement','naval-operations'].includes(s.phaseKind)){
  if(s.pendingNavalGround)diePrompt('roll-naval-ground-transport',{unitId:s.pendingNavalGround.unitId,destination:s.pendingNavalGround.destination});
  else if(s.pendingFleet!==null)diePrompt('roll-fleet-move',{to:s.pendingFleet});
  else if(s.pendingGround){
   if(s.pendingPort!==null)diePrompt('resolve-forced-ground-move',{to:s.pendingPort});
   else {
    // A legal ordinary resolution proves that no forced Fleet destination
    // may be committed (the same transaction enforces mutual exclusion).
    // Avoid probing every city on every ordinary ground move.
    if(!add({type:'resolve-ground-move'})){
    for(const to of Object.values(context.combatPolicy?.portSupport?.ports||{}))if(typeof to==='string')
     add({type:'commit-forced-port',to});
    // portSupport.ports may use objects; always derive locations from source map.
    for(const c of context.map.cells.filter(c=>c.city?.name))
     add({type:'commit-forced-port',to:c.id});
    }
   }
  }else{
   add({type:'finish-phase'});
   // Use the already-certified graph and the *same* movement adjudicator
   // as execution.  One least-cost route per destination is returned; the
   // search allows transit-only prefixes only if the scenario profile does.
   // Search failures are surfaced, never converted to an empty 'legal' list.
   if(s.phaseKind!=='naval-operations'){
   const binding=Binding.build(context.map,context.profile);
   const phase={kind:s.phaseKind,owner:s.actor};
   const queries=[];
   for(const u of Object.values(s.state.units).filter(u=>u.owner===s.actor&&!s.usedUnitIds.includes(u.id))){
    const modes=[null];
    if(s.phaseKind==='special-movement'&&s.actor==='soviet'&&u.class==='infantry')modes.push('rail');
    for(const mode of modes)queries.push({unitId:u.id,mode,maxStates:limits.maxSearchStatesPerUnit});
   }
   const fields=Binding.legalRoutesBatch(binding,phase,s.state.units,s.cursor.turn,queries,s.state.territory);
   const candidates=[];
   for(let i=0;i<queries.length;i++){
    const {unitId,mode}=queries[i];
    for(const route of fields[i].reachable()){
     const request={unitId,path:route.path};
     if(mode)request.mode=mode;
     candidates.push({type:'declare-ground-move',request});
    }
   }
   if(typeof session.canExecuteGroundBatch==='function'){
    const valid=session.canExecuteGroundBatch(candidates);
    candidates.forEach((action,i)=>{if(valid[i])commands.push(action);});
   }else for(const action of candidates)add(action);
   }
   if(['special-movement','naval-operations'].includes(s.phaseKind))for(const city of context.map.cells.filter(c=>c.city?.name))
    add({type:'declare-fleet-move',to:city.id});
   const permitted=context.config.phases.find(p=>p.id===s.phaseId)?.permissions||[];
   if(['special-movement','naval-operations'].includes(s.phaseKind)&&s.actor==='soviet'&&
      permitted.includes('naval-ground-transport')&&context.buildupPolicy?.navalReplacementPolicy){
    const fleet=s.state.supportMarkers?.[context.buildupPolicy.navalReplacementPolicy.markerKey];
    if(fleet)for(const unit of Object.values(s.state.units).filter(u=>u.owner==='soviet'&&u.hex===fleet.hex&&!s.usedUnitIds.includes(u.id))){
     add({type:'declare-naval-ground-transport',unitId:unit.id,destination:{kind:'off-map'}});
     for(const hex of Object.values(context.buildupPolicy.navalReplacementPolicy.portHexes))
      if(hex!==fleet.hex)add({type:'declare-naval-ground-transport',unitId:unit.id,destination:{kind:'port',hex}});
    }
   }
  }
 }
 const penalty=['movement','special-movement'].includes(s.phaseKind)?Rules.stackPenalty(context.profile,s.state.units,s.actor).excess:0;
 return clone({phaseId:s.phaseId,phaseKind:s.phaseKind,actor:s.actor,turn:s.cursor.turn,
  commands,proposals,plans,expandedPlans,prompts,complete:false,...(penalty?{stackPenalty:penalty}:{}),
  ...(proposals.length?{combatEnumeration:{proposalsExhaustive:true,combinedPlansEnumerated:enumerateCombinedPlans,
    planSizeLimit:2,plansExhaustive:enumerateCombinedPlans&&!prompts.some(p=>p.type==='combined-battle-plans'),
    limit:limits.maxPlans,
    expandedPlanSizeLimit:3,expandedPlansExhaustive:enumerateCombinedPlans&&!prompts.some(p=>p.type==='three-battle-plans'),
    expandedPlanLimit:limits.maxThreeBattlePlans,
    note:enumerateCombinedPlans?'Two- and three-target plans are bounded and annotated for completeness':'Combined plans not enumerated for interactive human controls; any declared combination is checked by the authoritative transaction'}}:{})});
}

/* Post-roll decision proposals. The die must be supplied by a real gameplay
 * controller after the battle and air-support decisions are committed. This
 * function NEVER draws, chooses, or alters a die or a game state. Candidate
 * consequences are accepted only by replaying the authoritative transaction.
 * Post-casualty retreats use the authoritative source-face loss preparation,
 * but Fleet displacement and other historical result branches remain bounded.
 */
/**
 * Resumable, read-only source validation of post-roll choices. Each step
 * performs at most one authoritative transaction validation or one modest
 * enumerator stage. A committed die owns one cursor in the human gateway;
 * later pages resume rather than rescanning all earlier proposals.
 *
 * IMPORTANT: exhaustion is NOT a proof of rules completeness. Enumeration
 * retains the historical 4,096-validation safety budget, including Fleet
 * choices. The independent combat engine validates every actual selection.
 */
function exchangeExhaustionOrders(loss,stage,attackers){
 const order=loss.attackerLossIds;
 if(stage.outcome!=='EX'||!Array.isArray(order)||order.length!==attackers.length||
    order.length<2||order.length>12||stage.losses.length<=order.length+1)return [];
 const first=stage.losses.slice(1,1+order.length),extra=stage.losses.slice(1+order.length);
 const owed=stage.losses[0].defensePoints-first.reduce((n,l)=>n+l.attackPoints,0);
 if(owed<=0)return [];
 // Full source counters have at most two steps. The first pass identifies
 // survivors; their remaining attack points come from the reduced face or
 // from the authoritative extra-loss record if the original order killed them.
 const remaining=first.filter(l=>!l.removed).map(l=>({id:l.unitId,
  cost:extra.find(e=>e.unitId===l.unitId)?.attackPoints??stage.state.units[l.unitId]?.printedCombatStrength}));
 if(remaining.length<2||remaining.some(r=>!Number.isFinite(r.cost)||r.cost<=0)||
    remaining.reduce((n,r)=>n+r.cost,0)<=owed)return [];
 const key=ids=>JSON.stringify([...ids].sort());
 const seen=new Set([key(extra.map(e=>e.unitId))]),out=[];
 // A set is feasible iff a final casualty can bring the total across the
 // obligation; all preceding positive payments are then below that threshold.
 for(let bits=1;bits<2**remaining.length;bits++){
  const set=remaining.filter((_,i)=>bits&(2**i)),sum=set.reduce((n,r)=>n+r.cost,0);
  if(sum<owed)continue;
  const last=set.find(r=>sum-r.cost<owed);if(!last)continue;
  const k=key(set.map(r=>r.id));if(seen.has(k))continue;seen.add(k);
  const prefix=[...set.filter(r=>r!==last).map(r=>r.id),last.id];
  out.push([...prefix,...order.filter(id=>!prefix.includes(id))]);
 }
 return out;
}
function createPostRollPager({session,context,die}){
 if(!session||typeof session.snapshot!=='function'||typeof session.execute!=='function'||
    !obj(context)||!obj(context.config)||!obj(context.combatPolicy)||!obj(context.profile)||!obj(context.map))
  throw Error('Source-bound post-roll context required');
 if(!(die===null||(Number.isInteger(die)&&die>=1&&die<=6)))
  throw Error('Committed d6 (or null for automatic NE) required');
 const s=session.snapshot(),c=s.combat;
 if(s.state?.scenarioId!==context.config.scenarioId||s.phaseKind!=='combat'||
    !c||c.status!=='battle-selected'||
    (s.actor===context.combatPolicy?.airSupport?.owner&&context.enableAirSupport&&c.groundAirLocked!==true))
  throw Error('Select a committed battle and lock Air Corps use before a post-roll decision');
 const battle=c.declaration?.battles?.find(x=>x.defenderHex===c.selected);
 if(!battle)throw Error('Selected battle missing from committed declarations');
 const MAX_TRIALS=4096,MAX_CHOICES=128;
 const accepted=[],seen=new Set();
 let attempted=0,afterLossStates=0,afterLossRetreatScans=0,finished=false,budgetReached=false;
 const port=Ports.create({map:context.map,policy:context.combatPolicy,counterConfig:context.counterConfig});
 const marker=s.state.supportMarkers?.[port.markerKey];
 const candidateDestinations=marker&&s.actor!==marker.owner&&battle.defenderHex===marker.hex?
  port.forcedDestinations({state:s.state}):[];
 const attackers=battle.attackers.filter(id=>s.state.units[id]),defenders=battle.defenders.filter(id=>s.state.units[id]);
 const fleetAllowsIgnoreRetreat=port.inspect({state:s.state,battle,actor:s.actor}).ignoreRetreatEligible;
 const evaluator=Consequences.create({map:context.map,profile:context.profile,
  counterConfig:context.counterConfig,combatPolicy:context.combatPolicy,
  geography:Geography.create(context.map,context.profile,
   {cityMarkerMode:context.combatPolicy.cityMarkerMode,fortificationMode:context.combatPolicy.fortificationMode}),
  phaseConfig:context.config,enableAirSupport:context.enableAirSupport,rosterOverlay:context.rosterOverlay||null});
 const previewBase={state:s.state,battle,actor:s.actor,die,cursor:s.cursor,
  airSupportId:c.groundAirChoice??null};
 const crtOutcome=evaluator.previewPostCasualty(previewBase).outcome;
 const forced=context.combatPolicy.retreatMode==='source-forced-ezoc-v1';
 const retreatSolver=forced?Retreat.create({map:context.map,profile:context.profile,
  combatPolicy:context.combatPolicy,counterConfig:context.counterConfig}):null;
 function* offer(choices){
  if(budgetReached)return;
  const key=JSON.stringify(choices);
  if(seen.has(key))return;
  seen.add(key);
  if(attempted>=MAX_TRIALS){budgetReached=true;return;}
  attempted++;
  const action={type:'combat',action:{type:'resolve-battle',die,choices}};
  let result=null,needsFleet=false;
  try{
   const outcome=session.execute(action);
   result={action,outcome:outcome.event?.outcome||null,
    losses:outcome.event?.losses||[],retreats:outcome.event?.retreats||[],
    revealed:outcome.event?.revealed||[],advanced:outcome.event?.advanced||null};
  }catch(e){
   if(e.message==='combat-result-choice-limit-exceeded')throw e;
   needsFleet=candidateDestinations.length&&typeof choices.advanceUnitId==='string'&&
    !Object.prototype.hasOwnProperty.call(choices,'fleetDisplacement');
  }
  // Yield after every transaction, successful or not, so the browser can
  // process bounded chunks and expose a genuinely usable Cancel control.
  yield result?{item:result,fleet:false}:{trial:true};
  if(!needsFleet||budgetReached)return;
  for(const dest of candidateDestinations){
   if(attempted>=MAX_TRIALS){budgetReached=true;return;}
   attempted++;
   const action={type:'combat',action:{type:'commit-fleet-displacement',die,choices,to:dest.hex}};
   let result=null;
   try{
    const next=session.execute(action);
    result={action,to:dest.hex,port:dest.name,
     status:next.session.snapshot().combat.status,next:'roll-fleet-displacement'};
   }catch(e){if(e.message==='combat-result-choice-limit-exceeded')throw e;}
   yield result?{item:result,fleet:true}:{trial:true};
  }
 }
 function* casualtyBranch(loss,expand=true){
  if(budgetReached)return;
  let stage;
  try{stage=evaluator.previewPostCasualty({...previewBase,choices:loss});}
  catch(e){
   if(e.message==='Exchange attacker losses do not meet defender loss')return;
   throw e;
  }
  afterLossStates++;
  // Previews also consume CPU; offer a cooperative boundary before expanding
  // potentially expensive post-casualty retreat combinations.
  yield {stage:true};
  // If every attacker pays one step but the defender obligation remains,
  // the adjudicator pays additional steps in the supplied order. Enumerate
  // distinct extra-elimination sets, not factorial permutations of the same
  // result. Keep the original order first and use the existing trial budget.
  const alternatives=expand?exchangeExhaustionOrders(loss,stage,attackers):[];
  if(alternatives.length){
   const branches=[consequenceBranch(loss,stage)];
   for(const order of alternatives)branches.push(casualtyBranch({...loss,attackerLossIds:order},false));
   while(branches.length&&!budgetReached){
    for(let i=0;i<branches.length&&!budgetReached;){
     const next=branches[i].next();
     if(next.done)branches.splice(i,1);else{yield next.value;i++;}
    }
   }
   return;
  }
  yield* consequenceBranch(loss,stage);
 }
 function* consequenceBranch(loss,stage){
  yield* offer(loss);
  // Target: Leningrad §13.2: a surviving Soviet unit in the Fleet's port
  // may ignore the retreat portion of DR, DRL, or EX.  For EX and stacked
  // DRL the mandatory loss choices must be carried forward; the generic
  // {ignoreRetreat:true} probe above cannot express those outcomes.  Offer
  // this branch before the potentially large joint-retreat enumeration so
  // a valid no-retreat choice cannot be hidden behind the trial budget.
  if(stage.survivingDefenderIds.length&&['DR','DRL','EX'].includes(stage.outcome)&&
     fleetAllowsIgnoreRetreat)
   yield* offer({...loss,ignoreRetreat:true});
  for(const id of attackers){if(budgetReached)return;yield* offer({...loss,advanceUnitId:id});}
  if(!['DR','DRL','EX'].includes(stage.outcome)||!stage.survivingDefenderIds.length||!forced)return;
  const retreatReport=retreatSolver.enumerate({state:stage.state,
   defenderHex:battle.defenderHex,defenderIds:stage.survivingDefenderIds});
  afterLossRetreatScans++;
  if(!retreatReport.exhaustive)throw Error('combat-post-casualty-retreat-enumeration-incomplete');
  yield {stage:true};
  for(const combo of retreatReport.combinations){
   if(budgetReached)return;
   const paths={};for(const [id,v] of Object.entries(combo))if(v)paths[id]=v.route;
   yield* offer({...loss,retreatPaths:paths});
   for(const id of attackers){if(budgetReached)return;yield* offer({...loss,retreatPaths:paths,advanceUnitId:id});}
  }
 }
 function* enumerate(){
  yield* offer({});
  for(const id of attackers){if(budgetReached)return;yield* offer({advanceUnitId:id});yield* offer({lossUnitId:id});}
  yield* offer({ignoreRetreat:true});
  if(crtOutcome==='DR')yield* casualtyBranch({});
  if(crtOutcome==='DRL')for(const id of defenders){
   if(budgetReached)return;
   yield* casualtyBranch(defenders.length===1?{}:{defenderLossId:id});
  }
  if(crtOutcome==='EX'){
   if(attackers.length>12)throw Error('combat-exchange-subset-limit-exceeded');
   // A large EX can generate thousands of post-retreat permutations for the
   // first casualty selection alone. Under the fixed 4096-validation budget,
   // a depth-first walk can therefore hide OTHER source-legal loss choices.
   // For four-or-more attackers sharing a two-defender battle, rotate the
   // bounded generator branches. All proposals still pass the same source
   // transaction; no combat result, die, or casualty rule is changed.
   const fair=attackers.length>=4&&defenders.length===2;
   const branches=[];
   for(let bits=1;bits<2**attackers.length;bits++){
    if(budgetReached)return;
    const attackerLossIds=attackers.filter((_,i)=>bits&(2**i));
    for(const id of defenders){
     if(budgetReached)return;
     const loss={attackerLossIds,...(defenders.length===1?{}:{defenderLossId:id})};
     if(fair)branches.push(casualtyBranch(loss));
     else yield* casualtyBranch(loss);
    }
   }
   if(fair){
    // Cooperative one-step-per-branch scheduler: a branch may finish early
    // if its source-verified casualty payment is illegal. A slow retreat
    // scanner is never allowed to monopolize the global trial budget.
    while(branches.length&&!budgetReached){
     for(let i=0;i<branches.length&&!budgetReached;){
      const next=branches[i].next();
      if(next.done)branches.splice(i,1);
      else{yield next.value;i++;}
     }
    }
   }
  }
 }
 const iterator=enumerate();
 const checkPage=page=>{
  if(!Number.isSafeInteger(page)||page<0||page>255)throw Error('Invalid post-roll consequence page');
 };
 function advance(page,steps=32){
  checkPage(page);
  if(!Number.isSafeInteger(steps)||steps<1||steps>512)throw Error('Invalid post-roll work budget');
  const required=(page+1)*MAX_CHOICES+1;
  let executed=0;
  while(!finished&&accepted.length<required&&executed<steps){
   const next=iterator.next();executed++;
   if(next.done){finished=true;break;}
   if(next.value?.item)accepted.push(next.value);
  }
  return {ready:finished||accepted.length>=required,examined:attempted,
   validated:accepted.length,workSteps:executed,finished,budgetReached};
 }
 function pageResult(page){
  checkPage(page);
  const offset=page*MAX_CHOICES,required=offset+MAX_CHOICES+1;
  while(!finished&&accepted.length<required)advance(page,512);
  if(page>0&&accepted.length<=offset)throw Error('Post-roll consequence page is not available');
  const items=accepted.slice(offset,offset+MAX_CHOICES);
  const hasNextPage=accepted.length>offset+MAX_CHOICES;
  return clone({phaseId:s.phaseId,defenderHex:battle.defenderHex,die,crtOutcome,
   options:items.filter(x=>!x.fleet).map(x=>x.item),
   fleetCommitments:items.filter(x=>x.fleet).map(x=>x.item),
   attempted,afterLossStates,afterLossRetreatScans,
   choiceTruncated:hasNextPage||budgetReached,hasNextPage,choicePage:page,
   choiceOffset:offset,choiceLimit:MAX_CHOICES,exhaustive:false,
   scope:'authoritatively-validated-candidates-only',
   limitations:['Post-roll enumeration remains bounded, including casualty and joint-retreat branches',
    ...(hasNextPage?['Additional validated choices are available on the next page']:[]),
    ...(budgetReached?['Candidate validation stopped at the 4096-attempt safety budget']:[]),
    'Paging exposes further validated candidates but is not a proof that all consequences can be enumerated',
    'Fleet damage dice must be supplied after destination commitment; no RNG is generated',
    'Does not certify original counter identities or autonomous choice policy']});
 }
 return Object.freeze({advance,page:pageResult,stats:()=>({attempted,validated:accepted.length,finished,budgetReached})});
}
function discoverPostRoll({session,context,die,page=0}){
 return createPostRollPager({session,context,die}).page(page);
}
module.exports=Object.freeze({discover,discoverPostRoll,createPostRollPager});
