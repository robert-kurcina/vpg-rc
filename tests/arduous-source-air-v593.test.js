'use strict';
// Printed §§10.4–10.5. Original faces and shipped map, synthetic combat positions.
const A=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const Deployment=require('../core/historical_deployment_session');
const Inventory=require('../core/historical_source_face_inventory');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Consequences=require('../core/historical_combat_consequences');
const Geography=require('../core/historical_combat_geography');
const Retreat=require('../core/historical_forced_retreat');
const Binding=require('../core/movement_binding');
const fixture=require('./fixtures/arduous-source-setup-v419');
const map=require('../maps/arduous.json');
const setupSpec=require('../maps/setup/arduous.json');
const counterConfig=require('../maps/counter-configs/arduous.json');
const config=require('../maps/phase-configs/arduous.json');
const profile=require('../maps/movement-configs/arduous.json');
const fixedPolicy=require('../maps/setup/arduous-fixed-pieces.json');
const combatPolicy=require('../maps/combat-configs/arduous.json');
const buildupPolicy=require('../maps/buildup-configs/arduous.json');
const housekeepingPolicy=require('../maps/housekeeping-configs/arduous.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let assertions=0;
const check=(cond,why)=>{A.ok(cond,why);assertions++};
const equal=(actual,expected,why)=>{A.deepStrictEqual(actual,expected,why);assertions++};
const fail=(fn,re,why)=>{A.throws(fn,re,why);assertions++};
const deployment=Deployment.create({map,setupSpec,counterConfig,
 inventory:Inventory.create(require('../maps/setup/arduous-inventory.json')),
 phaseConfig:config,movementProfile:profile,fixedPolicy,
 allocation:fixture.allocation,placements:fixture.placements}).commit({requireMixed:false});
const Air=require('../core/historical_air_support');
const Odds=require('../core/historical_combat_odds');
const units=Object.values(deployment.opening.state.units);
const attackers=units.filter(u=>u.owner==='german'&&u.printedCombatStrength===12).slice(0,2);
const armies=units.filter(u=>u.owner==='soviet'&&u.size==='army'&&u.printedCombatStrength===8).slice(0,2);
check(attackers.length===2&&armies.length===2,'Original source units');
const board=Binding.build(map,profile).board;
const edges=board.edges.filter(e=>e.verified&&!e.impassable&&!e.allSea&&!e.lake&&!e.river&&!e.majorRiver&&board.cells[e.b].terrain==='open'&&!map.cells.find(c=>c.id===e.b).city);
const e1=edges[0],e2=edges.find(e=>![e1.a,e1.b].includes(e.a)&&![e1.a,e1.b].includes(e.b));
check(e1&&e2,'Distinct dry open battle hexsides');
const selected={};
for(const [i,e] of [e1,e2].entries()){
 const a=attackers[i],d=armies[i];
 equal(counterConfig.faces.back.find(f=>f.faceId===d.reverseFaceId).visualTranscription.printedValues,'4-4');
 selected[a.id]={...clone(a),hex:e.a};
 selected[d.id]={...clone(d),hex:e.b,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:d.reverseFaceId};
}
const context={...deployment.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy,buildupAllocation:deployment.allocation,housekeepingPolicy,fixedPolicy,state:{...clone(deployment.opening.state),units:selected}};
let session=Campaign.create(context);
const initial=session.snapshot();
const air=Air.create({map,combatPolicy,counterConfig,phaseConfig:config});
const marks=air.available({state:initial.state,cursor:initial.cursor,actor:'german'});
equal(marks.map(x=>x.shiftRating),[2,1]);
equal(initial.combat.status,'awaiting-declarations');
check(!Catalog.discover({session,context,enumerateCombinedPlans:false}).commands.some(x=>x.action?.type==='finish-air-sea'));
fail(()=>session.execute({type:'combat',action:{type:'finish-air-sea'}}),/Air-sea phase not open/);
fail(()=>air.attackFleet({state:initial.state,cursor:initial.cursor,actor:'german',faceId:marks[0].faceId,die:1}),/Naval air attacks not available/);
const act=action=>{const result=session.execute({type:'combat',action});session=result.session;return result;};
act({type:'commit-battles',battles:[e1,e2].map((e,i)=>({defenderHex:e.b,attackers:[attackers[i].id]}))});
for(const [i,e] of [e1,e2].entries()){
 act({type:'select-battle',defenderHex:e.b});
 const options=Catalog.discover({session,context}).commands.filter(x=>x.action?.type==='commit-ground-air').map(x=>x.action.faceId);
 equal(options,[null,...marks.slice(i).map(m=>m.faceId)]);
 if(i)fail(()=>act({type:'commit-ground-air',faceId:marks[0].faceId}),/unavailable/);
 act({type:'commit-ground-air',faceId:marks[i].faceId});
 const before=session.snapshot();
 const result=act({type:'resolve-battle',die:6,choices:{}});
 equal(result.event.odds,5-i);equal(result.event.outcome,'DE');equal(result.event.airSupport.shiftRating,2-i);
 equal(session.snapshot().state.units[armies[i].id],undefined);
 equal(session.snapshot().state.airUse['1'][marks[i].faceId],'ground');
 equal(session.undo().session.snapshot(),before);
 equal(Campaign.restore(session.save(),context).snapshot(),session.snapshot());
}
equal(session.snapshot().combat.status,'battles-resolved');
equal(air.available({state:session.snapshot().state,cursor:{...initial.cursor,turn:2},actor:'german'}).map(x=>x.faceId),marks.map(x=>x.faceId));
const swamp=Odds.evaluate({attackers:[{kind:'panzer',value:3},{kind:'mechanized',value:3},{kind:'infantry',value:3}],defenders:[{kind:'infantry',value:2}],defenderTerrain:'swamp',allAttackersAcrossRiver:true,airSupportShift:2,policy:combatPolicy,die:6});
equal(swamp.attackStrength,6);equal(swamp.finalOdds,3);
console.log('PASS Arduous source ground air',assertions,'assertions');
