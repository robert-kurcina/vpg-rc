/* Read-only Kiev–Odessa seam audit. Geometry is NOT executable movement legality.
 * Uses the same neighbor routine as the renderer and existing map composer.
 */
(function(root,factory){
 const T=(typeof module==='object'&&module.exports)?require('./terrain_tiles'):root.HexTerrainTiles;
 const api=factory(T);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameCompositeGraphAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T){'use strict';
 const fail=(message)=>{throw Error('composite-seam-audit: '+message);};
 function audit(base,extension,composite){
  if(!base?.cells||!extension?.cells||!composite?.cells||!composite?.geometry)return fail('missing-map-input');
  if(extension.baseMapId!=='kiev'||!String(base.sourceGame||'').toLowerCase().includes('kiev'))return fail('incorrect-composition');
  if(composite.expansionOverlay?.standalone!==false)return fail('expansion-must-not-be-standalone');
  if(!Array.isArray(composite.compositeOf)||composite.compositeOf[0]!==extension.baseMapId||composite.compositeOf[1]!==extension.id)return fail('wrong-composite-identity');
  const sourceSets=[new Set(),new Set()];
  for(const [i,data] of [base,extension].entries())for(const c of data.cells){
   if(!c||typeof c.id!=='string'||sourceSets[i].has(c.id))return fail('duplicate-source-hex');
   sourceSets[i].add(c.id);
  }
  for(const id of sourceSets[0])if(sourceSets[1].has(id))return fail('overlap:'+id);
  const byId=new Map();for(const c of composite.cells){
   if(!c||typeof c.id!=='string'||byId.has(c.id))return fail('duplicate-composite-hex');
   if(!sourceSets[0].has(c.id)&&!sourceSets[1].has(c.id))return fail('unsourced-composite-hex:'+c.id);
   byId.set(c.id,c);
  }
  // Source-authoritative composite overrides are allowed to *remove* cells, never to create them.
  const seams=[];let baseCount=0,extensionCount=0;
  for(const c of composite.cells){
   const source=sourceSets[0].has(c.id)?'base':'extension';
   if(source==='base')baseCount++;else extensionCount++;
   if(source!=='base')continue;
   for(const dir of T.DIRS){
    const neighborId=T.neighbor(c,dir,composite.geometry);
    if(!sourceSets[1].has(neighborId)||!byId.has(neighborId))continue;
    const other=byId.get(neighborId),reverse=T.OPP[dir];
    if(T.neighbor(other,reverse,composite.geometry)!==c.id)return fail('nonreciprocal-seam:'+c.id+':'+dir);
    seams.push({baseHex:c.id,extensionHex:neighborId,baseSide:dir,extensionSide:reverse});
   }
  }
  const coast=new Set();for(const h of composite.authoredShoreHexsides||[]){
   if(!byId.has(h.cellId)||!T.DIRS.includes(h.dir))return fail('invalid-shore-hexside');
   const key=h.cellId+':'+h.dir;
   if(coast.has(key))return fail('duplicate-shore-hexside:'+key);
   coast.add(key);
  }
  const sorted=seams.sort((a,b)=>a.baseHex.localeCompare(b.baseHex)||a.extensionHex.localeCompare(b.extensionHex));
  const blockedSeams=sorted.filter(e=>coast.has(e.baseHex+':'+e.baseSide)||coast.has(e.extensionHex+':'+e.extensionSide));
  return {metadata:{baseMapId:base.id,extensionMapId:extension.id,compositeMapId:composite.id,
    baseHexes:baseCount,extensionHexes:extensionCount,totalHexes:byId.size,seamPairs:sorted.length,
    blockedByAuthoredShore:blockedSeams.length,authoredShoreEntries:coast.size,
    railCenterConnections:composite.hexCenterRailConnections?.length||0,
    gameplayCertified:false,graphPurpose:'geometry-audit-only'},seams:sorted,blockedSeams};
 }
 // Read-only edge classification. Physical adjacency is never proof of
 // traversability. Authored Coast hexsides are IMPASSABLE regardless of both
 // neighbors' whole-cell terrain values; Sea is also impassable. The seven
 // land-to-land Coast records are barriers, not decorative exceptions. This is
 // still a diagnostic rather than an executable movement authorization.
 function movementCandidate(base,extension,composite){
  const review=audit(base,extension,composite);
  const byId=new Map(composite.cells.map(c=>[c.id,c]));
  const shore=new Set((composite.authoredShoreHexsides||[]).map(h=>h.cellId+':'+h.dir));
  const fromBase=new Set(base.cells.map(c=>c.id));
  const seen=new Set(),edges=[],shoreKinds={landToSea:0,landToLand:0,exterior:0,seaToSea:0};
  const kinds=x=>(x||[]).map(f=>f.kind).sort();
  for(const h of composite.authoredShoreHexsides||[]){
   const cell=byId.get(h.cellId),other=byId.get(T.neighbor(cell,h.dir,composite.geometry));
   const key=!other?'exterior':cell.terrain==='sea'&&other.terrain==='sea'?'seaToSea':
    cell.terrain==='sea'||other.terrain==='sea'?'landToSea':'landToLand';
   shoreKinds[key]++;
  }
  for(const cell of composite.cells){
   for(const dir of T.DIRS){
    const targetId=T.neighbor(cell,dir,composite.geometry),other=byId.get(targetId);
    if(!other)continue;
    const id=[cell.id,targetId].sort().join(':');if(seen.has(id))continue;seen.add(id);
    const opp=T.OPP[dir];
    if(T.neighbor(other,opp,composite.geometry)!==cell.id)return fail('nonreciprocal-edge:'+id);
    const aKinds=kinds(cell.tileEdges?.[dir]),bKinds=kinds(other.tileEdges?.[opp]);
    if(JSON.stringify(aKinds)!==JSON.stringify(bKinds))return fail('nonreciprocal-feature:'+id);
    if(aKinds.some(k=>!['rail','river','majorRiver'].includes(k)))return fail('unknown-feature:'+id);
    const sea=cell.terrain==='sea'||other.terrain==='sea';
    const shoreAnnotated=shore.has(cell.id+':'+dir)||shore.has(targetId+':'+opp);
    const blockedBySea=sea,blockedByCoast=shoreAnnotated;
    edges.push({a:cell.id,b:targetId,aSide:dir,bSide:opp,
      aTerrain:cell.terrain,bTerrain:other.terrain,
      sourceKinds:aKinds,seaAdjacent:sea,shoreAnnotated,
      landLandShoreAnnotation:shoreAnnotated&&!sea,
      blockedBySea,blockedByCoast,impassableForGround:blockedBySea||blockedByCoast,
      compositeSeam:fromBase.has(cell.id)!==fromBase.has(targetId),
      status:'visual-topology-candidate-not-authorized'});
   }
  }
  edges.sort((x,y)=>x.a.localeCompare(y.a)||x.b.localeCompare(y.b));
  const land=edges.filter(e=>!e.seaAdjacent),sea=edges.filter(e=>e.seaAdjacent);
  const counters={physicalEdges:edges.length,landToLandEdges:land.length,seaRelatedEdges:sea.length,
   seamEdges:edges.filter(e=>e.compositeSeam).length,
   sourceRiverSides:edges.filter(e=>e.sourceKinds.includes('river')).length,
   sourceMajorRiverSides:edges.filter(e=>e.sourceKinds.includes('majorRiver')).length,
   sourceRailSides:edges.filter(e=>e.sourceKinds.includes('rail')).length,
   landLandShoreEdges:edges.filter(e=>e.landLandShoreAnnotation).length,
   blockedByCoastEdges:edges.filter(e=>e.blockedByCoast).length,
   blockedBySeaEdges:edges.filter(e=>e.blockedBySea).length,
   impassableForGroundEdges:edges.filter(e=>e.impassableForGround).length,
   notExcludedBySeaOrCoastEdges:edges.filter(e=>!e.impassableForGround).length,
   authoredShoreEntries:Object.values(shoreKinds).reduce((a,b)=>a+b,0)};
  if(counters.seamEdges!==review.metadata.seamPairs)return fail('seam-audit-disagreement');
  return {metadata:{...review.metadata,...counters,shoreKinds,
      gameplayCertified:false,graphPurpose:'read-only-movement-candidate; not a rules graph'},edges};
 }
 return Object.freeze({audit,movementCandidate});
});
