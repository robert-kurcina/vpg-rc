#!/usr/bin/env node
/* Checkpoint 129: run the actual executable legacy-vs-native regression.
 * Summary is bounded: the Shock scenario constructs a turn-four boundary,
 * not a replay of the intervening turns.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
function run(){
 const test='tests/b4m-native-interactive-setup-v363.test.js';
 const result=cp.spawnSync(process.execPath,[path.join(root,test)],{encoding:'utf8',maxBuffer:5e6});
 if(result.status!==0)throw Error('Interactive B4M parity failure: '+(result.stderr||result.stdout));
 const summary=JSON.parse(result.stdout.trim().split('\n').at(-1));
 if(summary.status!=='PASS'||summary.checkpoint!==129||summary.places!==22||summary.shockCases!==3)throw Error('Unexpected parity evidence');
 return {schemaVersion:1,checkpoint:129,version:'v363',status:'bounded-differential-preview-only',oracle:'legacy/engine.js + supplied Battle for Moscow scenario',test,result:summary,
  sourceHashes:Object.fromEntries(['core/engine.js','core/native_session_actions.js','core/native_session_save.js','core/native_preview_config.js',
   'core/session.js','legacy/engine.js','games/battle-for-moscow/native-preview/config.json','games/battle-for-moscow/game.json'].map(p=>[p,hash(p)])),
  verified:['Manual 22 German start crosses, fixed 14 Soviet ground counters, source-matched placement and one occupied-cross swap',
   'Setup confirmation requires all 22; phase advances into German combat; session Undo and saves restore selection state',
   'Turn-4 source scheduled event uses a human selected entry: 17 opening-layout eligible hexes match legacy',
   'Free full-strength Shock placement, no automatic unit placement, and Soviet four-step ordinary replacement budget',
   'Alternative valid entry selections, illegal choices, occupied/ZOC checks and replay after Undo'],
  limits:['Turn-4 tests reproduce a synthetic valid phase boundary using the initial board; they are not full four-turn playthroughs',
   'Node-only generic preview; production still launches legacy/index.html',
   'B4M native preview save fingerprint changes with this policy and older preview saves require explicit compatibility handling',
   'No proof yet for seven-turn victory, AI decisions or human browser interface parity']};
}
if(require.main===module){try{const data=run();const outfile=process.argv[2]||path.join(root,'rules/audit/b4m-native-interactive-setup-v363.json');fs.mkdirSync(path.dirname(outfile),{recursive:true});fs.writeFileSync(outfile,JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data.result));}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={run};
