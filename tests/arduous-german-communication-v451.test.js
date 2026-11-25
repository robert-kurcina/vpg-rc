'use strict';
/* Arduous §§12.0–12.4 German west-edge replacement and city communication.
 * Source-valid setup and photographed counter identity; eliminated states,
 * city takeovers and enemy blockers in this file are explicit test-only
 * counterfactuals, not assertions of source-historical combat outcomes.
 */
const A=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const B=require('../core/historical_buildup_phase');
const Binding=require('../core/movement_binding');
const Setup=require('../core/scenario_starting_setup');
const Inventory=require('../core/historical_source_face_inventory');
const fixture=require('./fixtures/arduous-source-setup-v419');
const map=require('../maps/arduous.json');
const spec=require('../maps/setup/arduous.json');
const inv=require('../maps/setup/arduous-inventory.json');
const cfg=require('../maps/phase-configs/arduous.json');
const profile=require('../maps/movement-configs/arduous.json');
const faces=require('../maps/counter-configs/arduous.json');
const policy=require('../maps/buildup-configs/arduous.json');
const fixed=require('../maps/setup/arduous-fixed-pieces.json');
const clone=x=>JSON.parse(JSON.stringify(x));
let checks=0;
const ok=(x,msg)=>{A.ok(x,msg);checks++};
const eq=(x,y,msg)=>{A.deepEqual(x,y,msg);checks++};
const fail=(f,re,msg)=>{A.throws(f,re,msg);checks++};
const v=Setup.validate({map,spec,counterConfig:faces,inventory:Inventory.create(inv),allocation:fixture.allocation,placements:fixture.placements});
ok(v.valid,'Candidate Arduous opening passes full source setup validation');
const b=B.create({map,profile,config:cfg,counterConfig:faces,policy,allocation:fixture.allocation,fixedPolicy:fixed});
const initial=b.initialize(v.state),face=fixture.allocation.germanInitialInfantry[0],west=policy.entryEdge.german;
ok(west.length===6,'All six source-declared western entry hexes retained');
const source=faces.faces.front.find(f=>f.faceId===face);
const reverse=faces.faces.back.find(f=>f.faceId===source.pairedFaceId);
ok(source.visualTranscription.printedAffiliation==='axis'&&reverse.pairedFaceId===face,'Actual German counter face pairing');
const removed=clone(initial);delete removed.units[face];
const phase=b.openingPhase();
const replace=(state,hex,turn=4,p=phase,unitId=face,actor='german')=>b.replace({state,cursor:{turn},actor,phase:p,unitId,hex});
fail(()=>replace(removed,west[0],3),/No replacement steps remain/,'German cannot rebuild before Turn 4');
let successfulEdges=[];
for(const hex of west){
 const ss=clone(removed);
 try{
  const r=replace(ss,hex);
  successfulEdges.push(hex);
  eq(r.event,{kind:'replacement-rebuilt',unitId:face,hex,stepsSpent:1},'Exact off-map rebuild event at '+hex);
  const u=r.state.units[face];
  eq([u.sourceFaceId,u.reverseFaceId,u.owner,u.hex,u.strengthStatus,u.activeFaceId],
     [face,source.pairedFaceId,'german',hex,'printed-reduced',reverse.faceId], 'Correct German reduced face at '+hex);
  ok(u.printedCombatStrength===Number(reverse.visualTranscription.printedValues.split('-')[0]),'Source strength at '+hex);
  eq([r.phase.spent,r.phase.rebuiltUnitIds],[1,[face]],'One German replacement step used at '+hex);
  fail(()=>replace(r.state,hex,4,r.phase),/No replacement steps remain/,'Cannot spend second German step Turn 4');
 }catch(e){
  if(!/Replacement placement needs safe friendly edge or communicating controlled city|Replacement placement would overstack/.test(e.message))throw e;
  checks++; // Expected rejection for blocked edge in candidate opening
 }
 eq(ss,removed,'No mutation of source state from candidate edge attempt '+hex);
}
ok(successfulEdges.length>=1&&successfulEdges.length<west.length,'Candidate setup has both legal and blocked German edge entries');
const wrongEdge=policy.entryEdge.soviet.find(h=>!west.includes(h)&&!map.cells.find(c=>c.id===h).city);
ok(wrongEdge,'Found a verified Soviet-only non-city edge hex');
fail(()=>replace(removed,wrongEdge),/Replacement placement needs safe friendly edge or communicating controlled city/,'Soviet-side border not German replacement destination');
const westClear=west[0];
const empty={...clone(initial),units:{}}; // Counterfactual eliminated-board connectivity test only.
const allCities=map.cells.filter(c=>c.city).map(c=>({hex:c.id,name:c.city.name}));
eq(allCities.length,12,'Twelve source-mapped city markers');
for(const {hex,name} of allCities){
 ok(b.communicated(hex,'german',empty.units),'Unopposed route reaches west from '+name);
 const uncaptured=clone(empty);
 fail(()=>replace(uncaptured,hex),/Replacement placement needs safe friendly edge or communicating controlled city/,
   'Uncaptured Soviet city cannot admit German counter '+name);
 uncaptured.cityControl[name]='german';
 const admitted=replace(uncaptured,hex);
 eq(admitted.event.kind,'replacement-rebuilt','Captured communicating German city admits eliminated unit '+name);
 eq(admitted.state.units[face].hex,hex,'German counter enters city '+name);
}
// Independent, source-geometry-restricted, forward BFS oracle. It does not
// reuse the buildup engine's communication function or its neighbor index.
const graph=Binding.build(map,profile).board;
const edges=graph.edges.filter(e=>e.verified&&!e.impassable&&!e.allSea&&!e.lake);
const links=new Map();
for(const e of edges){for(const [a,c] of [[e.a,e.b],[e.b,e.a]]){
 if(!links.has(a))links.set(a,[]);
 links.get(a).push(c);
}}
const boundaries={german:new Set(policy.entryEdge.german),soviet:new Set(policy.entryEdge.soviet)};
function oracle(origin,actor,units){
 const other=Object.values(units).filter(x=>x.owner!==actor),blocked=new Set(other.map(x=>x.hex));
 for(const u of other)for(const to of links.get(u.hex)||[])blocked.add(to);
 const visited=new Set([origin]),queue=[origin];
 for(let i=0;i<queue.length;i++){
  const x=queue[i];if(boundaries[actor].has(x))return true;
  for(const to of links.get(x)||[]){if(visited.has(to)||blocked.has(to))continue;
   visited.add(to);queue.push(to);
  }
 }
 return false;
}
// Deterministic 1440+ cases with enemy occupancy and EZOC, including defended
// friendly passage: independently compare oracle vs source-bound controller.
let seed=0x541c6;
const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const hexes=map.cells.filter(c=>c.terrain!=='sea').map(c=>c.id);
for(let trial=0;trial<130;trial++){
 const units={};const picked=new Set();
 for(let j=0,n=1+Math.floor(rand()*8);j<n;j++){
  let h;do{h=hexes[Math.floor(rand()*hexes.length)]}while(picked.has(h));picked.add(h);
  units['s'+j]={owner:'soviet',hex:h};
 }
 // A friendly unit in an enemy ZOC must not annul that ZOC.
 for(let j=0;j<3;j++){
  let h;do{h=hexes[Math.floor(rand()*hexes.length)]}while(picked.has(h));picked.add(h);
  units['g'+j]={owner:'german',hex:h};
 }
 const batch=b.communicationIndex('german',units);
 for(const {hex,name} of allCities){
  eq(batch(hex),oracle(hex,'german',units),`Batch oracle agreement ${name}, case ${trial}`);
  eq(b.communicated(hex,'german',units),oracle(hex,'german',units),
   `Oracle west communication agreement ${name}, case ${trial}`);
 }
}
const vilnius=allCities.find(c=>c.name==='Vilnius');ok(vilnius,'Source-mapped Vilnius exists');
const blockers=clone(empty);blockers.cityControl.Vilnius='german';
for(const [i,to] of (links.get(vilnius.hex)||[]).entries())blockers.units['s'+i]={hex:to,owner:'soviet'};
eq(b.communicated(vilnius.hex,'german',blockers.units),false,'Neighbor enemy occupation isolates Vilnius despite captured status');
fail(()=>replace(blockers,vilnius.hex),/Replacement placement needs safe friendly edge or communicating controlled city/,'Isolated captured city cannot admit German replacement');
// A friendly corps occupying a communicating route in EZOC is not a shield.
const contested=clone(blockers),neighbor=links.get(vilnius.hex)[0];
contested.units['g0']={hex:neighbor,owner:'german'};
eq(b.communicated(vilnius.hex,'german',contested.units),false,'Friendly unit cannot reopen enemy-occupied or enemy-ZOC corridor');
// A friendly west-edge origin is exempt from ZOC *communication* checking;
// placement is independently prohibited there while threatened.
const threatened=clone(empty),edge=westClear;
const adjacent=links.get(edge).find(h=>!west.includes(h));ok(adjacent,'West border has a land neighbor');
const sov=Object.values(initial.units).find(u=>u.owner==='soviet');
threatened.units[sov.id]={...clone(sov),hex:adjacent};
eq(b.communicated(edge,'german',threatened.units),true,'Origin exempt from ZOC for communication');
fail(()=>replace(threatened,edge),/Replacement placement needs safe friendly edge or communicating controlled city/,
  'Enemy-ZOC border hex cannot admit off-map replacement even though origin exempts communication');
