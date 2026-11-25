'use strict';
/* Checkpoint 132: source-compatible replacement entry/restore exclusion.
 * Real source board and two independent game-state executables.
 */
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const P=require('../core/native_preview_config.js'),E=require('../core/engine.js');
const L=require('../legacy/engine.js'),A=require('../core/adapter.js'),S=require('../core/session.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const {original,config}=load();
const pkg=P.project(original,config),g=E.build(pkg);
const ref=L.buildScenario(A.legacyScenario(original),A.legacyProfile(original));
const legacy=L.makeState(ref,17);legacy.side='soviet';legacy.phase='replacement';
const state=E.start(g,17,'auto-reference');state.side='soviet';state.phaseIndex=0;
let session=S.create({scenarioId:original.game.id,engine:'generic-hex-v1',config:g,state});
assert.equal(E.currentPhase(g,session.state).kind,'replacement');
const norm=x=>x.map(o=>[o.type,o.id,o.x??null,o.y??null].join(':')).sort();
assert.deepEqual(norm(E.replacementOptions(g,state)),norm(L.replacementOptions(ref,legacy)));
// Prefer an entry with a connected rear corridor, so restoration would otherwise
// appear as a legal next action in the native engine.
const choice=E.replacementOptions(g,state).find(o=>o.type==='enter'&&o.x===10&&o.y===0);
assert.ok(choice,'Source offers an eligible Soviet east entry');
assert.equal(L.applyReplacement(ref,legacy,choice),true);
const committed=S.execute(session,{type:'replacement',choice});assert.equal(committed.ok,true);
session=committed.session;
assert.deepEqual(norm(E.replacementOptions(g,session.state)),norm(L.replacementOptions(ref,legacy)));
const restored={type:'restore',id:choice.id};
assert.equal(E.replacementOptions(g,session.state).some(o=>o.type==='restore'&&o.id===choice.id),false);
assert.equal(L.replacementOptions(ref,legacy).some(o=>o.type==='restore'&&o.id===choice.id),false);
const invalid=S.execute(session,{type:'replacement',choice:restored});
assert.equal(invalid.ok,false);assert.strictEqual(invalid.session,session);
assert.equal(session.state.replacementUsed,1);
// The exclusion is a generic opt-in policy, not a B4M identity branch:
// disabling it reproduces the previously observed erroneous option.
const loosePkg=copy(pkg);loosePkg.rules.replacements.preventSameTurnEntryRestore=false;
const loose=E.build(loosePkg);
assert.equal(E.replacementOptions(loose,session.state).some(o=>o.type==='restore'&&o.id===choice.id),true,
 'Adversarial check demonstrates the policy is active and source relevant');
const undone=S.undo(session);assert.equal(undone.ok,true);
assert.deepEqual(undone.session.state,state);
assert.equal(E.replacementOptions(g,undone.session.state).some(o=>o.type==='enter'&&o.id===choice.id&&o.x===choice.x&&o.y===choice.y),true);
// Source rule refers to this turn only. In a later turn the surviving reduced
// counter may be restored, subject to communication and budget.
const later=copy(session.state);later.turn=2;later.phaseIndex=0;later.side='soviet';later.replacementUsed=0;
const sourceLater=copy(legacy);sourceLater.turn=2;
assert.deepEqual(norm(E.replacementOptions(g,later)),norm(L.replacementOptions(ref,sourceLater)));
assert.equal(E.replacementOptions(g,later).some(o=>o.type==='restore'&&o.id===choice.id),true);
const badCfg=copy(config);badCfg.overrides.rules.replacements.preventSameTurnEntryRestore='true';
assert.throws(()=>P.project(original,badCfg),/invalid replacement profile/);
const badPkg=copy(pkg);badPkg.rules.replacements.preventSameTurnEntryRestore='true';
assert.throws(()=>E.build(badPkg),/Invalid same-turn replacement restore policy/);
const unexpectedCfg=copy(config);unexpectedCfg.overrides.rules.replacements.sourceReplacementBudgetOverride=999;
assert.throws(()=>P.project(original,unexpectedCfg),/invalid replacement profile/);
assert.equal(original.game.engine,'generic-hex-v1');
console.log(JSON.stringify({status:'PASS',checkpoint:132,version:'v366',entry:choice,policy:'preventSameTurnEntryRestore',laterRestore:true,sourceOptionParity:true,negativeCases:3}));
