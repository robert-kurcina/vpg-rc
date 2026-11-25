'use strict';
/* Checkpoint 143: diagnostic/audit coverage only, not an upstream legality claim. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../core/engine.js');
const P=require('../core/native_preview_config.js');
const S=require('../core/session.js');
const load=k=>JSON.parse(fs.readFileSync(`games/battle-for-moscow/${k}.json`,'utf8'));
const source=Object.fromEntries(['game','map','units','deployments','rules','objectives'].map(k=>[k,load(k)]));
const g=E.build(P.project(source,load('native-preview/config')));
const deploy=()=>S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:E.start(g,1941,'auto-reference',{openingRedeployment:true})});
const legal=(s,id)=>S.legal(s,{type:'redeploy-reserve',unitId:id});
const audit=(s,id)=>E.openingRedeploymentAudit(g,s.state,id);
const key=h=>`${h.x},${h.y}`;
let checks=0,permutationCases=0,classified=0;
const yes=(v,msg)=>{assert.ok(v,msg);checks++};
const registered=g.deployments.openingRedeployment.registeredHexes;
const published=g.deployments.openingRedeployment.sourceHexes;
assert.deepEqual(published,['0503','0608','0803']);
assert.deepEqual(registered,['0503','0609','0804']);
yes(source.game.engine==='generic-hex-v1');
const baseline=deploy();
yes(E.openingRedeploymentAudit(g,E.start(g,1941,'auto-reference'),'s16')===null);
yes(E.openingRedeploymentAudit(g,baseline.state,'g24')===null);
const roster=baseline.state.units.filter(u=>u.army==='german'&&u.position);
const frontline=baseline.state.units.filter(u=>u.army==='soviet'&&u.position&&!g.deployments.openingRedeployment.unitIds.includes(u.id));
const threshold=Math.max(...frontline.map(u=>u.position.x));
for(const id of g.deployments.openingRedeployment.unitIds){
 const a=audit(baseline,id);
 yes(a&&a.certification==='candidate-unverified');
 yes(a.frontlineUnits===frontline.length&&a.frontlineMaxColumn===threshold+1);
 assert.deepEqual(a.publishedHexes,published);
 assert.deepEqual(a.registeredHexes,registered);
 const opts=legal(baseline,id),set=new Set(opts.map(key));
 yes(set.size===opts.length&&opts.length===a.legalDestinations);
 yes(a.counts.current+a.counts.original+a.counts.legal===opts.length);
 const total=Object.values(a.counts).reduce((x,y)=>x+y,0);
 yes(total===g.cells.size);
 classified+=total;
 for(const h of g.cells.values()){
  const k=key(h),atCurrent=h.x===a.current.x&&h.y===a.current.y;
  const atOrigin=h.x===a.origin.x&&h.y===a.origin.y;
  const valid=set.has(k);
  yes(valid===Boolean(atCurrent||(atOrigin||h.x>threshold)&&
   !E.unitsAt(baseline.state,h.x,h.y).some(u=>u.id!==id)&&
   (atCurrent||!E.enemyZoc(g,baseline.state,h.x,h.y,'soviet'))));
 }
 // Read-only: exercising the diagnostic does not alter a single game byte.
 const before=S.serialize(baseline).sha256;
 for(let i=0;i<10;i++)audit(baseline,id);
 yes(S.serialize(baseline).sha256===before);
}
// In B4M, every manual setup cross must be filled, regardless of WHICH
// German corps occupies each starting cross. The entire German ZOC/eligible
// reserve destination mask therefore must be invariant under all transpositions
// with a fixed pivot. This is a bounded mathematical property; it does not
// establish the upstream east-of-frontline rule.
const setup=()=>S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:E.start(g,1941,'manual',{openingRedeployment:true})});
const execute=(s,action)=>{const r=S.execute(s,action);assert.ok(r.ok,JSON.stringify({action,reason:r.reason}));return r.session;};
const originalSets=Object.fromEntries(g.deployments.openingRedeployment.unitIds.map(id=>[id,legal(baseline,id).map(key).sort()]));
for(let pivot=0;pivot<roster.length;pivot++){
 let s=setup();
 for(let i=0;i<roster.length;i++){
  const dest=roster[i===0?pivot:i===pivot?0:i].position;
  s=execute(s,{type:'setup-place',unitId:roster[i].id,...dest});
 }
 s=execute(s,{type:'finish-setup'});
 yes(E.currentPhase(g,s.state).kind==='redeployment');
 for(const id of g.deployments.openingRedeployment.unitIds){
  assert.deepEqual(legal(s,id).map(key).sort(),originalSets[id]);
  const a=audit(s,id);
  yes(a?.legalDestinations===originalSets[id].length);
 }
 permutationCases++;
}
// Changing an opening position must recalculate both the legal classification
// and the return-to-origin possibility. Undo/restore are exact state changes.
let moved=baseline;
const first=legal(moved,'s16').find(h=>h.x===6&&h.y===2);
yes(Boolean(first));
moved=execute(moved,{type:'redeploy-reserve',unitId:'s16',...first});
let a=audit(moved,'s16');
yes(a.current.x===6&&a.current.y===2);
yes(a.counts.original===1);
yes(a.legalDestinations===legal(moved,'s16').length);
const saved=S.serialize(moved);
const restored=S.restore(saved,{scenarioId:g.game.id,engine:'generic-hex-v1',config:g});
assert.deepEqual(audit(restored,'s16'),a);
const undone=S.undo(restored);
yes(undone.ok&&S.serialize(undone.session).sha256===S.serialize(baseline).sha256);
const finished=execute(moved,{type:'finish-redeployment'});
yes(E.openingRedeploymentAudit(g,finished.state,'s16')===null);
yes(S.serialize(finished).state.openingRedeployment.completed===true);
console.log(JSON.stringify({status:'PASS',version:'v377',checkpoint:143,checks,
 sourceCoordinates:published,registeredCoordinates:registered,
 classifiedCells:classified,manualGermanTranspositions:permutationCases,
 knownReferenceLegality:'UNVERIFIED',defaultProductionEngine:source.game.engine}));
