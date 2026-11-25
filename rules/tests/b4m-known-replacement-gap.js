'use strict';
// User-authorized ruling: an off-map replacement enters reduced and cannot
// be restored in the same player's turn, even if replacement points remain.
const assert=require('node:assert/strict');
const E=require('../../legacy/engine');
const sc=require('../../legacy/data/scenario.json');
const profiles=require('../../legacy/data/rules_profiles.json');
const c=E.buildScenario(sc,profiles.profiles[profiles.defaultRuleset]);
const fresh=()=>{const s=E.makeState(c,2026);s.turn=2;s.side='soviet';s.phase='replacement';return s;};
let verified=0;
for(const entry of E.replacementOptions(c,fresh()).filter(o=>o.type==='enter').slice(0,30)){
 const s=fresh();
 assert.equal(E.applyReplacement(c,s,entry),true);
 const u=s.units.find(v=>v.id===entry.id);
 assert.equal(u.strength,'reduced');
 assert.equal(E.replacementOptions(c,s).some(o=>o.type==='restore'&&o.id===u.id),false);
 const before=JSON.stringify(s);
 assert.equal(E.applyReplacement(c,s,{type:'restore',id:u.id}),false);
 assert.equal(JSON.stringify(s),before,'illegal restoration mutated state');
 // A later turn permits restoration when communication is available.
 s.turn=3;
 const eligible=E.replacementOptions(c,s).some(o=>o.type==='restore'&&o.id===u.id);
 if(eligible){assert.equal(E.applyReplacement(c,s,{type:'restore',id:u.id}),true);assert.equal(u.strength,'full');}
 verified++;
}
assert.ok(verified>0,'No legal replacement entry available for regression test');
// Existing on-board reduced units retain normal restoration eligibility.
{
 const s=fresh();const opts=E.replacementOptions(c,s).filter(o=>o.type==='restore');
 if(opts.length) assert.equal(E.applyReplacement(c,s,opts[0]),true);
}
console.log(`PASS B4M user ruling: ${verified} entries stay reduced this turn; eligible later-turn restores still work`);
