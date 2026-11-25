'use strict';
// Synthetic terminal origins, actual production graph and campaign transaction.
const A=require('node:assert/strict'), C=require('../core/historical_campaign_session'), B=require('../core/historical_buildup_phase'), Binding=require('../core/movement_binding');
const root=x=>require('../'+x), opening=root('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart;
const context={...structuredClone(opening),map:root('maps/kiev-odessa-composite-experimental-v531.json'),profile:root('maps/movement-configs/kiev-odessa-experimental-v531.json'),config:root('maps/phase-configs/kiev-odessa.json'),counterConfig:root('maps/counter-configs/kiev-odessa-experimental-v531.json'),combatPolicy:root('maps/combat-configs/kiev-odessa-experimental-v531.json'),rosterOverlay:root('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,buildupPolicy:root('maps/buildup-configs/kiev-odessa-experimental-v533.json'),buildupAllocation:root('games/kiev-odessa/experimental-preview/allocation-v533.json'),housekeepingPolicy:root('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
const Catalog=require('../core/historical_campaign_action_catalog');
const initial=C.create(context).snapshot().state, allocation=context.buildupAllocation;
const reserve=allocation.sovietReplacementOnlyArmy[0], excluded=allocation.sovietFrontMechanized[0], mechs=allocation.sovietFrontMechanized.slice(1,3), army=allocation.sovietFrontArmies[0];
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
console.log('PASS v580 replacement campaign:',n,'assertions');
