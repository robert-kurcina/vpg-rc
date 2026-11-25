'use strict';
const A=require('node:assert/strict');
const C=require('../maps/counter-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory.js');
const R=require('../core/leningrad_setup_readiness.js');
const M=require('../maps/leningrad.json');
const T=require('../core/leningrad_setup_validator.js');
const structuredClone=x=>JSON.parse(JSON.stringify(x));
let checks=0;
function ok(x){A.ok(x);checks++;}
function eq(x,y){A.deepEqual(x,y);checks++;}
const inv=I.inspect(C);ok(inv.valid);eq(inv.errors,[]);
eq(inv.sourceRearHexes,['0107','0607','1305','1606','1701']);
eq(inv.sourceRearHexNamespace,'printed-number-in-rules-pdf-not-runtime-cell-id');
eq(inv.counts.sovietInfantryCorps,4);
eq(inv.counts.sovietMechanized,4);
eq(inv.counts.sovietInfantryArmies,8);
eq(inv.counts.germanInfantry,9);
eq(inv.counts.germanPanzer,2);
eq(inv.counts.germanReinforcementInfantry,6);
eq(inv.expected.startingSovietGroundUnits,10);
eq(inv.expected.startingGermanGroundUnits,9);
eq(inv.expected.totalGroundCountersIncludingMilitia,28);
ok(!inv.historicalSetupAuthorized);
const pick=(pool,n,exclude=[])=>inv.pools[pool].filter(x=>!exclude.includes(x)).slice(0,n);
const germanTurn4=pick('germanReinforcementInfantry',2);
const sovietFrontArmies=pick('sovietInfantryArmies',2);
const sovietTurn4=pick('sovietInfantryArmies',1,sovietFrontArmies);
const sovietTurn5=pick('sovietInfantryArmies',1,[...sovietFrontArmies,...sovietTurn4]);
const sovietTurn6=pick('sovietInfantryArmies',1,[...sovietFrontArmies,...sovietTurn4,...sovietTurn5]);
const sovietTurn7=pick('sovietInfantryArmies',2,[...sovietFrontArmies,...sovietTurn4,...sovietTurn5,...sovietTurn6]);
const sovietTurn8=pick('sovietInfantryArmies',1,[...sovietFrontArmies,...sovietTurn4,...sovietTurn5,...sovietTurn6,...sovietTurn7]);
const good={
 germanInitialInfantry:pick('germanInfantry',9,germanTurn4),
 germanInitialPanzer:pick('germanPanzer',2),
 germanTurn4Infantry:germanTurn4,
 sovietTurn3WorkersMilitia:pick('workersMilitia',1),
 sovietRearInfantryCorps:pick('sovietInfantryCorps',3),
 sovietRearMechanizedCorps:pick('sovietMechanized',2),
 sovietFrontInfantryCorps:pick('sovietInfantryCorps',1,pick('sovietInfantryCorps',3)),
 sovietFrontMechanizedCorps:pick('sovietMechanized',2,pick('sovietMechanized',2)),
 sovietFrontArmies,
 sovietTurn4Army:sovietTurn4,sovietTurn5Army:sovietTurn5,sovietTurn6Army:sovietTurn6,
 sovietTurn7Armies:sovietTurn7,sovietTurn8Army:sovietTurn8
};
const report=I.validateAllocation(C,good);ok(report.valid);eq(report.initialTotalGround,19);eq(report.totalGroundCounters,28);
// The printed rules specify two 6-4 German reinforcements without naming
// particular corps: every 2-of-6 source-face choice must remain available.
for(let i=0;i<inv.pools.germanReinforcementInfantry.length;i++)for(let j=i+1;j<inv.pools.germanReinforcementInfantry.length;j++){
 const picked=[inv.pools.germanReinforcementInfantry[i],inv.pools.germanReinforcementInfantry[j]];
 const trial={...good,germanTurn4Infantry:picked,germanInitialInfantry:pick('germanInfantry',9,picked)};
 ok(I.validateAllocation(C,trial).valid);
}

ok(!report.positionsVerified);ok(!report.historicalSetupAuthorized);
const modified=(key,replacement)=>({...good,[key]:replacement});
function invalid(x,pattern){const r=I.validateAllocation(C,x);ok(!r.valid);if(pattern)ok(r.errors.some(y=>pattern.test(y)),r.errors.join('\n'));}
invalid(modified('sovietTurn3WorkersMilitia',[]),/count/);
invalid(modified('sovietTurn3WorkersMilitia',good.sovietTurn8Army),/Invalid source face/);
invalid(modified('sovietRearInfantryCorps',good.sovietRearInfantryCorps.slice(1)),/count/);
invalid(modified('sovietRearMechanizedCorps',good.sovietRearMechanizedCorps.slice(1)),/count/);
invalid(modified('sovietFrontArmies',good.sovietFrontArmies.concat(good.sovietTurn4Army)),/count/);
invalid(modified('germanTurn4Infantry',good.germanInitialInfantry.slice(0,2)),/Invalid source face/);
invalid(modified('sovietFrontMechanizedCorps',good.sovietRearMechanizedCorps),/allocated twice/);
invalid(modified('germanInitialInfantry',[...good.germanInitialInfantry.slice(1),good.germanInitialPanzer[0]]),/Invalid source face/);
invalid({...good,extraneousGroup:[]},/Unknown allocation/);
invalid(modified('sovietTurn8Army',['leningrad-front-r04c06']),/Invalid source face/);
A.throws(()=>I.validateAllocation(C,null),/Explicit/);checks++;
let changed=structuredClone(C);
changed.faces.front.find(f=>f.faceId===inv.pools.sovietMechanized[0]).visualTranscription.kind='garrison';
ok(!I.inspect(changed).valid);
changed=structuredClone(C);changed.faces.back.find(f=>f.faceId==='leningrad-back-r01c01').visualTranscription.kind='garrison';
ok(!I.inspect(changed).valid);
changed=structuredClone(C);changed.faces.front.find(f=>f.faceId===inv.pools.sovietMechanized[0]).pairedFaceId='leningrad-back-r01c01';
ok(!I.inspect(changed).valid);
changed=structuredClone(C);
changed.faces.front.find(f=>f.visualTranscription.printedIdentifier==='WMM').visualTranscription.printedAffiliation='axis';
ok(!I.inspect(changed).valid);
eq(C.sourcePrintedUnitPairs['leningrad:soviet:infantry:WMM'].front,'leningrad-front-r04c07');
changed=structuredClone(C);changed.unitIdsVerified=true;ok(!I.inspect(changed).valid);
changed=structuredClone(C);changed.faces.front[0].unitId='soviet-22';ok(!I.inspect(changed).valid);
const readiness=R.inspect(M,C);eq(readiness.expected.sovietStartingGroundUnits,10);
eq(readiness.expected.sovietStartingMechanizedCorps,4);
eq(readiness.expected.sovietPrintedRearHexes,I.sourceRearHexes);
ok(readiness.gaps.some(x=>x.includes('rear Soviet setup positions')));
// Existing frontline-only validator must not be mistaken for full starting setup.
const frontOnly=T.validate({germanCrosses:['0109','0210','0211','0310','0411'],sovietStars:['0108','0209','0309','0410','0510'],units:[],adjacent:()=>false});
ok(!frontOnly.valid);ok(!report.historicalSetupAuthorized);
console.log(`PASS v355 source-bound Leningrad inventory / allocation: ${checks} assertions`);
