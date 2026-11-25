'use strict';
// Synthetic combinatorial stress fixture (not a historical Leningrad map).
// Its purpose is to prove that a deliberately skipped defender-order search
// cannot certify or execute a shorter, casualty-producing fallback.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../core/historical_forced_retreat.js'),'utf8');
const policy={scenarioId:'stress-fixture',retreatMode:'source-forced-ezoc-v1',retreatHexes:2,
 armyStackingByOwner:{soviet:1}};
const profile={id:'stress-fixture',maxStack:2};
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(branches,{midEZOC=true}={}){
 const root='ORIGIN',safe='SAFE',extension='EXT',german='GERMAN';
 const cells={},edges=[];
 const addCell=id=>{cells[id]={verified:true,terrain:'open'};};
 const addEdge=(a,b)=>{addCell(a);addCell(b);edges.push({a,b,verified:true,impassable:false,lake:false,allSea:false});};
 addEdge(safe,extension);
 for(let i=0;i<branches;i++){
  const mid=`MID_${i}`,dead=`DEAD_${i}`;
  addEdge(root,mid);addEdge(mid,safe);addEdge(mid,dead);if(midEZOC)addEdge(mid,german);addEdge(dead,german);
 }
 const fake=new Module('retreat-budget-test',module);
 fake.filename=require.resolve('../core/historical_forced_retreat');
 fake.require=n=>n==='./movement_binding.js'?{build:()=>({board:{cells,edges}})}:n==='./movement_rules.js'?require('../core/movement_rules'):n==='./territorial_state_transition.js'?require('../core/territorial_state_transition'):require(n);
 fake._compile(source,fake.filename);
 const engine=fake.exports.create({map:{},profile,combatPolicy:policy,counterConfig:{faces:{back:[{faceId:'synthetic-back',visualTranscription:{printedValues:'4-4'}}]}}});
 const ids=['soviet-a','soviet-b'];
 const state={units:{
  'soviet-a':{id:'soviet-a',hex:root,owner:'soviet',size:'army',strengthStatus:'printed-full',reverseFaceId:'synthetic-back'},
  'soviet-b':{id:'soviet-b',hex:root,owner:'soviet',size:'army',strengthStatus:'printed-full',reverseFaceId:'synthetic-back'},
  'german-zoc':{id:'german-zoc',hex:german,owner:'german',size:'corps',strengthStatus:'printed-full'}
 }};
 return {engine,state,ids,root};
}
let assertions=0;
const small=fixture(1),savedSmall=clone(small.state);
const resolved=small.engine.enumerate({state:small.state,defenderHex:small.root,defenderIds:small.ids});
assert.equal(resolved.status,'certified-forced-retreat-options');assertions++;
assert.equal(resolved.exhaustive,true);assertions++;
assert.equal(resolved.orderSafetySearchLimited,false);assertions++;
assert.ok(resolved.combinations.some(c=>small.ids.every(id=>c[id]&&c[id].endInEZOC===false)));assertions++;
assert.deepEqual(small.state,savedSmall);assertions++;
const big=fixture(10),savedBig=clone(big.state);
const unresolved=big.engine.enumerate({state:big.state,defenderHex:big.root,defenderIds:big.ids});
assert.equal(unresolved.orderSafetySearchLimited,true);assertions++;
assert.equal(unresolved.exhaustive,false);assertions++;
assert.equal(unresolved.status,'joint-retreat-unresolved');assertions++;
assert.ok(unresolved.combinations.length>0,'retain tentative options for diagnostics');assertions++;
assert.ok(big.ids.every(id=>unresolved.perDefender[id].options.length>8),'trigger explicit search cap');assertions++;
const paths=Object.fromEntries(big.ids.map(id=>[id,unresolved.combinations[0][id]?.route]).filter(([,r])=>r));
assert.throws(()=>big.engine.apply({state:big.state,defenderHex:big.root,defenderIds:big.ids,paths,
 loseStep:()=>{throw Error('must not be called');}}),/unresolved joint selection/);assertions++;
assert.deepEqual(big.state,savedBig,'refused transaction must be atomic');assertions++;
// No-independent-option positions were previously sent into the expensive
// permutation search regardless of size. Large such states now fail closed.
const noIndependent=fixture(10,{midEZOC:false});
const beforeNoIndependent=clone(noIndependent.state);
const skipped=noIndependent.engine.enumerate({state:noIndependent.state,defenderHex:noIndependent.root,defenderIds:noIndependent.ids});
assert.equal(skipped.orderDiscoveryLimited,true);assertions++;
assert.equal(skipped.exhaustive,false);assertions++;
assert.equal(skipped.status,'joint-retreat-unresolved');assertions++;
assert.deepEqual(noIndependent.state,beforeNoIndependent);assertions++;

console.log(`PASS v398: ${assertions} bounded retreat certification assertions`);
if(process.argv.includes('--write-audit')){
 const out={checkpoint:164,version:'v398',assertions,sourceFixture:'synthetic combinatorial graph; not historical map evidence',
 small:{status:resolved.status,exhaustive:resolved.exhaustive},large:{status:unresolved.status,
 exhaustive:unresolved.exhaustive,orderSafetySearchLimited:unresolved.orderSafetySearchLimited,
 candidateChoices:unresolved.combinations.length,optionsPerDefender:unresolved.perDefender[big.ids[0]].options.length},
 noIndependent:{status:skipped.status,exhaustive:skipped.exhaustive,orderDiscoveryLimited:skipped.orderDiscoveryLimited},
 safety:'Unverified survivor-preserving joint orders cannot authorize a known fatal retreat',
 constraints:['This test does not certify historical graph coordinates','Large joint-retreat search remains incomplete']};
 fs.writeFileSync(path.join(__dirname,'../rules/audit/leningrad-retreat-budget-certification-v398.json'),JSON.stringify(out,null,2)+'\n');
}
