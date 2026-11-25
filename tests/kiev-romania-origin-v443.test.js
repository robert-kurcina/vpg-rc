'use strict';
/* v443: generic, source-bound first-turn territory restriction, exercised on
 * certified Leningrad geography. Kiev mask remains UNVERIFIED and disabled. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Setup=require('../core/scenario_starting_setup');
const Bridge=require('../core/scenario_opening_bridge');
const Declarations=require('../core/historical_combat_declarations');
const Phase=require('../core/historical_combat_phase');
const Movement=require('../core/historical_movement_actions');
const G=require('../core/map_movement_graph');
const Kiev=require('./fixtures/kiev-source-opening-v437');
const KPhase=require('../maps/phase-configs/kiev.json');
const KProfile=require('../maps/movement-configs/kiev.json');
const L=require('../maps/leningrad.json');
const LProfile=require('../maps/movement-configs/leningrad.json');
const LPhase=require('../maps/phase-configs/leningrad.json');
const LCounter=require('../maps/counter-configs/leningrad.json');
const LPolicy=require('../maps/combat-configs/leningrad.json');
const LSetup=require('../maps/setup/leningrad.json');
const LInventory=require('../core/leningrad_starting_inventory');
const LFixture=require('./fixtures/leningrad-source-setup-v357');
const candidates=require('../maps/combat-configs/kiev-turn-rules-v443.json');
const copy=v=>JSON.parse(JSON.stringify(v));
let n=0;
function ok(x,message){assert.ok(x,message);n++;}
function eq(a,b,message){assert.deepEqual(a,b,message);n++;}
function bad(f,re){assert.throws(f,re);n++;}
const k=Setup.validate({map:Kiev.map,spec:Kiev.setupSpec,counterConfig:Kiev.counterConfig,
 inventory:Kiev.inventory,allocation:Kiev.allocation,placements:Kiev.placements});
ok(k.valid,'Kiev setup fixture passes full §6 constraints');
eq(Object.keys(k.state.units).length,30);
for(const [id,u] of Object.entries(k.state.units)){
 eq(u.openingHex,Kiev.placements[id],`Kiev face ${id} bound to its initial physical hex`);
 eq(u.hex,u.openingHex);
}
const bridge=Bridge.create({map:Kiev.map,setupSpec:Kiev.setupSpec,counterConfig:Kiev.counterConfig,
 inventory:Kiev.inventory,allocation:Kiev.allocation,placements:Kiev.placements,
 phaseConfig:KPhase,movementProfile:KProfile,phaseFactories:{}});
const kUnitId=Kiev.allocation.sovietFrontArmies[0], before=bridge.snapshot();
before.state.units[kUnitId].hex='9999';before.state.units[kUnitId].openingHex='9999';
eq(bridge.snapshot().state.units[kUnitId].hex,Kiev.placements[kUnitId]);
eq(bridge.snapshot().state.units[kUnitId].openingHex,Kiev.placements[kUnitId]);
ok(!bridge.productionGameActivated,'source setup is not live game activation');
eq(candidates.firstTurnTerritorialOriginCandidate.allowedOpeningHexes,['0708','0808','1110']);
ok(candidates.firstTurnTerritorialOriginCandidate.status.startsWith('not-enforced-'));
ok(!Object.hasOwn(candidates,'firstTurnTerritorialRestriction'),'Kiev must NOT have an invented territory mask');
ok(!Object.hasOwn(candidates.firstTurnTerritorialOriginCandidate,'targetHexes'),'no fabricated Romanian territory set');
const source=fs.readFileSync('references/rules/kiev-rules.pdf');
eq(crypto.createHash('sha256').update(source).digest('hex'),candidates.sourceSha256);
bad(()=>G.build({...Kiev.map,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/);

// Synthetically define a fully enumerated one-hex territory on CERTIFIED
// Leningrad geometry. This proves the generic rule, not Kiev's geography.
const board=G.build(L);
const around=new Map();
for(const e of board.edges){
 if(!e.verified||e.impassable||e.allSea||e.lake)continue;
 for(const [target,from] of [[e.a,e.b],[e.b,e.a]]){
  if(!around.has(target))around.set(target,new Set());
  around.get(target).add(from);
 }
}
const [target,neighbors]=[...around.entries()].find(([,s])=>s.size>=2);
const [eligible,alternate]=[...neighbors].slice(0,2);
const territory={owner:'soviet',turn:1,allowedOpeningHexes:[eligible],targetHexes:[target],
 targetRegionEvidence:{coverage:'complete',provenance:'test-only explicitly enumerated single hex'}};
const declaration=Declarations.create({map:L,profile:LProfile,config:LPhase,
 combatPolicy:{firstTurnTerritorialRestriction:territory}});
const cursor=t=>({scenarioId:'leningrad',turn:t,index:6,complete:false});
const state={scenarioId:'leningrad',units:{s:{id:'s',owner:'soviet',hex:eligible,openingHex:eligible},
 g:{id:'g',owner:'german',hex:target,openingHex:target}}};
const battle=[{defenderHex:target,attackers:['s']}];
eq(declaration.declare({cursor:cursor(1),actor:'soviet',state},battle).battles.length,1);
// A real move transaction must change only current position, preserving the
// source opening position through the shared phase action dispatcher.
const movePilot=Movement.create({map:L,profile:LProfile,config:LPhase});
const moveFrom=[...board.edges].find(e=>e.verified&&!e.impassable&&!e.rail&&
 board.cells[e.b]?.verified&&board.cells[e.b].terrain==='open');
ok(moveFrom,'source-certified one-step movement edge');
const moveState={scenarioId:'leningrad',units:{s:{id:'s',owner:'soviet',hex:moveFrom.a,
 openingHex:moveFrom.a,class:'infantry',nationality:'soviet',size:'corps',mp:4}}};
const moveSession={cursor:{scenarioId:'leningrad',turn:2,index:7,complete:false},actor:'soviet',state:moveState};
const move=movePilot.execute(moveSession,{unitId:'s',path:[moveFrom.a,moveFrom.b]});
ok(move.ok,'legal move executes in shared phase engine');
eq(move.state.units.s.hex,moveFrom.b,'unit enters target hex');
eq(move.state.units.s.openingHex,moveFrom.a,'starting position survives actual move');
eq(moveState.units.s.hex,moveFrom.a,'source state is not mutated');
const moved=copy(state);moved.units.s.hex=alternate;
eq(moved.units.s.openingHex,eligible,'movement does not change saved opening lineage');
eq(declaration.declare({cursor:cursor(1),actor:'soviet',state:moved},battle).battles.length,1,
 'an originally eligible Soviet may attack from a new adjacent hex');
const wrong=copy(state);wrong.units.s.openingHex=alternate;
bad(()=>declaration.declare({cursor:cursor(1),actor:'soviet',state:wrong},battle),/eligible original setup hex/);
const forged=copy(state);delete forged.units.s.openingHex;
bad(()=>declaration.declare({cursor:cursor(1),actor:'soviet',state:forged},battle),/eligible original setup hex/);
eq(declaration.declare({cursor:cursor(2),actor:'soviet',state:wrong},battle).battles.length,1,
 'prohibition is Turn 1 only');
eq(declaration.declare({cursor:cursor(1),actor:'soviet',state:wrong},[]).battles.length,0);
const without=Declarations.create({map:L,profile:LProfile,config:LPhase});
eq(without.declare({cursor:cursor(1),actor:'soviet',state:wrong},battle).battles.length,1,
 'scenarios without opted-in rule remain unaffected');
for(const corrupted of [
 {...territory,targetRegionEvidence:undefined},
 {...territory,targetRegionEvidence:{coverage:'partial',provenance:'synthetic'}} ,
 {...territory,targetRegionEvidence:{coverage:'complete',provenance:''}},
 {...territory,targetHexes:[]},
 {...territory,targetHexes:[target,target]},
 {...territory,targetHexes:['9999']},
 {...territory,allowedOpeningHexes:['9999']},
 {...territory,allowedOpeningHexes:[eligible,eligible]},
 {...territory,turn:2},
 {...territory,owner:'axis'},
 {...territory,allowedOpeningHexes:[]}
])bad(()=>Declarations.create({map:L,profile:LProfile,config:LPhase,
 combatPolicy:{firstTurnTerritorialRestriction:corrupted}}),/Invalid source-defined first-turn territory restriction/);

// Full controller integration uses authentic printed Leningrad unit fronts
// and a temporary explicit synthetic territory. Kiev remains unavailable.
const lb=Bridge.create({map:L,setupSpec:LSetup,counterConfig:LCounter,inventory:LInventory,
 allocation:LFixture.selected,placements:LFixture.placements,phaseConfig:LPhase,
 movementProfile:LProfile,phaseFactories:{}});
const opening=lb.snapshot();
const s=Object.values(opening.state.units).find(u=>u.owner==='soviet'&&u.hex==='0309'&&u.printedCombatStrength===3);
const g=Object.values(opening.state.units).find(u=>u.owner==='german'&&u.hex==='0310'&&u.printedCombatStrength===8);
ok(s&&g,'source-verified Leningrad face pairing');
eq(s.openingHex,'0309');
const synthetic=copy(LPolicy);
synthetic.firstTurnTerritorialRestriction={owner:'soviet',turn:1,allowedOpeningHexes:['0309'],
 targetHexes:['0310'],targetRegionEvidence:{coverage:'complete',provenance:'test-only one-hex fixture'}};
const ctx={map:L,profile:LProfile,config:LPhase,cursor:cursor(1),actor:'soviet',
 state:opening.state,counterConfig:LCounter,combatPolicy:synthetic};
eq(Phase.create(ctx).commit([{defenderHex:'0310',attackers:[s.id]}]).snapshot().status,'committed');
const untrusted=copy(opening.state);untrusted.units[s.id].openingHex='0308';
bad(()=>Phase.create({...ctx,state:untrusted}).commit([{defenderHex:'0310',attackers:[s.id]}]),
 /eligible original setup hex/);
eq(Phase.create({...ctx,state:untrusted,cursor:cursor(2)}).commit([{defenderHex:'0310',attackers:[s.id]}]).snapshot().status,'committed');
console.log(`PASS Kiev §10.8 origin lineage / synthetic certified-board territorial rule: ${n} assertions; Kiev territory mask NOT claimed`);
