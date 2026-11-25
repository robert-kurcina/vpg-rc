'use strict';
// v317 observable legacy behavior characterization. No claim of independent Oberlabs parity.
const assert=require('node:assert/strict');
const E=require('../../legacy/engine');
const sc=require('../../legacy/data/scenario.json');
const profiles=require('../../legacy/data/rules_profiles.json');
const c=E.buildScenario(sc,profiles.profiles[profiles.defaultRuleset]);
let pair;
for(const h of c.raw.hexes){
 if(h.terrain!=='open'||(h.city&&h.city!=='none'))continue;
 const n=E.neighbours(c,h.x,h.y).find(n=>E.hexAt(c,n.x,n.y)?.terrain==='open');
 if(n){pair={h,n};break;}
}
assert.ok(pair);
function fresh(){
 const s=E.makeState(c,3388);s.turn=2;s.side='german';s.phase='combat';
 for(const u of s.units){u.position=null;u.strength='dead';}
 const a=s.units.find(u=>u.army==='german');
 const d=s.units.find(u=>u.army==='soviet');
 Object.assign(a,{position:{x:pair.n.x,y:pair.n.y},strength:'full',combatFull:24,combatReduced:12});
 Object.assign(d,{position:{x:pair.h.x,y:pair.h.y},strength:'full',combatFull:4,combatReduced:2});
 assert.ok(E.battleOdds(c,s,[a],d).odds>=1);
 return {s,a,d};
}
let checks=0;
for(const options of [{advanceId:'not-a-unit'},{retreatTo:{x:999,y:999}},{exchangeOrder:['not-a-unit']},{attackerLossId:'not-a-unit'}]){
 const {s,a,d}=fresh();
 const before=JSON.parse(JSON.stringify(s));
 assert.throws(()=>E.resolveAttack(c,s,[a.id],d.id,null,options));
 assert.notEqual(s.seed,before.seed,'Current resolver draws a die before validating explicit choices');
 assert.deepEqual({...s,seed:before.seed},before,'Rejected choice must not change anything except PRNG state');
 checks++;
 const {s:explicit,a:aa,d:dd}=fresh();const snapshot=JSON.stringify(explicit);
 assert.throws(()=>E.resolveAttack(c,explicit,[aa.id],dd.id,1,options));
 assert.equal(JSON.stringify(explicit),snapshot,'Explicit die leaves state unchanged on rejection');
 checks++;
}
console.log(`PASS ${checks} invalid-choice RNG behavior checks; implicit die is consumed on rejection (documented parity gap)`);
