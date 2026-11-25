'use strict';
/* Synthetic phase-permission harness: tests generic campaign transaction plumbing.
 * Does NOT assert Leningrad has Odessa's §15.3 special rules. */
const assert=require('node:assert/strict');
const Campaign=require('../core/historical_campaign_session');
const Catalog=require('../core/historical_campaign_action_catalog');
const Bridge=require('../core/scenario_opening_bridge');
const Build=require('../core/historical_buildup_phase');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const U=require('../core/leningrad_starting_inventory');
const Policy=require('../maps/buildup-configs/leningrad.json');
const fx=require('./fixtures/leningrad-source-setup-v357');
const copy=v=>structuredClone(v);let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const ok=(a,msg)=>{assert.ok(a,msg);checks++};
const bad=(fn,rx)=>{assert.throws(fn,rx);checks++};
const ports=Object.fromEntries(Q.portSupport.portNames.map(name=>[name,M.cells.find(c=>c.tileMarkers?.some(m=>m.label===name))?.id]));
const config=copy(F);config.phases.find(p=>p.id==='soviet-special-movement').permissions.push('naval-ground-transport');
const combatPolicy=copy(Q);combatPolicy.portSupport.portHexes=ports;
const policy=copy(Policy);policy.navalReplacementPolicy={schemaVersion:1,scenarioId:'leningrad',mode:'source-fleet-port-logistics-v1',owner:'soviet',markerKey:'balticFleet',portHexes:ports,replacementException:true,damageDie:1,evacuatedEarliestReturnTurnOffset:1,turns:8};
const original=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:U,allocation:fx.selected,placements:fx.placements,phaseConfig:F,movementProfile:P,phaseFactories:{combat:()=>({})},supportPolicy:Q}).snapshot();
const built=Build.create({map:M,profile:P,config,counterConfig:K,policy,allocation:fx.selected,combatPolicy});
const initial=built.initialize(original.state);
const unitId=fx.selected.sovietFrontArmies[0];
initial.units[unitId].hex='1701'; // explicitly synthetic setup for transaction qualification
const ctx=(state,cursor)=>({map:M,profile:P,config,counterConfig:K,combatPolicy,enableAirSupport:true,buildupPolicy:policy,buildupAllocation:fx.selected,actor:'soviet',state:copy(state),cursor:copy(cursor)});
const origin=ctx(initial,{scenarioId:'leningrad',turn:4,index:5,complete:false});
let c=Campaign.create(origin);
const declaration={type:'declare-naval-ground-transport',unitId,destination:{kind:'off-map'}};
bad(()=>c.execute({type:'roll-naval-ground-transport',die:6}),/committed/);
c=c.execute(declaration).session;
eq(c.snapshot().pendingNavalGround,{unitId,destination:{kind:'off-map'}});
ok(c.snapshot().state.units[unitId],'declaration does not move ground unit');
bad(()=>c.execute({type:'finish-phase'}),/Unresolved/);
bad(()=>c.execute({type:'declare-naval-ground-transport',unitId,destination:{kind:'off-map'}}),/pending/);
const pendingSave=c.save();eq(Campaign.restore(pendingSave,origin).snapshot(),c.snapshot(),'declaration restore');
let evacuated=c.execute({type:'roll-naval-ground-transport',die:1}).session;
eq(evacuated.snapshot().state.units[unitId],undefined,'evacuee leaves the map');
eq(evacuated.snapshot().state.evacuatedNavalUnits[unitId].unit.strengthStatus,'printed-reduced','d6=1 reduces face');
eq(evacuated.snapshot().state.evacuatedNavalUnits[unitId].firstReturnTurn,5,'next-turn eligibility');
eq(Campaign.restore(evacuated.save(),origin).snapshot(),evacuated.snapshot(),'replay of both committed actions');
eq(evacuated.undo().session.snapshot(),c.snapshot(),'Undo restores destination declaration');
eq(c.undo().session.snapshot(),Campaign.create(origin).snapshot(),'Undo declaration');
bad(()=>evacuated.execute(declaration),/pending action|Ground unit must share/);
// Buildup/admission test uses an isolated trusted turn-5 state; no unapproved
// source timing decision or full Odessa campaign is implied.
const returnCtx=ctx(evacuated.snapshot().state,{scenarioId:'leningrad',turn:5,index:4,complete:false});
let returned=Campaign.create(returnCtx);
const legal=Catalog.discover({session:returned,context:returnCtx,enumerateCombinedPlans:false});
const candidates=legal.commands.filter(x=>x.type==='place-evacuated-reinforcement'&&x.unitId===unitId);
ok(candidates.length>0,'normal source edge admits evacuee');
const entry=candidates[0];
// Surviving evacuees are neither eliminated units nor replacement reserves.
ok(!legal.commands.some(x=>x.type==='apply-replacement'&&x.unitId===unitId),'catalogue excludes evacuated survivor from rebuilds');
for(const turn of [4,5,6,7,8]){
 const cursor={scenarioId:'leningrad',turn,index:4,complete:false};
 const state=evacuated.snapshot().state, before=copy(state);
 bad(()=>built.replace({state,cursor,actor:'soviet',phase:built.openingPhase(),unitId,hex:entry.hex}),/must return as a regular reinforcement/);
 eq(state,before,'rejected rebuild leaves evacuation reserve intact');
}
bad(()=>returned.execute({type:'apply-replacement',unitId,hex:entry.hex}),/must return as a regular reinforcement/);

