'use strict';
/* Checkpoint 146: source-based forced EZOC and physically blocked retreat
 * adjudication in the shared, opt-in historical transaction. Not an 8-turn
 * Leningrad rules or original-executable parity test. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const R=require('../core/historical_forced_retreat'),Safe=require('../core/historical_retreat_options'),Bridge=require('../core/scenario_opening_bridge');
const Combat=require('../core/historical_combat_phase'),Move=require('../core/movement_binding');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory'),fixture=require('./fixtures/leningrad-source-setup-v357');
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const yes=(v,m)=>{assert.ok(v,m);checks++};
const bad=(fn,re)=>{assert.throws(fn,re);checks++};
const br=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,
 allocation:fixture.selected,placements:fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:ctx=>Combat.create({...ctx,counterConfig:K,combatPolicy:Q})}});
const opening=br.snapshot(),state=opening.state,units=Object.values(state.units),
 soldier=units.find(x=>x.owner==='soviet'&&x.hex==='0309'),
 army=units.find(x=>x.owner==='soviet'&&x.hex==='0611'&&x.printedCombatStrength===8),
 west=units.find(x=>x.owner==='german'&&x.hex==='0210'&&x.printedCombatStrength===8),
 south=units.find(x=>x.owner==='german'&&x.hex==='0310'&&x.printedCombatStrength===8),
 spare=['leningrad-front-r04c01','leningrad-front-r04c02'];
yes(soldier&&army&&west&&south&&spare.every(x=>state.units[x]));
const solver=R.create({map:M,profile:P,combatPolicy:Q,counterConfig:K}),
 board=Move.build(M,P).board;
eq(board.edges.filter(edge=>!edge.verified).length,0,'complete certified edge graph');
eq(Object.values(board.cells).filter(cell=>!cell.verified).every(cell=>cell.terrain==='sea'),true,
 'uncertified land would make no-route elimination unsafe');
const initial=solver.enumerate({state,defenderHex:'0309',defenderIds:[soldier.id]});
eq(initial.status,'certified-forced-retreat-options');
eq(initial.minimumExposedUnits,0);eq(initial.combinations.length,7);
yes(initial.combinations.every(x=>x[soldier.id].zocHexes.length===0));
const sourceBefore=copy(opening);
function combat(s,ids=[west.id,south.id]){
 return Combat.create({map:M,profile:P,config:F,cursor:opening.cursor,actor:opening.actor,
  state:s,counterConfig:K,combatPolicy:Q})
   .commit([{defenderHex:'0309',attackers:ids}]).select('0309');
}
// A FULL 8-4 Soviet Army must retreat through one unavoidable EZOC. Source
// face 8-4 -> 4-4; a safe second destination is available. No hidden die.
const forced=copy(state);
forced.units[soldier.id].hex='0611';forced.units[army.id].hex='0309';
forced.units[spare[0]].hex='0308';forced.units[spare[1]].hex='0211';
const forcedBefore=copy(forced),r=solver.enumerate({state:forced,defenderHex:'0309',defenderIds:[army.id]});
eq(r.status,'certified-forced-retreat-options');eq(r.minimumExposedUnits,1);
yes(r.combinations.some(x=>JSON.stringify(x[army.id].route)===JSON.stringify(['0409','0508'])));
yes(r.combinations.some(x=>x[army.id].zocHexes.length===2),'unavoidable multiple-EZOC options must not be suppressed');
const chosen={retreatPaths:{[army.id]:['0409','0508']}},ph=combat(forced),snap=ph.snapshot();
const res=ph.resolveSelected({die:1,choices:chosen});
eq(res.event.outcome,'DR');eq(res.event.scope,'verified-effects-forced-retreat-bounded');
eq(res.event.losses.length,1);
eq(res.event.losses[0].reason,'forced-retreat-ezoc');eq(res.event.losses[0].hex,'0409');
eq(res.event.losses[0].removed,false);eq(res.session.snapshot().state.units[army.id].printedCombatStrength,4);
eq(res.session.snapshot().state.units[army.id].strengthStatus,'printed-reduced');
eq(res.session.snapshot().state.units[army.id].hex,'0508');
eq(res.event.retreats[0].route,['0409','0508']);
eq(ph.snapshot(),snap,'effect must not mutate the selected controller');
eq(res.session.undo().session.snapshot(),{...snap,historyDepth:0});
eq(forced,forcedBefore,'source input remains immutable');
// A route ending in an EZOC eliminates the Army even AFTER its one EZOC step loss.
const doomed=combat(forced).resolveSelected({die:1,choices:{retreatPaths:{[army.id]:['0209','0208']}}});
eq(doomed.event.outcome,'DR');
eq(doomed.session.snapshot().state.units[army.id],undefined);
eq(doomed.event.losses.length,2);
eq(doomed.event.losses[0].removed,false);eq(doomed.event.losses[1].removed,true);
eq(doomed.event.losses[0].reason,'forced-retreat-ezoc');
eq(doomed.event.losses[1].reason,'retreat-ended-in-ezoc');
eq(doomed.event.losses.filter(l=>l.reason==='forced-retreat-ezoc').length,1,
 'multiple EZOC hexes still cost exactly one retreat step');
eq(doomed.event.retreats.length,0);
// EX losses occur BEFORE the forced retreat. The defender is first reduced,
// German attacker pays the exchange, then the same defender dies in EZOC.
const ex=combat(forced).resolveSelected({die:3,choices:{defenderLossId:army.id,
 attackerLossIds:[west.id],retreatPaths:{[army.id]:['0409','0508']}}});
eq(ex.event.outcome,'EX');eq(ex.event.losses.length,3);
eq(ex.event.losses[0].unitId,army.id);eq(ex.event.losses[0].removed,false);
eq(ex.event.losses[1].unitId,west.id);eq(ex.event.losses[1].removed,false);
eq(ex.event.losses[2].unitId,army.id);eq(ex.event.losses[2].removed,true);
eq(ex.event.losses[2].reason,'forced-retreat-ezoc');
eq(ex.session.snapshot().state.units[army.id],undefined);
eq(ex.session.snapshot().state.units[west.id].printedCombatStrength,4);
eq(ex.session.undo().session.snapshot().state.units[army.id].printedCombatStrength,8);
// A terminal EZOC eliminates even after a first forced step loss.
yes(doomed.event.losses.some(x=>x.reason==='forced-retreat-ezoc'));
// Missing, forged or safe-route-contradicting choices are rejected atomically.
bad(()=>ph.resolveSelected({die:1}),/Complete retreat paths/);
bad(()=>ph.resolveSelected({die:1,choices:{retreatPaths:{[army.id]:['9999','0508']}}}),/outward/);
bad(()=>ph.resolveSelected({die:1,choices:{retreatPaths:{[army.id]:['0308','0307']}}}),/outward/);
eq(ph.snapshot(),snap);
// No PHYSICAL outward two-hex path: automatic elimination, no invented move.
const exits=new Set();for(const e of board.edges){
 if(e.a==='0309')exits.add(e.b);if(e.b==='0309')exits.add(e.a);
}
const sealed=copy(state),germans=Object.values(sealed.units).filter(x=>x.owner==='german');
yes(germans.length>=exits.size);
for(const [i,hex] of [...exits].entries())sealed.units[germans[i].id].hex=hex;
const sealedReport=solver.enumerate({state:sealed,defenderHex:'0309',defenderIds:[soldier.id]});
eq(sealedReport.perDefender[soldier.id].noPhysicalRoute,true);
eq(sealedReport.combinations.length,1);eq(sealedReport.combinations[0][soldier.id],null);
// Recheck the no-path case through the real phase/transaction, with the
// original distinct-side German attackers left at their baseline hexes.
const sealedBattle=copy(state), keep=new Set([west.id,south.id]);
const remainingExits=[...exits].filter(x=>!['0210','0310'].includes(x));
const blockers=Object.values(sealedBattle.units).filter(x=>x.owner==='german'&&!keep.has(x.id));
yes(blockers.length>=remainingExits.length);
for(let i=0;i<remainingExits.length;i++)sealedBattle.units[blockers[i].id].hex=remainingExits[i];
const phaseSealed=combat(sealedBattle),closed=phaseSealed.resolveSelected({die:1});
eq(closed.event.outcome,'DR');eq(closed.session.snapshot().state.units[soldier.id],undefined);
eq(closed.event.losses.at(-1).reason,'no-legal-retreat');
eq(closed.event.retreats,[]);
eq(closed.session.undo().session.snapshot(),{...phaseSealed.snapshot(),historyDepth:0});
const sealedBefore=copy(sealed);
const erased=solver.apply({state:sealed,defenderHex:'0309',defenderIds:[soldier.id],loseStep:()=>{throw Error('No step loss expected');}});
eq(erased.losses[0].reason,'no-legal-retreat');eq(erased.losses[0].removed,true);
eq(sealed.units[soldier.id],undefined);eq(sealedBefore.units[soldier.id].hex,'0309');
// Physical outward routes that ONLY lead to overstacked destinations must
// never be interpreted as eliminate-all: §10.6 explicitly extends retreat.
const blocked={scenarioId:'leningrad',units:{[army.id]:{...copy(army),hex:'0309'}}};
const bare=solver.enumerate({state:blocked,defenderHex:'0309',defenderIds:[army.id]});
const endpoints=new Set(bare.combinations.map(x=>x[army.id].route.at(-1)));
for(const [i,hex] of [...endpoints].entries()){
 for(let j=0;j<2;j++)blocked.units[`virtual-friendly-${i}-${j}`]={id:`virtual-friendly-${i}-${j}`,hex,owner:'soviet',size:'corps'};
}
const blockedBefore=copy(blocked),audit=solver.enumerate({state:blocked,defenderHex:'0309',defenderIds:[army.id]});
eq(audit.status,'certified-forced-retreat-options');eq(audit.needsOverstackExtension,true);
yes(audit.combinations.length>0&&audit.combinations.every(combo=>combo[army.id].route.length===3));
bad(()=>solver.apply({state:blocked,defenderHex:'0309',defenderIds:[army.id],paths:{},loseStep:()=>{}}),/Complete retreat paths/);
eq(blocked,blockedBefore,'overstack blocker cannot mutate game state');
// The complete source-backed certified movement graph agrees with the prior
// safe-only enumerator when a no-EZOC legal retreat exists. This checks the
// forced module against an independently developed, accepted engine path.
const safe=Safe.create({map:M,profile:P,combatPolicy:Q}),certified=Object.entries(board.cells)
 .filter(([,c])=>c.verified).map(([id])=>id);let compared=0;
for(const hex of certified){
 const virtual=copy(state);virtual.units[soldier.id].hex=hex;
 const baseline=safe.enumerate({state:virtual,defenderHex:hex,defenderIds:[soldier.id]});
 const newer=solver.enumerate({state:virtual,defenderHex:hex,defenderIds:[soldier.id]});
 if(newer.minimumExposedUnits===0&&!newer.needsOverstackExtension&&!newer.perDefender[soldier.id].noPhysicalRoute){
  const a=newer.combinations.map(c=>c[soldier.id].route.join('>')).sort();
  const b=baseline.perDefender[soldier.id].map(c=>c.join('>')).sort();
  eq(a,b,`safe route consistency at ${hex}`);compared++;
 }
}
yes(compared>50,'sufficient certified no-EZOC comparisons');
// Two stacked defenders: the optional source-backed selector validates
// combinations, rather than trusting individual endpoints independently.
const pair=copy(state);pair.units[army.id].hex='0309';
const joint=solver.enumerate({state:pair,defenderHex:'0309',defenderIds:[soldier.id,army.id]});
eq(joint.status,'certified-forced-retreat-options');eq(joint.combinations.length,45);
yes(joint.combinations.every(combo=>Object.values(combo).every(x=>x&&x.zocHexes.length===0)));
const pressured=copy(pair);pressured.units[spare[0]].hex='0308';pressured.units[spare[1]].hex='0211';
const jointForced=solver.enumerate({state:pressured,defenderHex:'0309',defenderIds:[soldier.id,army.id]});
eq(jointForced.status,'certified-forced-retreat-options');yes(jointForced.combinations.length>0);
yes(jointForced.combinations.every(combo=>Object.values(combo).every(x=>x&&x.zocHexes.length>=1)));
for(const combo of jointForced.combinations){
 const final=copy(pressured),to=Object.fromEntries(Object.entries(combo).map(([id,choice])=>[id,choice.route]));
 const effect=solver.apply({state:final,defenderHex:'0309',defenderIds:[soldier.id,army.id],paths:to,
  loseStep:(s,id)=>{
   if(id===soldier.id){delete s.units[id];return {unitId:id,removed:true};}
   s.units[id].strengthStatus='printed-reduced';return {unitId:id,removed:false};
  }});
 yes(effect.losses.some(l=>l.unitId===soldier.id&&l.removed));
 for(const survivor of effect.retreats){
  const residents=Object.values(final.units).filter(x=>x.hex===survivor.to);
  yes(residents.length<=P.maxStack);
  yes(residents.filter(x=>x.size==='army').length<=Q.armyStackingByOwner.soviet);
 }
}
// Unconfigured policy cannot silently route into the forced-loss handler.
bad(()=>R.create({map:M,profile:P,combatPolicy:{...Q,retreatMode:'other'}}),/Explicit two-hex/);
const legacy=Combat.create({map:M,profile:P,config:F,cursor:opening.cursor,actor:opening.actor,
 state:opening.state,counterConfig:K,combatPolicy:{...Q,retreatMode:undefined}})
 .commit([{defenderHex:'0309',attackers:[west.id,south.id]}]).select('0309');
eq(legacy.resolveSelected({die:1,choices:{retreatPaths:{[soldier.id]:['0308','0307']}}}).event.scope,'verified-effects-safe-retreat-only');
bad(()=>Combat.create({map:M,profile:P,config:F,cursor:opening.cursor,actor:opening.actor,
 state:opening.state,counterConfig:K,combatPolicy:{...Q,retreatMode:'invented'}})
 .commit([{defenderHex:'0309',attackers:[west.id,south.id]}]).select('0309').resolveSelected({die:1,choices:{}}),/Unsupported historical retreat/);
const text=fs.readFileSync('core/historical_forced_retreat.js','utf8');
yes(!/\b(?:leningrad|moscow|kiev|arduous)\b/i.test(text),'engine module must not contain scenario branches');
eq(br.snapshot(),sourceBefore);
const auditReport={checkpoint:146,version:'v380',scope:'opt-in, source-bound forced EZOC and physically blocked two-hex retreat; overstack-only and Fleet exceptions blocked',
 assertions:checks,certifiedCellsChecked:certified.length,safeOptionComparisonCells:compared,forcedStep:{sourceStrengthBefore:8,after:4,route:['0409','0508']},
 forcedElimination:{route:['0209','0208'],oneEZOCStepLoss:true,terminalEZOCElimination:true},noPhysicalExitElimination:true,exchangePostLossForcedElimination:true,
 overstackOnlyFailsClosed:true,sourcePdf:'references/rules/leningrad-rules.pdf §§7.2,7.4,8.1,10.6,13.2',
 sourcePdfSha256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/leningrad-rules.pdf')).digest('hex'),
 knownLimitations:['No overstack extension or Fleet-port exception; no eight-turn human gameplay',
  'No independent historical executable comparison; synthetic adversarial arrangements are bounded structural tests',
  'The safe-only pre-combat preview is not a forced/post-loss preview']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-forced-retreat-v380.json',JSON.stringify(auditReport,null,2)+'\n');
console.log(`PASS v380: ${checks} forced-retreat, post-combat, Undo and fail-closed assertions`);
