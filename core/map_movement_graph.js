/* Bind approved map configurations to executable movement edges WITHOUT changing
 * artwork or promoting provisional data to game rules.
 * Eligibility is declared in the separate, source-specific graph-policy registry.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameMapMovementGraph=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const T=(typeof HexTerrainTiles!=='undefined')?HexTerrainTiles:(typeof require==='function'?require('./terrain_tiles'):null);
const Reviewed=(typeof require==='function')?require('./source_reviewed_movement_graph'):(typeof WargameSourceReviewedMovementGraph!=='undefined'?WargameSourceReviewedMovementGraph:null);
const Experimental=(typeof require==='function')?require('./source_experimental_movement_graph'):(typeof WargameSourceExperimentalMovementGraph!=='undefined'?WargameSourceExperimentalMovementGraph:null);
const fail=(reason)=>{throw Error('movement-map-binding: '+reason);};
const policies=(typeof require==='function' && typeof module==='object'&&module.exports)
 ? require('../maps/movement-configs/graph-sources.json') : null;
function checkPolicy(map,{experimentalScope=null}={}){
 const policy=policies?.maps?.[map.id];
 if(!policy||policy.mapId!==map.id||policy.sourceGame!==map.sourceGame||
    policy.sourceImageSHA256!==map.sourceImageSHA256||
    policy.geometryStatus!==map.geometry.calibrationStatus)
   return fail('source-geometry-not-gameplay-certified');
 if(policy.status==='experimental'){
  if(policy.edgeMode!=='source-vector-experimental-v1'||
    policy.evidenceTier!=='source-derived-candidate'||
    typeof experimentalScope!=='string'||experimentalScope!==policy.authorizationScope)
   return fail('source-geometry-not-gameplay-certified');
  return policy;
 }
 if(policy.status!=='verified'||policy.evidenceTier!=='source-authoritative')
  return fail('source-geometry-not-gameplay-certified');
 if(policy.edgeMode==='source-reviewed-v1'){
  if(!policy.edgeLedgerSHA256||!Array.isArray(policy.terrainStatuses))return fail('invalid-source-reviewed-policy');
  return policy;
 }
 for(const field of ['terrainStatus','railStatus','riverStatus','edgeSource'])
  if(typeof policy[field]!=='string'||!policy[field])return fail('invalid-source-policy:'+field);
 return policy;
}
function build(map,{strict=true,experimentalScope=null}={}){
 if(!T||!map||!Array.isArray(map.cells)||!map.geometry)return fail('invalid-map');
 // These conditions are deliberate safety gates, not generic assumptions about any SVG.
 const policy=checkPolicy(map,{experimentalScope});
 if(policy.edgeMode==='source-vector-experimental-v1')return Experimental.build(map,policy);
 if(policy.edgeMode==='source-reviewed-v1')return Reviewed.build(map,policy,{strict});
 const byId=new Map();
 for(const c of map.cells){
  if(!c||typeof c.id!=='string'||byId.has(c.id))return fail('duplicate-or-invalid-hex');
  byId.set(c.id,c);
  if(c.terrainStatus!==policy.terrainStatus)return fail('unverified-terrain:'+c.id);
 }
 const rails=new Set();
 for(const l of map.hexCenterRailConnections||[]){
  if(!byId.has(l.from)||!byId.has(l.to)||l.status!==policy.railStatus)return fail('unverified-rail-link');
  rails.add([l.from,l.to].sort().join(':'));
 }
 const shore=new Set();
 for(const h of map.authoredShoreHexsides||[]){
  if(!byId.has(h.cellId)||!T.DIRS.includes(h.dir))return fail('unverified-shore-entry');
  shore.add(h.cellId+':'+h.dir);
 }
 const cells={};const edges=[];const seen=new Set();let land=0;
 for(const c of map.cells){
  const passable=['open','forest','swamp','city','major-city','fortification'].includes(c.terrain);
  cells[c.id]={terrain:c.terrain,verified:passable,rail:false,sourceTerrainStatus:c.terrainStatus};
  if(passable)land++;
 }
 for(const c of map.cells){for(const dir of T.DIRS){
  const otherId=T.neighbor(c,dir,map.geometry),other=byId.get(otherId);
  if(!other)continue;
  const key=[c.id,otherId].sort().join(':');if(seen.has(key))continue;seen.add(key);
  const opposite=T.OPP[dir],a=c.tileEdges?.[dir]||[],b=other.tileEdges?.[opposite]||[];
  const sideShore=shore.has(c.id+':'+dir)||shore.has(otherId+':'+opposite);
  const inaccessible=!cells[c.id].verified||!cells[otherId].verified||sideShore;
  const rail=rails.has(key);
  // A registered rail connection is authoritative ONLY when reciprocal at hexside level.
  const railA=a.some(f=>f.kind==='rail'&&f.status===policy.railStatus);
  const railB=b.some(f=>f.kind==='rail'&&f.status===policy.railStatus);
  if(rail!==(railA&&railB))return fail('rail-registration-disagrees:'+key);
  if(rail&&inaccessible)return fail('rail-crosses-impassable:'+key);
  const river=a.some(f=>f.kind==='river'&&f.status===policy.riverStatus)||b.some(f=>f.kind==='river'&&f.status===policy.riverStatus);
  edges.push({a:c.id,b:otherId,verified:true,rail,river,impassable:inaccessible,allSea:c.terrain==='sea'||other.terrain==='sea',lake:sideShore,source:policy.edgeSource});
  if(rail){cells[c.id].rail=true;cells[otherId].rail=true;}
 }}
 for(const key of rails)if(!seen.has(key))return fail('nonadjacent-rail:'+key);
 if(strict&&(!land||!edges.length))return fail('empty-board');
 return {cells,edges,metadata:{sourceGame:map.sourceGame,sourceMapId:map.id,landHexes:land,railEdges:rails.size,edgeCount:edges.length,coverage:policy.coverage}};
}
return {build,checkPolicy};
});
