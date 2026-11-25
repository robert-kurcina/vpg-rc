#!/usr/bin/env node
/* Reproducible source-audited 19-counter STARTING SETUP test fixture.
 * Does not promote arbitrarily chosen face assignments to historical identities.
 */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const S=require('../core/scenario_starting_setup');
const I=require('../core/leningrad_starting_inventory');
const fixture=require('../tests/fixtures/leningrad-source-setup-v357');
const M=require('../maps/leningrad.json'),C=require('../maps/counter-configs/leningrad.json'),spec=require('../maps/setup/leningrad.json');
const source=(p)=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')});
const result=S.validate({map:M,spec,counterConfig:C,inventory:I,allocation:fixture.selected,placements:fixture.placements});
if(!result.valid||result.startingUnitCount!==19||result.printedAnchorDisagreements.length!==2)throw Error('Unexpected Leningrad setup source reconciliation');
const audit={schemaVersion:1,checkpoint:123,projectVersion:'v357',
 stage:'candidate-physical-setup-and-source-discrepancy-audit',
 sourceFiles:[source('references/rules/leningrad-rules.pdf'),source('maps/source/user-svg/leningrad-main.svg'),source('maps/counter-configs/leningrad.json'),source('maps/leningrad.json'),source('maps/setup/leningrad.json')],
 rulesSource:'Target: Leningrad §6.0 steps 2–8; five rear printed IDs verified by text extraction; SVG contains five fixed source unit symbols',
 printedRearOrderFromRules:I.sourceRearHexes,physicalSlotCounts:result.sourceMarkerCounts,
 sourcePrintedPositionCorrespondence:result.printedAnchorReport,
 unresolvedPrintedNumberConflicts:result.printedAnchorDisagreements,
 preliminaryStartingUnits:result.startingUnitCount,
 provisionalCounterSelections:fixture.selected,
 positionDistribution:Object.fromEntries(Object.entries(result.state.units).map(([k,u])=>[k,{physicalHex:u.hex,owner:u.owner,class:u.class,size:u.size,mp:u.mp,strengthStatus:u.strengthStatus}])),
 validatorStatus:{valid:result.valid,physicalSetupValid:result.physicalSetupValid,printedAnchorAgreement:result.printedAnchorAgreement,
  historicalSetupAuthorized:result.historicalSetupAuthorized,productionGameActivated:result.productionGameActivated},
 scope:'An explicitly selected test opening. Source-symbol-to-rulebook-label assignment is a candidate association by counter class and geographic order, not independently labeled by the SVG. Two resulting numbered-hex mismatches are retained for source review. No source art, render, topology, or production gameplay modified.'};
const dest=path.join(root,'rules/audit/leningrad-source-marker-setup-v357.json');
fs.writeFileSync(dest,JSON.stringify(audit,null,2)+'\n');
console.log('PASS source setup audit:',dest,'(19 units, 2 source numbering disagreements)');
