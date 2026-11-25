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
for(const variant of ['standard','advanced']){
 const c={...ctx,actor:"soviet",cursor,combatPolicy:{...combatPolicy,crtVariant:variant},state:{...structuredClone(Campaign.create(ctx).snapshot().state),units:{[attacker.id]:{...attacker,hex:edge.a},[defender.id]:{...defender,hex:edge.b}}}};
 const session=Campaign.create(c),snap=session.snapshot(),before=session.save();
 const t=Threat.create(c),r=t.assess({state:snap.state,cursor:snap.cursor,owner:'soviet',hex:edge.a});
 eq(r.actor,'german');eq(r.cursor.turn,4);eq(r.friendlyMovement,['soviet-movement']);eq(r.opposingPreparation,['german-buildup','german-movement']);eq(r.knownPlans,1);eq(r.unknownPlans,0);eq(r.eliminationRisk,null);eq(r.strongest.odds,variant==='standard'?1:1.5);eq(r.strongest.conditionalDE,0);
 // Concentrate three known enemy corps on distinct legal hexsides against a reduced Army.
 const center=map.cells.find(cell=>cell.terrain==='open'&&!(cell.tileMarkers||[]).length&&board.edges.filter(e=>(e.a===cell.id||e.b===cell.id)&&e.verified&&!e.impassable&&!e.river&&!e.majorRiver&&!e.lake&&!e.allSea).length>=3);
 const neighbors=board.edges.filter(e=>(e.a===center.id||e.b===center.id)&&e.verified&&!e.impassable&&!e.river&&!e.majorRiver&&!e.lake&&!e.allSea).slice(0,3).map(e=>e.a===center.id?e.b:e.a);
 const reduced={...attacker,hex:center.id,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:attacker.reverseFaceId};
 const corps=units.filter(u=>u.owner==='german'&&u.printedCombatStrength>=8).slice(0,3);
 const concentrated={...snap.state,units:Object.fromEntries([reduced,...corps.map((u,i)=>({...u,hex:neighbors[i]}))].map(u=>[u.id,u]))};
 const high=t.assess({state:concentrated,cursor:snap.cursor,owner:'soviet',hex:center.id});
 eq(high.knownPlans,7);eq(high.strongest.odds,6);eq(high.strongest.conditionalDE,4/6);eq(high.eliminationRisk,null);
 const last={...snap.cursor,turn:7};eq(t.assess({state:snap.state,cursor:last,owner:'soviet',hex:edge.a}).cursor,null);
 const hidden={...snap.state,units:{...snap.state.units,[defender.id]:{...snap.state.units[defender.id],strengthStatus:'untried',reverseFaceId:'do-not-read'}}};
 const h=t.assess({state:hidden,cursor:snap.cursor,owner:'soviet',hex:edge.a});eq(h.unknownPlans,1);eq(h.knownPlans,0);eq(h.strongest,null);
 const opts=Catalog.discover({session,context:c,enumerateCombinedPlans:false});
 const diag=Auto.screenBattles({snapshot:snap,context:c,proposals:opts.proposals,utilityPilot:true,threatDiagnostics:true});eq(diag.threats,[r]);eq(session.save(),before);
}
console.log('PASS stationary threat assessment',n,'assertions');
