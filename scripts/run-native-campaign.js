'use strict';
// Headless use of the same native session and controller as the browser.
// Fixed strategy for grade calibration; no alteration of combat randomness.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('../tools/audit-b4m-native-preview-v360');
const Project=require('../core/native_preview_config'),E=require('../core/engine'),S=require('../core/session'),AI=require('../core/native_session_ai'),CRT=require('../core/historical_crt'),Difficulty=require('../core/ai_difficulty');
const [variant='standard',seedArg='7',limitArg='5000',gArg='0',sArg='0',tacticalPolicy]=process.argv.slice(2);
const seed=Number(seedArg),limit=Number(limitArg),grades={german:Difficulty.validate(Number(gArg)),soviet:Difficulty.validate(Number(sArg))};
assert.ok(['standard','advanced'].includes(variant)&&Number.isInteger(seed)&&seed>=1&&seed<=0xffffffff&&Number.isInteger(limit)&&limit>=1&&limit<=5000,'Invalid native campaign arguments');
const profile=require('../games/battle-for-moscow/native-preview/ai-config-objective.json');
const policies=Object.fromEntries(Object.entries(grades).map(([side,grade])=>[side,AI.policy({...profile,...(grade?{difficulty:grade}:{}),...((process.env[side.toUpperCase()+'_TACTICAL_POLICY']||tacticalPolicy)?{tacticalPolicy:process.env[side.toUpperCase()+'_TACTICAL_POLICY']||tacticalPolicy}:{})})]));
const {original,config}=load(),base=Project.withStacking(Project.project(original,config),config,process.env.B4M_STACKING||'historical');
if(variant==='advanced'){base.rules.combat.crtVariant='advanced';base.rules.combat.table=CRT.tableFor('battle-for-moscow','advanced');}
const gamePackage=require('../core/graduated_mode').withNative(base,process.env.VICTORY_MODE||'historical');
const g=E.build(gamePackage),scope={scenarioId:g.game.id,engine:'generic-hex-v1',config:g};
let session=S.create({...scope,state:E.start(g,seed,'auto-reference')}),trace=[],sideTurns=0;const counts={},stackMetrics={pairedArmorMoves:0,pairedArmorAttacks:0,peakArmorPairs:0,moscowEverGerman:false,unpackMoves:0,firstArmorAdjacentTurn:null,turn5ArmorWithinTwo:0,firstMoscowCaptureTurn:null},started=Date.now();
while(!session.state.over&&trace.length<limit){
 const side=session.state.side,steps=AI.sideSteps(session,policies[side]);let next;
 while(trace.length<limit&&!(next=steps.next()).done){
  const {before,after,...item}=next.value;
  session=after;
  const armor=after.state.units.filter(u=>u.position&&u.strength!=='dead'&&E.unitSide(u)==='german'&&u.type==='tank'&&E.power(u,'attack')===12);
  const pairs=armor.filter((u,i)=>armor.slice(i+1).some(v=>v.position.x===u.position.x&&v.position.y===u.position.y));
  stackMetrics.peakArmorPairs=Math.max(stackMetrics.peakArmorPairs,pairs.length);
  if(item.action.type==='move'&&armor.some(u=>u.id===item.action.unitId&&armor.some(v=>v.id!==u.id&&v.position.x===u.position.x&&v.position.y===u.position.y)))stackMetrics.pairedArmorMoves++;
  if(item.action.type==='declare-battle'&&pairs.some(u=>item.action.attackers.includes(u.id)&&armor.some(v=>v.id!==u.id&&v.position.x===u.position.x&&v.position.y===u.position.y&&item.action.attackers.includes(v.id))))stackMetrics.pairedArmorAttacks++;
  if(item.action.type==='move'){
   const u=before.state.units.find(v=>v.id===item.action.unitId);
   if(u?.position&&u.type==='tank'&&E.unitSide(u)==='german'&&before.state.units.some(v=>v.id!==u.id&&v.position&&v.type==='tank'&&E.unitSide(v)==='german'&&v.position.x===u.position.x&&v.position.y===u.position.y)&&!after.state.units.some(v=>v.id!==u.id&&v.position&&v.type==='tank'&&E.unitSide(v)==='german'&&v.position.x===item.action.x&&v.position.y===item.action.y))stackMetrics.unpackMoves++;
  }
  const near=armor.filter(u=>E.distance(u.position.x,u.position.y,10,2)<=2);
  if(armor.some(u=>E.distance(u.position.x,u.position.y,10,2)<=1)&&stackMetrics.firstArmorAdjacentTurn===null)stackMetrics.firstArmorAdjacentTurn=after.state.turn;
  if(after.state.turn===5)stackMetrics.turn5ArmorWithinTwo=Math.max(stackMetrics.turn5ArmorWithinTwo,near.length);
  if(after.state.control['10,2']==='german'){stackMetrics.moscowEverGerman=true;stackMetrics.firstMoscowCaptureTurn??=after.state.turn;}
  counts[item.action.type]=(counts[item.action.type]||0)+1;trace.push(item);
 }
 if(session.state.over||session.state.side!==side)sideTurns++;
 if(trace.length<limit&&!session.state.over)assert.notEqual(session.state.side,side,'Native controller stalled at side boundary');
}
const saved=S.serialize(session),restored=S.restore(saved,scope);assert.deepEqual(S.serialize(restored),saved);
const complete=session.state.over;
const report={scenario:'battle-for-moscow',variant,...(process.env.VICTORY_MODE==='graduated'?{victoryMode:'graduated',graduated:require('../core/graduated_mode').evaluate(g.objectives.graduatedVictory,session.state.control)}:{}),stacking:process.env.B4M_STACKING||'historical',seed,grades,factionPolicies:policies,elapsedMs:Date.now()-started,status:complete?'complete':'blocked',reason:complete?null:'controller-action-budget',actions:trace.length,sideTurns,counts,stats:{moves:counts.move||0,combats:counts['resolve-pending']||0,replacements:counts.replacement||0,reinforcements:counts['place-reinforcement']||0,turns:session.state.turn-1},cityControl:session.state.control,stepsLost:{...session.state.stepsLost},winner:session.state.winner,terminal:complete?{winner:session.state.winner}:null,stateHash:saved.sha256,stackedCombats:session.state.log.filter(e=>e.type==='combat'&&e.stacked).length,stackedCityHolds:session.state.log.filter(e=>e.type==='combat'&&e.stacked&&e.cityHold).length,stackMetrics,exactRestore:true};
if(process.env.AUDIT_PATH)fs.writeFileSync(process.env.AUDIT_PATH,JSON.stringify(report,null,2)+'\n');
if(process.env.SAVE_PATH&&complete)fs.writeFileSync(process.env.SAVE_PATH,JSON.stringify(saved)+'\n');
if(process.env.JOURNAL_PATH)fs.writeFileSync(process.env.JOURNAL_PATH,JSON.stringify(trace)+'\n');
console.log(JSON.stringify(report));if(limit===5000&&!complete)process.exitCode=1;
