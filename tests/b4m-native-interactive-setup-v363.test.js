'use strict';
/* Checkpoint 129: manual German deployment and Turn-4 Shock choices.
 * Independent oracle: executable legacy/engine.js with supplied historical B4M package.
 * No browser production cutover; no synthetic mock rule evaluator.
 */
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const project=require('../core/native_preview_config.js'),E=require('../core/engine.js');
const legacy=require('../legacy/engine.js'),adapter=require('../core/adapter.js');
const S=require('../core/session.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const {original,config}=load();
const g=E.build(project.project(original,config));
const ref=legacy.buildScenario(adapter.legacyScenario(original),adapter.legacyProfile(original));
const snapshot=s=>Object.fromEntries(s.units.map(u=>[u.id,{position:u.position||null,strength:u.strength}]));
const eq=(a,b)=>assert.deepEqual(a,b);
const create=state=>S.create({scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g,state});
let assertions=0,places=0,swaps=0,rejections=0,shockCases=0,saveRestores=0;
const check=(cond,msg)=>{assert.ok(cond,msg);assertions++};
const act=(s,a)=>{const r=S.execute(s,a);check(r.ok,r.reason||JSON.stringify(a));return r.session};
const denied=(s,a)=>{const old=JSON.stringify(s),r=S.execute(s,a);check(!r.ok,'Expected action rejection '+JSON.stringify(a));eq(r.session,s);eq(JSON.stringify(s),old);rejections++};
const positions=(a,b)=>{eq(snapshot(a),snapshot(b));eq(a.control,b.control);assertions++};
check(original.game.engine==='generic-hex-v1');
// 14 Soviet counters fixed; all Germans unpositioned until the human chooses.
const refManual=legacy.makeState(ref,17,'manual');
let session=create(E.start(g,17,'manual'));
check(E.currentPhase(g,session.state).id==='setup');
positions(session.state,refManual);
check(session.state.units.filter(u=>u.position).length===14);
const german=legacy.makeState(ref,17).units.filter(u=>u.army==='german');
check(german.length===22);
const first=german[0];
check(S.legal(session,{type:'setup-place',unitId:first.id}).length===22);
check(S.legal(session,{type:'finish-phase'}).length===0);
check(S.legal(session,{type:'finish-setup'}).length===0);
denied(session,{type:'finish-phase'});
denied(session,{type:'finish-setup'});
denied(session,{type:'setup-place',unitId:'s3',x:first.position.x,y:first.position.y});
denied(session,{type:'setup-place',unitId:first.id,x:13,y:10});
for(const u of german){
 const cmd={type:'setup-place',unitId:u.id,x:u.position.x,y:u.position.y};
 check(legacy.setupPlace(ref,refManual,u.id,cmd.x,cmd.y));
 session=act(session,cmd);positions(session.state,refManual);places++;
}
// Legacy allows occupied-cross exchange without creating extra units.
const [a,b]=german;
check(legacy.setupPlace(ref,refManual,a.id,b.position.x,b.position.y));
session=act(session,{type:'setup-place',unitId:a.id,x:b.position.x,y:b.position.y});
positions(session.state,refManual);swaps++;
// Undo the swap and replay deterministically.
let undone=S.undo(session);check(undone.ok);
const replay=act(undone.session,{type:'setup-place',unitId:a.id,x:b.position.x,y:b.position.y});
eq(replay.state,session.state);session=replay;
const swapSave=S.serialize(session);session=S.restore(copy(swapSave),{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g});saveRestores++;
positions(session.state,refManual);
check(S.legal(session,{type:'finish-setup'}).length===1);
check(legacy.finishSetup(ref,refManual));
session=act(session,{type:'finish-setup'});
check(E.currentPhase(g,session.state).id==='combat');
positions(session.state,refManual);
denied(session,{type:'setup-place',unitId:a.id,x:a.position.x,y:a.position.y});
denied(session,{type:'finish-setup'});
// Undo confirm must reopen setup, including all already-placed counter choices.
undone=S.undo(session);check(undone.ok);check(E.currentPhase(g,undone.session.state).id==='setup');
check(act(undone.session,{type:'finish-setup'}).state.turn===1);
const manualSave=S.serialize(undone.session);eq(S.restore(copy(manualSave),{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g}).state,undone.session.state);saveRestores++;
// Later combat/movement must not be re-validated as though the counters still
// had to occupy all 22 opening crosses. Save a truly moved German counter.
{
 let later=act(session,{type:'finish-phase'});
 check(E.currentPhase(g,later.state).kind==='move');
 const candidate=later.state.units.filter(u=>u.army==='german').map(u=>({u,moves:E.legalMoves(g,later.state,u.id)})).find(v=>v.moves.length);
 check(candidate&&candidate.moves.length>0);
 const move=candidate.moves[0];
 later=act(later,{type:'move',unitId:candidate.u.id,x:move.x,y:move.y});
 eq(S.restore(copy(S.serialize(later)),{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g}).state,later.state);saveRestores++;
}

// Shock reinforcement is entered only at the Soviet Turn-4 boundary, after
// Germany's final movement phase. No source scheduler may place it automatically.
function shockStart(){
 const s=E.start(g,17,'auto-reference');s.turn=4;s.side='german';s.phaseIndex=E.phasesFor(g,'german').length-1;
 check(E.endPhase(g,s));check(E.currentPhase(g,s).kind==='reinforcement');
 const r=legacy.makeState(ref,17);r.turn=4;r.side='soviet';r.phase='reinforcement';
 return {s,r};
}
for(const index of [0,8,16]){
 const {s,r}=shockStart(),before=s.seed;
 check(s.units.find(u=>u.id==='s1sh').position==null);
 const legal=E.reinforcementOptions(g,s),legacyLegal=legacy.shockReinforcementOptions(ref,r);
 eq(legal,legacyLegal);check(legal.length===17);
 let ses=create(s),chosen=legal[index];
 check(S.legal(ses,{type:'finish-phase'}).length===0);
 denied(ses,{type:'finish-phase'});denied(ses,{type:'place-reinforcement',unitId:'g24',...chosen});
 denied(ses,{type:'replacement',choice:{type:'restore',id:'s3'}});
 check(legacy.performShockReinforcement(ref,r,chosen));
 ses=act(ses,{type:'place-reinforcement',unitId:'s1sh',...chosen});
 positions(ses.state,r);
 check(ses.state.seed===before);
 check(E.currentPhase(g,ses.state).kind==='reinforcement');
 check(S.legal(ses,{type:'finish-phase'}).length===1);
 denied(ses,{type:'place-reinforcement',unitId:'s1sh',...chosen});
 const saved=S.serialize(ses);
 let restored=S.restore(copy(saved),{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g});saveRestores++;
 positions(restored.state,r);
 restored=act(restored,{type:'finish-phase'});
 check(E.currentPhase(g,restored.state).id==='replacement');
 check(E.replacementBudget(g,restored.state)===4);
 check(restored.state.replacementUsed===0);
 const undo=S.undo(restored);check(undo.ok);check(E.currentPhase(g,undo.session.state).kind==='reinforcement');
 const undoPlacement=S.undo(undo.session);check(undoPlacement.ok);
 check(!undoPlacement.session.state.units.find(u=>u.id==='s1sh').position);
 eq(E.reinforcementOptions(g,undoPlacement.session.state),legal);
 // Saved before choice: restore, select alternate, resume.
 let fresh=S.restore(copy(S.serialize(undoPlacement.session)),{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g});saveRestores++;
 fresh=act(fresh,{type:'place-reinforcement',unitId:'s1sh',...chosen});
 fresh=act(fresh,{type:'finish-phase'});
 check(E.currentPhase(g,fresh.state).id==='replacement');
 shockCases++;
}
// Later-turn legality is dynamic: both engines remove occupied entry hexes
// and entries under German ZOC rather than simply exposing all source markers.
{
 const {s,r}=shockStart();
 const edge=E.reinforcementOptions(g,s).at(-1);
 const sovN=s.units.find(u=>u.army==='soviet'&&u.position);
 const oldSov=r.units.find(u=>u.id===sovN.id);
 sovN.position={...edge};oldSov.position={...edge};
 eq(E.reinforcementOptions(g,s),legacy.shockReinforcementOptions(ref,r));
 check(!E.reinforcementOptions(g,s).some(p=>p.x===edge.x&&p.y===edge.y));
 const gUnit=s.units.find(u=>u.army==='german'&&u.position);
 const oldGerman=r.units.find(u=>u.id===gUnit.id);
 const neighbor=E.neighbors(edge.x,edge.y).find(p=>g.playable(p.x,p.y)&&
  !s.units.some(u=>u.position?.x===p.x&&u.position?.y===p.y));
 check(neighbor);
 gUnit.position={x:neighbor.x,y:neighbor.y};oldGerman.position={x:neighbor.x,y:neighbor.y};
 eq(E.reinforcementOptions(g,s),legacy.shockReinforcementOptions(ref,r));
 check(E.enemyZoc(g,s,edge.x,edge.y,'soviet'));
}
// A recomputed unkeyed checksum must not allow a partially deployed German
// setup to masquerade as a completed manual state.
{
 const mid=create(E.start(g,17,'manual'));
 const saved=S.serialize(mid);saved.state.manualSetupActive=false;
 const crypto=require('node:crypto'),{sha256,...payload}=saved;
 saved.sha256=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 assert.throws(()=>S.restore(saved,{scenarioId:'battle-for-moscow',engine:'generic-hex-v1',config:g}),/committed confirmation/);
 rejections++;
}
// Policy configuration must fail closed under corrupted or silently altered choices.
for(const mutate of [
 x=>x.deployments.manualSetup.unitCount=23,
 x=>x.deployments.manualSetup.zoneTag='doesNotExist',
 x=>x.deployments.interactiveReinforcements[0].entryTag='doesNotExist',
 x=>x.deployments.interactiveReinforcements[0].unitId='g24',
 x=>x.deployments.interactiveReinforcements[0].unitId='s3',
 x=>x.deployments.interactiveReinforcements[0].strength='reduced'
]){
 const bad=copy(g);mutate(bad);assert.throws(()=>E.validatePackage(bad));rejections++;
}
// A standalone read-only source profile is not promoted to production.
check(original.game.engine==='generic-hex-v1');
console.log(JSON.stringify({status:'PASS',checkpoint:129,version:'v363',places,swaps,shockCases,saveRestores,rejections,assertions}));
