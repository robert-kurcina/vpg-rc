'use strict';
const assert=require('node:assert/strict');
const map=require('../maps/kiev-odessa-composite-experimental-v531.json');
const profile=require('../maps/movement-configs/kiev-odessa-experimental-v531.json');
const combatPolicy=require('../maps/combat-configs/kiev-odessa-experimental-v531.json');
const board=require('../core/movement_binding').build(map,profile).board;
const forced=require('../core/historical_forced_retreat').create({map,profile,combatPolicy});
const safe=require('../core/historical_retreat_options').create({map,profile,combatPolicy:{...combatPolicy,safeRetreatOnly:true}});
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++};const throws=(f,r)=>{assert.throws(f,r);n++};
// Synthetic occupancy on actual pinned map; no new country labels.
for(const hex of ['0502','1513']){
 const exits=board.edges.filter(e=>(e.a===hex||e.b===hex)&&!e.impassable&&!e.lake&&!e.allSea).map(e=>e.a===hex?e.b:e.a);
 const state={territory:{bessarabiaAnnexed:false},units:{h:{id:'h',owner:'german',nationality:'hungarian',hex,size:'corps'}}};
 exits.forEach((h,i)=>state.units['s'+i]={id:'s'+i,owner:'soviet',nationality:'soviet',hex:h,size:'corps'});
 const req={state,defenderHex:hex,defenderIds:['h']};const before=structuredClone(state);
 const f=forced.enumerate(req);eq(f.perDefender.h.noPhysicalRoute,true);eq(safe.enumerate(req).jointOptions.length,0);eq(state,before);
 // A genuinely possible land step now has adjudicated territory.
 delete state.units.s0;eq(forced.enumerate(req).perDefender.h.noPhysicalRoute,false);
}
console.log('PASS v566 retreat territory ordering',n,'assertions');
