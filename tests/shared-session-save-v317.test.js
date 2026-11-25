'use strict';
const assert=require('node:assert/strict');
const Session=require('../core/session');
const Engine=require('../legacy/engine');
const raw=require('../legacy/data/scenario.json');
const profiles=require('../legacy/data/rules_profiles.json');
const config=Engine.buildScenario(raw,profiles.profiles[profiles.defaultRuleset]);
const base=Session.create({scenarioId:'battle-for-moscow',config,state:Engine.makeState(config,41)});
let checks=0;const eq=(a,b)=>{assert.deepStrictEqual(a,b);checks++};
let state=base, move;
const patch=JSON.parse(JSON.stringify(state.state));patch.turn=2;patch.side='german';patch.phase='movement';
state=Session.create({scenarioId:'battle-for-moscow',config,state:patch});
for(const u of state.state.units.filter(u=>u.army==='german'&&u.position)){
 const destinations=Session.legal(state,{type:'move',unitId:u.id,mode:'normal'});
 if(destinations.length){move={type:'move',unitId:u.id,mode:'normal',...destinations[0]};break;}
}
assert.ok(move);checks++;
const moved=Session.execute(state,move);assert.ok(moved.ok);checks++;
const saved=JSON.parse(JSON.stringify(Session.serialize(moved.session)));
const restored=Session.restore(saved,{scenarioId:'battle-for-moscow',config});
eq(restored.state,moved.session.state);eq(restored.usedUnitIds,moved.session.usedUnitIds);eq(restored.history,moved.session.history);
eq(Session.legal(restored,{type:'move',unitId:move.unitId,mode:'normal'}),[]);
const oldUndo=Session.undo(moved.session),newUndo=Session.undo(restored);
eq(newUndo.session.state,oldUndo.session.state);eq(newUndo.session.usedUnitIds,oldUndo.session.usedUnitIds);
const replay=Session.execute(newUndo.session,move);assert.ok(replay.ok);checks++;eq(replay.session.state,moved.session.state);
for(const mutate of [
 s=>s.version=99,
 s=>s.scenarioId='kiev',
 s=>s.engine='unknown',
 s=>s.usedUnitIds=['unknown'],
 s=>s.history[0].usedUnitIds=['unknown'],
 s=>s.history[0].state.phase='nonexistent',
 s=>s.history[0].state.units[0].position={x:999,y:999},
 s=>s.history='lost',
]){
 const corrupted=JSON.parse(JSON.stringify(saved));mutate(corrupted);
 assert.throws(()=>Session.restore(corrupted,{scenarioId:'battle-for-moscow',config}));checks++;
}
// A version 1 legacy save contains no history; do not invent it.
const legacy=Session.create({scenarioId:'battle-for-moscow',config,state:state.state});
eq(legacy.history,[]);
console.log('PASS versioned session save, Undo/replay, corruption rejection:',checks,'assertions');
