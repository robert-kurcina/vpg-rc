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
for(const variant of ['standard','advanced']){
 const c={...ctx,actor:'german',cursor:{...cursor,index:config.phases.findIndex(p=>p.id==='german-combat')},combatPolicy:{...combatPolicy,crtVariant:variant},state:{...structuredClone(Campaign.create(ctx).snapshot().state),units:Object.fromEntries([...gs.map((u,i)=>({...u,hex:neighbors[i]})),{...attacker,hex:target.id,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:attacker.reverseFaceId}].map(u=>[u.id,u]))}};
 const session=Campaign.create(c),snap=session.snapshot(),before=session.save();
 const battle={defenderHex:target.id,attackers:gs.map(u=>u.id)};
 const r=Threat.create(c).compareContinuations({state:snap.state,cursor:snap.cursor,owner:'german',hex:neighbors[0],battle,allAttackerOrigins:true,positionUtility:true,objectiveUtility:true,communicationUtility:true});
 eq(r.inaction.surviving,[...battle.attackers].sort());eq(r.inaction.positions.length,2);eq(r.attack.odds,6);eq(r.attack.report.rolls.every(x=>x.complete),true);eq(r.attack.report.rolls.length,6);eq(r.attack.witnesses.every(w=>w.exposure.surviving.length===2),true);
 const rank=Auto.rankContinuations({snapshot:snap,context:c,proposals:[battle]});console.log(variant,rank.decisions);eq(rank.ranked.length,1);eq(rank.decisions[0].reason,'positive-utility');
 const chosen=Auto.decide({session,context:c,policy:{attackSelection:'continuation-pilot'}});eq(chosen.action.action.battles.length,1);eq(chosen.action.action.battles[0].attackers.length,2);eq(session.execute(chosen.action).session.snapshot().combat.status,'committed');eq(session.save(),before);
 // Full strength defender: 3:1 or lower, with Exchange branches.
 const full={...c,state:{...snap.state,units:{...snap.state.units,[attacker.id]:{...attacker,hex:target.id}}}};
 const ex=Threat.create(full).compareContinuations({state:full.state,cursor:full.cursor,owner:'german',hex:neighbors[0],battle,allAttackerOrigins:true,positionUtility:true,maxTrials:256});
 eq(ex.attack.odds,3);eq(ex.attack.report.rolls.every(x=>x.complete),true);eq(ex.attack.report.rolls.some(x=>x.outcome==='EX'),true);
 const limited=Threat.create(full).compareContinuations({state:full.state,cursor:full.cursor,owner:'german',hex:neighbors[0],battle,allAttackerOrigins:true,positionUtility:true,maxTrials:1});eq(limited.utility.attack,null);
}
console.log('PASS concentrated attack',n,'assertions');
