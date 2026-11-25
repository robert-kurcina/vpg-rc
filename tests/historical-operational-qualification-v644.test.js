'use strict';
const A=require('node:assert/strict'), fs=require('node:fs');
const R=p=>require('../'+p), C=R('core/historical_campaign_session'), Auto=R('core/historical_campaign_autoplay');
const scenario=process.argv[2]||'leningrad', variant=process.argv[3]||'standard', seed=Number(process.argv[4]||7), limit=process.argv[5]?Number(process.argv[5]):5000;
A.ok(['arduous','leningrad','kiev','kiev-odessa'].includes(scenario)); A.ok(['standard','advanced'].includes(variant));
function contextFor(name){
 if(name==='kiev-odessa')return {...structuredClone(R('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart),map:R('maps/kiev-odessa-composite-experimental-v531.json'),profile:R('maps/movement-configs/kiev-odessa-experimental-v531.json'),config:R('maps/phase-configs/kiev-odessa.json'),counterConfig:R('maps/counter-configs/kiev-odessa-experimental-v531.json'),combatPolicy:R('maps/combat-configs/kiev-odessa-experimental-v531.json'),rosterOverlay:R('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,buildupPolicy:R('maps/buildup-configs/kiev-odessa-experimental-v533.json'),buildupAllocation:R('games/kiev-odessa/experimental-preview/allocation-v533.json'),housekeepingPolicy:R('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
 const map=R(`maps/${name}.json`),profile=R(`maps/movement-configs/${name}.json`),config=R(`maps/phase-configs/${name}.json`),counterConfig=R(`maps/counter-configs/${name}.json`),combatPolicy=R(`maps/combat-configs/${name}.json`),setupSpec=R(`maps/setup/${name}.json`);
 const base={map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:R(`maps/buildup-configs/${name}.json`),housekeepingPolicy:R(`maps/housekeeping-configs/${name}.json`)};
 const dep={map,setupSpec,counterConfig,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})}};
 if(name==='leningrad'){const f=require('./fixtures/leningrad-source-setup-v357');const opening=R('core/scenario_opening_bridge').create({...dep,inventory:R('core/leningrad_starting_inventory'),allocation:f.selected,placements:f.placements,supportPolicy:combatPolicy}).snapshot();return {...opening,...base,buildupAllocation:f.selected};}
 if(name==='arduous'){const f=require('./fixtures/arduous-source-setup-v419'),fixedPolicy=R('maps/setup/arduous-fixed-pieces.json');const d=R('core/historical_deployment_session').create({...dep,fixedPolicy,inventory:R('core/historical_source_face_inventory').create(R('maps/setup/arduous-inventory.json')),allocation:f.allocation,placements:f.placements}).commit({requireMixed:false});return {...d.opening,...base,fixedPolicy,buildupAllocation:d.allocation};}
 const f=require('./fixtures/kiev-source-opening-v437'),d=R('core/historical_deployment_session').create({...dep,inventory:f.inventory,allocation:f.allocation,placements:f.placements}).commit();return {...d.opening,...base,buildupAllocation:d.allocation};
}
const context=R('core/graduated_mode').withHistorical(contextFor(scenario),process.env.VICTORY_MODE||'historical');context.combatPolicy={...context.combatPolicy,crtVariant:variant};
const policy={seed,missionSeed:seed.toString(16).padStart(32,'0'),selectionMode:'seeded',phaseScope:'operational',maxActions:limit,maxFleetMoves:2,maxFleetAttacks:3,fleetBudgetScope:process.argv[6]||"campaign",objectivePolicy:process.argv[7]||"baseline",movementLookahead:process.argv[8]==="lookahead"};
if(process.argv[8]!==undefined)A.ok(["greedy","lookahead"].includes(process.argv[8]));
const matchup=process.argv[9]||'same';
A.ok(['same','experimental-axis','experimental-soviet','relief-axis','joint-axis'].includes(matchup));
const strategyFor=actor=>matchup==='same'?policy:matchup==='relief-axis'||matchup==='joint-axis'?{...policy,objectivePolicy:actor==='german'&&matchup==='relief-axis'?'reserve-relief':'baseline',coordinatedAttacks:actor==='german'&&matchup==='joint-axis',movementLookahead:false}:{...policy,objectivePolicy:(actor==='german')===(matchup==='experimental-axis')?'reserve-relief':'baseline',movementLookahead:false};
const Difficulty=R('core/ai_difficulty');
const grades={german:Difficulty.validate(Number(process.argv[10]??0)),soviet:Difficulty.validate(Number(process.argv[11]??0))};
const policyFor=actor=>({...strategyFor(actor),...(grades[actor]?{difficulty:grades[actor]}:{})});
const start=C.create(context), original=start.save();console.error("opening",scenario,variant,start.snapshot().phaseId);
const buildup=R('core/historical_buildup_phase').create({map:context.map,profile:context.profile,config:context.config,counterConfig:context.counterConfig,policy:context.buildupPolicy,allocation:context.buildupAllocation,fixedPolicy:context.fixedPolicy||null,combatPolicy:context.combatPolicy});
function checkCommunication(snapshot){let checks=0;const units=snapshot.state.units;
 for(const owner of context.config.players){const index=buildup.communicationIndex(owner,units);const cells=[...new Set([...Object.values(units).map(u=>u.hex),...context.buildupPolicy.entryEdge[owner],...context.map.cells.filter(c=>c.city?.name).map(c=>c.id)])];
 for(const hex of cells){A.equal(index(hex),buildup.communicated(hex,owner,units),`${scenario} ${owner} ${hex} communication parity`);checks++;}}
 return checks;
}
const communicationChecks=checkCommunication(start.snapshot());A.deepEqual(Auto.decide({session:start,context,policy}),Auto.decide({session:start,context,policy}));A.deepEqual(start.save(),original);
// Optional headless-only checkpoint. Save the source-bound journal and the
// reporting trace together; never change the original decision budget on resume.
const checkpointPath=process.env.CHECKPOINT_PATH;
const identity=JSON.stringify({scenario,variant,policy,matchup,grades,victoryMode:process.env.VICTORY_MODE||'historical'});
const zero={moves:0,combats:0,reinforcements:0,navalRolls:0,turns:0};
let current=start, priorTrace=[],priorStats=zero,priorElapsed=0;
if(checkpointPath&&fs.existsSync(checkpointPath)){
 const cp=JSON.parse(fs.readFileSync(checkpointPath,'utf8'));
 A.equal(cp.identity,identity,'Checkpoint job mismatch');
 current=C.restore(cp.save,context);priorTrace=cp.trace;priorStats=cp.stats;priorElapsed=cp.elapsedMs;
 A.equal(priorTrace.length,current.journal().length);
 A.deepEqual(priorTrace.map(t=>t.action),current.journal().map(t=>t.action));
}
let turn=current.snapshot().cursor.turn;const reasons={},started=Date.now();
const trace=[...priorTrace];
const combined=stats=>Object.fromEntries(Object.keys(zero).map(k=>[k,priorStats[k]+stats[k]]));
const run=Auto.run({session:current,context,policy,policyForActor:policyFor,onStep:({session,decision,event,stats})=>{
 const t=session.snapshot().cursor.turn;trace.push({turn:t,reason:decision.reason,action:decision.action,event:event||null});
 const boundary=t!==turn||session.snapshot().cursor.complete;
 if(boundary){turn=t;console.error(scenario,variant,'turn',t,JSON.stringify(combined(stats)));}
 if(checkpointPath&&(boundary||trace.length%10===0)){const cp={identity,save:session.save(),trace,stats:combined(stats),elapsedMs:priorElapsed+Date.now()-started};fs.writeFileSync(checkpointPath+'.tmp',JSON.stringify(cp)+'\n');fs.renameSync(checkpointPath+'.tmp',checkpointPath);}
}});
if(run.reason==='controller-action-budget'){delete run.decision;delete run.detail;}
run.trace=trace;run.stats=combined(run.stats);for(const t of trace)reasons[t.reason]=(reasons[t.reason]||0)+1;
const final=run.session.snapshot(), odds={},outcomes={},fleetByTurn={};for(const t of run.trace){const type=t.action.action?.type||t.action.type;if(["declare-fleet-move","declare-fleet-attack","roll-fleet-attack","roll-fleet-move"].includes(type)){const bucket=fleetByTurn[t.turn]||={};bucket[type]=(bucket[type]||0)+1;}}for(const t of run.trace.filter(t=>t.action.action?.type==='resolve-battle')){const o=t.event?.die===null?'automatic NE':t.event?.outcome||'unknown';outcomes[o]=(outcomes[o]||0)+1;const k=t.event?.die===null?'below-minimum':String(t.event?.odds??'unknown');odds[k]=(odds[k]||0)+1;}
A.deepEqual(C.restore(run.session.save(),context).snapshot(),final);
const report={scenario,variant,...(process.env.VICTORY_MODE==='graduated'?{victoryMode:'graduated'}:{}),seed,policy,matchup,factionPolicies:Object.fromEntries(context.config.players.map(actor=>[actor,Auto.policyOf(policyFor(actor))])),elapsedMs:priorElapsed+Date.now()-started,status:run.status,reason:run.reason,detail:run.detail,decision:run.decision,stats:run.stats,actions:run.trace.length,fleetByTurn,odds,outcomes,reasons,cityControl:final.state.cityControl,terminal:final.terminal,phase:final.phaseId,exactRestore:true,communicationChecks:communicationChecks+checkCommunication(final)};
if(limit===5000){A.equal(run.status,'complete');A.equal(final.cursor.complete,true);}else {A.ok(run.status==='complete'||run.reason==='controller-action-budget');if(run.status!=='complete')A.equal(run.trace.length,limit);}

console.log(JSON.stringify(report));if(process.env.JOURNAL_PATH)fs.writeFileSync(process.env.JOURNAL_PATH,JSON.stringify(run.session.journal())+'\n');
if(process.env.AUDIT_PATH)fs.writeFileSync(process.env.AUDIT_PATH,JSON.stringify(report,null,2)+'\n');
