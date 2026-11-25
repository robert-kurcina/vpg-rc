'use strict';
const assert=require('node:assert/strict');
const AI=require('../core/native_session_ai'),E=require('../core/engine'),S=require('../core/session'),P=require('../core/native_preview_config');
const {original,config}=require('../tools/audit-b4m-native-preview-v360').load();
const g=E.build(P.project(original,config)),scope={scenarioId:g.game.id,engine:'generic-hex-v1',config:g};
let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++},ok=(a,m)=>{assert.ok(a,m);checks++};
const u=(id,army,x,y,power)=>({id,army,position:{x,y},strength:'full',combatFull:power,combatReduced:power/2});
// Isolated advisory evaluation witnesses. Actual campaign legality is tested below.
const board={cells:new Map(),rules:{combat:{terrainShifts:{forest:1,fortification:1},terrainDefenderFactions:{fortification:['soviet']},cityShifts:{major:1}}}};
const p=u('p','german',2,2,4),f=u('f','german',4,2,8),e=u('e','soviet',3,2,12);
const origin=p.position,dest={x:4,y:1};
const score=(to,control={},friends=[p],enemies=[],goals=[])=>AI.positionalDelta(board,{control},p,to,goals,friends,enemies);
eq(score(origin),0);eq(score(dest),0);eq(score(dest,{'4,1':'soviet'}),1);eq(score(dest,{'4,1':'soviet'},[p],[],[[4,1]]),3);
const adjacent=E.neighbors(origin.x,origin.y).find(n=>E.distance(n.x,n.y,dest.x,dest.y)>1);
const threat=u('threat','soviet',adjacent.x,adjacent.y,12);
ok(score(dest,{},[p],[threat])>0,'leaving excessive local pressure should improve utility');
const destinationThreat=E.neighbors(dest.x,dest.y).find(n=>E.distance(n.x,n.y,origin.x,origin.y)>1);
const threat2=u('threat2','soviet',destinationThreat.x,destinationThreat.y,12);
const exposed=score(dest,{},[p],[threat2]);ok(exposed<0,'moving into excessive pressure should be penalized');
board.cells.set('4,1',{terrain:'forest'});ok(score(dest,{},[p],[threat2])>exposed,'cover reduces advisory risk');
board.cells.set('4,1',{terrain:'fortification'});eq(score(dest,{},[p],[threat2]),exposed,'faction-restricted fortification cover must not be credited');
board.cells.clear();ok(score(dest,{},[p,f],[threat2])>exposed,'adjacent friendly concentration should improve utility');
ok(score(dest,{'2,2':'german'},[p],[threat])<score(dest,{},[p],[threat]),'leaving threatened city should carry a penalty');
// The experimental grade gate leaves low and legacy profiles exactly unchanged.
for(const seed of [23,29]){
 const start=S.create({...scope,state:E.start(g,seed,'auto-reference')}),saved=S.serialize(start);
 for(const difficulty of [0,1,5]){
  const base={mode:'objective-guard-v1',difficulty},a=AI.playSide(start,base),b=AI.playSide(start,{...base,tacticalPolicy:'positioning-v1'});
  eq(a.actions,b.actions);eq(S.serialize(a.session),S.serialize(b.session));
 }
 const settings={mode:'objective-guard-v1',difficulty:10,tacticalPolicy:'positioning-v1'};
 const a=AI.playSide(start,settings),b=AI.playSide(start,settings);eq(a.actions,b.actions);eq(S.serialize(a.session),S.serialize(b.session));
 eq(S.serialize(S.restore(S.serialize(a.session),scope)),S.serialize(a.session));eq(S.serialize(start),saved);
 const it=AI.sideSteps(start,settings);let next;while(!(next=it.next()).done){if(next.value.action.type==='move'){
  const paused=next.value.after;eq(S.serialize(AI.playSide(S.restore(S.serialize(paused),scope),settings).session),S.serialize(a.session));break;
 }}ok(!next.done,'must reach actual movement');
}
console.log(JSON.stringify({checks}));
