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
const all=Object.values(ctx.state.units),gs=all.filter(u=>u.owner==='german'&&u.printedCombatStrength===8).slice(0,2),ss=all.filter(u=>u.owner==='soviet'&&u.printedCombatStrength===8&&u.reverseFaceId).slice(0,2);
eq(gs.length,2);eq(ss.length,2);
const edges=board.edges.filter(e=>e.verified&&!e.river&&!e.majorRiver&&!e.impassable&&!e.lake&&!e.allSea&&board.cells[e.b].terrain==='open'&&!map.cells.find(c=>c.id===e.b).city);
const first=edges[0],second=edges.find(e=>[e.a,e.b].every(h=>![first.a,first.b].includes(h)&&!board.edges.some(x=>[first.a,first.b].some(k=>(x.a===k&&x.b===h)||(x.b===k&&x.a===h)))));
ok(first&&second);
for(const crtVariant of ['standard','advanced']){
 const cc={...ctx,actor:'german',cursor:{...cursor,index:config.phases.findIndex(p=>p.id==='german-combat')},combatPolicy:{...combatPolicy,crtVariant},state:{...structuredClone(snap.state),units:Object.fromEntries([first,second].flatMap((e,i)=>[{...gs[i],hex:e.a},{...ss[i],hex:e.b}]).map(u=>[u.id,u]))}};
 const cs=Campaign.create(cc),original=cs.save();
 const battles=[first,second].map((e,i)=>({defenderHex:e.b,attackers:[gs[i].id]}));
 const initial=cs.snapshot(),normal=Auto.rankContinuations({snapshot:initial,context:cc,proposals:battles});eq(normal.ranked.length,0);
 const evaluated=Auto.rankContinuations({snapshot:initial,context:cc,proposals:battles,supportPlanning:true,nonCityAdvance:true,maxTrials:256});
 console.log(crtVariant,JSON.stringify(evaluated.decisions));
 ok(evaluated.ranked.length>=1);ok(evaluated.ranked.every(x=>x.method==='supported-detailed-utility'&&x.delta>0));
 const d=Auto.decide({session:cs,context:cc,policy:{...policy,selectionMode:'seeded'}});
 eq(d.action.action.type,'commit-battles');eq(d.action.action.battles.length,1);
 const chosen=d.action.action.battles[0],expected=evaluated.ranked.find(x=>x.battle.defenderHex===chosen.defenderHex);
 let next=cs.execute(d.action).session;
 const select=Auto.decide({session:next,context:cc,policy:{...policy,selectionMode:'seeded'}});eq(select.action.action.defenderHex,chosen.defenderHex);
 next=next.execute(select.action).session;
 const supported=Auto.decide({session:next,context:cc,policy});eq(supported.action.action.faceId,expected.airSupportId);
 const saved=next.save();eq(Auto.decide({session:Campaign.restore(saved,cc),context:cc,policy}),supported);
 const locked=next.execute(supported.action).session;eq(locked.snapshot().combat.groundAirChoice,expected.airSupportId);
 // The actual pre-roll report must use the supported column for every die.
 const Threat=require('../core/historical_threat_assessment');
 const report=Threat.create(cc).compareContinuations({state:initial.state,cursor:initial.cursor,owner:'german',hex:initial.state.units[chosen.attackers[0]].hex,battle:chosen,allAttackerOrigins:true,positionUtility:true,objectiveUtility:true,communicationUtility:true,cityAdvance:true,nonCityAdvance:true,airSupportId:expected.airSupportId,maxTrials:256});
 eq(report.attack.odds,expected.supportedOdds);
 for(const row of report.attack.report.rolls){
  const post=Catalog.discoverPostRoll({session:locked,context:cc,die:row.die});
  ok(post.options.length>0);eq(post.options[0].outcome??post.outcome,row.outcome);
 }
 eq(cs.save(),original);
 const exhausted=structuredClone(initial);exhausted.state.airUse={'3':Object.fromEntries(combatPolicy.airSupport.markers.map(m=>[m.faceId,'ground']))};
 eq(Auto.rankContinuations({snapshot:exhausted,context:cc,proposals:battles,supportPlanning:true}).ranked.length,0);
 const hidden=structuredClone(initial);hidden.state.units[ss[0].id].strengthStatus='untried';
 // No exact support-dependent candidate for a concealed face.
 const h=Auto.rankContinuations({snapshot:hidden,context:cc,proposals:[battles[0]],supportPlanning:true});ok(!h.ranked.some(x=>x.method==='supported-detailed-utility'));
 // Mixed plan: conventional 3:1 plus a support-dependent 1:1. The latter
 // must be first even in seeded selection mode, without consuming two markers.
 const conventional=all.find(u=>u.owner==='german'&&u.printedCombatStrength===12);
 const mixedState=structuredClone(cc.state);delete mixedState.units[gs[0].id];
 mixedState.units[conventional.id]={...conventional,hex:first.a};
 mixedState.units[ss[0].id]={...ss[0],hex:first.b,strengthStatus:'printed-reduced',printedCombatStrength:4,activeFaceId:ss[0].reverseFaceId};
 const mixedContext={...cc,state:mixedState},mixed=Campaign.create(mixedContext);
 const md=Auto.decide({session:mixed,context:mixedContext,policy:{...policy,selectionMode:'seeded'}});
 eq(md.action.action.battles.length,2);eq(md.action.action.battles[0].defenderHex,second.b);
 const declared=mixed.execute(md.action).session;
 const md2=Auto.decide({session:Campaign.restore(declared.save(),mixedContext),context:mixedContext,policy:{...policy,selectionMode:'seeded'}});
 eq(md2.action.action.defenderHex,second.b);
 const ms=declared.execute(md2.action).session;const ma=Auto.decide({session:ms,context:mixedContext,policy});eq(ma.action.action.faceId,expected.airSupportId);
} 
console.log('PASS supported planning',n,'assertions');
