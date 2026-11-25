'use strict';
// Independently asserted checks grounded in printed B4M §§5, 8, 10, 12.
const assert=require('assert'),fs=require('fs'),path=require('path');
const E=require('../../legacy/engine.js');
const base=path.resolve(__dirname,'../..');
const data=JSON.parse(fs.readFileSync(path.join(base,'legacy/data/scenario.json')));
const profiles=JSON.parse(fs.readFileSync(path.join(base,'legacy/data/rules_profiles.json')));
const c=E.buildScenario(data,profiles.profiles[profiles.defaultRuleset]);
function state(turn,side='german'){const s=E.makeState(c,271828);s.turn=turn;s.side=side;return s;}
const s=state(1);
assert.equal(s.units.filter(u=>u.army==='german'&&u.position).length,22,'§6 setup: 22 German units');
assert.equal(E.isMud(c,state(2)),false);
assert.equal(E.isMud(c,state(3)),true);
assert.equal(E.isMud(c,state(4)),true);
assert.equal(E.isMud(c,state(5)),false);
// §12.1: mud reduces *all* non-rail movement to at most one hex.
for(const turn of [3,4])for(const u of state(turn).units.filter(u=>u.army==='german'&&u.position)){
 const ss=state(turn),unit=ss.units.find(x=>x.id===u.id);
 for(const dest of E.legalMoves(c,ss,unit))assert.equal(dest.path.length,1,`§12.1 ${u.id} movement`);
}
// §§10, 12: the canonical profile keeps 4 Soviet replacements on mud turns.
for(const turn of [3,4])assert.equal(E.replacementBudget(c,state(turn,'soviet')),4);
assert.equal(E.replacementBudget(c,state(2,'soviet')),5);
assert.equal(E.replacementBudget(c,state(1,'german')),0);
assert.equal(E.replacementBudget(c,state(2,'german')),1);
// §5: end-of-turn-seven classification, including the draw case.
const m=c.profile.victory.moscow.join(',');const other=c.cities.find(x=>`${x.x},${x.y}`!==m);assert(other);
let v=state(7);v.control[m]='german';assert.equal(E.gameResult(c,v),'german');
v.control[m]='soviet';v.control[`${other.x},${other.y}`]='soviet';assert.equal(E.gameResult(c,v),'soviet');
for(const h of c.cities)if(`${h.x},${h.y}`!==m)v.control[`${h.x},${h.y}`]='german';assert.equal(E.gameResult(c,v),'draw');
// §5: no victory adjudication before finishing Soviet turn seven.
let t=state(7,'german');E.endSide(c,t);assert.equal(t.over,false);assert.equal(t.side,'soviet');
E.endSide(c,t);assert.equal(t.over,true);assert.equal(t.phase,'finished');
console.log('PASS B4M source-based assertions: mud timing/movement, replacements, victory and setup');
