'use strict';
/* §6 source-qualified player choice, NOT a single historical canonical arrangement. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const T=require('../core/terrain_tiles');
const Setup=require('../core/scenario_starting_setup');
const E=require('../core/historical_deployment_session');
const f=require('./fixtures/kiev-source-opening-v437');
let checks=0;
const yes=(v,why)=>{assert.ok(v,why);checks++};
const eq=(a,b,why)=>{assert.deepEqual(a,b,why);checks++};
const fail=(v,why)=>{assert.equal(v,false,why);checks++};
const copy=v=>JSON.parse(JSON.stringify(v));
const args={map:f.map,spec:f.setupSpec,counterConfig:f.counterConfig,inventory:f.inventory};
const verify=(placement,allocation=f.allocation)=>Setup.validate({...args,placements:placement,allocation});
const original=verify(f.placements);
yes(original.valid,'the baseline sample obeys §6');
eq(original.startingUnitCount,30,'all §6 counters placed');
eq(original.sourceMarkerCounts,{cross:11,star:10,fixedInfantry:2,fixedMechanized:4},'source setup glyphs');
const groups=f.setupSpec.groups;
eq(groups.germanInitialPanzer.count,3,'three Polish panzer');
eq(groups.germanPolandInfantry.count,7,'seven Polish infantry');
eq(groups.germanRomaniaInfantry.count,3,'three German Romanian infantry');
eq(groups.romanianInitialArmy.count,1,'one Romanian army');
eq(groups.sovietFrontArmies.count,4,'four Soviet front Armies');
eq(groups.sovietFrontMechanized.count,6,'six front Mechanized');
eq(groups.sovietFixedArmies.count,2,'two fixed rear Soviet Armies');
eq(groups.sovietFixedMechanized.count,4,'four fixed rear Mechanized');
eq(f.setupSpec.concealedSetup.count,10,'all mechanized concealed');
const inPoland=groups.germanInitialPanzer.allowedHexes;
const inRomania=groups.romanianInitialArmy.allowedHexes;
eq(inPoland.length,7,'seven Polish cross hexes');
eq(inRomania,['0709','0809','0910','1010'],'four source-designated Romanian hexes');
const originalSerialized=JSON.stringify(f.placements);
const candidates=[];
// All four source-permitted slots can host the Romanian Army. Three German
// infantry fill the remainder, in every one of 4! distinct exact layouts.
const romanian=f.allocation.romanianInitialArmy[0],romaG=f.allocation.germanRomaniaInfantry;
function perm(a,start=0){if(start===a.length){const p={...f.placements};for(let i=0;i<4;i++)p[[romanian,...romaG][i]]=a[i];yes(verify(p).valid,'Romanian arrangement legal '+a);candidates.push(p);return}
 for(let i=start;i<a.length;i++){[a[start],a[i]]=[a[i],a[start]];perm(a,start+1);[a[start],a[i]]=[a[i],a[start]]}}
perm([...inRomania]);
eq(candidates.length,24,'all 24 source-allowed Romanian orderings accepted');
// Every choice of 3 doubled Polish cross hexes is valid; all seven retain
// at least one infantry. This is a placement rule, not a preprinted OOB.
const germanP=f.allocation.germanInitialPanzer,polishBase=f.allocation.germanPolandInfantry;
let polishCases=0;
for(let a=0;a<7;a++)for(let b=a+1;b<7;b++)for(let c=b+1;c<7;c++){
 const p={...f.placements};for(let i=0;i<7;i++)p[polishBase[i]]=inPoland[i];
 for(let i=0;i<3;i++)p[germanP[i]]=inPoland[[a,b,c][i]];
 yes(verify(p).valid,'distinct source-legal Polish triple '+[a,b,c]);polishCases++;
}
eq(polishCases,35,'all 35 Polish double-stack distributions accepted');
// Exhaustively test which four of the ten star locations can contain front
// Armies. The source only prohibits adjacency among Armies, including rear.
const star=Setup.slots(f.map,f.setupSpec).slots.star.map(x=>x.hex).sort();
const frontA=f.allocation.sovietFrontArmies,frontM=f.allocation.sovietFrontMechanized;
let sovietValid=0,sovietRejected=0,firstSoviet=null;
for(let a=0;a<10;a++)for(let b=a+1;b<10;b++)for(let c=b+1;c<10;c++)for(let d=c+1;d<10;d++){
 const chosen=[star[a],star[b],star[c],star[d]],remaining=star.filter(x=>!chosen.includes(x));
 const p={...f.placements};frontA.forEach((u,i)=>p[u]=chosen[i]);frontM.forEach((u,i)=>p[u]=remaining[i]);
 const verdict=verify(p);
 if(verdict.valid){sovietValid++;if(!firstSoviet||JSON.stringify(p)!==originalSerialized)firstSoviet=p;}
 else {sovietRejected++;yes(verdict.errors.some(e=>e.includes('Forbidden adjacent group')),'rejection due to §6 army adjacency');}
}
eq(sovietValid+sovietRejected,210,'all ten-choose-four star layouts assessed');
yes(sovietValid>1,'§6 permits multiple different Soviet placements');
yes(sovietRejected>0,'§6 forbids some Soviet Army layouts');
yes(firstSoviet&&JSON.stringify(firstSoviet)!==originalSerialized,'alternate Soviet deployment differs from sample');
yes(verify(firstSoviet).valid,'alternate Soviet deployment is legal');
// Demonstrate the engine can construct a real alternate source-certified
// initial deployment without a hand-authored/uniquely correct location list.
const changed=E.create({...args,setupSpec:f.setupSpec,allocation:f.allocation,placements:firstSoviet,
 phaseConfig:require('../maps/phase-configs/kiev.json'),movementProfile:require('../maps/movement-configs/kiev.json'),phaseFactories:{combat:()=>({})}});
eq(Object.keys(changed.snapshot().units).length,30,'alternate deployment generates 30 source counters');
for(const u of Object.values(changed.snapshot().units))yes(u.openingHex===u.hex,'alternate source openingHex preserved');
const illegal=(edit,needle)=>{const p=copy(f.placements);edit(p);const r=verify(p);fail(r.valid,needle);yes(r.errors.some(e=>e.includes(needle)),needle+' reported');};
illegal(p=>{p[germanP[0]]='0709'},'Outside source-approved group region');
illegal(p=>{p[romanian]='0203'},'Outside source-approved group region');
illegal(p=>{p[frontA[0]]='0203'},'Wrong source marker');
illegal(p=>{delete p[frontM[0]]},'Every starting face must have exactly one placement');
illegal(p=>{p[frontM[0]]=p[frontM[1]]},'Occupancy distribution mismatch');
// Two Armies deliberately made adjacent with matching star/marker occupancy.
let illegalAdj=null;
outer:for(const a of star)for(const b of star){if(a===b)continue;
 const ca=f.map.cells.find(c=>c.id===a);
 if(!T.DIRS.some(d=>T.neighbor(ca,d,f.map.geometry)===b))continue;
 const chosen=[a,b];const rest=star.filter(x=>!chosen.includes(x));
 for(let i=0;i<rest.length;i++)for(let j=i+1;j<rest.length;j++){
  const chosenFour=[...chosen,rest[i],rest[j]],remaining=star.filter(x=>!chosenFour.includes(x));
  const p={...f.placements};frontA.forEach((id,k)=>p[id]=chosenFour[k]);frontM.forEach((id,k)=>p[id]=remaining[k]);
  const r=verify(p);
  if(!r.valid&&r.errors.some(e=>e.includes('Forbidden adjacent group'))){illegalAdj=r;break outer;}
 }
}
yes(illegalAdj,'adjacent Soviet Armies rejected independent of occupancy');
// §6 is not a unit-ID-to-hex historical reenactment specification.
const digest=x=>crypto.createHash('sha256').update(fs.readFileSync(x)).digest('hex');
const report={checkpoint:255,version:'v489',status:'PASS',meaning:'Source-constrained variable player deployment, NOT a uniquely prescribed historical initial allocation',
 source:'references/rules/kiev-rules.pdf printed p.2 §6.0, steps 2–9',sourceSha256:digest('references/rules/kiev-rules.pdf'),
 checks,examples:{romanianPermutations:candidates.length,polishTripleLocations:polishCases,sovietStarCombinations:210,sovietLegal:sovietValid,sovietRejected:sovietRejected},
 unresolved:['Exact photographed counter-ID positions are not prescribed by §6; avoid inventing a canonical arrangement','Movement/source-coordinate disputes and broader combat/AI acceptance remain separate']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/kiev-rulebook-setup-qualification-v489.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Kiev §6 variable deployment qualification',checks,'checks',report.examples);
