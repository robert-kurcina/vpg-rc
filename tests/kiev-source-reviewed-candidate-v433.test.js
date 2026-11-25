'use strict';
/* Kiev candidate graph: independent source evidence + same shared movement rules.
 * Deliberately tests WITHOUT removing the live campaign activation gate.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const MapGraph=require('../core/map_movement_graph');
const Reviewed=require('../core/source_reviewed_movement_graph');
const Move=require('../core/movement_rules');
const T=require('../core/terrain_tiles');
const map=require('../maps/kiev.json');
const cfg=require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const profile=require('../maps/movement-configs/kiev.json');
const ledger=require('../maps/movement-configs/source-reviewed-edge-ledgers.json').maps[map.id];
const expected=require('../rules/audit/kiev-source-reviewed-candidate-v435.json');
const source=require('../rules/audit/kiev-definitive-city-river-v429.json');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const pair=e=>[e.a,e.b].sort().join(':');
let count=0;
const check=(x,msg)=>{assert(x,msg);count++};
const eq=(x,y,msg)=>{assert.deepEqual(x,y,msg);count++};
check(cfg.authorizationStatus==='diagnostic-only-not-gameplay','candidate must say diagnostic');
check(sha(fs.readFileSync(require('node:path').join(__dirname,'../maps/source/user-svg/kiev-odessa-main.svg')))===ledger.sourceSvgSha256,'source SVG has not changed');
check(sha(JSON.stringify(ledger))===cfg.edgeLedgerSHA256,'candidate ledger pinned');
eq(MapGraph.build(map).edges.length,442,'current explicit source policy authorizes experimental movement');
const board=Reviewed.build(map,cfg);
eq(Object.keys(board.cells).length,165,'all hexes');
eq(board.edges.length,442,'physical edges');
eq(board.metadata.boundarySides,undefined,'no false boundary metadata claim');
for(const [name,kind,size] of [['rail','rail',93],['river','river',72],['major-river','majorRiver',10]]){
 const keys=board.edges.filter(e=>e[kind]).map(pair).sort();
 eq(keys,ledger[name==='major-river'?'majorRiverEdges':name==='rail'?'railEdges':'riverEdges'],name+' source links');
 eq(keys.length,size,name+' count');
}
for(const [id,entry] of Object.entries(source.cityGameplayTerrain)){
 eq(board.cells[id].terrain,entry.type,'authoritative city gameplay terrain '+id);
 check(map.cells.find(c=>c.id===id).terrain==='open','approved visual underlay retained '+id);
}
const nonCities=map.cells.filter(c=>!source.cityGameplayTerrain[c.id]);
check(nonCities.every(c=>board.cells[c.id].terrain===c.terrain),'149 explicit terrain types retained');
check(board.edges.every(e=>e.verified&&!e.impassable&&!e.lake),'physical edges usable in candidate');
const boardEdges=new Map(board.edges.map(e=>[pair(e),e]));
for(const c of map.cells){
 for(const d of T.DIRS){const n=T.neighbor(c,d,map.geometry);
  if(!board.cells[n])continue;
  const key=[c.id,n].sort().join(':');check(boardEdges.has(key),'reciprocal adjacency '+key);
 }
}
const context=(from,to,mp=5)=>({profile,board,phase:{kind:'movement',owner:'german'},turn:2,
 units:{a:{id:'a',owner:'german',class:'infantry',size:'corps',mp,hex:from}}});
const edge=(predicate)=>board.edges.find(predicate);
const major=edge(e=>e.majorRiver&&!e.rail),river=edge(e=>e.river&&!e.majorRiver&&!e.rail),city=edge(e=>board.cells[e.b].terrain==='city'&&!e.majorRiver&&!e.rail);
check(major&&river&&city,'source candidate includes major/ordinary river and city crossings');
for(const [e,extra] of [[major,1],[river,0],[city,0]]){
 const result=Move.move(context(e.a,e.b),{unitId:'a',path:[e.a,e.b]});
 check(result.ok,'movement source-valid '+pair(e));
 eq(result.cost,profile.terrainCosts[board.cells[e.b].terrain]+extra,'source terrain and Major River entry cost');
}
// Exhaustive single-hex movement on both sides of every certified candidate edge.
// This tests the actual shared movement adjudicator, not a bespoke Kiev path cost.
for(const e of board.edges){
 for(const [from,to] of [[e.a,e.b],[e.b,e.a]]){
  const expectedCost=e.rail?profile.railCost:profile.terrainCosts[board.cells[to].terrain]+(e.majorRiver?profile.majorRiverExtraCost:0);
  const actual=Move.move(context(from,to,expectedCost),{unitId:'a',path:[from,to]});
  check(actual.ok,'legal direct candidate movement '+from+'-'+to);
  eq(actual.cost,expectedCost,'candidate entry movement cost '+from+'-'+to);
  if(expectedCost>1){
   const denied=Move.move(context(from,to,expectedCost-1),{unitId:'a',path:[from,to]});
   eq(denied.reason,'insufficient-movement-points','underbudget crossing rejected '+from+'-'+to);
  }
 }
}
const eMajorRail=edge(e=>e.majorRiver&&e.rail);
if(eMajorRail){const result=Move.move(context(eMajorRail.a,eMajorRail.b),{unitId:'a',path:[eMajorRail.a,eMajorRail.b]});
 check(result.ok,'rail/major river overlapping');eq(result.cost,1,'major river additional MP suppressed by rail');}
const changedMap=(mutator,reason)=>{const dirty=structuredClone(map);mutator(dirty);assert.throws(()=>Reviewed.build(dirty,cfg),reason);count++};
const changedPolicy=(mutator,reason)=>{const dirty=structuredClone(cfg);mutator(dirty);assert.throws(()=>Reviewed.build(map,dirty),reason);count++};
changedMap(m=>m.cells[0].terrain='swamp',/fingerprint-mismatch/);
changedMap(m=>m.geometry.columnParityDown='odd',/fingerprint-mismatch/);
changedMap(m=>m.hexCenterRailConnections.pop(),/fingerprint-mismatch/);
changedMap(m=>m.definitiveTerrainAudit.sourceSvgSha256='wrong',/fingerprint-mismatch/);
changedMap(m=>m.cells.find(c=>c.id==='1404').sourceTerrainEvidence.sourceSvgIds=['fabricated'],/fingerprint-mismatch/);
changedMap(m=>m.cells.find(c=>c.id==='1404').tileMarkers[0].kind='city',/fingerprint-mismatch/);
changedPolicy(p=>p.edgeLedgerSHA256='tampered',/hash-mismatch/);
changedPolicy(p=>p.sourceEvidenceMode='none',/fingerprint-mismatch/);
eq(expected.liveGameAuthorization,false,'candidate never means live campaign activation');
console.log('PASS source-pinned Kiev candidate:',count,'assertions, 165 hexes, 442 edges, 93 rails, 72 rivers, 10 major rivers; live gate intact');
