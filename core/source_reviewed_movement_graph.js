/* Configured, source-pinned movement edge adapter. Uses the SAME hex-grid
 * neighbor function as the renderer and the original certified graph.
 * No scenario-specific code and no caller-supplied certification flags.
 */
(function(root,factory){const api=factory(
 typeof module==='object'&&module.exports?require('./terrain_tiles'):root.HexTerrainTiles,
 typeof module==='object'&&module.exports?require('../maps/movement-configs/source-reviewed-edge-ledgers.json'):null,
 typeof module==='object'&&module.exports?require('node:crypto'):null);
 if(typeof module==='object'&&module.exports)module.exports=api;root.WargameSourceReviewedMovementGraph=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T,registry,Crypto){'use strict';
 const fail=s=>{throw Error('movement-map-binding: '+s)};
 const pair=(a,b)=>[a,b].sort().join(':');
 // Campaign saves canonicalize object key order. Fingerprints must not depend on insertion order.
 const canonical=x=>JSON.stringify(x,(_,v)=>v&&!Array.isArray(v)&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const sha=x=>Crypto.createHash('sha256').update(canonical(x)).digest('hex');
 const fingerprint=map=>sha({id:map.id,sourceGame:map.sourceGame,sourceImageSHA256:map.sourceImageSHA256,geometry:map.geometry,
  cells:map.cells.map(c=>({id:c.id,column:c.column,row:c.row,pixelCenter:c.pixelCenter,terrain:c.terrain,terrainStatus:c.terrainStatus})),railLinks:map.hexCenterRailConnections});
 // Extra source pin for maps whose City artwork has no underlying base-terrain glyph.
 // This digest is additive: original Arduous ledger and fingerprint stay identical.
 const overlayFingerprint=map=>sha({definitiveTerrainAudit:map.definitiveTerrainAudit,
  cells:map.cells.map(c=>({id:c.id,sourceTerrainEvidence:c.sourceTerrainEvidence||null, userTerrainAdjudication:c.userTerrainAdjudication||null,
   cityMarkers:(c.tileMarkers||[]).filter(m=>m.kind==='city'||m.kind==='majorCity')}))});
 function build(map,policy,{strict=true}={}){
  if(!T||!registry||!Crypto||policy.edgeMode!=='source-reviewed-v1')fail('unsupported-source-reviewed-policy');
  const evidence=registry.maps?.[map.id];
  if(!evidence||evidence.schemaVersion!==1||registry.schemaVersion!==1||evidence.mapId!==map.id||
   evidence.sourceSvgSha256!==(policy.sourceEvidenceMode==='definitive-city-layer-v1'
    ?map.definitiveTerrainAudit?.sourceSvgSha256:map.authoredSourceVectors?.sourceSvgSha256)||
   evidence.sourceFingerprint!==fingerprint(map)||
   (policy.sourceEvidenceMode==='definitive-city-layer-v1'&&evidence.overlayFingerprint!==overlayFingerprint(map)))fail('source-reviewed-fingerprint-mismatch');
  const digest=Crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
  if(digest!==policy.edgeLedgerSHA256)fail('source-reviewed-ledger-hash-mismatch');
  if(!Array.isArray(policy.terrainStatuses)||!Array.isArray(evidence.railEdges)||!Array.isArray(evidence.riverEdges))fail('invalid-source-reviewed-ledger');
  const byId=new Map();const cells={};
  const sourceCities=policy.sourceEvidenceMode==='definitive-city-layer-v1';
  const overlays=sourceCities?evidence.cityTerrainOverlays:null;
  if(sourceCities&&(!overlays||typeof overlays!=='object'||Array.isArray(overlays)))fail('missing-city-terrain-overlays');
  if(!sourceCities&&evidence.cityTerrainOverlays)fail('unsupported-city-terrain-overlays');
  const citySeen=new Set();
  for(const c of map.cells){
   if(!c||byId.has(c.id)||!policy.terrainStatuses.includes(c.terrainStatus)||
    !['open','forest','swamp'].includes(c.terrain))fail('unverified-terrain:'+c?.id);
   let terrain=c.terrain;
   if(sourceCities){
    // Terrain Effects Chart lists City and Major City as complete gameplay types.
    // The existing 'open' base beneath these symbols is a DISPLAY FALLBACK ONLY.
    const authoritative=evidence.sourceSvgSha256,city=overlays[c.id];
    if(!c.sourceTerrainEvidence||c.sourceTerrainEvidence.sourceSvgSha256!==authoritative)fail('unverified-svg-cell:'+c.id);
    if(city){
     if(c.terrainStatus!=='source-typed-city-terrain-v429'||c.terrain!=='open'||
      !['city','major-city'].includes(city.terrain)||typeof city.svgId!=='string'||
      c.sourceTerrainEvidence.layer!==city.terrain||
      !c.sourceTerrainEvidence.sourceSvgIds?.includes(city.svgId)||
      !(c.tileMarkers||[]).some(m=>(city.terrain==='major-city'?m.kind==='majorCity':m.kind==='city')&&m.sourceSvgId===city.svgId))fail('unverified-source-city:'+c.id);
     terrain=city.terrain;citySeen.add(c.id);
    }else if(c.terrainStatus==='user-adjudicated-terrain-v435'){
     const a=c.userTerrainAdjudication;
     if(!a||!a.directive||a.sourceTerrainUnchanged!==true||
       a.previousTerrain!==c.sourceTerrainEvidence.layer||
       a.terrain!==c.terrain)fail('unverified-user-terrain-adjudication:'+c.id);
    }else if(c.terrainStatus!=='definitive-user-svg-terrain-v428'||
     c.sourceTerrainEvidence.layer!==c.terrain)fail('unverified-source-base:'+c.id);
   }
   byId.set(c.id,c);cells[c.id]={terrain,verified:true,rail:false,sourceTerrainStatus:c.terrainStatus};
  }
  if(sourceCities&&citySeen.size!==Object.keys(overlays).length)fail('unmatched-city-terrain-overlay');
  if(byId.size!==evidence.hexCount)fail('source-reviewed-cell-count');
  const registered=new Set();
  for(const link of map.hexCenterRailConnections||[]){
   if(link.status!==policy.railStatus||!byId.has(link.from)||!byId.has(link.to))fail('unverified-rail-link');
   const key=pair(link.from,link.to);if(registered.has(key))fail('duplicate-rail-link');registered.add(key);
  }
  function listed(items,label){const s=new Set();for(const key of items){
   if(typeof key!=='string'||!/^[0-9]{4}:[0-9]{4}$/.test(key)||s.has(key)||key!==key.split(':').sort().join(':'))fail('invalid-'+label+'-ledger');
   s.add(key);
  }return s}
  const rails=listed(evidence.railEdges,'rail'),rivers=listed(evidence.riverEdges,'river'),
   majorRivers=listed(evidence.majorRiverEdges||[],'major-river');
  if([...rivers].some(key=>majorRivers.has(key)))fail('conflicting-river-types');
  if(rails.size!==registered.size||[...rails].some(key=>!registered.has(key)))fail('rail-ledger-disagreement');
  // Source-layer presentation markers are not exhaustive (long river paths are
  // stored separately), but any marker that IS present must agree with the
  // independently source-pinned gameplay ledger. Do not accept a depicted
  // Major River side as an ordinary River crossing or vice versa. This is
  // generic to source-city-layer registrations, never a game-name exception.
  if(sourceCities)for(const c of map.cells){
   for(const [dir,features] of Object.entries(c.tileEdges||{})){
    if(!T.DIRS.includes(dir)||!Array.isArray(features))fail('invalid-source-visual-edge');
    const adjacent=T.neighbor(c,dir,map.geometry);if(!byId.has(adjacent))continue;
    const key=pair(c.id,adjacent);
    for(const feature of features){
     const kind=feature?.kind;
     if(kind==='river'&&!rivers.has(key)||kind==='majorRiver'&&!majorRivers.has(key)||kind==='rail'&&!rails.has(key))
      fail('source-visual-edge-disagrees-with-ledger:'+key+':'+kind);
    }
   }
  }
  const edges=[];const seen=new Set();let boundary=0;
  for(const c of map.cells)for(const dir of T.DIRS){
   const otherId=T.neighbor(c,dir,map.geometry),other=byId.get(otherId);
   if(!other){boundary++;continue;}
   if(T.neighbor(other,T.OPP[dir],map.geometry)!==c.id)fail('nonreciprocal-adjacency');
   const key=pair(c.id,otherId);if(seen.has(key))continue;seen.add(key);
   const rail=rails.has(key),river=rivers.has(key),majorRiver=majorRivers.has(key);
   edges.push({a:[c.id,otherId].sort()[0],b:[c.id,otherId].sort()[1],verified:true,rail,river,majorRiver,impassable:false,allSea:false,lake:false,source:policy.edgeSource});
   if(rail){cells[c.id].rail=true;cells[otherId].rail=true;}
  }
  if(edges.length!==evidence.edgeCount||boundary!==evidence.boundarySides||
   [...rails,...rivers,...majorRivers].some(key=>!seen.has(key))||
   (strict&&(!edges.length||!byId.size)))fail('source-reviewed-grid-disagreement');
  return {cells,edges,metadata:{sourceGame:map.sourceGame,sourceMapId:map.id,landHexes:byId.size,
   railEdges:rails.size,riverEdges:rivers.size,majorRiverEdges:majorRivers.size,edgeCount:edges.length,coverage:policy.coverage}};
 }
 return Object.freeze({build,fingerprint,overlayFingerprint});
});
