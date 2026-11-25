'use strict';
/* Explicit source-pinned experimental graph: shared gameplay rules, not a
 * new map renderer or a claim that Odessa's extensions are historically final. */
const assert=require('node:assert/strict'),Compose=require('../maps/composer');
const G=require('../core/map_movement_graph'),Binding=require('../core/movement_binding');
const M=require('../core/movement_rules'),Candidate=require('../core/composite_graph_audit');
const base=require('../maps/kiev.json'),extension=require('../maps/odessa-extension.json');
const profile=require('../maps/movement-configs/kiev-odessa-experimental-v531.json');
const cfg=require('../maps/movement-configs/graph-sources.json').maps;
const map=Compose.compose(base,extension),scope=profile.experimentalGraphScope;
let checks=0;
function yes(x,msg){assert.ok(x,msg);checks++}function eq(a,b,msg){assert.deepStrictEqual(a,b,msg);checks++}
function bad(fn,re,msg){assert.throws(fn,re,msg);checks++}
bad(()=>G.build(map),/source-geometry-not-gameplay-certified/,'No implicit approval from composed SVG');
bad(()=>G.build(map,{experimentalScope:'historically-certified'}),/source-geometry-not-gameplay-certified/,'Cannot escalate scope');
const board=G.build(map,{experimentalScope:scope}),binding=Binding.build(map,profile);
eq(board.metadata.scope,'experimental','Board explicitly labelled experimental');eq(board.metadata.historicalCertified,false,'No historical certification');
eq(board.metadata.edgeCount,714,'All composite adjacency');eq(board.edges.filter(e=>!e.impassable).length,614,'Candidate traversable links');
eq(board.edges.filter(e=>e.rail).length,117,'Source route rails');eq(board.edges.filter(e=>e.river).length,105,'Source ordinary rivers');
eq(board.edges.filter(e=>e.majorRiver).length,22,'Source Major Rivers');eq(Object.keys(board.cells).length,261,'All composite cells');
eq(binding.board.edges.length,714,'Shared binding uses experimental map');eq(binding.metadata.scope,'experimental','Binding never claims historical scope');
const audit=Candidate.movementCandidate(base,extension,map),seams=audit.edges.filter(e=>e.compositeSeam&&!e.impassableForGround);
eq(seams.length,24,'24 seam edges permit source-candidate movement');
for(const e of seams){
 const u={id:'u',hex:e.a,owner:'german',nationality:'german',class:'infantry',size:'corps',mp:4};
 const r=M.move({board:binding.board,profile,units:{u},phase:{kind:'movement',owner:'german'},turn:2},{unitId:'u',path:[e.a,e.b]});
 yes(r.ok,'Shared movement can cross experimental composite seam '+e.a+':'+e.b);
}
const water=audit.edges.filter(e=>e.landLandShoreAnnotation);
eq(water.length,7,'seven land-to-land Coast barriers');
for(const e of water){
 const u={id:'u',hex:e.a,owner:'german',nationality:'german',class:'infantry',size:'corps',mp:4};
 const r=M.move({board:binding.board,profile,units:{u},phase:{kind:'movement',owner:'german'},turn:2},{unitId:'u',path:[e.a,e.b]});
 eq(r.reason,'impassable-hexside','Coast still blocks experimental movement '+e.a+':'+e.b);
}
for(const action of [
 m=>m.cells.find(c=>c.id==='1513').terrain='sea',
 m=>m.cells.find(c=>c.id==='1201').terrain='forest',
 m=>m.cells[0].tileEdges.NE=[],
 m=>m.geometry.calibration.pitchX+=0.5,
 m=>m.authoredShoreHexsides.pop(),
 m=>m.authoritativeSourceGeometry.sha256='0'.repeat(64)
]){const altered=structuredClone(map);action(altered);bad(()=>G.build(altered,{experimentalScope:scope}),/fingerprint-mismatch/,'Mutated map refuses experimental runtime');}
const pBad=structuredClone(profile);pBad.experimentalGraphScope='unreviewed';bad(()=>Binding.build(map,pBad),/source-geometry-not-gameplay-certified/,'Scope change rejected in shared binding');
eq(cfg[base.id].status,'verified','Original Kiev authorization unchanged');
yes(G.build(base).edges.length===442,'Original Kiev remains playable with existing graph');
for(const other of ['arduous','leningrad'])yes(G.build(require('../maps/'+other+'.json')).edges.length>0,other+' graph unaffected');
console.log('PASS v531 Odessa source-pinned experimental shared movement',checks,'assertions');
