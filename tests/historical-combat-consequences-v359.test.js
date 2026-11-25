'use strict';
/* Source-bound, isolated Leningrad opening fixture -> generic combat pipeline.
 * These tests deliberately do NOT assert eight-turn playability or a UI.
 */
const A=require('node:assert/strict'),fs=require('node:fs');
const Bridge=require('../core/scenario_opening_bridge');
const Combat=require('../core/historical_combat_phase');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const spec=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory');
const fixture=require('./fixtures/leningrad-source-setup-v357');
const clone=x=>JSON.parse(JSON.stringify(x));
let assertions=0;
const eq=(x,y,msg)=>{A.deepEqual(x,y,msg);assertions++};
const ok=(x,msg)=>{A.ok(x,msg);assertions++};
const bad=(f,re)=>{A.throws(f,re);assertions++};
const args={map:M,setupSpec:spec,counterConfig:K,inventory:I,allocation:fixture.selected,placements:fixture.placements,
 phaseConfig:F,movementProfile:P,phaseFactories:{combat:ctx=>Combat.create({...ctx,counterConfig:K,combatPolicy:Q})}};
const baseline=Bridge.create(args),opening=baseline.snapshot(),units=Object.values(opening.state.units);
const source=fs.readFileSync('core/historical_combat_consequences.js','utf8');
ok(!/\bleningrad\b|\bmoscow\b|\bkiev\b|\barduous\b/i.test(source),'effect engine must not be scenario-specific');
const from=(hex,role,value)=>{
 const unit=units.find(u=>u.hex===hex&&u.owner===role&&u.printedCombatStrength===value);
 ok(unit,`Missing source unit ${hex}/${role}/${value}`);
 return unit.id;
};
const attacker8=from('0310','german',8),west8=from('0210','german',8);
const soviet3=from('0309','soviet',3),tank10=from('0511','german',10),tank12=from('0411','german',12);
const army8=from('0611','soviet',8),sovietMech=units.find(u=>u.owner==='soviet'&&u.hex==='0410');
ok(sovietMech&&sovietMech.strengthStatus==='untried');
function phase(battles){return baseline.controller().commit(battles).select(battles[0].defenderHex);}
const small=[{defenderHex:'0309',attackers:[attacker8]}];
const large=[{defenderHex:'0309',attackers:[west8,attacker8]}];
const original=clone(opening);
// Declaring all battles locks participants; there is no RNG until the injected die.
const before=phase(large),saved=before.snapshot();
bad(()=>before.resolveSelected({die:7}),/Invalid committed combat transaction/);
bad(()=>before.resolveSelected({die:6,support:{air:1}}),/Unbound support/);
bad(()=>before.resolveSelected({die:6,choices:{attackerLossId:west8}}),/Unsupported result-dependent choice/);
bad(()=>before.resolveSelected({die:6,choices:{advanceUnitId:attacker8,retreatPaths:{}}}),/Unsupported result-dependent choice/);
eq(before.snapshot(),saved,'rejected requests do not alter the controller');
// DE, opt-in immediate advance, and two separate reversals (phase, combat).
const eliminated=before.resolveSelected({die:6,choices:{advanceUnitId:west8}});
eq(eliminated.event.outcome,'DE');eq(eliminated.event.odds,5);
eq(eliminated.session.snapshot().state.units[soviet3],undefined);
eq(eliminated.session.snapshot().state.units[west8].hex,'0309');
eq(before.snapshot(),saved,'committed controller remains immutable');
const done=eliminated.session.finish();
eq(done.ok,true);eq(done.session.snapshot().cursor.index,3);
eq(done.nextPhase,'german-special-movement');
eq(done.session.undo().session.snapshot(),eliminated.session.snapshot());
const reverse=eliminated.session.undo().session;
eq(reverse.snapshot(),{...saved,historyDepth:0});
const redo=reverse.resolveSelected({die:6,choices:{advanceUnitId:west8}});
eq(redo.event,eliminated.event,'same source and die gives same effect');
eq(baseline.snapshot(),original,'source setup never mutates');
// NE: a real no-effect roll, without a hidden new counter-strength value.
const noEffect=phase(small).resolveSelected({die:5});
eq(noEffect.event.outcome,'NE');eq(noEffect.session.snapshot().state,opening.state);
bad(()=>phase(small).resolveSelected({die:5,choices:{advanceUnitId:attacker8}}),/Unsupported result-dependent choice/);
// EX: the one-step defender loses 3 defense points; a full 8-strength German
// Corps must lose at least 3 attack points, reducing 8 -> 4 (loss of 4).
const ex=phase(small).resolveSelected({die:4,choices:{attackerLossIds:[attacker8],advanceUnitId:attacker8}});
eq(ex.event.outcome,'EX');eq(ex.event.losses.length,2);
eq(ex.session.snapshot().state.units[soviet3],undefined);
eq(ex.session.snapshot().state.units[attacker8].printedCombatStrength,4);
eq(ex.session.snapshot().state.units[attacker8].strengthStatus,'printed-reduced');
eq(ex.session.snapshot().state.units[attacker8].activeFaceId,'leningrad-back-r03c04');
eq(ex.session.snapshot().state.units[attacker8].hex,'0309');
bad(()=>phase(small).resolveSelected({die:4,choices:{attackerLossIds:[]}}),/Explicit exchange/);
bad(()=>phase(small).resolveSelected({die:4,choices:{attackerLossIds:[west8]}}),/Explicit exchange/);
// DRL on a one-step Soviet infantry corps eliminates it; no retreat is owed.
const drl=phase(large).resolveSelected({die:2,choices:{advanceUnitId:west8}});
eq(drl.event.outcome,'DRL');eq(drl.session.snapshot().state.units[soviet3],undefined);
eq(drl.session.snapshot().state.units[west8].hex,'0309');
// A safe, outward, 2-hex retreat works; the common graph is authoritative.
const dr=phase(large).resolveSelected({die:1,choices:{retreatPaths:{[soviet3]:['0308','0307']},advanceUnitId:west8}});
eq(dr.event.outcome,'DR');eq(dr.session.snapshot().state.units[soviet3].hex,'0307');
eq(dr.session.snapshot().state.units[west8].hex,'0309');
eq(dr.session.undo().session.snapshot().state.units[soviet3].hex,'0309');
bad(()=>phase(large).resolveSelected({die:1}),/Complete retreat paths/);
bad(()=>phase(large).resolveSelected({die:1,choices:{retreatPaths:{[soviet3]:['0308','0309']}}}),/outward/);
bad(()=>phase(large).resolveSelected({die:1,choices:{retreatPaths:{[soviet3]:['9999','0307']}}}),/outward/);
// AL: 10:8 odds cap to 1:1, roll 6 -> attacker loss (10 -> 5).
const al=baseline.controller().commit([{defenderHex:'0611',attackers:[tank10]}]).select('0611').resolveSelected({die:6,choices:{lossUnitId:tank10}});
eq(al.event.outcome,'AL');eq(al.session.snapshot().state.units[tank10].printedCombatStrength,5);
eq(al.session.snapshot().state.units[army8].hex,'0611');
bad(()=>baseline.controller().commit([{defenderHex:'0611',attackers:[tank10]}]).select('0611').resolveSelected({die:6}),/Choose an eligible attacking unit/);
// A source-registered hidden mechanized face reveals its real attack/defense
// (only at resolution), without trusting caller-supplied strength.
const hidden=baseline.controller().commit([{defenderHex:'0410',attackers:[tank12]}]).select('0410');
eq(hidden.snapshot().state.units[sovietMech.id].strengthStatus,'untried');
const reveal=hidden.resolveSelected({die:6});
ok(reveal.event.revealed.includes(sovietMech.id));eq(reveal.event.outcome,'DE');
eq(hidden.snapshot().state.units[sovietMech.id].strengthStatus,'untried');
// Multi-battle selectable sequence and reversible second result, without
// allowing any new declarations after the initial combined commitment.
const two=baseline.controller().commit([{defenderHex:'0309',attackers:[attacker8]},
 {defenderHex:'0410',attackers:[tank12]}]);
