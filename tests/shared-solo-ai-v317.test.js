'use strict';
const assert=require('node:assert/strict');
const S=require('../core/session');
const AI=require('../core/solo_ai');
const E=require('../legacy/engine');
const raw=require('../legacy/data/scenario.json');
const rules=require('../legacy/data/rules_profiles.json');
const c=E.buildScenario(raw,rules.profiles[rules.defaultRuleset]);
let checks=0;
const test=(cond,msg)=>{assert.ok(cond,msg);checks++;};
const same=(a,b)=>{assert.deepStrictEqual(a,b);checks++;};
const make=(phase='replacement',seed=41)=>{
 const state=E.makeState(c,seed);state.side='german';state.turn=2;state.phase=phase;
 return S.create({scenarioId:'battle-for-moscow',config:c,state});
};
{
 const initial=make();
 const a=AI.halfTurn(initial,{policy:'safe-pass'});
 test(a.actions.length>0);
 test(a.actions.every(x=>x.type==='finish-phase'));
 test(a.session.state.side==='soviet');
 test(a.session.history.length===a.actions.length);
 const replay=AI.halfTurn(make(),{policy:'safe-pass'});
 same(a.session.state,replay.session.state);
 same(a.session.history,replay.session.history);
 let back=a.session;
 for(let i=0;i<a.actions.length;i++)back=S.undo(back).session;
 same(back.state,initial.state);same(back.usedUnitIds,initial.usedUnitIds);
 const saved=S.serialize(a.session);const restored=S.restore(saved,{scenarioId:'battle-for-moscow',config:c});
 same(restored.state,a.session.state);same(restored.history,a.session.history);
}
{
 const start=make('movement',72);
 const possible=start.state.units.filter(u=>u.army==='german'&&u.position)
  .flatMap(u=>S.legal(start,{type:'move',unitId:u.id,mode:'normal'}));
 test(possible.length>0,'Need at least one legal move');
 const output=AI.halfTurn(start,{policy:'first-legal-move'});
 test(output.actions.some(x=>x.type==='move'),'AI must execute a real move');
 test(output.actions.at(-1).type==='finish-phase');
 test(output.session.state.side==='soviet');
 const again=AI.halfTurn(make('movement',72),{policy:'first-legal-move'});
 same(output.session.state,again.session.state);
 same(output.actions,again.actions);
 const back=S.undo(output.session).session;
 test(back.state.side==='german');
 test(back.usedUnitIds.length>0,'Undo restores used-unit restrictions');
}
{
 const before=make('combat',33);
 const output=AI.step(before,{policy:'safe-pass'});
 test(output.action.type==='finish-phase');
 test(output.session.state.phase==='movement');
 same(before.state.phase,'combat');
 assert.throws(()=>AI.step(before,{policy:'unrecognized'}),/Unknown Solo AI policy/);checks++;
 assert.throws(()=>AI.halfTurn(before,{maxActions:1}),/action limit/);checks++;
 const bad=make('combat-resolution');
 assert.throws(()=>AI.step(bad),/consequence policy not implemented/);checks++;
 assert.throws(()=>S.create({scenarioId:'kiev',config:c,state:before.state}),/not available/);checks++;
}
console.log('PASS shared Solo AI adapter:',checks,'assertions');
