'use strict';
/* Checkpoint 174: opt-in, scenario-neutral objective advance policy. Use the
 * legacy B4M implementation as an action-result oracle, not a strategy oracle.
 * The source CRT, shared engine, terrain renderer, and production route stay fixed. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const P=require('../core/native_preview_config.js');
const E=require('../core/engine.js');
const S=require('../core/session.js');
const AI=require('../core/native_session_ai.js');
const L=require('../legacy/engine.js');
const adapter=require('../core/adapter.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const {original,config}=load(),g=E.build(P.project(original,config));
const lc=L.buildScenario(adapter.legacyScenario(original),adapter.legacyProfile(original));
const settings=require('../games/battle-for-moscow/native-preview/ai-config-capture.json');
const sourceGuard=require('../games/battle-for-moscow/native-preview/ai-config-objective.json');
const sourceBase=require('../games/battle-for-moscow/native-preview/ai-config.json');
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
function fixture({seed=1941,defender='s13',defenderStrength='reduced',target=[10,2]}={}){
 const s=E.start(g,seed,'auto-reference'),old=L.makeState(lc,seed);
 const units=[['g24',9,2],['g41',10,1],['g57',11,2],[defender,...target]];
 for(const [id,x,y] of units){s.units.find(u=>u.id===id).position={x,y};old.units.find(u=>u.id===id).position={x,y};}
 s.units.find(u=>u.id===defender).strength=defenderStrength;
 old.units.find(u=>u.id===defender).strength=defenderStrength;
 // Transplanted tactical positions are synthetic; source is not a historical
 // opening at Moscow. Both engines receive identical legal board occupancy.
 const ses=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:s});
 return {ses,old};
}
function locked(fx,attackers=['g24','g41','g57'],defender='s13'){
 const start=fx.ses,action={type:'declare-battle',attackers,defender};
 check(S.legal(start,action).length===1,'precommit declaration legal');
 const d=S.execute(start,action);
 check(d.ok&&d.session.state.seed===start.state.seed,'declaration consumes no die');
 const before=clone(d.session.state);
 const lock=S.execute(d.session,{type:'finish-phase'});
 check(lock.ok&&lock.session.state.declarationLocked,'die committed after declaration');
 check(before.seed!==lock.session.state.seed,'committed die updates seed');
 return {start,d:d.session,locked:lock.session};
}
check(AI.policy(settings).mode==='objective-advance-v1','new option validates');
check(AI.policy(sourceGuard).mode==='objective-guard-v1','existing guard unchanged');
check(AI.policy(sourceBase).mode==='deterministic-baseline','baseline unchanged');
for(const bad of ['objective-advance-v2','objective-guard-v3',null])
 assert.throws(()=>AI.policy({...settings,mode:bad}),/Unsupported/),checks++;
check(require('../games/battle-for-moscow/game.json').engine==='generic-hex-v1','production uses shared engine');
// DE at 5:1 on die 6. A committed result and a target in the source
// objective registry are both required for an automatic occupation order.
{
 const fx=fixture(),{d,locked:s}=locked(fx);
 check(s.state.pendingRoll===6,'fixture commits six-sided roll 6');
 const early=AI.decide(d,settings);check(early.type!=='resolve-pending'&&early.options===undefined,'no advance choice before die commitment');
 const earlyGuard=AI.decide(s,sourceGuard),earlyBase=AI.decide(s,sourceBase);
 check(earlyGuard.options.advanceId==='none'&&earlyBase.options.advanceId==='none','prior policies still decline');
 const seed=s.state.seed,historyLength=s.history.length;
 const next=AI.decide(s,settings);
 check(next.type==='resolve-pending'&&Object.keys(next.options).length===0,'objective policy selects source default advance');
 check(s.state.seed===seed&&s.history.length===historyLength,'AI inspection is side-effect free');
 // Only the decision shape is tested here: B4M's ordinary opening does not
 // present a legitimate no-die concealed-battle fixture in this scenario.
 const noDie={...s,state:{...s.state,pendingRoll:0}};
 check(Object.keys(AI.decide(noDie,settings).options).length===0,'automatic NE never carries a forbidden advance option');
 const saved=S.serialize(s),restore=S.restore(clone(saved),{scenarioId:g.game.id,engine:'generic-hex-v1',config:g});
 check(restore.state.seed===seed&&S.serialize(restore).sha256===saved.sha256,'committed save restores before choice');
 const result=S.execute(s,next);
 check(result.ok&&result.result.record.result==='DE','source DE adjudicated');
 check(result.result.record.advanceId==='g24','source-configured weakest attacker advances');
 check(result.session.state.control['10,2']==='german','Moscow control transferred through native claim');
 const legacyDie=L.rollCombatDie(fx.old);check(legacyDie===s.state.pendingRoll,'legacy PRNG agrees after commitment');
 const oldRec=L.resolveAttack(lc,fx.old,['g24','g41','g57'],'s13',legacyDie,next.options);
 check(oldRec.outcome==='DE'&&oldRec.advanceUnit===result.result.record.advanceId,'legacy and native advance identity agree');
 const at=id=>({native:result.session.state.units.find(u=>u.id===id).position,
  legacy:fx.old.units.find(u=>u.id===id).position});
 for(const id of ['g24','g41','g57','s13'])check(JSON.stringify(at(id).native)===JSON.stringify(at(id).legacy),'legacy-native position agreement '+id);
 check(fx.old.control['10,2']===result.session.state.control['10,2'],'legacy/native control agreement');
 const undo=S.undo(result.session);check(undo.ok&&S.serialize(undo.session).sha256===saved.sha256,'undo reproduces committed state');
 const again=S.execute(undo.session,next);check(again.ok&&S.serialize(again.session).sha256===S.serialize(result.session).sha256,'replay deterministic');
 const baseline=S.execute(s,earlyGuard);
 check(baseline.ok&&baseline.result.record.advanceId===null&&baseline.session.state.control['10,2']==='soviet','original policies do not advance');
}
// A full-strength Moscow defender holds on DR (source special rule): there is
// no legal objective advance even when the target is a victory city.
{
 const fx=fixture({seed:123456,defenderStrength:'full'}),x=locked(fx);
 const found={fx,...x};
 check(!!found,'found committed die 1');
 const d=found.locked.state.declarations[0],p=E.combatPreview(g,found.locked.state,d.attackers,d.defender,1);
 check(p.outcome==='DR'&&p.cityHold,'full strength Moscow DR hold');
 const next=AI.decide(found.locked,settings);
 check(next.options.advanceId==='none','defender still holding: refuse advance');
 const after=S.execute(found.locked,next);check(after.ok&&after.result.record.cityHold,'Moscow hold transaction');
 check(after.result.record.advanceId===null&&after.session.state.control['10,2']==='soviet','no false capture');
}
// The policy does not convert ordinary nonobjective DE battles into automatic
// occupations. This remains a distinct experimental strategy choice.
{
 const fx=fixture({target:[9,3]}),start=fx.ses;
 const action={type:'declare-battle',attackers:['g24'],defender:'s13'};
 check(S.legal(start,action).length===1,'ordinary attack legal');
 const d=S.execute(start,action).session;
 const s=S.execute(d,{type:'finish-phase'}).session;
 check(AI.decide(s,settings).options.advanceId==='none','nonobjective combat: decline advance');
}
const report={status:'PASS',checkpoint:174,version:'v408',scope:'synthetic source-rules differential at Moscow; not historical setup certification',
 checks,sourceCRT:'unchanged',engine:'unchanged',productionSelector:'legacy-b4m-v1',
 advancedDE:true,legacyActionParity:true,dieCommitIsolation:true,moscowDRHold:true,
 defaultPoliciesPreserved:true,undoAndSave:true,
 limitations:['Synthetic Moscow tactical board positions','No new legacy strategic AI parity claim','No active B4M production cutover']};
if(process.argv.includes('--write-audit'))fs.writeFileSync(path.join(__dirname,'../rules/audit/b4m-objective-advance-v408.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
