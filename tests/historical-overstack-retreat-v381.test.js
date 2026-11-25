'use strict';
/* Checkpoint 147: additional outward retreat hexes for unavoidable overstack,
 * including actual historical-combat transaction/Undo and negative controls.
 * These tests do NOT establish Fleet-port or independent historical-executable parity. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const R=require('../core/historical_forced_retreat'),Bridge=require('../core/scenario_opening_bridge');
const Combat=require('../core/historical_combat_phase'),M=require('../maps/leningrad.json');
const K=require('../maps/counter-configs/leningrad.json'),S=require('../maps/setup/leningrad.json');
const P=require('../maps/movement-configs/leningrad.json'),F=require('../maps/phase-configs/leningrad.json');
const Q=require('../maps/combat-configs/leningrad.json'),I=require('../core/leningrad_starting_inventory');
const fixture=require('./fixtures/leningrad-source-setup-v357');
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const yes=(a,m)=>{assert.ok(a,m);checks++};
const bad=(f,re)=>{assert.throws(f,re);checks++};
const solver=R.create({map:M,profile:P,combatPolicy:Q,counterConfig:K});
const base=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,allocation:fixture.selected,
 placements:fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:ctx=>Combat.create({...ctx,counterConfig:K,combatPolicy:Q})}}).snapshot();
const soldier=Object.values(base.state.units).find(x=>x.owner==='soviet'&&x.hex==='0309');
const army=Object.values(base.state.units).find(x=>x.owner==='soviet'&&x.hex==='0611'&&x.printedCombatStrength===8);
const attackers=['0210','0310'].map(hex=>Object.values(base.state.units).find(x=>x.owner==='german'&&x.hex===hex&&x.printedCombatStrength===8));
yes(soldier&&army&&attackers.length===2);
const defenderHex='0309',ids=[army.id];
function audit(st){return solver.enumerate({state:st,defenderHex,defenderIds:ids});}
function occupy(st,hexes,prefix){
 let i=0;for(const h of hexes){
  // Explicitly occupy each hex with the full two friendly corps to make
  // placement of an additional Army illegal under both stacking limits.
  for(let j=0;j<2;j++){
   const id=`${prefix}-${i}-${j}`;
   st.units[id]={id,owner:'soviet',hex:h,size:'corps'};
  }
  i++;
 }
}
const initial=copy(base.state);
initial.units[soldier.id].hex='0611';initial.units[army.id].hex=defenderHex;
const free=audit(initial);
eq(free.status,'certified-forced-retreat-options');
yes(free.combinations.length>0&&free.combinations.every(c=>c[army.id].route.length===2));
const zeroEZOC2=new Set(free.perDefender[army.id].options.filter(o=>o.zocHexes.length===0).map(o=>o.route.at(-1)));
yes(zeroEZOC2.size>0);
const forced3=copy(initial);occupy(forced3,zeroEZOC2,'stack2');
const before3=copy(forced3),ext3=audit(forced3);
eq(ext3.status,'certified-forced-retreat-options');
eq(ext3.needsOverstackExtension,true);
eq(ext3.extensionsAdjudicated,true);
yes(ext3.combinations.length>0);
yes(ext3.combinations.every(c=>c[army.id].extraHexes===1&&c[army.id].route.length===3));
yes(ext3.combinations.every(c=>c[army.id].zocHexes.length===0),'safe extended routes override unavoidable shorter EZOC route');
const chosen3=ext3.combinations[0][army.id].route;
// Direct adjudication is read-only until explicit apply on the caller's
// transaction clone. No step loss occurs on the selected safe extension.
const direct=copy(forced3),directResult=solver.apply({state:direct,defenderHex,defenderIds:ids,
 paths:{[army.id]:chosen3},loseStep:()=>{throw Error('Safe extension cannot lose a step');}});
eq(directResult.losses,[]);eq(directResult.retreats[0].route,chosen3);
eq(direct.units[army.id].hex,chosen3.at(-1));eq(forced3,before3,'original state unchanged');
// Forbid continuing after the first compliant endpoint or zigzagging nearer.
bad(()=>solver.apply({state:copy(forced3),defenderHex,defenderIds:ids,
 paths:{[army.id]:[...chosen3,'0501']},loseStep:()=>{}}),/Complete retreat paths/);
bad(()=>solver.apply({state:copy(forced3),defenderHex,defenderIds:ids,
 paths:{[army.id]:['0308','0309','0409']},loseStep:()=>{}}),/Complete retreat paths/);
bad(()=>solver.apply({state:copy(initial),defenderHex,defenderIds:ids,
 paths:{[army.id]:chosen3},loseStep:()=>{}}),/Complete retreat paths/);
// A second ring of overstacked endpoints requires four (not three) hexes.
const forced4=copy(forced3);
const ends3=new Set(ext3.combinations.map(c=>c[army.id].route.at(-1)));
occupy(forced4,ends3,'stack3');
const before4=copy(forced4),ext4=audit(forced4);
eq(ext4.status,'certified-forced-retreat-options');
yes(ext4.combinations.length>0);
yes(ext4.combinations.every(c=>c[army.id].route.length===4&&c[army.id].extraHexes===2));
const chosen4=ext4.combinations[0][army.id].route;
const applied4=copy(forced4);
const result4=solver.apply({state:applied4,defenderHex,defenderIds:ids,paths:{[army.id]:chosen4},
 loseStep:()=>{throw Error('No step loss on a safe overstack extension');}});
eq(result4.retreats[0].route,chosen4);eq(applied4.units[army.id].hex,chosen4.at(-1));
eq(forced4,before4);
// A standard combat transaction must produce the same four-phase snapshot
// semantics and reverse perfectly on Undo; reinforcements/other units remain.
function phase(state){return Combat.create({map:M,profile:P,config:F,cursor:base.cursor,actor:base.actor,
 state,counterConfig:K,combatPolicy:Q}).commit([{defenderHex,attackers:attackers.map(a=>a.id)}]).select(defenderHex);}
const controller=phase(forced3),beforeController=controller.snapshot();
const battle=controller.resolveSelected({die:1,choices:{retreatPaths:{[army.id]:chosen3}}});
eq(battle.event.outcome,'DR');eq(battle.event.scope,'verified-effects-forced-retreat-bounded');
eq(battle.event.retreats[0].route,chosen3);
eq(battle.session.snapshot().state.units[army.id].hex,chosen3.at(-1));
eq(battle.session.undo().session.snapshot(),{...beforeController,historyDepth:0});
eq(controller.snapshot(),beforeController);
const controller4=phase(forced4),battle4=controller4.resolveSelected({die:1,choices:{retreatPaths:{[army.id]:chosen4}}});
eq(battle4.event.retreats[0].route,chosen4);
eq(battle4.session.undo().session.snapshot(),{...controller4.snapshot(),historyDepth:0});
// EX applies the defender and attacker source-faced step losses before the
// post-result overstack retreat (the same third hex remains reachable).
const exchange=phase(forced3),priorExchange=exchange.snapshot();
const ex=exchange.resolveSelected({die:3,choices:{defenderLossId:army.id,
 attackerLossIds:[attackers[0].id],retreatPaths:{[army.id]:chosen3}}});
eq(ex.event.outcome,'EX');eq(ex.event.retreats[0].route,chosen3);
eq(ex.session.snapshot().state.units[army.id].printedCombatStrength,4);
eq(ex.session.undo().session.snapshot(),{...priorExchange,historyDepth:0});
// The previous safe two-hex options and no-shadow rendering remain unchanged.
const untouched=audit(initial);eq(untouched.combinations.length,free.combinations.length);
yes(untouched.combinations.every(c=>c[army.id].route.length===2));
const oldMode={...Q,retreatMode:undefined};
const oldPhase=Combat.create({map:M,profile:P,config:F,cursor:base.cursor,actor:base.actor,
 state:forced3,counterConfig:K,combatPolicy:oldMode})
 .commit([{defenderHex,attackers:attackers.map(a=>a.id)}]).select(defenderHex);
bad(()=>oldPhase.resolveSelected({die:1,choices:{retreatPaths:{[army.id]:chosen3}}}),/Retreat must be exactly two hexes/);
const source=fs.readFileSync('core/historical_forced_retreat.js','utf8');
yes(!/\b(?:leningrad|moscow|kiev|arduous)\b/i.test(source),'shared engine contains no scenario-ID branches');
const evidence={checkpoint:147,version:'v381',scope:'bounded overstack-extension source retreat, no joint ordering or Fleet-port adjudication',
 assertions:checks,sourcePdf:'references/rules/leningrad-rules.pdf §10.6',
 sourcePdfSha256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/leningrad-rules.pdf')).digest('hex'),
 threeHexes:{count:ext3.combinations.length,selected:chosen3},
 fourHexes:{count:ext4.combinations.length,selected:chosen4},
 rules:['strict outward every step','extra steps only after a blocked two-hex stacking endpoint',
 'safe extensions preferred over EZOC-exposed alternatives','first available legal stacking endpoint is mandatory'],
 regression:['DR and EX transactions', 'undo', 'failed-path atomicity', 'opt-in disabled legacy safe-only mode'],
 limitations:['Fleet port optional ignore-retreat not implemented',
 'Order-dependent stacked defender extra-hex alternatives still fail closed',
 'No independent executable-parity or eight-turn gameplay verification']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-overstack-retreat-v381.json',JSON.stringify(evidence,null,2)+'\n');
console.log('PASS v381:',checks,'overstack-extension, rollback and source-boundary assertions');
