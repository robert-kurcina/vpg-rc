/* Read-only, universal safety audit for re-keying a numbered hex map.
 * No source fields, renderer state, or gameplay references are mutated.
 * An identity migration is safe only if every numbered coordinate is valid
 * and geometric adjacency survives re-keying without exception.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.HexCoordinateMigrationAudit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const T=(typeof HexTerrainTiles!=='undefined')?HexTerrainTiles:(typeof require==='function'?require('./terrain_tiles'):null);
function pair(a,b){return [a,b].sort().join('~')}
function adjacency(cells,geo){const byId=new Map(cells.map(c=>[c.id,c]));const edges=new Set();for(const c of cells)for(const d of T.DIRS){const n=T.neighbor(c,d,geo);if(byId.has(n))edges.add(pair(c.id,n))}return edges}
function analyze(board,formatNumber,{candidateParityDown='even'}={}){
 if(!T||!Array.isArray(board?.cells)||typeof formatNumber!=='function')throw Error('Board, terrain engine, and source number resolver required');
 if(!['even','odd'].includes(candidateParityDown))throw Error('Invalid candidate parity');
 const byId=new Map(board.cells.map(c=>[c.id,c]));if(byId.size!==board.cells.length)throw Error('Duplicate source cell');
 const assignments=[],invalid=[],dupes=[],byNew=new Map();
 for(const c of board.cells){
  const proposed=String(formatNumber(c));
  if(!/^\d{4}$/.test(proposed))throw Error('Proposed identifier is not a four-digit coordinate: '+c.id);
  const col=Number(proposed.slice(0,2)),row=Number(proposed.slice(2,4));
  if(byNew.has(proposed))dupes.push({id:proposed,originals:[byNew.get(proposed),c.id]});
  byNew.set(proposed,c.id);
  const a={from:c.id,to:proposed,numbered:col>0&&row>0,terrain:c.terrain,center:c.pixelCenter};
  assignments.push(a);
  if(!a.numbered)invalid.push({from:c.id,to:proposed,terrain:c.terrain,hasDeployment:(c.tileMarkers||[]).some(m=>['cross','star'].includes(m.kind))});
 }
 const remap=new Map(assignments.map(a=>[a.from,a.to]));
 const originalAdjacency=adjacency(board.cells,board.geometry);
 const expected=new Set([...originalAdjacency].map(key=>{const [a,b]=key.split('~');return pair(remap.get(a),remap.get(b))}));
 const candidateCells=board.cells.map(c=>{const to=remap.get(c.id);return {...c,id:to,column:Number(to.slice(0,2)),row:Number(to.slice(2,4))}});
 const found=adjacency(candidateCells,{...board.geometry,columnParityDown:candidateParityDown});
 const missing=[...expected].filter(x=>!found.has(x)).sort();
 const extra=[...found].filter(x=>!expected.has(x)).sort();
 const markers=assignments.flatMap(a=>(byId.get(a.from).tileMarkers||[]).filter(m=>m.kind==='cross'||m.kind==='star').map(m=>({kind:m.kind,faction:m.faction,from:a.from,proposed:a.to})));
 const blockers=[];
 if(dupes.length)blockers.push('duplicate-proposed-ids');
 if(invalid.length)blockers.push('unregistered-boundary-cells');
 if(missing.length||extra.length)blockers.push('adjacency-changes');
 return {schemaVersion:1,sourceMap:board.id,physicalCells:board.cells.length,numberedCandidateCells:assignments.length-invalid.length,unnumberedCells:invalid,
  duplicateIds:dupes,originalEdges:originalAdjacency.size,candidateEdges:found.size,missingEdges:missing,addedEdges:extra,
  markerAssignments:markers,expectedEvenColumnHigh: candidateParityDown==='even',
  readyForAuthoritativeRekey:blockers.length===0,blockers,
  unchangedContract:'Read-only. No map JSON, graph, counter, SVG or runtime state altered.'};
}
return {analyze};
});
