'use strict';
const A=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const Project=require('../core/native_preview_config'),E=require('../core/engine'),S=require('../core/session'),AI=require('../core/native_session_ai'),CRT=require('../core/historical_crt');
const {original,config}=load(),policy=require('../games/battle-for-moscow/native-preview/ai-config-objective.json');
function run(variant,seed){
 const base=Project.project(original,config);
 if(variant==='advanced'){base.rules.combat.crtVariant='advanced';base.rules.combat.table=CRT.tableFor('battle-for-moscow','advanced');}
 const g=E.build(base),scope={scenarioId:g.game.id,engine:'generic-hex-v1',config:g};
 let session=S.create({...scope,state:E.start(g,seed,'auto-reference')});
 const counts={},odds={},outcomes={};let sideTurns=0,actions=0,restores=0;const start=Date.now();
 while(!session.state.over&&sideTurns<14){
  const initial=session,prior=JSON.stringify(initial.state);
  const result=AI.playSide(session,policy,({before,after,action,result})=>{
   counts[action.type]=(counts[action.type]||0)+1;actions++;
   if(action.type==='declare-battle')A.equal(before.state.seed,after.state.seed);
   if(action.type==='resolve-pending'){const r=result.record;const o=String(r.odds??'unknown');odds[o]=(odds[o]||0)+1;outcomes[r.result]=(outcomes[r.result]||0)+1;}
  });
  A.equal(JSON.stringify(initial.state),prior);A.ok(result.actions.length);session=result.session;sideTurns++;
  const undo=S.undo(session);A.ok(undo.ok);const replay=S.execute(undo.session,result.actions.at(-1).action);A.ok(replay.ok);A.deepEqual(replay.session.state,session.state);A.deepEqual(replay.session.history,session.history);
  const saved=S.serialize(session),restored=S.restore(saved,scope);A.deepEqual(restored.state,session.state);A.deepEqual(restored.history,session.history);restores++;
 }
 A.equal(session.state.over,true);A.ok(counts['resolve-pending']>0);A.ok(counts.move>0);
 return {variant,seed,sideTurns,actions,counts,odds,outcomes,restores,winner:session.state.winner,stateHash:S.serialize(session).sha256,elapsedMs:Date.now()-start};
}
const reports=[];for(const variant of ['standard','advanced']){const first=run(variant,7),second=run(variant,7);const stable=({elapsedMs,...r})=>r;A.deepEqual(stable(first),stable(second));reports.push(first);}
const report={status:'PASS',policy,reports,repeatRuns:2};console.log(JSON.stringify(report,null,2));if(process.env.AUDIT_PATH)fs.writeFileSync(process.env.AUDIT_PATH,JSON.stringify(report,null,2)+'\n');
