'use strict';
const assert=require('node:assert/strict');
const E=require('../legacy/engine');
const Session=require('../core/session');
const AI=require('../core/solo_ai');
const raw=require('../legacy/data/scenario.json');
const profiles=require('../legacy/data/rules_profiles.json');
const config=E.buildScenario(raw,profiles.profiles[profiles.defaultRuleset]);
let cases=0,actions=0,compound=0;
for(const side of ['german','soviet'])for(const turn of [2,3,5])
for(const phase of ['special','movement'])for(const policy of ['balanced','fortress','conserve']){
 const state=E.makeState(config,17+turn);state.side=side;state.turn=turn;state.phase=phase;
 const session=Session.create({scenarioId:'battle-for-moscow',config,state});
 const source=structuredClone(state);
 const mode=phase==='movement'?'normal':side==='german'?'panzer':'rail';
 E.strategicMove(config,source,mode,policy,side);
 let result;
 try{result=AI.planLegacyMovementPhase(session,policy)}catch(error){
  if(/Moscow relief requires compound-action planner/.test(error.message)){compound++;continue;}
  throw error;
 }
 const expected=source.log.filter(e=>e.type==='move'&&e.t===turn&&e.side===side&&e.mode===mode);
 assert.deepStrictEqual(result.actions.map(a=>[a.unitId,a.x,a.y,a.mode]),
  expected.map(e=>[e.unit,e.to.x,e.to.y,e.mode]),`${side} turn ${turn} ${phase} ${policy}: move sequence`);
 assert.deepStrictEqual(result.session.state,source,`${side} turn ${turn} ${phase} ${policy}: state parity`);
 let rewound=result.session;
 for(let i=0;i<result.actions.length;i++){
  const undone=Session.undo(rewound);assert.equal(undone.ok,true);rewound=undone.session;
 }
 assert.deepStrictEqual(rewound.state,state,`${side} turn ${turn} ${phase} ${policy}: complete undo`);
 assert.deepStrictEqual(rewound.usedUnitIds,session.usedUnitIds,'complete undo restores unit-use flags');
 actions+=expected.length;cases++;
}
const state=E.makeState(config,18);state.phase='movement';
const session=Session.create({scenarioId:'battle-for-moscow',config,state});
assert.throws(()=>AI.planLegacyMovementPhase(session,'bogus'),/Unknown movement policy/);
assert.throws(()=>AI.planLegacyMovementPhase({...session,state:{...state,phase:'combat'}},'balanced'),/Not a movement phase/);
console.log(`PASS full movement oracle: ${cases} cases, ${actions} moves, ${compound} compound exclusions`);
