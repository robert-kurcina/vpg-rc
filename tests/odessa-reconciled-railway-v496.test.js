'use strict';
/* Read-only source-traced rail reconciliation. No executable composite promotion. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const Composer=require('../maps/composer'),T=require('../core/terrain_tiles');
const Trace=require('../core/composite_source_rail_audit');
const Rec=require('../core/composite_rail_reconciliation');
const Topology=require('../core/composite_graph_audit');
const P=require('../core/pathfinding'),M=require('../core/movement_rules');
const G=require('../core/map_movement_graph');
const base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const ledger=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const original=Composer.compose(base,ext),before=JSON.stringify(original);
const candidate=Rec.reconcile(original,ledger);const trace=Trace.trace(original);
const audit=Topology.movementCandidate(base,ext,original);
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++},ok=(v,msg)=>{assert.ok(v,msg);checks++};
const rejects=(f,pattern,msg)=>{assert.throws(f,pattern,msg);checks++};
const pair=(a,b)=>[a,b].sort().join(':');
const byId=new Map(candidate.cells.map(c=>[c.id,c]));
const railPairs=new Set(ledger.links.map(x=>pair(x.a,x.b)));
const oldPairs=new Set(trace.tracedLinks.filter(x=>x.annotated).map(x=>pair(x.a,x.b)));
const sourceLinks=trace.tracedLinks.map(x=>({a:x.a,b:x.b,sourceSvgIds:x.sourceSvgIds}));
eq(ledger.links,sourceLinks,'exact source traced route records');
eq(ledger.excludedAnnotations,['1106:1107','1106:1205'],'excluded shortcut annotations');
eq(candidate.railwayReconciliation,{status:'diagnostic-not-gameplay-authorized',sourceRailConnections:117,previousAnnotations:42,sourceOnlyConnections:77,excludedAnnotations:['1106:1107','1106:1205']},'reconciliation metadata');
eq(JSON.stringify(original),before,'source composite never mutated');
// The SVG and the rail geometry are unchanged; later map metadata updates
// changed the extension JSON bytes. Validate BOTH pinned revisions rather than
// comparing a historical v496 digest against the active v529 source.
const activeSource=require('../maps/movement-configs/odessa-inherited-edge-comparison-v529.json').sourceRevisionProvenance;
for(const [file,digest] of Object.entries(ledger.sourceHashes)){
 const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(file==='maps/odessa-extension.json'){
  eq(digest,activeSource.originalRailLedgerExtensionJsonSHA256,'v496 historical extension SHA retained');
  eq(actual,activeSource.currentExtensionJsonSHA256,'active extension revision pinned independently');
 }else eq(actual,digest,'source SHA '+file);
}
const shore=new Set(candidate.authoredShoreHexsides.map(h=>h.cellId+':'+h.dir));
const seen=new Set();let count=0,blocked=0,newlyAdded=0;
for(const c of candidate.cells){for(const dir of T.DIRS){
 const target=T.neighbor(c,dir,candidate.geometry),o=byId.get(target);if(!o)continue;
 const k=pair(c.id,o.id);if(seen.has(k))continue;seen.add(k);
 const reverse=T.OPP[dir],arrA=c.tileEdges?.[dir]||[],arrB=o.tileEdges?.[reverse]||[];
 const a=arrA.filter(x=>x.kind==='rail'),b=arrB.filter(x=>x.kind==='rail');
 eq(a,b,'reciprocal rail annotations '+k);
 eq(a.length,railPairs.has(k)?1:0,'exact railway trace '+k);
 if(a.length){
  count++;if(!oldPairs.has(k))newlyAdded++;
  ok(a[0].sourceSvgIds.length>0&&a[0].sourceSvgIds.every(p=>candidate.sourceRailRoutes.some(r=>r.sourceSvgId===p)),'SVG provenance '+k);
  ok(c.terrain!=='sea'&&o.terrain!=='sea'&&!shore.has(c.id+':'+dir)&&!shore.has(o.id+':'+reverse),'rail never crosses Sea/Coast '+k);
 }
 const oldC=original.cells.find(x=>x.id===c.id),oldO=original.cells.find(x=>x.id===o.id);
 eq(arrA.filter(f=>f.kind!=='rail'),(oldC.tileEdges?.[dir]||[]).filter(f=>f.kind!=='rail'),'preserve other features side A '+k);
 eq(arrB.filter(f=>f.kind!=='rail'),(oldO.tileEdges?.[reverse]||[]).filter(f=>f.kind!=='rail'),'preserve other features side B '+k);
 if(c.terrain==='sea'||o.terrain==='sea'||shore.has(c.id+':'+dir)||shore.has(o.id+':'+reverse))blocked++;
}}
eq(count,117,'117 exact rails');eq(newlyAdded,77,'77 sourced links added to diagnostic copy');
eq(blocked,100,'100 impassable Sea/Coast edges preserved');eq(seen.size,714,'714 physical edges retained');
// The approved renderer, source geometry, and existing composite production gate remain untouched.
rejects(()=>G.build(original),/source-geometry-not-gameplay-certified/,'original composite still unregistered for gameplay');
rejects(()=>G.build(candidate),/source-geometry-not-gameplay-certified/,'diagnostic copy cannot become playable');
for(const id of ledger.excludedAnnotations){ok(!railPairs.has(id),'excluded annotation never rail '+id);}
for(const id of ['1106:1206','1107:1206','1205:1206'])ok(railPairs.has(id),'drawn detour railway '+id);
// Test-only preview board: uses source physical edges + traced flags; NEVER authorizes gameplay.
const preview={cells:{},edges:audit.edges.map(e=>({a:e.a,b:e.b,verified:true,
 rail:railPairs.has(pair(e.a,e.b)),river:e.sourceKinds.includes('river'),
 majorRiver:e.sourceKinds.includes('majorRiver'),impassable:e.impassableForGround,
 allSea:e.seaAdjacent,lake:e.shoreAnnotated}))};
for(const c of candidate.cells){preview.cells[c.id]={terrain:c.terrain||'open',verified:c.terrain!=='sea'&&c.terrain!==null,rail:false};}
for(const e of preview.edges)if(e.rail){preview.cells[e.a].rail=true;preview.cells[e.b].rail=true;}
const profile=require('../maps/movement-configs/kiev.json');
const graph=P.compile(preview);
const cheapest=P.search(graph,{origin:'1106',edgeCost:x=>P.terrainCost(profile,x)});
eq(cheapest.costTo('1107'),1,'ordinary shortest route costs one point to 1107');
eq(cheapest.pathTo('1107'),['1106','1107'],'ordinary shortest route direct to 1107');
eq(cheapest.costTo('1205'),1,'ordinary shortest route costs one point to 1205');
eq(cheapest.pathTo('1205'),['1106','1205'],'ordinary shortest route direct to 1205');
const railOnly=P.search(graph,{origin:'1106',edgeCost:x=>x.edge.rail?P.terrainCost(profile,x):Infinity});
eq(railOnly.pathTo('1107'),['1106','1206','1107'],'railway-only detour to 1107');
eq(railOnly.pathTo('1205'),['1106','1206','1205'],'railway-only detour to 1205');
eq(railOnly.costTo('1107'),2,'rail-only route two MP to 1107');
eq(railOnly.costTo('1205'),2,'rail-only route two MP to 1205');
const unit={id:'review-soviet-infantry',hex:'1106',owner:'soviet',class:'infantry',mp:6,size:'corps'};
const ctx={board:preview,units:{[unit.id]:unit},profile,phase:{owner:'soviet',kind:'special-movement'},turn:2};
for(const target of ['1107','1205']){
 let direct=M.move(ctx,{unitId:unit.id,path:['1106',target]});
 ok(direct.ok,'direct ground move legal '+target);eq(direct.cost,1,'direct ground one MP '+target);
 eq(M.move(ctx,{unitId:unit.id,path:['1106',target],mode:'rail'}).reason,'rail-route-required','no false direct rail '+target);
 const railPath=['1106','1206',target],via=M.move(ctx,{unitId:unit.id,path:railPath,mode:'rail'});
 ok(via.ok,'source-rail movement legal via 1206 '+target);eq(via.cost,2,'two rail steps '+target);
}
for(const key of ledger.links){let a=byId.get(key.a),b=byId.get(key.b),dir=T.DIRS.find(d=>T.neighbor(a,d,candidate.geometry)===b.id);
 ok(dir&&!(shore.has(a.id+':'+dir)||shore.has(b.id+':'+T.OPP[dir])),'no blocked source rail link '+key.a+':'+key.b);
}
// Tamper rejection; expected exact source routes and exclusions, not guessed paths.
{const bad=JSON.parse(JSON.stringify(ledger));bad.links.pop();rejects(()=>Rec.reconcile(original,bad),/source-route-ledger-disagreement/,'missing source rail rejected');}
{const bad=JSON.parse(JSON.stringify(ledger));bad.links.push({a:'1106',b:'1107',sourceSvgIds:['path868']});rejects(()=>Rec.reconcile(original,bad),/source-route-ledger-disagreement/,'invented shortcut rail rejected');}
{const bad=JSON.parse(JSON.stringify(ledger));bad.excludedAnnotations=[];rejects(()=>Rec.reconcile(original,bad),/annotation-exclusion-disagreement/,'omitted exclusions rejected');}
{const bad=JSON.parse(JSON.stringify(original));const a=bad.cells.find(c=>c.id==='1106');a.tileEdges.S=[];rejects(()=>Rec.reconcile(bad,ledger),/nonreciprocal-rail-annotation/,'nonreciprocal original annotations rejected');}
const report={version:'v496',status:'diagnostic-not-gameplay-authorized',rails:117,added:77,removedAnnotations:2,physicalEdges:714,impassableSeaCoastEdges:100,
 shortcuts:{'1106:1107':{groundCost:1,railCost:2,railPath:['1106','1206','1107']},'1106:1205':{groundCost:1,railCost:2,railPath:['1106','1206','1205']}},checks};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync('rules/audit/odessa-rail-reconciliation-v496.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Odessa diagnostic rail reconciliation v496',checks,'assertions');
