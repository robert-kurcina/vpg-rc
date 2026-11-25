'use strict';
// Original Leningrad source faces; constructed Turn 3 battle, not a
// historical deployment or a change to the authoritative loss adjudicator.
const assert=require('node:assert/strict');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Bridge=require('../core/scenario_opening_bridge');
const Inventory=require('../core/leningrad_starting_inventory');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const Consequences=require('../core/historical_combat_consequences');
const Geography=require('../core/historical_combat_geography');
const map=require('../maps/leningrad.json'),counterConfig=require('../maps/counter-configs/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json'),config=require('../maps/phase-configs/leningrad.json');
const combatPolicy=require('../maps/combat-configs/leningrad.json'),buildupPolicy=require('../maps/buildup-configs/leningrad.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/leningrad.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const ok=(a,m)=>{assert.ok(a,m);checks++;};
const opening=Bridge.create({map,setupSpec:require('../maps/setup/leningrad.json'),counterConfig,inventory:Inventory,
 allocation:Fixture.selected,placements:Fixture.placements,phaseConfig:config,movementProfile:profile,
 phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy}).snapshot();
const context={...opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy,
 buildupAllocation:Fixture.selected,housekeepingPolicy};
const initialized=Campaign.create(context).snapshot().state;
const at=(index,state)=>({...context,state,actor:config.phases[index].owner,cursor:{scenarioId:'leningrad',turn:3,index,complete:false}});
const wmm=Fixture.selected.sovietTurn3WorkersMilitia[0],army=Fixture.selected.sovietFrontArmies[0],tank=Fixture.selected.germanInitialPanzer[0];
const slot=buildupPolicy.reinforcements.find(x=>x.turn===3);
const reinforcement=Campaign.create(at(4,initialized)).execute({type:'place-reinforcement',slotId:slot.slotId,hex:'1701'}).session.snapshot().state;
const board=clone(reinforcement);
board.units=Object.fromEntries([army,wmm,tank].map(id=>[id,board.units[id]]));
board.units[tank].strengthStatus='printed-reduced';board.units[tank].printedCombatStrength=6;
board.units[tank].activeFaceId=board.units[tank].reverseFaceId;
// Locate a source-certified open battle where 10 attack versus 6 defense
// produces 1:1 Standard odds, rather than assuming an arbitrary terrain shift.
const graph=require('../core/movement_binding').build(map,profile).board;
const evaluator=Consequences.create({map,profile,counterConfig,combatPolicy,
 geography:Geography.create(map,profile,{cityMarkerMode:combatPolicy.cityMarkerMode}),phaseConfig:config,enableAirSupport:true});
let selected=null,ctx,base;
for(const cell of map.cells){
 if(cell.terrain!=='open'||cell.city)continue;
 const near=graph.edges.filter(e=>e.verified&&!e.impassable&&!e.lake&&!e.allSea&&(e.a===cell.id||e.b===cell.id)).map(e=>e.a===cell.id?e.b:e.a);
 if(near.length<2)continue;
 board.units[tank].hex=cell.id;board.units[army].hex=near[0];board.units[wmm].hex=near[1];
 try{
  ctx=at(6,clone(board));
  let session=Campaign.create(ctx);
  if(session.snapshot().combat.status==='air-sea-open')session=session.execute({type:'combat',action:{type:'finish-air-sea'}}).session;
  session=session.execute({type:'combat',action:{type:'commit-battles',battles:[{defenderHex:cell.id,attackers:[army,wmm]}]}}).session;
  session=session.execute({type:'combat',action:{type:'select-battle',defenderHex:cell.id}}).session;
  const s=session.snapshot();
  const input={state:s.state,battle:s.combat.declaration.battles[0],actor:s.actor,die:2,cursor:s.cursor,airSupportId:null};
  if(evaluator.previewPostCasualty(input).outcome!=='EX')continue;
  selected=session;base=input;break;
 }catch(e){if(process.env.DEBUG_EX)console.log(cell.id,e.message);}
}
ok(selected,'Constructed legal source-face EX battle');
const before=selected.snapshot(),saved=selected.save();
const alternatives=[[army,wmm],[wmm,army]].map(order=>{
 const loss={attackerLossIds:order};
 const stage=evaluator.previewPostCasualty({...base,choices:loss});
 eq(stage.losses.slice(0,3).map(x=>x.attackPoints),order[0]===army?[6,4,1]:[6,1,4]);
 eq(stage.losses.length,4,'Additional loss required after first steps');
 eq(stage.losses[3].unitId,order[0],'The owner chooses which survivor pays the extra step');
 eq(stage.state.units[order[0]],undefined);
 ok(stage.state.units[order[1]],'Other reduced attacker survives');
 return {loss,stage};
});
const report=Catalog.discoverPostRoll({session:selected,context:ctx,die:2});
eq(report.crtOutcome,'EX');
for(const {loss,stage} of alternatives){
 const option=report.options.find(o=>JSON.stringify(o.action.action.choices.attackerLossIds)===JSON.stringify(loss.attackerLossIds)&&!o.action.action.choices.advanceUnitId);
 ok(option,'Both distinct extra-loss choices are exposed by the shared catalogue');
 const actual=selected.execute(option.action);
 eq(actual.event.losses,stage.losses);
 eq(actual.event.outcome,'EX');
 eq(actual.session.undo().session.snapshot(),before);
 eq(Campaign.restore(actual.session.save(),ctx).snapshot(),actual.session.snapshot());
}
eq(selected.snapshot(),before);eq(selected.save(),saved);
console.log('PASS',checks,'assertions; two distinct exhaustion outcomes exposed; target',base.battle.defenderHex);
