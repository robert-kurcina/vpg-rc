'use strict';
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const proj=require('../core/native_preview_config.js');
const E=require('../core/engine.js');
const L=require('../legacy/engine.js');
const adapter=require('../core/adapter.js');
const S=require('../core/session.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const {original,config}=load(),g=E.build(proj.project(original,config));
const reference=L.buildScenario(adapter.legacyScenario(original),adapter.legacyProfile(original));
const canonical=s=>({turn:s.turn,side:s.side,units:Object.fromEntries(s.units.map(u=>[u.id,{position:u.position||null,strength:u.strength}])),control:s.control,seed:s.seed,ply:s.ply,over:s.over,winner:s.winner});
const norm=x=>x.map(v=>[v.type,v.id,v.x??null,v.y??null].join(':')).sort();
const act=(session,action)=>{let res=S.execute(session,action);assert.equal(res.ok,true,`${JSON.stringify(action)}: ${res.reason}`);return res.session;};
function runCase(seed,moveChoice,setupMode='automatic'){
let ses=S.create({scenarioId:original.game.id,engine:'generic-hex-v1',config:g,state:E.start(g,seed,setupMode==='manual'?'manual':'auto-reference')});
let old=L.makeState(reference,seed,setupMode==='manual'?'manual':'automated');if(setupMode!=='manual')old.phase='combat';
const summary={turns:0,manualPlacements:0,phases:0,realMoves:0,realBattles:0,realReplacements:0,shockPlacements:0,savedRestores:0,stateChecks:0,choiceChecks:0,undoReplays:0,phasesByTurn:{},turnEnds:[]};
function eq(stage){assert.deepEqual(canonical(ses.state),canonical(old),stage);summary.stateChecks++}
function saveRoundtrip(stage){const restored=S.restore(copy(S.serialize(ses)),{scenarioId:original.game.id,engine:'generic-hex-v1',config:g});assert.deepEqual(restored.state,ses.state,stage);assert.deepEqual(restored.history,ses.history,stage);ses=restored;summary.savedRestores++}
function attemptMove(phase){const faction=ses.state.side,mode=phase.movementMode;
 for(const u of ses.state.units.filter(u=>(u.army||u.faction)===faction&&u.position&&u.strength!=='dead')){
  const oldUnit=old.units.find(x=>x.id===u.id);
  if(!oldUnit.position||mode==='panzer'&&u.type!=='tank'||mode==='rail'&&faction!=='soviet')continue;
  let actual=E.legalMoves(g,ses.state,u.id),ref=L.legalMoves(reference,old,oldUnit,mode);
  assert.deepEqual(actual,ref,`Dynamic legal-move parity ${ses.state.turn}/${faction}/${mode}/${u.id}`);summary.choiceChecks++;
  if(!actual.length)continue;
  // Use one deterministic source-legal move per distinct movement phase.
  const dest=actual[moveChoice==='last'?actual.length-1:0];assert.equal(L.move(reference,old,u.id,dest.x,dest.y,mode),true);
  const before=ses;
  ses=act(ses,{type:'move',unitId:u.id,x:dest.x,y:dest.y});
  let undo=S.undo(ses);assert.equal(undo.ok,true);assert.deepEqual(undo.session.state,before.state);summary.undoReplays++;
  ses=act(undo.session,{type:'move',unitId:u.id,x:dest.x,y:dest.y});
  summary.realMoves++;eq('after movement');return;
 }
}
function attemptReplacement(){assert.equal(E.replacementBudget(g,ses.state),L.replacementBudget(reference,old));
 const actual=E.replacementOptions(g,ses.state),ref=L.replacementOptions(reference,old);
 assert.deepEqual(norm(actual),norm(ref),`Dynamic replacement parity t${ses.state.turn} ${ses.state.side}`);summary.choiceChecks++;
 if(!actual.length)return;
 let choice=actual.find(o=>o.type==='restore')||actual[0];
 assert.equal(L.applyReplacement(reference,old,choice),true);
 ses=act(ses,{type:'replacement',choice});summary.realReplacements++;eq('after replacement');
}
function attemptCombat(){
 const side=ses.state.side;
 for(const b of L.attackCandidates(reference,old,side)){
  if(!S.legal(ses,{type:'declare-battle',attackers:b.attackers,defender:b.defender}).length)continue;
  const declareBefore=ses;
  ses=act(ses,{type:'declare-battle',attackers:b.attackers,defender:b.defender});
  assert.equal(ses.state.seed,declareBefore.state.seed,'Declaration cannot draw a die');
  ses=act(ses,{type:'finish-phase'});
  const die=ses.state.pendingRoll;
  assert.equal(die,L.rollCombatDie(old),`Committed roll t${ses.state.turn} ${side}`);
  let record=L.resolveAttack(reference,old,b.attackers,b.defender,die,{advanceId:'none'});
  assert.ok(record,`Legacy combat action t${ses.state.turn} ${side}`);
  let before=ses;
  ses=act(ses,{type:'resolve-pending',options:{advanceId:'none'}});
  let undo=S.undo(ses);assert.equal(undo.ok,true);assert.deepEqual(undo.session.state,before.state);summary.undoReplays++;
  ses=act(undo.session,{type:'resolve-pending',options:{advanceId:'none'}});
  summary.realBattles++;eq('after combat');return true;
 }
 return false;
}
let step=0;
eq('opening');
if(setupMode==='manual'){
 const positions=L.makeState(reference,seed).units.filter(u=>u.army==='german');
 assert.equal(positions.length,22);
 for(const u of positions){
  assert.equal(L.setupPlace(reference,old,u.id,u.position.x,u.position.y),true);
  ses=act(ses,{type:'setup-place',unitId:u.id,x:u.position.x,y:u.position.y});
  summary.manualPlacements++;
  eq('manual placement '+u.id);
 }
 assert.equal(L.finishSetup(reference,old),true);
 ses=act(ses,{type:'finish-setup'});
 eq('confirmed setup');
}

while(!ses.state.over&&step++<100){
 let turn=ses.state.turn,side=ses.state.side,phase=E.currentPhase(g,ses.state);
 assert.ok(phase,`Phase available ${turn} ${side}`);
 summary.phasesByTurn[turn]=(summary.phasesByTurn[turn]||0)+1;summary.phases++;
 if(phase.kind==='reinforcement'){
  assert.equal(turn,4);assert.equal(side,'soviet');
  const a=E.reinforcementOptions(g,ses.state),b=L.shockReinforcementOptions(reference,old);
  assert.deepEqual(a,b,'True campaign Turn 4 shock legality');summary.choiceChecks++;
  assert.ok(a.length>0,'Shock has a legal entry after actual intervening moves');
  let dest=a[Math.floor(a.length/2)];assert.equal(L.performShockReinforcement(reference,old,dest),true);
  ses=act(ses,{type:'place-reinforcement',unitId:'s1sh',...dest});summary.shockPlacements++;
  eq('true turn 4 chosen shock');
 }else if(phase.kind==='replacement')attemptReplacement();
 else if(phase.kind==='move')attemptMove(phase);
 else if(phase.kind==='combat'){
  // Keep one real non-scripted combat per side, not forced into every phase.
  if(!attemptCombat()){ses=act(ses,{type:'finish-phase'});}
 }
 // Combat resolution already finishes combat phase on final battle.
 if(phase.kind!=='combat')ses=act(ses,{type:'finish-phase'});
 const ended=ses.state.side!==side||ses.state.over;
 if(ended){L.endSide(reference,old);summary.turnEnds.push([turn,side,old.turn,old.side]);}
 else old.phase=E.currentPhase(g,ses.state)?.id||'finished';
 if(ses.state.turn===4&&ses.state.side==='soviet'&&E.currentPhase(g,ses.state)?.kind==='reinforcement')saveRoundtrip('at shock boundary');
 if(ses.state.turn===5&&ses.state.side==='german'&&E.currentPhase(g,ses.state)?.id==='replacement')saveRoundtrip('after shock and turn 4');
 eq(`postphase t${turn}/${side}/${phase.id}`);
}
assert.ok(step<100,'Campaign did not finish');
assert.equal(ses.state.over,true);assert.equal(ses.state.turn,8);assert.equal(old.turn,8);assert.equal(summary.shockPlacements,1);
assert.equal(summary.turnEnds.length,14);
assert.equal(E.currentPhase(g,ses.state),null,'Terminal phase must not allow new actions');
saveRoundtrip('complete seven-turn campaign');
assert.equal(S.execute(ses,{type:'finish-phase'}).ok,false,'No action after game end');
const finalUndo=S.undo(ses);assert.equal(finalUndo.ok,true);assert.equal(finalUndo.session.state.over,false);
const redo=act(finalUndo.session,{type:'finish-phase'});assert.deepEqual(redo.state,ses.state,'Final phase replay must be deterministic');summary.undoReplays++;
assert.equal(summary.phases,55,'2 opening German + 4 opening Soviet + 6*(4+4) later phases + 1 Shock = 55');
summary.turns=7;return {seed,moveChoice,setupMode,...summary};
}
const cases=[runCase(17,'first'),runCase(101,'last'),runCase(2026,'first'),runCase(509,'last','manual')];
console.log(JSON.stringify({status:'PASS',checkpoint:130,version:'v364',cases,totals:Object.fromEntries(['manualPlacements','phases','realMoves','realBattles','realReplacements','shockPlacements','savedRestores','stateChecks','choiceChecks','undoReplays'].map(k=>[k,cases.reduce((n,c)=>n+c[k],0)]))}));
