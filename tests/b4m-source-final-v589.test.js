'use strict';
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360');
const E=require('../core/engine'),P=require('../core/native_preview_config');
const {original,config}=load(),g=E.build(P.project(original,config));
function fixture(){const s=E.start(g,17,'auto-reference');s.units.forEach(u=>delete u.position);Object.assign(s,{side:'german',phaseIndex:2,turn:2});return s;}
for(const strength of ['full','reduced']){
 const s=fixture(),d=s.units.find(u=>u.id==='s3');d.position={x:5,y:5};d.strength=strength;
 const ids=['g24','g41','g57'];for(const [i,dir] of ['S','SE','N'].entries()){const n=E.neighbors(5,5).find(h=>h.dir===dir);const u=s.units.find(u=>u.id===ids[i]);u.position={x:n.x,y:n.y};}
 const o=E.combatOdds(g,s,ids,d.id),die=g.rules.combat.table[String(o.odds)].indexOf('DE')+1;assert.ok(die>=1&&die<=6);
 assert.equal(E.declareCombat(g,s,ids,d.id),true);assert.equal(E.endPhase(g,s),false);assert.equal(E.lockDeclarations(g,s),true);assert.equal(E.previewNextDeclaration(g,s,die).outcome,'DE');assert.equal(E.resolveDeclared(g,s,die,{advanceId:'none'}).result,'DE');assert.equal(d.strength,'dead');assert.ok(!d.position);
}
// Every city is tested for occupation, departure, and recapture by the other side.
let cityChecks=0;
for(const h of g.cells.values()){
 if(!h.city||h.city==='none')continue;
 const s=fixture();s.phaseIndex=3;const key=`${h.x},${h.y}`;s.control[key]='soviet';
 const a=s.units.find(u=>u.id==='g24'),d=s.units.find(u=>u.id==='s3');
 const n=E.neighbors(h.x,h.y).find(n=>g.playable(n.x,n.y));a.position={x:n.x,y:n.y};
 assert.equal(E.move(g,s,a.id,h.x,h.y),true);assert.equal(s.control[key],'german');
 assert.equal(E.endPhase(g,s),true);s.side='german';s.phaseIndex=3;
 assert.equal(E.move(g,s,a.id,n.x,n.y),true);assert.equal(s.control[key],'german');
 delete a.position;s.side='soviet';s.moved=[];d.position={x:n.x,y:n.y};
 assert.equal(E.move(g,s,d.id,h.x,h.y),true);assert.equal(s.control[key],'soviet');cityChecks++;
}
assert.ok(cityChecks>0);
console.log('PASS DE both strengths; city entry, vacancy and recapture',cityChecks);
// Printed last-entry ownership differs from endpoint-only legacy/native policy.
const t=fixture();t.phaseIndex=3;const tank=t.units.find(u=>u.id==='g24');tank.position={x:0,y:0};t.control['1,4']='soviet';
const transit=E.legalMoves(g,t,tank.id).find(m=>m.x===1&&m.y===5);
assert.ok(transit.path.slice(0,-1).some(p=>p.x===1&&p.y===4));
assert.equal(E.move(g,t,tank.id,1,5),true);assert.equal(t.control['1,4'],'soviet');
console.log('DOCUMENTED city transit retains prior control (not printed last-entry parity)');
