#!/usr/bin/env node
/* Checkpoint 132: continuous 7-turn expanded movement, replacement,
 * communication and victory parity against the executable legacy reference.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
function run(){
 const runTest=t=>{
  const r=cp.spawnSync(process.execPath,[path.join(root,t)],{cwd:root,encoding:'utf8',maxBuffer:12_000_000});
  if(r.error||r.status!==0)throw Error(t+' failed: '+(r.stderr||r.stdout||r.error?.message));
  return JSON.parse(r.stdout.trim().split('\n').at(-1));
 };
 const test='tests/b4m-native-expanded-turn-v366.test.js',policyTest='tests/b4m-native-replacement-policy-v366.test.js';
 const summary=runTest(test),policy=runTest(policyTest),t=summary.totals;
 if(summary.checkpoint!==132||summary.status!=='PASS'||summary.cases.length!==4||
    summary.cases.some(c=>c.turns!==7||c.phases!==55||c.shockPlacements!==1||c.turnEnds.length!==14)||
    t.phases!==220||t.realMoves<350||t.realReplacements<100||t.multiMovePhases<50||
    t.multiReplacementPhases<10||t.communicationChecks<500||t.communicationDisconnected<1||
    summary.peakMovements<3||summary.peakReplacements<3||summary.terminalFixtures!==3||
    t.shockPlacements!==4||t.manualPlacements!==22||
    Object.values(summary.materialChoiceDifferences).some(n=>n<1)||
    policy.status!=='PASS'||!policy.sourceOptionParity||!policy.laterRestore)
  throw Error('Expanded turn differential acceptance gates failed');
 const live=JSON.parse(fs.readFileSync(path.join(root,'games/battle-for-moscow/game.json'),'utf8'));
 if(live.engine!=='generic-hex-v1')throw Error('Shared-native browser descriptor changed');
 return {schemaVersion:1,checkpoint:132,version:'v366',status:'opt-in-expanded-seven-turn-differential-parity',
  reference:'in-repository Oberlabs-compatible legacy/engine.js (not independently verified upstream)',
  test,policyTest,summary,policy,
  sourceSHA256:Object.fromEntries(['legacy/engine.js','core/engine.js','core/native_preview_config.js','core/native_session_actions.js','core/session.js','games/battle-for-moscow/game.json','games/battle-for-moscow/native-preview/config.json',test,policyTest].map(p=>[p,sha(p)])),
  verified:[
   'Four independently evolving full seven-turn games match legacy for positions, strengths, city control, side, phase, committed RNG and victory',
   'Up to four distinct-unit moves in a movement phase, all checked against source legal paths after prior moves',
   'More than one replacement in each eligible phase, exhausting the source budget where possible and checking new options after every commit',
   'A just-entered reduced unit cannot restore in that same turn but can in a later turn subject to budget and communication; policy is opt-in and validated',
   'Dynamic communication (including disconnected lines) matches the legacy executable on every checked unit state',
   'German Moscow capture, Soviet Moscow-plus-other-city, and Soviet-only-Moscow draw all match at the actual terminal phase transition',
   'Multi-battle declaration queues, committed dice, chosen consequences, Undo and replay remain differentially checked',
   'The user-approved five map renders and the production B4M legacy browser selector are unchanged'
  ],limitations:[
   'Not exhaustive: four seeded action policies, no universal AI or native browser UX certification',
   'The scripted move picker stops after four different units per movement phase; remaining units and optional choices may still be untested',
   'Replacement actions are exhausted within the scenario budget but the picker does not enumerate every replacement order',
   'Three reachable control-state victory fixtures are counterfactuals; does not reproduce every possible Moscow campaign',
   'Communication checks use evolving sampled campaign boards and do not exhaust every possible enemy ZOC arrangement',
   'Retreat and combat choices remain bounded by earlier v365 tests; independent upstream Oberlabs parity remains incomplete'
  ]};
}
if(require.main===module){
 try{const dest=process.argv[2]||path.join(root,'rules/audit/b4m-native-expanded-turn-v366.json');const x=run();fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(x,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checkpoint:132,totals:x.summary.totals,terminalFixtures:x.summary.terminalFixtures}));}
 catch(e){console.error(e.stack);process.exitCode=1;}
}
module.exports={run};
