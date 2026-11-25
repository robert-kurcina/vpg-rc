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
const summary={turns:0,multiMovePhases:0,multiReplacementPhases:0,maximumMovesPerPhase:0,maximumReplacementsPerPhase:0,communicationChecks:0,communicationConnected:0,communicationDisconnected:0,manualPlacements:0,phases:0,realMoves:0,realBattles:0,realReplacements:0,shockPlacements:0,savedRestores:0,stateChecks:0,choiceChecks:0,undoReplays:0,phasesByTurn:{},turnEnds:[],multiBattlePhases:0,allCombatOutcomes:{},alternateChoices:{AL:0,EX:0,retreat:0,advance:0},materialChoiceDifferences:{AL:0,EX:0,retreat:0,advance:0},invalidRollChecks:0,pendingSaveRestores:0,combatPhaseDeclares:0,combatPhaseMax:0};
function eq(stage){assert.deepEqual(canonical(ses.state),canonical(old),stage);summary.stateChecks++}
function saveRoundtrip(stage){const restored=S.restore(copy(S.serialize(ses)),{scenarioId:original.game.id,engine:'generic-hex-v1',config:g});assert.deepEqual(restored.state,ses.state,stage);assert.deepEqual(restored.history,ses.history,stage);ses=restored;summary.savedRestores++}
function attemptMove(phase){const faction=ses.state.side,mode=phase.movementMode;
 let moved=0;
 const eligible=ses.state.units.filter(u=>(u.army||u.faction)===faction&&u.position&&u.strength!=='dead').map(u=>u.id);
 for(const id of eligible){
  if(moved>=4)break;
  const u=ses.state.units.find(v=>v.id===id),oldUnit=old.units.find(x=>x.id===id);
  if(!oldUnit.position||mode==='panzer'&&u.type!=='tank'||mode==='rail'&&faction!=='soviet')continue;
  let actual=E.legalMoves(g,ses.state,u.id),ref=L.legalMoves(reference,old,oldUnit,mode);
  assert.deepEqual(actual,ref,`Dynamic sequential legal-move parity ${ses.state.turn}/${faction}/${mode}/${u.id}`);summary.choiceChecks++;
  if(!actual.length)continue;
  const dest=actual[moveChoice==='last'?actual.length-1:0];assert.equal(L.move(reference,old,u.id,dest.x,dest.y,mode),true);
  const before=ses;
  ses=act(ses,{type:'move',unitId:u.id,x:dest.x,y:dest.y});
  assert.deepEqual(E.legalMoves(g,ses.state,u.id),[],'Native move-once-per-phase must remain enforced');
  let undo=S.undo(ses);assert.equal(undo.ok,true);assert.deepEqual(undo.session.state,before.state);summary.undoReplays++;
  ses=act(undo.session,{type:'move',unitId:u.id,x:dest.x,y:dest.y});
  summary.realMoves++;moved++;eq('after sequential movement');
 }
 if(moved>1)summary.multiMovePhases++;
 summary.maximumMovesPerPhase=Math.max(summary.maximumMovesPerPhase,moved);
}
function attemptReplacement(){
 // Validate the same live friendly communication graph before spending points;
 // this covers friendly unit transit, enemy ZOC, Moscow and entry corridors.
 for(const u of ses.state.units.filter(u=>(u.army||u.faction)===ses.state.side&&u.position)){
  const legacy=old.units.find(v=>v.id===u.id);
  const actual=E.communication(g,ses.state,u),expected=L.communication(reference,old,legacy);
  assert.equal(actual,expected,`Communication mismatch t${ses.state.turn} ${ses.state.side} ${u.id}`);
  summary.communicationChecks++;
  if(actual)summary.communicationConnected++;else summary.communicationDisconnected++;
 }
 const budget=E.replacementBudget(g,ses.state);
 assert.equal(budget,L.replacementBudget(reference,old));
 let used=0;
 while(used<budget){
  const actual=E.replacementOptions(g,ses.state),ref=L.replacementOptions(reference,old);
  assert.deepEqual(norm(actual),norm(ref),`Dynamic sequential replacement parity after ${used} choices t${ses.state.turn} ${ses.state.side}`);summary.choiceChecks++;
  if(!actual.length)break;
  // Test ability to enter the board as well as restoring a reduced counter.
  const choice=used%2===0?(actual.find(o=>o.type==='enter')||actual[0]):(actual.find(o=>o.type==='restore')||actual[0]);
  assert.equal(L.applyReplacement(reference,old,choice),true);
  ses=act(ses,{type:'replacement',choice});summary.realReplacements++;used++;eq('after sequential replacement');
  if(choice.type==='enter'){
   const sameTurn=E.replacementOptions(g,ses.state).some(o=>o.type==='restore'&&o.id===choice.id);
   assert.equal(sameTurn,false,'A just-entered unit cannot be restored in the same turn');
   const illegal=S.execute(ses,{type:'replacement',choice:{type:'restore',id:choice.id}});
   assert.equal(illegal.ok,false,'Double-dip replacement must be rejected atomically');
   assert.strictEqual(illegal.session,ses);
  }
 }
 const after=E.replacementOptions(g,ses.state);
 if(used===budget)assert.deepEqual(after,[],'Full replacement budget must not be exceeded');
 if(used>1)summary.multiReplacementPhases++;
 summary.maximumReplacementsPerPhase=Math.max(summary.maximumReplacementsPerPhase,used);
}
function attemptCombat(){
 const side=ses.state.side;
 const all=L.attackCandidates(reference,old,side);
 const legal=all.filter(b=>S.legal(ses,{type:'declare-battle',attackers:b.attackers,defender:b.defender}).length);
 if(!legal.length)return false;
 // Prefer an actual disjoint pair, not two actions that borrow the same unit.
 // Starting from different candidate offsets exercises distinct interactions.
 const offset=seed%legal.length;
 const ordered=[...legal.slice(offset),...legal.slice(0,offset)];
 let chosen=null;
 for(const a of ordered){
  const b=ordered.find(x=>x.defender!==a.defender&&!x.attackers.some(id=>a.attackers.includes(id)));
  if(b){chosen=[a,b];break;}
 }
 if(!chosen)chosen=[ordered[0]];
 // Reverse announced resolution order for odd seeds; legal declarations are
 // still checked against the same pre-commit board.
 if(chosen.length===2&&seed%2===1)chosen.reverse();
 const stateBefore=ses.state;
 for(const b of chosen){
  const before=ses;
  ses=act(ses,{type:'declare-battle',attackers:b.attackers,defender:b.defender});
  assert.equal(ses.state.seed,before.state.seed,'Declaration must never consume RNG');
 }
 summary.combatPhaseDeclares+=chosen.length;
 summary.combatPhaseMax=Math.max(summary.combatPhaseMax,chosen.length);
 if(chosen.length===2)summary.multiBattlePhases++;
 assert.equal(ses.state.seed,stateBefore.seed);
 ses=act(ses,{type:'finish-phase'});
 let legacyNextDie=null;
 for(let idx=0;idx<chosen.length;idx++){
  const battle=chosen[idx];
  const die=ses.state.pendingRoll;
  const legacyDie=legacyNextDie??L.rollCombatDie(old);legacyNextDie=null;
  assert.equal(die,legacyDie,`Committed die t${ses.state.turn} ${side} battle ${idx+1}`);
  const preview=L.battlePreview(reference,old,battle,die);
  assert.ok(preview,`Legacy must preview declared battle ${battle.defender}`);
  // A real human can choose alternatives after the die, but never substitute it.
  const opts={advanceId:'none'};
  let branch=null;
  if(preview.outcome==='AL'&&battle.attackers.length>1){opts.attackerLossId=battle.attackers.at(-1);branch='AL';}
  else if(preview.outcome==='EX'&&battle.attackers.length>1){opts.exchangeOrder=[...battle.attackers].reverse();branch='EX';}
  else if(['DR','DRL','EX'].includes(preview.outcome)&&preview.retreat.length>1){const p=preview.retreat.at(-1);opts.retreatTo={x:p.x,y:p.y};branch='retreat';}
  else if(preview.outcome==='DE'&&battle.attackers.length>1){opts.advanceId=battle.attackers.at(-1);branch='advance';}
  const pending=ses;
  const beforeInvalid=ses.state.seed;
  const mismatched=die===6?1:die+1;
  let invalid=S.execute(ses,{type:'resolve-pending',die:mismatched,options:opts});
  assert.equal(invalid.ok,false,'Cannot override committed combat die');
  assert.strictEqual(invalid.session,ses,'Rejected choice must not fork the session');
  assert.equal(ses.state.seed,beforeInvalid,'Rejected choice cannot draw RNG');
  summary.invalidRollChecks++;
  if(idx===0&&chosen.length>1){
   const restored=S.restore(copy(S.serialize(ses)),{scenarioId:original.game.id,engine:'generic-hex-v1',config:g});
   assert.deepEqual(restored.state,ses.state,'Pending first roll survives save');
   assert.deepEqual(restored.history,ses.history);
   ses=restored;summary.pendingSaveRestores++;
  }
  const defaultCounterfactual=copy(old);
  const defaultRecord=branch?L.resolveAttack(reference,defaultCounterfactual,battle.attackers,battle.defender,die,{advanceId:'none'}):null;
  if(branch)assert.ok(defaultRecord,'Legacy counterfactual choice is a legal combat resolution');
  const record=L.resolveAttack(reference,old,battle.attackers,battle.defender,die,opts);
  assert.ok(record,`Legacy resolved declared battle ${battle.defender}`);
  const result=S.execute(ses,{type:'resolve-pending',options:opts});
  assert.equal(result.ok,true,`Native combat ${battle.defender}: ${result.reason}`);
  ses=result.session;
  const nativeRecord=result.result.record;
  assert.equal(nativeRecord.result,record.outcome,'CRT outcome parity');
  summary.allCombatOutcomes[record.outcome]=(summary.allCombatOutcomes[record.outcome]||0)+1;
  if(idx+1<chosen.length){
   legacyNextDie=L.rollCombatDie(old);assert.equal(ses.state.pendingRoll,legacyNextDie,'Next die must commit only after preceding resolution');
   const nextRestored=S.restore(copy(S.serialize(ses)),{scenarioId:original.game.id,engine:'generic-hex-v1',config:g});
   assert.deepEqual(nextRestored.state,ses.state,'Second committed die survives save/restore');
   assert.deepEqual(nextRestored.history,ses.history);ses=nextRestored;summary.pendingSaveRestores++;
  }
  // Compare committed board immediately. Last battle may advance native side
  // before the legacy endSide boundary in the outer loop.
  const partial=s=>({units:canonical(s).units,control:s.control,seed:s.seed});
  assert.deepEqual(partial(ses.state),partial(old),'After each battle: positions, strengths, control and RNG');
  summary.stateChecks++;
  const undo=S.undo(ses);assert.equal(undo.ok,true);assert.deepEqual(undo.session.state,pending.state,'Undo must restore pending die and choices');summary.undoReplays++;
  const replay=act(undo.session,{type:'resolve-pending',options:opts});
  assert.deepEqual(replay.state,ses.state,'Deterministic re-resolve after Undo');
  ses=replay;summary.realBattles++;
  if(branch){
   summary.alternateChoices[branch]++;
   if(JSON.stringify(canonical(old).units)!==JSON.stringify(canonical(defaultCounterfactual).units)||JSON.stringify(old.control)!==JSON.stringify(defaultCounterfactual.control))summary.materialChoiceDifferences[branch]++;
  }
 }
 return true;
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
// Reachable endgame ownership counterfactuals, not merely a winner assertion
// from four scripted trajectories. Prove both engines enforce the same
// Moscow-priority outcome and the same final half-turn cursor.
let terminalFixtures=0;
for(const [name,moscow,other,expected] of [
 ['german-moscow','german','soviet','german'],
 ['soviet-moscow-other-city','soviet','soviet','soviet'],
 ['soviet-moscow-no-other-city','soviet','german','draw']
]){
 const native=E.start(g,171,'auto-reference'),legacy=L.makeState(reference,171);
 native.turn=7;native.side='soviet';native.phaseIndex=3;native.ply=13;
 legacy.turn=7;legacy.side='soviet';legacy.ply=13;
 for(const city of reference.cities){
  const id=`${city.x},${city.y}`;
  const owner=city.x===10&&city.y===2?moscow:other;
  native.control[id]=owner;legacy.control[id]=owner;
 }
 assert.equal(E.result(g,native),L.gameResult(reference,legacy),name+' direct winner parity');
 assert.equal(E.result(g,native),expected,name+' source outcome');
 assert.equal(E.currentPhase(g,native)?.id,'movement');
 assert.equal(E.endPhase(g,native),true);
 L.endSide(reference,legacy);
 for(const field of ['winner','over','turn','side','ply'])assert.deepEqual(native[field],legacy[field],name+' '+field);
 assert.equal(E.currentPhase(g,native),null);
 terminalFixtures++;
}
const totals=Object.fromEntries(['multiMovePhases','multiReplacementPhases','communicationChecks','communicationConnected','communicationDisconnected','manualPlacements','phases','realMoves','realBattles','realReplacements','shockPlacements','savedRestores','stateChecks','choiceChecks','undoReplays','multiBattlePhases','invalidRollChecks','pendingSaveRestores','combatPhaseDeclares'].map(k=>[k,cases.reduce((n,c)=>n+c[k],0)]));
assert.ok(totals.multiMovePhases>=4,'Expected genuine multi-movement phases across campaign cases');
assert.ok(totals.multiReplacementPhases>=4,'Expected multiple replacements within the same phase');
assert.ok(totals.multiBattlePhases>=4,'At least one genuine simultaneous two-battle phase per campaign');
const peakMovements=Math.max(...cases.map(c=>c.maximumMovesPerPhase));
const peakReplacements=Math.max(...cases.map(c=>c.maximumReplacementsPerPhase));
assert.ok(peakMovements>=3,'Must exercise multiple distinct moves in one phase');
assert.ok(peakReplacements>=3,'Must exhaust a multi-replacement budget');
assert.ok(totals.communicationChecks>100,'Communication parity must be checked on evolving boards');
const choiceTotals=Object.fromEntries(['AL','EX','retreat','advance'].map(k=>[k,cases.reduce((n,c)=>n+c.materialChoiceDifferences[k],0)]));
assert.ok(Object.values(choiceTotals).every(n=>n>0),'Every chosen loss, exchange, retreat and advance family must materially alter legacy game state');
console.log(JSON.stringify({status:'PASS',checkpoint:132,version:'v366',cases,totals,peakMovements,peakReplacements,terminalFixtures,materialChoiceDifferences:choiceTotals}));
