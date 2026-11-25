const assert=require('assert');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const Audit=require('../core/source_edge_evidence');
const expected=require('../rules/audit/arduous-kiev-svg-edge-trace-v427.json');
let checks=0;
for(const name of ['arduous','kiev']){
 const m=JSON.parse(fs.readFileSync(path.join(__dirname,'../maps',name+'.json'),'utf8'));
 const baseline=expected.maps[name];
 const svg=fs.readFileSync(path.join(__dirname,'..',baseline.sourceSvg),'utf8');
 assert.strictEqual(crypto.createHash('sha256').update(svg).digest('hex'),baseline.sourceSvgSHA256);checks++;
 const ids=new Set([...svg.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]));
 const a=Audit.inspect(m,ids);
 const pinned=Object.fromEntries(Object.entries(baseline).filter(([k])=>!['sourceSvg','sourceSvgSHA256'].includes(k)));
 if(name==='kiev'){
  // v484 reconciled five doubly encoded Major River sides (10 directed
  // visual marks) to ordinary Rivers in the original SVG river-minor layer.
  // Preserve the historical v427 snapshot as provenance; adapt ONLY these
  // precisely adjudicated fields in the current-map test expectation.
  pinned.hexsideKinds={...pinned.hexsideKinds,river:pinned.hexsideKinds.river+10,majorRiver:pinned.hexsideKinds.majorRiver-10};
  pinned.hexsideStatuses={...pinned.hexsideStatuses,
   'source-visual-candidate-v234-not-playable':pinned.hexsideStatuses['source-visual-candidate-v234-not-playable']-10,
   'source-svg-river-minor-v484':10};
 }
 assert.deepStrictEqual(a,pinned);checks++;
 assert.equal(a.authorizedForMovement,false);checks++;
 assert.equal(a.counts.railCandidates,a.counts.railTracedToExistingSvgIds);checks++;
 assert.equal(a.counts.hexsideIssues,0);checks++;
 const missingIds=new Set(ids);missingIds.delete(m.hexCenterRailConnections[0].sourceSvgIds[0]);
 assert(Audit.inspect(m,missingIds).missingSvgIds.length>0);checks++;
 const badRail=structuredClone(m);badRail.hexCenterRailConnections[0].to='9999';
 assert.throws(()=>Audit.inspect(badRail,ids),/rail-references-missing-hex/);checks++;
 const duplicate=structuredClone(m);duplicate.hexCenterRailConnections.push({...duplicate.hexCenterRailConnections[0]});
 assert.throws(()=>Audit.inspect(duplicate,ids),/duplicate-rail-pair/);checks++;
 const nonadj=structuredClone(m);const aCell=nonadj.cells.find(c=>c.id===nonadj.hexCenterRailConnections[0].from);
 const far=nonadj.cells.find(c=>Math.abs(c.column-aCell.column)>4);
 nonadj.hexCenterRailConnections[0].to=far.id;
 assert.throws(()=>Audit.inspect(nonadj,ids),/nonadjacent-rail-candidate/);checks++;
 if(name==='kiev'){
  const broken=structuredClone(m);
  const c=broken.cells.find(c=>Object.keys(c.tileEdges||{}).length);
  const dir=Object.keys(c.tileEdges)[0];
  const T=require('../core/terrain_tiles');const other=broken.cells.find(x=>x.id===T.neighbor(c,dir,broken.geometry));
  if(other){delete other.tileEdges[T.OPP[dir]];assert(Audit.inspect(broken,ids).counts.hexsideIssues>0);checks++;}
 }
 const G=require('../core/map_movement_graph');
 if(name==='arduous')assert.equal(G.build(m).metadata.riverEdges,45);
 else {assert.equal(G.build(m).edges.length,442,'source-reviewed Kiev graph is executable in experiment');checks++;assert.throws(()=>G.build({...m,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/);checks++;}
 console.log(name+' SVG trace verified; rail candidates '+a.counts.railCandidates+'; hexside issues '+a.counts.hexsideIssues);
}
assert.strictEqual(expected.maps.arduous.counts.railCandidates,85);
assert.strictEqual(expected.maps.kiev.counts.railCandidates,93);
assert.strictEqual(expected.maps.kiev.counts.authoredHexsideFeatureMarks,230);
console.log('source-edge trace PASS ('+checks+' assertions plus count checks)');
