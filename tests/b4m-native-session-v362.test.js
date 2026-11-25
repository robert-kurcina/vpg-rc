'use strict';
/* Checkpoint 128: the production legacy session still owns the B4M browser.
 * Native generic-hex uses the SAME reversible WargameSession boundary, opt in.
 */
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const project=require('../core/native_preview_config.js');
const E=require('../core/engine.js');
const legacy=require('../legacy/engine.js');
const adapter=require('../core/adapter.js');
const S=require('../core/session.js');
const saveMod=require('../core/native_session_save.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const {original,config}=load();
const g=E.build(project.project(original,config));
const oldGame=legacy.buildScenario(adapter.legacyScenario(original),adapter.legacyProfile(original));
const oldStart=legacy.makeState(oldGame,17);
const candidates=legacy.attackCandidates(oldGame,oldStart,'german');
const compact=s=>({units:Object.fromEntries(s.units.map(u=>[u.id,{position:u.position||null,strength:u.strength}])),control:s.control,seed:s.seed});
const create=(seed=17)=>S.create({scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g,state:E.start(g,seed,'auto-reference')});
const action=(sess,cmd)=>{const a=S.execute(sess,cmd);assert.equal(a.ok,true,a.reason);return a.session;};
const declare=(sess,b)=>action(sess,{type:'declare-battle',attackers:b.attackers,defender:b.defender});
const commit=sess=>action(sess,{type:'finish-phase'});
const resolve=(sess,opts={})=>action(sess,{type:'resolve-pending',options:opts});
let checks=0,executed=0,singleParity=0,choiceChecks=0,negative=0,paired=0,undoChecks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const ok=(a,msg)=>{assert.ok(a,msg);checks++;};
// An isolated first battle: sampled die is committed only after declarations,
// and the actual historical source CRT result remains the independent oracle.
for(const b of candidates){
 let sess=create(17);const stateBefore=copy(sess.state),seed=sess.state.seed;
 sess=declare(sess,b);eq(sess.state.seed,seed,'No precommit draw');
 const afterDeclaration=sess;sess=commit(sess);
 ok(sess.state.pendingRoll>=1&&sess.state.pendingRoll<=6,'Committed die exists');
 const die=sess.state.pendingRoll,ref=copy(oldStart);ref.phase='combat';
 eq(legacy.rollCombatDie(ref),die,'Source legacy committed die');
 const result=legacy.resolveAttack(oldGame,ref,b.attackers,b.defender,die,{advanceId:'none'});
 ok(result,'Legacy result');
 const committed=sess;sess=resolve(sess,{advanceId:'none'});
 eq(compact(sess.state),compact(ref),'Committed combat parity');singleParity++;
 const undone=S.undo(sess);ok(undone.ok);eq(undone.session.state,committed.state,'Undo restores seed and committed roll');undoChecks++;
 eq(resolve(undone.session,{advanceId:'none'}).state,sess.state,'Re-resolve deterministic');undoChecks++;
 const restored= S.restore(copy(S.serialize(committed)),{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g});
 eq(restored.state,committed.state);eq(resolve(restored,{advanceId:'none'}).state,sess.state);
 const previous=S.undo(committed).session;
 eq(previous.state,afterDeclaration.state,'Undo commit preserves declared battle');
 eq(S.undo(previous).session.state,stateBefore,'Undo declaration restores start');
 executed++;
}
// Competing disjoint opening attacks: seed stream and actual state must match
// legacy.resolveDeclaredBattles, including the next die commitment and Undo.
const pairs=[];
for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
 const a=candidates[i],b=candidates[j];
 if(a.defender!==b.defender&&!a.attackers.some(id=>b.attackers.includes(id)))pairs.push([a,b]);
}
assert.equal(pairs.length,293);
for(const [a,b] of pairs){
 let sess=declare(declare(create(17),a),b);
 const old=copy(oldStart);old.phase='combat';
 const reference=legacy.resolveDeclaredBattles(oldGame,old,[a,b].map(d=>({defender:d.defender,attackers:d.attackers,declaredOdds:d.odds})));
 sess=commit(sess);
 eq(sess.state.pendingRoll,reference[0].die,'First committed die');
 const first=resolve(sess);eq(first.state.pendingRoll,reference[1].die,'Next die committed only after valid resolution');
 const end=resolve(first);eq(compact(end.state),compact(old),'Two-battle parity including RNG');
 ok(E.currentPhase(g,end.state)?.kind==='move','Combat moves into configured movement phase');
 // Undo completion and second combat, then replay using the same recorded die.
 const back=S.undo(end);ok(back.ok);
 eq(back.session.state,first.state);
 eq(resolve(back.session).state,end.state);
 paired++;
}
// One example for each result-dependent choice family, selected from the
// legacy oracle's allowed choices rather than fabricated action options.
const branches={AL:false,EX:false,retreat:false,advance:false};
for(const b of candidates)for(let seedIndex=0;seedIndex<50;seedIndex++){
 const seed=1+seedIndex*100000;
 if(Object.values(branches).every(Boolean))break;
 let sess=commit(declare(create(seed),b));const die=sess.state.pendingRoll;
 const preview=legacy.battlePreview(oldGame,oldStart,b,die);if(!preview)continue;
 const options={advanceId:'none'};
 let branch=null;
 if(preview.outcome==='AL'&&b.attackers.length>1&&!branches.AL){options.attackerLossId=b.attackers.at(-1);branch='AL';}
 else if(preview.outcome==='EX'&&b.attackers.length>1&&!branches.EX){options.exchangeOrder=[...b.attackers].reverse();branch='EX';}
 else if(['DR','DRL','EX'].includes(preview.outcome)&&preview.retreat.length>1&&!branches.retreat){const p=preview.retreat.at(-1);options.retreatTo={x:p.x,y:p.y};branch='retreat';}
 else if(preview.outcome==='DE'&&b.attackers.length>1&&!branches.advance){options.advanceId=b.attackers.at(-1);branch='advance';}
 if(!branch)continue;
 const old=copy(oldStart);old.phase='combat';old.seed=seed;
 eq(legacy.rollCombatDie(old),die,'Legacy choice die');
 const rec=legacy.resolveAttack(oldGame,old,b.attackers,b.defender,die,options);
 if(!rec)continue;
 const applied=S.execute(sess,{type:'resolve-pending',options});
 if(!applied.ok)continue;
 eq(compact(applied.session.state),compact(old),'Non-default '+branch+' parity');
 branches[branch]=true;choiceChecks++;
}
eq(branches,{AL:true,EX:true,retreat:true,advance:true},'Every choice family exercised');
{
 const b=candidates[0],start=create();
 const noChange=(sess,cmd,reason)=>{
  const originalState=JSON.stringify(sess.state),history=JSON.stringify(sess.history),seed=sess.state.seed;
  const out=S.execute(sess,cmd);assert.equal(out.ok,false,reason);assert.strictEqual(out.session,sess);
  eq(JSON.stringify(sess.state),originalState);eq(JSON.stringify(sess.history),history);eq(sess.state.seed,seed);negative++;
 };
 noChange(start,{type:'resolve-pending'},'Resolve without declaration');
 let declared=declare(start,b);
 noChange(declared,{type:'declare-battle',attackers:b.attackers,defender:b.defender},'Duplicate declaration');
 noChange(declared,{type:'resolve-pending'},'Cannot resolve before lock');
 let committed=commit(declared);
 noChange(committed,{type:'declare-battle',attackers:b.attackers,defender:b.defender},'Cannot declare after lock');
 noChange(committed,{type:'finish-phase'},'Cannot finish active combat prematurely');
 noChange(committed,{type:'resolve-pending',die:committed.state.pendingRoll===6?1:committed.state.pendingRoll+1},'Cannot substitute committed die');
 noChange(committed,{type:'resolve-pending',options:{attackerLossId:'invalid'}},'Invalid choice does not consume roll');
 // Previews must not write session history or use real RNG.
 const preview=S.execute(declared,{type:'combat-preview',defender:b.defender,attackers:b.attackers,die:3});
 ok(preview.ok);assert.strictEqual(preview.session,declared);eq(declared.state.seed,17);
 const saved=S.serialize(committed);eq(saved.version,1);eq(saved.format,saveMod.FORMAT);
 const mutations=[
  x=>x.version=2,x=>x.scenarioId='other',x=>x.engine='legacy-b4m-v1',
  x=>x.packageSHA256='0'.repeat(64),x=>x.sha256='0'.repeat(64),
  x=>x.state.seed=999,x=>x.history[0].state.units[0].position={x:999,y:999},
  x=>x.state.phaseIndex=999,x=>x.history[0].usedUnitIds=['unknown'],
  x=>x.history[1].state.declarations[0].attackers.push('invented'),
  x=>x.unexpectedField=true
 ];
 for(const mutate of mutations){const t=copy(saved);mutate(t);assert.throws(()=>S.restore(t,{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g}));negative++;}

 // Even if a caller recalculates the unkeyed checksum, structural invalidity
 // cannot be promoted into the native engine's executable state.
 const crypto=require('node:crypto');
 const resigned=x=>{const {sha256,...p}=x;x.sha256=crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');return x;};
 for(const mutate of [
  x=>x.state.units[0].id='unregistered',
  x=>x.state.units[1].position={x:999,y:999},
  x=>x.state.pendingRoll=null,
  x=>x.history[0].state.phaseIndex=800,
  x=>x.history[0].usedUnitIds=['unknown'],
  x=>x.state.declarations[0].defender='unregistered'
 ]){
  const tampered=resigned(copy(saved));mutate(tampered);resigned(tampered);
  assert.throws(()=>S.restore(tampered,{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g}));negative++;
 }

 const changed=copy(config);changed.overrides.rules.movement.railAllowance=7;
 const other=E.build(project.project(original,changed));
 assert.throws(()=>S.restore(copy(saved),{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:other}),/package mismatch/);negative++;
 assert.throws(()=>S.restore(copy(saved),{scenarioId:'battle-for-moscow',config:g}),/Unsupported session save format/);negative++;
}
// Existing legacy action session and its v2 save contract must remain usable.
const legacyS=S.create({scenarioId:'battle-for-moscow',config:oldGame,state:legacy.makeState(oldGame,17)});
eq(S.serialize(legacyS).version,2);ok(S.restore(S.serialize(legacyS),{scenarioId:'battle-for-moscow',config:oldGame}));
console.log(JSON.stringify({status:'PASS',checkpoint:128,version:'v362',singleParity,paired,choiceChecks,branches,negative,undoChecks,assertions:checks,productionEngine:original.game.engine}));
