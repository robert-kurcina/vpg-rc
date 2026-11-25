'use strict';
// Synthetic casualty origins, actual production graph and campaign transaction.
const A=require('node:assert/strict'), C=require('../core/historical_campaign_session'), B=require('../core/historical_buildup_phase'), Binding=require('../core/movement_binding');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),config=require('../maps/phase-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const opening=committed.opening;
const context={...opening,map,profile,config,counterConfig,combatPolicy:require('../maps/combat-configs/kiev.json'),enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:committed.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
const Catalog=require('../core/historical_campaign_action_catalog');
const initial=C.create(context).snapshot().state, allocation=context.buildupAllocation;
const reserve=allocation.sovietReplacementOnlyArmy[0], excluded=context.buildupPolicy.replacementExcludedFaces[0].faceId, mechs=allocation.sovietFrontMechanized.filter(id=>id!==excluded).slice(0,2), army=allocation.sovietFrontArmies[0];
const state=structuredClone(initial); for(const id of [excluded,...mechs,army]) delete state.units[id];
// Synthetic casualty origin on the original campaign graph; clear eastern entry locations.
const edge=context.buildupPolicy.entryEdge.soviet; for(const [id,u] of Object.entries(state.units))if(edge.includes(u.hex))delete state.units[id];
let n=0;const eq=(a,b)=>{A.deepEqual(a,b);n++};const fail=(fn,re)=>{A.throws(fn,re);n++};
const ctx=turn=>({...context,state:structuredClone(state),cursor:{...opening.cursor,turn,index:context.config.phases.findIndex(p=>p.id==='soviet-buildup')},actor:'soviet'});
const action=(unitId,hex=null)=>({type:'apply-replacement',unitId,hex});
const c=ctx(3);let s=C.create(c);const origin=s.snapshot();
const commands=Catalog.discover({session:s,context:c}).commands;
const legal=(id)=>commands.find(a=>a.type==='apply-replacement'&&a.unitId===id&&edge.includes(a.hex));
eq(Boolean(legal(reserve)),true);eq(Boolean(legal(excluded)),false);eq(Boolean(legal(mechs[0])),true);eq(Boolean(legal(army)),true);
fail(()=>s.execute(action(excluded,edge[0])),/Source-excluded/);
const first=legal(mechs[0]);s=s.execute(first).session;const mech=s.snapshot().state.units[mechs[0]];eq(mech.strengthStatus,'revealed-one-step');eq(mech.activeFaceId,mech.reverseFaceId);eq(mech.printedCombatStrength,null);
const other=legal(mechs[1]);fail(()=>s.execute(other),/Only one Soviet Mechanized Corps|overstack/);
const r=Catalog.discover({session:s,context:c}).commands.find(a=>a.type==='apply-replacement'&&a.unitId===reserve);eq(Boolean(r),true);s=s.execute(r).session;eq(s.snapshot().state.units[reserve].strengthStatus,'printed-reduced');eq(s.snapshot().state.buildupDeployedIds.includes(reserve),true);fail(()=>s.execute(action(reserve)),/No replacement steps|Cannot rebuild and restore/);eq(C.restore(s.save(),c).snapshot(),s.snapshot());eq(s.undo().session.undo().session.snapshot(),origin);
const d=ctx(4);let q=C.create(d);const choices=Catalog.discover({session:q,context:d}).commands;const rebuild=choices.find(a=>a.type==='apply-replacement'&&a.unitId===army);eq(Boolean(rebuild),true);q=q.execute(rebuild).session;eq(q.snapshot().state.units[army].strengthStatus,'printed-reduced');fail(()=>q.execute(action(army)),/Cannot rebuild and restore/);eq(C.restore(q.save(),d).snapshot(),q.snapshot());
console.log('PASS v602 replacement campaign:',n,'assertions');
