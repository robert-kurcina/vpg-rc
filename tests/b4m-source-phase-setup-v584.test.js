'use strict';
// Printed B4M §§4, 6, 10, 11, 12; production native profile, no legacy oracle.
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const E=require('../core/engine.js'),P=require('../core/native_preview_config.js');
const {original,config}=load(),g=E.build(P.project(original,config));
const s=E.start(g,17,'auto-reference');
const sov=s.units.filter(u=>u.army==='soviet'&&u.id!=='s1sh'),ger=s.units.filter(u=>u.army==='german');
assert.equal(sov.length,16);
assert.equal(sov.filter(u=>u.position).length,14);
assert.ok(sov.every(u=>u.strength==='reduced'));
assert.equal(sov.filter(u=>!u.position).length,2);
assert.equal(ger.length,22);
assert.ok(ger.every(u=>u.position&&u.strength==='full'&&g.cells.get(`${u.position.x},${u.position.y}`).germanStart));
assert.equal(E.currentPhase(g,s).id,'combat');
assert.equal(s.turn,1);
assert.equal(s.side,'german');
assert.deepEqual(E.phasesFor(g,'german').map(p=>p.id),['replacement','panzer','combat','movement']);
assert.deepEqual(E.phasesFor(g,'soviet').map(p=>p.id),['replacement','rail','combat','movement']);
for(let t=1;t<=7;t++){
 assert.equal(E.replacementBudget(g,{...s,turn:t,side:'german'}),t===1?0:1);
 assert.equal(E.replacementBudget(g,{...s,turn:t,side:'soviet'}),[3,4].includes(t)?4:5);
 assert.equal(E.weather(g,{...s,turn:t})?.name||'clear',[3,4].includes(t)?'mud':'clear');
}
const expected=[];
for(let t=1;t<=7;t++){
 for(const id of (t===1?['combat','movement']:['replacement','panzer','combat','movement']))expected.push(`${t}:german:${id}`);
 if(t===4)expected.push('4:soviet:reinforcement');
 for(const id of ['replacement','rail','combat','movement'])expected.push(`${t}:soviet:${id}`);
}
const seen=[];let arrivals=0;
while(!s.over&&seen.length<60){
 const phase=E.currentPhase(g,s);seen.push(`${s.turn}:${s.side}:${phase.id}`);
 if(phase.kind==='reinforcement'){
  assert.equal(s.turn,4);assert.equal(s.side,'soviet');
  const options=E.reinforcementOptions(g,s);assert.ok(options.length);
  assert.ok(options.every(p=>g.cells.get(`${p.x},${p.y}`).sovietReplacement&&!E.unitAt(s,p.x,p.y)&&!E.enemyZoc(g,s,p.x,p.y,'soviet')));
  assert.equal(E.endPhase(g,s),false);
  assert.ok(E.placeReinforcement(g,s,'s1sh',options[0].x,options[0].y));
  assert.equal(s.units.find(u=>u.id==='s1sh').strength,'full');arrivals++;
 }
 assert.equal(E.endPhase(g,s),true);
}
assert.deepEqual(seen,expected);
assert.equal(arrivals,1);
assert.equal(s.over,true);
assert.equal(s.turn,8);
assert.equal(E.currentPhase(g,s),null);
assert.equal(E.endPhase(g,s),false);
console.log(JSON.stringify({status:'PASS',phases:seen.length,shockArrivals:arrivals,turns:s.turn-1}));
