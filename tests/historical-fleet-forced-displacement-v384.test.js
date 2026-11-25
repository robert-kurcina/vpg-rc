'use strict';
/* Checkpoint 150: §13.2 Fleet compulsory displacement, shared reaction on
 * source-legal ground movement and combat advance. No fabricated UI/turns. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Port=require('../core/historical_port_support'),Combat=require('../core/historical_combat_phase');
const H=require('../core/historical_movement_actions'),Bridge=require('../core/scenario_opening_bridge');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory'),fixture=require('./fixtures/leningrad-source-setup-v357');
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const yes=(a,m)=>{assert.ok(a,m);checks++};
const bad=(f,re)=>{assert.throws(f,re);checks++};
const origin=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,allocation:fixture.selected,
 placements:fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:()=>({snapshot:()=>({})})},supportPolicy:Q}).snapshot();
const port=Port.create({map:M,policy:Q,counterConfig:K});
const ports=port.portHexes,key=port.markerKey;
const all=Object.values(origin.state.units),german=all.filter(u=>u.owner==='german');
const strengths=[12,10,8,8],used=new Set(),attackers=strengths.map(v=>{
 const u=german.find(x=>x.printedCombatStrength===v&&!used.has(x.id));if(u)used.add(u.id);return u;
});
yes(attackers.every(Boolean));eq(new Set(attackers.map(x=>x.id)).size,4);
const others=german.filter(u=>!used.has(u.id));eq(others.length,5);
const defender=all.find(u=>u.owner==='soviet'&&u.printedCombatStrength===3);yes(defender);
const approaches=['0607','0608','0807','0808'];
const marker=(hex=ports.Riga,condition='undamaged')=>({hex,condition,owner:'soviet',
 sourceFaceId:Q.portSupport.sourceFaceId,reverseFaceId:Q.portSupport.reverseFaceId});
const snapshot=()=>({scenarioId:'leningrad',units:{},supportMarkers:{[key]:marker()}});
function battleState(condition='undamaged',fill=false){
 const s=snapshot();s.supportMarkers[key].condition=condition;
 attackers.forEach((u,i)=>s.units[u.id]={...copy(u),hex:approaches[i]});
 s.units[defender.id]={...copy(defender),hex:ports.Riga};
 if(fill)Object.entries(ports).filter(([name])=>name!=='Riga').forEach(([name,hex],i)=>s.units[others[i].id]={...copy(others[i]),hex});
 return s;
}
const battle={defenderHex:ports.Riga,attackers:attackers.map(x=>x.id)};
const selected=s=>Combat.create({map:M,profile:P,config:F,cursor:origin.cursor,
 actor:'german',state:s,counterConfig:K,combatPolicy:Q}).commit([battle]).select(ports.Riga);
const movePilot=H.create({map:M,profile:P,config:F,supportPolicy:Q,counterConfig:K});
const moveSession=s=>({cursor:{scenarioId:'leningrad',turn:2,index:1,complete:false},actor:'german',state:s});
const groundState=(from='0607',condition='undamaged',filled=false)=>{
 const s=snapshot();s.supportMarkers[key].condition=condition;s.units[attackers[0].id]={...copy(attackers[0]),hex:from};
 if(filled)Object.entries(ports).filter(([name])=>name!=='Riga').forEach(([name,hex],i)=>s.units[others[i].id]={...copy(others[i]),hex});
 return s;
};
const groundReq=from=>({unitId:attackers[0].id,path:[from,ports.Riga]});
// Pure reaction: all 6 source departure thresholds x 6 die faces x 2 Fleet
// conditions, and no mutation even when a second hit destroys the marker.
for(const [fromName,fromHex] of Object.entries(ports)){
 for(const condition of ['undamaged','damaged'])for(let die=1;die<=6;die++){
  const before=snapshot(),after=snapshot();before.supportMarkers[key]=marker(fromHex,condition);
  after.supportMarkers[key]=marker(fromHex,condition);
  const leaving=attackers[0];const available=Object.entries(ports).find(([name])=>name!==fromName);
  before.units[leaving.id]={...copy(leaving),hex:'0607'};
  // Special case when the Fleet port equals the attacker's starting hex:
  // choose an actual different start, as required by the reaction contract.
  if(before.units[leaving.id].hex===fromHex)before.units[leaving.id].hex='0608';
  after.units[leaving.id]={...copy(before.units[leaving.id]),hex:fromHex};
  const frozen=copy(before),afterFrozen=copy(after);
  const result=port.forcedEntry({before,after,actor:'german',enteredUnitId:leaving.id,
   choice:{to:available[1],die}});
  const hit=die<=Q.portSupport.damageOnDeparture[fromName],removed=hit&&condition==='damaged';
  eq(result.event.fromPort,fromName);eq(result.event.toPort,available[0]);
  eq(result.event.damageThreshold,Q.portSupport.damageOnDeparture[fromName]);
  eq(result.event.hit,hit);eq(result.event.die,die);
  eq(result.event.resultCondition,removed?'eliminated':hit?'damaged':condition);
  eq(result.state.supportMarkers[key]?.hex,removed?undefined:available[1]);
  eq(result.state.supportMarkers[key]?.condition,removed?undefined:hit?'damaged':condition);
  eq(before,frozen,'reaction must not mutate original state');eq(after,afterFrozen);
 }
}
// Real battle: 38:3 reaches capped 6:1, undamaged Fleet lowers to 5:1.
// DE on die 5 kills the lone one-step defender; German advance triggers §13.2.
const source=battleState(),saved=copy(source),choice={to:ports.Leningrad,die:1};
const pending=selected(source);
eq(pending.evaluateSelectedFromMap({strengths:Object.fromEntries([...attackers,defender].map(u=>[u.id,
 {kind:u.class,value:u.printedCombatStrength}])),die:5}).finalOdds,5);
bad(()=>pending.resolveSelected({die:5,choices:{advanceUnitId:attackers[0].id}}),/Forced Fleet displacement/);
bad(()=>pending.resolveSelected({die:5,choices:{fleetDisplacement:choice}}),/Unsupported result-dependent choice|requires verified enemy entry/);
bad(()=>pending.resolveSelected({die:5,choices:{advanceUnitId:attackers[0].id,fleetDisplacement:{to:ports.Riga,die:1}}}),/different available port/);
bad(()=>pending.resolveSelected({die:5,choices:{advanceUnitId:attackers[0].id,fleetDisplacement:{to:ports.Leningrad,die:7}}}),/six-sided/);
bad(()=>pending.resolveSelected({die:5,choices:{advanceUnitId:attackers[0].id,fleetDisplacement:{to:ports.Leningrad,die:1,extra:true}}}),/different available port/);
const committed=pending.resolveSelected({die:5,choices:{advanceUnitId:attackers[0].id,fleetDisplacement:choice}});
eq(committed.event.outcome,'DE');eq(committed.event.advanced,attackers[0].id);
eq(committed.event.fleetDisplacement.reason,'enemy-entered-fleet-port');
eq(committed.event.fleetDisplacement.die,1);eq(committed.event.fleetDisplacement.damageThreshold,3);
eq(committed.session.snapshot().state.supportMarkers[key].hex,ports.Leningrad);
eq(committed.session.snapshot().state.supportMarkers[key].condition,'damaged');
eq(committed.session.snapshot().state.units[attackers[0].id].hex,ports.Riga);
eq(committed.session.snapshot().state.units[defender.id],undefined);
eq(committed.session.undo().session.snapshot(),{...pending.snapshot(),historyDepth:0});
eq(source,saved);eq(pending.snapshot().state,saved);
eq(pending.resolveSelected({die:5,choices:{advanceUnitId:attackers[0].id,fleetDisplacement:choice}}).event,committed.event);
const noAdvance=pending.resolveSelected({die:5});eq(noAdvance.event.fleetDisplacement,null);
eq(noAdvance.session.snapshot().state.supportMarkers[key].hex,ports.Riga);
// Already-damaged Fleet takes a second hit and is eliminated.
const second=selected(battleState('damaged')).resolveSelected({die:5,
 choices:{advanceUnitId:attackers[0].id,fleetDisplacement:choice}});
eq(second.event.fleetDisplacement.resultCondition,'eliminated');eq(second.session.snapshot().state.supportMarkers[key],undefined);
// All five alternative ports German-occupied: forced elimination without die.
const blockedBattle=selected(battleState('undamaged',true));
const none=blockedBattle.resolveSelected({die:5,choices:{advanceUnitId:attackers[0].id}});
eq(none.event.fleetDisplacement.reason,'no-available-port');eq(none.event.fleetDisplacement.die,null);
eq(none.session.snapshot().state.supportMarkers[key],undefined);
bad(()=>blockedBattle.resolveSelected({die:5,choices:{advanceUnitId:attackers[0].id,fleetDisplacement:choice}}),/automatic elimination/);
// Ground movement uses the SAME source-bound forced-reaction path.
const walking=groundState(),walkBefore=copy(walking),req=groundReq('0607');
yes(movePilot.legal(moveSession(walking),req));
bad(()=>movePilot.execute(moveSession(walking),req),/Forced Fleet displacement/);
const moved=movePilot.execute(moveSession(walking),{...req,fleetDisplacement:{to:ports.Narva,die:2}});
eq(moved.ok,true);eq(moved.state.units[attackers[0].id].hex,ports.Riga);
eq(moved.result.fleetDisplacement.reason,'enemy-entered-fleet-port');
eq(moved.state.supportMarkers[key].hex,ports.Narva);eq(moved.state.supportMarkers[key].condition,'damaged');
eq(walking,walkBefore,'source movement state not mutated');
const walkedAway=movePilot.execute(moveSession(groundState('0607','damaged',true)),req);
eq(walkedAway.state.supportMarkers[key],undefined);eq(walkedAway.result.fleetDisplacement.reason,'no-available-port');
const occupied=groundState();occupied.units[defender.id]={...copy(defender),hex:ports.Riga};
eq(movePilot.legal(moveSession(occupied),req),false);
eq(movePilot.execute(moveSession(occupied),{...req,fleetDisplacement:choice}).ok,false);
const moveNoMarker=groundState();delete moveNoMarker.supportMarkers;
eq(movePilot.execute(moveSession(moveNoMarker),req).state.units[attackers[0].id].hex,ports.Riga);
bad(()=>movePilot.execute(moveSession(moveNoMarker),{...req,fleetDisplacement:choice}),/without an active Fleet/);
// Forged displacement cannot be submitted on a normal non-port movement.
const elsewhere=groundState('0608'),elseReq={unitId:attackers[0].id,path:['0608','0607']};
yes(movePilot.legal(moveSession(elsewhere),elseReq));
bad(()=>movePilot.execute(moveSession(elsewhere),{...elseReq,fleetDisplacement:choice}),/requires verified enemy entry/);
const sourceText=fs.readFileSync('core/historical_port_support.js','utf8')+fs.readFileSync('core/historical_movement_actions.js','utf8')+fs.readFileSync('core/historical_combat_consequences.js','utf8');
yes(!/if\s*\([^)]*scenarioId\s*===\s*['"]leningrad['"]/.test(sourceText),'no hardcoded scenario branch');
const audit={checkpoint:150,version:'v384',assertions:checks,
 sourcePdf:'references/rules/leningrad-rules.pdf §§13.1–13.2',
 sourcePdfSha256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/leningrad-rules.pdf')).digest('hex'),
 status:'opt-in historical transaction pilot, not eight-turn campaign',
 checks:['six departure ports x six dice x two Fleet conditions, with immutable state',
  'actual DE combat result with mandatory German advance and Fleet displacement',
  'combat Undo and deterministic replay',
  'actual source-legal German movement enters Fleet port and forces displacement',
  'elimination if all other ports are German-occupied; no fictitious damage roll',
  'second hit eliminates damaged Fleet, no-port and forged choice rejection'],
 limitations:['Combat advance and ground movement bind to one common reaction; the human phase controller and save schema are not yet extended to represent reaction selections',
  'Fleet forced displacement cannot be source-certified against independent historical executable',
  'German air-sea attacks, support commitment and full eight-turn play remain unsupported',
  'Printed rear marker discrepancies and multi-defender retreat order remain unresolved']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-fleet-forced-displacement-v384.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v384:',checks,'source-bound Fleet compulsory-displacement assertions');
