'use strict';
// Printed §§7–8, bounded native fixtures on the shipped map.
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360');
const E=require('../core/engine'),P=require('../core/native_preview_config');
const {original,config}=load(),g=E.build(P.project(original,config));
let s,u,v,f;
const pos=(x,y)=>({x,y});
function fixture(side='german',phase=3,turn=2){s=E.start(g,17,'auto-reference');s.units.forEach(a=>delete a.position);Object.assign(s,{side,phaseIndex:phase,turn,moved:[]});u=s.units.find(a=>a.army===side&&a.type==='infantry');v=s.units.find(a=>a.army!==side&&a.type==='infantry');f=s.units.find(a=>a.army===side&&a.type==='infantry'&&a!==u);u.position=pos(5,5);}
const moves=()=>E.legalMoves(g,s,u.id), at=(x,y)=>moves().find(p=>p.x===x&&p.y===y);
fixture();v.position=pos(6,5);
assert.equal(E.neighbors(6,5).length,6);
assert.ok(E.neighbors(6,5).every(p=>E.enemyZoc(g,s,p.x,p.y,s.side)));
assert.equal(at(6,5),undefined);
assert.equal(at(6,4).cost,1); // EZOC to EZOC, one step
assert.ok(moves().every(p=>p.path.slice(0,-1).every(h=>!E.enemyZoc(g,s,h.x,h.y,s.side))));
assert.equal(at(4,5).cost,1); // leave EZOC, no surcharge
assert.equal(E.enemyZoc(g,s,4,5,s.side),false);
fixture();assert.equal(at(5,4).cost,2);assert.ok(moves().every(p=>p.cost<=u.movement));
for(const p of moves()){let prev=u.position;for(const h of p.path){assert.equal(E.distance(prev.x,prev.y,h.x,h.y),1);prev=h;}}
fixture('german',3,3);assert.ok(moves().length);assert.ok(moves().every(p=>p.cost<=1));assert.equal(at(5,4).cost,1);
fixture();f.position=pos(5,6);assert.equal(at(5,6),undefined);assert.ok(moves().some(p=>p.path.slice(0,-1).some(h=>h.x===5&&h.y===6)));
assert.equal(E.move(g,s,u.id,5,6),false);assert.equal(E.checkState(g,s),true);
assert.equal(E.move(g,s,u.id,6,4),true);assert.deepEqual(moves(),[]);
fixture('german',2);assert.deepEqual(moves(),[]);
fixture('german',1);assert.deepEqual(moves(),[]);
fixture('soviet',1);assert.deepEqual(moves(),[]);u.position=pos(5,3);assert.ok(moves().length);
for(const p of moves()){assert.equal(p.cost,p.path.length);assert.ok(p.cost<=4);let prev=u.position;for(const h of p.path){let edge=E.neighbors(prev.x,prev.y).find(n=>n.x===h.x&&n.y===h.y);assert.ok(g.cells.get(`${prev.x},${prev.y}`).rail.includes(edge.dir));prev=h;}}
assert.equal(at(6,3).cost,1);
fixture("soviet",1,3);u.position=pos(5,3);assert.ok(moves().some(p=>p.cost>1));
console.log('PASS B4M native source movement and ZOC');

// The committed canonical route, not merely its endpoint, determines city control.
fixture();
const cities=new Set([...g.cells.values()].filter(h=>h.city&&h.city!=='none').map(h=>h.x+','+h.y));
let route=null;
for(const cell of g.cells.values()){
 if(!g.playable(cell.x,cell.y))continue;
 u.position={x:cell.x,y:cell.y};s.moved=[];
 route=moves().find(m=>m.path.slice(0,-1).some(h=>cities.has(h.x+','+h.y)));
 if(route)break;
}
assert.ok(route,'fixture must find a route through an intermediate city');
const visited=route.path.filter(h=>cities.has(h.x+','+h.y));
for(const h of visited)s.control[h.x+','+h.y]='soviet';
assert.ok(E.move(g,s,u.id,route.x,route.y));
for(const h of visited)assert.equal(s.control[h.x+','+h.y],'german');
assert.deepEqual(s.log.at(-1).path,route.path);
console.log('PASS committed path city ownership');
