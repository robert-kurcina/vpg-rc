'use strict';
/* Checkpoint 144: verify seven-turn rule parity *after* committing nonzero
 * opt-in reserve placements. The legacy engine is initialized to the EXACT
 * SAME already-redeployed board, not asked to validate historical placement.
 * Thus this is downstream battle/move/phase equivalence, NOT Oberlabs
 * tournament redeployment boundary or victory-adjudication certification. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../core/engine.js');
const S=require('../core/session.js');
const P=require('../core/native_preview_config.js');
const AI=require('../core/native_session_ai.js');
const L=require('../legacy/engine.js');
const adapter=require('../core/adapter.js');
const T=require('../core/native_tournament_scoring.js');
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const load=x=>JSON.parse(fs.readFileSync(path.join(__dirname,'../games/battle-for-moscow',x+'.json'),'utf8'));
const original=Object.fromEntries(['game','map','units','deployments','rules','objectives'].map(k=>[k,load(k)]));
const config=E.build(P.project(original,load('native-preview/config')));
const legacyConfig=L.buildScenario(adapter.legacyScenario(original),adapter.legacyProfile(original));
const reserve=config.deployments.openingRedeployment;
const policy=load('native-preview/ai-config');
const canon=s=>({turn:s.turn,side:s.side,ply:s.ply,seed:s.seed,over:s.over,winner:s.winner,
 control:s.control,units:Object.fromEntries(s.units.map(u=>[u.id,{position:u.position||null,strength:u.strength}]))});
const actions={runs:0,committedReserveMoves:0,sideTurns:0,actions:0,declarations:0,
 combat:0,moves:0,replacements:0,reinforcements:0,saveRestores:0,undoReplays:0,
 parityChecks:0,scoreReads:0,scoreAmbiguities:0,scoreNeverEnabled:0};
const execute=(s,action)=>{const result=S.execute(s,action);assert.equal(result.ok,true,JSON.stringify({action,reason:result.reason}));return result.session;};
const cases=[
 {name:'no-change',seed:17,moves:[]},
 {name:'one-northern',seed:1941,moves:[['s16',6,2]]},
 {name:'one-southern',seed:17,moves:[['s43',9,4]]},
 {name:'three-separated',seed:1,moves:[['s16',6,2],['s30',8,6],['s43',9,4]]}
];
function run(spec){
 let session=S.create({scenarioId:config.game.id,engine:'generic-hex-v1',config,
  state:E.start(config,spec.seed,'auto-reference',{openingRedeployment:true})});
 assert.equal(E.currentPhase(config,session.state).kind,'redeployment');
 const initialSeed=session.state.seed;
 const initialHash=S.serialize(session).sha256;
 for(const [id,x,y] of spec.moves){
  assert(S.legal(session,{type:'redeploy-reserve',unitId:id}).some(h=>h.x===x&&h.y===y),
   `Candidate does not permit ${spec.name} ${id} ${x},${y}`);
  const prior=session;
  session=execute(session,{type:'redeploy-reserve',unitId:id,x,y});
  assert.equal(session.state.seed,initialSeed,'Deployment may not roll dice');
  const restored=S.restore(clone(S.serialize(session)),{scenarioId:config.game.id,engine:'generic-hex-v1',config});
  assert.deepEqual(restored.state,session.state);
  const undo=S.undo(restored);assert(undo.ok);
  assert.equal(S.serialize(undo.session).sha256,S.serialize(prior).sha256);
  actions.saveRestores++;actions.undoReplays++;actions.committedReserveMoves++;
 }
 const postMovesHash=S.serialize(session).sha256;
 session=execute(session,{type:'finish-redeployment'});
 assert.equal(E.currentPhase(config,session.state).id,'combat');
 assert.equal(session.state.seed,initialSeed);
 assert.equal(S.legal(session,{type:'redeploy-reserve',unitId:'s16'}).length,0);
 const reverted=S.undo(session);
 assert(reverted.ok);assert.equal(S.serialize(reverted.session).sha256,postMovesHash);
 session=execute(reverted.session,{type:'finish-redeployment'});
 actions.undoReplays++;
 // The legacy engine has no certified tournament setup. Inject the *already
 // accepted* native positions as a controlled identical-state fixture only.
 let old=L.makeState(legacyConfig,spec.seed);
 old.phase='combat';
 for(const u of session.state.units){const oldUnit=old.units.find(v=>v.id===u.id);assert(oldUnit);
  oldUnit.position=clone(u.position);oldUnit.strength=u.strength;}
 old.control=clone(session.state.control);
 assert.deepEqual(canon(session.state),canon(old),'Equivalent post-setup game states');
 actions.parityChecks++;
 let sideTurns=0,withinTurnActions=0,battles=0,realMoves=0;
 while(!session.state.over&&sideTurns<14){
  const beforeSide=session,side=beforeSide.state.side;
  const play=AI.playSide(session,policy,({before,after,action,result})=>{
   withinTurnActions++;actions.actions++;
   assert(withinTurnActions<4000,'AI campaign safety bound');
   const previous=before.state,next=after.state;
   const phase=E.currentPhase(config,previous);
   assert(phase);
   old.phase=phase.id;
   if(action.type==='declare-battle'){
    assert.equal(next.seed,previous.seed,'Declarations do not roll dice');
    assert(L.battlePreview(legacyConfig,old,{attackers:action.attackers,defender:action.defender},1),
     'Legacy must accept the native combat declaration');actions.declarations++;
   }else if(action.type==='resolve-pending'){
    assert.notEqual(previous.pendingRoll,null);
    const declaration=previous.declarations[0];
    const resolved=L.resolveAttack(legacyConfig,old,declaration.attackers,declaration.defender,previous.pendingRoll,action.options);
    assert(resolved,'Legacy must accept chosen combat consequence');
    assert.equal(resolved.outcome,result.record.result);
    actions.combat++;battles++;
    if(next.declarations.length)assert.equal(L.rollCombatDie(old),next.pendingRoll);
   }else if(action.type==='move'){
    assert.equal(L.move(legacyConfig,old,action.unitId,action.x,action.y,phase.movementMode),true);
    actions.moves++;realMoves++;
   }else if(action.type==='replacement'){
    assert.equal(L.applyReplacement(legacyConfig,old,action.choice),true);
    actions.replacements++;
   }else if(action.type==='place-reinforcement'){
    assert.equal(L.performShockReinforcement(legacyConfig,old,action),true);
    actions.reinforcements++;
   }else if(action.type==='finish-phase'&&previous.declarations.length&&!previous.declarationLocked){
    assert.equal(L.rollCombatDie(old),next.pendingRoll);
   }else assert.equal(action.type,'finish-phase');
   if(next.side!==previous.side||next.over)L.endSide(legacyConfig,old);
   else old.phase=E.currentPhase(config,next)?.id||'finished';
   assert.deepEqual(canon(next),canon(old),`Native/legacy divergence: ${spec.name} ${side} T${previous.turn} ${action.type}`);
   actions.parityChecks++;
   if(actions.actions%37===0){
    const p=S.serialize(after),restored=S.restore(clone(p),{scenarioId:config.game.id,engine:'generic-hex-v1',config});
    assert.deepEqual(restored.state,after.state);actions.saveRestores++;
   }
  });
  assert(play.actions.length);
  const undo=S.undo(play.session);assert(undo.ok);
  const replay=S.execute(undo.session,play.actions.at(-1).action);
  assert(replay.ok);assert.deepEqual(replay.session.state,play.session.state);
  actions.undoReplays++;
  session=play.session;
  const hash=S.serialize(session).sha256;
  const score=T.read(config,session.state);
  assert.equal(score.gameplayEnabled,false);
  assert.equal(score.setupAvailable,false);
  assert.equal(score.adjudicated,false);
  assert.equal(S.serialize(session).sha256,hash,'Scorer must not modify game state');
  actions.scoreNeverEnabled++;actions.scoreReads++;
  if(score.ambiguous){assert.equal(score.primary,null);assert.equal(score.points,null);actions.scoreAmbiguities++;}
  sideTurns++;actions.sideTurns++;
 }
 assert.equal(session.state.over,true,`Campaign ${spec.name} did not reach terminal result`);
 assert.equal(session.state.ply,14);
 assert.equal(sideTurns,14);
 assert.equal(actions.reinforcements,actions.runs+1,'Exactly one Shock unit in each campaign');
 assert.deepEqual(canon(session.state),canon(old),'Terminal parity');
 actions.runs++;
 return {name:spec.name,seed:spec.seed,openingMoves:spec.moves.length,sideTurns,battles,realMoves,
  result:session.state.winner,stateHash:S.serialize(session).sha256};
}
assert.equal(original.game.engine,'generic-hex-v1');
assert.equal(reserve.certification,'candidate-unverified');
const reports=cases.map(run);
assert(actions.combat>0&&actions.moves>0&&actions.replacements>0);
assert(actions.committedReserveMoves===5);
assert(actions.scoreReads===56);
assert.equal(original.game.engine,'generic-hex-v1');
const summary={status:'PASS',checkpoint:144,version:'v378',description:'7-turn downstream rules parity from matched post-candidate-redeployment starts (NOT upstream deployment legality)',
 parityType:'Equivalent post-setup board injection into local legacy simulator; not independent Oberlabs tournament executable',
 certification:'candidate-unverified',publishedCoordinates:reserve.sourceHexes,registeredCoordinates:reserve.registeredHexes,
 gameMode:'standard-victory-only; tournament score read-only',counters:actions,campaigns:reports};
if(process.argv.includes('--write-audit')){
 fs.writeFileSync(path.join(__dirname,'../rules/audit/b4m-native-redeployment-campaign-v378.json'),JSON.stringify(summary,null,2)+'\n');
}
console.log(JSON.stringify(summary));
