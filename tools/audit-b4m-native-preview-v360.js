#!/usr/bin/env node
/* Bounded differential audit. All reference judgments come from the original
 * B4M package and its existing executable baseline; this is NOT full parity. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),pdir=path.join(root,'games/battle-for-moscow');
const core=require('../core/engine.js'),legacy=require('../legacy/engine.js'),adapter=require('../core/adapter.js'),preview=require('../core/native_preview_config.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function load(){
 const original=Object.fromEntries(['game','map','units','deployments','rules','objectives'].map(k=>[k,JSON.parse(fs.readFileSync(path.join(pdir,k+'.json'),'utf8'))]));
 const config=JSON.parse(fs.readFileSync(path.join(pdir,'native-preview/config.json'),'utf8'));
 return {original,config};
}
function run(){
 const {original,config}=load(),originalJson=JSON.stringify(original),configJson=JSON.stringify(config);
 assert.equal(original.game.engine,'generic-hex-v1','Production B4M route must remain unchanged');
 const packageNative=preview.project(original,config),validation=core.validatePackage(packageNative);
 assert.equal(validation.engine,'generic-hex-v1');
 const g=core.build(packageNative),lc=legacy.buildScenario(adapter.legacyScenario(original),adapter.legacyProfile(original));
 const old=legacy.makeState(lc,17),native=core.start(g,17,'auto-reference');
 assert.equal(native.units.length,old.units.length);
 assert.equal(native.units.filter(u=>u.position).length,old.units.filter(u=>u.position).length);
 assert.deepEqual(Object.fromEntries(native.units.map(u=>[u.id,u.position||null])),Object.fromEntries(old.units.map(u=>[u.id,u.position||null])));
 assert.deepEqual(native.control,old.control,'All cities must preserve original initial ownership');
 assert.equal(core.currentPhase(g,native).id,'combat');
 assert.equal(original.map.cells.length,147);
 assert.equal(native.units.length,39);
 assert.equal(Object.keys(native.control).length,11);
 assert.equal(Object.keys(config.overrides.deployments.presets[0].units).length,22);
 // The shared coordinate topology and the legacy Honeycomb grid must agree.
 let edgeChecks=0;
 for(const h of lc.raw.hexes){
  const a=legacy.neighbours(lc,h.x,h.y).map(n=>`${n.dir}:${n.x},${n.y}`).sort();
  const b=core.neighbors(h.x,h.y).filter(n=>g.playable(n.x,n.y)).map(n=>`${n.dir}:${n.x},${n.y}`).sort();
  assert.deepEqual(b,a,`Hexside mismatch at ${h.x},${h.y}`);edgeChecks+=a.length;
 }
 const projectionSummary={scenario:original.game.id,engine:'generic-hex-v1',productionEngine:original.game.engine,unitCount:native.units.length,startingUnitCount:native.units.filter(u=>u.position).length,cityControls:Object.keys(native.control).length,initialPhase:core.currentPhase(g,native).id,topologyDirectedEdges:edgeChecks,executedModules:validation.executedModules};
 let movementContexts=0,movementOptions=0,normalOptions=0,railOptions=0,panzerOptions=0;
 let replacementContexts=0,replacementOptions=0,oddsCases=0,initialBattles=0;
 for(let turn=1;turn<=7;turn++)for(const side of ['german','soviet']){
  const lstate=copy(old),nstate=copy(native);lstate.turn=nstate.turn=turn;lstate.side=nstate.side=side;
  for(const mode of ['normal',side==='german'?'panzer':'rail']){
   lstate.phase=mode==='normal'?'movement':'special';nstate.phaseIndex=packageNative.rules.phasesBySide[side].findIndex(p=>p.movementMode===mode);
   assert.notEqual(nstate.phaseIndex,-1);
   for(const unit of lstate.units.filter(u=>u.army===side&&u.position&&(mode!=='panzer'||u.type==='tank'))){
    const reference=legacy.legalMoves(lc,lstate,unit,mode),actual=core.legalMoves(g,nstate,unit.id);
    // Compare the entire route, not merely the destination: paths, costs and
    // ordering are UX-relevant for movement/rail destinations.
    assert.deepEqual(actual,reference,`Movement path mismatch: turn ${turn}, ${side}, ${mode}, ${unit.id}`);
    movementContexts++;movementOptions+=actual.length;
    if(mode==='normal')normalOptions+=actual.length;
    if(mode==='panzer')panzerOptions+=actual.length;
    if(mode==='rail')railOptions+=actual.length;
   }
  }
  lstate.phase='replacement';nstate.phaseIndex=0;
  const b1=legacy.replacementBudget(lc,lstate),b2=core.replacementBudget(g,nstate);
  assert.equal(b2,b1,`Replacement budget mismatch: turn ${turn}, ${side}`);
  const normalized=x=>[x.type,x.id,x.x??null,x.y??null].join(':');
  const ro=legacy.replacementOptions(lc,lstate).map(normalized).sort(),rn=core.replacementOptions(g,nstate).map(normalized).sort();
  assert.deepEqual(rn,ro,`Replacement options mismatch: turn ${turn}, ${side}`);
  replacementContexts++;replacementOptions+=rn.length;
 }
 // Audit odds at every legal board edge for both sides, on clear and mud turns.
 // Synthetic two-counter scenarios test the combat calculation only; they do
 // not certify the legality of a campaign battle or the result consequences.
 for(const turn of [2,3])for(const side of ['german','soviet']){
  const lstate=copy(old),nstate=copy(native);lstate.turn=nstate.turn=turn;lstate.side=nstate.side=side;
  lstate.phase='combat';nstate.phaseIndex=packageNative.rules.phasesBySide[side].findIndex(p=>p.kind==='combat');
  for(const u of lstate.units){u.position=null;u.strength='dead';}
  const attacker=lstate.units.find(u=>u.army===side&&u.type==='infantry'),defender=lstate.units.find(u=>u.army!==side&&u.type==='infantry');
  assert.ok(attacker&&defender);
  for(const hex of lc.raw.hexes)for(const near of legacy.neighbours(lc,hex.x,hex.y)){
   attacker.position={x:near.x,y:near.y};attacker.strength='full';
   defender.position={x:hex.x,y:hex.y};defender.strength='full';
   nstate.units=lstate.units;
   const o=legacy.battleOdds(lc,lstate,[attacker],defender),r=core.combatOdds(g,nstate,[attacker.id],defender.id);
   assert.ok(r,`Native combat odds rejected ${side} ${near.x},${near.y} -> ${hex.x},${hex.y}`);
   assert.equal(r.raw,o.raw,`Raw odds at ${hex.x},${hex.y}`);
   assert.equal(r.odds,o.odds,`Adjusted odds at ${hex.x},${hex.y}`);
   assert.equal(r.attackerStrength,o.attackerStrength);
   assert.equal(r.defenderStrength,o.defenderStrength);
   oddsCases++;
  }
 }
 const sourceBattleState=copy(old),nativeBattleState=copy(native);
 sourceBattleState.phase='combat';nativeBattleState.phaseIndex=packageNative.rules.phasesBySide.german.findIndex(p=>p.kind==='combat');
 for(const b of legacy.attackCandidates(lc,sourceBattleState,'german')){
  const x=core.combatOdds(g,nativeBattleState,b.attackers,b.defender);
  assert.ok(x);assert.equal(x.odds,b.odds);assert.equal(x.raw,b.raw);initialBattles++;
 }
 assert.equal(initialBattles,30);
 // First shared phases should reproduce the legacy opening handoff.
 const cursor=copy(native);
 assert.equal(core.endPhase(g,cursor),true);assert.equal(core.currentPhase(g,cursor).id,'movement');
 assert.equal(core.endPhase(g,cursor),true);assert.equal(cursor.side,'soviet');assert.equal(core.currentPhase(g,cursor).id,'replacement');
 const initialVictory=core.result(g,native),originalVictory=legacy.gameResult(lc,old);
 assert.equal(initialVictory,originalVictory,'Baseline victory evaluation mismatch');
 assert.equal(JSON.stringify(original),originalJson,'Source package mutated');
 assert.equal(JSON.stringify(config),configJson,'Preview configuration mutated');
 const hashes=Object.fromEntries(['game','map','units','deployments','rules','objectives'].map(x=>[x,sha(path.join(pdir,x+'.json'))]));
 const report={schemaVersion:1,checkpoint:126,version:'v360',status:'differential-only-not-live',productionEngine:original.game.engine,sourceHashes:hashes,profileHash:sha(path.join(pdir,'native-preview/config.json')),initialState:projectionSummary,movement:{contexts:movementContexts,options:movementOptions,normalOptions,railOptions,panzerOptions,exactPathsAndCosts:true,turns:[1,2,3,4,5,6,7],note:'Repeated initial unit layout with turn/side/phase varied, not a seven-turn simulated campaign.'},replacements:{contexts:replacementContexts,options:replacementOptions,exactBudgetAndOptionSets:true,note:'Same fixed initial unit layout in each turn; does not certify full replacement transactions or prior-entry restrictions.'},combat:{virtualPairwiseOdds:oddsCases,initialGermanCandidateOdds:initialBattles,exactRawAndFinalOdds:true,note:'Two-counter synthetic adjacency across actual source cells; not a combat-consequence parity claim.'},phase:{firstCombatToGermanMovementToSovietReplacement:true},victory:{initialEvaluation:initialVictory,parity:true},uncertified:['Manual German opening setup and swap flow','Turn 4 interactive Shock Army reinforcement (native module currently auto-places)','Combat declaration/roll/consequence and result choices across the human workflow','Replacement transaction and move/phase action histories','Full-game victory control over seven turns','Legacy save/Undo and solo AI/controller parity','Browser UX migration; production remains legacy/index.html','City source typo nornal normalized by legacy but retained in source JSON']};
 return report;
}
if(require.main===module){
 try{const report=run(),out=process.argv[2]||path.join(root,'rules/audit/b4m-native-preview-parity-v360.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`PASS B4M native preview: ${report.initialState.unitCount} units, ${report.initialState.cityControls} city controls, ${report.movement.options} exact moves, ${report.replacements.contexts} replacement contexts, ${report.combat.virtualPairwiseOdds} pairwise odds`);}catch(e){console.error(e.stack);process.exitCode=1;}
}
module.exports={run,load};
