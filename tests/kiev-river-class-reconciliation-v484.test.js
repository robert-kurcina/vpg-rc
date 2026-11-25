'use strict';
/* Checkpoint 250: correct five old visual Major River annotations to their
 * original source SVG river-minor classification. Does NOT promote Kiev play.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const T=require('../core/terrain_tiles');
const Reviewed=require('../core/source_reviewed_movement_graph');
const Bound=require('../core/map_movement_graph');
const board=require('../maps/kiev.json');
const cfg=require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const registry=require('../maps/movement-configs/graph-sources.json');
const ledger=require('../maps/movement-configs/source-reviewed-edge-ledgers.json').maps[board.id];
const v429=require('../rules/audit/kiev-definitive-city-river-v429.json');
const xmap=new Map(board.cells.map(c=>[c.id,c]));
const pairs=['1401:1502','1402:1502','1402:1503','1403:1503','1403:1504'];
const set={rail:new Set(ledger.railEdges),river:new Set(ledger.riverEdges),majorRiver:new Set(ledger.majorRiverEdges)};
const pair=(a,b)=>[a,b].sort().join(':');
let checks=0;function yes(x,m){assert.ok(x,m);checks++;}function eq(a,b,m){assert.deepStrictEqual(a,b,m);checks++;}function bad(fn,regex,m){assert.throws(fn,regex,m);checks++;}
eq(registry.maps[board.id].status,'verified','live Kiev remains gated');
bad(()=>Bound.build({...board,sourceImageSHA256:'untrusted-v485-test'}),/not-gameplay-certified/,'Kiev production graph is not promoted');
const reference=Reviewed.build(board,cfg);
eq(reference.edges.length,442,'candidate edge coverage unchanged');
for(const p of pairs){
 yes(set.river.has(p)&&!set.majorRiver.has(p),'candidate ledger classifies '+p+' as ordinary River');
 const entry=v429.riverHexsides.find(e=>e.hexPair===p);
 eq(entry?.kind,'river','original SVG trace says ordinary River '+p);
 yes(entry?.coverageFraction>=0.99,'finite side source coverage '+p);
 yes(['path615','path616'].includes(entry?.sourceSvgId),'source vector is named '+p);
 const [a,b]=p.split(':'),start=xmap.get(a),end=xmap.get(b);
 const direction=T.DIRS.find(d=>T.neighbor(start,d,board.geometry)===b);
 yes(Boolean(direction),'source hex neighbors '+p);
 for(const [id,face] of [[a,direction],[b,T.OPP[direction]]]){
  const features=xmap.get(id).tileEdges?.[face]||[];
  const water=features.filter(x=>['river','majorRiver'].includes(x.kind));
  eq(water,[{kind:'river',status:'source-svg-river-minor-v484'}],'corrected reciprocal visual class '+id+'/'+face);
 }
 const corrupted=structuredClone(board);const target=corrupted.cells.find(c=>c.id===a);
 target.tileEdges[direction][0].kind='majorRiver';
 bad(()=>Reviewed.build(corrupted,cfg),/source-visual-edge-disagrees-with-ledger/,'source adapter rejects visual Major River mismatch '+p);
}
const counts={rail:0,river:0,majorRiver:0,missingRiver:0,missingMajorRiver:0};
for(const c of board.cells)for(const dir of T.DIRS){
 const other=T.neighbor(c,dir,board.geometry);if(!xmap.has(other))continue;
 const p=pair(c.id,other),features=new Set((c.tileEdges?.[dir]||[]).map(f=>f.kind));
 for(const kind of ['rail','river','majorRiver']){
  if(features.has(kind)){yes(set[kind].has(p),'annotated '+kind+' agrees with source '+p);counts[kind]++;}
  else if(set[kind].has(p)&&kind!=='rail')counts[kind==='river'?'missingRiver':'missingMajorRiver']++;
 }
}
eq(counts.rail,186,'all 93 rail links have two matching annotations');
eq(counts.river,30,'15 ordinary River sides have paired annotations');
eq(counts.majorRiver,14,'7 Major River sides have paired annotations');
eq(counts.missingRiver,114,'57 ordinary source River sides represented by independent vector routes');
eq(counts.missingMajorRiver,6,'3 major source River sides represented by independent vector routes');
const sourceSVG=fs.readFileSync('maps/source/user-svg/kiev-odessa-main.svg');
yes(sourceSVG.length>10000,'original source available');
console.log('PASS Kiev v484 river-class reconciliation',checks,'checks; five pairs corrected, source candidate unchanged, live gate closed');
