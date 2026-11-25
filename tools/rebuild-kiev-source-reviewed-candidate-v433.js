'use strict';
/* Reproducible source-pinned Kiev GEOGRAPHY candidate; never activates a game.
 * The live graph policy remains provisional. No visual map or source is changed.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const fromRoot=p=>path.join(ROOT,p);
const load=p=>JSON.parse(fs.readFileSync(fromRoot(p),'utf8'));
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const hashFile=p=>digest(fs.readFileSync(fromRoot(p)));
const T=require('../core/terrain_tiles');
const Reviewed=require('../core/source_reviewed_movement_graph');
const map=load('maps/kiev.json');
const cities=load('rules/audit/kiev-definitive-city-river-v429.json');
const terrain=load('rules/audit/kiev-definitive-terrain-v428.json');
const railway=load('rules/audit/kiev-rail-reconstruction-v427.json');
const registry=load('maps/movement-configs/source-reviewed-edge-ledgers.json');
const knownSvg='2b15c3a92a282a7efc27d54bcd8994470f0fce8ee5417d5d734969fcd2c4ab7e';
assert.equal(hashFile('maps/source/user-svg/kiev-odessa-main.svg'),knownSvg,'definitive SVG changed');
assert.equal(cities.sourceSvgSha256,knownSvg);
assert.equal(terrain.sourceSvgSha256,knownSvg);
assert.equal(map.definitiveTerrainAudit.sourceSvgSha256,knownSvg);
assert.equal(cities.playerAidSha256,hashFile(cities.playerAid),'player aid changed');
assert.equal(map.cells.length,165);assert.equal(terrain.sourceCertifiedHexes,149);
assert.equal(cities.cityCount,16);assert.equal(cities.riverCount,72);assert.equal(cities.majorRiverCount,10);
assert.equal(railway.currentRegisteredLinks,93);assert.equal(railway.unresolvedGeometricCrossings,0);
assert.equal(railway.source.sha256,knownSvg);
const cells=new Map(map.cells.map(c=>[c.id,c]));
assert.equal(cells.size,165);
const cityIds=Object.keys(cities.cityGameplayTerrain).sort();
assert.equal(cityIds.length,16);
assert.deepEqual(cityIds,[...map.definitiveTerrainAudit.unclassifiedCityBaseHexes].sort());
assert.deepEqual(cityIds,[...terrain.cityOverlayWithoutBaseSymbol].sort());
const overlays={};
for(const id of cityIds){
 const e=cities.cityGameplayTerrain[id],c=cells.get(id);
 assert(c&&['city','major-city'].includes(e.type)&&e.svgId);
 assert.equal(c.terrainStatus,'source-typed-city-terrain-v429');
 assert.equal(c.terrain,'open','source file provides no base terrain below the city art');
 assert.equal(c.sourceTerrainEvidence.sourceSvgSha256,knownSvg);
 assert.equal(c.sourceTerrainEvidence.layer,e.type);
 assert(c.sourceTerrainEvidence.sourceSvgIds.includes(e.svgId));
 assert(c.tileMarkers.some(m=>m.sourceSvgId===e.svgId&&m.kind===(e.type==='major-city'?'majorCity':'city')));
 overlays[id]={terrain:e.type,svgId:e.svgId};
}
let explicit=0;
for(const c of map.cells){
 if(cityIds.includes(c.id))continue;
 if(c.id==='1502'){
  assert.equal(c.terrainStatus,'user-adjudicated-terrain-v435');
  assert.equal(c.terrain,'forest');
  assert.deepEqual(c.userTerrainAdjudication,{previousTerrain:'swamp',terrain:'forest',
    directive:'user-directive-2026-11-21-checkpoint-201',sourceTerrainUnchanged:true});
  assert.equal(c.sourceTerrainEvidence.layer,'swamp','retain original unmodified SVG evidence');
 }else{
  assert.equal(c.terrainStatus,'definitive-user-svg-terrain-v428');
  assert(['open','forest','swamp'].includes(c.terrain));
  assert.equal(c.sourceTerrainEvidence.layer,c.terrain);
 }
 assert.equal(c.sourceTerrainEvidence.sourceSvgSha256,knownSvg);
 explicit++;
}
assert.equal(explicit,149);
const pairs=new Set();let boundary=0;
for(const c of map.cells)for(const dir of T.DIRS){
 const n=T.neighbor(c,dir,map.geometry),other=cells.get(n);
 if(!other){boundary++;continue;}
 assert.equal(T.neighbor(other,T.OPP[dir],map.geometry),c.id,'nonreciprocal grid edge');
 pairs.add([c.id,n].sort().join(':'));
}
assert.equal(pairs.size,442);assert.equal(boundary,106);
const rails=[...new Set(map.hexCenterRailConnections.map(l=>{
 assert.equal(l.status,'definitive-svg-finite-hexside-v427');
 const pair=[l.from,l.to].sort().join(':');assert(pairs.has(pair),'rail not adjacent: '+pair);
 return pair;
}))].sort();
assert.equal(rails.length,93);
const rivers=[],majorRivers=[];
for(const e of cities.riverHexsides){
 assert(pairs.has(e.hexPair),'river not adjacent: '+e.hexPair);
 assert(e.coverageFraction>=.9&&e.coverageFraction<=1);
 assert(typeof e.sourceSvgId==='string'&&e.sourceSvgId.length>0);
 if(e.kind==='river')rivers.push(e.hexPair);
 else if(e.kind==='majorRiver')majorRivers.push(e.hexPair);
 else throw Error('unexpected water classification: '+e.kind);
}
assert.equal(new Set([...rivers,...majorRivers]).size,82,'duplicate/conflicting source hexside');
rivers.sort();majorRivers.sort();
assert.equal(rivers.length,72);assert.equal(majorRivers.length,10);
const evidence={schemaVersion:1,mapId:map.id,sourceFingerprint:Reviewed.fingerprint(map),
 sourceSvgSha256:knownSvg,overlayFingerprint:Reviewed.overlayFingerprint(map),
 hexCount:165,edgeCount:442,boundarySides:106,
 cityTerrainOverlays:overlays,railEdges:rails,riverEdges:rivers,majorRiverEdges:majorRivers};
const policy={schemaVersion:1,mapId:map.id,authorizationStatus:'diagnostic-only-not-gameplay',
 sourceEvidenceMode:'definitive-city-layer-v1',
 edgeMode:'source-reviewed-v1',edgeLedgerSHA256:digest(JSON.stringify(evidence)),
 terrainStatuses:['definitive-user-svg-terrain-v428','source-typed-city-terrain-v429','user-adjudicated-terrain-v435'],
 railStatus:'definitive-svg-finite-hexside-v427',
 edgeSource:'kiev-odessa-main-svg-city-river-rail-v433',
 coverage:'165 SVG terrain hexes (149 base symbols (one user-reclassified) plus 16 city overlays), 442 physical edges, 93 rail, 72 river, 10 major river; diagnostic only; setup/campaign unavailable'};
const updated={...registry,maps:{...registry.maps,[map.id]:evidence}};
const audit={checkpoint:201,version:'v435',scope:'Objective: Kiev geography candidate; no gameplay activation',
 sourceSvg: 'maps/source/user-svg/kiev-odessa-main.svg',sourceSvgSha256:knownSvg,
 rulesAid:'references/rules/kiev-player-aid.webp',rulesAidSha256:cities.playerAidSha256,
 counts:{hexes:165,baseTerrain:149,cityOverlay:16,majorCity:1,physicalEdges:442,boundarySides:106,
 railwayEdges:93,riverEdges:72,majorRiverEdges:10},
 sourceReviewedFingerprint:evidence.sourceFingerprint,
 sourceOverlayFingerprint:evidence.overlayFingerprint,
 edgeLedgerSHA256:policy.edgeLedgerSHA256,
 liveGameAuthorization:false,
 limitations:[
  'Hex 1502 is user-adjudicated Forest although original definitive source SVG marks it Swamp; both records are retained',
  'Underlying base terrain is not authored beneath 16 city icons; source-defined City/Major City is the gameplay terrain, not an assertion about underlay',
  '82 river edges are those individually classified by the source geometry audit; short incidental contacts are not promoted',
  'The source-reviewed candidate does not establish the printed historical initial deployment, strategic legality, or a playable seven-turn campaign',
  'Kiev-Odessa map seam is outside this 165-cell candidate',
  'The live graph policy remains provisional until further full-game validation'
 ]};
const dest=[['maps/movement-configs/source-reviewed-edge-ledgers.json',updated],
 ['maps/movement-configs/kiev-source-reviewed-candidate-v435.json',policy],
 ['rules/audit/kiev-source-reviewed-candidate-v435.json',audit]];
const write=process.argv.includes('--write');
for(const [p,data] of dest){
 const file=fromRoot(p),expected=JSON.stringify(data,null,2)+'\n';
 if(write)fs.writeFileSync(file,expected);
 else assert.equal(fs.readFileSync(file,'utf8'),expected,'stale candidate artifact: '+p);
}
console.log('PASS Kiev candidate pinned (NOT LIVE)',audit.counts,'write='+write);
