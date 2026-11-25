'use strict';
const assert=require('node:assert/strict');
const E=require('../legacy/engine');
const Session=require('../core/session');
const AI=require('../core/solo_ai');
const raw=require('../legacy/data/scenario.json');
const profiles=require('../legacy/data/rules_profiles.json');
const config=E.buildScenario(raw,profiles.profiles[profiles.defaultRuleset]);
let checks=0;
function check(condition,message){assert.ok(condition,message);checks++;}
function fixture(side,turn,seed,variant){
 const state=E.makeState(config,seed);state.side=side;state.turn=turn;state.phase='replacement';
 const eligible=state.units.filter(u=>u.army===side&&u.type!=='shock');
 // Controlled legal conditions: reduced on-board units plus eliminated units.
 eligible.slice(0,3).forEach(u=>{u.strength='reduced'});
 if(variant==='mixed')eligible.slice(3,6).forEach(u=>{u.position=null;u.strength='dead'});
 return Session.create({scenarioId:'battle-for-moscow',config,state});
}
const policies=['balanced','conserve','fortress','screen','counter','railguard'];
for(const side of ['german','soviet'])for(const turn of [2,3,4,5])for(const variant of ['reduced','mixed'])for(const policy of policies){
 const original=fixture(side,turn,31+turn,variant);
 const planned=AI.planLegacyReplacement(original,policy);
 const baseline=structuredClone(original.state);
 E.doReplacements(config,baseline,policy);
 const first=baseline.log.find(e=>e.type==='replacement'&&e.t===turn&&e.side===side);
 if(first){
  check(!!planned,`Missing plan ${side} T${turn} ${variant} ${policy}`);
  assert.equal(planned.id,first.unit);checks++;
  assert.equal(planned.operation,first.action);checks++;
  if(first.action==='enter'){
   assert.deepStrictEqual([planned.x,planned.y],[first.at.x,first.at.y]);checks++;
  }
  const result=Session.execute(original,planned);
  check(result.ok,'Planned action must be legal through shared session');
  assert.deepStrictEqual(result.session.state.units,(()=>{
   const copy=structuredClone(original.state);
   E.applyReplacement(config,copy,{type:planned.operation,id:planned.id,...(planned.operation==='enter'?{x:planned.x,y:planned.y}:{})});
   return copy.units;
  })());checks++;
  const undone=Session.undo(result.session);
  assert.deepStrictEqual(undone.session.state,original.state);checks++;
 }else{assert.equal(planned,null);checks++;}
}
const invalid=fixture('german',2,41,'mixed');
assert.equal(AI.planLegacyReplacement({...invalid,state:{...invalid.state,phase:'movement'}},'balanced'),null);checks++;
console.log('PASS shared Solo AI legacy replacement decision parity:',checks,'assertions');
