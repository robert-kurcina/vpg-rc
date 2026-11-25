'use strict';
const assert=require('node:assert/strict'),E=require('../core/engine'),P=require('../core/native_preview_config'),S=require('../core/session');
const {load}=require('../tools/audit-b4m-native-preview-v360');
const {original,config}=load(),g=E.build(P.withStacking(P.project(original,config),config,'double'));
const attackers=['g24','g41','g57','g46','g47','g56'],defenders=['s3','s5'];
const fixtures={};
for(let seed=1;seed<1000000;seed+=7919){
 const state=E.start(g,seed,'auto-reference');state.units.forEach(u=>delete u.position);Object.assign(state,{side:'german',phaseIndex:2,turn:2});
 for(const id of defenders)Object.assign(state.units.find(u=>u.id===id),{strength:'full',position:{x:8,y:2}});
 const ns=E.neighbors(8,2);attackers.forEach((id,i)=>{const n=ns.find(h=>h.dir===['N','N','NW','NW','NE','NE'][i]);state.units.find(u=>u.id===id).position={x:n.x,y:n.y};});
 let session=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state});
 for(const action of [{type:'declare-battle',attackers,defender:defenders[0]},{type:'finish-phase'}]){const out=S.execute(session,action);assert.ok(out.ok,out.reason);session=out.session;}
 const preview=E.combatPreview(g,session.state,attackers,defenders[0],session.state.pendingRoll);
 if(!['EX','DRL'].includes(preview.outcome)||fixtures[preview.outcome])continue;
 console.error(preview.outcome,seed,preview.odds);
 const options={defenderLossId:'s5',advanceId:'none',...(preview.outcome==='EX'?{exchangeOrder:['g24']}: {})};
 // Pick explicit independent destinations that the resolver accepts jointly.
 for(const a of preview.retreatByDefender.s3)for(const b of preview.retreatByDefender.s5){
  if(fixtures[preview.outcome])continue;
  if(a.x===b.x&&a.y===b.y)continue;
  const choices={...options,retreats:{s3:{x:a.x,y:a.y},s5:{x:b.x,y:b.y}}};
  const out=S.execute(session,{type:'resolve-pending',options:choices});if(!out.ok)continue;
  const before=S.serialize(session);
  const invalid=S.execute(session,{type:'resolve-pending',options:{...choices,retreats:{...choices.retreats,s3:{x:999,y:999}}}});assert.equal(invalid.ok,false);assert.deepEqual(S.serialize(session),before);
  const rec=out.session.state.log.filter(x=>x.type==='combat').at(-1);
  assert.equal(rec.result,preview.outcome);assert.equal(rec.defenderLossId,'s5');assert.equal(rec.advanceId,null);assert.equal(rec.cleared,true);
  for(const id of defenders){const u=out.session.state.units.find(u=>u.id===id);assert.deepEqual(u.position,choices.retreats[id]);assert.equal(u.strength,id==='s5'?'reduced':'full');}
  assert.deepEqual(rec.exchangeLosses,preview.outcome==='EX'?['g24']:[]);
  assert.equal(out.session.state.units.find(u=>u.id==='g24').strength,preview.outcome==='EX'?'reduced':'full');
  fixtures[preview.outcome]={pending:S.serialize(session),resolved:S.serialize(out.session),choices,seed};
 }
 if(Object.keys(fixtures).length===2){require('node:fs').writeFileSync(1,JSON.stringify(fixtures));process.exit(0);}
}
throw Error('Missing EX/DRL fixtures');