// Transactions are immutable, including rejected conditions.
eq(removed.units[face],undefined,'Eliminated face remains absent from prior state');
const sha=crypto.createHash('sha256').update(fs.readFileSync('references/rules/arduous-rules.pdf')).digest('hex');
if(process.argv.includes('--write-audit')){
 const out={checkpoint:217,version:'v451',source:'references/rules/arduous-rules.pdf printed p.6 §§12.0–12.4',rulePdfSha256:sha,
 sourceGermanCounter:face,printedFace:source.visualTranscription.printedValues,
 legalWestEdgeHexesInCandidateOpening:successfulEdges,westEdgeHexes:west,citiesChecked:allCities.length,
 independentOracleCases:130*allCities.length,assertions:checks,
 proofScope:'source-grounded shared engine with test-only synthetic eliminations, captured-city control and blocking units; no real German battle casualties claimed',
 deferred:['German player-facing combat elimination and off-map rebuild in same Chromium action journal','Complete seven-turn contested campaign acceptance']};
 fs.writeFileSync('rules/audit/arduous-german-communication-v451.json',JSON.stringify(out,null,2)+'\n');
}
console.log(`PASS v451 Arduous German west-edge replacement and city communication: ${checks} assertions, ${successfulEdges.length} candidate legal western entrances`);
