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
const edge=board.edges.find(e=>!e.river&&!e.majorRiver&&!e.impassable&&board.cells[e.b].terrain==='open'&&board.cells[e.a].terrain==='open'&&!(map.cells.find(c=>c.id===e.a).tileMarkers||[]).length&&!map.cells.find(c=>c.id===e.b).city&&!combatPolicy.firstTurnTerritorialRestriction.targetHexes.includes(e.b));
const cursor={...ctx.cursor,turn:3,index:config.phases.findIndex(p=>p.id==='soviet-combat')};
const Threat=require('../core/historical_threat_assessment');
let n=0;const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
const Binding=require('../core/movement_binding');
const binding=Binding.build(map,profile);
const phase={kind:'movement',owner:'german'};
const center=edge.a;
const adjacent=new Set(board.edges.filter(e=>(e.a===center||e.b===center)&&e.verified&&!e.impassable&&!e.lake&&!e.allSea).map(e=>e.a===center?e.b:e.a));
const base=Campaign.create(ctx).snapshot().state;
const target={...attacker,hex:center};
let chosen;
for(const id of Object.keys(board.cells)){const cell={...board.cells[id],id};
 if(!cell.verified||!Object.hasOwn(profile.terrainCosts,cell.terrain)||cell.id===center||adjacent.has(cell.id))continue;
 const u={...defender,hex:cell.id};
 const state={...base,units:{[target.id]:target,[u.id]:u}};
 const routes=Binding.legalRoutes(binding,phase,state.units,4,u.id,{territory:state.territory}).reachable();
 if(routes.some(r=>adjacent.has(r.id))){chosen=state;break;}
}
A.ok(chosen);n++;
for(const variant of ['standard','advanced']){
 const c={...ctx,combatPolicy:{...combatPolicy,crtVariant:variant}};
 const t=Threat.create(c),args={state:chosen,cursor,owner:'soviet',hex:center};
 const before=JSON.stringify(chosen),r=t.forecast(args);
 eq(r.stationary,null);eq(r.phase.id,'german-movement');eq(r.eliminationRisk,null);A.ok(r.strongest);n++;
 eq(r.strongest.moves.length,1);eq(r.strongest.attackers,[defender.id]);
 const m=r.strongest.moves[0];eq(Binding.move(binding,phase,chosen.units,4,{unitId:m.unitId,path:m.path,mode:m.mode},chosen.territory).ok,true);
 const moved={...chosen,units:{...chosen.units,[defender.id]:{...chosen.units[defender.id],hex:m.destination}}};
 eq(t.assess({...args,state:moved}).strongest.odds,r.strongest.odds);
 const integrated=t.forecastSurvival(args);
 eq(integrated.forecast,r);eq(integrated.survival,t.survival({...args,state:moved}));
 eq(integrated.eliminationRisk,null);eq(integrated.survival.rolls.length,6);
 eq(t.forecastSurvival({...args,maxNodes:1}).survival,null);
 const limited=t.forecastSurvival({...args,maxTrials:1});eq(limited.survival.truncated,true);
 eq(limited.survival.conditionalStackElimination.upper,1);
 eq(t.forecastSurvival({...args,cursor:{...cursor,turn:7}}).survival,null);
 eq(JSON.stringify(chosen),before);eq(t.forecast(args),r);
 const capped=t.forecast({...args,maxNodes:1});eq(capped.truncated,true);eq(capped.strongest,null);eq(capped.eliminationRisk,null);
 const hidden={...chosen,units:{...chosen.units,[defender.id]:{...chosen.units[defender.id],strengthStatus:'untried',mp:undefined,reverseFaceId:'never-read'}}};
 const uncertain=t.forecast({...args,state:hidden});eq(uncertain.concealedMovementOmitted,true);eq(uncertain.strongest,null);
 eq(t.forecast({...args,cursor:{...cursor,turn:7}}).phase,null);
 // A second attacker starts adjacent: direct approach can combine both, never
 // count the same hexside twice. Compare the chosen witness to rule adjudication.
 const second=units.find(u=>u.owner==='german'&&u.id!==defender.id&&u.printedCombatStrength>=8);
 const occupied=[...adjacent].find(h=>h!==chosen.units[defender.id].hex);
 const pair={...chosen,units:{...chosen.units,[second.id]:{...second,hex:occupied}}};
 const joint=t.forecast({...args,state:pair,maxNodes:100});A.ok(joint.strongest);n++;
 A.ok(joint.strongest.attackers.length===2);n++;
 A.ok(joint.strongest.odds>joint.stationary.odds);n++;
 let replay=pair;for(const move of joint.strongest.moves){eq(Binding.move(binding,phase,replay.units,4,{unitId:move.unitId,path:move.path,mode:move.mode},replay.territory).ok,true);replay={...replay,units:{...replay.units,[move.unitId]:{...replay.units[move.unitId],hex:move.destination}}};}
 eq(new Set(joint.strongest.attackers.map(id=>replay.units[id].hex)).size,joint.strongest.attackers.length);
 eq(t.assess({...args,state:replay}).strongest.odds,joint.strongest.odds);
 const combined=t.forecastSurvival({...args,state:pair,maxNodes:100});
 eq(combined.forecast,joint);eq(combined.survival,t.survival({...args,state:replay}));
 eq(combined.eliminationRisk,null);
 eq(t.forecastSurvival({...args,state:hidden}).survival,null);
}
console.log('PASS integrated approach and survival',n,'assertions');
