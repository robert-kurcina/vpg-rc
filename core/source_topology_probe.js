/* Generic source-geometry diagnostic for maps not yet movement-certified.
 * No edge returned by this module is authorized for gameplay. It uses the
 * existing terrain_tiles.neighbor routine, never a second hex-grid engine.
 */
'use strict';
const T=require('./terrain_tiles');
const crypto=require('node:crypto');
const fail=(s)=>{throw Error('source-topology-probe: '+s);};
const pair=(a,b)=>[a,b].sort().join(':');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fingerprint(map){
 return hash({id:map.id,sourceGame:map.sourceGame,sourceImageSHA256:map.sourceImageSHA256,
  geometry:map.geometry,
  cells:map.cells.map(c=>({id:c.id,column:c.column,row:c.row,pixelCenter:c.pixelCenter,terrain:c.terrain,terrainStatus:c.terrainStatus})),
  railLinks:map.hexCenterRailConnections});
}
function build({map,railAudit,riverAudit,sourceFingerprint}={}){
 if(!map||!Array.isArray(map.cells)||!map.geometry||!railAudit||!riverAudit||typeof sourceFingerprint!=='string')fail('missing-input');
 if(fingerprint(map)!==sourceFingerprint)fail('board-fingerprint-mismatch');
 const mapId=map.id,sourceSVG=map.authoredSourceVectors?.sourceSvgSha256;
 for(const evidence of [railAudit,riverAudit]){
  if(evidence.sourceSvgSha256!==sourceSVG||evidence.sourceMapSha256!==riverAudit.sourceMapSha256)fail('source-identifier-mismatch');
 }
 if(railAudit.mapId!==mapId||railAudit.counts?.registeredRailLinks!==railAudit.railLinks?.length||
    railAudit.counts?.measuredSvgCrossings!==railAudit.railLinks.length+railAudit.excludedCrossings.length)
  fail('invalid-rail-evidence');
 if(railAudit.authorizedForMovement!==false||riverAudit.authorizedForMovement!==false)fail('audits-must-not-claim-gameplay-authority');
 const byId=new Map();
 for(const cell of map.cells){
  if(!cell||!cell.id||byId.has(cell.id)||!Number.isInteger(cell.column)||!Number.isInteger(cell.row)||
     cell.id!==T.cellId(cell.column,cell.row)||!['open','forest','swamp'].includes(cell.terrain)||!cell.terrainStatus)
   fail('invalid-cell');
  byId.set(cell.id,cell);
 }
 const edgeMap=new Map(),bySide=new Map();let bounds=0;
 for(const cell of map.cells)for(const dir of T.DIRS){
  const dest=T.neighbor(cell,dir,map.geometry),other=byId.get(dest);
  const sk=cell.id+':'+dir;
  if(!other){bounds++;bySide.set(sk,null);continue;}
  if(T.neighbor(other,T.OPP[dir],map.geometry)!==cell.id)fail('nonreciprocal-adjacency:'+sk);
  const k=pair(cell.id,other.id);
  if(!edgeMap.has(k))edgeMap.set(k,{a:[cell.id,other.id].sort()[0],b:[cell.id,other.id].sort()[1],
   railCandidate:false,riverEvidence:'not-observed',riverSources:[],verified:false});
  bySide.set(sk,k);
 }
 const railCandidate=new Set(map.hexCenterRailConnections.map(l=>pair(l.from,l.to)));
 if(railCandidate.size!==map.hexCenterRailConnections.length)fail('duplicate-map-rail');
 for(const l of map.hexCenterRailConnections){
  if(!edgeMap.has(pair(l.from,l.to))||!l.status?.startsWith('source-svg-'))fail('nonadjacent-or-unregistered-rail');
 }
 const rails=new Map();for(const l of railAudit.railLinks){
  if(!Array.isArray(l.sourceSvgIds)||!l.sourceSvgIds.length||rails.has(l.key)||!edgeMap.has(l.key))fail('invalid-rail-source-link');
  rails.set(l.key,l.sourceSvgIds);
 }
 if(rails.size!==railCandidate.size||[...rails.keys()].some(k=>!railCandidate.has(k)))fail('rail-source-disagreement');
 for(const k of railAudit.excludedCrossings){if(!edgeMap.has(k)||rails.has(k)||railCandidate.has(k))fail('invalid-excluded-rail');}
 for(const [k,paths] of rails){const e=edgeMap.get(k);e.railCandidate=true;e.railSources=paths;}
 const sourcePathIds=new Set(map.authoredSourceVectors.rivers.map(x=>x.id));
 const seenRiver=new Set();let exterior=0,exteriorSideFollow=0,sideFollow=0;
 for(const record of riverAudit.sideObservations){
  if(seenRiver.has(record.edgeKey))fail('duplicate-river-evidence');seenRiver.add(record.edgeKey);
  if(!Array.isArray(record.members)||!record.members.length||record.members.length>2||
     !Array.isArray(record.sources)||record.sources.some(x=>!sourcePathIds.has(x)))fail('invalid-river-source');
  let target=null;
  for(const m of record.members){
   if(!byId.has(m.hexId)||!T.DIRS.includes(m.dir))fail('river-side-not-in-grid');
   const k=bySide.get(m.hexId+':'+m.dir);
   if(k===undefined)fail('river-side-unknown');
   if(target===null)target=k;
   else if(target!==k)fail('river-members-disagree');
  }
  const interior=record.members.length===2;
  if(interior!==record.internalPair)fail('river-incorrect-interior-flag');
  if(interior){
   if(!target||!edgeMap.has(target)||record.edgeKey.replace('~',':')!==target)fail('river-invalid-reciprocal-pair');
   if(!record.members.every(m=>bySide.get(m.hexId+':'+m.dir)===target))fail('river-nonreciprocal-side');
  }else{
   if(target!==null||record.edgeKey!==record.members[0].hexId+':'+record.members[0].dir)fail('river-incorrect-exterior-side');
   exterior++;
   if(record.classification!=='side-follow-review')fail('non-river-observation-must-not-enter-candidate-graph');
   exteriorSideFollow++;
   continue;
  }
  const e=edgeMap.get(target);
  if(record.classification==='side-follow-review'){
   e.riverEvidence='side-follow-candidate';sideFollow++;
  }else fail('non-river-observation-must-not-enter-candidate-graph');
  e.riverSources=record.sources;
 }
 if(seenRiver.size!==riverAudit.coverage.observedHexsides||
    sideFollow!==riverAudit.coverage.internalSideFollowCandidates||
    exteriorSideFollow!==riverAudit.coverage.exteriorSideFollowCandidates||
    sideFollow+exteriorSideFollow!==riverAudit.coverage.sideFollowCandidates)
  fail('river-coverage-mismatch');
 const edges=[...edgeMap.values()].sort((x,y)=>x.a.localeCompare(y.a)||x.b.localeCompare(y.b));
 const adj=new Map([...byId.keys()].map(id=>[id,[]]));
 for(const e of edges){adj.get(e.a).push(e.b);adj.get(e.b).push(e.a);}
 let components=0;const seen=new Set();
 for(const id of byId.keys())if(!seen.has(id)){
  components++;const stack=[id];seen.add(id);
  while(stack.length){const at=stack.pop();for(const to of adj.get(at))if(!seen.has(to)){seen.add(to);stack.push(to);}}
 }
 const metrics=T.gridMetrics(map);
 if(metrics.sharedEdges!==edges.length||metrics.boundaryEdges!==bounds||metrics.maxGap>0.01)fail('physical-grid-inconsistent');
 return {status:'source-diagnostic-only',movementAuthorized:false,combatAuthorized:false,
  metadata:{mapId,hexCount:byId.size,edgeCount:edges.length,boundarySides:bounds,components,
   railCandidates:rails.size,excludedRailCrossings:railAudit.excludedCrossings.length,
   riverSideFollowCandidates:sideFollow,riverExteriorObservations:exterior,
   riverUnobservedEdges:edges.length-sideFollow,maximumReciprocalGapPx:metrics.maxGap,
   sourceFingerprint},edges};
}
module.exports={fingerprint,build};
