#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const Bridge=require('../core/scenario_opening_bridge'),Combat=require('../core/historical_combat_phase');
const I=require('../core/leningrad_starting_inventory'),M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const fixture=require('../tests/fixtures/leningrad-source-setup-v357');
const digest=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const bridge=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,allocation:fixture.selected,
 placements:fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:input=>Combat.create({...input,counterConfig:K,combatPolicy:Q})}});
const a=Object.values(bridge.snapshot().state.units);
const unit=(hex,owner,strength)=>a.find(u=>u.hex===hex&&u.owner===owner&&u.printedCombatStrength===strength)?.id;
const attacker=unit('0310','german',8),west=unit('0210','german',8),defender=unit('0309','soviet',3);
if(!attacker||!west||!defender)throw Error('Actual source fixture not present');
const committed=bridge.controller().commit([{defenderHex:'0309',attackers:[west,attacker]}]).select('0309');
const effect=committed.resolveSelected({die:6,choices:{advanceUnitId:west}}),after=effect.session.snapshot();
const finished=effect.session.finish(),restored=finished.session.undo().session.undo().session.snapshot();
if(after.state.units[defender]||after.state.units[west]?.hex!=='0309'||JSON.stringify(restored.state)!==JSON.stringify(committed.snapshot().state))
 throw Error('Audit failed to round-trip actual combat outcome and two undo boundaries');
const audit={checkpoint:125,version:'v359',status:'bounded-combat-transactions-not-complete-gameplay',
 source:{rulesPDF:'references/rules/leningrad-rules.pdf',rulesSHA256:digest('references/rules/leningrad-rules.pdf'),
  counterConfig:'maps/counter-configs/leningrad.json',counterSHA256:digest('maps/counter-configs/leningrad.json'),
  scenarioCombatConfig:'maps/combat-configs/leningrad.json',configSHA256:digest('maps/combat-configs/leningrad.json')},
 coverage:{outcomes:['NE','DE','AL','DR','DRL','EX'],subset:'source-verified counter faces, user-supplied die, safe outward 2-hex retreat only',
  notIntegrated:['live RNG/choice workflow','forced EZOC step loss and elimination','retreat overflow','Fleet/port exceptions','air/naval support','city terrain classification','browser UX','full turn progression']},
 opening:{units:Object.keys(committed.snapshot().state.units).length,cursor:committed.snapshot().cursor,
  sourceFaceAttackerIds:[west,attacker],defenderId:defender,battle:effect.event,
  after:{remainingUnits:Object.keys(after.state.units).length,advancedHex:after.state.units[west].hex},
  postFinishCursor:finished.session.snapshot().cursor,undoRestoredOriginalState:true},
 visualBaseline:'v350 user-approved Leningrad; only backend combat files/config/tests altered'};
fs.mkdirSync('rules/audit',{recursive:true});
fs.writeFileSync('rules/audit/shared-combat-transactions-v359.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({checkpoint:125,outcome:audit.opening.battle.outcome,odds:audit.opening.battle.odds,undo: audit.opening.undoRestoredOriginalState},null,2));
