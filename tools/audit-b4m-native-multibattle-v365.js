#!/usr/bin/env node
/* Audits actual continuous multi-battle gameplay, not synthetic static boards.
 * Legacy B4M is the comparison executable; opt-in shared native session only.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
function run(){
 const test='tests/b4m-native-multibattle-campaign-v365.test.js';
 const r=cp.spawnSync(process.execPath,[path.join(root,test)],{cwd:root,encoding:'utf8',maxBuffer:10_000_000});
 if(r.error||r.status!==0)throw Error('Multi-battle campaign differential failed: '+(r.stderr||r.stdout||r.error?.message));
 const summary=JSON.parse(r.stdout.trim().split('\n').at(-1));
 const t=summary.totals;
 if(summary.status!=='PASS'||summary.checkpoint!==131||summary.cases.length!==4||
    t.phases!==220||t.multiBattlePhases<4||t.realBattles<50||t.pendingSaveRestores<8||
    t.shockPlacements!==4||t.manualPlacements!==22||
    Object.values(summary.materialChoiceDifferences).some(n=>n<1)||
    summary.cases.some(c=>c.turns!==7||c.phases!==55||c.turnEnds.length!==14||c.shockPlacements!==1))
  throw Error('Multi-battle differential report failed acceptance gates');
 const game=JSON.parse(fs.readFileSync(path.join(root,'games/battle-for-moscow/game.json'),'utf8'));
 if(game.engine!=='generic-hex-v1')throw Error('B4M default browser must use shared-native descriptor');
 return {schemaVersion:1,checkpoint:131,version:'v365',status:'opt-in-continuous-multibattle-differential-parity',test,summary,
  source:'Legacy Battle for Moscow engine + shared generic-hex engine; both execute independently on the same source board and fixed deterministic action policy',
  sourceSHA256:Object.fromEntries(['legacy/engine.js','core/engine.js','core/native_session_actions.js','core/session.js','core/native_session_save.js','games/battle-for-moscow/game.json','games/battle-for-moscow/native-preview/config.json',test].map(p=>[p,sha(p)])),
  verified:[
   'Four seven-turn campaigns start in correct opening phase and reach terminal game state, including one manual 22-counter German deployment',
   'Multiple disjoint battles are announced before dice; three campaigns reverse preferred battle order, exercising different declaration orders',
   'Each battle commits its own die in turn; skipped and overridden dice are rejected without changing state/RNG/history',
   'All combat result positions, strengths, city controls, and RNG match after every committed battle, before and after native Undo/replay',
   'Saves restore both the initially pending combat die and the subsequent committed die after the first resolved battle',
   'Alternate attacker loss, exchange order, retreat and advance produce materially different outcomes from legacy default choices and match legacy when selected',
   'Turn-4 Shock placement is reached through continuous play; all fourteen half-turn completions and full final winner/cursor checks agree',
   'No changes to production B4M browser selector, source map, CRT, or shared renderer'
  ],limitations:[
   'Four bounded legal action trajectories, at most two combats per combat phase; not exhaustive decision-space parity',
   'The action chooser still makes at most one movement per movement phase and one replacement per replacement phase; full replacement budget and varied movement sequences remain untested here',
   'Parity oracle is in-repository Oberlabs-compatible legacy engine; independent upstream browser parity not established',
   'No native human-browser or AI session cutover; production B4M still runs the legacy gameplay implementation',
   'Does not certify the historical rules of the other four configurations'
  ]};
}
if(require.main===module){try{const dest=process.argv[2]||path.join(root,'rules/audit/b4m-native-multibattle-v365.json');const x=run();fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(x,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checkpoint:131,totals:x.summary.totals,materialChoiceDifferences:x.summary.materialChoiceDifferences}));}catch(e){console.error(e.stack);process.exitCode=1;}}
module.exports={run};
