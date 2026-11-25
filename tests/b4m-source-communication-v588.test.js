'use strict';
// Printed §§7.3, 10.0–10.4; actual map, controlled positions.
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360');
const E=require('../core/engine'),P=require('../core/native_preview_config');
const {original,config}=load(),g=E.build(P.project(original,config));
let s,u,reserve;
function fixture(side='soviet',x=5,y=5){s=E.start(g,17,'auto-reference');s.units.forEach(v=>delete v.position);Object.assign(s,{side,turn:2,phaseIndex:0,replacementUsed:0});const us=s.units.filter(v=>v.army===side&&v.id!=='s1sh');[u,reserve]=us;u.position={x,y};u.strength='reduced';reserve.strength='dead';}
function enemies(){return s.units.filter(v=>v.army!==s.side);}
function surround(){E.neighbors(u.position.x,u.position.y).filter(n=>g.playable(n.x,n.y)).forEach((n,i)=>enemies()[i].position={x:n.x,y:n.y});}
function entry(x,y){return E.replacementOptions(g,s).some(o=>o.id===reserve.id&&o.type==='enter'&&o.x===x&&o.y===y);}
function restore(){return E.replacementOptions(g,s).some(o=>o.id===u.id&&o.type==='restore');}
fixture();assert.equal(E.communication(g,s,u),true);assert.equal(restore(),true);
assert.equal(entry(13,4),true);assert.equal(entry(0,4),false);assert.equal(entry(7,3),true);
enemies()[0].position={x:13,y:3};assert.equal(entry(13,4),false);
fixture('soviet',13,4);enemies()[0].position={x:13,y:3};assert.equal(E.enemyZoc(g,s,13,4,'soviet'),true);assert.equal(E.communication(g,s,u),true);
fixture();surround();assert.equal(E.communication(g,s,u),false);assert.equal(restore(),false);
// Leave a friendly occupied corridor exit in enemy ZOC; it cannot reopen communication.
const exit=E.neighbors(5,5).find(n=>n.dir==='S');const blocker=enemies().find(v=>v.position?.x===exit.x&&v.position?.y===exit.y);delete blocker.position;
reserve.position={x:exit.x,y:exit.y};assert.equal(E.enemyZoc(g,s,exit.x,exit.y,'soviet'),true);assert.equal(E.communication(g,s,u),false);
fixture('soviet',7,3);surround();assert.equal(restore(),false);delete u.position;assert.equal(entry(7,3),false);
fixture('soviet',10,2);surround();assert.equal(E.communication(g,s,u,'soviet',{ignoreCapitalException:true}),false);assert.equal(restore(),true);assert.equal(entry(10,2),false);delete u.position;assert.equal(entry(10,2),true);
fixture('german',10,2);s.control['10,2']='german';surround();assert.equal(E.communication(g,s,u),false);assert.equal(restore(),false);delete u.position;assert.equal(entry(10,2),false);assert.equal(entry(0,4),true);assert.equal(entry(13,4),false);
fixture();s.control['7,3']='german';assert.equal(entry(7,3),false);s.control['7,3']='soviet';assert.equal(entry(7,3),true);
fixture('german');assert.equal(E.applyReplacement(g,s,{type:'restore',id:u.id}),true);assert.equal(E.replacementOptions(g,s).length,0);
fixture();assert.equal(E.applyReplacement(g,s,{type:'restore',id:u.id}),true);assert.equal(s.replacementUsed,1);let n=0;while(!(s.side==='soviet'&&s.turn===3&&E.currentPhase(g,s).kind==='replacement')&&n++<20)assert.equal(E.endPhase(g,s),true);assert.equal(s.turn,3);assert.equal(s.replacementUsed,0);assert.equal(E.replacementBudget(g,s),4);
console.log('PASS B4M source communication, city and edge entry, capital exception, budgets');
