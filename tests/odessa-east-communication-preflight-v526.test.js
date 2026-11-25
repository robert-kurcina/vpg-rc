'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const Compose=require('../maps/composer');
const Land=require('../core/composite_land_movement_candidate');
const Comms=require('../core/composite_eastern_communication_preflight');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const rails=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const cities=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const map=Compose.compose(base,ext);
const {board}=Land.build(base,ext,map,rails,cities);
const c=Comms.create({map,board});
let n=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);n++;};
const ok=(x,label)=>{assert.ok(x,label);n++;};
const rejected=(fn,regex,label)=>{assert.throws(fn,regex,label);n++;};
const clone=x=>JSON.parse(JSON.stringify(x));
eq(c.metadata.status,'candidate-only-not-gameplay-authorized');
eq(c.metadata.markedSovietSides,26);
eq(c.metadata.internalMarkCount,2);
eq(c.metadata.internalMarkedSides,[{hex:'1810',side:'SE',adjacentHex:'1911'},{hex:'1810',side:'S',adjacentHex:'1811'}]);
eq(c.metadata.exteriorSideCount,24);
ok(c.metadata.exteriorCandidateHexes.every(x=>x!=='1811'&&x!=='1911'),'interior visual marks must not create exits');
const v=c.allCities();eq(Object.keys(v).length,20);
for(const [name,res] of Object.entries(v)){
 eq(res.status,'candidate-only-not-gameplay-authorized',name);
 eq(res.certifiedForVictory,false,name);
 if(res.reachable){
  eq(res.path[0],res.origin,name+' route starts at city');
  eq(res.path.at(-1),res.exitHex,name+' route ends at candidate external edge');
  ok(c.metadata.exteriorCandidateHexes.includes(res.exitHex),name+' exit belongs to exterior set');
  for(let i=1;i<res.path.length;i++){
   ok(board.edges.some(e=>!e.impassable&&[e.a,e.b].includes(res.path[i-1])&&[e.a,e.b].includes(res.path[i])),name+' route crosses traversable side');
  }
 }
}
const origin='1404';
// Non-ground support markers must never create an Enemy ZOC.
const supportMarker=c.trace(origin,{units:{air:{owner:'german',hex:'1410',marker:true,class:'air-support'}}});
eq(supportMarker.reachable,c.trace(origin).reachable,'air marker cannot blockade city communications');
const empty=c.trace(origin);
ok(empty.reachable,'empty diagnostic network can reach a provisional source edge');
const blockers=Object.fromEntries(c.metadata.exteriorCandidateHexes.map((hex,i)=>['g'+i,{owner:'german',hex}]));
const shut=c.trace(origin,{units:blockers});eq(shut.reachable,false,'occupy every candidate exit blocks communication');
eq(shut.exitHex,null);eq(shut.path,[]);
// Excluding origin from EZOC is expressly required by Kiev §12.
const boundary=c.metadata.exteriorCandidateHexes.find(id=>board.edges.some(e=>!e.impassable&&(e.a===id||e.b===id)));
const blockedNeighbor=board.edges.find(e=>!e.impassable&&(e.a===boundary||e.b===boundary));
const adversary=blockedNeighbor.a===boundary?blockedNeighbor.b:blockedNeighbor.a;
const same=c.trace(boundary,{units:{enemy:{owner:'german',hex:adversary}}});
eq(same.reachable,true,'origin at border remains connected even in EZOC');
eq(same.path,[boundary],'source rule exempts origin from EZOC');
// ZOC crosses a source-marked land-to-land Coast barrier even though
// communication movement cannot traverse that barrier.
const shore=board.edges.find(e=>e.lake&&!e.allSea);
ok(shore,'must have an authored land/land Coast barrier');
const shoreTrace=c.trace(origin,{units:{shoreEnemy:{owner:'german',hex:shore.a}}});
ok(shoreTrace.enemyZocHexes.includes(shore.b),'enemy ZOC includes hex beyond impassable Coast');
// Occupying the origin is invalid; a friendly unit does not negate enemy ZOC.
rejected(()=>c.trace(boundary,{units:{enemy:{owner:'german',hex:boundary}}}),/enemy-occupied-origin/);
rejected(()=>c.trace('1416'),/invalid-origin-hex/); // source sea
rejected(()=>c.trace('9999'),/invalid-origin-hex/);
rejected(()=>c.trace(origin,{units:{fake:{owner:'axis',hex:'1404'}}}),/unverified-unit-state/);
const malformed=clone(map);malformed.entryBoundarySelections.paths.find(p=>p.side==='soviet').edges[0].cellId='9999';
rejected(()=>Comms.create({map:malformed,board}),/invalid-soviet-border-side/);
const duplicate=clone(map);duplicate.entryBoundarySelections.paths.find(p=>p.side==='soviet').edges.push(duplicate.entryBoundarySelections.paths.find(p=>p.side==='soviet').edges[0]);
rejected(()=>Comms.create({map:duplicate,board}),/invalid-soviet-border-side/);
const altered=clone(board);altered.metadata.noRulesAuthorization=false;
rejected(()=>Comms.create({map,board:altered}),/composite-source-preflight-required/);
const report={checkpoint:292,version:'v526',status:'PASS-diagnostic-only',checks:n,
 sourceReference:'Kiev §12.2 communications and Odessa §5.0 isolation',
 sourceBorderAuthority:'SOURCE_GUIDED_VISUAL_GEOMETRY_NOT_RULE_CERTIFIED',
 metadata:c.metadata,initialCities: Object.fromEntries(Object.entries(v).map(([city,r])=>[city,{reachableCandidate:r.reachable,pathLength:r.path.length,exitHex:r.exitHex}])),
 blockedExitTest:{origin,reachable:shut.reachable,blockedCandidateExitCount:c.metadata.exteriorCandidateHexes.length},
 unresolved:['Border is visual source trace, not source-certified placement ledger','full land/shoreline graph is still diagnostic','star/rear marker discrepancies','Romanian political movement mask']};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync(path.join(root,'rules/audit/odessa-east-communication-preflight-v526.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS Odessa v526 eastern communication candidate',n,'assertions',JSON.stringify({exterior:c.metadata.exteriorSideCount,internal:c.metadata.internalMarkCount,cities:Object.keys(v).length}));
