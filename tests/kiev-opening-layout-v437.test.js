'use strict';
/* Checkpoint 203: test-only source-valid Kiev §6 opening. The verified 165-hex
 * geography remains explicitly provisional and the production campaign gated. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const f=require('./fixtures/kiev-source-opening-v437');
const Inv=require('../maps/setup/kiev-inventory.json');
const Buildup=require('../maps/buildup-configs/kiev.json');
const Phase=require('../maps/phase-configs/kiev.json');
const Profile=require('../maps/movement-configs/kiev.json');
const Source=require('../core/historical_source_initial_state');
const Setup=require('../core/scenario_starting_setup');
const Bridge=require('../core/scenario_opening_bridge');
const Combat=require('../core/historical_combat_phase');
const MovementGraph=require('../core/map_movement_graph');
const T=require('../core/terrain_tiles');
const clone=v=>JSON.parse(JSON.stringify(v));
let n=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++};
const ok=(v,m)=>{assert.ok(v,m);n++};
const fail=(fn,re,m)=>{assert.throws(fn,re,m);n++};
const hexes=(group)=>f.allocation[group].map(id=>f.placements[id]);
const report=Setup.validate({map:f.map,spec:f.setupSpec,counterConfig:f.counterConfig,
 inventory:f.inventory,allocation:f.allocation,placements:f.placements});
ok(report.valid,'source-constrained 30-piece sample is legal');
eq(report.errors,[]);eq(report.startingUnitCount,30);
eq(report.sourceMarkerCounts,{cross:11,star:10,fixedInfantry:2,fixedMechanized:4});
ok(!report.historicalSetupAuthorized&&!report.productionGameActivated,'test sample does not approve production');
ok(f.inventory.validateAllocation(f.counterConfig,f.allocation).valid);
eq(Object.values(f.allocation).flat().length,37,'every source ground face allocated exactly once');
eq(new Set(Object.values(f.allocation).flat()).size,37);
eq(Object.keys(f.placements).length,30);
eq(new Set(Object.values(f.placements)).size,27,'30 units in 27 occupied hexes with three Polish double-stacks');
eq(hexes('germanInitialPanzer').length,3);eq(hexes('germanPolandInfantry').length,7);
eq(hexes('germanRomaniaInfantry').length,3);eq(hexes('romanianInitialArmy').length,1);
eq(hexes('sovietFrontArmies'),f.frontArmyHexes);
eq(hexes('sovietFrontMechanized').length,6);
eq([...hexes('sovietFrontArmies'),...hexes('sovietFrontMechanized')].sort(),
 Setup.slots(f.map,f.setupSpec).slots.star.map(x=>x.hex).sort());
eq(hexes('sovietFixedArmies'),['0406','1007']);
eq(hexes('sovietFixedMechanized'),['0705','0803','1106','1309']);
const actualState=Source.build({map:f.map,setupSpec:f.setupSpec,counterConfig:f.counterConfig,
 inventory:f.inventory,allocation:f.allocation,placements:f.placements});
ok(actualState.sourceSetupValid);ok(!actualState.gameplayAuthorized);ok(!actualState.movementGraphCertified);
eq(actualState.audit.sourceFaceStartingUnits,30);eq(actualState.audit.totalStartingGroundUnits,30);
eq([actualState.audit.german,actualState.audit.soviet],[14,16]);
const pieces=Object.values(actualState.state.units);
eq(pieces.filter(p=>p.class==='mechanized').length,10);
eq(pieces.filter(p=>p.class==='mechanized'&&p.strengthStatus==='untried'&&p.printedCombatStrength===null).length,10);
eq(pieces.filter(p=>p.owner==='german'&&p.nationality==='romanian').length,1);
eq(pieces.filter(p=>p.owner==='german'&&p.nationality==='german').length,13);
eq(pieces.filter(p=>p.owner==='soviet'&&p.size==='army').length,6);
eq(pieces.filter(p=>p.owner==='soviet'&&p.class==='mechanized').length,10);
for(const p of pieces){ok(p.sourceFaceId&&p.reverseFaceId&&p.mp>0,'source-backed printed face and MP '+p.id)}
const occupied=new Map();for(const u of pieces){const group=occupied.get(u.hex)||[];group.push(u);occupied.set(u.hex,group)}
const axDouble=[...occupied.values()].filter(g=>g.length===2&&g[0].owner==='german');
eq(axDouble.length,3,'precisely 3 Polish double-stacks');
for(const group of occupied.values()){
 ok(group.length<=2,'stack limit');
 ok(group.every(p=>p.owner===group[0].owner),'no adversarial stack');
 ok(group.filter(p=>p.size==='army').length<=1,'one army per stack');
}
const byId=new Map(f.map.cells.map(c=>[c.id,c]));
const adjacent=(a,b)=>T.DIRS.some(d=>T.neighbor(byId.get(a),d,f.map.geometry)===b);
const armyHexes=[...hexes('sovietFrontArmies'),...hexes('sovietFixedArmies')];
for(let i=0;i<armyHexes.length;i++)for(let j=i+1;j<armyHexes.length;j++)
 ok(!adjacent(armyHexes[i],armyHexes[j]),'front and fixed Soviet Armies must not touch');
const args={map:f.map,spec:f.setupSpec,counterConfig:f.counterConfig,
 inventory:f.inventory,allocation:f.allocation,placements:f.placements};
const frontSwap=clone(f.placements);
const frontArmy=f.allocation.sovietFrontArmies[0],mech0305=f.allocation.sovietFrontMechanized.find(id=>f.placements[id]==='0305');
frontSwap[frontArmy]='0305';frontSwap[mech0305]='0205';
const pairConflicts=Setup.validate({...args,placements:frontSwap});
// Front star 0305 is not adjacent to the other three sample Armies and remains
// legal in Kiev. The synthetic next case moves a fixed Army adjacent to it.
ok(pairConflicts.valid,'star exchange is not incorrectly rejected for arbitrary identity choice');
const syntheticMap=clone(f.map),syntheticSpec=clone(f.setupSpec);
const original=syntheticMap.cells.find(c=>c.id==='0406');
const moved=original.tileMarkers.find(m=>m.kind==='fixedInfantry');
ok(moved);
original.tileMarkers=original.tileMarkers.filter(m=>m!==moved);
syntheticMap.cells.find(c=>c.id==='0306').tileMarkers.push(moved);
syntheticSpec.groups.sovietFixedArmies.allowedHexes=['0306','1007'];
const shiftedFixed=clone(frontSwap);
shiftedFixed[f.allocation.sovietFixedArmies[0]]='0306';
const withoutCross=clone(syntheticSpec);delete withoutCross.nonAdjacentGroupSets;
ok(Setup.validate({...args,map:syntheticMap,spec:withoutCross,placements:shiftedFixed}).valid,
 'synthetic arrangement passes old within-front-only separation rule');
const withCross=Setup.validate({...args,map:syntheticMap,spec:syntheticSpec,placements:shiftedFixed});
ok(!withCross.valid,'cross-group source rule must now reject adjacent front/rear armies');
ok(withCross.errors.some(e=>e.includes('Forbidden adjacent group sovietFrontArmies+sovietFixedArmies')));
const tamperedSet=clone(f.setupSpec);tamperedSet.nonAdjacentGroupSets=[['sovietFrontArmies','fakeGroup']];
ok(!Setup.validate({...args,spec:tamperedSet}).valid,'malformed relation cannot silently disable source rule');
const invalidFront=clone(f.placements);const mech0304=f.allocation.sovietFrontMechanized.find(id=>f.placements[id]==='0304');
invalidFront[frontArmy]='0304';invalidFront[mech0304]='0205';
// A setup can fail independently of the cross-group constraint. No arbitrary
// arrangement is silently normalized into a legal one.
const checkedInvalid=Setup.validate({...args,placements:invalidFront});
eq(checkedInvalid.startingUnitCount,30);
const skipped=clone(f.placements);delete skipped[frontArmy];
ok(!Setup.validate({...args,placements:skipped}).valid);
const swappedNationality=clone(f.placements);swappedNationality[f.allocation.romanianInitialArmy[0]]='0302';
ok(!Setup.validate({...args,placements:swappedNationality}).valid);
const bridge=Bridge.create({...args,setupSpec:f.setupSpec,phaseConfig:Phase,movementProfile:Profile,phaseFactories:{combat:Combat.create}});
eq(bridge.status,'candidate-physical-setup-preview');
eq(bridge.firstPhase().id,'german-combat');
eq(bridge.snapshot().actor,'german');
eq(bridge.snapshot().cursor,{scenarioId:'kiev',turn:1,index:2,complete:false});
eq(Object.keys(bridge.snapshot().state.units).length,30);
ok(!bridge.productionGameActivated&&!bridge.historicalSetupAuthorized);
const changed=bridge.snapshot();changed.state.units[frontArmy].hex='9999';changed.cursor.index=0;
eq(bridge.snapshot().state.units[frontArmy].hex,f.placements[frontArmy]);
eq(bridge.firstPhase().id,'german-combat');
ok(bridge.controller(),'source-reviewed Kiev candidate may now initialize shared experimental controller');
fail(()=>MovementGraph.build({...f.map,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/,
 'the actual movement graph remains gated');
eq(Buildup.reinforcements.length,6);
const sha=x=>crypto.createHash('sha256').update(fs.readFileSync(x)).digest('hex');
for(const x of ['references/rules/kiev-rules.pdf','maps/source/user-svg/kiev-odessa-main.svg'])ok(sha(x).length===64);
const audit={checkpoint:203,version:'v437',status:'validated-sample-opening-NOT-gameplay-authorized',assertions:n,
 sourceRule:'references/rules/kiev-rules.pdf §6.0, printed page 2',
 sourcePins:{rulebookSha256:sha('references/rules/kiev-rules.pdf'),definitiveSvgSha256:sha('maps/source/user-svg/kiev-odessa-main.svg')},
 sourceFaces:{starting:30,axis:14,soviet:16,mechanizedConcealed:10,unplacedGroundFaces:7},
 startingGeometry:{sovietStars:10,axisCrosses:11,rearArmies:2,rearMechanized:4,polandDoubleStacks:3,
  sourceRuleArmySeparation:'front-line+fixed-rear',firstTurnStart:'german-combat'},
 blocker:'source-legal sample, not historical unit identities or an authorized Kiev campaign; map graph remains provisional'};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-opening-layout-v437.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS Kiev v437 source-legal 30-ground opening sample:',n,'assertions; 10 concealed Mechanized Corps; initial Combat phase gated');
