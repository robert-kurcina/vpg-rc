'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const Composer=require('../maps/composer'),Trace=require('../core/composite_source_rail_audit');
const G=require('../core/map_movement_graph'),T=require('../core/terrain_tiles');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const composite=Composer.compose(base,ext),now=Trace.trace(composite);
const audit=require('../rules/audit/odessa-source-railway-trace-v495.json');
let assertions=0;function eq(a,b,msg){assert.deepEqual(a,b,msg);assertions++}
function ok(x,msg){assert.ok(x,msg);assertions++}
function failure(f,pattern,msg){assert.throws(f,pattern,msg);assertions++}
function clone(x){return JSON.parse(JSON.stringify(x))}
for(const [key,value] of Object.entries({hexes:261,sourcePaths:24,routePoints:156,
 centerMatchedPoints:141,terminalStubs:15,tracedRailLinks:117,annotatedRailLinks:42,
 corroboratedRailLinks:40,tracedButNotAnnotated:77,annotatedWithoutTracedRoute:2,
 seaOrCoastRailLinks:0,gameplayCertified:false}))eq(now.metadata[key],value,key);
eq(now.metadata,audit.metadata,'recomputed railway metadata agrees');
eq(now.tracedLinks,audit.tracedLinks,'all 117 source-path railway links are reproduced');
eq(now.annotationsWithoutTrace,audit.annotationsWithoutTrace,'two unsupported annotations reproducible');
eq(audit.annotationsWithoutTrace.map(x=>x.a+':'+x.b),['1106:1107','1106:1205'],'two exact source mismatches');
const byId=new Map(composite.cells.map(c=>[c.id,c]));
const shore=new Set(composite.authoredShoreHexsides.map(h=>h.cellId+':'+h.dir));
const observedPaths=new Set(composite.sourceRailRoutes.map(r=>r.sourceSvgId));
const svg=fs.readFileSync('maps/source/user-svg/kiev-odessa-main.svg','utf8');
for(const p of observedPaths)ok(svg.includes('id="'+p+'"'),'original supplied SVG contains '+p);
for(const link of now.tracedLinks){
 const a=byId.get(link.a),b=byId.get(link.b);const dir=T.DIRS.find(d=>T.neighbor(a,d,composite.geometry)===b.id);
 ok(dir,'source-traced rail is actual adjacent side '+link.a+':'+link.b);
 ok(a.terrain!=='sea'&&b.terrain!=='sea','rail does not enter Sea '+link.a+':'+link.b);
 ok(!shore.has(a.id+':'+dir)&&!shore.has(b.id+':'+T.OPP[dir]),'rail does not cross Coast '+link.a+':'+link.b);
 ok(link.sourceSvgIds.length>=1&&link.sourceSvgIds.every(p=>observedPaths.has(p)),'source route provenance '+link.a+':'+link.b);
 ok(Number.isFinite(link.x)&&Number.isFinite(link.y),'source crossing center '+link.a+':'+link.b);
}
// Historical v495 source snapshot is immutable; checkpoint 263 corrects only
// the active Odessa City name. Require the exact new source fingerprint and
// the documented old baseline hash, rather than silently relaxing pinning.
const activeRailLedger=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
for(const [name,row] of Object.entries(audit.sources)){
 const b=fs.readFileSync(name),sum=crypto.createHash('sha256').update(b).digest('hex');
 if(name==='maps/odessa-extension.json'){
  eq(row.sha256,'8a5d027bb6e9b40e4495cf00c70f55a8f9b83bbda5c7e8a4bb7684a55462b3e6','v495 source fingerprint retained');
  eq(sum,activeRailLedger.sourceHashes[name],'re-pinned only to active source revision');
  eq(ext.v497PrintedCityNameCorrection.correctLabel,'Brăila','source revision scope is city name');
 }else {eq(b.length,row.bytes,'source length '+name);eq(sum,row.sha256,'source SHA '+name);}
}
failure(()=>G.build(composite),/source-geometry-not-gameplay-certified/,'composite executable movement remains blocked');
{
 const c=clone(composite);c.sourceRailRoutes[2].points[4][0]+=10;
 failure(()=>Trace.trace(c),/unclassified-off-center-point/,'source route interior drift rejected');
}
{
 const c=clone(composite);c.sourceRailRoutes[2].points[4]=[999999,999999];
 failure(()=>Trace.trace(c),/unclassified-off-center-point/,'off-board interior drift rejected');
}
{
 const c=clone(composite);c.sourceRailRoutes[2].sourceSvgId=c.sourceRailRoutes[1].sourceSvgId;
 failure(()=>Trace.trace(c),/invalid-or-duplicate-route/,'duplicate route ID rejected');
}
{
 const c=clone(composite);const first=now.tracedLinks[0],a=c.cells.find(x=>x.id===first.a),b=c.cells.find(x=>x.id===first.b),d=T.DIRS.find(x=>T.neighbor(a,x,c.geometry)===b.id);
 c.authoredShoreHexsides.push({cellId:first.a,dir:d,kind:'coast',sourceSvgId:'path-unregistered'});
 failure(()=>Trace.trace(c),/rail-crosses-sea-or-coast/,'rail cannot cross a newly authored Coast barrier');
}
{
 const c=clone(composite);const link=now.tracedLinks[0];c.cells.find(x=>x.id===link.a).terrain='sea';
 failure(()=>Trace.trace(c),/rail-crosses-sea-or-coast/,'rail cannot enter Sea');
}
{
 const c=clone(composite);const link=now.tracedLinks.find(x=>x.annotated),a=c.cells.find(x=>x.id===link.a),b=c.cells.find(x=>x.id===link.b),d=T.DIRS.find(x=>T.neighbor(a,x,c.geometry)===b.id);
 a.tileEdges[d]=(a.tileEdges[d]||[]).filter(f=>f.kind!=='rail');
 failure(()=>Trace.trace(c),/nonreciprocal-rail-annotation/,'nonreciprocal annotated rail rejected');
}
ok(fs.readFileSync('tools/odessa-movement-review/index.html','utf8').includes('rail-unmatched'),'browser shows mismatches');
ok(fs.readFileSync('tools/odessa-movement-review/index.html','utf8').includes('rail-source'),'browser shows traced railway links');
console.log('PASS Odessa source rail trace v495',assertions,'assertions');
