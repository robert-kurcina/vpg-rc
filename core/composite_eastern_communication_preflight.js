/* Kiev–Odessa eastern-edge path qualification, diagnostic only.
 * Objective: Kiev §12: exclude enemy-occupied/EZOC hexes AFTER origin;
 * Objective: Odessa §5: isolation from the RED eastern boundary.
 * Source border is a snapped VISUAL trace, not yet a rules-certified entry list.
 * No boolean communication callback is exported for live victory adjudication.
 */
'use strict';
const T=require('./terrain_tiles');
const Border=require('./composite_entry_border_reconciliation');
const BOUNDARY_EVIDENCE=require('../maps/movement-configs/odessa-entry-border-geometry-v527.json');
const fail=x=>{throw Error('odessa-east-communication: '+x)};
const pair=(a,b)=>[a,b].sort().join(':');
function create({map,board,edgeSource='legacy-v526'}){
 if(!['legacy-v526','active-composite-v527'].includes(edgeSource))fail('invalid-boundary-source');
 if(!map?.cells||map.cells.length!==261||!map?.geometry||
    board?.metadata?.mapId!==map.id||board?.metadata?.noRulesAuthorization!==true||
    board?.metadata?.hexes!==261||board?.metadata?.physicalEdges!==714||
    board?.metadata?.landCandidates!==614||!Array.isArray(board.edges)||board.edges.length!==714)
  fail('composite-source-preflight-required');
 const visual=map.entryBoundarySelections;
 let boundaries;
 try{boundaries=Border.reconcile(map,BOUNDARY_EVIDENCE);}catch(err){
  if(/source-side-ledger-mismatch|source-trace-path-mismatch/.test(String(err.message)))fail('invalid-soviet-border-side');
  throw err;
 }
 const cells=new Map(map.cells.map(c=>[c.id,c]));
 const adjacency=new Map([...cells.keys()].map(id=>[id,[]]));
 // ZOC reaches all six surrounding hexes (§7), including across a land/land
 // Coast barrier. Routing, by contrast, may use only traversable edges.
 const zocAdjacency=new Map([...cells.keys()].map(id=>[id,[]]));
 const seen=new Set();
 for(const edge of board.edges){
  if(!cells.has(edge.a)||!cells.has(edge.b)||seen.has(pair(edge.a,edge.b))||
     !edge.verified||typeof edge.impassable!=='boolean')fail('invalid-candidate-land-edge');
  const c=cells.get(edge.a),d=cells.get(edge.b);
  if(!T.DIRS.some(dir=>T.neighbor(c,dir,map.geometry)===d.id))fail('edge-not-adjacent');
  seen.add(pair(edge.a,edge.b));
  if(cells.get(edge.a).terrain!=='sea'&&cells.get(edge.b).terrain!=='sea'){
   zocAdjacency.get(edge.a).push(edge.b);zocAdjacency.get(edge.b).push(edge.a);
  }
  if(edge.impassable||edge.allSea||edge.lake)continue;
  adjacency.get(edge.a).push(edge.b);adjacency.get(edge.b).push(edge.a);
 }
 for(const ns of adjacency.values())ns.sort();
 for(const ns of zocAdjacency.values())ns.sort();
 const chosen=edgeSource==='active-composite-v527'?boundaries.activePaths:boundaries.paths;
 const exterior=chosen.soviet.exterior;
 const interior=chosen.soviet.internal.map(e=>({hex:e.hex,side:e.dir,adjacentHex:e.adjacentHex}));
 const eligibleHexes=chosen.soviet.exteriorCandidateHexes;
 if(eligibleHexes.length===0)fail('no-exterior-soviet-hexes');
 const entry=new Set(eligibleHexes);
 const metadata=Object.freeze({status:'candidate-only-not-gameplay-authorized',
  sourceTraceStatus:visual.status,sourceTraceSvgSha256:visual.sourceSvgSha256,
  edgeSource,activeCompositeSvgSha256:boundaries.activeSourceSvgSha256,
  markedSovietSides:chosen.soviet.totalMarkedSides,exteriorSideCount:exterior.length,
  internalMarkCount:interior.length,exteriorCandidateHexes:eligibleHexes,
  internalMarkedSides:interior,
  germanMarkedSides:chosen.german.totalMarkedSides,
  germanExteriorSideCount:chosen.german.exterior.length,
  germanInternalMarkedSides:chosen.german.internal,
  borderEvidenceStatus:boundaries.status,certifiedForVictory:false,certifiedForReinforcements:false});
 const validOwner=new Set(['soviet','german']);
 function threats(units){
  if(!units||typeof units!=='object'||Array.isArray(units))fail('invalid-unit-ledger');
  const enemyOccupied=new Set(),enemyZoc=new Set();
  for(const [id,u] of Object.entries(units)){
   if(!u||!validOwner.has(u.owner)||typeof u.hex!=='string'||
      !cells.has(u.hex)||cells.get(u.hex).terrain==='sea')fail('unverified-unit-state:'+id);
   if(u.eliminated===true||u.strengthStatus==='eliminated'||u.strengthStatus==='dead'||
      u.marker===true||['air-support','fleet','support'].includes(u.class))continue;
   if(u.owner!=='german')continue;
   enemyOccupied.add(u.hex);
   for(const adjacent of zocAdjacency.get(u.hex))enemyZoc.add(adjacent);
  }
  return {enemyOccupied,enemyZoc};
 }
 // Diagnostic-only admission screening. Unlike a communication path's origin,
 // a NEW reinforcement may not be placed directly into an enemy ZOC. Do not
 // reuse the path-origin exemption when inspecting entry eligibility.
 function candidateEntries({units={}}={}){
  const {enemyOccupied,enemyZoc}=threats(units);
  const sides=exterior.map(e=>Object.freeze({hex:e.hex,dir:e.dir,
   candidateAccessible:!enemyOccupied.has(e.hex)&&!enemyZoc.has(e.hex),
   reason:enemyOccupied.has(e.hex)?'enemy-occupied':enemyZoc.has(e.hex)?'enemy-zoc':'candidate-open'}));
  const candidateHexes=eligibleHexes.filter(hex=>!enemyOccupied.has(hex)&&!enemyZoc.has(hex));
  return Object.freeze({status:'candidate-only-not-gameplay-authorized',
   certifiedForReinforcements:false,source:edgeSource,sides:Object.freeze(sides),
   candidateHexes:Object.freeze(candidateHexes),
   blockedHexes:Object.freeze(eligibleHexes.filter(hex=>!candidateHexes.includes(hex))),
   sourceExteriorSideCount:exterior.length});
 }
 function trace(hex,{units={}}={}){
  if(!cells.has(hex)||cells.get(hex).terrain==='sea')fail('invalid-origin-hex');
  const {enemyOccupied,enemyZoc}=threats(units);
  if(enemyOccupied.has(hex))fail('enemy-occupied-origin');
  const previous=new Map([[hex,null]]),todo=[hex];let end=null;
  for(let i=0;i<todo.length;i++){
   const current=todo[i];
   if(entry.has(current)){end=current;break;}
   for(const next of adjacency.get(current)){
    if(previous.has(next)||enemyOccupied.has(next)||enemyZoc.has(next))continue;
    previous.set(next,current);todo.push(next);
   }
  }
  let route=[];
  if(end){let p=end;while(p!==null){route.push(p);p=previous.get(p);}route.reverse();}
  return Object.freeze({origin:hex,reachable:end!==null,
   path:route,exitHex:end,exploredHexCount:previous.size,
   enemyZocHexes:[...enemyZoc].sort(),
   status:'candidate-only-not-gameplay-authorized',certifiedForVictory:false});
 }
 function allCities({units={}}={}){
  return Object.fromEntries(map.cells.filter(c=>c.city?.name).map(c=>[c.city.name,trace(c.id,{units})]));
 }
 return Object.freeze({metadata,trace,allCities,candidateEntries});
}
// New v527 callers should select createComposite. The older create() remains an
// explicit legacy diagnostic to preserve reproducible checkpoint-292 evidence.
const createComposite=({map,board})=>create({map,board,edgeSource:'active-composite-v527'});
module.exports=Object.freeze({create,createComposite});
