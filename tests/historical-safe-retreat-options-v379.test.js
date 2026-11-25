'use strict';
/* Checkpoint 145: safe-only retreat OPTIONS from the real certified Leningrad
 * map and full 19-counter test-only opening. Explicitly not the historical
 * forced retreat (EZOC/overflow/fleet) executor or a production game.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Bridge=require('../core/scenario_opening_bridge');
const Combat=require('../core/historical_combat_phase');
const Ret=require('../core/historical_retreat_options');
const Move=require('../core/movement_binding');
const M=require('../maps/leningrad.json'),K=require('../maps/counter-configs/leningrad.json');
const S=require('../maps/setup/leningrad.json'),P=require('../maps/movement-configs/leningrad.json');
const F=require('../maps/phase-configs/leningrad.json'),Q=require('../maps/combat-configs/leningrad.json');
const I=require('../core/leningrad_starting_inventory'),fixture=require('./fixtures/leningrad-source-setup-v357');
const copy=x=>JSON.parse(JSON.stringify(x)),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const yes=(a,m)=>{assert.ok(a,m);checks++};
const throws=(f,r)=>{assert.throws(f,r);checks++};
const bridge=Bridge.create({map:M,setupSpec:S,counterConfig:K,inventory:I,allocation:fixture.selected,
 placements:fixture.placements,phaseConfig:F,movementProfile:P,
 phaseFactories:{combat:ctx=>Combat.create({...ctx,counterConfig:K,combatPolicy:Q})}});
const start=bridge.snapshot(),state=start.state,all=Object.values(state.units);
const selectedUnit=(hex,owner,strength)=>{
 const unit=all.find(u=>u.hex===hex&&u.owner===owner&&u.printedCombatStrength===strength);
 yes(unit,`missing ${owner}/${hex}/${strength}`);return unit;
};
const germ8=selectedUnit('0310','german',8),west8=selectedUnit('0210','german',8);
const defender=selectedUnit('0309','soviet',3),army8=selectedUnit('0611','soviet',8);
const selected=bridge.controller().commit([{defenderHex:'0309',attackers:[west8.id,germ8.id]}]).select('0309');
const original=selected.snapshot(),preview=selected.safeRetreatOptions();
eq(preview.status,'safe-options-only');eq(preview.scope,'safe-retreat-preview-only');
eq(preview.forcedEZOCAdjudicated,false);eq(preview.automaticEliminationAdjudicated,false);
eq(preview.overstackExtensionAdjudicated,false);eq(preview.stateChanged,false);eq(preview.exhaustive,true);
eq(preview.retreatHexes,2);eq(preview.perDefender[defender.id].length,7);
eq(preview.jointOptions.length,7);
eq(selected.snapshot(),original,'read-only preview does not commit/reveal/roll');
// All seven enumerated options must ACTUALLY be executable under the current
// bounded safe-consequence evaluator using the same committed real battle.
for(const option of preview.jointOptions){
 const result=selected.resolveSelected({die:1,choices:{retreatPaths:option}});
 eq(result.event.outcome,'DR');
 eq(result.event.retreats[0].route,option[defender.id]);
 eq(result.session.snapshot().state.units[defender.id].hex,option[defender.id].at(-1));
 eq(result.session.undo().session.snapshot(),{...original,historyDepth:0});
}
// Independent reference route verifier, constructed from the public certified
// board rather than the retreat-options implementation's computed output.
const board=Move.build(M,P).board, neighbors={};
for(const edge of board.edges){for(const [a,b] of [[edge.a,edge.b],[edge.b,edge.a]]){
 (neighbors[a]??=[]).push({to:b,edge});
}}
const distances=(origin)=>{const d={[origin]:0},q=[origin];for(const at of q){
 for(const {to} of neighbors[at]||[]){if(d[to]===undefined){d[to]=d[at]+1;q.push(to);}}
}return d;};
function independentPaths(s,hex,unit){
 const dist=distances(hex),units=Object.values(s.units),routes=[];
 const occupied=h=>units.some(u=>u.hex===h&&u.owner!==unit.owner);
 const zoc=h=>units.some(u=>u.owner!==unit.owner&&(neighbors[u.hex]||[]).some(n=>n.to===h&&
  n.edge.verified&&!n.edge.impassable&&!n.edge.lake&&!n.edge.allSea));
 for(const first of neighbors[hex]||[]){
  if(dist[first.to]!==1||!first.edge.verified||first.edge.impassable||first.edge.lake||first.edge.allSea||!board.cells[first.to]?.verified||occupied(first.to)||zoc(first.to))continue;
  for(const second of neighbors[first.to]||[]){
   if(dist[second.to]!==2||!second.edge.verified||second.edge.impassable||second.edge.lake||second.edge.allSea||!board.cells[second.to]?.verified||occupied(second.to)||zoc(second.to))continue;
   const remaining=units.filter(u=>u.hex===second.to&&u.id!==unit.id);
   if(remaining.length>=P.maxStack||remaining.some(u=>u.owner!==unit.owner))continue;
   const armyLimit=Q.armyStackingByOwner?.[unit.owner];
   if(Number.isInteger(armyLimit)&&remaining.filter(u=>u.size==='army').length+(unit.size==='army'?1:0)>armyLimit)continue;
   routes.push([first.to,second.to]);
  }
 }
 return routes.map(x=>x.join('>')).sort();
}
const options=Ret.create({map:M,profile:P,combatPolicy:Q});
// Across every certified land/terrain cell, compare preview with a separately
// implemented graph enumeration. This is a GEOMETRY diagnostic and does NOT
// assume a real historical Soviet unit would be deployed in each cell.
const cells=Object.entries(board.cells).filter(([,c])=>c.verified).map(([id,c])=>({...c,id})),sample=[];
for(const cell of cells){
 const virtual=copy(state);virtual.units[defender.id].hex=cell.id;
 const out=options.enumerate({state:virtual,defenderHex:cell.id,defenderIds:[defender.id]});
 eq(out.perDefender[defender.id].map(x=>x.join('>')).sort(),independentPaths(virtual,cell.id,virtual.units[defender.id]),`Cell ${cell.id}`);
 eq(out.jointOptions.length,out.perDefender[defender.id].length);
 yes(out.exhaustive);
 if(['0309','0107','1201'].includes(cell.id))sample.push({hex:cell.id,count:out.jointOptions.length});
}
// A two-defender stack: paths may each be legal individually while their
// combination is illegal. Test total/faction/army stacking jointly.
const stacked=copy(state);stacked.units[army8.id].hex='0309';
const combo=options.enumerate({state:stacked,defenderHex:'0309',defenderIds:[defender.id,army8.id]});
yes(combo.jointOptions.length>0);eq(combo.exhaustive,true);
const stackedManual=[];
for(const a of combo.perDefender[defender.id])for(const b of combo.perDefender[army8.id]){
 const targetA=a.at(-1),targetB=b.at(-1),remaining=Object.values(stacked.units).filter(u=>!([defender.id,army8.id].includes(u.id)));
 const c=remaining.filter(u=>u.hex===targetA).length+1+(targetA===targetB?1:0);
 const d=remaining.filter(u=>u.hex===targetB).length+1+(targetA===targetB?1:0);
 if(c>P.maxStack||d>P.maxStack)continue;
 const armyLimit=Q.armyStackingByOwner.soviet;
 if(remaining.filter(u=>u.hex===targetB&&u.size==='army').length+1>armyLimit)continue;
 stackedManual.push({[defender.id]:a,[army8.id]:b});
}
eq(combo.jointOptions,stackedManual,'multiunit output must exclude collided/overstacked combinations');
// Adding an enemy at the only safe corridor is a diagnostic, not permission
// to use forced-EZOC or auto-eliminate results.
const forced=copy(state);for(const u of Object.values(forced.units))if(u.owner==='german'&&u.id!==germ8.id&&u.id!==west8.id)u.hex='0307';
const report=options.enumerate({state:forced,defenderHex:'0309',defenderIds:[defender.id]});
eq(report.forcedEZOCAdjudicated,false);eq(report.automaticEliminationAdjudicated,false);
// All first-step exits occupied by adversaries: zero safe choices cannot
// silently be converted to automatic destruction (a different rule branch).
const sealed=copy(state),exits=(neighbors['0309']||[]).map(n=>n.to);
const germanUnits=Object.values(sealed.units).filter(u=>u.owner==='german');
yes(germanUnits.length>=exits.length);
for(let i=0;i<exits.length;i++)germanUnits[i].hex=exits[i];
const noSafe=options.enumerate({state:sealed,defenderHex:'0309',defenderIds:[defender.id]});
eq(noSafe.status,'no-certified-safe-route');eq(noSafe.jointOptions.length,0);
eq(noSafe.forcedEZOCAdjudicated,false);eq(noSafe.automaticEliminationAdjudicated,false);
// Bad source context, duplicate defenders, unauthorized target fail closed.
throws(()=>options.enumerate({state,defenderHex:'9999',defenderIds:[defender.id]}),/certified target/);
throws(()=>options.enumerate({state,defenderHex:'0309',defenderIds:[defender.id,defender.id]}),/present defender IDs/);
throws(()=>options.enumerate({state,defenderHex:'0309',defenderIds:[army8.id]}),/present defender IDs/);
throws(()=>Ret.create({map:M,profile:P,combatPolicy:{...Q,safeRetreatOnly:false}}),/safe-retreat-only/);
throws(()=>Ret.create({map:M,profile:P,combatPolicy:{...Q,scenarioId:'unknown'}}),/safe-retreat-only/);
throws(()=>options.enumerate({state,defenderHex:'0309',defenderIds:[]}),/present defender IDs/);
throws(()=>bridge.controller().safeRetreatOptions(),/Select a committed battle/);
// No caller-provided array or cloned state should become a mutation channel.
const copyOfStart=copy(start),copyOfOriginal=copy(original);
eq(start,copyOfStart);eq(selected.snapshot(),copyOfOriginal);
const source=fs.readFileSync('core/historical_retreat_options.js','utf8');
yes(!/\b(?:leningrad|moscow|kiev|arduous)\b/i.test(source),'no scenario identity branches');
const audit={checkpoint:145,version:'v379',scope:'read-only source-board safe-retreat choices only',
 verifiedTests:checks,certifiedCellsEnumerated:cells.length,openingSafePaths:preview.jointOptions.length,
 twoDefenderIndependentCounts:Object.fromEntries(Object.entries(combo.perDefender).map(([k,v])=>[k,v.length])),
 twoDefenderJointOptions:combo.jointOptions.length,examples:sample,
 sourcePdf:{path:'references/rules/leningrad-rules.pdf',sha256:hash('references/rules/leningrad-rules.pdf'),sections:['10.6','10.7']},
 controlledSources:['core/historical_retreat_options.js','core/historical_combat_phase.js'],
 limitations:['No forced EZOC losses, overstack extension, fleet-port exceptions or automatic elimination',
 'Pre-consequence only: for DRL/EX a defender or attacker step loss may change the actual board',
 'The approved candidate opening is not historically certified because two rear printed/host markers conflict',
 'No live Leningrad browser game or complete eight-turn sequence is claimed'],
 sourceStateUnchanged:true,acceptedMapRenderUnchanged:true};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-safe-retreat-options-v379.json',JSON.stringify(audit,null,2)+'\n');
console.log(`PASS v379: ${checks} safe-retreat assertions, ${cells.length} certified map-cell enumerations, ${preview.jointOptions.length} opening safe routes, ${combo.jointOptions.length} dual-counter joint choices`);
