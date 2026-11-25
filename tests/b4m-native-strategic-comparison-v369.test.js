'use strict';
/* Structural AI comparison (not policy equality): initial legacy fortress and
 * native objective-guard decisions are made from the exact same source state.
 * Every native step still commits through the shared session API. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load}=require('../tools/audit-b4m-native-preview-v360.js');
const project=require('../core/native_preview_config.js');
const E=require('../core/engine.js');
const S=require('../core/session.js');
const AI=require('../core/native_session_ai.js');
const L=require('../legacy/engine.js');
const adapter=require('../core/adapter.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const {original,config}=load();
const g=E.build(project.project(original,config));
const lc=L.buildScenario(adapter.legacyScenario(original),adapter.legacyProfile(original));
const baseline=require('../games/battle-for-moscow/native-preview/ai-config.json');
const objective=require('../games/battle-for-moscow/native-preview/ai-config-objective.json');
const canonical=s=>({turn:s.turn,side:s.side,ply:s.ply,seed:s.seed,over:s.over,winner:s.winner,
 units:Object.fromEntries(s.units.map(u=>[u.id,{position:u.position||null,strength:u.strength}])),control:s.control});
const occupation=(state,pos)=>state.units.find(u=>u.position&&u.strength!=='dead'&&
 u.position.x===pos[0]&&u.position.y===pos[1])?.id||null;
const movedCount=(a,b)=>b.units.filter(u=>JSON.stringify(a.units.find(x=>x.id===u.id)?.position||null)!==JSON.stringify(u.position||null)).length;
const rawMode=AI.policy(objective);
assert.equal(rawMode.mode,'objective-guard-v1');
assert.throws(()=>AI.policy({...objective,mode:'legacy-fortress'}),/Unsupported/);
assert.throws(()=>AI.policy({...objective,defendMoscow:true}),/Unknown/);
assert.equal(AI.policy(baseline).mode,'deterministic-baseline');
assert.deepEqual(AI.controlGoals(g,'soviet'),[[10,2]]);
assert.deepEqual(AI.controlGoals({objectives:{victory:{decisions:[{if:{type:'controls',faction:'blue',cell:[7,8]}}]}}},'blue'),[[7,8]],
 'AI goals derive from rules, not B4M coordinates');
assert.equal(require('../games/battle-for-moscow/game.json').engine,'generic-hex-v1');
const seeds=[1,17,1941];
const rows=[];
let objectiveActions=0, baselineActions=0, guardHeld=0, saves=0;
for(const seed of seeds){
 const initial=S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,
  state:E.start(g,seed,'auto-reference')});
 const german=AI.playSide(initial,baseline);
 assert.equal(german.session.state.side,'soviet');
 const common=german.session;
 const old=copy(common.state);old.phase='replacement';
 const firstBaseline=AI.decide(common,baseline);
 const firstObjective=AI.decide(common,objective);
 assert.notDeepEqual(firstBaseline,firstObjective,'Defensive option must affect real action choice');
 assert.equal(firstObjective.type,'replacement');
 assert.equal(firstObjective.choice.type,'enter');
 assert.deepEqual([firstObjective.choice.x,firstObjective.choice.y],[10,2]);
 const legacy=L.playSide(lc,old,'fortress');
 const legacyEntry=legacy.log.filter(x=>x.t===1&&x.side==='soviet'&&x.type==='replacement')
  .find(x=>x.action==='enter'&&x.at?.x===10&&x.at?.y===2);
 assert(legacyEntry,'Legacy fortress must prioritize source objective in this fixture');
 const baseOut=AI.playSide(common,baseline);
 const guardOut=AI.playSide(common,objective);
 assert.equal(occupation(guardOut.session.state,[10,2]),firstObjective.choice.id);
 assert.equal(occupation(legacy,[10,2]),legacyEntry.unit);
 assert.equal(occupation(guardOut.session.state,[10,2]),occupation(legacy,[10,2]),
  'Opt-in policy matches the initial source fortress replacement/garrison identity');
 assert(baseOut.actions.length&&guardOut.actions.length);
 // The new garrison cannot be voluntarily moved off its protected objective.
 const started=guardOut.actions.find(x=>x.action.type==='replacement');
 assert.deepEqual(started.action.choice,firstObjective.choice);
 const movesFromGarrison=guardOut.actions.filter(x=>x.action.type==='move'&&
  x.action.unitId===firstObjective.choice.id);
 assert.equal(movesFromGarrison.length,0,'Garrison should not voluntarily vacate held objective');
 guardHeld++;
 const current=S.serialize(guardOut.session);
 const restored=S.restore(copy(current),{scenarioId:g.game.id,engine:'generic-hex-v1',config:g});
 assert.deepEqual(restored.state,guardOut.session.state);
 assert.deepEqual(restored.history,guardOut.session.history);
 assert.deepEqual(common.state,german.session.state,'AI must not mutate shared start state');
 const undone=S.undo(guardOut.session);assert(undone.ok);
 const replay=S.execute(undone.session,guardOut.actions.at(-1).action);assert(replay.ok);
 assert.deepEqual(replay.session.state,guardOut.session.state);
 saves++;
 objectiveActions+=guardOut.actions.length;baselineActions+=baseOut.actions.length;
 rows.push({seed,initialSideTurn:'soviet',firstBaseline,firstObjective,legacyFortressFirstMoscowEntry:legacyEntry.unit,
  baselineGarrison:occupation(baseOut.session.state,[10,2]),
  objectiveGarrison:occupation(guardOut.session.state,[10,2]),
  legacyGarrison:occupation(legacy,[10,2]),
  baselineVsLegacyUnitDifferences:movedCount(baseOut.session.state,legacy),
  objectiveVsLegacyUnitDifferences:movedCount(guardOut.session.state,legacy),
  objectiveMoves:guardOut.summary.moves,objectiveBattles:guardOut.summary.battles,
  legacyPhaseSide:legacy.side,baselineNativeActions:baseOut.actions.length,
  objectiveNativeActions:guardOut.actions.length});
}
const audit={checkpoint:135,version:'v369',status:'PASS',scope:'Soviet response from identical B4M first-turn positions',
 statusBoundary:'Shared-rule legal-action parity and targeted fortress preference; NOT equality of legacy AI decisions or competitive strength',
 cases:seeds.length,guardHeld,saves,baselineActions,objectiveActions,rows};
if(process.argv.includes('--write-audit')){
 const file=path.resolve(__dirname,'../rules/audit/b4m-native-strategy-comparison-v369.json');
 fs.writeFileSync(file,JSON.stringify(audit,null,2)+'\n');
}
console.log(JSON.stringify(audit));
