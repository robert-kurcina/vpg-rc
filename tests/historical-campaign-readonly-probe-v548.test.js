#!/usr/bin/env node
'use strict';
/* Prove optimized legal-action discovery invokes the exact same authoritative
 * transaction as execute(), but cannot mutate a journal or skip save hashing
 * for a committed action. Sample all required phase families in two games. */
const assert=require('node:assert/strict');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const req=f=>require('../'+f);
const clone=x=>JSON.parse(JSON.stringify(x));
let checks=0;const same=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);checks++};
const yes=(v,msg)=>{assert.ok(v,msg);checks++};
const L={map:req('maps/leningrad.json'),counterConfig:req('maps/counter-configs/leningrad.json'),
 setup:req('maps/setup/leningrad.json'),profile:req('maps/movement-configs/leningrad.json'),
 config:req('maps/phase-configs/leningrad.json'),combatPolicy:req('maps/combat-configs/leningrad.json'),
 buildupPolicy:req('maps/buildup-configs/leningrad.json'),housekeepingPolicy:req('maps/housekeeping-configs/leningrad.json')};
const opening=Bridge.create({map:L.map,setupSpec:L.setup,counterConfig:L.counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:L.config,
 movementProfile:L.profile,phaseFactories:{combat:()=>({})},supportPolicy:L.combatPolicy}).snapshot();
const leningrad={...clone(opening),map:L.map,profile:L.profile,config:L.config,counterConfig:L.counterConfig,
 combatPolicy:L.combatPolicy,enableAirSupport:true,buildupPolicy:L.buildupPolicy,
 buildupAllocation:Fixture.selected,housekeepingPolicy:L.housekeepingPolicy};
const odessa={...clone(req('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart),
 map:req('maps/kiev-odessa-composite-experimental-v531.json'),
 profile:req('maps/movement-configs/kiev-odessa-experimental-v531.json'),
 config:req('maps/phase-configs/kiev-odessa.json'),
 counterConfig:req('maps/counter-configs/kiev-odessa-experimental-v531.json'),
 combatPolicy:req('maps/combat-configs/kiev-odessa-experimental-v531.json'),
 rosterOverlay:req('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,
 buildupPolicy:req('maps/buildup-configs/kiev-odessa-experimental-v533.json'),
 buildupAllocation:req('games/kiev-odessa/experimental-preview/allocation-v533.json'),
 housekeepingPolicy:req('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
function prove(session,label){
 const before=session.save(),snapshot=session.snapshot();
 yes(typeof session.canExecute==='function','Public read-only validation exposed '+label);
 const catalog=Catalog.discover({session,context:label.startsWith('Leningrad')?leningrad:odessa,enumerateCombinedPlans:false});
 const valid=[...catalog.commands.slice(0,12),...catalog.commands.slice(-12)];
 const invalid=[null,undefined,{},[],{type:'finish-housekeeping'},
  {type:'finish-phase'}, {type:'declare-ground-move',request:{unitId:'nonexistent',path:['0000','0001']}},
  {type:'apply-replacement',unitId:'nonexistent',hex:'0404'},
  {type:'place-reinforcement',slotId:'nonexistent',hex:'0000'},
  {type:'combat',action:{type:'resolve-battle',die:7,choices:{}}},
  {type:'combat',action:{type:'finish-air-sea'}},
  {type:'place-evacuated-reinforcement',unitId:'bad',hex:'0000'}];
 const sampled=[...valid,...invalid];
 // v649: independently compare every ground candidate to the unbatched
 // authoritative probe, not merely candidates accepted by the batch itself.
 const unbatched=Catalog.discover({session:{snapshot:session.snapshot,execute:session.execute,canExecute:session.canExecute},context:label.startsWith('Leningrad')?leningrad:odessa,enumerateCombinedPlans:false});
 same(catalog,unbatched,'Batched and individual discovery preserve ordering and legal action set '+label);
 const ground=unbatched.commands.filter(a=>a.type==='declare-ground-move');
 const mixed=[...ground,...invalid,...ground.slice(0,3)];
 const groundExpected=a=>a?.type==='declare-ground-move'&&session.canExecute(a);
 same(session.canExecuteGroundBatch(mixed),mixed.map(groundExpected),'Mixed batch parity '+label);
 same(session.canExecuteGroundBatch([]),[],'Empty batch '+label);
 if(ground.length){
  const pending=session.execute(ground[0]).session;
  same(pending.canExecuteGroundBatch(ground),ground.map(a=>pending.canExecute(a)),'Pending state invalidates movement availability '+label);
  same(session.canExecuteGroundBatch(ground),ground.map(a=>session.canExecute(a)),'Old immutable session remains valid '+label);
  const resolve={type:'resolve-ground-move'};
  if(pending.canExecute(resolve)){
   const moved=pending.execute(resolve).session;
   same(moved.canExecuteGroundBatch(ground),ground.map(a=>moved.canExecute(a)),'Committed movement and used-unit invalidation '+label);
   const undone=moved.undo().session;
   same(undone.canExecuteGroundBatch(ground),ground.map(a=>undone.canExecute(a)),'Undo state parity '+label);
  }
 }
 for(const a of sampled){
  let expected=true;
  try{session.execute(a);}catch(_){expected=false}
  same(session.canExecute(a),expected,'Probe equals authoritative transaction for '+label+': '+JSON.stringify(a));
 }
 same(session.save(),before,'Probes/catalog leave journal and final-state hash identical '+label);
 same(session.snapshot(),snapshot,'Probes/catalog cannot mutate campaign state '+label);
 const target=catalog.commands[0];
 if(target){
  const next=session.execute(target).session;
  yes(next.snapshot().actionCount===snapshot.actionCount+1,'Committed transaction still writes journal '+label);
  yes(next.save().campaign===undefined,'Campaign save format preserved '+label);
  same(Campaign.restore(next.save(),label.startsWith('Leningrad')?leningrad:odessa).snapshot(),next.snapshot(),
   'Recorded SHA-256 journal replay remains authentic '+label);
 }
 return catalog;
}
for(const [name,context] of [['Leningrad',leningrad],['Odessa',odessa]]){
 let session=Campaign.create(context);let catalog=prove(session,name+' opening');
 const finishAir=catalog.commands.find(a=>a?.action?.type==='finish-air-sea');
 if(finishAir){session=session.execute(finishAir).session;catalog=prove(session,name+' combat declaration');}
 const decline={type:'combat',action:{type:'commit-battles',battles:[]}};
 if(catalog.commands.some(a=>JSON.stringify(a)===JSON.stringify(decline))){
  session=session.execute(decline).session;
  const afterDecline=Catalog.discover({session,context,enumerateCombinedPlans:false});
  const finishCombat=afterDecline.commands.find(a=>a.action?.type==='finish-combat');
  if(finishCombat){session=session.execute(finishCombat).session;prove(session,name+' movement');}
 }
}
console.log('PASS v548 authoritative read-only transaction probe:',checks,'assertions in two scenario contexts');