bad(()=>returned.execute({...entry,hex:'1701'}),/edge|stacking/);
returned=returned.execute(entry).session;
eq(returned.snapshot().state.units[unitId].hex,entry.hex,'regular entry placement');
eq(returned.snapshot().state.units[unitId].strengthStatus,'printed-reduced','damaged face preserved after return');
eq(returned.snapshot().state.evacuatedNavalUnits[unitId],undefined,'reserve consumed');
eq(Campaign.restore(returned.save(),returnCtx).snapshot(),returned.snapshot(),'reentry replay and restoration');
bad(()=>returned.execute(entry),/reserve|not eligible|lacks original deployed source face/);
eq(returned.undo().session.snapshot(),Campaign.create(returnCtx).snapshot(),'Undo re-entry restores off-map reserve');
// A source-scheduled reinforcement subsequently evacuated at a Fleet port
// must ALSO be allowed to return; its original schedule is not a one-way ban.
const scheduled=policy.reinforcements.find(r=>r.owner==='soviet'&&r.turn===4&&r.kind==='ground');
const scheduledId=fx.selected[scheduled.group][scheduled.index];
const scheduledState=built.place({state:initial,cursor:{scenarioId:'leningrad',turn:4,index:4,complete:false},
 actor:'soviet',phase:built.openingPhase(),slotId:scheduled.slotId,hex:'2101'}).state;
scheduledState.units[scheduledId].hex='1701'; // synthetic movement-to-port preparation
const Navy=require('../core/historical_naval_logistics');
const n=Navy.create({map:M,combatPolicy,counterConfig:K,sourcePolicy:policy.navalReplacementPolicy});
const offmap=n.transport({state:scheduledState,actor:'soviet',unitId:scheduledId,destination:{kind:'off-map'},turn:4,die:6}).state;
const scheduledReturn=built.placeEvacuated({state:offmap,cursor:{scenarioId:'leningrad',turn:5,index:4,complete:false},actor:'soviet',
 phase:built.openingPhase(),unitId:scheduledId,hex:'2102'});
eq(scheduledReturn.state.units[scheduledId].hex,'2102','previously scheduled reinforcement returns as regular reinforcement');
const previouslyScheduled=scheduledReturn.state.buildupDeployedIds.filter(id=>id===scheduledId);
eq(previouslyScheduled.length,1,'no duplicate source deployment/admission ledger entry');
bad(()=>built.placeEvacuated({state:scheduledReturn.state,cursor:{scenarioId:'leningrad',turn:6,index:4,complete:false},actor:'soviet',
 phase:built.openingPhase(),unitId:scheduledId,hex:'2103'}),/source face|not eligible/);

const noPermission=copy(origin);noPermission.config.phases.find(p=>p.id==='soviet-special-movement').permissions=noPermission.config.phases.find(p=>p.id==='soviet-special-movement').permissions.filter(x=>x!=='naval-ground-transport');
bad(()=>Campaign.create(noPermission).execute(declaration),/lacks phase permission/);
const wrongActor=copy(origin);wrongActor.actor='german';
bad(()=>Campaign.create(wrongActor),/opening|actor/);
console.log(`PASS v520 synthetic journal/reentry harness: ${checks} assertions`);
