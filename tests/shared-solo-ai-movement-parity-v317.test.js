'use strict';
const assert=require('node:assert/strict');
const E=require('../legacy/engine');
const Session=require('../core/session');
const AI=require('../core/solo_ai');
const raw=require('../legacy/data/scenario.json');
const profiles=require('../legacy/data/rules_profiles.json');
const config=E.buildScenario(raw,profiles.profiles[profiles.defaultRuleset]);
let checks=0,moves=0,skipped=0;
for(const side of ['german','soviet'])for(const turn of [2,3,5])for(const phase of ['special','movement'])for(const policy of AI.MOVE_POLICIES){
 const state=E.makeState(config,17+turn);state.side=side;state.turn=turn;state.phase=phase;
 const session=Session.create({scenarioId:'battle-for-moscow',config,state});
 const source=structuredClone(state);
 const mode=phase==='movement'?'normal':side==='german'?'panzer':'rail';
 E.strategicMove(config,source,mode,policy,side);
 const sourceMove=source.log.find(v=>v.type==='move'&&v.t===turn&&v.side===side);
 let plan;
 try{plan=AI.planLegacyMove(session,policy);}catch(e){
  if(/Moscow relief requires compound-action planner/.test(e.message)){skipped++;continue;}
  throw e;
 }
 if(sourceMove){
  assert.ok(plan,`${side} turn ${turn} ${phase} ${policy}: missing move`);
  assert.deepStrictEqual([plan.unitId,plan.x,plan.y,plan.mode],
   [sourceMove.unit,sourceMove.to.x,sourceMove.to.y,mode],
   `${side} turn ${turn} ${phase} ${policy}: first move differs`);
  const result=Session.execute(session,plan);assert.ok(result.ok);
  assert.deepStrictEqual(result.session.state.units.find(u=>u.id===plan.unitId).position,sourceMove.to);
  assert.deepStrictEqual(Session.undo(result.session).session.state,state);
  moves++;checks+=5;
 }else{assert.equal(plan,null,`${side} turn ${turn} ${phase} ${policy}: source did not move`);checks++;}
}
const sample=E.makeState(config,15);sample.phase='movement';
const s=Session.create({scenarioId:'battle-for-moscow',config,state:sample});
assert.throws(()=>AI.planLegacyMove(s,'not-a-policy'),/Unknown movement policy/);checks++;
assert.equal(AI.planLegacyMove({...s,state:{...s.state,phase:'replacement'}},'balanced'),null);checks++;
console.log(`PASS movement first-action oracle comparisons: ${checks} assertions, ${moves} moves, ${skipped} compound cases excluded`);
