/* Source-route reconciliation of incomplete composite rail annotations.
 * DIAGNOSTIC ONLY: returns a new review map, never changes a source map,
 * the shared renderer, production graph registration, or movement rules.
 */
'use strict';
const T=require('./terrain_tiles');
const Trace=require('./composite_source_rail_audit');
const pair=(a,b)=>[a,b].sort().join(':');
const fail=reason=>{throw Error('composite-rail-reconciliation: '+reason)};
const clone=value=>JSON.parse(JSON.stringify(value));

function reconcile(sourceMap,ledger){
 if(!sourceMap||!Array.isArray(sourceMap.cells)||!ledger||ledger.status!=='diagnostic-not-gameplay-authorized'
  ||!Array.isArray(ledger.links)||!Array.isArray(ledger.excludedAnnotations))fail('invalid-ledger');
 const traced=Trace.trace(sourceMap);
 const expected=traced.tracedLinks.map(x=>({a:x.a,b:x.b,sourceSvgIds:x.sourceSvgIds}));
 if(JSON.stringify(ledger.links)!==JSON.stringify(expected))fail('source-route-ledger-disagreement');
 const actualExclusions=traced.annotationsWithoutTrace.map(x=>x.a+':'+x.b);
 if(JSON.stringify(ledger.excludedAnnotations)!==JSON.stringify(actualExclusions))
  fail('annotation-exclusion-disagreement');
 if(ledger.mapId!==sourceMap.id||ledger.hexCount!==sourceMap.cells.length||ledger.railCount!==expected.length||
  !Number.isInteger(ledger.physicalEdgeCount)||ledger.physicalEdgeCount<1)
  fail('source-board-identity-mismatch');
 const out=clone(sourceMap),byId=new Map(out.cells.map(c=>[c.id,c]));
 const routeKeys=new Set(expected.map(e=>pair(e.a,e.b)));
 const seen=new Set();let cleared=0,inserted=0;
 for(const cell of out.cells){
  cell.tileEdges=cell.tileEdges||{};
  for(const dir of T.DIRS){
   const adjacent=T.neighbor(cell,dir,out.geometry),other=byId.get(adjacent);
   if(!other)continue;
   const k=pair(cell.id,other.id);if(seen.has(k))continue;seen.add(k);
   const opp=T.OPP[dir];
   const a=cell.tileEdges[dir]||[],b=other.tileEdges?.[opp]||[];
   if(a.filter(f=>f.kind==='rail').length>1||b.filter(f=>f.kind==='rail').length>1)
    fail('duplicate-source-rail-annotation:'+k);
   const ra=a.some(f=>f.kind==='rail'),rb=b.some(f=>f.kind==='rail');
   if(ra!==rb)fail('nonreciprocal-source-annotation:'+k);
   if(!ra&&!rb)continue;
   cleared+=1;
   cell.tileEdges[dir]=a.filter(f=>f.kind!=='rail');
   other.tileEdges[opp]=b.filter(f=>f.kind!=='rail');
  }
 }
 if(seen.size!==ledger.physicalEdgeCount)fail('unexpected-physical-topology');
 for(const entry of expected){
  const a=byId.get(entry.a),b=byId.get(entry.b);
  if(!a||!b||a.terrain==='sea'||b.terrain==='sea')fail('rail-through-sea');
  const dir=T.DIRS.find(d=>T.neighbor(a,d,out.geometry)===b.id);
  if(!dir)fail('nonadjacent-reconciled-link');
  const opp=T.OPP[dir];
  const sides=new Set((out.authoredShoreHexsides||[]).map(s=>s.cellId+':'+s.dir));
  if(sides.has(a.id+':'+dir)||sides.has(b.id+':'+opp))fail('rail-through-coast');
  const rail={kind:'rail',status:'source-svg-route-reconciled-diagnostic-v496',sourceSvgIds:[...entry.sourceSvgIds]};
  (a.tileEdges[dir]??=[]).push(clone(rail));
  (b.tileEdges[opp]??=[]).push(clone(rail));
  inserted++;
 }
 // Report only: this is a reconciled review copy. Executable movement policy
 // stays unregistered and cannot be promoted by calling this routine.
 out.railwayReconciliation={status:'diagnostic-not-gameplay-authorized',
  sourceRailConnections:inserted,previousAnnotations:cleared,
  sourceOnlyConnections:inserted-(cleared-ledger.excludedAnnotations.length),
  excludedAnnotations:[...ledger.excludedAnnotations]};
 return out;
}
module.exports=Object.freeze({reconcile});
