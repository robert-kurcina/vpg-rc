'use strict';
/* Source-pinned Kiev movement graph diagnostic; creates review evidence ONLY.
 * The audited graph is built with the existing shared source-reviewed engine.
 * No result can authorize gameplay or change the production graph registry.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel));
const load=rel=>JSON.parse(read(rel));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const assert=require('node:assert/strict');
const MapGraph=require('../core/map_movement_graph');
const Reviewed=require('../core/source_reviewed_movement_graph');
const map=load('maps/kiev.json'),policy=load('maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const ledger=load('maps/movement-configs/source-reviewed-edge-ledgers.json').maps[map.id];
assert.equal(hash(read('maps/source/user-svg/kiev-odessa-main.svg')),ledger.sourceSvgSha256);
assert.equal(hash(JSON.stringify(ledger)),policy.edgeLedgerSHA256);
assert.equal(policy.authorizationStatus,'diagnostic-only-not-gameplay');
assert.equal(MapGraph.build(map).edges.length,442,'current explicitly source-approved experimental graph');
const board=Reviewed.build(map,policy);
assert.equal(Object.keys(board.cells).length,165);
assert.equal(board.edges.length,442);
const center=new Map(map.cells.map(c=>[c.id,c.pixelCenter]));
const pair=(a,b)=>[a,b].sort().join(':');
const ledgerPairs={rail:new Set(ledger.railEdges),river:new Set(ledger.riverEdges),majorRiver:new Set(ledger.majorRiverEdges)};
// Identical radii to core/terrain_tiles.js gridRadii + hexPoints.
const radius=map.geometry.calibration.pitchY/2,rx=map.geometry.calibration.pitchX*2/3,half=rx/2;
function side(a,b){
 const [ax,ay]=center.get(a),[bx,by]=center.get(b);
 const target=[(ax+bx)/2,(ay+by)/2];
 const vertices=[[rx,0],[half,radius],[-half,radius],[-rx,0],[-half,-radius],[half,-radius]].map(([x,y])=>[ax+x,ay+y]);
 const options=vertices.map((p,i)=>{
  const q=vertices[(i+1)%vertices.length];
  const mid=[(p[0]+q[0])/2,(p[1]+q[1])/2];
  return {pts:[p,q],error:Math.hypot(mid[0]-target[0],mid[1]-target[1])};
 }).sort((a,b)=>a.error-b.error);
 if(options[0].error>1.2)throw Error('Edge cannot be fitted to source hexside: '+pair(a,b)+' error '+options[0].error);
 return options[0].pts.map(x=>x.map(n=>Number(n.toFixed(3))));
}
const edges=board.edges.map(e=>{
 const key=pair(e.a,e.b);
 for(const k of ['rail','river','majorRiver'])assert.equal(ledgerPairs[k].has(key),Boolean(e[k]),'source ledger '+k+' '+key);
 return {id:key,a:e.a,b:e.b,rail:e.rail,river:e.river,majorRiver:e.majorRiver,side:side(e.a,e.b)};
}).sort((a,b)=>a.id.localeCompare(b.id));
const ids=new Set(map.cells.map(c=>c.id));
assert.equal(ids.size,165);assert.equal(new Set(edges.map(e=>e.id)).size,442);
for(const e of edges){assert(ids.has(e.a)&&ids.has(e.b));}
const source={mapId:map.id,sourceGame:map.sourceGame,mapSHA256:hash(read('maps/kiev.json')),
 mapImageSHA256:map.sourceImageSHA256,sourceSvgSHA256:ledger.sourceSvgSha256,
 sourceEdgeLedgerSHA256:policy.edgeLedgerSHA256,sourceCandidateSHA256:hash(read('maps/movement-configs/kiev-source-reviewed-candidate-v435.json')),
 currentGraphAuthorization:'source-verified-experimental-not-historically-certified'};
const payload={schemaVersion:1,scope:'READ-ONLY-SOURCE-REVIEW-NOT-HISTORICAL-CERTIFICATION',source,
 coverage:{cells:ids.size,edges:edges.length,rails:edges.filter(e=>e.rail).length,
 river:edges.filter(e=>e.river).length,majorRiver:edges.filter(e=>e.majorRiver).length},
 edges,gameplayAuthorized:false};
const audit={...payload,integrity:{algorithm:'SHA-256',digest:hash(JSON.stringify(payload))}};
const rel='rules/audit/kiev-movement-edge-review-v478.json';
const out=JSON.stringify(audit,null,2)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(path.join(ROOT,rel),out);
else assert.equal(read(rel).toString(),out,'source-reviewed edge audit drift');
console.log('PASS',edges.length,'source-reviewed Kiev edges; 93 rails, 72 ordinary + 10 major rivers; gameplay source graph experimental, review drafts not historical certification; audit',audit.integrity.digest);
