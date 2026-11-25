'use strict';
/* Definitive Kiev source rail graph — this is registration, not permission to play. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const child=require('node:child_process');
const root=path.resolve(__dirname,'..'),m=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const T=require('../core/terrain_tiles'),Graph=require('../core/map_movement_graph');
const data=require('../rules/audit/kiev-rail-reconstruction-v427.json');
const pair=(a,b)=>[a,b].sort().join(':');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
assert.equal(sha(data.source.definitiveSvg),data.source.sha256);
assert.equal(sha(data.source.olderDraftSvg),data.source.olderDraftSha256);
assert.equal(ext.authoritativeCompositeSvg.sha256,data.source.sha256);
assert.equal(m.sourceRailRoutes.length,24);
assert.equal(m.cells.length,165);
const byId=new Map(m.cells.map(c=>[c.id,c]));
const keys=new Set();let sideMarks=0;
for(const c of m.cells)for(const [dir,arr] of Object.entries(c.tileEdges||{})){
 for(const f of arr)if(f.kind==='rail'){
  const target=T.neighbor(c,dir,m.geometry),partner=byId.get(target);
  assert(partner,'Offboard rail hexside '+c.id+dir);
  assert.equal(f.status,'definitive-svg-finite-hexside-v427');
  assert(partner.tileEdges?.[T.OPP[dir]]?.some(v=>v.kind==='rail'&&v.status===f.status));
  const key=pair(c.id,target);keys.add(key);sideMarks++;
 }
}
assert.equal(m.hexCenterRailConnections.length,93);
assert.equal(keys.size,93);
assert.equal(sideMarks,186);
for(const link of m.hexCenterRailConnections){
 const key=pair(link.from,link.to);assert(keys.has(key));
 assert(link.sourceSvgIds.length>0&&link.sourceSvgIds.every(id=>ext.authoritativeRailRoutes.some(r=>r.sourceSvgId===id)));
 assert.equal(link.status,'definitive-svg-finite-hexside-v427');
}
assert.deepEqual(data.registeredMissingFromDefinitive,["0101:0102","0101:0201","0306:0406","0711:0810","1501:1601"]);
assert.deepEqual(data.definitiveMissingFromRegistered,["0501:0502"]);
assert.equal(data.definitiveSourceLinks,93);
assert.equal(data.reciprocalRailSideRecords,186);
assert.equal(data.unresolvedGeometricCrossings,0);
assert.equal(T.validate(m,{requireReciprocal:true}).warnings.filter(w=>w.includes('rail')).length,0);
assert.equal(Graph.build(m).edges.length,442,'source-approved experimental movement graph');
const result=child.execFileSync('python',['tools/rebuild-kiev-rails-v427.py'],{cwd:root,encoding:'utf8',timeout:120000});
assert.equal(JSON.parse(result).definitiveSourceLinks,93);
const composed=require('../maps/composer').compose(m,ext);
assert.equal(composed.hexCenterRailConnections.length,0,'Composite source SVG routes are presentation only; cannot infer movement');
console.log('PASS v427: 93 definitive-source Kiev rails; 186 reciprocal sides; five retired links, one new; no gameplay authorization.');
