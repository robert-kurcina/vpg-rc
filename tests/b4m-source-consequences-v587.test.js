'use strict';
// Printed §§7.2, 9.3, 12.2; native source-map fixtures, not historical positions.
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360');
const E=require('../core/engine'),P=require('../core/native_preview_config');
const {original,config}=load(),g=E.build(P.project(original,config));
let s,a,b,d,ids;
function fixture(x=5,y=5,turn=2,aid='g23',bid='g35',did='s3'){
 s=E.start(g,17,'auto-reference');s.units.forEach(u=>delete u.position);Object.assign(s,{side:'german',phaseIndex:2,turn});
 [a,b,d]=[aid,bid,did].map(id=>s.units.find(u=>u.id===id));d.position={x,y};d.strength='full';a.strength=b.strength='full';
 const ns=E.neighbors(x,y);a.position=ns.find(n=>n.dir==='S');b.position=ns.find(n=>n.dir==='SE');
 for(const u of [a,b])u.position={x:u.position.x,y:u.position.y};ids=[a.id,b.id];
}
function roll(code){let o=E.combatOdds(g,s,ids,d.id);return g.rules.combat.table[String(o.odds)]?.indexOf(code)+1;}
function resolve(code,options={}){const die=roll(code);assert.ok(die>0,code+' absent');assert.equal(E.declareCombat(g,s,ids,d.id),true);assert.equal(E.lockDeclarations(g,s),true);assert.equal(E.previewNextDeclaration(g,s,die).outcome,code);const r=E.resolveDeclared(g,s,die,{advanceId:'none',...options});assert.equal(r.result,code);return r;}
fixture();const origin={...d.position};const paths=E.retreatOptions(g,s,d);assert.ok(paths.some(p=>p.cost===0));assert.equal(paths[0].cost,0);
const safe=paths[0];assert.equal(E.distance(origin.x,origin.y,safe.x,safe.y),2);
const r=resolve('DR',{retreatTo:{x:safe.x,y:safe.y},advanceId:a.id});assert.equal(d.strength,'full');assert.deepEqual(d.position,{x:safe.x,y:safe.y});assert.deepEqual(a.position,origin);assert.equal(r.advanceId,a.id);
fixture();const friendly=s.units.find(u=>u.id==='s5');friendly.position={x:paths[0].x,y:paths[0].y};assert.ok(E.retreatOptions(g,s,d).every(p=>p.x!==friendly.position.x||p.y!==friendly.position.y));assert.ok(E.retreatOptions(g,s,d).every(p=>p.path.every(h=>ids.every(id=>{const u=s.units.find(v=>v.id===id);return h.x!==u.position.x||h.y!==u.position.y;}))));
fixture();const enemies=s.units.filter(u=>u.army==='german'&&!ids.includes(u.id));let i=0;for(const n of E.neighbors(d.position.x,d.position.y)){if([a,b].some(u=>u.position.x===n.x&&u.position.y===n.y))continue;enemies[i++].position={x:n.x,y:n.y};}assert.deepEqual(E.retreatOptions(g,s,d),[]);resolve('DR');assert.equal(d.strength,'dead');assert.ok(!d.position);
fixture();resolve('EX',{exchangeOrder:[a.id,b.id]});assert.equal(d.strength,'reduced');assert.equal(a.strength,'reduced');assert.equal(b.strength,'full');assert.equal((a.full??a.combatFull)-(a.reduced??a.combatReduced),(d.full??d.combatFull)-(d.reduced??d.combatReduced));
fixture();ids=[a.id];const old={...d.position};resolve('AL',{attackerLossId:a.id});assert.equal(a.strength,'reduced');assert.equal(d.strength,'full');assert.deepEqual(d.position,old);
fixture();d.strength='reduced';resolve('DE');assert.equal(d.strength,'dead');assert.ok(!d.position);
fixture(10,2);const city={...d.position};resolve('DR');assert.equal(d.strength,'reduced');assert.deepEqual(d.position,city);
console.log('PASS B4M direct DR, EX, AL, DE, advance, occupancy and full-strength city hold');
fixture();assert.ok(E.retreatOptions(g,s,d).every(p=>!E.enemyZoc(g,s,p.x,p.y,'soviet')));
fixture();let k=0;for(const n of E.neighbors(d.position.x,d.position.y)){if([a,b].some(u=>u.position.x===n.x&&u.position.y===n.y))continue;s.units.filter(u=>u.army==='german'&&!ids.includes(u.id))[k++].position={x:n.x,y:n.y};}
resolve('EX',{exchangeOrder:[a.id,b.id]});assert.equal(d.strength,'dead');assert.equal(a.strength,'reduced');assert.equal(b.strength,'full');
fixture(5,5,3,'g47','g23');assert.equal(E.combatOdds(g,s,ids,d.id).attackerFactors[a.id],4.5);resolve('EX',{exchangeOrder:[a.id,b.id]});assert.equal((a.full??a.combatFull)-(a.reduced??a.combatReduced),5);assert.equal(a.strength,'reduced');assert.equal(b.strength,'full');
console.log('PASS EX extra retreat loss excluded and printed mud strength liability');
// Known printed-vs-runtime differences: do not promote these to source-tested.
fixture(10,6,2,'g34','g42');ids=[a.id];assert.equal(E.combatOdds(g,s,ids,d.id).odds,0);assert.equal(E.declareCombat(g,s,ids,d.id),false);
console.log('DOCUMENTED below-minimum declaration rejection; printed NE transaction not implemented');
