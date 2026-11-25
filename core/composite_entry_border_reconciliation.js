/* Source-pinned, read-only entry boundary topology audit.
 * A geometric exterior side is a candidate source mark, NOT a certified legal
 * reinforcement side or communication endpoint. Never promote from this layer.
 */
'use strict';
const T=require('./terrain_tiles');
const fail=s=>{throw Error('composite-entry-border: '+s);};
const key=e=>e.cellId+':'+e.dir;
function reconcile(map,evidence){
 if(!map?.geometry||!Array.isArray(map.cells)||map.cells.length!==261||!map.id||
    evidence?.schemaVersion!==1||evidence.mapId!==map.id||
    evidence.certification!=='GEOMETRIC_TOPOLOGY_ONLY_NOT_REINFORCEMENT_OR_VICTORY_AUTHORITY')
  fail('unverified-composite-board');
 const trace=map.entryBoundarySelections;
 if(trace?.status!=='SOURCE_GUIDED_VISUAL_GEOMETRY_NOT_RULE_CERTIFIED'||
    evidence.sourceStatus!==trace.status||trace.sourceSvgSha256!==evidence.sourceSvgSha256||
    !Array.isArray(trace.paths)||trace.paths.length!==2||!Array.isArray(evidence.paths)||evidence.paths.length!==2)
  fail('source-evidence-disagreement');
 const cells=new Map(map.cells.map(c=>[c.id,c]));
 if(cells.size!==261||map.cells.some(c=>!c.pixelCenter||!T.DIRS.length||!c.terrain))fail('invalid-composite-cells');
 const names=new Set();const paths={};
 for(let i=0;i<trace.paths.length;i++){
  const p=trace.paths[i],record=evidence.paths[i];
  if(!p||!record||!['soviet','german'].includes(p.side)||names.has(p.side)||
     record.side!==p.side||record.sourceSvgId!==p.sourceSvgId||
     record.sourceStatus!==p.status||!Array.isArray(p.edges)||
     !Array.isArray(record.orderedSides)||record.orderedSides.length!==p.edges.length)
   fail('source-trace-path-mismatch');
  names.add(p.side);
  const seen=new Set(),exterior=[],internal=[];
  for(let j=0;j<p.edges.length;j++){
   const side=p.edges[j],pin=record.orderedSides[j];
   if(!side||!T.DIRS.includes(side.dir)||!cells.has(side.cellId)||
      cells.get(side.cellId).terrain==='sea'||seen.has(key(side))||
      !pin||pin.hex!==side.cellId||pin.dir!==side.dir)
    fail('source-side-ledger-mismatch');
   seen.add(key(side));
   const adjacent=T.neighbor(cells.get(side.cellId),side.dir,map.geometry);
   const isInternal=cells.has(adjacent);
   if(pin.topology!==(isInternal?'internal':'exterior')||
      (isInternal&&pin.adjacentHex!==adjacent)||
      (!isInternal&&Object.hasOwn(pin,'adjacentHex')))
    fail('source-side-topology-drift');
   const item=Object.freeze({hex:side.cellId,dir:side.dir, ...(isInternal?{adjacentHex:adjacent}:{})});
   (isInternal?internal:exterior).push(item);
  }
  paths[p.side]=Object.freeze({side:p.side,sourceSvgId:p.sourceSvgId,
   exterior:Object.freeze(exterior),internal:Object.freeze(internal),
   exteriorCandidateHexes:Object.freeze([...new Set(exterior.map(x=>x.hex))].sort()),
   totalMarkedSides:p.edges.length});
 }
 if(names.size!==2||!names.has('soviet')||!names.has('german'))fail('missing-faction-border');
 // The source-authoritative composite record is distinct from the older Kiev
 // trace above. The extension adds a real SOUTHERN eastern edge; ignoring it
 // would incorrectly constrain Odessa's reinforcement and communication audit.
 const active=evidence.activeComposite;
 if(map.authoritativeSourceGeometry?.sha256!==evidence.activeSourceSvgSha256||
    active?.status!=='USER_SVG_REGISTERED_COMPOSITE_EXTERIOR_GEOMETRY_NO_RULES_AUTHORITY'||
    !Array.isArray(map.compositeEntryEdges)||!Array.isArray(active.orderedSides)||
    active.orderedSides.length!==map.compositeEntryEdges.length)
  fail('active-composite-source-disagreement');
 const activePaths={soviet:[],german:[]},activeSeen=new Set();
 for(let i=0;i<map.compositeEntryEdges.length;i++){
  const raw=map.compositeEntryEdges[i],pin=active.orderedSides[i];
  if(!raw||!pin||!['soviet','german'].includes(raw.side)||!cells.has(raw.cellId)||
     !T.DIRS.includes(raw.dir)||raw.side!==pin.side||raw.cellId!==pin.hex||
     raw.dir!==pin.dir||raw.sourceSvgId!==pin.sourceSvgId||
     raw.offsetPx!==pin.offsetPx||activeSeen.has(key(raw)))
   fail('active-composite-side-ledger-drift');
  activeSeen.add(key(raw));
  if(cells.get(raw.cellId).terrain==='sea'||cells.has(T.neighbor(cells.get(raw.cellId),raw.dir,map.geometry)))
   fail('active-composite-side-not-exterior');
  activePaths[raw.side].push(Object.freeze({hex:raw.cellId,dir:raw.dir,sourceSvgId:raw.sourceSvgId}));
 }
 const activeOutput=Object.fromEntries(['soviet','german'].map(side=>[side,Object.freeze({
  side,exterior:Object.freeze(activePaths[side]),internal:Object.freeze([]),
  exteriorCandidateHexes:Object.freeze([...new Set(activePaths[side].map(x=>x.hex))].sort()),
  totalMarkedSides:activePaths[side].length
 })]));
 return Object.freeze({status:'geometry-reconciled-candidate-only',
   sourceTraceStatus:trace.status,sourceTraceSvgSha256:trace.sourceSvgSha256,
   certifiedForReinforcements:false,certifiedForVictory:false,
   paths:Object.freeze(paths),
   activePaths:Object.freeze(activeOutput),
   activeSourceSvgSha256:evidence.activeSourceSvgSha256});
}
module.exports=Object.freeze({reconcile});
