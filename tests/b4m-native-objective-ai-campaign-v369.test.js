'use strict';
/* Objective-defense AI actions run through the native shared session
 * and the established legacy B4M rules engine. This is action/transaction
 * parity, NOT legacy AI doctrine/strategy parity. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const project=require('../core/native_preview_config.js');
const E=require('../core/engine.js');
const S=require('../core/session.js');
const AI=require('../core/native_session_ai.js');
const L=require('../legacy/engine.js');
const adapter=require('../core/adapter.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const {original,config}=load();
const g=E.build(project.project(original,config));
const lc=L.buildScenario(adapter.legacyScenario(original),adapter.legacyProfile(original));
const profile=require('../games/battle-for-moscow/native-preview/ai-config-objective.json');
function canon(s){return {turn:s.turn,side:s.side,ply:s.ply,seed:s.seed,over:s.over,winner:s.winner,
 units:Object.fromEntries(s.units.map(u=>[u.id,{position:u.position||null,strength:u.strength}])),control:s.control};}
const counters={runs:0,sideTurns:0,actions:0,combatDeclarations:0,resolvedBattles:0,
 movements:0,replacements:0,shockPlacements:0,savedSnapshots:0,undoReplays:0,
 fullStateMatches:0,matchedDice:0,terminalMatches:0};
assert.equal(AI.policy(profile).maxBattlesPerPhase,2);
for(const invalid of [{banana:true},{maxActions:0},{maxBattlesPerPhase:-1},
 {maxPhases:0},{mode:'pretend-legacy-parity'},{minAttackOdds:1.5},null]){
 assert.throws(()=>AI.policy(invalid),'Invalid AI profile must fail closed');
}
assert.deepEqual(AI.controlGoals(g,'german'),[[10,2]]);
assert.deepEqual(AI.controlGoals(g,'soviet'),[[10,2]]);
assert.equal(require('../games/battle-for-moscow/game.json').engine,'generic-hex-v1');
function run(seed){
 let originalSession=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,
  state:E.start(g,seed,'auto-reference')});
 const opening=copy(originalSession.state);
 const old=L.makeState(lc,seed);old.phase='combat';
 assert.deepEqual(canon(originalSession.state),canon(old),'Opening native/legacy state');
 let session=originalSession,turns=0,steps=0;
 while(!session.state.over&&turns<14){
  const initial=session;
  const initialSide=session.state.side;
  const out=AI.playSide(session,profile,({before,after,action,result})=>{
   steps++;
   assert(steps<3000,'Campaign AI action cap');
   counters.actions++;
   const prior=before.state,next=after.state;
   const phase=E.currentPhase(g,prior);
   old.phase=phase?.id||'finished';
   if(action.type==='declare-battle'){
    counters.combatDeclarations++;
    assert.equal(next.seed,prior.seed,'AI must declare without consuming RNG');
    assert(L.battlePreview(lc,old,{attackers:action.attackers,defender:action.defender},1),
      'Native declaration must be a legal legacy combat preview');
   } else if(action.type==='resolve-pending'){
    const declaration=prior.declarations[0],die=prior.pendingRoll;
    assert.notEqual(die,null,'AI may only resolve committed combat dice');
    const record=L.resolveAttack(lc,old,declaration.attackers,declaration.defender,die,action.options);
    assert(record,'Legacy rules must accept native AI combat choice');
    assert.equal(record.outcome,result.record.result,'CRT result mismatch');
    counters.resolvedBattles++;
    if(next.declarations.length){
     const nextDie=L.rollCombatDie(old);
     assert.equal(nextDie,next.pendingRoll,'Second die must commit after prior battle');counters.matchedDice++;
    }
   } else if(action.type==='move'){
    assert.equal(L.move(lc,old,action.unitId,action.x,action.y,phase.movementMode),true,
      'Legacy must accept native AI movement');
    counters.movements++;
   } else if(action.type==='replacement'){
    assert.equal(L.applyReplacement(lc,old,action.choice),true,'Legacy replacement legality');
    counters.replacements++;
   } else if(action.type==='place-reinforcement'){
    assert.equal(L.performShockReinforcement(lc,old,action),true,'Legacy turn-4 Shock choice');
    counters.shockPlacements++;
   } else if(action.type==='finish-phase'&&prior.declarations.length&&!prior.declarationLocked){
    const die=L.rollCombatDie(old);
    assert.equal(die,next.pendingRoll,'First die must commit when declarations lock');counters.matchedDice++;
   } else {
    assert.equal(action.type,'finish-phase','Unexpected AI action: '+action.type);
   }
   if(next.side!==prior.side||next.over){L.endSide(lc,old);}
   else old.phase=E.currentPhase(g,next)?.id||'finished';
   assert.deepEqual(canon(next),canon(old),`Legacy/native action mismatch seed ${seed} t${prior.turn} ${prior.side} ${action.type}`);
   counters.fullStateMatches++;
   if(counters.actions%31===0||prior.declarations.length&&prior.declarationLocked&&counters.savedSnapshots<7){
    const payload=S.serialize(after);
    const restored=S.restore(copy(payload),{scenarioId:g.game.id,engine:'generic-hex-v1',config:g});
    assert.deepEqual(restored.state,after.state);
    assert.deepEqual(restored.history,after.history);
    counters.savedSnapshots++;
   }
  });
  assert.notStrictEqual(out.session,initial,'AI result must be new session');
  assert.deepEqual(initial.state,turns===0?opening:session.state,'AI must not mutate caller state');
  assert(out.actions.length>0,'AI should commit at least one action per side-turn');
  assert.equal(out.summary.side,initialSide);
  const undone=S.undo(out.session);
  assert(undone.ok,'Undo must work after AI action');
  const last=out.actions.at(-1).action;
  const replay=S.execute(undone.session,last);
  assert.equal(replay.ok,true,'AI last action should replay legally');
  assert.deepEqual(replay.session.state,out.session.state,'AI Undo/replay state');
  assert.deepEqual(replay.session.history,out.session.history,'AI Undo/replay history');
  counters.undoReplays++;
  session=out.session;
  counters.sideTurns++;turns++;
 }
 assert.equal(session.state.over,true,`Seed ${seed} should finish within seven turns`);
 assert.equal(session.state.ply,14,'Final B4M ply');
 assert.deepEqual(canon(session.state),canon(old),'AI-vs-AI terminal outcome match');
 counters.terminalMatches++;counters.runs++;
 return {seed,turns,winner:session.state.winner,unitLocations:session.state.units.filter(u=>u.position).length,
  stateHash:S.serialize(session).sha256};
}
// A manual setup cannot be silently automated while human placement is pending.
const manual=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:E.start(g,1941,'manual')});
const manualBefore=copy(manual.state);
assert.throws(()=>AI.playSide(manual,profile),/Manual setup requires/);
assert.deepEqual(manual.state,manualBefore,'Failed AI setup cannot mutate session');
const results=[1,17,1941].map(run);
const check=run(1);
assert.equal(results[0].stateHash,check.stateHash,'Same seeded AI policy must replay deterministically');
assert(counters.resolvedBattles>0,'AI must resolve real combats');
assert(counters.movements>0,'AI must execute real moves');
assert(counters.replacements>0,'AI must apply source-legal replacements');
assert(counters.shockPlacements===4,'One Shock arrival per each complete campaign');
assert.equal(counters.terminalMatches,4);
assert.equal(require('../games/battle-for-moscow/game.json').engine,'generic-hex-v1');
const summary={status:'PASS',checkpoint:135,description:'Opt-in objective-defense native AI selected actions replayed against legacy rules engine; legacy strategic decision parity NOT tested',
  policy:profile,...counters,campaigns:results};
const file=path.join(__dirname,'../rules/audit/b4m-native-objective-ai-campaign-v369.json');
if(process.argv.includes('--write-audit'))fs.writeFileSync(file,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
