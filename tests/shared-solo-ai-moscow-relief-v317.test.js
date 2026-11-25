'use strict';
const assert=require('node:assert/strict');
const E=require('../legacy/engine');
const S=require('../core/session');
const AI=require('../core/solo_ai');
const config=E.buildScenario(require('../legacy/data/scenario.json'),
 require('../legacy/data/rules_profiles.json').profiles[require('../legacy/data/rules_profiles.json').defaultRuleset]);
function fixture(turn=5){
 const state=E.makeState(config,88);state.turn=turn;state.side='soviet';state.phase='movement';
 const old=state.units.find(u=>u.id==='s43'),shock=state.units.find(u=>u.id==='s1sh');
 old.position={x:10,y:2};old.strength='reduced';shock.position={x:9,y:2};shock.strength='full';
 return S.create({scenarioId:'battle-for-moscow',config,state});
}
let cases=0;
for(const policy of ['fortress','screen','counter','railguard']){
 const original=fixture(),before=structuredClone(original.state);
 const planned=AI.planMoscowRelief(original,policy);
 assert.deepEqual(S.legal(original,{type:'moscow-relief'})[0],planned);
 assert.deepEqual(planned,{type:'moscow-relief',oldId:'s43',shockId:'s1sh',destination:{x:9,y:3}});
 const source=structuredClone(original.state);
 E.strategicMove(config,source,'normal',policy,'soviet');
 const out=AI.planLegacyMovementPhase(original,policy);
 assert.deepEqual(out.actions[0],planned);
 assert.deepEqual(out.session.state,source,`source state parity: ${policy}`);
 assert.equal(out.session.history.length,out.actions.length,'one history entry per action');
 const afterRelief=S.execute(original,planned);
 assert.equal(afterRelief.ok,true);
 assert.equal(afterRelief.session.history.length,1,'two legs as one history record');
 assert.deepEqual(afterRelief.session.usedUnitIds,['s43','s1sh']);
 assert.deepEqual(afterRelief.session.state.log.slice(-3).map(e=>e.type),['move','move','garrison-relief']);
 assert.deepEqual(afterRelief.session.state.log.slice(-3),source.log.filter(e=>e.type==='move'||e.type==='garrison-relief').slice(0,3));
 const undone=S.undo(afterRelief.session);
 assert.equal(undone.ok,true);assert.deepEqual(undone.session.state,before);
 assert.deepEqual(undone.session.usedUnitIds,[]);
 const replay=S.execute(undone.session,planned);
 assert.deepEqual(replay.session.state,afterRelief.session.state);
 const save=S.serialize(afterRelief.session);
 const loaded=S.restore(save,{scenarioId:'battle-for-moscow',config});
 assert.deepEqual(loaded.state,afterRelief.session.state);
 assert.deepEqual(S.undo(loaded).session.state,before);
 let current=out.session;
 for(let i=0;i<out.actions.length;i++)current=S.undo(current).session;
 assert.deepEqual(current.state,before,'entire movement phase rewound');
 cases++;
}
{
 const start=fixture(),action=AI.planMoscowRelief(start,'fortress');
 const invalid=[
  {...action,destination:{x:11,y:2}}, // open terrain
  {...action,destination:{x:100,y:100}},
  {...action,shockId:'s3'},
  {...action,oldId:'s5'}
 ];
 for(const bad of invalid){
  const outcome=S.execute(start,bad);assert.equal(outcome.ok,false);assert.strictEqual(outcome.session,start);
  assert.deepEqual(start.state,fixture().state,'failed compound action must not mutate input');
  cases++;
 }
 const phaseState=fixture();phaseState.state.phase='special';
 const bad=S.execute(phaseState,action);assert.equal(bad.ok,false);cases++;
 const early=fixture(3);assert.equal(AI.planMoscowRelief(early,'fortress'),null);cases++;
 const nonDefensive=fixture();assert.equal(AI.planMoscowRelief(nonDefensive,'balanced'),null);cases++;
 const tooWeak=fixture();tooWeak.state.units.find(u=>u.id==='s1sh').strength='reduced';
 tooWeak.state.units.find(u=>u.id==='s43').strength='full';
 assert.equal(AI.planMoscowRelief(tooWeak,'fortress'),null);cases++;
 const used=fixture();used.usedUnitIds=['s43'];assert.equal(AI.planMoscowRelief(used,'fortress'),null);cases++;
 const immobile=fixture();immobile.state.units.find(u=>u.id==='s1sh').movement=0;
 assert.deepEqual(S.legal(immobile,{type:'moscow-relief'}),[]);
 const secondLeg=S.execute(immobile,action);assert.equal(secondLeg.ok,false);
 assert.equal(immobile.state.units.find(u=>u.id==='s43').position.x,10);
 assert.equal(immobile.history.length,0);cases++;
}
console.log('PASS source-aligned Moscow garrison relief:',cases,'fixtures');
