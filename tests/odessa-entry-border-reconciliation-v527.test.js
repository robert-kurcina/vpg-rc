'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Compose=require('../maps/composer');
const T=require('../core/terrain_tiles');
const Border=require('../core/composite_entry_border_reconciliation');
const Comms=require('../core/composite_eastern_communication_preflight');
const Land=require('../core/composite_land_movement_candidate');
const kiev=require('../maps/kiev.json'),odessa=require('../maps/odessa-extension.json');
const evidence=require('../maps/movement-configs/odessa-entry-border-geometry-v527.json');
const rail=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const cities=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const map=Compose.compose(kiev,odessa),{board}=Land.build(kiev,odessa,map,rail,cities);
let count=0; const ok=(x,m)=>{assert.ok(x,m);count++};
const eq=(x,y,m)=>{assert.deepEqual(x,y,m);count++};
const bad=(fn,match,m)=>{assert.throws(fn,match,m);count++};
const copy=x=>JSON.parse(JSON.stringify(x));
const r=Border.reconcile(map,evidence);
eq(r.status,'geometry-reconciled-candidate-only');
eq(r.certifiedForReinforcements,false);eq(r.certifiedForVictory,false);
eq(r.sourceTraceSvgSha256,map.entryBoundarySelections.sourceSvgSha256);
const sourceById=new Map(map.cells.map(c=>[c.id,c]));
for(const [side,marks,internalCount,externalCount] of [['soviet',26,2,24],['german',41,7,34]]){
 const p=r.paths[side];eq(p.totalMarkedSides,marks,side+' original marks');
 eq(p.internal.length,internalCount,side+' internal');eq(p.exterior.length,externalCount,side+' exterior');
 const source=evidence.paths.find(x=>x.side===side);
 for(const pin of source.orderedSides){
  const cell=sourceById.get(pin.hex);ok(cell&&cell.terrain!=='sea','source non-sea '+side+':'+pin.hex);
  const neighbor=T.neighbor(cell,pin.dir,map.geometry);
  eq(sourceById.has(neighbor),pin.topology==='internal','geometry-only classification '+side+':'+pin.hex+':'+pin.dir);
  if(pin.topology==='internal'){
   eq(pin.adjacentHex,neighbor,'destination source pin '+side+':'+pin.hex+':'+pin.dir);
   const other=sourceById.get(neighbor);
   eq(T.neighbor(other,T.OPP[pin.dir],map.geometry),pin.hex,'interior sides reciprocal');
  }else ok(p.exteriorCandidateHexes.includes(pin.hex),'exterior belongs to listed candidate set');
 }
}
eq(r.paths.soviet.internal.map(e=>`${e.hex}:${e.dir}->${e.adjacentHex}`),['1810:SE->1911','1810:S->1811']);
eq(r.paths.german.internal.map(e=>`${e.hex}:${e.dir}->${e.adjacentHex}`),[
 '0711:S->0712','0711:SE->0811','0810:S->0811','0911:SW->0811','0911:S->0912','0911:SE->1011','1010:S->1011'
]);
// Active combined-map source edges are a DIFFERENT, later source record.
// This corrects the older preflight's omission of the southern appended edge.
for(const [side,n,unique] of [['soviet',32,16],['german',50,23]]){
 const a=r.activePaths[side];eq(a.totalMarkedSides,n,side+' active composite source side count');
 eq(a.exterior.length,n,side+' active sides all exterior');
 eq(a.internal.length,0,side+' active source excludes internal sides');
 eq(a.exteriorCandidateHexes.length,unique,side+' distinct active source hexes');
 for(const item of a.exterior){
  const cell=sourceById.get(item.hex);
  ok(!sourceById.has(T.neighbor(cell,item.dir,map.geometry)),side+' active source side is genuinely exterior');
 }
}
eq(r.activeSourceSvgSha256,map.authoritativeSourceGeometry.sha256);
eq(r.activeSourceSvgSha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../maps/source/user-svg/kiev-odessa-main.svg'))).digest('hex'),'active combined geometry is bound to actual supplied source SVG');
eq(r.activePaths.soviet.exterior.filter(e=>+e.hex.slice(0,2)===19).map(e=>e.hex+':'+e.dir),[
 '1911:N','1911:NE','1911:SE','1912:NE','1912:SE','1913:NE','1913:SE','1914:NE'
]);
const c=Comms.create({map,board});
eq(c.metadata.borderEvidenceStatus,'geometry-reconciled-candidate-only');
eq(c.metadata.germanMarkedSides,41);eq(c.metadata.germanExteriorSideCount,34);
eq(c.metadata.germanInternalMarkedSides.length,7);
eq(c.metadata.exteriorCandidateHexes,r.paths.soviet.exteriorCandidateHexes);
eq(c.metadata.certifiedForVictory,false);eq(c.metadata.certifiedForReinforcements,false);
const active=Comms.createComposite({map,board});
eq(active.metadata.edgeSource,'active-composite-v527');
eq(active.metadata.markedSovietSides,32);eq(active.metadata.exteriorSideCount,32);
eq(active.metadata.exteriorCandidateHexes.length,16);
eq(active.metadata.germanMarkedSides,50);eq(active.metadata.germanInternalMarkedSides.length,0);
eq(active.metadata.certifiedForVictory,false);eq(active.metadata.certifiedForReinforcements,false);
for(const result of Object.values(active.allCities()))eq(result.certifiedForVictory,false,'active southern route is still not certified');
// An old preliminary trace blocked at its twelve original candidate edge hexes
// can give a different answer than the correct combined-map trace.
const oldBlocked=Object.fromEntries(c.metadata.exteriorCandidateHexes.map((hex,i)=>['b'+i,{owner:'german',hex}]));
eq(c.trace('1811',{units:oldBlocked}).reachable,false,'old Kiev-only edge is blocked');
eq(active.trace('1811',{units:oldBlocked}).reachable,true,'Nikolaev still has southern candidate exit');
ok(active.trace('1811',{units:oldBlocked}).path.at(-1).startsWith('19'),'southern path exits via appended border');

for(const city of Object.values(c.allCities()))eq(city.certifiedForVictory,false,'candidate communication is never legal victory signal');
// Falsification: both sides must be pinned to the source and topology. No
// drift, re-ordering or formerly internal seam may grant extra exits.
const changedEvidence=copy(evidence);changedEvidence.paths[0].orderedSides[0].topology='internal';changedEvidence.paths[0].orderedSides[0].adjacentHex='9999';
bad(()=>Border.reconcile(map,changedEvidence),/source-side-topology-drift/);
const wrongInternal=copy(evidence);const ix=wrongInternal.paths[0].orderedSides.findIndex(s=>s.topology==='internal');wrongInternal.paths[0].orderedSides[ix].topology='exterior';delete wrongInternal.paths[0].orderedSides[ix].adjacentHex;
bad(()=>Border.reconcile(map,wrongInternal),/source-side-topology-drift/);
const movedGerman=copy(map);movedGerman.entryBoundarySelections.paths[1].edges[0].cellId='0210';
bad(()=>Border.reconcile(movedGerman,evidence),/source-side-ledger-mismatch/);
const reordered=copy(map);reordered.entryBoundarySelections.paths[0].edges.reverse();
bad(()=>Border.reconcile(reordered,evidence),/source-side-ledger-mismatch/);
const wrongHash=copy(map);wrongHash.entryBoundarySelections.sourceSvgSha256='x'.repeat(64);
bad(()=>Border.reconcile(wrongHash,evidence),/source-evidence-disagreement/);
const duplicate=copy(map);duplicate.entryBoundarySelections.paths[0].edges[1]=copy(duplicate.entryBoundarySelections.paths[0].edges[0]);
bad(()=>Border.reconcile(duplicate,evidence),/source-side-ledger-mismatch/);
const alteredCell=copy(map);alteredCell.cells.find(c=>c.id==='1810').column=17;
bad(()=>Border.reconcile(alteredCell,evidence),/source-side-topology-drift/);
const missingCell=copy(map);missingCell.cells=missingCell.cells.filter(c=>c.id!=='1811');
bad(()=>Border.reconcile(missingCell,evidence),/unverified-composite-board/);
const changedActive=copy(map);changedActive.compositeEntryEdges[0].cellId='9999';
bad(()=>Border.reconcile(changedActive,evidence),/active-composite-side-ledger-drift/);
const missingActive=copy(map);missingActive.compositeEntryEdges.pop();
bad(()=>Border.reconcile(missingActive,evidence),/active-composite-source-disagreement/);
const wrongActiveHash=copy(map);wrongActiveHash.authoritativeSourceGeometry.sha256='0'.repeat(64);
bad(()=>Border.reconcile(wrongActiveHash,evidence),/active-composite-source-disagreement/);
const changedActiveSide=copy(evidence);changedActiveSide.activeComposite.orderedSides[0].dir='S';
bad(()=>Border.reconcile(map,changedActiveSide),/active-composite-side-ledger-drift/);
const activeInternal=copy(map);const activeIdx=activeInternal.compositeEntryEdges.findIndex(e=>e.side==='soviet'&&e.cellId==='1911');
activeInternal.compositeEntryEdges[activeIdx].dir='SW';
bad(()=>Border.reconcile(activeInternal,evidence),/active-composite-side-ledger-drift|active-composite-side-not-exterior/);
const corruptPolicy=copy(evidence);corruptPolicy.certification='SOURCE_CERTIFIED';
bad(()=>Border.reconcile(map,corruptPolicy),/unverified-composite-board/);
const rendered=path.join(__dirname,'../rules/audit/visual/odessa-entry-boundary-topology-v527.png');
ok(fs.existsSync(rendered),'actual engine diagnostic PNG exported');
ok(fs.statSync(rendered).size>200000,'actual engine diagnostic not blank');
const report={checkpoint:293,version:'v527',status:'PASS-geometric-only',assertions:count,
 evidenceStatus:r.status,sourceSvgSha256:r.sourceTraceSvgSha256,
 sides:Object.fromEntries(['soviet','german'].map(side=>[side,{sourceSvgId:r.paths[side].sourceSvgId,
  total:r.paths[side].totalMarkedSides,exterior:r.paths[side].exterior.length,
  internal:r.paths[side].internal.length,candidateHexes:r.paths[side].exteriorCandidateHexes,
  activeCompositeExterior:r.activePaths[side].exterior.length,
  activeCompositeCandidateHexes:r.activePaths[side].exteriorCandidateHexes,
  internalDetails:r.paths[side].internal}])),
 preflightComparison:{legacyExitCount:c.metadata.exteriorCandidateHexes.length,
  activeExitCount:active.metadata.exteriorCandidateHexes.length,
  nikolaevWithLegacyExitsBlocked:{legacyReachable:false,activeReachable:true}},
 gates:{legalReinforcementEntry:false,liveVictoryCommunication:false,fullCompositeMovement:false},
 notes:['Topology exterior ≠ source-certified reinforcement permission','No source map/counter/CRT/TEC changes']};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync(path.join(__dirname,'../rules/audit/odessa-entry-border-reconciliation-v527.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS Odessa entry border topology v527',count,'assertions');
