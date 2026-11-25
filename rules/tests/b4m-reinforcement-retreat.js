'use strict';
// Rulebook-derived boundary tests (§§9.3, 11); separate from frozen AI replay.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../../legacy/engine.js');
const root=path.resolve(__dirname,'../..');
const data=JSON.parse(fs.readFileSync(path.join(root,'legacy/data/scenario.json')));
const profiles=JSON.parse(fs.readFileSync(path.join(root,'legacy/data/rules_profiles.json')));
const c=E.buildScenario(data,profiles.profiles[profiles.defaultRuleset]);
function state(turn=4,side='soviet') {const s=E.makeState(c,123456);s.turn=turn;s.side=side;return s;}
const shock=state().units.find(u=>u.army==='soviet'&&u.type==='shock');
assert.ok(shock,'Scenario has the 1st Shock Army');
assert.ok(!shock.position,'1st Shock Army starts off-map');
for(const turn of [1,2,3,5,6,7])assert.deepEqual(E.shockReinforcementOptions(c,state(turn)),[],`No turn-${turn} arrival`);
assert.deepEqual(E.shockReinforcementOptions(c,state(4,'german')),[],'German turn not eligible');
const s=state();
const options=E.shockReinforcementOptions(c,s);
assert.ok(options.length>0,'Legal eastern edge entry sites present');
for(const o of options){
 const h=E.hexAt(c,o.x,o.y);
 assert.ok(h.sovietReplacement,'§11 entry must be red-border hex');
 assert.equal(E.occupant(s,o.x,o.y),null,'§11 cannot enter occupied hex');
}
const blocked=state();
const target=E.shockReinforcementOptions(c,blocked)[0];
const occupiedUnit=blocked.units.find(u=>u.army==='soviet'&&u.position);
occupiedUnit.position={...target};
assert.ok(!E.shockReinforcementOptions(c,blocked).some(o=>o.x===target.x&&o.y===target.y),'Occupied entry removed');
assert.equal(E.performShockReinforcement(c,s,target),true,'Full-strength free arrival');
const placed=s.units.find(u=>u.id===shock.id);
assert.deepEqual(placed.position,target);
assert.equal(placed.strength,'full');
assert.equal(s.log.at(-1).replacementCost,0);
assert.deepEqual(E.shockReinforcementOptions(c,s),[],'Cannot arrive a second time');
// §9.3 requires all intermediate retreat hexes to increase the distance from origin;
// valid endpoints are empty, outside enemy ZOC, at least two hexes away.
let checked=0;
for(const army of ['german','soviet']){
 const t=state(2,army);
 for(const defender of t.units.filter(u=>u.army===army&&u.position)){
  const origin=defender.position;
  for(const r of E.retreatOptions(c,t,defender)){
   checked++;
   assert.ok(r.path.length>=2);
   assert.deepEqual(r.path.at(-1),{x:r.x,y:r.y});
   assert.equal(E.occupant(t,r.x,r.y),null,'Endpoint must be vacant');
   assert.ok(E.dist(origin.x,origin.y,r.x,r.y)>=2);
   r.path.forEach((p,i)=>assert.equal(E.dist(origin.x,origin.y,p.x,p.y),i+1,'No lateral/zigzag retreat'));
   assert.ok(r.cost<=1,'At most one enemy ZOC transit');
  }
 }
}
assert.ok(checked>0,'Retreat checks are not vacuous');
console.log(`PASS B4M reinforcement and retreat bounds (${options.length} entry hexes, ${checked} retreat paths)`);
