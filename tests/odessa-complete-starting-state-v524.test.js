'use strict';
/* Player-selectable, source-face-bound Kiev–Odessa diagnostic candidate state.
   No historical setup or runtime-gameplay activation from this test. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const C=require('../core/composite_starting_state_candidate');
const Compose=require('../maps/composer');
const base=require('../maps/kiev.json'),extension=require('../maps/odessa-extension.json');
const combined=Compose.compose(base,extension);
const overlay=require('../maps/roster-overlays/kiev-odessa.json');
const setupPolicy=require('../maps/setup-configs/kiev-odessa-source-setup-v522.json');
const sourceBindingPolicy=require('../maps/setup-configs/kiev-odessa-source-face-bindings-v523.json');
const kievInventory=require('../maps/setup/kiev-inventory.json');
const kievCounters=require('../maps/counter-configs/kiev.json');
const odessaCounters=require('../maps/counter-configs/odessa-extension.json');
const kievSetupPolicy=require('../maps/setup/kiev.json');
const candidate=require('../games/kiev/setup-preview/candidate.json');
const args={root,combinedMap:combined,baseMap:base,extension,setupPolicy,sourceBindingPolicy,overlay,kievInventory,kievCounters,odessaCounters,kievSetupPolicy};
const factory=()=>C.create(args);
const extra={
 'soviet-cavalry-corps-a':'1215',
 'soviet-cavalry-corps-b':'1111', // Explicit diagnostic selection; 1113 remains visually disputed
 'soviet-coastal-army':'1513',
 'soviet-black-sea-fleet':'1513',
 'romanian-home-army':'0709',
 'romanian-4th-army':'0809',
 'romanian-cavalry-corps':'1010'
};
const clone=v=>JSON.parse(JSON.stringify(v));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const protectedPaths=['maps/kiev.json','maps/odessa-extension.json','maps/roster-overlays/kiev-odessa.json','exports/kiev-odessa.svg','exports/kiev-odessa.png',
 'assets/official-counters/source-sheets/counters-kiev-front.jpg','assets/official-counters/source-sheets/counters-odessa-front.jpg'];
const protectedHashes=Object.fromEntries(protectedPaths.map(f=>[f,sha(f)]));
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const yes=(a,msg)=>{assert.ok(a,msg);checks++};
const bad=(fn,rx)=>{assert.throws(fn,rx);checks++};
const system=factory();
const make=(opts={})=>system.build({allocation:candidate.allocation,basePlacements:candidate.placements,extraPlacements:extra,...opts});
const state=make();
eq(state.scenarioId,'kiev-odessa');
eq(state.status,'candidate-starting-state-not-gameplay-authorized');
eq(state.gameplayCertified,false);eq(state.canRunHistoricalCampaign,false);eq(state.diagnosticRuntimeIdsAllocated,true);
eq(state.onMapCount,37);eq(state.bySide,{axis:17,soviet:20});
eq(Object.keys(state.initialUnits).length,37);
eq(state.rearRuleSlots,['0406','0705','0803','1007','1106','1215','1309']);
eq(state.frontlineSelected.length,11);
eq(state.unusedFrontlineStars,['1113']);
eq(state.initialUnits['kiev/kiev-front-r05c08'].hex,'1309');
eq(state.initialUnits['kiev-odessa/soviet-cavalry-corps-a'].hex,'1215');
eq(state.initialUnits['kiev-odessa/soviet-cavalry-corps-b'].hex,'1111');
eq(state.initialUnits['kiev-odessa/soviet-coastal-army'].hex,'1513');
eq(state.initialUnits['kiev-odessa/soviet-black-sea-fleet'].hex,'1513');
eq(state.initialUnits['kiev-odessa/soviet-black-sea-fleet'].stackFree,true);
eq(state.initialUnits['kiev-odessa/soviet-black-sea-fleet'].openingCounterState,'undamaged');
eq(state.initialUnits['kiev/kiev-front-r02c08'].nationality,'romanian');
eq(state.initialUnits['kiev/kiev-front-r02c08'].reverseFaceId,'kiev-back-r02c01');
eq(state.airSupportTrack.length,3);
eq(state.airSupportTrack.find(u=>u.id==='kiev-odessa/romanian-air-support').initialTurn,2);
eq(state.reinforcementTrack.filter(u=>u.entryKind==='scheduled').length,6);
eq(state.reinforcementTrack.filter(u=>u.entryKind==='replacement-only').length,1);
eq(state.initialUnits['kiev/kiev-front-r04c02'].concealed,true);
yes(state.sourceFaceBindingsVerified);
yes(state.sourceBlockers.includes('frontline-stars:12-instead-of-11'));
yes(state.sourceBlockers.includes('rear-deployment-symbol-disagreement'));
eq(state.romanianPlacementsAwaitingTerritory,[]);yes(state.romanianSetupSubsetVerified);
yes(state.sourceBlockers.includes('not-certified-movement-and-eastern-communication'));
// Player choices remain genuinely variable; two face swaps with matching
// original counter strengths change the starting IDs without changing counts.
const changed=clone(candidate.allocation);
[changed.germanRomaniaInfantry[0],changed.germanPolandInfantry[0]]=[changed.germanPolandInfantry[0],changed.germanRomaniaInfantry[0]];
const places=clone(candidate.placements);
[places[changed.germanRomaniaInfantry[0]],places[changed.germanPolandInfantry[0]]]=[places[changed.germanPolandInfantry[0]],places[changed.germanRomaniaInfantry[0]]];
const swapped=make({allocation:changed,basePlacements:places});
eq(swapped.onMapCount,37);yes(swapped.initialUnits['kiev/'+changed.germanRomaniaInfantry[0]].hex==='0709');
// A second Soviet frontline-star choice can be staged explicitly; this is
// NOT proof which of the twelve authored stars is extraneous.
const different=clone(extra);different['soviet-cavalry-corps-b']='1113';
const changedStar=make({extraPlacements:different});
eq(changedStar.unusedFrontlineStars,['1111']);eq(changedStar.gameplayCertified,false);
// Rejections: missing, duplicated, misallocated, wrong setup and stacking.
const minusFace=clone(candidate.placements);delete minusFace[candidate.allocation.sovietFixedArmies[0]];
bad(()=>make({basePlacements:minusFace}),/base-placement/);
const extraUnknown={...extra,'unsourced-unit':'1513'};
bad(()=>make({extraPlacements:extraUnknown}),/supplement-placement/);
const badRear=clone(candidate.placements);badRear[candidate.allocation.sovietFixedMechanized[3]]='0706';
bad(()=>make({basePlacements:badRear}),/illegal-rear-setup/);
const badCavalry={...extra,'soviet-cavalry-corps-a':'0706'};
bad(()=>make({extraPlacements:badCavalry}),/illegal-rear-setup/);
const badSea={...extra,'soviet-black-sea-fleet':'1416'};
bad(()=>make({extraPlacements:badSea}),/invalid-initial-hex|odessa-port-start/);
const badFleet={...extra,'soviet-black-sea-fleet':'1811'};
bad(()=>make({extraPlacements:badFleet}),/odessa-port-start/);
const duplicateFront={...extra,'soviet-cavalry-corps-b':'0205'};
bad(()=>make({extraPlacements:duplicateFront}),/invalid-unit-distribution|illegal-frontline/);
const notStar={...extra,'soviet-cavalry-corps-b':'1310'};
bad(()=>make({extraPlacements:notStar}),/illegal-frontline/);
const wrongCountry={...extra,'romanian-home-army':'1111'};
bad(()=>make({extraPlacements:wrongCountry}),/explicitly-non-romanian/);
const overflow={...extra,'romanian-home-army':'1010','romanian-4th-army':'1010','romanian-cavalry-corps':'1010'};
bad(()=>make({extraPlacements:overflow}),/illegal-source-setup-stack/);
const weakenedSetupPolicy=clone(kievSetupPolicy);weakenedSetupPolicy.groups.germanPolandInfantry.allowedHexes[0]='1111';
bad(()=>C.create({...args,kievSetupPolicy:weakenedSetupPolicy}),/invalid-original-kiev-setup-policy/);
const invalidPoland=clone(candidate.placements);
invalidPoland[candidate.allocation.germanPolandInfantry[0]]='1111';
bad(()=>make({basePlacements:invalidPoland}),/invalid-poland-setup/);
const badAllocation=clone(candidate.allocation);
badAllocation.germanRomaniaInfantry[0]=badAllocation.germanPolandInfantry[0];
bad(()=>make({allocation:badAllocation}),/invalid-base-kiev-allocation/);
const wrongCavalryArt=clone(overlay);wrongCavalryArt.units.find(u=>u.designKey==='soviet-cavalry-corps-a').art.displayFaceId='odessa-back-r01c01';
bad(()=>C.create({...args,overlay:wrongCavalryArt}).build({allocation:candidate.allocation,basePlacements:candidate.placements,extraPlacements:extra}),/invalid-supplement-counter-face/);
const wrongAirArt=clone(overlay);wrongAirArt.units.find(u=>u.designKey==='romanian-air-support').art.displayFaceId='odessa-back-r01c01';
bad(()=>C.create({...args,overlay:wrongAirArt}).build({allocation:candidate.allocation,basePlacements:candidate.placements,extraPlacements:extra}),/wrong-romanian-air-arrival-or-face/);
const tamperedMap=clone(combined);tamperedMap.cells.find(c=>c.id==='1215').terrain='sea';
bad(()=>C.create({...args,combinedMap:tamperedMap}).build({allocation:candidate.allocation,basePlacements:candidate.placements,extraPlacements:extra}),/source-map-or-port-invalid|invalid-initial-hex/);
for(const f of protectedPaths)eq(sha(f),protectedHashes[f],f+' unchanged');
const report={checkpoint:290,version:'v524',status:'PASS',assertions:checks,scenarioId:'kiev-odessa',
 startingUnits:state.onMapCount,startingBySide:state.bySide,sourceSelectedFrontlineStars:state.frontlineSelected,
 unoccupiedAuthoredFrontlineStars:state.unusedFrontlineStars,unknownRomanianPositions:state.romanianPlacementsAwaitingTerritory,
 readyForHistoricalCampaign:false,blockers:state.sourceBlockers,
 explanation:'Player-chosen synthetic test allocation, NOT a historically validated opening. Does not resolve Romania, 12/11 stars, mechanized icon disagreement, or connectivity.'};
if(process.env.WRITE_LEGACY_AUDIT==='1')fs.writeFileSync(path.join(root,'rules/audit/odessa-complete-starting-state-v524.json'),JSON.stringify(report,null,2)+'\n');
if(process.env.WRITE_LEGACY_AUDIT==='1')fs.writeFileSync(path.join(root,'rules/audit/odessa-candidate-37-unit-manifest-v524.json'),JSON.stringify({
  ...state,sourceAllocationType:'synthetic-user-choice-test-fixture; not a historical opening',
  publishedFor:'diagnostic-review-only'
},null,2)+'\n');
console.log('PASS v524 Odessa player-selected starting-state candidate:',checks,'assertions;',state.onMapCount,'on-map units; remaining',state.sourceBlockers.length,'distinct blockers');
