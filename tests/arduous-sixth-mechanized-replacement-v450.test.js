'use strict';
/* Source-specific §12 prohibition, exercised by generic shared buildup engine.
 * Synthetic removals below are unit-level negative controls only; a separate
 * Chromium regression exercises elimination through legal historical combat. */
const A=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const B=require('../core/historical_buildup_phase');
const Setup=require('../core/scenario_starting_setup');
const Inventory=require('../core/historical_source_face_inventory');
const map=require('../maps/arduous.json');
const setup=require('../maps/setup/arduous.json');
const inv=require('../maps/setup/arduous-inventory.json');
const cfg=require('../maps/phase-configs/arduous.json');
const profile=require('../maps/movement-configs/arduous.json');
const counterConfig=require('../maps/counter-configs/arduous.json');
const policy=require('../maps/buildup-configs/arduous.json');
const fixture=require('./fixtures/arduous-source-setup-v419');
let checks=0;
const ok=(p,m)=>{A.ok(p,m);checks++};
const eq=(x,y,m)=>{A.deepEqual(x,y,m);checks++};
const fail=(fn,re,m)=>{A.throws(fn,re,m);checks++};
const copy=x=>JSON.parse(JSON.stringify(x));
const exclusions=policy.replacementExcludedFaces;
eq(exclusions?.length,1,'Only the 6th Soviet Mechanized Corps is excluded');
const banned=exclusions[0];
eq(banned.faceId,'arduous-front-r04c01');
eq(banned.revealedIdentifier,'6');
eq(banned.kind,'mechanized');
eq(banned.owner,'soviet');
ok(banned.ruleSource.includes('§12.0'),'Rulebook section pinned');
const f=counterConfig.faces.front.find(x=>x.faceId===banned.faceId);
const b=counterConfig.faces.back.find(x=>x.faceId===f?.pairedFaceId);
ok(f&&b&&b.pairedFaceId===f.faceId,'Source sheet mirror pairing');
eq(f.visualTranscription.printedValues,'?-6');
eq(b.visualTranscription.printedIdentifier,'6');
eq(b.visualTranscription.printedValues,'8·4-6');
ok(fixture.allocation.sovietFrontMechanized.includes(banned.faceId),'Banned face present in actual candidate opening');
const valid=Setup.validate({map,spec:setup,counterConfig,inventory:Inventory.create(inv),
 allocation:fixture.allocation,placements:fixture.placements});
ok(valid.valid,'Source opening validates');
const make=p=>B.create({map,profile,config:cfg,counterConfig,policy:p,
 allocation:fixture.allocation,fixedPolicy:require('../maps/setup/arduous-fixed-pieces.json')});
const build=make(policy),initial=build.initialize(valid.state);
const removed=copy(initial);delete removed.units[banned.faceId];
const turn=3,phase=build.openingPhase(),hex=policy.entryEdge.soviet[0];
const action=(unitId,state=removed)=>({state,cursor:{turn},actor:'soviet',phase,unitId,hex});
fail(()=>build.replace(action(banned.faceId)),/Source-excluded unit cannot receive replacements/,
 'Soviet 6th cannot be rebuilt on the first available replacement turn');
const other=fixture.allocation.sovietFrontMechanized.find(x=>x!==banned.faceId);
const otherState=copy(initial);delete otherState.units[other];
const allowed=build.replace(action(other,otherState));
eq(allowed.event.kind,'replacement-rebuilt');
eq(allowed.state.units[other].strengthStatus,'revealed-one-step');
eq(allowed.state.units[other].hex,hex);eq(allowed.phase.spent,1);
eq(allowed.phase.replacedMechanized,1);
fail(()=>make({...policy,replacementExcludedFaces:[{...banned,revealedIdentifier:'FAKE'}]}),/Replacement exclusion lacks exact printed source-face identity/);
fail(()=>make({...policy,replacementExcludedFaces:[{...banned,faceId:'fake'}]}),/Replacement exclusion lacks exact printed source-face identity/);
fail(()=>make({...policy,replacementExcludedFaces:[{...banned,kind:'infantry'}]}),/Replacement exclusion lacks exact printed source-face identity/);
fail(()=>make({...policy,replacementExcludedFaces:[banned,banned]}),/Replacement exclusion lacks exact printed source-face identity/);
fail(()=>make({...policy,replacementExcludedFaces:'invalid'}),/Invalid source replacement exclusion list/);
const digest=crypto.createHash('sha256').update(fs.readFileSync('references/rules/arduous-rules.pdf')).digest('hex');
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/arduous-sixth-mechanized-v450.json',JSON.stringify({
 checkpoint:216,version:'v450',rulePdfSha256:digest,ruleSource:banned.ruleSource,
 prohibitedFace:banned.faceId,pairedRevealedFace:b.faceId,revealedFormation:b.visualTranscription.printedIdentifier,
 allowedCounter:other,unitLevelAssertions:checks,phase:turn,
 limitation:'Unit-level synthetic removal proves shared rules; browser acceptance uses actual combat.'},null,2)+'\n');
console.log('PASS v450 Arduous Soviet 6th Mechanized source-exclusion:',checks,'assertions');
