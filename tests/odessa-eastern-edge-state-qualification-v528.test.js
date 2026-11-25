'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const Compose=require('../maps/composer');
const Land=require('../core/composite_land_movement_candidate');
const Qualify=require('../core/composite_eastern_communication_qualification');
const Border=require('../core/composite_eastern_communication_preflight');
const kiev=require('../maps/kiev.json');
const ext=require('../maps/odessa-extension.json');
const rails=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const cityLedger=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const map=Compose.compose(kiev,ext),{board}=Land.build(kiev,ext,map,rails,cityLedger);
const q=Qualify.create({map,board,cityLedger,root});
const tracer=Border.createComposite({map,board});
let n=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);n++;}
function ok(a,msg){assert.ok(a,msg);n++;}
function bad(fn,re,msg){assert.throws(fn,re,msg);n++;}
const clone=o=>JSON.parse(JSON.stringify(o));
const names=cityLedger.cities.map(c=>c.name);
const control=remaining=>Object.fromEntries(names.map(n=>[n,remaining.includes(n)?'soviet':'german']));
const initial=clone(q.metadata);
eq(initial.status,'candidate-only');eq(initial.certifiedForVictory,false);eq(initial.certifiedForReinforcements,false);
eq(initial.candidateSourceExteriorHexes.length,16);
const allOpen=q.assess({cityControl:control(names),turn:7});
eq(allOpen.status,'source-pinned-read-only-hypothesis-not-gameplay-authorized');
eq(allOpen.sourceExteriorSideCount,32);
eq(allOpen.candidateEntryHexes,tracer.metadata.exteriorCandidateHexes);
eq(allOpen.blockedCandidateEntryHexes,[]);eq(Object.keys(allOpen.cityPaths).length,20);
eq(allOpen.projectedTurnSeven.outcome,'soviet-victory');
for(const city of Object.values(allOpen.cityPaths)){
 eq(city.certifiedForVictory,false);ok(city.candidateConnected,'empty candidate map path exists');
 ok(allOpen.candidateEntryHexes.includes(city.exitHex),'city exits through source-reconciled composite boundary');
 eq(city.path[0],city.hex);
}
const early=q.assess({cityControl:control(names),turn:6});eq(early.projectedTurnSeven,null);
// A source-reconciled edge is a candidate but not a legal action. Enemy ZOC
// must screen reinforcement entry even if the threatened hex is the source
// communication ORIGIN (the latter is exempt from §12 ZOC for routing only).
const entry='1601';
const neighbor=board.edges.find(e=>[e.a,e.b].includes(entry)&&!e.impassable);
ok(neighbor,'source entrance has adjacent land');
const threatening=neighbor.a===entry?neighbor.b:neighbor.a;
const enemy={german:{owner:'german',hex:threatening}};
const zoc=q.assess({cityControl:control(names.filter(n=>n==='Nikolaev')),units:enemy});
ok(zoc.blockedCandidateEntryHexes.includes(entry),'enemy neighbor ZOC disallows entry into source boundary');
ok(!zoc.candidateEntryHexes.includes(entry),'ZOC removes threatened entry');
const occupied=q.assess({cityControl:control(['Nikolaev']),units:{german:{owner:'german',hex:entry}}});
ok(occupied.blockedCandidateEntryHexes.includes(entry),'German occupation screens source edge');
const nonGround=q.assess({cityControl:control(['Nikolaev']),units:{air:{owner:'german',hex:threatening,class:'air-support',marker:true}}});
ok(nonGround.candidateEntryHexes.includes(entry),'non-ground air marker creates no ZOC');
const soviet=q.assess({cityControl:control(['Nikolaev']),units:{soviet:{owner:'soviet',hex:threatening}}});
ok(soviet.candidateEntryHexes.includes(entry),'Soviet ground unit creates no German ZOC');
// The v527 southern continuation changes candidate communication relative
// to the obsolete Kiev-only visual boundary record, but remains unqualified.
const legacy=Border.create({map,board});
const oldBlock=Object.fromEntries(legacy.metadata.exteriorCandidateHexes.map((hex,i)=>['b'+i,{owner:'german',hex}]));
eq(legacy.trace('1811',{units:oldBlock}).reachable,false);
eq(q.assess({cityControl:control(['Nikolaev']),units:oldBlock}).cityPaths.Nikolaev.candidateConnected,true);
for(const remaining of [[],['Nikolaev'],['Odessa','Nikolaev'],names]){
 const report=q.assess({cityControl:control(remaining)});
 eq(report.certifiedForVictory,false);eq(report.certifiedForReinforcements,false);eq(report.certifiedForReplacements,false);
 eq(Object.keys(report.cityPaths).length,remaining.length);
}
eq(q.assess({cityControl:control([])}).projectedTurnSeven.outcome,'german-victory');
eq(q.assess({cityControl:control(['Nikolaev'])}).projectedTurnSeven.outcome,'draw');
eq(q.assess({cityControl:control(['Odessa','Nikolaev'])}).projectedTurnSeven.outcome,'soviet-victory');
const allBlocked=Object.fromEntries(tracer.metadata.exteriorCandidateHexes.map((hex,i)=>['g'+i,{owner:'german',hex}]));
const oneBlocked=q.assess({cityControl:control(['Nikolaev']),units:allBlocked});
eq(oneBlocked.candidateEntryHexes,[]);eq(oneBlocked.cityPaths.Nikolaev.candidateConnected,false);
eq(oneBlocked.projectedTurnSeven.outcome,'german-victory');
const twoBlocked=q.assess({cityControl:control(['Odessa','Nikolaev']),units:allBlocked});
eq(twoBlocked.projectedTurnSeven.outcome,'draw');
const malfunction=clone(map);malfunction.compositeEntryEdges[0].cellId='9999';
bad(()=>Qualify.create({map:malfunction,board,cityLedger,root}),/active-composite-side-ledger-drift/);
const badLedger=clone(cityLedger);badLedger.cities[0].hex='9999';
bad(()=>Qualify.create({map,board,cityLedger:badLedger,root}),/map-city-disagreement/);
const badBoard=clone(board);badBoard.metadata.noRulesAuthorization=false;
bad(()=>Qualify.create({map,board:badBoard,cityLedger,root}),/composite-source-preflight-required/);
bad(()=>q.assess({cityControl:{}}),/invalid-candidate-game-state/);
bad(()=>q.assess({cityControl:control(names),turn:8}),/invalid-candidate-game-state/);
bad(()=>q.assess({cityControl:control(['Nikolaev']),units:{enemy:{owner:'axis',hex:'1810'}}}),/unverified-unit-state/);
bad(()=>q.assess({cityControl:control(['Nikolaev']),units:{enemy:{owner:'german',hex:'1416'}}}),/unverified-unit-state/);
ok(typeof q.communicated==='undefined'&&typeof q.legalReinforcement==='undefined','candidate layer cannot provide live legality callback');
const report={checkpoint:294,version:'v528',status:'PASS-diagnostic-only',assertions:n,
 source:'active 32-side Soviet / 16-hex candidate edge from v527',
 candidateEntryHexes:allOpen.candidateEntryHexes,
 example:{nikolaevWithOldExitsBlocked:q.assess({cityControl:control(['Nikolaev']),units:oldBlock}).cityPaths.Nikolaev.candidateConnected,
  openOneCity:q.assess({cityControl:control(['Nikolaev'])}).projectedTurnSeven,
  allExitHexesOccupied:oneBlocked.projectedTurnSeven},
 gates:{liveReinforcementPlacement:false,liveReplacementCommunication:false,liveVictoryIsolation:false,productionCampaign:false}};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync(path.join(root,'rules/audit/odessa-eastern-edge-state-qualification-v528.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS Odessa v528 eastern-edge state qualification',n,'assertions');
