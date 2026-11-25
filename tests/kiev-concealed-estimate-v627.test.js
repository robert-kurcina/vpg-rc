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
const Consequences=require('../core/historical_combat_consequences'),Geography=require('../core/historical_combat_geography');
const other=units.find(u=>u.strengthStatus==='untried'&&u.id!==concealed.id);
for(const variant of ['standard','advanced']){
 const c={...ctx,actor:'german',cursor:{...cursor,index:config.phases.findIndex(p=>p.id==='german-combat')},combatPolicy:{...combatPolicy,crtVariant:variant},state:{...structuredClone(Campaign.create(ctx).snapshot().state),units:Object.fromEntries([...gs.map((u,i)=>({...u,hex:neighbors[i]})),{...concealed,hex:target.id}].map(u=>[u.id,u]))}};
 const session=Campaign.create(c),snap=session.snapshot(),before=session.save();
 const battle={defenderHex:target.id,attackers:gs.map(u=>u.id)}, full={...battle,defenders:[concealed.id]};
 const e=Consequences.create({...c,phaseConfig:config,geography:Geography.create(map,profile,{cityMarkerMode:c.combatPolicy.cityMarkerMode,fortificationMode:c.combatPolicy.fortificationMode})});
 const args={state:snap.state,battle:full,actor:'german',cursor:snap.cursor};
 const est=e.previewEstimatedOdds(args);eq(est.complete,true);eq(est.assignments,10);eq(est.distribution,{'6':10});eq(e.previewKnownOdds(args),null);
 const altered=structuredClone(snap.state);altered.units[concealed.id].sourceFaceId=other.sourceFaceId;altered.units[concealed.id].reverseFaceId=other.reverseFaceId;
 eq(e.previewEstimatedOdds({...args,state:altered}),est);
 // Throw on any attempt to access the hidden unit's face identity.
 for(const key of ['sourceFaceId','reverseFaceId'])Object.defineProperty(altered.units[concealed.id],key,{get(){throw Error('hidden identity read');}});
 eq(e.previewEstimatedOdds({...args,state:altered}),est);
 const limited=e.previewEstimatedOdds({...args,maxAssignments:1});eq(limited.complete,false);eq(limited.reason,'assignment-budget');eq(limited.assignments,0);eq(limited.distribution,{});
 const rank=Auto.rankContinuations({snapshot:snap,context:c,proposals:[battle]});eq(rank.ranked.length,1);eq(rank.decisions[0].reason,'concealed-positive-proxy');
 const decision=Auto.decide({session,context:c,policy:{attackSelection:'continuation-pilot'}});eq(decision.action.action.battles.length,1);eq(session.execute(decision.action).session.snapshot().combat.status,'committed');eq(session.save(),before);
 // One 12-point attacker on open ground: 3:1 through 6:1, with roster weights.
 const single={...full,attackers:[gs[0].id]};const dist=e.previewEstimatedOdds({...args,battle:single});eq(dist.assignments,10);eq(dist.distribution,{'3':1,'4':2,'6':7});
 const revealed={...other,hex:neighbors[0],strengthStatus:'revealed-one-step',revealedAttackStrength:8,revealedDefenseStrength:4};
 const reducedPool={...snap.state,units:{...snap.state.units,[other.id]:revealed}};
 eq(e.previewEstimatedOdds({...args,state:reducedPool,battle:single}).distribution,{'4':2,'6':7});
}
console.log('PASS public-roster estimate',n,'assertions');
