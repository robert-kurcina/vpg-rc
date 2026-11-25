/* Source-identified hex re-key preview.
 * Universal, opt-in; no production board mutation and no renderer substitution.
 * A canonical game-cell ID equals the source-facing displayed four-digit number.
 * Unnumbered water geometry is retained separately for future visual composition.
 */
(function(root,factory){
 const T=(typeof module==='object'&&module.exports)?require('./terrain_tiles'):root.HexTerrainTiles;
 const api=factory(T);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.CanonicalHexProjection=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T){
 'use strict';
 const D=Object.freeze(['N','NE','SE','S','SW','NW']);
 function validNumber(s){return /^\d{4}$/.test(s)&&Number(s.slice(0,2))>0&&Number(s.slice(2,4))>0;}
 function project(board,formatNumber,{strict=true}={}){
  if(!board||!Array.isArray(board.cells)||!board.geometry||typeof formatNumber!=='function')throw Error('Projection requires board, geometry and source-number resolver');
  const byOld=new Map(),byCanonical=new Map(),byId=new Map();
  const playable=[],visualOnly=[],errors=[];
  for(const cell of board.cells){
   if(byOld.has(cell.id))throw Error('Duplicate source ID '+cell.id);
   byOld.set(cell.id,cell);
   const label=String(formatNumber(cell));
   if(!validNumber(label)){
    const noGameplayFeatures=cell.terrain==='sea'&&!cell.city&&!cell.fortification&&!(cell.tileMarkers||[]).length&&!(cell.railEdges||[]).length&&!(cell.hexCenterRailConnections||[]).length&&Object.keys(cell.tileEdges||{}).length===0&&Object.keys(cell.hexsideFeatures||{}).length===0;
    if(!noGameplayFeatures)errors.push('Unnumbered cell carries gameplay data: '+cell.id);
    visualOnly.push({physicalId:cell.id,sourceFacingLabel:label,terrain:cell.terrain,pixelCenter:[...cell.pixelCenter]});
    continue;
   }
   if(byCanonical.has(label))errors.push('Duplicate canonical ID '+label+' for '+cell.id+' and '+byCanonical.get(label));
   byCanonical.set(label,cell.id);
   byId.set(cell.id,label);
   playable.push({...JSON.parse(JSON.stringify(cell)),id:label,column:Number(label.slice(0,2)),row:Number(label.slice(2)),displayNumber:label,legacyPhysicalCellId:cell.id});
  }
  if(errors.length&&strict)throw Error('Canonical projection rejected: '+errors.join('; '));
  const neighbors={};const expectedPairs=new Set();const pair=(a,b)=>[a,b].sort().join('~');
  for(const source of board.cells){
   const id=byId.get(source.id);if(!id)continue;
   neighbors[id]={};
   for(const dir of D){
    const originalNeighbor=T.neighbor(source,dir,board.geometry);
    const canonicalNeighbor=byId.get(originalNeighbor)||null;
    neighbors[id][dir]=canonicalNeighbor;
    if(canonicalNeighbor)expectedPairs.add(pair(id,canonicalNeighbor));
   }
  }
  const canonicalGeometry={...JSON.parse(JSON.stringify(board.geometry)),neighborMode:'explicit',explicitNeighbors:neighbors};
  if(canonicalGeometry.hexNumbers){
   delete canonicalGeometry.hexNumbers.printedColumnOffset;
   delete canonicalGeometry.hexNumbers.printedRowOffset;
   delete canonicalGeometry.hexNumbers.printedRowOffsetsByColumn;
   delete canonicalGeometry.hexNumbers.rowShift;
  }
  // Remap independently verified, structured live feature references.
  // Keep water-only hexside observations in a separate visual-only ledger;
  // never invent canonical names for the unnumbered sea geometry.
  const ref=(value,context)=>{
   const mapped=byId.get(value);
   if(!mapped)throw Error('Unresolved game feature reference '+context+':'+value);
   return mapped;
  };
  const rails=(board.hexCenterRailConnections||[]).map(x=>({...JSON.parse(JSON.stringify(x)),from:ref(x.from,'rail.from'),to:ref(x.to,'rail.to')}));
  const exits=(board.railwayBoundaryExits||[]).map(x=>({...JSON.parse(JSON.stringify(x)),from:ref(x.from,'railwayExit.from')}));
  const entry=board.entryBoundarySelections?JSON.parse(JSON.stringify(board.entryBoundarySelections)):null;
  if(entry)for(const path of entry.paths||[])for(const side of path.edges||[])side.cellId=ref(side.cellId,'entry.cellId');
  const shore=[],unmappedWaterShore=[];
  for(const s of board.authoredShoreHexsides||[]){
   const id=byId.get(s.cellId);
   if(id)shore.push({...JSON.parse(JSON.stringify(s)),cellId:id});
   else if(visualOnly.some(v=>v.physicalId===s.cellId))unmappedWaterShore.push(JSON.parse(JSON.stringify(s)));
   else throw Error('Unresolved shore side '+s.cellId);
  }
  const canonicalSea=[],visualOnlySea=[];
  for(const id of board.authoritativeSeaHexes||[]){
   if(byId.has(id))canonicalSea.push(byId.get(id));
   else if(visualOnly.some(v=>v.physicalId===id))visualOnlySea.push(id);
   else throw Error('Unresolved sea cell '+id);
  }
  const canonicalBoard={id:board.id,sourceGame:board.sourceGame,geometry:canonicalGeometry,cells:playable,
   hexCenterRailConnections:rails,railwayBoundaryExits:exits,authoredShoreHexsides:shore,
   ...(entry?{entryBoundarySelections:entry}:{}),authoritativeSeaHexes:canonicalSea};
  const reverse=new Map(playable.map(c=>[c.id,c.legacyPhysicalCellId]));
  const discoveredPairs=new Set();
  for(const cell of playable)for(const dir of D){
   const next=T.neighbor(cell,dir,canonicalGeometry);
   if(next){
    const other=neighbors[next];if(!other||other[T.OPP[dir]]!==cell.id)errors.push('Nonreciprocal canonical neighbors '+cell.id+' '+dir+' '+next);
    discoveredPairs.add(pair(cell.id,next));
   }
  }
  if(discoveredPairs.size!==expectedPairs.size)errors.push('Canonical edge count mismatch');
  for(const edge of expectedPairs)if(!discoveredPairs.has(edge))errors.push('Missing canonical edge '+edge);
  const movedMarkers=playable.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind==='cross'||m.kind==='star').map(m=>({id:c.id,physicalId:c.legacyPhysicalCellId,kind:m.kind,faction:m.faction})));
  if(strict&&errors.length)throw Error('Canonical projection rejected: '+errors.join('; '));
  return {
   board:canonicalBoard,
   record:{schemaVersion:1,sourceMapId:board.id,sourceCellCount:board.cells.length,canonicalCellCount:playable.length,visualOnlyCellCount:visualOnly.length,physicalToCanonical:Object.fromEntries(byId),canonicalToPhysical:Object.fromEntries([...reverse]),visualOnly,canonicalNeighbors:neighbors,canonicalPhysicalEdges:expectedPairs.size,deploymentMarkers:movedMarkers,
    migratedFeatureCounts:{railConnections:rails.length,railwayBoundaryExits:exits.length,entryBoundaryEdges:entry?.paths?.reduce((n,p)=>n+(p.edges||[]).length,0)||0,authoredShoreSides:shore.length,canonicalSeaCells:canonicalSea.length},
    visualOnlyFeatureRecords:{shoreSides:unmappedWaterShore,seaPhysicalIds:visualOnlySea},errors,
    activationStatus:'PREVIEW_ONLY',reason:'Other scenario references, source water drawing and saved-game IDs require atomic migration before replacing the production board.'}
  };
 }
 return {project,validNumber};
});
