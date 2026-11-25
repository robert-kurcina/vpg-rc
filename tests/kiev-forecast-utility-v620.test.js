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
const Binding=require('../core/movement_binding'), M=require('../core/movement_rules');
const c={...ctx,actor:'soviet',cursor,state:{...structuredClone(Campaign.create(ctx).snapshot().state),units:{[attacker.id]:{...attacker,hex:edge.a},[defender.id]:{...defender,hex:edge.b}}}};
const session=Campaign.create(c),snap=session.snapshot(),before=session.save(), t=Threat.create(c);
const args={state:snap.state,cursor:snap.cursor,owner:'soviet',hex:edge.a};
const second=units.find(u=>u.owner==='soviet'&&u.id!==attacker.id&&u.class!=='infantry'&&u.strengthStatus!=='untried')||units.find(u=>u.owner==='soviet'&&u.id!==attacker.id&&u.class!=='infantry');
A.ok(second);n++;
const stack={...snap.state,units:{...snap.state.units,[second.id]:{...second,hex:edge.a}}};
const input={...args,state:stack};const copy=JSON.stringify(stack);
const report=t.coordinatedWithdrawal(input);eq(report.jointEscape,true);eq(report.best.escaped.length,2);eq(report.best.moves.length,2);eq(report.survivalRisk,null);
let current=stack.units;const binding=Binding.build(map,profile),phase={kind:'movement',owner:'soviet'};
for(const m of report.best.moves){eq(Binding.move(binding,phase,current,3,{unitId:m.unitId,path:m.path,mode:m.mode},stack.territory).ok,true);current={...current,[m.unitId]:{...current[m.unitId],hex:m.destination}};}
eq(new Set(report.best.moves.map(m=>m.unitId)).size,2);eq(JSON.stringify(stack),copy);
const capped=t.coordinatedWithdrawal({...input,maxNodes:1});eq(capped.truncated,true);eq(capped.jointEscape,null);
const neighbors=board.edges.filter(e=>(e.a===edge.a||e.b===edge.a)&&e.verified&&!e.impassable&&!e.lake&&!e.allSea).map(e=>e.a===edge.a?e.b:e.a);
const enemies=units.filter(u=>u.owner==='german').slice(0,neighbors.length);
const blocked={...stack,units:Object.fromEntries([{...attacker,hex:edge.a},{...second,hex:edge.a},...enemies.map((u,i)=>({...u,hex:neighbors[i]}))].map(u=>[u.id,u]))};
const b=t.coordinatedWithdrawal({...input,state:blocked});eq(b.jointEscape,false);eq(b.truncated,false);eq(b.best.escaped.length,0);
const end=t.coordinatedWithdrawal({...input,cursor:{...snap.cursor,turn:7,index:config.phases.findIndex(p=>p.id==='soviet-movement')}});eq(end.opportunity,null);eq(end.jointEscape,null);
// Both units independently see the same last stacking slot; only one can use it.
const openNeighbors=neighbors.filter(id=>board.cells[id].terrain==='open'&&board.edges.some(e=>((e.a===edge.a&&e.b===id)||(e.b===edge.a&&e.a===id))&&!e.river&&!e.majorRiver));
A.ok(openNeighbors.length);n++;
const dest=openNeighbors[0];
const fillers=neighbors.flatMap((id,i)=>Array.from({length:id===dest?1:2},(_,j)=>({...second,id:`fixture-${i}-${j}`,hex:id,strengthStatus:'full'})));
const contested={...stack,units:Object.fromEntries([{...attacker,hex:edge.a,mp:1},{...second,hex:edge.a,mp:1,strengthStatus:'full'},...fillers].map(u=>[u.id,u]))};
const independent=t.withdrawal({...input,state:contested});
for(const u of independent.units)eq(u.routes.map(r=>r.destination),[dest]);
const joint=t.coordinatedWithdrawal({...input,state:contested});eq(joint.jointEscape,false);eq(joint.best.escaped.length,1);eq(joint.truncated,false);
const opts=Catalog.discover({session,context:c,enumerateCombinedPlans:false});
const diag=Auto.screenBattles({snapshot:snap,context:c,proposals:opts.proposals,utilityPilot:true,coordinatedWithdrawalDiagnostics:true});eq(diag.threats[0].coordinatedWithdrawal,t.coordinatedWithdrawal(args));eq(session.save(),before);
console.log('PASS coordinated withdrawal',n,'assertions');
const battle={defenderHex:edge.b,attackers:[attacker.id]};
for(const variant of ['standard','advanced']){
 const th=Threat.create({...c,combatPolicy:{...combatPolicy,crtVariant:variant}});
 const r=th.compareContinuations({...args,battle});
 eq(r.recommendation,null);eq(r.eliminationRisk,null);eq(r.inaction.surviving,[attacker.id]);
 eq(r.withdrawal.search.jointEscape,true);eq(r.withdrawal.exposure.removed,0);
 eq(r.withdrawal.exposure.positions[0].hex,r.withdrawal.search.best.moves[0].destination);
 if(variant==='standard')eq(r.attack.status,'automatic-NE');
 else {eq(r.attack.status,'conditional-witnesses');eq(r.attack.odds,0.5);eq(r.attack.report.rolls.length,6);
  eq(new Set(r.attack.witnesses.map(w=>w.die)).size,6);
  for(const w of r.attack.witnesses){eq(w.exposure.removed,w.attackingUnitsRemoved);if(w.attackingUnitsRemoved)eq(w.exposure.positions,[]);}
  const capped=th.compareContinuations({...args,battle,maxTrials:1});eq(capped.attack.report.truncated,true);eq(capped.recommendation,null);
 }
 eq(session.save(),before);
}
console.log('PASS continuation comparison',n,'assertions including original withdrawal fixture');
const start=n;
const th=Threat.create({...c,combatPolicy:{...combatPolicy,crtVariant:'advanced'}});
const responseArgs={...args,battle,enemyResponse:true,maxResponseEvaluations:3,responseMaxNodes:3,responseMaxRouteSearches:4,responseMaxTrials:12};
const rr=th.compareContinuations(responseArgs);
eq(rr.recommendation,null);eq(rr.eliminationRisk,null);eq(rr.responseBudget.evaluations,3);A.ok(rr.responseBudget.skipped>0);n++;
const direct=th.forecastSurvival({...args,maxNodes:3,maxRouteSearches:4,maxTrials:12});
eq(rr.inaction.positions[0].response,{status:'conditional-forecast',...direct});
const records=[rr.inaction,rr.withdrawal.exposure,...rr.attack.witnesses.map(w=>w.exposure)].filter(Boolean).flatMap(e=>e.positions.map(p=>p.response));
eq(records.filter(r=>r.status==='conditional-forecast').length,3);eq(records.filter(r=>r.status==='budget-exhausted').length,rr.responseBudget.skipped);
for(const r of records)eq(r.eliminationRisk,null);
eq(session.save(),before);
A.throws(()=>th.compareContinuations({...responseArgs,maxResponseEvaluations:0}),/Invalid continuation response budget/);n++;
console.log('PASS enemy response continuation',n-start,'additional assertions');
const prior=n;
const combo=th.compareContinuations({...args,battle,combinedWithdrawal:true});
eq(combo.recommendation,null);eq(combo.attack.report.rolls.length,6);
let moved=0, dead=0;
for(const w of combo.attack.witnesses){
 if(w.exposure.surviving.length===0){eq(w.combined.status,'no-survivors');eq(w.combined.exposure,null);dead++;continue;}
 eq(w.combined.search.opportunity.phase,'soviet-movement');
 if(w.combined.exposure){eq(w.combined.exposure.surviving,w.exposure.surviving);eq(w.combined.exposure.positions[0].hex,w.combined.search.best.moves[0].destination);moved++;}
}
A.ok(moved>0);n++;A.ok(dead>0);n++;
eq(session.save(),before);
console.log('PASS combined withdrawal',n-prior,'additional assertions');
const baseN=n;
const scored=th.compareContinuations({...args,battle,combinedWithdrawal:true,positionUtility:true});
eq(scored.inaction.material,{friendlyLost:0,enemyLost:0,net:0});
eq(scored.utility.decision,null);
for(const w of scored.attack.witnesses){
 A.ok(w.exposure.material.friendlyLost>=w.attackingUnitsRemoved);n++;
 A.ok(w.exposure.material.enemyLost>=w.enemyRemoved);n++;
}
const S=Threat.scoreContinuations;
const e=(net,odds=0,unknownPlans=0)=>({material:{net},positions:[{units:['u'],threat:{unknownPlans,strongest:{odds}}}]});
const fixture={inaction:e(0,6),withdrawal:{exposure:e(0,0)},attack:{status:'conditional-witnesses',report:{rolls:Array.from({length:6},(_,i)=>({die:i+1,complete:true}))},witnesses:Array.from({length:6},(_,i)=>({die:i+1,exposure:e(1,0)}))}};
eq(S(fixture).hold,-1);eq(S(fixture).withdraw,0);eq(S(fixture).attack,1);eq(S(fixture).delta,1);eq(S(fixture).decision,null);
fixture.attack.witnesses.push({die:1,exposure:e(-2,0)});eq(S(fixture).attack,0.5);
fixture.attack.report.rolls[0].complete=false;eq(S(fixture).attack,null);
fixture.attack.report.rolls[0].complete=true;fixture.inaction=e(0,0,1);eq(S(fixture).attack,null);
eq(session.save(),before);
console.log('PASS position utility',n-baseN,'additional assertions');
fixture.inaction=e(0,6);fixture.withdrawal.exposure=e(0,0,1);eq(S(fixture).delta,null);
const standard=Threat.create({...c,combatPolicy:{...combatPolicy,crtVariant:'standard'}}).compareContinuations({...args,battle,positionUtility:true});
eq(standard.attack.status,'automatic-NE');eq(standard.utility.attack,null);
console.log('PASS additional unknown/automatic-NE guards',3,'assertions');
const forecastStart=n;
const f=(net,stationary,approach,extra={})=>({material:{net},positions:[{units:['u'],threat:{unknownPlans:0,strongest:{odds:stationary}},response:{status:'conditional-forecast',forecast:{strongest:{odds:approach},...extra}}}]});
const ff={inaction:f(0,1,6),withdrawal:{exposure:f(0,0,3)},attack:{status:'conditional-witnesses',report:{rolls:Array.from({length:6},(_,i)=>({die:i+1,complete:true}))},witnesses:Array.from({length:6},(_,i)=>({die:i+1,exposure:f(0,0,0)}))}};
const scoreForecast=r=>S(r,{forecastPressure:true});
eq(scoreForecast(ff).hold,-1);eq(scoreForecast(ff).withdraw,-0.5);eq(scoreForecast(ff).attack,0);eq(scoreForecast(ff).delta,0.5);eq(scoreForecast(ff).decision,null);
eq(S(ff).hold,-1/6);eq(S(ff).withdraw,0);
for(const key of ['truncated','concealedMovementOmitted','concealedCombatOmitted','fleetReactionOmitted']){
 ff.withdrawal.exposure=f(0,0,0,{[key]:true});eq(scoreForecast(ff).withdraw,null);eq(scoreForecast(ff).attack,null);
}
ff.withdrawal.exposure=f(0,0,3);ff.attack.witnesses[0].exposure.positions[0].response={status:'budget-exhausted'};eq(scoreForecast(ff).attack,null);
ff.attack.witnesses[0].exposure=f(0,0,0);ff.attack.witnesses[0].combined={exposure:f(0,0,0,{truncated:true})};eq(scoreForecast(ff).attack,null);
const limited=th.compareContinuations({...responseArgs,positionUtility:true,combinedWithdrawal:true,maxResponseEvaluations:1});
eq(limited.utility.scope,'sampled-material-and-bounded-forecast-pressure-utility');eq(limited.utility.attack,null);eq(limited.utility.decision,null);eq(session.save(),before);
console.log('PASS forecast utility',n-forecastStart,'additional assertions');
