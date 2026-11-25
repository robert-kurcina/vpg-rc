#!/usr/bin/env node
/* Executable Checkpoint 130 audit: 4 true 7-turn action histories through
 * shared WargameSession versus the legacy B4M engine. Source of summary is
 * the actual differential test, not manually declared results.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
function run(){
 const target='tests/b4m-native-continuous-campaign-v364.test.js';
 const result=cp.spawnSync(process.execPath,[path.join(root,target)],{cwd:root,encoding:'utf8',maxBuffer:10_000_000});
 if(result.error||result.status!==0)throw Error('Continuous campaign parity failed: '+(result.stderr||result.stdout||result.error?.message));
 const summary=JSON.parse(result.stdout.trim().split('\n').at(-1));
 if(summary.status!=='PASS'||summary.checkpoint!==130||summary.cases.length!==4||
    summary.totals.phases!==220||summary.totals.shockPlacements!==4||
    summary.totals.manualPlacements!==22||summary.totals.realBattles<1||
    summary.cases.some(c=>c.turns!==7||c.turnEnds.length!==14||c.phases!==55||c.shockPlacements!==1))
  throw Error('Unexpected differential campaign evidence');
 const live=JSON.parse(fs.readFileSync(path.join(root,'games/battle-for-moscow/game.json'),'utf8'));
 if(live.engine!=='generic-hex-v1')throw Error('B4M shared-native engine descriptor is missing');
 return {schemaVersion:1,checkpoint:130,version:'v364',status:'continuous-seven-turn-differential-preview-only',
  source:'Actual B4M source map, units, CRT, objectives and legacy/engine.js reference implementation',
  test:target,summary,
  sourceSHA256:Object.fromEntries(['core/engine.js','core/native_session_actions.js','core/native_session_save.js','core/session.js','core/native_preview_config.js','legacy/engine.js','games/battle-for-moscow/game.json','games/battle-for-moscow/native-preview/config.json',target].map(p=>[p,sha(p)])),
  checks:[
   'Four distinct sequential games start in opening German combat, progress through all true phase/turn boundaries and end after seven turns',
   'One game begins with actual 22-unit manual placement and setup confirmation, not a synthetic setup preset',
   'Legacy and shared native engines independently execute selected legal movement, combat, and replacement transactions on evolving state',
   'Turn-four Shock reinforcement choice is made only when reached by actual preceding German and Soviet turns',
   'Full positions, counter strengths, control, side, turn, terminal winner and RNG state are compared after each action and phase',
   'Native Undo/replay, middle-campaign save/restore and postgame save/Undo/replay are verified',
   'Shared engine now transitions the active side cursor to first faction and increments the final half-turn counter on the end-of-campaign boundary; finished state offers no playable phase'
  ],
  limitations:[
   'A bounded deterministic set of four chosen histories: at most one move per movement phase, one replacement per replacement phase, and one battle per combat phase',
   'Not exhaustive move/retreat/exchange or simultaneous multi-battle choice parity under a continuously evolving game (earlier bounded parity tests cover selected cases)',
   'The legacy in-repository implementation is the behavioral oracle; separate live Oberlabs UX/implementation verification is still required',
   'No playable native browser interface or native AI parity; production remains legacy-b4m-v1',
   'This demonstrates B4M full-turn core execution, not readiness of Leningrad, Arduous, Kiev or Kiev–Odessa rules'
  ]};
}
if(require.main===module){try{
 const output=process.argv[2]||path.join(root,'rules/audit/b4m-native-continuous-campaign-v364.json');
 const report=run();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',checkpoint:130,totals:report.summary.totals}));
}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={run};
