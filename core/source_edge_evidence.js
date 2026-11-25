/* Read-only evidence audit: trace candidate railway/hexside records back to
 * user SVG element IDs, without claiming the traced path certifies a move.
 * Uses the shared terrain_tiles neighbor geometry; does not alter maps.
 */
(function(root,factory){
 const T=typeof module==='object'&&module.exports?require('./terrain_tiles'):root.HexTerrainTiles;
 const api=factory(T);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameSourceEdgeEvidence=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T){'use strict';
 const fail=m=>{throw Error('source-edge-evidence: '+m);};
 const key=(a,b)=>[a,b].sort().join(':');
 function inspect(map,svgIds){
  if(!map||!Array.isArray(map.cells)||!map.geometry||!(svgIds instanceof Set))fail('invalid-input');
  const cells=new Map();
  for(const c of map.cells){if(!c||!c.id||cells.has(c.id))fail('duplicate-or-invalid-hex');cells.set(c.id,c);}
  const rail=[],seen=new Set(),missingSvgIds=[];
  for(const r of map.hexCenterRailConnections||[]){
   if(!r||!cells.has(r.from)||!cells.has(r.to))fail('rail-references-missing-hex');
   const pair=key(r.from,r.to);if(seen.has(pair))fail('duplicate-rail-pair:'+pair);seen.add(pair);
   const dir=T.DIRS.find(d=>T.neighbor(cells.get(r.from),d,map.geometry)===r.to);
   if(!dir)fail('nonadjacent-rail-candidate:'+pair);
   if(!Array.isArray(r.sourceSvgIds)||!r.sourceSvgIds.length)fail('rail-missing-trace-id:'+pair);
   const refs=[...new Set(r.sourceSvgIds)];
   for(const id of refs){if(typeof id!=='string'||!id)fail('invalid-svg-id');if(!svgIds.has(id))missingSvgIds.push({pair,id});}
   rail.push({pair,from:r.from,to:r.to,direction:dir,sourceSvgIds:refs.sort(),status:r.status||null,
    tracedToSvg:refs.every(id=>svgIds.has(id)),movementCertified:false});
  }
  const hexsideKinds={},hexsideStatuses={},hexsideIssues=[],hexsidePairs=new Set();
  for(const c of map.cells){
   for(const [dir,features] of Object.entries(c.tileEdges||{})){
    if(!T.DIRS.includes(dir)||!Array.isArray(features))fail('invalid-tile-edge:'+c.id+':'+dir);
    for(const feature of features){
     if(!feature||typeof feature.kind!=='string')fail('invalid-feature');
     hexsideKinds[feature.kind]=(hexsideKinds[feature.kind]||0)+1;
     const status=feature.status||'unspecified';hexsideStatuses[status]=(hexsideStatuses[status]||0)+1;
     const otherId=T.neighbor(c,dir,map.geometry),other=cells.get(otherId);
     const pair=key(c.id,otherId);hexsidePairs.add(pair);
     if(!other){hexsideIssues.push({hex:c.id,direction:dir,kind:feature.kind,issue:'off-board-or-unregistered'});continue;}
     const opposite=other.tileEdges?.[T.OPP[dir]]||[];
     if(!opposite.some(f=>f.kind===feature.kind))
      hexsideIssues.push({hex:c.id,direction:dir,kind:feature.kind,issue:'missing-reciprocal-feature'});
    }
   }
  }
  rail.sort((a,b)=>a.pair.localeCompare(b.pair));
  hexsideIssues.sort((a,b)=>a.hex.localeCompare(b.hex)||a.direction.localeCompare(b.direction)||a.kind.localeCompare(b.kind));
  missingSvgIds.sort((a,b)=>a.pair.localeCompare(b.pair)||a.id.localeCompare(b.id));
  return {mapId:map.id,sourceImageSHA256:map.sourceImageSHA256||null,authorizedForMovement:false,
   counts:{railCandidates:rail.length,railTracedToExistingSvgIds:rail.filter(r=>r.tracedToSvg).length,
    railMissingSvgIds:missingSvgIds.length,authoredHexsideFeatureMarks:Object.values(hexsideKinds).reduce((a,b)=>a+b,0),
    hexsidePairsWithMarks:hexsidePairs.size,hexsideIssues:hexsideIssues.length},
   missingSvgIds,hexsideKinds,hexsideStatuses,hexsideIssues,railCandidates:rail,
   limitations:['SVG element ID existence proves traceability only, not that a line truly follows the named hex-center adjacency',
    'Authorial SVG geometry and inferred grid calibration are not automatically certified for gameplay',
    'Hexside marks may represent visual candidates rather than verified river or rail restrictions',
    'Candidate links and feature marks must not be promoted to executable movement permissions']};
 }
 return Object.freeze({inspect});
});
