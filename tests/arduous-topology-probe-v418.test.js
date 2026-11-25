'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const Probe=require('../core/source_topology_probe');
const G=require('../core/map_movement_graph');
const Rules=require('../core/movement_rules');
const map=require('../maps/arduous.json'),r=require('../rules/audit/arduous-rail-reconciliation-v411.json'),v=require('../rules/audit/arduous-river-candidates-v418.json');
const report=require('../rules/audit/arduous-topology-v418.json');
let checks=0;const ok=(p,msg)=>{assert.ok(p,msg);checks++};
const fp=report.source.topologyFingerprint;
const build=(m=map,ra=r,rv=v)=>Probe.build({map:m,railAudit:ra,riverAudit:rv,sourceFingerprint:fp});
const data=build();
ok(Probe.fingerprint(map)===fp,'source-pinned canonical fingerprint');
ok(data.status==='source-diagnostic-only'&&!data.movementAuthorized&&!data.combatAuthorized,'never authorize a candidate');
ok(JSON.stringify(data.metadata)===JSON.stringify(report.geometry && Object.fromEntries(Object.keys(data.metadata).map(k=>[k,report.geometry[k]]))),'reproducible geometry report');
for(const [k,val] of Object.entries({hexCount:155,edgeCount:413,boundarySides:104,components:1,railCandidates:85,
 excludedRailCrossings:3,riverSideFollowCandidates:45,riverExteriorObservations:2,riverUnobservedEdges:368}))
 ok(data.metadata[k]===val,k+' count');
ok(data.edges.every(e=>e.verified===false),'no candidate marked verified');
ok(data.edges.filter(e=>e.railCandidate).length===85,'85 candidate rail edges');
ok(data.edges.filter(e=>e.riverEvidence==='side-follow-candidate').length===45,'45 side-follow candidates');
ok(data.edges.every(e=>['side-follow-candidate','not-observed'].includes(e.riverEvidence)),'only candidate or absent edges');
for(const k of r.excludedCrossings){const e=data.edges.find(x=>[x.a,x.b].join(':')===k);ok(!!e&&!e.railCandidate,'excluded visual-only rail '+k);}
ok(G.build(map).metadata.riverEdges===45,'separately source-certified gameplay graph has 45 river sides');
const bad=(mutation,why)=>{assert.throws(mutation,/source-topology-probe:/,why);checks++};
{const m=structuredClone(map);m.cells.find(c=>c.id==='0211').terrain='forest';bad(()=>build(m),'terrain alteration rejected');}
{const m=structuredClone(map);m.geometry.columnParityDown='even';bad(()=>build(m),'parity change rejected');}
{const m=structuredClone(map);m.hexCenterRailConnections.pop();bad(()=>build(m),'rail erasure rejected');}
{const m=structuredClone(map);m.cells[0].id='9999';bad(()=>build(m),'cell renumbering rejected');}
{const x=structuredClone(r);x.railLinks[0].key='invalid:edge';bad(()=>build(map,x),'false rail record rejected');}
{const x=structuredClone(r);x.excludedCrossings[0]=x.railLinks[0].key;bad(()=>build(map,x),'false rail exclusion rejected');}
{const x=structuredClone(v);x.sideObservations[0].members[0].dir='bad';bad(()=>build(map,r,x),'bad river side rejected');}
{const x=structuredClone(v);const target=x.sideObservations.find(e=>e.internalPair);target.members[1].dir='N';bad(()=>build(map,r,x),'nonreciprocal river members rejected');}
{const x=structuredClone(v);x.sourceSvgSha256='x';bad(()=>build(map,r,x),'false river source rejected');}
{const x=structuredClone(v);x.sideObservations[0].sources=['invented-path'];bad(()=>build(map,r,x),'unregistered river path rejected');}
// Independent existing movement adjudicator is exercised with an explicitly
// constructed *test-only* elevation. The actual candidate ledger is still denied.
const fixture={cells:Object.fromEntries(map.cells.map(c=>[c.id,{terrain:c.terrain,verified:true,rail:data.edges.some(e=>e.railCandidate&&(e.a===c.id||e.b===c.id))}])),
 edges:data.edges.map(e=>({a:e.a,b:e.b,rail:e.railCandidate,river:false,verified:true,impassable:false,allSea:false,lake:false}))};
const profile=require('../maps/movement-configs/arduous.json');
const make=(id,hex,owner='german')=>({id,hex,owner,class:'infantry',size:'corps',mp:5});
const ctx={profile,board:fixture,phase:{kind:'movement',owner:'german'},units:{test:make('test','0106')},turn:2};
const legal=Rules.move(ctx,{unitId:'test',path:['0106','0207']});
ok(legal.ok&&legal.cost===1,'source rail candidate obeys shared rail cost in test-only probe');
const disallowed=Rules.move(ctx,{unitId:'test',path:['0106','0305']});
ok(!disallowed.ok&&disallowed.reason==='unverified-connection','nonadjacent movement denied by shared rules');
const certifiedErr=Rules.move({...ctx,board:{...fixture,edges:data.edges}},{unitId:'test',path:['0106','0207']});
ok(!certifiedErr.ok&&certifiedErr.reason==='unverified-connection','raw candidate cannot move');
console.log('PASS Arduous source topology probe',checks,'checks; movement probe was TEST-ONLY');
