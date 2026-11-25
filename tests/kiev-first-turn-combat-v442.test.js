'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Odds=require('../core/historical_combat_odds');
const Declarations=require('../core/historical_combat_declarations');
const G=require('../core/map_movement_graph');
const Kiev=require('../maps/kiev.json');
const L=require('../maps/leningrad.json');
const LProfile=require('../maps/movement-configs/leningrad.json');
const LPhases=require('../maps/phase-configs/leningrad.json');
const cfg=require('../maps/combat-configs/kiev-turn-rules-v442.json');
const policy={source:cfg.source,modifiers:{terrainColumnShifts:{forest:-1,swamp:-1,'major-city':-1},allAttackersAcrossRiverShift:-1,
 swampTankStrengthMultiplier:0.5,swampAffectedClasses:['panzer','mechanized'],maximumOdds:6,
 majorRiverAttackMultiplier:0.5,attackerTurnMultipliers:cfg.attackerTurnMultipliers}};
let n=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++;};
const bad=(f,re)=>{assert.throws(f,re);n++;};
const s=(value,kind='infantry')=>({value,kind});
const input={attackers:[s(4,'mechanized'),s(4,'mechanized'),s(6)],defenders:[s(4)],
 defenderTerrain:'open',allAttackersAcrossRiver:false,policy,attackerIds:['m1','m2','i']};
const out=(actor,turn,more={})=>Odds.evaluate({...input,actor,turn,...more});
// Kiev §10.9: exactly two Soviet Combat phases receive a mechanized bonus.
eq(out('soviet',1).attackStrength,22);
eq(out('soviet',1).finalOdds,5);
eq(out('soviet',2).attackStrength,18);
eq(out('soviet',2).finalOdds,4);
eq(out('soviet',3).attackStrength,14);
eq(out('german',1).attackStrength,14);
eq(out('german',2).attackStrength,14);
eq(out('soviet',2,{defenderTerrain:'forest'}).finalOdds,3);
eq(out('soviet',1,{attackers:[s(4,'infantry'),s(4,'infantry'),s(6)]}).attackStrength,14);
// Major River per-attacker rounding occurs after a source-bound turn modifier.
eq(out('soviet',2,{majorRiverCrossers:['m1']}).attackStrength,15);
eq(out('soviet',1,{defenderTerrain:'swamp'}).attackStrength,14);
bad(()=>Odds.evaluate({...input,turn:1}),/source-bound owner and turn/);
bad(()=>Odds.evaluate({...input,actor:'soviet'}),/source-bound owner and turn/);
bad(()=>Odds.evaluate({...input,actor:'axis',turn:1}),/source-bound owner and turn/);
bad(()=>Odds.evaluate({...input,actor:'soviet',turn:0}),/source-bound owner and turn/);
bad(()=>Odds.evaluate({...input,actor:'soviet',turn:1,policy:{modifiers:{...policy.modifiers,attackerTurnMultipliers:[...cfg.attackerTurnMultipliers,cfg.attackerTurnMultipliers[0]]}}}),/Invalid scenario/);
// Source fragment is kept separate from any game activation.
eq(cfg.scenarioId,'kiev');eq(cfg.status,'source-verified-candidate-not-live-campaign');
eq(cfg.firstTurnCombatRestriction.setupHexes,['0709','0809','0910','1010']);
eq(cfg.notYetIntegrated.sovietRomanianBorderAttacks.includes('0708, 0808 or 1110'),true);
eq(cfg.attackerTurnMultipliers.length,2);
// Actual Kiev map still fails certification: this is NOT a scenario gate bypass.
bad(()=>G.build({...Kiev,sourceImageSHA256:'untrusted-v485-test'}),/source-geometry-not-gameplay-certified/);
// The same generic declaration mechanism is exercised on a *certified*
// Leningrad board with a deliberately SYNTHETIC first-turn restriction.
const board=G.build(L);
const edge=board.edges.find(e=>e.verified&&!e.impassable&&!e.allSea&&!e.lake);
assert.ok(edge);n++;
const r={owner:'german',turn:1,setupHexes:[edge.a]};
const D=Declarations.create({map:L,profile:LProfile,config:LPhases,combatPolicy:{firstTurnCombatRestriction:r}});
const battle=[{defenderHex:edge.b,attackers:['g']}];
const state={scenarioId:'leningrad',units:{g:{id:'g',owner:'german',hex:edge.a,openingHex:edge.a},s:{id:'s',owner:'soviet',hex:edge.b,openingHex:edge.b}}};
const cursor=(turn)=>({scenarioId:'leningrad',turn,index:2,complete:false});
bad(()=>D.declare({cursor:cursor(1),actor:'german',state},battle),/source-designated setup unit cannot attack/);
eq(D.declare({cursor:cursor(2),actor:'german',state},battle).battles.length,1);
eq(D.declare({cursor:cursor(1),actor:'german',state},[]).battles.length,0);
bad(()=>Declarations.create({map:L,profile:LProfile,config:LPhases,combatPolicy:{firstTurnCombatRestriction:{...r,setupHexes:['9999']}}}),/requires an unmoved opening/);
bad(()=>Declarations.create({map:L,profile:LProfile,config:{...LPhases,firstTurnStart:'soviet-combat'},combatPolicy:{firstTurnCombatRestriction:r}}),/requires an unmoved opening/);
// A nonconfigured historical scenario keeps its prior declaration behavior.
const legacy=Declarations.create({map:L,profile:LProfile,config:LPhases});
eq(legacy.declare({cursor:cursor(1),actor:'german',state},battle).battles.length,1);
// The real consequence resolver must use the SAME turn bonuses as the
// preview. Use authentic photographed Leningrad counters on its certified
// source board, with a SYNTHETIC temporary German bonus to prove the generic
// transaction flow. This does not create a Leningrad rule or activate Kiev.
const Bridge=require('../core/scenario_opening_bridge');
const Phase=require('../core/historical_combat_phase');
const K=require('../maps/counter-configs/leningrad.json');
const setup=require('../maps/setup/leningrad.json');
const inventory=require('../core/leningrad_starting_inventory');
const fixture=require('./fixtures/leningrad-source-setup-v357');
const Q=require('../maps/combat-configs/leningrad.json');
const b=Bridge.create({map:L,setupSpec:setup,counterConfig:K,inventory,
 allocation:fixture.selected,placements:fixture.placements,phaseConfig:LPhases,movementProfile:LProfile,
 phaseFactories:{combat:ctx=>Phase.create({...ctx,counterConfig:K,combatPolicy:Q})}});
