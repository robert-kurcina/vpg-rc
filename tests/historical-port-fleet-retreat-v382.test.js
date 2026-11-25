'use strict';
/* Checkpoint 148: Leningrad §10.6/§13.2 optional port Fleet retreat
 * exemption under explicitly supplied, photographed support marker state.
 * No claim that the Fleet movement/damage or whole game is implemented. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Bridge=require('../core/scenario_opening_bridge'),Combat=require('../core/historical_combat_phase');
const Port=require('../core/historical_port_support'),Geo=require('../core/historical_combat_geography');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory'),fixture=require('./fixtures/leningrad-source-setup-v357');
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const yes=(a,msg)=>{assert.ok(a,msg);checks++};
const bad=(f,re)=>{assert.throws(f,re);checks++};
const baseline=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,allocation:fixture.selected,
 placements:fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:ctx=>Combat.create({...ctx,counterConfig:K,combatPolicy:Q})}}).snapshot();
const sources=Object.values(baseline.state.units),soviet=sources.find(u=>u.owner==='soviet'&&u.size==='army'&&u.printedCombatStrength===8);
const used=new Set();const german=[12,10,8,8].map(strength=>{const u=sources.find(u=>u.owner==='german'&&u.printedCombatStrength===strength&&!used.has(u.id));if(u)used.add(u.id);return u;});
yes(soviet&&german.every(Boolean)&&new Set(german.map(u=>u.id)).size===4);
const riga='0707',approaches=['0607','0608','0807','0808'];
function marker(hex=riga,condition='undamaged'){return {hex,condition,owner:'soviet',
 sourceFaceId:Q.portSupport.sourceFaceId,reverseFaceId:Q.portSupport.reverseFaceId};}
function state(condition='undamaged'){
 const units={}; for(let i=0;i<german.length;i++)units[german[i].id]={...copy(german[i]),hex:approaches[i]};
 units[soviet.id]={...copy(soviet),hex:riga};
 return {scenarioId:'leningrad',units,supportMarkers:{balticFleet:marker(riga,condition)}};
}
const battle={defenderHex:riga,attackers:german.map(u=>u.id)};
function selected(st,policy=Q){return Combat.create({map:M,profile:P,config:F,cursor:baseline.cursor,actor:'german',
 state:st,counterConfig:K,combatPolicy:policy}).commit([battle]).select(riga);}
const port=Port.create({map:M,policy:Q,counterConfig:K});
eq(Object.keys(port.portHexes).sort(),Q.portSupport.portNames.slice().sort());
eq(port.portHexes.Riga,riga);
const sense=port.inspect({state:state(),battle:{...battle,defenders:[soviet.id]},actor:'german'});
eq(sense.fleetShift,-1);eq(sense.ignoreRetreatEligible,true);eq(sense.condition,'undamaged');
const p=selected(state()); const before=p.snapshot();
const explicitStrengths=Object.fromEntries([...german,soviet].map(u=>[u.id,{kind:u.class,value:u.printedCombatStrength}]));
const oddsPreview=p.evaluateSelectedFromMap({strengths:explicitStrengths,die:1});
eq(oddsPreview.finalOdds,3);eq(oddsPreview.navalSupport.fleetShift,-1);
bad(()=>p.evaluateSelectedFromMap({strengths:explicitStrengths,fleetShift:0,die:1}),/source-bound/);
// Four source-faced attackers have 38 points vs 8, for raw 4:1; undamaged
// Fleet reduces the final odds to 3:1. DR die 1 may be ignored.
const dr=p.resolveSelected({die:1,choices:{ignoreRetreat:true}});
eq(dr.event.outcome,'DR');eq(dr.event.odds,3);eq(dr.event.ignoredRetreat,true);
eq(dr.event.navalSupport.fleetShift,-1);eq(dr.event.retreats,[]);eq(dr.event.losses,[]);
eq(dr.session.snapshot().state.units[soviet.id].hex,riga);eq(dr.session.snapshot().state.supportMarkers.balticFleet.condition,'undamaged');
eq(dr.session.undo().session.snapshot(),{...before,historyDepth:0});eq(p.snapshot(),before);
// DRL loss resolves BEFORE the optional retreat decision; the reduced Army
// still occupies the city after electing not to retreat.
const drl=selected(state()).resolveSelected({die:6,choices:{defenderLossId:soviet.id,ignoreRetreat:true}});
eq(drl.event.outcome,'DRL');eq(drl.event.losses.length,1);eq(drl.event.losses[0].removed,false);
eq(drl.session.snapshot().state.units[soviet.id].strengthStatus,'printed-reduced');
eq(drl.session.snapshot().state.units[soviet.id].hex,riga);
// Exchange loss and matching attacking loss remain mandatory; ignore-retreat
// only suppresses the subsequent retreat part.
const exchange=selected(state()).resolveSelected({die:4,choices:{defenderLossId:soviet.id,
 attackerLossIds:[german[2].id],ignoreRetreat:true}});
eq(exchange.event.outcome,'EX');eq(exchange.event.losses.length,2);
eq(exchange.session.snapshot().state.units[soviet.id].strengthStatus,'printed-reduced');
eq(exchange.session.snapshot().state.units[soviet.id].hex,riga);
eq(exchange.session.undo().session.snapshot(),{...selected(state()).snapshot(),historyDepth:0});
// Damaged Fleet has NO odds shift yet still permits ignored retreat.
const damagedPreview=selected(state('damaged')).evaluateSelectedFromMap({strengths:explicitStrengths,die:1});
eq(damagedPreview.finalOdds,4);eq(damagedPreview.navalSupport.condition,'damaged');
const damaged=selected(state('damaged')).resolveSelected({die:1,choices:{ignoreRetreat:true}});
eq(damaged.event.odds,4);eq(damaged.event.navalSupport.fleetShift,0);
eq(damaged.event.navalSupport.condition,'damaged');eq(damaged.event.ignoredRetreat,true);
// Without an explicitly bound marker, a fabricated ignore flag must fail.
const absent=state();delete absent.supportMarkers;
bad(()=>selected(absent).resolveSelected({die:1,choices:{ignoreRetreat:true}}),/Fleet ignore-retreat/);
const elsewhere=state();elsewhere.supportMarkers.balticFleet.hex='0804';
bad(()=>selected(elsewhere).resolveSelected({die:1,choices:{ignoreRetreat:true}}),/Fleet ignore-retreat/);
const bogus=state();bogus.supportMarkers.balticFleet.sourceFaceId='invented';
bad(()=>selected(bogus).resolveSelected({die:1,choices:{ignoreRetreat:true}}),/Invalid or uncertified Fleet/);
const badDamage=state();badDamage.supportMarkers.balticFleet.condition='destroyed';
bad(()=>selected(badDamage).resolveSelected({die:1,choices:{ignoreRetreat:true}}),/Invalid or uncertified Fleet/);
const extra=state();extra.supportMarkers.balticFleet.unauthorized=true;
bad(()=>selected(extra).resolveSelected({die:1,choices:{ignoreRetreat:true}}),/Invalid or uncertified Fleet/);
// A retreat exemption does not revive a defender eliminated by a compulsory
// DRL step loss. At capped 6:1 shifted to 5:1, die 2 is DRL.
const oneStep=sources.find(u=>u.owner==='soviet'&&u.printedCombatStrength===3);
const killed=state();delete killed.units[soviet.id];killed.units[oneStep.id]={...copy(oneStep),hex:riga};
bad(()=>selected(killed).resolveSelected({die:2,choices:{defenderLossId:oneStep.id,ignoreRetreat:true}}),/Fleet ignore-retreat/);
const beforeOther=selected(state());
bad(()=>beforeOther.resolveSelected({die:1,choices:{ignoreRetreat:true,retreatPaths:{}}}),/Fleet ignore-retreat/);
bad(()=>beforeOther.resolveSelected({die:1,choices:{ignoreRetreat:true,advanceUnitId:german[0].id}}),/cannot advance/);
bad(()=>beforeOther.resolveSelected({die:1,choices:{ignoreRetreat:false}}),/Fleet ignore-retreat/);
// A German attack at a different port does not earn this defensive Fleet shift.
const noFleet={...state(),supportMarkers:{}};
eq(port.inspect({state:noFleet,battle:{...battle,defenders:[soviet.id]},actor:'german'}).fleetShift,0);
// Ordinary source-marked cities are unshifted. The one registered major city
// is distinct and retains the -1 terrain column under explicit source typing.
const ordinary=Geo.create(M,P,{cityMarkerMode:'source-typed-v1'}).evaluate({defenderHex:riga,attackers:[german[0].id]},
 {[german[0].id]:state().units[german[0].id]});
eq(ordinary.defenderTerrain,'open');
const major=Geo.create(M,P,{cityMarkerMode:'source-typed-v1'}).evaluate({defenderHex:'1701',attackers:['attacker']},
 {attacker:{id:'attacker',owner:'german',hex:'1602'}});
eq(major.defenderTerrain,'major-city');
bad(()=>Geo.create(M,P).evaluate({defenderHex:riga,attackers:[german[0].id]},
 {[german[0].id]:state().units[german[0].id]}),/major-city/);
// Multiple origin ports for Soviet Fleet naval support remains uncertified;
// no new Fleet movement or damage-roll contract is asserted.
// Source §13.2 grants +1 to an undamaged Fleet-supported Soviet attack
// originating wholly from its occupied port; this is a pure eligibility/odds
// binding, not a fabricated Soviet turn or Fleet movement action.
const sovietAttack={defenderHex:approaches[0],attackers:[soviet.id],defenders:[german[0].id]};
const supportedAttack=port.inspect({state:state(),battle:sovietAttack,actor:'soviet'});
eq(supportedAttack.fleetShift,1);eq(supportedAttack.ignoreRetreatEligible,false);
eq(port.inspect({state:state('damaged'),battle:sovietAttack,actor:'soviet'}).fleetShift,0);
const emptyPort=state();delete emptyPort.units[soviet.id];
eq(port.inspect({state:emptyPort,battle:{defenderHex:riga,defenders:[german[0].id],attackers:[german[1].id]},actor:'german'}).fleetShift,0);
const fromPort=state();fromPort.units[german[0].id].hex=riga;
bad(()=>port.inspect({state:fromPort,battle:{defenderHex:'0607',attackers:german.map(u=>u.id),defenders:[soviet.id]},actor:'soviet'}),/Mixed-origin/);
const code=fs.readFileSync('core/historical_port_support.js','utf8');
yes(!/\b(?:leningrad|moscow|kiev|arduous)\b/i.test(code),'shared port support has no scenario-specific renderer or code');
const evidence={checkpoint:148,version:'v382',scope:'opt-in photographed Fleet marker and DR/DRL/EX optional no-retreat',
 sourcePdf:'references/rules/leningrad-rules.pdf §§10.4, 10.6, 13.1–13.3',
 sourcePdfSha256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/leningrad-rules.pdf')).digest('hex'),
 assertions:checks,ports:port.portHexes,sourceFront:Q.portSupport.sourceFaceId,sourceBack:Q.portSupport.reverseFaceId,
 verified:['undamaged Fleet defensive odds shift and map preview parity','pure source-bound Soviet attack shift from occupied Fleet port','damaged Fleet no shift and still eligible','DR/DRL/EX source-faced outcomes and Undo',
  'declined retreat leaves Soviet ground in port and prohibits attacker advance',
  'explicit marker validation and absent/mismatched/invalid marker rejection','typed ordinary and major city geography'],
 limitations:['Marker is externally supplied in test state, not initialized in gameplay setup',
  'Fleet movement, damage checks, air-sea attacks and mixed-origin offensive Fleet support not certified',
  'Full naval support and human post-combat choice UX not certified',
  'Order-dependent joint overstack extensions, rear hex numbering, 8-turn play not certified']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-fleet-port-retreat-v382.json',JSON.stringify(evidence,null,2)+'\n');
console.log('PASS v382:',checks,'source-bound Fleet/port retreat tests');