const first=two.select('0309').resolveSelected({die:5});
eq(first.session.snapshot().status,'committed');
const second=first.session.select('0410').resolveSelected({die:6});
eq(second.session.snapshot().status,'battles-resolved');
eq(second.session.snapshot().resolved.length,2);
eq(second.session.undo().session.snapshot().status,'battle-selected');
bad(()=>first.session.commit([]),/already committed/);
// Unbound alternate source, malformed policy and a forged counter are rejected.
const altered=clone(K);altered.faces.front.find(x=>x.faceId===attacker8).visualTranscription.printedValues='99-4';
bad(()=>Combat.create({...opening,map:M,profile:P,config:F,counterConfig:altered,combatPolicy:Q})
 .commit(small).select('0309').resolveSelected({die:5}),/strength\/face disagrees/);
// Nonhistorical test-only modifier proves no die may be consumed when the
// explicit configured shift makes the final column lower than 1:1.
const synthetic=clone(Q);synthetic.modifiers.terrainColumnShifts.open=-6;
const suppressed=Combat.create({...opening,map:M,profile:P,config:F,counterConfig:K,combatPolicy:synthetic})
 .commit(small).select('0309');
bad(()=>suppressed.resolveSelected({die:5}),/No die is rolled/);
const automatic=suppressed.resolveSelected({die:null});
eq(automatic.event.outcome,'NE');eq(automatic.event.die,null);
eq(automatic.session.snapshot().state,opening.state);
// Verify a source-face mismatch cannot alter an active committed battle.
eq(suppressed.snapshot().state,opening.state);
// Defenses stay strictly pending and are not silently declared complete.
eq(baseline.historicalSetupAuthorized,false);eq(baseline.productionGameActivated,false);
console.log(`PASS v359 shared source-bound combat consequence transactions: ${assertions} assertions`);