const opening=b.snapshot();
const german8=Object.values(opening.state.units).find(x=>x.hex==='0310'&&x.owner==='german'&&x.printedCombatStrength===8);
const soviet3=Object.values(opening.state.units).find(x=>x.hex==='0309'&&x.owner==='soviet'&&x.printedCombatStrength===3);
assert.ok(german8&&soviet3);n++;
const syntheticPolicy=structuredClone(Q);
syntheticPolicy.modifiers.attackerTurnMultipliers=cfg.attackerTurnMultipliers.map(x=>({...x,owner:'german',kind:'infantry'}));
const syntheticOpeningRestriction=structuredClone(Q);
syntheticOpeningRestriction.firstTurnCombatRestriction={owner:'german',turn:1,setupHexes:['0310']};
bad(()=>Phase.create({map:L,profile:LProfile,config:LPhases,
 cursor:{scenarioId:'leningrad',turn:1,index:2,complete:false},actor:'german',
 state:opening.state,counterConfig:K,combatPolicy:syntheticOpeningRestriction})
 .commit([{defenderHex:'0309',attackers:[german8.id]}]),/source-designated setup unit cannot attack/);
eq(Phase.create({map:L,profile:LProfile,config:LPhases,
 cursor:{scenarioId:'leningrad',turn:2,index:2,complete:false},actor:'german',
 state:opening.state,counterConfig:K,combatPolicy:syntheticOpeningRestriction})
 .commit([{defenderHex:'0309',attackers:[german8.id]}]).snapshot().status,'committed');
for(const [turn,odds] of [[1,5],[2,4],[3,2]]){
 const cursor={scenarioId:'leningrad',turn,index:2,complete:false};
 const phase=Phase.create({map:L,profile:LProfile,config:LPhases,cursor,actor:'german',
  state:opening.state,counterConfig:K,combatPolicy:syntheticPolicy})
  .commit([{defenderHex:'0309',attackers:[german8.id]}]).select('0309');
 const preview=phase.evaluateSelectedFromMap({strengths:{
  [german8.id]:s(8),[soviet3.id]:s(3)},die:6});
 eq(preview.finalOdds,odds,`Synthetic turn ${turn} preview uses source strength + configured bonus`);
 const resolved=phase.resolveSelected({die:6});
 eq(resolved.event.odds,odds,`Synthetic turn ${turn} actual CRT transaction matches preview`);
 eq(resolved.event.outcome,preview.crtResult);
 eq(phase.snapshot().state.units[soviet3.id].hex,'0309','pre-resolution state is immutable');
}
// Guard against unintended changes in approved exports and art: game code has no map mutation.
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../references/rules/kiev-rules.pdf'));
eq(crypto.createHash('sha256').update(source).digest('hex'),cfg.sourceSha256,'Exact source PDF pinned');
console.log(`PASS Kiev §§10.8–10.9 isolated shared-engine rules: ${n} assertions; Kiev live gate closed`);
