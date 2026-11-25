/* Independent, read-only reconciliation of a source-reviewed base map and its
 * appended composite map. Same shared graph components; NEVER grants movement
 * legality or a rules-certified reinforcement/communication callback.
 *
 * A visual rail feature and a source-traced rail route are separate records.
 * A disagreement is reported, not silently "fixed" or promoted to an edge.
 */
'use strict';
const GameGraph=require('./map_movement_graph');
const Land=require('./composite_land_movement_candidate');
const Evidence=require('../maps/movement-configs/odessa-inherited-edge-comparison-v529.json');
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const fail=s=>{throw Error('odessa-inherited-edge-reconciliation: '+s);};
const key=(a,b)=>[a,b].sort().join(':');
const FIELDS=['rail','river','majorRiver','impassable'];
const integer=n=>Number.isInteger(n)&&n>=0;
function reconcile({base,extension,composite,basePolicy,railLedger,cityLedger,expected=Evidence}){
 if(!expected||expected.schemaVersion!==1||expected.status!=='source-disagreement-diagnostic-only'||
  expected.originalKievPolicy!=='kiev-source-reviewed-candidate-v435'||
  expected.combinedRailSource!=='odessa-source-route-rail-ledger-v496'||
  !Array.isArray(expected.unresolvedSourceDisagreements)||
  !expected.authorization||Object.values(expected.authorization).some(v=>v!==false))fail('invalid-review-policy');
 const originalHashes=expected.sourceRevisionProvenance;
 if(!originalHashes||originalHashes.originalV496HashCurrent!==false||
  originalHashes.railRoutesRecomputedAgainstCurrentSource!==true||
  railLedger?.sourceHashes?.['maps/odessa-extension.json']!==originalHashes.originalRailLedgerExtensionJsonSHA256||
  railLedger?.sourceHashes?.['maps/source/user-svg/kiev-odessa-main.svg']!==originalHashes.originalAndCurrentCompositeSvgSHA256||
  crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../maps/odessa-extension.json'))).digest('hex')!==originalHashes.currentExtensionJsonSHA256||
  crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../maps/source/user-svg/kiev-odessa-main.svg'))).digest('hex')!==originalHashes.originalAndCurrentCompositeSvgSHA256)
  fail('active-source-revision-not-pinned');
 if(!basePolicy||basePolicy.authorizationStatus!=='diagnostic-only-not-gameplay'||
  basePolicy.sourceEvidenceMode!=='definitive-city-layer-v1'||
  base?.id!==expectedBaseId()||composite?.id!==railLedger?.mapId)
  fail('source-identity-or-authority-disagreement');
 // Each source graph validates its own independently stored evidence and SHA.
 const originalPolicy=GameGraph.checkPolicy(base);
 if(originalPolicy.edgeMode!=='source-reviewed-v1'||
  originalPolicy.authorizationScope!=='source-svg-geometry-for-experimental-gameplay'||
  originalPolicy.edgeLedgerSHA256!==basePolicy.edgeLedgerSHA256||
  originalPolicy.sourceEvidenceMode!==basePolicy.sourceEvidenceMode)
  fail('original-production-policy-does-not-match-candidate');
 const prior=GameGraph.build(base);
 const {board}=Land.build(base,extension,composite,railLedger,cityLedger);
 const baseIds=new Set(base.cells.map(c=>c.id));
 if(baseIds.size!==base.cells.length||baseIds.size!==expected.originalKievHexes||
  prior.edges.length!==expected.originalKievEdges||
  Object.keys(board.cells).length!==expected.combinedHexes||
  board.edges.length!==expected.combinedEdges||
  board.metadata.status!=='diagnostic-not-gameplay-authorized'||
  board.metadata.noRulesAuthorization!==true)fail('unexpected-source-graph-size');
 for(const id of baseIds){
  const b=board.cells[id],a=prior.cells[id];
  if(!a||!b||a.terrain!==b.terrain||a.verified!==true||b.verified!==true)
   fail('inherited-terrain-disagreement:'+id);
 }
 const original=new Map(prior.edges.map(e=>[key(e.a,e.b),e]));
 const compositeMap=new Map();const partitions={inherited:[],seam:[],extension:[]};
 const counts={inherited:0,seam:0,extension:0,inheritedRails:0,compositeRails:0,
  traversable:0,impassable:0,inheritedRiver:0,inheritedMajorRiver:0};
 for(const e of board.edges){
  if(!e||!e.verified||!FIELDS.every(f=>typeof e[f]==='boolean'))fail('invalid-composite-edge');
  const k=key(e.a,e.b);
  if(compositeMap.has(k))fail('duplicate-composite-edge:'+k);
  compositeMap.set(k,e);
  const n=+baseIds.has(e.a) + +baseIds.has(e.b);
  const part=n===2?'inherited':n===1?'seam':'extension';
  partitions[part].push(k);counts[part]++;
  counts[e.impassable?'impassable':'traversable']++;
  if(e.rail)counts.compositeRails++;
  if(part==='inherited'){
   if(e.rail)counts.inheritedRails++;
   if(e.river)counts.inheritedRiver++;
   if(e.majorRiver)counts.inheritedMajorRiver++;
  }
 }
 if(counts.inherited!==expected.inheritedEdges||counts.seam!==expected.seamEdges||
  counts.extension!==expected.extensionInternalEdges||
  counts.traversable!==expected.candidateTraversableEdges||
  counts.impassable!==expected.candidateImpassableEdges||
  counts.compositeRails!==railLedger.railCount)fail('composite-partition-disagreement');
 const conflicts=[];let matching=0;
 for(const [id,e] of original){
  const combined=compositeMap.get(id);
  if(!combined||!baseIds.has(combined.a)||!baseIds.has(combined.b))
   fail('missing-inherited-edge:'+id);
  let changed=false;
  for(const attribute of FIELDS){
   if(e[attribute]===combined[attribute])continue;
   changed=true;
   conflicts.push({edge:id,attribute,originalKiev:e[attribute],compositeRouteLedger:combined[attribute]});
  }
  if(!changed)matching++;
 }
 if(matching!==expected.inheritedFeatureAgreements||
  JSON.stringify(conflicts)!==JSON.stringify(expected.unresolvedSourceDisagreements.map(
   ({edge,attribute,originalKiev,compositeRouteLedger})=>({edge,attribute,originalKiev,compositeRouteLedger}))))
  fail('inherited-edge-conflict-ledger-drift');
 for(const [name,count] of Object.entries(counts))if(!integer(count))fail('bad-count:'+name);
 return Object.freeze({status:'source-comparison-diagnostic-only',
  certifiedForMovement:false,certifiedForReinforcements:false,
  certifiedForReplacements:false,certifiedForVictory:false,
  originalKiev:{hexes:baseIds.size,edges:original.size,rails:prior.metadata.railEdges,
   rivers:prior.metadata.riverEdges,majorRivers:prior.metadata.majorRiverEdges},
  composite:{hexes:expected.combinedHexes,edges:board.edges.length,
   traversableCandidates:counts.traversable,impassableCandidates:counts.impassable,
   rails:counts.compositeRails},
  comparison:{inheritedEdges:counts.inherited,featureAgreements:matching,
   unresolvedDisagreements:conflicts,
   inheritedRiverSides:counts.inheritedRiver,
   inheritedMajorRiverSides:counts.inheritedMajorRiver,
   inheritedRailSides:counts.inheritedRails,
   seamEdges:counts.seam,extensionInternalEdges:counts.extension,
   traversableSeamEdges:partitions.seam.filter(id=>!compositeMap.get(id).impassable).length,
   traversableExtensionEdges:partitions.extension.filter(id=>!compositeMap.get(id).impassable).length},
  sourceRevision:{v496ExtensionDigestStale:true,activeExtensionDigestPinned:true,activeSourceSvgDigestPinned:true,
   activeRouteLinkListRecomputed:true},
  authorization:{...expected.authorization}});
}
// The base identifier is not a configurable arbitrary string; it is already
// source-pinned in the reviewed Kiev policy's fingerprint and city evidence.
function expectedBaseId(){return 'kiev-native-draft-v231';}
module.exports=Object.freeze({reconcile});
