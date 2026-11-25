'use strict';
/* Checkpoint 251: exercise the production Kiev source-reviewed graph, not an
 * in-memory promotion, using the original shared historical campaign engine.
 * The graph is authorized for experimental browser play, not as a claim that
 * the illustrative starting allocation is the historical opening position.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const G=require('../core/map_movement_graph');
const B=require('../core/movement_binding');
const Human=require('../core/historical_campaign_human');
const Campaign=require('../core/historical_campaign_session');
const Deploy=require('../core/historical_deployment_session');
const F=require('./fixtures/kiev-source-opening-v437');
const Policy=require('../maps/movement-configs/graph-sources.json');
const Candidate=require('../maps/movement-configs/kiev-source-reviewed-candidate-v435.json');
const Ledgers=require('../maps/movement-configs/source-reviewed-edge-ledgers.json');
const Movement=require('../maps/movement-configs/kiev.json');
const Phase=require('../maps/phase-configs/kiev.json');
const Combat=require('../maps/combat-configs/kiev.json');
const Buildup=require('../maps/buildup-configs/kiev.json');
const House=require('../maps/housekeeping-configs/kiev.json');
const Inventory=require('../maps/setup/kiev-inventory.json');
let count=0;
const ok=(v,m)=>{assert.ok(v,m);count++};
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);count++};
const bad=(fn,re,m)=>{assert.throws(fn,re,m);count++};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const map=F.map, graphPolicy=Policy.maps[map.id], ledger=Ledgers.maps[map.id];
eq(graphPolicy.status,'verified','Kiev graph enabled');
eq(graphPolicy.authorizationScope,'source-svg-geometry-for-experimental-gameplay','bounded certification claim');
eq(graphPolicy.evidenceTier,'source-authoritative','same evidence tier as Arduous');
eq(graphPolicy.sourceImageSHA256,map.sourceImageSHA256,'source image bound');
eq(graphPolicy.geometryStatus,map.geometry.calibrationStatus,'unchanged map geometry label');
eq(graphPolicy.edgeLedgerSHA256,Candidate.edgeLedgerSHA256,'source reviewed edge ledger bound');
eq(sha('maps/source/user-svg/kiev-odessa-main.svg'),ledger.sourceSvgSha256,'original source SVG immutable');
eq(sha('references/rules/kiev-rules.pdf'),'d55e8f0e567d1f8c7907c4fc8368954ec0e5fa8d6fe9e8e71c61acf9bb3c3756','historical rules unchanged');
const g=G.build(map), binding=B.build(map,Movement);
eq(Object.keys(g.cells).length,165,'all cells verified');eq(g.edges.length,442,'all physical connections');
eq(g.metadata.railEdges,93,'rail');eq(g.metadata.riverEdges,72,'ordinary rivers');eq(g.metadata.majorRiverEdges,10,'major rivers');
eq(binding.board.edges.length,442,'same shared movement binding');
ok(g.edges.every(x=>x.verified&&!x.impassable&&!x.allSea&&!x.lake),'physical movement graph authoritative for authored SVG');
const sourceActions=Object.values(require('../maps/setup/kiev.json').groups);
ok(F.validation.valid,'source legal sample');eq(F.validation.historicalSetupAuthorized,false,'not certified historical starting allocation');
const deployment=Deploy.create({map,setupSpec:F.setupSpec,counterConfig:F.counterConfig,inventory:F.inventory,
  phaseConfig:Phase,movementProfile:Movement,phaseFactories:{combat:()=>({})},
  allocation:F.allocation,placements:F.placements});
eq(Object.keys(deployment.snapshot().units).length,30,'30 setup counters');
const committed=deployment.commit();
eq(Object.values(committed.opening.state.units).length,30,'30 game units');
const context={...committed.opening,map,profile:Movement,config:Phase,counterConfig:F.counterConfig,
 combatPolicy:Combat,enableAirSupport:true,buildupPolicy:Buildup,housekeepingPolicy:House,
 buildupAllocation:committed.allocation};
let human=Human.create({session:Campaign.create(context),context});
eq(human.snapshot().phaseId,'german-combat','Turn 1 starts at German Combat');
let first=human.view().commands.find(c=>c.action?.type==='commit-battles'&&c.action.battles.length===0);
ok(first,'human legal-action catalogue exposes no-battle alternative');
human=human.choose(first);eq(human.snapshot().actionCount,1,'first shared action committed');
const saved=human.save();eq(Human.restore(saved,context).snapshot(),human.snapshot(),'human save/restore exact');
const undo=human.undo();ok(undo.ok,'undo allowed');eq(undo.session.snapshot().actionCount,0,'undo restores initial state');
const next=human.view().commands.find(c=>c.action?.type==='finish-combat');
ok(next,'next phase choice is exposed');human=human.choose(next);
eq(human.snapshot().phaseId,'german-special-movement','Turn 1 German special movement entered');
const previewConfig=require('../games/kiev/setup-preview/config.json');
ok(!previewConfig.mode,'same browser game controller, not setup-only');
eq(previewConfig.candidateFixture,'kiev-source-opening-v437','source-legal sample fixture');
for(const k of ['combatPolicy','buildupPolicy','housekeepingPolicy'])ok(previewConfig[k]?.endsWith('/kiev.json'),'policy '+k);
ok(!require('../maps/movement-configs/graph-sources.json').maps[require('../maps/odessa-extension.json').id],
 'expansion movement graph has no implicit certification');
for(const [mutator,re,desc] of [
 [m=>{m.geometry.calibration.pitchX+=.01},/fingerprint-mismatch/,'geometry drift'],
 [m=>{m.cells[0].terrain='forest'},/fingerprint-mismatch/,'terrain drift'],
 [m=>{m.cells.find(c=>c.id==='1401').tileEdges.SE=[{kind:'majorRiver'}]},/source-visual-edge-disagrees-with-ledger|fingerprint-mismatch/,'river visual tamper'],
 [m=>{m.hexCenterRailConnections.pop()},/fingerprint-mismatch/,'rail drift'],
 ]){const m=structuredClone(map);mutator(m);bad(()=>G.build(m),re,desc)}
for(const name of ['arduous','leningrad'])ok(G.build(require('../maps/'+name+'.json')).edges.length>0,name+' still authorized');
const earlier=fs.readFileSync('rules_profiles/shared-crt.json');ok(earlier.length>100,'common CRT preserved');
console.log('PASS Kiev v485 experimental production graph and shared campaign',count,'assertions');
