'use strict';
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay'),Campaign=require('../core/historical_campaign_session'),Catalog=require('../core/historical_campaign_action_catalog');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),config=require('../maps/phase-configs/kiev.json');
const combatPolicy=require('../maps/combat-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:committed.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
const units=Object.values(ctx.state.units), attacker=units.find(u=>u.owner==='soviet'&&u.printedCombatStrength===8), defender=units.find(u=>u.owner==='german'&&u.printedCombatStrength===12), concealed=units.find(u=>u.owner==='soviet'&&u.strengthStatus==='untried');
A.ok(attacker&&defender&&concealed);
const board=require('../core/movement_binding').build(map,profile).board;
const edge=board.edges.find(e=>!e.river&&!e.majorRiver&&!e.impassable&&board.cells[e.b].terrain==='open'&&!map.cells.find(c=>c.id===e.b).city&&!combatPolicy.firstTurnTerritorialRestriction.targetHexes.includes(e.b));
const cursor={...ctx.cursor,turn:3,index:config.phases.findIndex(p=>p.id==='soviet-combat')};
let n=1;const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
const Threat=require('../core/historical_threat_assessment');
const target=map.cells.find(c=>c.id===edge.b);
const neighbors=board.edges.filter(e=>(e.a===target.id||e.b===target.id)&&e.verified&&!e.impassable&&!e.river&&!e.majorRiver&&!e.lake&&!e.allSea).map(e=>e.a===target.id?e.b:e.a);
A.ok(neighbors.length>=2);
const gs=units.filter(u=>u.owner==='german'&&u.printedCombatStrength===12).slice(0,2);A.equal(gs.length,2);
const G=require('../core/historical_combat_geography');
const safe=map.cells.find(c=>c.terrain==='open'&&c.id!==target.id&&!board.edges.some(e=>(e.a===target.id&&e.b===c.id)||(e.b===target.id&&e.a===c.id))).id;
for(const variant of ['standard','advanced']){
 const c={...ctx,combatPolicy:{...combatPolicy,crtVariant:variant}};
 const geography=G.create(map,profile,{cityMarkerMode:combatPolicy.cityMarkerMode,fortificationMode:combatPolicy.fortificationMode});
 const state={...ctx.state,units:Object.fromEntries([{...gs[0],hex:neighbors[0]},{...gs[1],hex:safe},{...attacker,hex:target.id}].map(u=>[u.id,u]))};
 const snapshot={actor:'german',cursor:{...cursor,index:config.phases.findIndex(p=>p.id==='german-movement')},state};
 const evalFor=s=>Auto.concentrationEvaluator({snapshot:s,context:c,board,geography});
 const original=JSON.stringify(snapshot),f=evalFor(snapshot);
 const gain=f(gs[1].id,neighbors[1]);A.ok(gain>0);n++;
 eq(f(gs[1].id,neighbors[0]),0); // same origin cannot join the attack
 eq(f(gs[1].id,safe),0);eq(JSON.stringify(snapshot),original);
 const joined={...snapshot,state:{...state,units:{...state.units,[gs[1].id]:{...gs[1],hex:neighbors[1]}}}};
 eq(evalFor(joined)(gs[1].id,safe),-gain);
 const reduced={...state.units[attacker.id],strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:attacker.reverseFaceId};
 const saturated={...joined,state:{...joined.state,units:{...joined.state.units,[attacker.id]:reduced}}};
 // Once both origins attain the maximum column, holding cannot improve it.
 eq(evalFor(saturated)(gs[1].id,neighbors[1]),0);
 const third=units.find(u=>u.owner==='german'&&!gs.some(g=>g.id===u.id)&&u.strengthStatus!=='untried');
 A.ok(third&&neighbors.length>=3);n++;
 const extra={...saturated,state:{...saturated.state,units:{...saturated.state.units,[third.id]:{...third,hex:safe}}}};
 eq(evalFor(extra)(third.id,neighbors[2]),0);
 const hidden={...snapshot,state:{...state,units:{[gs[0].id]:state.units[gs[0].id],[gs[1].id]:state.units[gs[1].id],[concealed.id]:{...concealed,hex:target.id}}}};
 eq(evalFor(hidden)(gs[1].id,neighbors[1]),0);
 console.log(variant,'concentration gain',gain);
}
console.log('PASS concentration movement',n,'assertions');
