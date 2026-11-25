'use strict';
/* Source-bound Objective: Odessa §5 terminal scoring qualification.
 * This is a DIAGNOSTIC evaluator on the actual combined source map, not a
 * claim that east-edge communication or the full campaign is certified.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Housekeeping=require('../core/historical_housekeeping_phase');
const Composer=require('../maps/composer');
const kiev=require('../maps/kiev.json');
const odessa=require('../maps/odessa-extension.json');
const phase=require('../maps/phase-configs/kiev-odessa.json');
const policy=require('../maps/housekeeping-configs/kiev-odessa-candidate-v521.json');
const ledger=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const map=Composer.compose(kiev,odessa);
const copy=v=>JSON.parse(JSON.stringify(v));
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const yes=(v,msg)=>{assert.ok(v,msg);checks++};
const fails=(fn,regex)=>{assert.throws(fn,regex);checks++};
const cityNames=map.cells.filter(c=>c.city?.name).map(c=>c.city.name);
const initialControl=Object.fromEntries(cityNames.map(name=>[name,policy.initialControlOverrides[name]||'soviet']));
const state=(remaining)=>({scenarioId:'kiev-odessa',units:{},cityControl:Object.fromEntries(cityNames.map(name=>
 [name,remaining.includes(name)?'soviet':'german']))});
const isolation=new Set();
const hexToName=Object.fromEntries(Object.entries(policy.sourceCityHexes).map(([name,hex])=>[hex,name]));
const queries=[];
const communicate=(hex,owner,units)=>{
 assert.equal(owner,'soviet');assert.ok(hexToName[hex]);assert.ok(units&&typeof units==='object');
 queries.push(hex);
 return !isolation.has(hexToName[hex]);
};
const create=(props={})=>Housekeeping.create({map,config:phase,policy,initialCityControl:initialControl,
 communicated:communicate,...props});
const scorer=create();
eq(cityNames.length,20);
eq(ledger.cityCount,20);
eq(ledger.cities.map(c=>[c.name,c.hex]),map.cells.filter(c=>c.city).map(c=>[c.city.name,c.id]));
eq(Object.keys(policy.sourceCityHexes).length,20);
eq(Object.keys(policy.initialControlOverrides).sort(),ledger.initialAxisCities.slice().sort());
eq(initialControl['Brăila'],'german');
eq(initialControl.Iasi,'german');
eq(initialControl.Lublin,'german');
eq(cityNames.filter(n=>initialControl[n]==='soviet').length,17);
eq(phase.turns,7);
// Verify the exact three user-supplied source hashes in the existing ledger.
for(const [file,digest] of Object.entries(ledger.sourceSHA256)){
 const observed=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex');
 eq(observed,digest,'Source bytes changed: '+file);
}
let result=scorer.evaluate(state([]));
eq(result.outcome,'german-victory');
eq(result.reason,'axis-controls-all-cities');
eq(result.axisControlledCount,20);
eq(queries.length,0,'No isolation tests needed when all 20 cities are Axis-controlled');
for(const count of [0,1,4,12,17]){
 const s=state(cityNames.slice(0,20-count));
 result=scorer.evaluate(s);
 eq(result.outcome,'soviet-victory');eq(result.axisControlledCount,count);
}
eq(queries.length,0,'No isolation tests needed when Axis controls at most 17 cities');
// All 20 possible remaining Soviet cities in the 19-Axis breakpoint.
for(const city of cityNames){
 isolation.clear();queries.length=0;
 const s=state([city]);
 result=scorer.evaluate(s);
 eq(result.outcome,'draw','19 Axis and a communicating Soviet city is a draw');
 eq(result.reason,'one-remaining-city-communicating');
 eq(result.remainingSovietCities,[city]);
 eq(result.isolatedSovietCities,[]);
 eq(queries,[policy.sourceCityHexes[city]]);
 isolation.add(city);queries.length=0;
 result=scorer.evaluate(s);
 eq(result.outcome,'german-victory','19 Axis and isolated remaining city is a German win');
 eq(result.reason,'one-remaining-city-isolated');
 eq(result.isolatedSovietCities,[city]);
 eq(result.cityIsolation[city],true);
 eq(queries,[policy.sourceCityHexes[city]]);
}
// Every pair of surviving Soviet cities and every possible isolation combination.
let pairs=0;
for(let i=0;i<cityNames.length;i++)for(let j=i+1;j<cityNames.length;j++){
 const a=cityNames[i],b=cityNames[j],s=state([a,b]);pairs++;
 for(const mask of [0,1,2,3]){
  isolation.clear();queries.length=0;
  if(mask&1)isolation.add(a);if(mask&2)isolation.add(b);
  result=scorer.evaluate(s);
  eq(result.axisControlledCount,18);
  eq(result.outcome,mask===0?'soviet-victory':'draw');
  eq(result.reason,mask===0?'both-remaining-cities-communicating':'at-least-one-of-two-cities-isolated');
  eq(result.remainingSovietCities,[a,b]);
  eq(result.isolatedSovietCities,[a,b].filter(c=>isolation.has(c)));
  eq(queries,[policy.sourceCityHexes[a],policy.sourceCityHexes[b]]);
 }
}
eq(pairs,190);
// The published rule cannot be approximated by an absence of an Axis counter.
const noGraph=Housekeeping.create({map,config:phase,policy,initialCityControl:initialControl});
fails(()=>noGraph.evaluate(state(['Odessa'])),/Certified communication graph required/);
fails(()=>noGraph.evaluate(state(['Odessa','Nikolaev'])),/Certified communication graph required/);
eq(noGraph.evaluate(state([])).outcome,'german-victory');
eq(noGraph.evaluate(state(cityNames.slice(0,3))).outcome,'soviet-victory');
const nonBoolean=create({communicated:()=>undefined});
fails(()=>nonBoolean.evaluate(state(['Odessa'])),/Non-boolean source communication/);
fails(()=>nonBoolean.evaluate(state(['Odessa','Nikolaev'])),/Non-boolean source communication/);
// No added, removed, renamed, or incorrectly controlled cities.
fails(()=>scorer.evaluate({...state([]),cityControl:{}}),/Uninitialized or malformed/);
fails(()=>scorer.evaluate({...state([]),cityControl:{...state([]).cityControl,'Extra':'soviet'}}),/Uninitialized or malformed/);
fails(()=>scorer.evaluate({...state([]),cityControl:{...state([]).cityControl,'Brăila':'romania'}}),/Uninitialized or malformed/);
for(const [update,regex] of [
 [{cityCount:19},/Housekeeping city or phase/],
 [{germanVictoryAtLeast:19},/Housekeeping city or phase/],
 [{sovietVictoryAtMost:18},/Housekeeping city or phase/],
 [{draw:{...policy.draw,axisCityCount:18}},/Housekeeping city or phase/],
 [{draw:{...policy.draw,twoRemainingAxisCityCount:17}},/Housekeeping city or phase/],
 [{draw:{...policy.draw,mustBeIsolatedFromDefenderEdge:false}},/Invalid source-bound/],
 [{scenarioId:'kiev'},/Invalid source-bound/],
 [{sourceCityHexes:{...policy.sourceCityHexes,Odessa:'1514'}},/Housekeeping city or phase/],
 [{initialControlOverrides:{...policy.initialControlOverrides,'Brăila':'soviet'}},/Invalid source-bound|Housekeeping city or phase/],
 ]) fails(()=>create({policy:{...policy,...update}}),regex);
const malformedMap=copy(map);
malformedMap.cells.find(c=>c.city?.name==='Brăila').city.name='Braila';
fails(()=>create({map:malformedMap}),/Housekeeping city or phase/);
// Last-turn-only victory judgement in the canonical phase schedule.
const final={scenarioId:'kiev-odessa',turn:7,index:phase.phases.length-1,complete:false};
isolation.clear();
const early=scorer.close({cursor:{...final,turn:6},state:state(['Odessa']),actor:'system'});
eq(early.event.kind,'turn-completed');eq(early.terminal,null);
const terminal=scorer.close({cursor:final,state:state(['Odessa']),actor:'system'});
eq(terminal.event.kind,'campaign-completed');eq(terminal.terminal.outcome,'draw');
fails(()=>scorer.close({cursor:{...final,index:2},state:state([]),actor:'system'}),/Housekeeping requires/);
fails(()=>scorer.close({cursor:final,state:state([]),actor:'german'}),/Housekeeping requires/);
console.log('PASS v521 Odessa source-bound two-tier victory evaluator:',checks,'assertions;',pairs,'city pairs evaluated across four isolation combinations');
