'use strict';
const assert=require('node:assert/strict'),E=require('../core/engine'),P=require('../core/native_preview_config'),S=require('../core/session');
const {load}=require('../tools/audit-b4m-native-preview-v360');
const {original,config}=load(),g=E.build(P.withStacking(P.project(original,config),config,'double'));
const attackers=['g23','g35','g24','g41'],defenders=['s3','s5'];
for(let seed=1;seed<1000000;seed+=7919){
 const state=E.start(g,seed,'auto-reference');state.units.forEach(u=>delete u.position);Object.assign(state,{side:'german',phaseIndex:2,turn:2});
 for(const id of defenders)Object.assign(state.units.find(u=>u.id===id),{strength:'full',position:{x:10,y:2}});
 const ns=E.neighbors(10,2);attackers.forEach((id,i)=>{const n=ns.find(h=>h.dir===['S','S','N','N'][i]);state.units.find(u=>u.id===id).position={x:n.x,y:n.y};});
 let session=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state});
 for(const action of [{type:'declare-battle',attackers,defender:defenders[0]},{type:'finish-phase'}]){const out=S.execute(session,action);assert.ok(out.ok,out.reason);session=out.session;}
 const preview=E.combatPreview(g,session.state,attackers,defenders[0],session.state.pendingRoll);
 if(preview.outcome!=='DR')continue;
 const hold=S.execute(session,{type:'resolve-pending',options:{standFastId:'s5',advanceId:'none'}});assert.ok(hold.ok,hold.reason);
 const retreat=S.execute(session,{type:'resolve-pending',options:{standFastId:'none',advanceId:'none'}});assert.ok(retreat.ok,retreat.reason);
 require("node:fs").writeFileSync(1,JSON.stringify({pending:S.serialize(session),hold:S.serialize(hold.session),retreat:S.serialize(retreat.session),seed}));process.exit(0);
}
throw Error('No DR fixture');
