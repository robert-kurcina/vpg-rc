'use strict';
const assert=require('node:assert/strict');
const E=require('../core/engine'),P=require('../core/native_preview_config');
const {load}=require('../tools/audit-b4m-native-preview-v360');
const {original,config}=load(),p=P.project(original,config);
const before=JSON.stringify(p);
const variant=JSON.parse(before);
variant.rules.specialRules.push({module:'stacking-capacity-v1',maxCombatUnits:2},{module:'stacked-battle-v1',maxDefenders:2,cityHoldPolicy:'one-step-choice',strictMinimumOdds:true});
const g=E.build(variant),historical=E.build(p);
function fixture(){
 const s=E.start(g,17,'auto-reference');s.units.forEach(u=>delete u.position);Object.assign(s,{side:'german',phaseIndex:2,turn:2});
 const ids=['g23','g35','g24','g41'], defenders=['s3','s5'];
 const d=s.units.find(u=>u.id===defenders[0]);d.strength='full';s.units.find(u=>u.id===defenders[1]).strength='full';d.position={x:10,y:2};s.units.find(u=>u.id===defenders[1]).position={...d.position};
 const ns=E.neighbors(10,2);for(let i=0;i<ids.length;i++){const n=ns.find(h=>h.dir===['S','S','N','N'][i]);s.units.find(u=>u.id===ids[i]).position={x:n.x,y:n.y};}
 E.checkState(g,s);return {s,ids,defenders};
}
let {s,ids,defenders}=fixture();
assert.throws(()=>E.checkState(historical,s));
const odds=E.combatOdds(g,s,ids,defenders[0]);assert.equal(odds.defenderIds.length,2);assert.ok(odds.odds>=1);
const die=variant.rules.combat.table[String(odds.odds)].indexOf('DR')+1;assert.ok(die>0);
assert.equal(E.declareCombat(g,s,ids,defenders[0]),true);assert.equal(E.declareCombat(g,s,ids,defenders[1]),false);assert.equal(E.lockDeclarations(g,s),true);
const preview=E.previewNextDeclaration(g,s,die);assert.deepEqual(preview.cityHoldOptions.slice().sort(),defenders.slice().sort());
const committed=JSON.stringify(s);assert.equal(E.resolveDeclared(g,s,die,{standFastId:ids[0]}),null);assert.equal(JSON.stringify(s),committed);
const retreat=JSON.parse(committed);const r1=E.resolveDeclared(g,retreat,die,{standFastId:'none',advanceId:'none'});assert.ok(r1);assert.equal(r1.cityHold,false);assert.equal(r1.cleared,true);E.checkState(g,retreat);
const r=E.resolveDeclared(g,s,die,{standFastId:defenders[1]});assert.ok(r);assert.equal(r.cityHold,true);assert.equal(r.defenderLossId,defenders[1]);assert.equal(r.cleared,false);assert.equal(s.units.find(u=>u.id===defenders[1]).strength,'reduced');assert.equal(s.units.find(u=>u.id===defenders[0]).strength,'full');assert.equal(E.unitsAt(s,10,2).length,2);E.checkState(g,s);
({s,ids,defenders}=fixture());assert.ok(E.combatOdds(g,s,[ids[0]],defenders[0]).odds<1);const untouched=JSON.stringify(s);assert.equal(E.declareCombat(g,s,[ids[0]],defenders[0]),false);assert.equal(JSON.stringify(s),untouched);
assert.equal(JSON.stringify(p),before);console.log('PASS Moscow stacked combat foundation: capacity, combined defense, strict odds, hold/retreat and atomic rejection');
