'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const C=require('../maps/composer'),A=require('../core/composite_graph_audit'),T=require('../core/terrain_tiles');
const G=require('../core/map_movement_graph');
const b=require('../maps/kiev.json'),x=require('../maps/odessa-extension.json');
const clone=v=>JSON.parse(JSON.stringify(v));
const map=C.compose(b,x),r=A.movementCandidate(b,x,map);
const doc=require('../rules/audit/odessa-composite-movement-candidate-v493.json');
let tests=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);tests++};const ok=(v,m)=>{assert.ok(v,m);tests++};
for(const [field,expected] of Object.entries({baseHexes:165,extensionHexes:96,totalHexes:261,
 physicalEdges:714,landToLandEdges:621,seaRelatedEdges:93,seamEdges:24,
 sourceRailSides:42,sourceRiverSides:105,sourceMajorRiverSides:22,
 authoredShoreEntries:32,landLandShoreEdges:7,gameplayCertified:false}))eq(r.metadata[field],expected,field);
eq(r.metadata.shoreKinds,{landToSea:24,landToLand:7,exterior:1,seaToSea:0},'shore classification');
eq(r.metadata.railCenterConnections,0,'zero inferred rail center connections');
eq(doc.metadata,r.metadata,'persisted audit metadata exact');eq(doc.edges,r.edges,'all 714 source-derived edges exact');
for(const edge of r.edges){ok(!edge.compositeSeam||!edge.seaAdjacent,'Kiev–Odessa seam is land / '+edge.a+':'+edge.b);ok(edge.status==='visual-topology-candidate-not-authorized','edge not gameplay-certified '+edge.a+':'+edge.b);eq(edge.impassableForGround,edge.seaAdjacent||edge.shoreAnnotated,'Sea or Coast must be impassable '+edge.a+':'+edge.b);if(edge.landLandShoreAnnotation){ok(!edge.seaAdjacent,'land-land coast not incorrectly called Sea');ok(edge.blockedByCoast&&edge.impassableForGround,'land-land Coast barrier impassable');}}
eq(doc.shore.filter(s=>s.kind==='land-land').length,7,'seven coastline barriers between land centers');
for(const h of doc.shore)ok(h.impassableForGround===true&&/^path\d+$/.test(h.sourceSvgId),'source Coast SVG segments all block ground crossings '+h.hex+':'+h.side);
for(const [k,v] of Object.entries({blockedByCoastEdges:31,blockedBySeaEdges:93,impassableForGroundEdges:100,notExcludedBySeaOrCoastEdges:614}))eq(r.metadata[k],v,k);
eq(doc.markers.filter(m=>m.kind==='seam').length,24,'24 seam review markers');
eq(doc.markers.filter(m=>m.kind==='shore-land-land').length,7,'7 shoreline review markers');
const sha=dat=>crypto.createHash('sha256').update(dat).digest('hex');
// Audit v493 source bytes stay archived. The one active source amendment is
// independently pinned by the newer railway ledger and checked for scope.
const activeLedger=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
for(const [file,meta] of Object.entries(doc.sources)){
 const source=fs.readFileSync(require('node:path').join(__dirname,'..',file)),sum=sha(source);
 if(file==='maps/odessa-extension.json'){
  eq(meta.sha256,'8a5d027bb6e9b40e4495cf00c70f55a8f9b83bbda5c7e8a4bb7684a55462b3e6','v493 source digest preserved');
  const evidence=require('../maps/movement-configs/odessa-inherited-edge-comparison-v529.json').sourceRevisionProvenance;
  eq(activeLedger.sourceHashes[file],evidence.originalRailLedgerExtensionJsonSHA256,'historical v496 extension SHA retained');
  eq(sum,evidence.currentExtensionJsonSHA256,'exact active Odessa extension revision pinned separately');
  eq(x.v497PrintedCityNameCorrection.correctLabel,'Brăila','expected city name correction only');
 }else if(file==='exports/kiev-odessa.png'){
  eq(meta.sha256,'68c126115039d520824e505ba17afb61cd2aefbcc7945db4a94ecf8d24ac0a35','v493 printed-label render source retained');
  const current=require('../exports/manifest.json').find(e=>e.id==='kiev-odessa');
  eq(sum,current.pngSHA256,'corrected engine map export pinned by current manifest');
 }else {eq(source.length,meta.bytes,'source length '+file);eq(sum,meta.sha256,'source digest '+file);}
}
assert.throws(()=>G.build(map),/source-geometry-not-gameplay-certified/);tests++;
{
 const bad=clone(map);const first=r.edges.find(e=>e.sourceKinds.includes('river'));const c=bad.cells.find(c=>c.id===first.a);c.tileEdges[first.aSide]=[];
 assert.throws(()=>A.movementCandidate(b,x,bad),/nonreciprocal-feature/);tests++;
}
{
 const bad=clone(map);const first=r.edges.find(e=>e.sourceKinds.includes('rail'));const c=bad.cells.find(c=>c.id===first.a);c.tileEdges[first.aSide]=[];
 assert.throws(()=>A.movementCandidate(b,x,bad),/nonreciprocal-feature/);tests++;
}
{
 const bad=clone(map);bad.authoredShoreHexsides.push({...bad.authoredShoreHexsides[0]});
 assert.throws(()=>A.movementCandidate(b,x,bad),/duplicate-shore-hexside/);tests++;
}
{
 const bad=clone(map);bad.cells.push(clone(bad.cells[0]));
 assert.throws(()=>A.movementCandidate(b,x,bad),/duplicate-composite-hex/);tests++;
}
for(const key of ['rules_profiles/shared-crt.json','maps/movement-configs/graph-sources.json'])ok(fs.existsSync(key),'source exists '+key);
console.log('PASS Odessa source movement candidate v493',tests,'assertions');
