'use strict';
const assert=require('node:assert/strict');
const E=require('../legacy/engine');
const Session=require('../core/session');
const AI=require('../core/solo_ai');
const raw=require('../legacy/data/scenario.json');
const profiles=require('../legacy/data/rules_profiles.json');
const config=E.buildScenario(raw,profiles.profiles[profiles.defaultRuleset]);
let cases=0,actions=0,combats=0,shockCases=0;
for(const side of ['german','soviet'])for(const turn of [2,3,4,5])for(const policy of ['balanced','conserve','fortress']){
 const state=E.makeState(config,341+turn);state.turn=turn;state.side=side;
 state.phase=side==='soviet'&&turn===4?'reinforcement':'replacement';state.replacementUsed=0;
 const original=Session.create({scenarioId:'battle-for-moscow',config,state});
 const expected=E.playSide(config,state,policy);
 const actual=AI.executeLegacyHalfTurn(original,policy);
 const got=actual.session.state;
 // The human UI exposes a mandatory Soviet reinforcement phase at the
 // German T4 boundary; monolithic playSide goes directly to replacement.
 const compared=structuredClone(got);
 if(side==='german'&&turn===4){
  assert.equal(got.phase,'reinforcement','human interaction boundary retains Shock phase');
  assert.equal(expected.phase,'replacement','legacy macro omits Shock UI phase');
  compared.phase='replacement';
 }
 assert.deepStrictEqual(compared,expected,`complete state, events and RNG ${side} T${turn} ${policy}`);
 assert.equal(actual.trace.length,actual.actions.length);
 assert.ok(actual.trace.some(t=>t.from==='combat'),'must reach combat declaration');
 if(side==='soviet'&&turn===4){
  assert.ok(actual.actions.some(a=>a.type==='shock-reinforcement'),'mandatory shock included');
  shockCases++;
 }
 combats+=actual.trace.filter(t=>t.events.some(e=>e.type==='combat')).length;
 actions+=actual.actions.length;cases++;
 // Undo the entire half-turn including every phase/event boundary.
 let rewind=actual.session;
 for(let i=actual.actions.length-1;i>=0;i--){
  const output=Session.undo(rewind);assert.equal(output.ok,true);rewind=output.session;
 }
 assert.deepStrictEqual(rewind.state,original.state,'full history reverse restores exact seed, board and logs');
 assert.deepStrictEqual(rewind.usedUnitIds,original.usedUnitIds,'used units restored');
 if(cases===1){
  const replay=AI.executeLegacyHalfTurn(rewind,policy);
  assert.deepStrictEqual(replay.session.state,got,'full-half-turn deterministic replay');
  const saved=Session.serialize(actual.session);
  const restored=Session.restore(saved,{scenarioId:'battle-for-moscow',config});
  assert.deepStrictEqual(restored.state,got,'save restores exact half-turn state');
  assert.equal(restored.history.length,actual.actions.length,'save preserves all actions');
 }
}
const bad=E.makeState(config,99);bad.turn=2;bad.phase='combat';
assert.throws(()=>AI.executeLegacyHalfTurn(Session.create({scenarioId:'battle-for-moscow',config,state:bad})),/Half-turn must begin/);
const phase=E.makeState(config,74);phase.turn=2;phase.phase='replacement';
const session=Session.create({scenarioId:'battle-for-moscow',config,state:phase});
const badAction=Session.execute(session,{type:'finish-phase',aiPolicy:'balanced'});
assert.equal(badAction.ok,false,'reject AI event outside combat/movement');
assert.deepStrictEqual(badAction.session,session,'rejection does not consume history');
console.log(`PASS complete AI half-turn: ${cases} full-state matches, ${actions} actions, ${combats} combats, ${shockCases} Shock cases; Undo/save/replay`);
