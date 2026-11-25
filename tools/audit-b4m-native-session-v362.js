#!/usr/bin/env node
/* Read-only checkpoint audit of opt-in generic-hex shared action session.
 * This invokes the true executable parity test, not a duplicated simulation.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.join(__dirname,'..');
const file=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
function run(){
 const exec=cp.spawnSync(process.execPath,[path.join(root,'tests/b4m-native-session-v362.test.js')],{encoding:'utf8',maxBuffer:2_000_000});
 if(exec.status!==0)throw Error('B4M native-session test failed: '+(exec.stderr||exec.stdout));
 const output=exec.stdout.trim().split('\n');const summary=JSON.parse(output[output.length-1]);
 if(summary.status!=='PASS'||summary.productionEngine!=='generic-hex-v1')throw Error('Unexpected native-session test result');
 return {schemaVersion:1,checkpoint:128,version:'v362',status:'opt-in-session-undo-save-parity-not-browser-playable',
  oracle:'legacy/engine.js; executable B4M scenario data',test:'tests/b4m-native-session-v362.test.js',result:summary,
  sources:Object.fromEntries(['core/session.js','core/native_session_actions.js','core/native_session_save.js','core/engine.js','legacy/engine.js','games/battle-for-moscow/game.json','games/battle-for-moscow/native-preview/config.json'].map(p=>[p,file(p)])),
  preservation:{productionEngine:'generic-hex-v1',nativeAPI:'WargameSession, engine=generic-hex-v1, opt-in Node only',legacySessionSaveVersion:2,nativePreviewSaveVersion:1},
  limitations:['Only opening-state combat and disjoint two-battle sequences, not a continuous seven-turn campaign',
  'A checksum detects accidental corruption; without a secret key it is not a digital signature',
  'Original browser remains on legacy action/session code; no native browser UI migration',
  'Manual setup, Turn-4 Shock, later-turn phase gating, AI and live persistence remain unverified',
  'Legacy executable is the behavioral oracle; tests do not independently certify printed rule accuracy']};
}
if(require.main===module){
 try{const record=run(),out=process.argv[2]||path.join(root,'rules/audit/b4m-native-action-session-v362.json');
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(record,null,2)+'\n');
 console.log(`PASS v362 native action session: ${record.result.singleParity} singles, ${record.result.paired} two-battle pairs, ${record.result.choiceChecks} choice branches, ${record.result.negative} negative cases`);
 }catch(e){console.error(e.stack);process.exitCode=1;}
}
module.exports={run};
