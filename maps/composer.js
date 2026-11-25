/* Universal composition of scenario map extensions; visual map data only.
 * Never mutates the base map; verifies identity and hex topology.
 */
(function(root,factory){
 const T=(typeof module==='object'&&module.exports)?require('../core/terrain_tiles'):root.HexTerrainTiles;
 if(!T)throw Error('HexTerrainTiles required before map composer');
 const api=factory(T);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameMapComposer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 function compose(base,extension){
  if(!base?.cells||!extension?.cells)throw Error('Missing base or extension cells');
  if(extension.baseMapId!=='kiev'||!String(base.sourceGame||'').toLowerCase().includes('kiev'))
   throw Error('This Odessa extension requires the Kiev base map');
  const ids=new Set(base.cells.map(c=>c.id));
  for(const c of extension.cells){
   if(ids.has(c.id))throw Error('Extension hex overlaps base: '+c.id);
   ids.add(c.id);
  }
  const board=clone(base);
  board.id=extension.compositeId||base.id+'-with-'+extension.id;
  // v289: user-authored definitive composite vectors supersede both legacy map scans.
  // Authoritative SVG is configuration evidence, NEVER a parallel rendering pipeline.
  if(extension.authoritativeCompositeSvg)board.authoritativeSourceGeometry=clone({sourceFile:extension.authoritativeCompositeSvg.sourceFile,sha256:extension.authoritativeCompositeSvg.sha256});
  board.sourceGame=extension.compositeTitle||base.sourceGame+' + Odessa Expansion';
  board.cells.push(...clone(extension.cells));
  const cellById=new Map(board.cells.map(c=>[c.id,c]));
  // User-adjudicated composite territory is map DATA, not a renderer guess.
  // Only the composite receives these labels; the Kiev base remains untouched.
  // Unlisted hexes remain unknown (never silently interpreted as "outside").
  const territoryAssigned=new Set();
  for(const region of extension.compositeTerritoryRegions||[]){
   if(!region||!['romania','bessarabia','outside'].includes(region.id)||
      !Array.isArray(region.hostCells)||region.hostCells.length===0||
      region.territoryEvidence!=='user-adjudicated'||
      typeof region.source!=='string'||!region.source)throw Error('Invalid composite territorial evidence');
   for(const id of region.hostCells){
    if(territoryAssigned.has(id))throw Error('Duplicate composite territory assignment '+id);
    const cell=cellById.get(id);
    if(!cell||cell.terrain==='sea')throw Error('Unknown/sea composite territory hex '+id);
    territoryAssigned.add(id);
    cell.sourceTerritory=region.id;
    cell.territoryEvidence=region.territoryEvidence;
    cell.territorySource=region.source;
   }
  }
  for(const o of extension.cityOverrides||[]){
   const target=cellById.get(o.cellId);
   if(!target)throw Error('Odessa city override missing target hex '+o.cellId);
   if(target.city)throw Error('Odessa city override conflicts with base city '+o.cellId);
   target.city=clone(o.city);
   target.tileMarkers=target.tileMarkers||[];
   target.tileMarkers.push(clone(o.tileMarker));
  }
  // Odessa inherits the Kiev railway presentation standard. Preserve the
  // original source-derived links from each map and add only authored seam
  // links; the spline is a drawing policy, never a movement-rule change.
  if(JSON.stringify(base.railwayPresentation)!==JSON.stringify(extension.railwayPresentation))
   throw Error('Kiev/Odessa railway spline configurations disagree');
  board.railwayPresentation=clone(base.railwayPresentation);
  // Preserve all source-authored rail/water geometry across the composite seam.
  // Drawing these original source curves cannot alter the connectivity graph.
  board.sourceRailRoutes=extension.authoritativeRailRoutes?clone(extension.authoritativeRailRoutes):[...(clone(base.sourceRailRoutes||[])),...(clone(extension.sourceRailRoutes||[]))];
  // A pre-registered standalone crop must not disable junction registration
  // when composing the full board with its separate authoritative routes.
  board.preRegisteredRailGeometry=false;
  board.authoritativeRailPolylineGeometry=Boolean(extension.authoritativeRailPolylineGeometry);
  board.bitmapRailCorrections=clone(extension.authoritativeRailRoutes?null:extension.bitmapRailCorrections||null);
  // Coastal port terminals are a visual overlay only; they never create rail adjacency.
  board.railwayCoastalTerminals=clone(extension.railwayCoastalTerminals||[]);
  board.hiddenSourceRailRouteIndices=clone(extension.authoritativeRailRoutes?[]:extension.hiddenSourceRailRouteIndices||[]);
  board.hiddenSourceRiverSvgIds=clone(extension.hiddenSourceRiverSvgIds||[]);
  // v282: preserve bitmap-registered river display geometry separately from SVG evidence/rules.
  board.sourceBitmapRiverInk=clone(extension.authoritativeWaterEdgeCandidates?null:extension.sourceBitmapRiverInk||null);
  board.riverRenderingMode=extension.riverRenderingMode||null;
  board.v275BitmapAudit=clone(extension.v275BitmapAudit||null);
  board.waterRenderingMode=extension.waterRenderingMode||base.waterRenderingMode||null;
  board.sourceSeaInteriorMode=extension.sourceSeaInteriorMode||base.sourceSeaInteriorMode||null;
  board.waterPresentation=clone(extension.waterPresentation||base.waterPresentation||{});
  board.sourceWaterRoutes=extension.authoritativeWaterEdgeCandidates?[]:[...(clone(base.sourceWaterRoutes||[])),...(clone(extension.sourceWaterRoutes||[]))];
  board.sourceWaterScanContours=clone(extension.authoritativeWaterEdgeCandidates?null:extension.sourceWaterScanContours||base.sourceWaterScanContours||null);
  board.sourceBackgroundColor=extension.sourceBackgroundColor||base.sourceBackgroundColor||null;
  // A standalone Kiev off-map rail may become an INTERNAL hex connection
  // when Odessa is appended. Preserve only exits still on the composite
  // perimeter; never draw a false dangling railway across the Kiev seam.
  board.railwayBoundaryExits=(extension.authoritativeRailPolylineGeometry?[]:[...(clone(base.railwayBoundaryExits||[])),...(clone(extension.railwayBoundaryExits||[]))])
   .filter(exit=>{const c=cellById.get(exit.from);
    return c&&!cellById.has(T.neighbor(c,exit.dir,board.geometry));});
  board.hexCenterRailConnections=[...(clone(base.hexCenterRailConnections||[])),...(clone(extension.hexCenterRailConnections||[]))];
  const railKeys=new Set();
  for(const x of board.hexCenterRailConnections){
   const key=[x.from,x.to].sort().join(':');
   if(railKeys.has(key))throw Error('Kiev/Odessa duplicate center rail '+key);
   railKeys.add(key);
  }
  board.railwayNetworkAudit={source:'Kiev + Odessa original center-snap rail links, composed without inferred connections',
   internalLinks:board.hexCenterRailConnections.length,exteriorStubs:board.railwayBoundaryExits.length,
   visualCandidate:true,gameplayCertified:false};
  board.authoredReinforcementTraces=[...(clone(base.authoredReinforcementTraces||[])),...(clone(extension.authoredReinforcementTraces||[]))];
  board.sourceRegistrationAudit={base:clone(base.v260SourceRegistration||{}),extension:clone(extension.v260SourceRegistration||{}),printedCityHexAudit:clone(extension.printedCityHexAudit||{})};
  board.cells.sort((a,b)=>a.id.localeCompare(b.id));
  const cols=board.cells.map(c=>c.column),rows=board.cells.map(c=>c.row);
  board.geometry.widthColumns=Math.max(...cols);board.geometry.heightRows=Math.max(...rows);
  board.additionalSourceVectors=clone(extension.additionalSourceVectors||[]);
  board.authoredShoreHexsides=extension.authoritativeWaterEdgeCandidates?clone(extension.authoredShoreHexsides||[]):[...(board.authoredShoreHexsides||[]),...(clone(extension.authoredShoreHexsides||[]))];
  board.expansionOverlay=clone(extension.expansionOverlay||{});
  board.expansionOverlay.standalone=false;
  board.compositeOf=[extension.baseMapId,extension.id];
  // Scoped user decisions belong to the composite config; do not leak its 1111 marker into Kiev.
  board.userMapCorrections=clone(extension.userMapCorrections||null);
  board.sourceStatus=board.authoritativeSourceGeometry?'v290 source SVG geometry in existing engine; hexside topology imported; gameplay rules remain provisional':'Combined Kiev + Odessa SVG map; extension topology is visual-candidate; expansion rules not certified';
  // An original Kiev entry edge may become internal once Odessa is appended.
  // Recompute from the same geometry that renders the hex-grid, not by copying
  // stale southern boundary pixels or duplicating old Kiev records.
  const [rx,ry]=T.gridRadii(board.geometry);
  const perimeter=new Set(T.gridSegmentData(board,rx,ry).filter(e=>!e.neighborId).map(e=>e.cellId+':'+e.dir));
  const candidates=[];
  for(const p of (board.authoritativeSourceGeometry?[]:base.entryBoundarySelections?.paths||[])){
   for(const e of p.edges||[]){
    if(perimeter.has(e.cellId+':'+e.dir))candidates.push({cellId:e.cellId,dir:e.dir,side:p.side,source:'kiev-authoritative-visual-border'});
   }
  }
  if(board.authoritativeSourceGeometry)candidates.push(...clone(extension.authoritativeEntryEdges||[]));
  else candidates.push(...clone(extension.entryEdges||[]));
  // Source vectors replace legacy entry-edge assignments; do not reuse stale
  // edges for cells absent from the definitive user-authored grid.
  const unique=new Map();
  for(const e of candidates){
   const key=e.cellId+':'+e.dir;
   if(!perimeter.has(key))throw Error('Non-exterior expansion entry edge '+key);
   if(unique.has(key)&&unique.get(key).side!==e.side)throw Error('Conflicting entry faction for '+key);
   unique.set(key,e);
  }
  board.compositeEntryEdges=[...unique.values()];
  // Apply definitive composite cell semantics ONLY after composition. Kiev-alone
  // remains the unchanged v288 scenario. A null terrain represents an authored
  // city-symbol hex whose underlying ground type is not identified in the SVG.
  if(extension.authoritativeCellOverrides){
   const allowed=new Set(Object.keys(extension.authoritativeCellOverrides));
   board.cells=board.cells.filter(c=>allowed.has(c.id));
   for(const c of board.cells){const o=extension.authoritativeCellOverrides[c.id];
    for(const k of ['terrain','terrainStatus','tileMarkers','city','tileEdges','hexsideFeatures','terrainTextureOpacityMultiplier','userTerrainAdjudication']){
     if(!Object.prototype.hasOwnProperty.call(o,k))continue;
     if(o[k]===undefined){delete c[k];continue;}
     const incoming=clone(o[k]);
     if(k==='tileMarkers'&&Array.isArray(incoming)){
      // Definitive composite overrides may replace a Kiev city marker without
      // repeating its already source-registered SVG ID. Preserve ONLY a unique
      // same-name/same-kind anchor whose original terrain evidence names that
      // exact SVG use under the *same* authoritative composite source hash.
      // Do not make up IDs or relax the combat geography's source guard.
      const oldMarkers=c.tileMarkers||[],evidence=c.sourceTerrainEvidence;
      for(const marker of incoming){
       if(!['city','majorCity'].includes(marker.kind)||marker.sourceSvgId||!marker.label||
        (c.city?.name&&c.city.name!==marker.label)||
        (o.city?.name&&o.city.name!==marker.label))continue;
       const matches=oldMarkers.filter(old=>old.kind===marker.kind&&old.label===marker.label&&
        typeof old.sourceSvgId==='string'&&old.sourceSvgId.length>0&&
        evidence?.sourceSvgSha256===board.authoritativeSourceGeometry?.sha256&&
        evidence?.layer==='city'&&Array.isArray(evidence.sourceSvgIds)&&
        evidence.sourceSvgIds.length===1&&evidence.sourceSvgIds[0]===old.sourceSvgId);
       if(matches.length===1)marker.sourceSvgId=matches[0].sourceSvgId;
      }
     }
     c[k]=incoming;
    }
   }
  }
  // v290: preserve the original renderer and engine-owned art, not source SVG graphics.
  if(board.authoritativeSourceGeometry){
   board.authoredSourceVectors=null;board.additionalSourceVectors=[];
   board.sourceRiverTraces=[];board.sourceWaterTraces=[];
   board.hexCenterRailConnections=[]; // authored SVG routes are drawing coordinates, not old snap hints
   board.sourceSeaInteriorMode='no-sea-polygons';
   board.authoritativeSeaHexes=clone(extension.authoritativeSeaHexes||[]);
   board.sourceBackgroundColor='#ffffff';
   // All source-confirmed river edge records are in the cell overrides above.
  }
  return board;
 }
 return Object.freeze({compose});
});
