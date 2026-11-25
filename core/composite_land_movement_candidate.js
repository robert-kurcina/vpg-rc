/* Source-pinned land routing preflight for an appended historical map.
 * Pure diagnostic adapter. This does NOT register a production movement graph.
 */
'use strict';
const Source=require('./composite_graph_audit');
const Rail=require('./composite_rail_reconciliation');
const City=require('./composite_city_victory_candidate');
const pair=(a,b)=>[a,b].sort().join(':');
const fail=x=>{throw Error('composite-land-preflight: '+x);};
function build(base,extension,composite,railLedger,cityLedger){
 const audit=Source.movementCandidate(base,extension,composite);
 const reviewed=Rail.reconcile(composite,railLedger);
 const cities=City.build(composite,cityLedger);
 const railKeys=new Set(railLedger.links.map(x=>pair(x.a,x.b)));
 if(audit.metadata.physicalEdges!==railLedger.physicalEdgeCount||
  cities.metadata.cityCount!==20||
  new Set(reviewed.cells.map(c=>c.id)).size!==audit.metadata.totalHexes)fail('source-topology-disagreement');
 const cByHex=new Map(cities.metadata.cities.map(c=>[c.hex,c]));
 const cells={};let sea=0,open=0,forest=0,swamp=0,city=0,majorCity=0;
 for(const c of composite.cells){
  if(!['open','forest','swamp','sea'].includes(c.terrain))fail('unclassified-source-terrain:'+c.id);
  const feature=cByHex.get(c.id),terrain=feature?.kind||c.terrain;
  const verified=c.terrain!=='sea';
  // Carry only explicit composite country evidence. Unreviewed hexes stay
  // unknown; this is a diagnostic board, never production authorization.
  cells[c.id]={terrain,verified,rail:false,sourceTerrainStatus:c.terrainStatus,
   ...(c.sourceTerritory?{sourceTerritory:c.sourceTerritory,
    territoryEvidence:c.territoryEvidence,territorySource:c.territorySource}:{})};
  if(terrain==='sea')sea++;else if(terrain==='open')open++;else if(terrain==='forest')forest++;
  else if(terrain==='swamp')swamp++;else if(terrain==='city')city++;else if(terrain==='major-city')majorCity++;
 }
 const edges=[];let seaOrCoast=0,railCount=0,ordinaryRiver=0,majorRiver=0;
 for(const e of audit.edges){
  const rail=railKeys.has(pair(e.a,e.b)),river=e.sourceKinds.includes('river'),major=e.sourceKinds.includes('majorRiver');
  if(rail&&e.impassableForGround)fail('rail-crosses-sea-or-coast:'+e.a+':'+e.b);
  if(major&&river)fail('mixed-river-types:'+e.a+':'+e.b);
  if(rail){railCount++;cells[e.a].rail=true;cells[e.b].rail=true;}
  if(river)ordinaryRiver++;if(major)majorRiver++;if(e.impassableForGround)seaOrCoast++;
  edges.push({a:e.a,b:e.b,verified:true,rail,river,majorRiver:major,
   impassable:e.impassableForGround,allSea:e.seaAdjacent,lake:e.shoreAnnotated,
   source:'source-SVG-derived-diagnostic-not-gameplay-authorized'});
 }
 if(edges.length!==714||railCount!==117||seaOrCoast!==100||
  ordinaryRiver!==105||majorRiver!==22||sea!==31||city!==18||majorCity!==2||
  edges.filter(e=>!e.impassable).length!==614)fail('unexpected-source-coverage');
 const board={cells,edges,metadata:{status:'diagnostic-not-gameplay-authorized',mapId:composite.id,
  hexes:composite.cells.length,physicalEdges:edges.length,sourceRailEdges:railCount,
  sourceOrdinaryRiverEdges:ordinaryRiver,sourceMajorRiverEdges:majorRiver,
  impassableSeaOrCoast:seaOrCoast,landCandidates:614,
  terrain:{sea,open,forest,swamp,city,majorCity},
  cityCount:cities.metadata.cityCount,
  noRulesAuthorization:true}};
 return {board,cityVictory:cities,sourceRailReconciliation:reviewed.railwayReconciliation};
}
module.exports=Object.freeze({build});
