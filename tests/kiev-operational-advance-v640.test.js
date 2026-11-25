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
const target=map.cells.find(c=>!c.city?.name&&board.cells[c.id].terrain==='open'&&board.edges.filter(e=>(e.a===c.id||e.b===c.id)&&e.verified&&!e.impassable&&!e.river&&!e.majorRiver&&!e.lake&&!e.allSea).length>=2);
const neighbors=board.edges.filter(e=>(e.a===target.id||e.b===target.id)&&e.verified&&!e.impassable&&!e.river&&!e.majorRiver&&!e.lake&&!e.allSea).map(e=>e.a===target.id?e.b:e.a);
const gs=units.filter(u=>u.owner==='german'&&u.printedCombatStrength===12).slice(0,2);
for(const variant of ['standard','advanced']){
 const state=structuredClone(Campaign.create(ctx).snapshot().state);

 state.units=Object.fromEntries([...gs.map((u,i)=>({...u,hex:neighbors[i]})),{...attacker,hex:target.id,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:attacker.reverseFaceId}].map(u=>[u.id,u]));
 const c={...ctx,actor:'german',cursor:{...cursor,index:config.phases.findIndex(p=>p.id==='german-combat')},combatPolicy:{...combatPolicy,crtVariant:variant},state};
 const session=Campaign.create(c),snap=session.snapshot(),before=session.save();
 const battle={defenderHex:target.id,attackers:gs.map(u=>u.id)};
 const args={state:snap.state,cursor:snap.cursor,owner:'german',hex:neighbors[0],battle,allAttackerOrigins:true,positionUtility:true,objectiveUtility:true,communicationUtility:true,maxTrials:256};
 const t=Threat.create(c),hold=t.compareContinuations(args),advance=t.compareContinuations({...args,cityAdvance:true,nonCityAdvance:true});
 eq(advance.attack.report,hold.attack.report);eq(advance.utility.hold,hold.utility.hold);eq(advance.utility.withdraw,hold.utility.withdraw);
 A.ok(advance.attack.witnesses.some(w=>w.advanceOptions.length));n++;
 for(const w of advance.attack.witnesses){for(const a of w.advanceOptions){eq(a.exposure.objective.cityControl,w.exposure.objective.cityControl);eq(a.exposure.positions.find(p=>p.units.includes(a.unitId)).hex,target.id);eq(a.exposure.material,w.exposure.material);}}
 A.ok(advance.utility.attack>=hold.utility.attack);n++;
 const ranking=Auto.rankContinuations({snapshot:snap,context:c,proposals:[battle],maxTrials:256,nonCityAdvance:true});eq(ranking.assessments[0].utility,advance.utility);
 const capped=t.compareContinuations({...args,cityAdvance:true,maxTrials:1});eq(capped.utility.attack,null);
 let selected=session.execute({type:'combat',action:{type:'commit-battles',battles:[battle]}}).session;
 selected=selected.execute({type:'combat',action:{type:'select-battle',defenderHex:target.id}}).session;
 selected=selected.execute({type:'combat',action:{type:'commit-ground-air',faceId:null}}).session;
 const saved=selected.save();let checked=0;
 for(let die=1;die<=6;die++){
  const post=Catalog.discoverPostRoll({session:selected,context:c,die});
  const ranked=Auto.rankOperationalPostRoll({session:selected,snapshot:selected.snapshot(),context:c,post});
  if(ranked.length>1&&ranked.some(x=>x.option.advanced)){
   A.ok(ranked.every(x=>Number.isFinite(x.pressure)&&Number.isFinite(x.communicationNet)));n++;
   A.ok(ranked.every((x,i)=>!i||ranked[i-1].score>=x.score));n++;
   A.ok(selected.execute(ranked[0].option.action).session.snapshot());n++;checked++;
  }
 }
 A.ok(checked>0);n++;eq(selected.save(),saved);
 eq(session.save(),before);
}
console.log('PASS operational non-city advance',n,'assertions');
