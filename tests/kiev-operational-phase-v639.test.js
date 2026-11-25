'use strict';
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay'),Campaign=require('../core/historical_campaign_session'),Catalog=require('../core/historical_campaign_action_catalog');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map,counterConfig=F.counterConfig,profile=require('../maps/movement-configs/kiev.json'),config=require('../maps/phase-configs/kiev.json');
const combatPolicy=require('../maps/combat-configs/kiev.json');
const committed=require('../core/historical_deployment_session').create({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})},allocation:F.allocation,placements:F.placements}).commit();
const ctx={...committed.opening,map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:require('../maps/buildup-configs/kiev.json'),buildupAllocation:committed.allocation,housekeepingPolicy:require('../maps/housekeeping-configs/kiev.json')};
let n=0;const ok=(v,m)=>{A.ok(v,m);n++};const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
const cursor={...ctx.cursor,turn:3,index:config.phases.findIndex(p=>p.id==='german-movement')};
const c={...ctx,actor:'german',cursor,state:structuredClone(Campaign.create(ctx).snapshot().state)};
const s=Campaign.create(c),snap=s.snapshot(),before=s.save();

const policy={phaseScope:'operational',seed:7};
const p=Auto.policyOf(policy);eq(p.attackSelection,'continuation-pilot');ok(p.maxGroundMovesPerPhase>100);ok(p.maxCombatsPerPhase>100);ok(p.maxCombatPhases>100);eq(Auto.policyOf({}).maxGroundMovesPerPhase,1);eq(Auto.policyOf({...policy,maxGroundMovesPerPhase:2}).maxGroundMovesPerPhase,2);
let current=s, moves=0, count=0;const ids=new Set();
while(current.snapshot().phaseId===snap.phaseId && count++<100){
 const d=Auto.decide({session:current,context:c,policy});eq(d.status,'action',JSON.stringify(d));
 if(d.action.type==='declare-ground-move'){ok(!ids.has(d.action.request.unitId));ids.add(d.action.request.unitId);}
 if(d.action.type==='resolve-ground-move')moves++;
 current=current.execute(d.action).session;
}
ok(moves>1,'must exceed diagnostic cap');ok(current.snapshot().phaseId!==snap.phaseId);eq(s.save(),before);eq(Campaign.restore(current.save(),c).snapshot(),current.snapshot());
console.log('PASS operational movement phase',n,'assertions',moves,'moves',count,'actions');
// Construct two independent source-map combat positions, with verified open
// non-river edges. This qualifies combined declaration, not deployment routes.
const board=require('../core/movement_binding').build(map,profile).board;
const all=Object.values(ctx.state.units),gs=all.filter(u=>u.owner==='german'&&u.printedCombatStrength===12).slice(0,2),ss=all.filter(u=>u.owner==='soviet'&&u.printedCombatStrength===8&&u.reverseFaceId).slice(0,2);
eq(gs.length,2);eq(ss.length,2);
const edges=board.edges.filter(e=>e.verified&&!e.river&&!e.majorRiver&&!e.impassable&&!e.lake&&!e.allSea&&board.cells[e.b].terrain==='open'&&!map.cells.find(c=>c.id===e.b).city);
const first=edges[0],second=edges.find(e=>[e.a,e.b].every(h=>![first.a,first.b].includes(h)&&!board.edges.some(x=>[first.a,first.b].some(k=>(x.a===k&&x.b===h)||(x.b===k&&x.a===h)))));
ok(first&&second);
for(const crtVariant of ['standard','advanced']){
 const cc={...ctx,actor:'german',cursor:{...cursor,index:config.phases.findIndex(p=>p.id==='german-combat')},combatPolicy:{...combatPolicy,crtVariant},state:{...structuredClone(snap.state),units:Object.fromEntries([first,second].flatMap((e,i)=>[{...gs[i],hex:e.a},{...ss[i],hex:e.b,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:ss[i].reverseFaceId}]).map(u=>[u.id,u]))}};
 const cs=Campaign.create(cc),cb=cs.save(),d=Auto.decide({session:cs,context:cc,policy});eq(d.status,'action');eq(d.action.action.type,'commit-battles');eq(d.action.action.battles.length,2);eq(new Set(d.action.action.battles.flatMap(b=>b.attackers)).size,2);eq(cs.execute(d.action).session.snapshot().combat.status,'committed');eq(cs.save(),cb);
 const reliefOnly={...policy,objectivePolicy:'reserve-relief',coordinatedAttacks:false};
 eq(Auto.decide({session:cs,context:cc,policy:reliefOnly}),d,'Reserve-only policy must retain baseline combat selection');
 const experimental={...policy,objectivePolicy:'reserve-relief'};
 const joint=Auto.decide({session:cs,context:cc,policy:experimental});
 eq(joint.status,'action');eq(joint.action.action.type,'commit-battles');eq(joint.action.action.battles.length,2);
 eq(Auto.decide({session:cs,context:cc,policy:experimental}),joint);
 eq(Auto.decide({session:cs,context:cc,policy:{...policy,coordinatedAttacks:true}}),joint,'Joint-only policy must retain experimental combat selection');
 const resolved=cs.execute(joint.action).session;eq(resolved.snapshot().combat.status,'committed');eq(Campaign.restore(resolved.save(),cc).snapshot(),resolved.snapshot());eq(cs.save(),cb);
}
console.log('PASS operational movement and combined declarations',n,'assertions');
// Score isolated, constructed path witnesses on actual city-marker data.
// These are ranking fixtures, not a movement legality test.
const major=map.cells.find(c=>c.city?.name&&(c.tileMarkers||[]).some(m=>m.kind==='majorCity'));
const ordinary=map.cells.find(c=>c.city?.name&&!(c.tileMarkers||[]).some(m=>m.kind==='majorCity'));
ok(major&&ordinary);
const originFor=city=>board.edges.filter(e=>e.verified&&!e.impassable&&!e.lake&&!e.allSea&&(e.a===city.id||e.b===city.id)).map(e=>e.a===city.id?e.b:e.a).find(h=>!map.cells.find(c=>c.id===h).city);
const origins=[originFor(major),originFor(ordinary)];ok(origins.every(Boolean));
const scoreSnap={...snap,state:{...snap.state,cityControl:{...snap.state.cityControl,[major.city.name]:'soviet',[ordinary.city.name]:'soviet'},units:Object.fromEntries(gs.map((u,i)=>[u.id,{...u,hex:origins[i]}]))}};
const commands=[major,ordinary].map((city,i)=>({type:'declare-ground-move',request:{unitId:gs[i].id,path:[origins[i],city.id]}}));
const historical=Auto.rankObjectiveMoves({snapshot:scoreSnap,context:c,commands});eq(historical.map(x=>x.captureValue),[1,1]);
const weighted=Auto.rankObjectiveMoves({snapshot:scoreSnap,context:c,commands,operational:true});eq(weighted.map(x=>x.captureValue),[1.5,1]);eq(weighted[0].action.request.path.at(-1),major.id);
console.log('PASS operational movement, combined declarations and objective weighting',n,'assertions');
