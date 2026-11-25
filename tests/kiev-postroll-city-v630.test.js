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
const target=map.cells.find(c=>c.city?.name&&board.edges.filter(e=>(e.a===c.id||e.b===c.id)&&e.verified&&!e.impassable&&!e.river&&!e.majorRiver&&!e.lake&&!e.allSea).length>=2);
const neighbors=board.edges.filter(e=>(e.a===target.id||e.b===target.id)&&e.verified&&!e.impassable&&!e.river&&!e.majorRiver&&!e.lake&&!e.allSea).map(e=>e.a===target.id?e.b:e.a);
const gs=units.filter(u=>u.owner==='german'&&u.printedCombatStrength===12).slice(0,2);
for(const variant of ['standard','advanced']){
 const state=structuredClone(Campaign.create(ctx).snapshot().state);
 state.cityControl[target.city.name]='soviet';
 state.units=Object.fromEntries([...gs.map((u,i)=>({...u,hex:neighbors[i]})),{...attacker,hex:target.id,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:attacker.reverseFaceId}].map(u=>[u.id,u]));
 const c={...ctx,actor:'german',cursor:{...cursor,index:config.phases.findIndex(p=>p.id==='german-combat')},combatPolicy:{...combatPolicy,crtVariant:variant},state};
 let session=Campaign.create(c);
 const battle={defenderHex:target.id,attackers:gs.map(u=>u.id)};
 for(const type of ['commit-battles','select-battle','commit-ground-air']){
  const options=Catalog.discover({session,context:c,enumerateCombinedPlans:false});
  const command=type==='commit-battles'?{type:'combat',action:{type,battles:[battle]}}:options.commands.find(a=>a.action?.type===type&&(type!=='commit-ground-air'||a.action.faceId===null));
  if(command)session=session.execute(command).session;
 }
 const before=session.save(),snap=session.snapshot();
 let found=0;
 for(let die=1;die<=6;die++){
  const post=Catalog.discoverPostRoll({session,context:c,die});
  const ranked=Auto.rankPostRoll({snapshot:snap,context:c,post});
  if(!ranked.some(r=>r.cityDelta===1))continue;
  found++;eq(ranked[0].cityDelta,1);eq(!!ranked[0].option.advanced,true);
  const resolved=session.execute(ranked[0].option.action).session;
  const next=resolved.execute({type:'combat',action:{type:'finish-combat'}}).session;
  eq(next.snapshot().state.cityControl[target.city.name],'german');eq(session.save(),before);
 }
 A.ok(found>0);n++;
 // The live pilot chooses the best option for its already selected die.
 const decision=Auto.decide({session,context:c,policy:{attackSelection:'continuation-pilot'}});
 eq(decision.reason,'post-roll-material-city-utility');
 const post=Catalog.discoverPostRoll({session,context:c,die:decision.action.action.die});
 eq(decision.action,Auto.rankPostRoll({snapshot:snap,context:c,post})[0].option.action);
 eq(session.save(),before);
}
console.log('PASS post-roll city exploitation',n,'assertions');
