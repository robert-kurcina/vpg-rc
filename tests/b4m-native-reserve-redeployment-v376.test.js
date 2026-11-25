'use strict';
/* Checkpoint 142: source-identified Soviet reserve-redeployment candidate.
 * Tests a conservative setup procedure, not Oberlabs executable parity.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../core/engine.js'),P=require('../core/native_preview_config.js'),S=require('../core/session.js');
const file=n=>JSON.parse(fs.readFileSync('games/battle-for-moscow/'+n+'.json','utf8'));
const source=Object.fromEntries(['game','map','units','deployments','rules','objectives'].map(k=>[k,file(k)]));
const g=E.build(P.project(source,file('native-preview/config'))),policy=g.deployments.openingRedeployment;
const create=(setup='auto-reference',on=true)=>S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:E.start(g,1941,setup,{openingRedeployment:on})});
const act=(session,action)=>{const out=S.execute(session,action);assert(out.ok,JSON.stringify({action,reason:out.reason}));return out.session;};
const denied=(session,action)=>{const before=JSON.stringify(session),out=S.execute(session,action);assert.equal(out.ok,false,`Action erroneously allowed: ${JSON.stringify(action)}`);assert.strictEqual(out.session,session);assert.equal(JSON.stringify(session),before);};
const label=u=>u.position?`${String(u.position.x+1).padStart(2,'0')}${String(u.position.y+1).padStart(2,'0')}`:'off-map';
let assertions=0,normalParity=0,saveUndo=0,manual=0;
function check(cond,msg){assert.ok(cond,msg);assertions++;}
check(source.game.engine==='generic-hex-v1');
assert.deepEqual(policy.unitIds,['s16','s30','s43']);
assert.deepEqual(policy.sourceHexes,['0503','0608','0803']);
assert.deepEqual(policy.registeredHexes,['0503','0609','0804']);
check(policy.certification==='candidate-unverified');
const start=E.start(g,1941,'auto-reference');
assert.deepEqual(E.start(g,1941,'auto-reference',{openingRedeployment:false}),start);
normalParity++;
check(E.currentPhase(g,start).kind==='combat');
for(const id of policy.unitIds){const unit=start.units.find(u=>u.id===id);check(!E.enemyZoc(g,start,unit.position.x,unit.position.y,'soviet'));}
assert.deepEqual(start.units.filter(u=>u.army==='soviet'&&u.position&&!E.enemyZoc(g,start,u.position.x,u.position.y,'soviet')).map(u=>u.id).sort(),[...policy.unitIds].sort());
let session=create(),s=session.state;
check(E.currentPhase(g,s).kind==='redeployment');
check(s.phaseIndex===2&&s.side==='german'&&s.turn===1);
check(S.legal(session,{type:'finish-redeployment'}).length===1);
check(S.legal(session,{type:'redeploy-reserve',unitId:'s3'}).length===0);
for(const id of policy.unitIds){
 const options=S.legal(session,{type:'redeploy-reserve',unitId:id}),origin=s.units.find(u=>u.id===id).position;
 check(options.some(p=>p.x===origin.x&&p.y===origin.y));
 check(options.some(p=>p.x>8));
 for(const p of options){
  const atStart=p.x===origin.x&&p.y===origin.y;
  check(g.playable(p.x,p.y));
  check(atStart||p.x>4);
  check(atStart||!E.enemyZoc(g,s,p.x,p.y,'soviet'));
  check(atStart||!E.unitsAt(s,p.x,p.y).length);
 }
}
const oldHash=S.serialize(session).sha256;
for(const action of [
 {type:'redeploy-reserve',unitId:'s3',x:6,y:3},
 {type:'redeploy-reserve',unitId:'s16',x:0,y:3},
 {type:'redeploy-reserve',unitId:'s16',x:2,y:2},
 {type:'redeploy-reserve',unitId:'s16',x:999,y:1},
 {type:'redeploy-reserve',unitId:'s16',x:1,y:1},
 {type:'move',unitId:'g24',x:5,y:3},
 {type:'finish-phase'},
 {type:'finish-setup'}
])denied(session,action);
// Clicking an occupied origin is a genuine no-op: no Undo entry or save mutation.
const origin=s.units.find(u=>u.id==='s16').position;
const noop=S.execute(session,{type:'redeploy-reserve',unitId:'s16',...origin});
check(noop.ok&&noop.session===session&&noop.result.unchanged===true);
assert.equal(S.serialize(noop.session).sha256,oldHash);
// Allow none of the three reserves to move, then start normal German combat.
let zero=act(session,{type:'finish-redeployment'});
check(E.currentPhase(g,zero.state).kind==='combat');
check(zero.state.openingRedeployment.completed===true);
assert.equal(zero.state.units.find(u=>u.id==='s16').position.x,4);
assert.deepEqual(zero.state.units,start.units,'Zero-move variant must preserve the exact baseline roster');
assert.deepEqual(zero.state.control,start.control,'Zero-move variant must preserve baseline city ownership');
assert.equal(zero.state.seed,start.seed,'Zero-move variant must not consume RNG');
let restored=S.restore(S.serialize(zero),{scenarioId:g.game.id,config:g,engine:'generic-hex-v1'});
assert.deepEqual(restored.state,zero.state);saveUndo++;
let undone=S.undo(restored);check(undone.ok);
assert.equal(S.serialize(undone.session).sha256,oldHash);saveUndo++;
// Relocate any subset in a legal order; destination cannot be stacked.
const opts=S.legal(undone.session,{type:'redeploy-reserve',unitId:'s16'});
const first=opts.find(p=>p.x===6&&p.y===2)||opts.find(p=>p.x===6);
check(Boolean(first));
let moved=act(undone.session,{type:'redeploy-reserve',unitId:'s16',...first});
check(moved.state.seed===s.seed);
check(moved.state.setupPositions.s16.x===first.x);
// A reserve may be returned to its original hex before confirmation.
check(S.legal(moved,{type:'redeploy-reserve',unitId:'s16'}).some(p=>p.x===origin.x&&p.y===origin.y));
const returned=act(moved,{type:'redeploy-reserve',unitId:'s16',...origin});
assert.deepEqual(returned.state.units.find(u=>u.id==='s16').position,origin);
const returnedUndo=S.undo(returned);check(returnedUndo.ok);
assert.deepEqual(returnedUndo.session.state,moved.state);
const afterFirst=S.serialize(moved);
assert.equal(S.legal(moved,{type:'redeploy-reserve',unitId:'s30'}).some(p=>p.x===first.x&&p.y===first.y),false);
denied(moved,{type:'redeploy-reserve',unitId:'s30',...first});
restored=S.restore(afterFirst,{scenarioId:g.game.id,config:g,engine:'generic-hex-v1'});saveUndo++;
assert.deepEqual(restored.state,moved.state);
const second=S.legal(moved,{type:'redeploy-reserve',unitId:'s30'}).find(p=>p.x===8&&p.y===6);
check(Boolean(second));moved=act(moved,{type:'redeploy-reserve',unitId:'s30',...second});
const third=S.legal(moved,{type:'redeploy-reserve',unitId:'s43'}).find(p=>p.x===9&&p.y===4);
check(Boolean(third));moved=act(moved,{type:'redeploy-reserve',unitId:'s43',...third});
assert.deepEqual(moved.state.units.filter(u=>policy.unitIds.includes(u.id)).map(u=>label(u)),[first,second,third].map(p=>`${String(p.x+1).padStart(2,'0')}${String(p.y+1).padStart(2,'0')}`));
check(moved.state.seed===s.seed);
check(moved.state.log.filter(e=>e.type==='opening-redeployment').length===3);
const final=act(moved,{type:'finish-redeployment'});
check(E.currentPhase(g,final.state).id==='combat');
denied(final,{type:'redeploy-reserve',unitId:'s16',...first});
denied(final,{type:'finish-redeployment'});
const oldFinish=S.serialize(final);restored=S.restore(oldFinish,{scenarioId:g.game.id,config:g,engine:'generic-hex-v1'});saveUndo++;
assert.deepEqual(restored.state,final.state);
undone=S.undo(restored);check(undone.ok&&E.currentPhase(g,undone.session.state).kind==='redeployment');
check(undone.session.state.log.filter(e=>e.type==='opening-redeployment').length===3);
undone=S.undo(undone.session);check(undone.ok);
assert.deepEqual(undone.session.state.units.find(u=>u.id==='s43').position,policy.initialPositions.s43.map(Number).reduce((a,n,i)=>(a[['x','y'][i]]=n,a),{}));saveUndo++;
// Explicit German manual setup must finish before any reserve relocation.
let hm=create('manual');check(E.currentPhase(g,hm.state).kind==='setup');
denied(hm,{type:'redeploy-reserve',unitId:'s16',...first});
const base=E.start(g,1941,'auto-reference');
for(const unit of base.units.filter(u=>u.army==='german')){hm=act(hm,{type:'setup-place',unitId:unit.id,...unit.position});manual++;}
hm=act(hm,{type:'finish-setup'});check(E.currentPhase(g,hm.state).kind==='redeployment');
hm=act(hm,{type:'finish-redeployment'});check(E.currentPhase(g,hm.state).kind==='combat');
check(S.undo(hm).session.state.openingRedeployment.completed===false);
assert.deepEqual(S.restore(S.serialize(hm),{scenarioId:g.game.id,config:g,engine:'generic-hex-v1'}).state,hm.state);saveUndo++;
// Deterministic native AI elects the permitted no-move response rather than
// inventing a redeployment strategy.
{const AI=require('../core/native_session_ai.js');const candidate=AI.decide(session);
 assert.deepEqual(candidate,{type:'finish-redeployment'});}
// Source mismatch and unsupported variants fail closed, including saves made
// under incompatible configs and forged illegal source geometry.
for(const mutate of [
 x=>x.deployments.openingRedeployment.unitIds[0]='s3',
 x=>x.deployments.openingRedeployment.registeredHexes[1]='0608',
 x=>x.deployments.openingRedeployment.eastPolicy='any-hex',
 x=>x.deployments.openingRedeployment.initialPositions.s30=[5,7],
 x=>x.deployments.openingRedeployment.sourceHexes=['0503','bogus','0803'],
 x=>x.deployments.openingRedeployment.requiresEmpty=false,
 x=>x.deployments.openingRedeployment.forbidEnemyZoc=false
]){const bad=structuredClone(P.project(source,file('native-preview/config')));mutate(bad);assert.throws(()=>E.validatePackage(bad));}
assert.throws(()=>E.start({...g,deployments:{...g.deployments,openingRedeployment:null}},1,'auto-reference',{openingRedeployment:true}));
const badSave=structuredClone(S.serialize(session));badSave.state.openingRedeployment.completed=true;
const crypto=require('node:crypto');const {sha256,...payload}=badSave;
badSave.sha256=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
assert.throws(()=>S.restore(badSave,{scenarioId:g.game.id,config:g,engine:'generic-hex-v1'}),/confirmation mismatch/);
console.log(JSON.stringify({status:'PASS',checkpoint:142,version:'v376',sourceMismatch:'0608/0803 vs 0609/0804',
 legalDestinations:opts.length,strictEastOfFrontline:true,allowedNoneSomeAll:true,manualSetupPlacements:manual,
 saveUndo,ordinaryOpeningUnchanged:normalParity,assertions,production:source.game.engine,mode:'candidate-only; tournament scoring disabled'}));
