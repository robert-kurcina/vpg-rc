'use strict';
/* Source-provenance binding and negative tests. No gameplay activation. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const Binder=require('../core/composite_setup_roster_binding');
const Compose=require('../maps/composer');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const setupPolicy=require('../maps/setup-configs/kiev-odessa-source-setup-v522.json');
const sourceBindingPolicy=require('../maps/setup-configs/kiev-odessa-source-face-bindings-v523.json');
const overlay=require('../maps/roster-overlays/kiev-odessa.json');
const kievInventory=require('../maps/setup/kiev-inventory.json');
const kievCounters=require('../maps/counter-configs/kiev.json');
const odessaCounters=require('../maps/counter-configs/odessa-extension.json');
const candidate=require('../games/kiev/setup-preview/candidate.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const protectedFiles=['maps/kiev.json','maps/odessa-extension.json','maps/roster-overlays/kiev-odessa.json','exports/kiev-odessa.svg','exports/kiev-odessa.png',
 'assets/official-counters/source-sheets/counters-kiev-front.jpg','assets/official-counters/source-sheets/counters-odessa-front.jpg'];
const before=Object.fromEntries(protectedFiles.map(p=>[p,hash(p)]));
const options={root,combinedMap:Compose.compose(base,ext),baseMap:base,extension:ext,setupPolicy,sourceBindingPolicy,overlay,kievInventory,kievCounters,odessaCounters};
let tests=0;const eq=(x,y,msg)=>{assert.deepEqual(x,y,msg);tests++};const ok=(x,msg)=>{assert.ok(x,msg);tests++};
const reject=(fn,exp)=>{assert.throws(fn,exp);tests++};
const binding=Binder.create(options);
const result=binding.bindAllocation(candidate.allocation);
eq(result.status,'candidate-source-face-bound-not-gameplay-authorized');
eq(result.canRunHistoricalCampaign,false);
eq(result.totalRomanianGround,4);
eq(result.germanRomaniaInfantry,3);
eq(result.inheritedRomanian.sourceFaceId,'kiev-front-r02c08');
eq(result.inheritedRomanian.reverseFaceId,'kiev-back-r02c01');
eq(result.inheritedRomanian.printedIdentifier,'Rom 3');
eq(result.inheritedRomanian.sourceIdentityKey,'kiev:romanian:infantry:Rom_3');
eq(result.inheritedRomanian.unitId,null);
eq(result.inheritedRomanian.selectedHex,null);
eq(result.rosterGameUnitIdsAllocated,false);
eq(result.playerSelectedGermanSourceFaces,true);
eq(result.supplementalRomanian.map(u=>u.designKey).sort(),['romanian-4th-army','romanian-cavalry-corps','romanian-home-army']);
eq(result.supplementalRomanian.find(u=>u.designKey==='romanian-cavalry-corps').sourceFaceId,'odessa-back-r01c01');
ok(result.inheritedGermanInfantry.every(u=>u.side==='german'&&u.counterSheet==='kiev'&&!u.unitId));
eq(result.sourceDefinedRear.sourceRuleHex,'1309');
eq(result.sourceDefinedRear.semanticSetupPosition,'1309');
eq(result.sourceDefinedRear.sourceOriginalKievMarker,true);
eq(result.sourceDefinedRear.combinedMarkerPresent,false);
eq(result.sourceDefinedRear.combinedExtraMarker0706,true);
eq(result.sourceDefinedRear.artworkReassignmentAuthorized,false);
eq(result.sourceDefinedRear.rulePlacementValid,true);
eq(binding.sourceAudit.productionCertified,false);
ok(binding.sourceAudit.availableKievGermanInfantry.length===11);
ok(binding.sourceAudit.preflightBlockers.includes('frontline-stars:12-instead-of-11'));
ok(binding.sourceAudit.preflightBlockers.includes('rear-deployment-symbol-disagreement'));
// Source rule does not identify which three of the German infantry must go into Romania.
// Swap one of the three German source faces with a Poland face, with no duplicate IDs.
const alternative=clone(candidate.allocation);
const [facePoland]=alternative.germanPolandInfantry;
const [faceRomania]=alternative.germanRomaniaInfantry;
alternative.germanPolandInfantry[0]=faceRomania;
alternative.germanRomaniaInfantry[0]=facePoland;
const other=binding.bindAllocation(alternative);
eq(other.inheritedGermanInfantry.length,3);
ok(other.inheritedGermanInfantry.some(u=>u.sourceFaceId===facePoland));
ok(!other.inheritedGermanInfantry.some(u=>u.sourceFaceId===faceRomania));
eq(other.totalRomanianGround,4);
// The only Romanian face in the original inventory cannot be moved to a German slot.
const incorrectlyAllocated=clone(candidate.allocation);
incorrectlyAllocated.romanianInitialArmy=[candidate.allocation.germanRomaniaInfantry[0]];
incorrectlyAllocated.germanRomaniaInfantry[0]='kiev-front-r02c08';
reject(()=>binding.bindAllocation(incorrectlyAllocated),/invalid-base-kiev-allocation/);
const repeatedFace=clone(candidate.allocation);
repeatedFace.germanRomaniaInfantry[0]=repeatedFace.germanPolandInfantry[0];
reject(()=>binding.bindAllocation(repeatedFace),/invalid-base-kiev-allocation/);
const reinforcementFace=clone(candidate.allocation);
reinforcementFace.germanRomaniaInfantry[0]=reinforcementFace.germanReinforcementInfantry[0];
reinforcementFace.germanReinforcementInfantry[0]=candidate.allocation.germanRomaniaInfantry[0];
// Both faces are printed 6-4; the source does not fix their distinct identities.
// Preserve a valid player selection instead of incorrectly pinning face 29 to Turn 3.
ok(binding.bindAllocation(reinforcementFace).inheritedGermanInfantry.some(u=>u.sourceFaceId===candidate.allocation.germanReinforcementInfantry[0]),'German 6-4 face can be selected at start when the rule does not identify it');
reject(()=>Binder.create({...options,sourceBindingPolicy:{...sourceBindingPolicy,
 inheritedRomanian:{...sourceBindingPolicy.inheritedRomanian,expectedFrontFaceId:'kiev-front-r01c01'}}}),/invalid-source-binding-policy/);
reject(()=>Binder.create({...options,kievCounters:{...kievCounters,faceSource:{...kievCounters.faceSource,
 front:{...kievCounters.faceSource.front,sha256:'0'.repeat(64)}}}}),/counter-source-sheet-changed/);
reject(()=>Binder.create({...options,setupPolicy:{...setupPolicy,source:{...setupPolicy.source,odessaRulesSha256:'f'.repeat(64)}}}),/source-pdf-mismatch/);
const noOriginalRear=clone(base);noOriginalRear.cells.find(c=>c.id==='1309').tileMarkers=[];
reject(()=>Binder.create({...options,baseMap:noOriginalRear}),/original-kiev-rear-1309-source-missing/);
const fakeOverlay=clone(overlay);fakeOverlay.units.find(u=>u.designKey==='romanian-home-army').art.displayFaceId='odessa-front-r01c01';
reject(()=>Binder.create({...options,overlay:fakeOverlay}),/unverified-supplementary-romanian-design/);
const noOverlayUnit=clone(overlay);noOverlayUnit.units=noOverlayUnit.units.filter(u=>u.designKey!=='romanian-4th-army');
reject(()=>Binder.create({...options,overlay:noOverlayUnit}),/counter-roster-setup-disagreement|unverified-supplementary/);
for(const file of protectedFiles)eq(hash(file),before[file],file+' unchanged');
const audit={version:'v523',checkpoint:289,status:'PASS',assertions:tests,
  baseRomanianFace:result.inheritedRomanian.sourceFaceId,germanSubsetSourceFaceCount:result.inheritedGermanInfantry.length,
  supplementedRomanianDesignCount:result.supplementalRomanian.length,
  sourceRearMechanizedHex:result.sourceDefinedRear.semanticSetupPosition,
  unresolved:binding.sourceAudit.preflightBlockers,
  notes:['Only source face IDs are bound; gameplay runtime IDs/territorial starting hexes are not assigned.',
    'Combined SVG 0706 vs rulebook 1309 marker conflict remains visible; no map changes.',
    '12-star vs 11-rule marker count remains unresolved; no star removed.',
    'The submitted base Kiev candidate is synthetic, not a canonical Odessa opening.']};
fs.writeFileSync(path.join(root,'rules/audit/odessa-source-roster-binding-v523.json'),JSON.stringify(audit,null,2)+'\n');
console.log('PASS v523 Odessa inherited source roster binding',tests,'assertions');
