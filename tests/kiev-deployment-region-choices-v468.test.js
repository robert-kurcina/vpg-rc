'use strict';
/* v468: Candidate Kiev setup is player-configurable within source-verified
 * national and rear/front marker regions. No live game authorization. */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const fixture=require('./fixtures/kiev-source-opening-v437');
const Deployment=require('../core/historical_deployment_session');
const Graph=require('../core/map_movement_graph');
const Phase=require('../maps/phase-configs/kiev.json');
const Profile=require('../maps/movement-configs/kiev.json');
const Counter=require('../maps/counter-configs/kiev.json');
const SourceIndex=require('../references/rules/SOURCE_INDEX.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const source={map:fixture.map,setupSpec:fixture.setupSpec,counterConfig:fixture.counterConfig,
 inventory:fixture.inventory,phaseConfig:Phase,movementProfile:Profile,
 phaseFactories:{combat:()=>({})}};
let assertions=0;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);assertions++};
const yes=(value,message)=>{assert.ok(value,message);assertions++};
const fails=(fn,re,message)=>{assert.throws(fn,re,message);assertions++};
const starting=()=>Deployment.create({...source,allocation:fixture.allocation,placements:fixture.placements});
const d=starting(),initial=d.snapshot(),groups=d.groups();
eq(Object.keys(initial.units).length,30,'all 30 photographed starting units present');
const first=Object.keys(fixture.allocation).filter(g=>groups[g]);
const groupChoice={};
for(const group of first){
 const face=fixture.allocation[group][0],g=groups[group],chosen=d.choices(face);
 const eligible=(g.allowedHexes||require('../core/scenario_starting_setup').slots(fixture.map,fixture.setupSpec).slots[g.marker].map(s=>s.hex)).slice().sort();
 eq(chosen,eligible,`${group}: only rulebook-eligible marker hexes advertised`);
 yes(chosen.includes(initial.placements[face]),`${group}: current position remains a choice`);
 groupChoice[group]=chosen;
}
const Poland=groups.germanInitialPanzer.allowedHexes.slice().sort();
const Romania=groups.germanRomaniaInfantry.allowedHexes.slice().sort();
eq(Poland,['0105','0203','0204','0301','0302','0303','0402']);
eq(Romania,['0709','0809','0910','1010']);
eq(groupChoice.germanInitialPanzer,Poland);
eq(groupChoice.germanPolandInfantry,Poland);
eq(groupChoice.germanRomaniaInfantry,Romania);
eq(groupChoice.romanianInitialArmy,Romania);
for(const group of ['germanInitialPanzer','germanPolandInfantry']){
 const id=fixture.allocation[group][0];
 for(const h of Romania){
  yes(!d.choices(id).includes(h),`${group}: no Romania destination in UI catalogue`);
  fails(()=>d.move(id,h),/source-approved deployment marker/,`${group}: no Romanian move`);
 }
}
for(const group of ['germanRomaniaInfantry','romanianInitialArmy']){
 const id=fixture.allocation[group][0];
 for(const h of Poland){
  yes(!d.choices(id).includes(h),`${group}: no Poland destination in UI catalogue`);
  fails(()=>d.move(id,h),/source-approved deployment marker/,`${group}: no Polish move`);
 }
}
for(const group of ['sovietFixedArmies','sovietFixedMechanized']){
 const id=fixture.allocation[group][0];
 yes(d.choices(id).every(x=>groups[group].allowedHexes.includes(x)),`${group}: rear-only positions`);
 fails(()=>d.move(id,'0708'),/source-approved deployment marker/,`${group}: front star forbidden`);
}
// A valid, in-country swap changes position but not source face or nationality.
const panzer=fixture.allocation.germanInitialPanzer[0];
const infantry=fixture.allocation.germanPolandInfantry.find(id=>initial.placements[id]==='0301');
const swapped=d.swapPositions(panzer,infantry);
eq(swapped.snapshot().placements[panzer],'0301');
eq(swapped.snapshot().placements[infantry],initial.placements[panzer]);
eq(swapped.snapshot().units[panzer].openingHex,'0301');
eq(swapped.snapshot().units[infantry].openingHex,initial.placements[panzer]);
eq(d.snapshot().placements,initial.placements,'original deployment immutability');
// A same-symbol cross-region position swap must still be rejected.
fails(()=>d.swapPositions(panzer,fixture.allocation.germanRomaniaInfantry[0]),/Illegal historical deployment/, 'no Polish/Romanian position swap');
// A supposedly legal marker may still have insufficient stacking capacity;
// authoritative setup verification remains required on every action.
const romaniaFace=fixture.allocation.germanRomaniaInfantry[0];
yes(d.choices(romaniaFace).includes('1010'),'Romanian marker is in the region');
fails(()=>d.move(romaniaFace,'1010'),/Illegal historical deployment/, 'source occupancy still enforced');
// Mixing must cover all ten concealed Soviet mechanized faces, not reveal
// identities or turn the provisional candidate into historical gameplay.
const concealed=fixture.setupSpec.concealedSetup;
const oldIds=concealed.groups.flatMap(group=>fixture.allocation[group]);
eq(oldIds.length,10);
fails(()=>d.commit({requireMixed:true}),/must be mixed/,'mix required before candidate handoff');
const mixed=d.permute(concealed.groups,oldIds.slice().reverse());
yes(mixed.snapshot().concealedMixed);
for(const id of oldIds){
 const u=mixed.snapshot().units[id];
 yes(u&&u.strengthStatus==='untried'&&u.printedCombatStrength===null,
  'mechanized identity remains concealed after mixing');
}
const opening=mixed.commit({requireMixed:true});
eq(opening.opening.cursor,{scenarioId:'kiev',turn:1,index:2,complete:false});
eq(opening.opening.actor,'german');
eq(Object.keys(opening.opening.state.units).length,30);
eq(opening.audit.startingUnits,30);
const saved=mixed.save();
eq(Deployment.restore(saved,source).save(),saved,'candidate setup round trips');
fails(()=>Deployment.restore({...saved,concealedMixed:false},source),/checksum/,'save tampering rejected');
eq(Graph.build(fixture.map).edges.length,442,'Kiev graph source-authorized for experimental play');
// Independently check rule source pins remain intact, not accidental test policy.
const rulePath='references/rules/kiev-rules.pdf';
const index=SourceIndex.items.find(x=>x.file==='kiev-rules.pdf');
yes(index&&crypto.createHash('sha256').update(fs.readFileSync(rulePath)).digest('hex')===index.sha256,'rulebook source pin unchanged');
const report={checkpoint:234,version:'v468',assertions,scope:'Kiev source-constrained pre-game placement choices',
 source:'kiev-rules.pdf §6.0 / source marker map and photographed counter sheets',
 groups:Object.fromEntries(Object.entries(groupChoice).map(([k,v])=>[k,v.length])),
 startingCounters:30,concealedMechanized:10,productionAuthorized:false,movementGraphCertified:false,
 status:'candidate setup validation passed; live Kiev campaign still gated'};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-deployment-region-choices-v468.json',JSON.stringify(report,null,2)+'\n');
console.log(`PASS v468 Kiev source-constrained deployment: ${assertions} assertions; live gate retained`);
