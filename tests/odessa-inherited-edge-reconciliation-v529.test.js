'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../maps/composer');
const R=require('../core/composite_inherited_edge_reconciliation');
const GameGraph=require('../core/map_movement_graph');
const Base=require('../maps/kiev.json'),Expansion=require('../maps/odessa-extension.json');
const Policy=require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const Rails=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const Cities=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const Expected=require('../maps/movement-configs/odessa-inherited-edge-comparison-v529.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const map=C.compose(Base,Expansion);
const args={base:Base,extension:Expansion,composite:map,basePolicy:Policy,railLedger:Rails,cityLedger:Cities};
const review=R.reconcile(args);
let n=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);n++;};
const ok=(x,msg)=>{assert.ok(x,msg);n++;};
const bad=(fn,re,msg)=>{assert.throws(fn,re,msg);n++;};
eq(review.status,'source-comparison-diagnostic-only');
for(const [k,v] of Object.entries({certifiedForMovement:false,certifiedForReinforcements:false,certifiedForReplacements:false,certifiedForVictory:false}))eq(review[k],v,k);
for(const [k,v] of Object.entries({hexes:165,edges:442,rails:93,rivers:72,majorRivers:10}))eq(review.originalKiev[k],v,'old '+k);
for(const [k,v] of Object.entries({hexes:261,edges:714,traversableCandidates:614,impassableCandidates:100,rails:117}))eq(review.composite[k],v,'combined '+k);
for(const [k,v] of Object.entries({inheritedEdges:442,featureAgreements:441,inheritedRailSides:92,
 inheritedRiverSides:72,inheritedMajorRiverSides:10,seamEdges:24,extensionInternalEdges:248,
 traversableSeamEdges:24,traversableExtensionEdges:148}))eq(review.comparison[k],v,k);
eq(review.comparison.unresolvedDisagreements,[{
 edge:'1201:1202',attribute:'rail',originalKiev:true,compositeRouteLedger:false
}]);
for(const [k,v] of Object.entries({v496ExtensionDigestStale:true,activeExtensionDigestPinned:true,activeSourceSvgDigestPinned:true,activeRouteLinkListRecomputed:true}))eq(review.sourceRevision[k],v,'revision '+k);
for(const [k,v] of Object.entries(review.authorization))eq(v,false,'authority '+k);
ok(!Object.hasOwn(review,'movementEdges'),'no production graph exposed');
ok(!Object.hasOwn(review,'communicated'),'no live replacement/victory callback');
ok(!Object.hasOwn(review,'legalMoves'),'no executable movement generated');
// Critical distinction: original Kiev's source-reviewed graph IS authorized
// for experimental Kiev gameplay, but the appended Odessa map is not.
bad(()=>GameGraph.build(map),/source-geometry-not-gameplay-certified/,'combined production movement blocked');
eq(GameGraph.build(Base).metadata.edgeCount,442,'original Kiev production graph is active and verified');
const tweak=(key,value)=>({...args,[key]:value});
const forged=clone(Expected);forged.unresolvedSourceDisagreements=[];
bad(()=>R.reconcile({...args,expected:forged}),/inherited-edge-conflict-ledger-drift/,'cannot hide missing inherited rail');
const forgedAgreement=clone(Expected);forgedAgreement.inheritedFeatureAgreements=442;
bad(()=>R.reconcile({...args,expected:forgedAgreement}),/inherited-edge-conflict-ledger-drift/,'cannot invent all-edge agreement');
const fakedSource=clone(Expected);fakedSource.sourceRevisionProvenance.currentExtensionJsonSHA256='0'.repeat(64);
bad(()=>R.reconcile({...args,expected:fakedSource}),/active-source-revision-not-pinned/,'cannot use unpinned active extension source');
const granted=clone(Expected);granted.authorization.historicalMovement=true;
bad(()=>R.reconcile({...args,expected:granted}),/invalid-review-policy/,'cannot self-authorize gameplay');
const wrongPolicy=clone(Policy);wrongPolicy.edgeLedgerSHA256='0'.repeat(64);
bad(()=>R.reconcile(tweak('basePolicy',wrongPolicy)),/original-production-policy-does-not-match-candidate/,'original Kiev production ledger SHA pinned');
const modifiedRail=clone(Rails);modifiedRail.links=modifiedRail.links.filter(e=>!(e.a==='1103'&&e.b==='1202'));
bad(()=>R.reconcile(tweak('railLedger',modifiedRail)),/composite-rail-reconciliation/,'combined source rail route pinned');
const modifiedSource=clone(Base);modifiedSource.cells[0].terrain='swamp';
bad(()=>R.reconcile(tweak('base',modifiedSource)),/source-reviewed|movement-map-binding|source-topology|inherited-terrain|source.*mismatch/,'Kiev terrain source pinned');
const modifiedComposite=clone(map);modifiedComposite.cells.find(c=>c.id==='1201').terrain='sea';
bad(()=>R.reconcile(tweak('composite',modifiedComposite)),/composite-|source-|unexpected-|inherited-|rail-/,'composite terrain mutation rejected');
// Prior checkpoint artefacts must remain repeatable, including the independently
// source-pinned rail ledger (do not edit this in response to the mismatch).
const oldAudit=path.resolve(__dirname,'../rules/audit/odessa-eastern-edge-state-qualification-v528.json');
ok(fs.statSync(oldAudit).size>100,'v528 eastern-edge diagnostic preserved');
const audit={checkpoint:295,version:'v529',status:'PASS-source-comparison-diagnostic-only',
 assertions:n,sourceLedgers:{base:Expected.originalKievPolicy,combined:Expected.combinedRailSource},
 ...review,ruleStatus:'Odessa map and original Kiev SVG are separately source-pinned; difference is NOT adjudicated'};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync(path.resolve(__dirname,'../rules/audit/odessa-inherited-edge-reconciliation-v529.json'),JSON.stringify(audit,null,2)+'\n');
console.log('PASS Odessa v529 inherited edge reconciliation',n,'assertions');
