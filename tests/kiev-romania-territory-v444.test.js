'use strict';
/* v444: establish finite source evidence, block territory promotion, and
 * regression-test the §10.8 Axis starting-origin escape hatch. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {audit,ROMANIA,SOVIET_BORDER}=require('../scripts/audit-kiev-territory-v444');
const Declarations=require('../core/historical_combat_declarations');
const G=require('../core/map_movement_graph');
const L=require('../maps/leningrad.json');
const profile=require('../maps/movement-configs/leningrad.json');
const phases=require('../maps/phase-configs/leningrad.json');
const Kiev=require('../maps/kiev.json');
let checks=0;
function ok(p,m){assert.ok(p,m);checks++;}
function eq(a,b,m){assert.deepEqual(a,b,m);checks++;}
function bad(f,re){assert.throws(f,re);checks++;}
const evidence=audit();
const stored=JSON.parse(fs.readFileSync('rules/audit/kiev-romania-territory-evidence-v444.json'));
eq(evidence,stored,'persisted source evidence matches live audit');
eq(evidence.mapHexCount,165);eq(evidence.targetTerritory.completeMaskAvailable,false);
eq(evidence.targetTerritory.coverage,'incomplete');
eq(evidence.targetTerritory.unclassifiedCount,161);
eq(evidence.certifiedFromPrintedSetupAndApprovedMap.romanianInitialAxisHexes,ROMANIA);
eq(evidence.certifiedFromPrintedSetupAndApprovedMap.sovietEligibleOpeningHexes,SOVIET_BORDER);
for(const id of [...ROMANIA,...SOVIET_BORDER])ok(Kiev.cells.some(c=>c.id===id),'source hex present '+id);
for(const id of SOVIET_BORDER)ok(evidence.certifiedFromPrintedSetupAndApprovedMap.adjacentInitialLineContacts.some(c=>c.sovietBorderOrigin===id),'source-adjacent border '+id);
ok(!Object.hasOwn(evidence.targetTerritory,'targetHexes'),'source uncertainty never represented as playable mask');
// Synthetic certified board: first-turn German restrictions must refer to
// where the unit SET UP, even if the current position has since changed.
const board=G.build(L);const neighborhoods=new Map();
for(const e of board.edges){
 if(!e.verified||e.impassable||e.allSea||e.lake)continue;
 for(const [target,neighbor] of [[e.a,e.b],[e.b,e.a]]){
  if(!neighborhoods.has(target))neighborhoods.set(target,new Set());
  neighborhoods.get(target).add(neighbor);
 }
}
const [target,neighborSet]=[...neighborhoods.entries()].find(([,v])=>v.size>=3);
ok(target,'certified target with multiple attacking positions exists');
const [restricted,other,third]=[...neighborSet].slice(0,3);
const D=Declarations.create({map:L,profile,config:phases,
 combatPolicy:{firstTurnCombatRestriction:{owner:'german',turn:1,setupHexes:[restricted]}}});
const cursor=turn=>({scenarioId:'leningrad',turn,index:2,complete:false});
const state=(hex,openingHex)=>({scenarioId:'leningrad',units:{
  g:{id:'g',owner:'german',hex,openingHex},s:{id:'s',owner:'soviet',hex:target,openingHex:target}}});
const battle=[{defenderHex:target,attackers:['g']}];
bad(()=>D.declare({cursor:cursor(1),actor:'german',state:state(other,restricted)},battle),/source-designated setup unit cannot attack/);
ok(D.declare({cursor:cursor(1),actor:'german',state:state(restricted,other)},battle).battles.length===1,
 'an initially unrestricted German stays eligible even when currently in a marked hex');
ok(D.declare({cursor:cursor(1),actor:'german',state:state(third,other)},battle).battles.length===1,
 'unrestricted first-turn German may attack from a second valid position');
bad(()=>D.declare({cursor:cursor(1),actor:'german',state:state(other,undefined)},battle),/valid original setup hex/);
bad(()=>D.declare({cursor:cursor(1),actor:'german',state:state(other,'9999')},battle),/valid original setup hex/);
eq(D.declare({cursor:cursor(2),actor:'german',state:state(other,restricted)},battle).battles.length,1);
const unrestricted=Declarations.create({map:L,profile,config:phases});
eq(unrestricted.declare({cursor:cursor(1),actor:'german',state:state(other,undefined)},battle).battles.length,1);
// Disallow accidental production activation using the incomplete source
// evidence, even though all documented initial Romanian crosses are known.
bad(()=>Declarations.create({map:L,profile,config:phases,combatPolicy:{firstTurnTerritorialRestriction:{
 owner:'soviet',turn:1,allowedOpeningHexes:[restricted],targetHexes:[target],
 targetRegionEvidence:{coverage:evidence.targetTerritory.coverage,provenance:evidence.governingRule}
}}}),/Invalid source-defined first-turn territory restriction/);
console.log(`PASS v444: ${checks} Romanian source-evidence / opening-origin assertions; Kiev country mask unverified`);
