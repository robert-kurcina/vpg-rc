#!/usr/bin/env node
/* Differential combat certification against the still-live B4M legacy engine.
 * Both implementations load the real source map, counter values, and CRT.
 * The preview is not a production engine change or complete-game proof. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('./audit-b4m-native-preview-v360');
const nativeCore=require('../core/engine.js');
const originalEngine=require('../legacy/engine.js');
const adapter=require('../core/adapter.js');
const projection=require('../core/native_preview_config.js');
const root=path.resolve(__dirname,'..');
const copy=x=>JSON.parse(JSON.stringify(x));
const shaFile=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const compactState=s=>({
  units:Object.fromEntries(s.units.map(u=>[u.id,{strength:u.strength,position:u.position||null}])),
  control:s.control
});
function run(){
 const {original,config}=load(),beforeSource=JSON.stringify(original),beforeConfig=JSON.stringify(config);
 assert.equal(original.game.engine,'generic-hex-v1','Production remains on legacy until release parity');
 const projected=projection.project(original,config),newGame=nativeCore.build(projected);
 const oldGame=originalEngine.buildScenario(adapter.legacyScenario(original),adapter.legacyProfile(original));
 const oldStart=originalEngine.makeState(oldGame,17);
 const newStart=nativeCore.start(newGame,17,'auto-reference');
 assert.deepEqual(compactState(newStart),compactState(oldStart),'Starting positions and city ownership');
 const candidates=originalEngine.attackCandidates(oldGame,oldStart,'german');
 assert.equal(candidates.length,30,'Pinned initial German attack candidate count');
 const results={},branches={AL:0,EX:0,retreat:0,advance:0},negative={};
 let previewChecks=0,isolatedChecks=0,choiceChecks=0,sequenceChecks=0,sequenceRolls=0,validChoiceChecks=0;
 const startPair=()=>{const old=copy(oldStart),next=copy(newStart);old.phase='combat';return {old,next};};
 function committed(newState,b,die){
  const beforeSeed=newState.seed;
  assert.equal(nativeCore.declareCombat(newGame,newState,b.attackers,b.defender),true,'Native declaration');
  assert.equal(newState.seed,beforeSeed,'Declaring never rolls');
  assert.equal(nativeCore.lockDeclarations(newGame,newState),true,'Lock declarations');
  assert.equal(newState.seed,beforeSeed,'Locking never rolls');
  const preview=nativeCore.previewNextDeclaration(newGame,newState,die);
  assert.ok(preview,'Preview on committed die');
  assert.equal(newState.seed,beforeSeed,'Injected die does not consume RNG');
  return preview;
 }
 function assertParity(beforeOld,beforeNew,label){
  assert.deepEqual(compactState(beforeNew),compactState(beforeOld),label+' — unit and city state');
 }
 for(const b of candidates)for(let die=1;die<=6;die++){
  const {old,next}=startPair();
  const expected=originalEngine.battlePreview(oldGame,old,b,die);
  assert.ok(expected,'Legacy preview available');
  const actual=committed(next,b,die);
  assert.equal(actual.outcome,expected.outcome,'CRT result');
  assert.equal(actual.odds,expected.odds,'Adjusted odds');
  assert.equal(actual.cityHold,expected.cityHold,'City hold');
  assert.equal(actual.potentialAdvance,expected.potentialAdvance,'Advance eligibility');
  assert.deepEqual(actual.retreat,expected.retreat,'Ordered legal retreat paths');
  results[expected.outcome]=(results[expected.outcome]||0)+1;
  previewChecks++;
  const oldRec=originalEngine.resolveAttack(oldGame,old,b.attackers,b.defender,die,{advanceId:'none'});
  const nativeRec=nativeCore.resolveDeclared(newGame,next,die,{advanceId:'none'});
  assert.ok(oldRec&&nativeRec,'Both engines commit');
  assert.equal(nativeRec.result,oldRec.outcome,'Transaction result');
  assert.equal(nativeRec.roll,oldRec.die,'Committed die');
  assert.equal(nativeRec.odds,oldRec.odds,'Transaction odds');
  assertParity(old,next,'Opening attack '+b.defender+' die '+die);
  assert.equal(next.seed,old.seed,'Explicit die leaves RNG unchanged');
  assert.equal(next.declarations.length,0,'Declaration consumed');
  assert.equal(next.pendingRoll,null,'Pending die consumed');
  isolatedChecks++;
 }
 // Alternative human selections must be legal and have precisely the same
 // consequences; the default-only test would miss broken choice mappings.
 for(const b of candidates)for(let die=1;die<=6;die++){
  const {old,next}=startPair(),p=committed(next,b,die),choices={advanceId:'none'};
  if(p.outcome==='AL'&&b.attackers.length>1){choices.attackerLossId=b.attackers[b.attackers.length-1];branches.AL++;}
  if(p.outcome==='EX'&&b.attackers.length>1){choices.exchangeOrder=[...b.attackers].reverse();branches.EX++;}
  if(['DR','DRL','EX'].includes(p.outcome)&&p.retreat.length>1){
   const target=p.retreat[p.retreat.length-1];choices.retreatTo={x:target.x,y:target.y};branches.retreat++;
  }
  if(p.outcome==='DE'&&b.attackers.length>1){choices.advanceId=b.attackers[b.attackers.length-1];branches.advance++;}
  if(Object.keys(choices).length>1){
   const oldRec=originalEngine.resolveAttack(oldGame,old,b.attackers,b.defender,die,choices);
   const nativeRec=nativeCore.resolveDeclared(newGame,next,die,choices);
   assert.ok(oldRec&&nativeRec,'Explicit choices commit');
   assert.equal(nativeRec.result,oldRec.outcome);
   assertParity(old,next,'Explicit choice '+b.defender+' die '+die);
   validChoiceChecks++;
  }
  choiceChecks++;
 }
 assert.ok(validChoiceChecks>0&&branches.AL>0&&branches.EX>0&&branches.retreat>0&&branches.advance>0,'All choice families exercised');
 // Additional combat geometry not reached by initial German attacks:
 // the source's special full-strength DR hold in Moscow / a major city.
 let fortifiedCityHoldCases=0;
 for(const city of oldGame.raw.hexes.filter(h=>['moscow','major'].includes(h.city))){
  const {old,next}=startPair(),adjacent=originalEngine.neighbours(oldGame,city.x,city.y),ids=['g24','g41'];
  assert.ok(adjacent.length>=2,'City has two adjoining hexes');
  for(const state of [old,next]){
   state.turn=2;
   for(const unit of state.units){unit.position=null;unit.strength='dead';}
   const defender=state.units.find(u=>u.id==='s5');defender.position={x:city.x,y:city.y};defender.strength='full';
   for(const [i,id] of ids.entries()){
    const u=state.units.find(u=>u.id===id);u.strength='full';u.position={x:adjacent[i].x,y:adjacent[i].y};
   }
  }
  const battle={defender:'s5',attackers:ids};
  const leg=originalEngine.battlePreview(oldGame,old,battle,1);
  const act=committed(next,battle,1);
  assert.equal(leg?.outcome,'DR');assert.equal(act.outcome,'DR');
  assert.equal(leg.cityHold,true);assert.equal(act.cityHold,true);
  const lrec=originalEngine.resolveAttack(oldGame,old,ids,'s5',1,{advanceId:'none'});
  const nrec=nativeCore.resolveDeclared(newGame,next,1,{advanceId:'none'});
  assert.ok(lrec&&nrec);assert.equal(lrec.cityHold,true);assert.equal(nrec.cityHold,true);
  assertParity(old,next,'City hold '+city.city);
  assert.equal(next.units.find(u=>u.id==='s5').strength,'reduced');
  assert.deepEqual(next.units.find(u=>u.id==='s5').position,{x:city.x,y:city.y});
  fortifiedCityHoldCases++;
 }
 // The seeded human workflow: announce the complete battle set, draw a die
 // only when the selected battle is entered, then consume the identical roll.
 // Compare two independent legal battles in the same original opening layout.
 const pairs=[];
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
  const a=candidates[i],b=candidates[j];
  if(a.defender===b.defender||a.attackers.some(id=>b.attackers.includes(id)))continue;
  pairs.push([a,b]);
 }
 assert.equal(pairs.length,293,'Pinned two-battle candidate pairs');
 for(const [a,b] of pairs){
  const {old,next}=startPair(),seq=[a,b];
  const records=originalEngine.resolveDeclaredBattles(oldGame,old,seq.map(q=>({defender:q.defender,attackers:q.attackers,declaredOdds:q.odds})));
  for(const q of seq){
   const prior=next.seed;
   assert.equal(nativeCore.declareCombat(newGame,next,q.attackers,q.defender),true);
   assert.equal(next.seed,prior,'Queued declarations never roll');
  }
  assert.equal(nativeCore.lockDeclarations(newGame,next),true);
  for(let i=0;i<seq.length;i++){
   const beforeRoll=next.seed;
   const peek=nativeCore.previewNextDeclaration(newGame,next);
   assert.ok(peek&&Number.isInteger(peek.roll)&&peek.roll>=1&&peek.roll<=6,'Post-commit die');
   assert.notEqual(next.seed,beforeRoll,'Expected one RNG draw for selected battle');
   const record=nativeCore.resolveDeclared(newGame,next,null,{});
   assert.ok(record,'Committed result');
   assert.equal(peek.roll,records[i].die,'Same die at same order');
   assert.equal(record.result,records[i].outcome,'Same CRT result');
   assert.equal(next.declarations.length,seq.length-i-1,'Queue shrinks exactly once');
   sequenceRolls++;
  }
  assertParity(old,next,'Two announced opening battles');
  assert.equal(next.seed,old.seed,'RNG state after two committed battles');
  sequenceChecks++;
 }
 // Negative validation, and no state changes at user-action boundaries.
 {
  const {next}=startPair(),b=candidates[0];
  assert.equal(nativeCore.declareCombat(newGame,next,b.attackers,b.defender),true);
  const saved=JSON.stringify(next);
  assert.equal(nativeCore.declareCombat(newGame,next,b.attackers,b.defender),false,'Duplicate declaration rejected');
  assert.equal(JSON.stringify(next),saved);
  negative.duplicateDeclaration=true;
  nativeCore.lockDeclarations(newGame,next);
  const peek=nativeCore.previewNextDeclaration(newGame,next,3);
  assert.ok(peek);
  const beforeInvalid=JSON.stringify(next);
  assert.equal(nativeCore.resolveDeclared(newGame,next,3,{attackerLossId:'nonexistent'}),null,'Illegal attacker ID');
  assert.equal(JSON.stringify(next),beforeInvalid,'Invalid action cannot change state or die');
  negative.invalidAttackerChoiceAtomic=true;
  // Pre-committed retreat requests with an impossible destination must not
  // advance the queue, move a unit, or roll another die.
  const {next:other}=startPair(),retreatBattle=candidates.find(q=>originalEngine.battlePreview(oldGame,copy(oldStart),q,1)?.outcome==='DR');
  assert.ok(retreatBattle);
  const p2=committed(other,retreatBattle,1);
  assert.equal(p2.outcome,'DR');
  const invalidBefore=JSON.stringify(other);
  assert.equal(nativeCore.resolveDeclared(newGame,other,1,{retreatTo:{x:999,y:999}}),null);
  assert.equal(JSON.stringify(other),invalidBefore);
  negative.invalidRetreatAtomic=true;
  assert.equal(original.game.engine,'generic-hex-v1');
  negative.productionSelectorPreserved=true;
 }
 assert.equal(JSON.stringify(original),beforeSource,'Source package was not modified');
 assert.equal(JSON.stringify(config),beforeConfig,'Preview profile mutated');
 const report={schemaVersion:1,checkpoint:127,version:'v361',status:'opt-in-differential-combat-parity-not-live',
  reference:'existing executable legacy/engine.js',productionEngine:original.game.engine,
  fingerprints:{source:Object.fromEntries(['map','units','deployments','rules','objectives'].map(name=>[name,shaFile('games/battle-for-moscow/'+name+'.json')])),
   nativePreviewProfile:shaFile('games/battle-for-moscow/native-preview/config.json')},
  sourceOpening:{unitRecords:oldStart.units.length,openingAttackCandidates:candidates.length},
  combat:{openingPreviews:previewChecks,isolatedTransactions:isolatedChecks,choicesProbed:choiceChecks,
   choiceTransactions:validChoiceChecks,choiceBranches:branches,crtResults:results,
   twoBattleSequences:sequenceChecks,seededBattleRolls:sequenceRolls,fortifiedCityHoldCases,
   exactUnitStrengthPositionCityControl:true,identicalCommittedRandomStream:true},
  negative,
  limits:['Tests use the unchanged initial layout; this is not a sequential seven-turn campaign',
  'Two-battle cases are independently legal opening declarations; other orders and multi-turn decisions are not covered',
  'Legacy executable is the regression oracle, not independent proof of historical rules',
  'Human browser controls and native Undo/save/AI are not migrated',
  'Manual German setup and interactive Soviet Shock placement are still outstanding',
  'Native preview remains opt-in; legacy/B4M production routing remains unchanged']};
 return report;
}
if(require.main===module){
 try{
  const report=run(),dest=process.argv[2]||path.join(root,'rules/audit/b4m-native-combat-parity-v361.json');
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
  console.log(`PASS B4M native combat: ${report.combat.openingPreviews} previews, ${report.combat.isolatedTransactions} single, ${report.combat.choiceTransactions} choice cases, ${report.combat.twoBattleSequences} two-battle sequences, ${report.combat.seededBattleRolls} seeded rolls`);
 }catch(e){console.error(e.stack);process.exitCode=1;}
}
module.exports={run};
