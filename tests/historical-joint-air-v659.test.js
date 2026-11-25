'use strict';
// Real divergence from the two complete v659 ablation campaigns. Replay only
// the common prefix; neither future dice nor terminal results enter selection.
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay'),C=require('../core/historical_campaign_session'),Catalog=require('../core/historical_campaign_action_catalog');
const map=require('../maps/leningrad.json'),profile=require('../maps/movement-configs/leningrad.json'),config=require('../maps/phase-configs/leningrad.json'),counterConfig=require('../maps/counter-configs/leningrad.json'),combatPolicy=require('../maps/combat-configs/leningrad.json'),setupSpec=require('../maps/setup/leningrad.json');
const f=require('./fixtures/leningrad-source-setup-v357'),w=require('./fixtures/leningrad-turn4-air-allocation-v659.json');
const opening=require('../core/scenario_opening_bridge').create({map,setupSpec,counterConfig,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},inventory:require('../core/leningrad_starting_inventory'),allocation:f.selected,placements:f.placements,supportPolicy:combatPolicy}).snapshot();
const context={...opening,map,profile,config,counterConfig,combatPolicy:{...combatPolicy,crtVariant:w.crt},enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/leningrad.json'),buildupAllocation:f.selected,housekeepingPolicy:require('../maps/housekeeping-configs/leningrad.json')};
const p={phaseScope:'operational',seed:w.seed,missionSeed:w.seed.toString(16).padStart(32,'0'),selectionMode:'seeded',maxFleetMoves:2,maxFleetAttacks:3};
let n=0;const eq=(a,b)=>{A.deepEqual(a,b);n++;},ok=(a,m)=>{A.ok(a,m);n++;};
let session=C.create(context);for(const record of w.prefix)session=session.execute(record.action).session;
eq(session.journal(),w.prefix);const before=session.save(),s=session.snapshot();eq(s.cursor.turn,4);eq(s.actor,'german');eq(s.actionCount,167);
eq(Auto.decide({session,context,policy:p}).action,w.greedyDeclaration);
eq(Auto.decide({session,context,policy:{...p,objectivePolicy:'reserve-relief',coordinatedAttacks:false}}).action,w.greedyDeclaration);
const opts=Catalog.discover({session,context,enumerateCombinedPlans:false});
const evaluation=Auto.rankContinuations({snapshot:s,context,proposals:opts.proposals,includeFallback:true,nonCityAdvance:true,supportPlanning:true});
const validate=battles=>session.canExecute({type:'combat',action:{type:'commit-battles',battles}});
const chosen=Auto.selectCoordinatedPlan({evaluated:evaluation.ranked,limit:100,validate});eq(chosen,w.previousCoordinatedDeclaration.action.battles);
const args={session,snapshot:s,context,chosen,evaluated:evaluation.ranked};
const repaired=Auto.strengthenSupportedPlan(args);eq(repaired[0].defenderHex,'0311');eq(repaired[0].attackers.length,3);eq(repaired[0].attackers,w.greedyDeclaration.action.battles.find(b=>b.defenderHex==='0311').attackers);eq(repaired.slice(1),chosen.slice(1));ok(validate(repaired));eq(new Set(repaired.flatMap(b=>b.attackers)).size,repaired.flatMap(b=>b.attackers).length);
eq(Auto.strengthenSupportedPlan({...args,maxCandidates:0}),chosen);
const spare=repaired[0].attackers.find(id=>!chosen[0].attackers.includes(id));
const occupied=[chosen[0],{defenderHex:'unused',attackers:[spare]}];eq(Auto.strengthenSupportedPlan({...args,chosen:occupied}),occupied);
const policy={...p,coordinatedAttacks:true},d=Auto.decide({session,context,policy});eq(d.action.action.battles,repaired);eq(Auto.decide({session,context,policy}),d);eq(session.save(),before);
let next=session.execute(d.action).session;let select=Auto.decide({session:next,context,policy});eq(select.action.action.defenderHex,'0311');next=next.execute(select.action).session;
const air=Auto.decide({session:next,context,policy});eq(air.action.action.faceId,'leningrad-front-r04c05');next=next.execute(air.action).session;
const battle=next.snapshot().combat.declaration.battles.find(b=>b.defenderHex==='0311');
const evaluator=require('../core/historical_combat_consequences').create({...context,phaseConfig:config,geography:require('../core/historical_combat_geography').create(map,profile,{cityMarkerMode:combatPolicy.cityMarkerMode,fortificationMode:combatPolicy.fortificationMode})});
const snap=next.snapshot(),odds=evaluator.previewKnownOdds({state:snap.combat.state,battle,actor:snap.actor,cursor:snap.cursor,airSupportId:air.action.action.faceId});eq(odds.finalOdds,3);
// The projection and air commitment consume no die. Restoring reconstructs
// the same choice without storing an advisory search plan.
eq(next.journal().slice(w.prefix.length).map(x=>x.action.action.type),['commit-battles','select-battle','commit-ground-air']);eq(C.restore(next.save(),context).snapshot(),next.snapshot());eq(Auto.decide({session:C.restore(before,context),context,policy}),d);
console.log('PASS source Turn 4 joint air allocation',n,'assertions');
