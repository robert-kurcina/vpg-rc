#!/usr/bin/env node
/* Executable, fixture-only audit. It intentionally does not write a game save
 * or assert the selected identities are historically fixed assignments. */
'use strict';
const fs=require('node:fs');const path=require('node:path');
const Bridge=require('../core/scenario_opening_bridge');
const Combat=require('../core/historical_combat_phase');
const f=require('../tests/fixtures/leningrad-source-setup-v357');
const map=require('../maps/leningrad.json'),setupSpec=require('../maps/setup/leningrad.json');
const counterConfig=require('../maps/counter-configs/leningrad.json');
const phaseConfig=require('../maps/phase-configs/leningrad.json');
const movementProfile=require('../maps/movement-configs/leningrad.json');
const inventory=require('../core/leningrad_starting_inventory');
const bridge=Bridge.create({map,setupSpec,counterConfig,inventory,allocation:f.selected,placements:f.placements,
 phaseConfig,movementProfile,phaseFactories:{combat:Combat.create}});
const snapshot=bridge.snapshot(),units=Object.values(snapshot.state.units);
const attacker=units.find(u=>u.owner==='german'&&u.hex==='0310'&&u.printedCombatStrength===8);
const defender=units.find(u=>u.owner==='soviet'&&u.hex==='0309'&&u.printedCombatStrength===3);
if(!attacker||!defender)throw Error('Test-only source-face selection changed');
const battle=bridge.controller().commit([{defenderHex:defender.hex,attackers:[attacker.id]}]).select(defender.hex);
const odds=battle.evaluateSelectedFromMap({strengths:{
 [attacker.id]:{kind:attacker.class,value:attacker.printedCombatStrength},
 [defender.id]:{kind:defender.class,value:defender.printedCombatStrength}
}});
let blocked=false;try{battle.finish()}catch(e){blocked=/requires source-verified/.test(e.message)}
if(!blocked||odds.crtResult!==null||odds.finalOdds!==2)throw Error('Uncertified combat progression or invalid opening odds');
const audit={checkpoint:124,version:'v358',status:'preview-only-no-production-activation',
 source:'tests/fixtures/leningrad-source-setup-v357.js; maps/setup/leningrad.json; user-source SVG + source counter faces',
 fixtureStatus:'test-only selections of eligible starting counter identities and markers; not historical formation assignment',
 initial:{phase:bridge.firstPhase().id,actor:snapshot.actor,turn:snapshot.cursor.turn,unitCount:units.length,
 german:units.filter(u=>u.owner==='german').length,soviet:units.filter(u=>u.owner==='soviet').length},
 candidateFirstBattle:{attackerFace:attacker.id,attackerHex:attacker.hex,defenderFace:defender.id,defenderHex:defender.hex,
 attackStrength:odds.attackStrength,defenseStrength:odds.defenseStrength,odds:odds.finalOdds,
 geography:odds.geography,crtResult:odds.crtResult,consequencesCommitted:false},
 setup:bridge.setupAudit(),historicalSetupAuthorized:false,productionGameActivated:false,
 combatFinishBlocked:blocked,approvedRenderModified:false};
const dest=path.join(__dirname,'../rules/audit/scenario-opening-integration-v358.json');
fs.writeFileSync(dest,JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({audit:dest,opening:audit.initial,odds:audit.candidateFirstBattle.odds,unresolvedPrintedAnchors:audit.setup.printedAnchorDisagreements.length},null,2));
