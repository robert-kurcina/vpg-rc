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

// Construct two independent source-map combat positions, with verified open
// non-river edges. This qualifies combined declaration, not deployment routes.
const policy={phaseScope:'operational',seed:7};
const board=require('../core/movement_binding').build(map,profile).board;
const all=Object.values(ctx.state.units),gs=all.filter(u=>u.owner==='german'&&u.printedCombatStrength===12).slice(0,2),ss=all.filter(u=>u.owner==='soviet'&&u.printedCombatStrength===8&&u.reverseFaceId).slice(0,2);
eq(gs.length,2);eq(ss.length,2);
const edges=board.edges.filter(e=>e.verified&&!e.river&&!e.majorRiver&&!e.impassable&&!e.lake&&!e.allSea&&board.cells[e.b].terrain==='open'&&!map.cells.find(c=>c.id===e.b).city);
const first=edges[0],second=edges.find(e=>[e.a,e.b].every(h=>![first.a,first.b].includes(h)&&!board.edges.some(x=>[first.a,first.b].some(k=>(x.a===k&&x.b===h)||(x.b===k&&x.a===h)))));
ok(first&&second);
for(const crtVariant of ['standard','advanced']){
 const cc={...ctx,actor:'german',cursor:{...cursor,index:config.phases.findIndex(p=>p.id==='german-combat')},combatPolicy:{...combatPolicy,crtVariant},state:{...structuredClone(snap.state),units:Object.fromEntries([first,second].flatMap((e,i)=>[{...gs[i],hex:e.a},{...ss[i],hex:e.b,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:ss[i].reverseFaceId}]).map(u=>[u.id,u]))}};
 const cs=Campaign.create(cc),cb=cs.save();
 const plan=[first,second].map((e,i)=>({defenderHex:e.b,attackers:[gs[i].id]}));
 let next=cs.execute({type:'combat',action:{type:'commit-battles',battles:plan}}).session;
 next=next.execute({type:'combat',action:{type:'select-battle',defenderHex:first.b}}).session;
 const beforeAir=next.save(), commands=Catalog.discover({session:next,context:cc}).commands;
 const evaluator=require('../core/historical_combat_consequences').create({...cc,phaseConfig:config,geography:require('../core/historical_combat_geography').create(map,profile,{cityMarkerMode:combatPolicy.cityMarkerMode,fortificationMode:combatPolicy.fortificationMode})});
 const bs=next.snapshot(),battle=bs.combat.declaration.battles[0];
 const args={state:bs.combat.state,battle,actor:'german',cursor:bs.cursor};
 const base=evaluator.previewKnownOdds(args),supported=evaluator.previewKnownOdds({...args,airSupportId:combatPolicy.airSupport.markers[0].faceId});
 ok(supported.finalOdds>base.finalOdds);eq(supported.airSupportShift,1);
 const d=Auto.decide({session:next,context:cc,policy});eq(d.status,'action');eq(d.action.action.type,'commit-ground-air');ok(d.action.action.faceId);eq(next.save(),beforeAir);
 const locked=next.execute(d.action).session;eq(locked.snapshot().combat.groundAirChoice,d.action.action.faceId);eq(cs.save(),cb);
 const diagnostic=Auto.decide({session:next,context:cc,policy:{attackSelection:'continuation-pilot'}});eq(diagnostic.action.action.faceId,null);
 const hidden=structuredClone(args.state);hidden.units[battle.defenders[0]].strengthStatus='untried';hidden.units[battle.defenders[0]].reverseFaceId='not-readable';eq(evaluator.previewKnownOdds({...args,state:hidden,airSupportId:combatPolicy.airSupport.markers[0].faceId}),null);
 A.throws(()=>evaluator.previewKnownOdds({...args,airSupportId:'invalid'}),/unavailable/);n++;

}
console.log('PASS operational ground air allocation',n,'assertions');
