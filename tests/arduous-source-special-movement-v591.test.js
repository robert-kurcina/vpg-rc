'use strict';
// Printed §§8,9.3–9.5, actual shipped graph, controlled positions.
const assert=require('node:assert/strict');
const B=require('../core/movement_binding'),M=require('../core/movement_rules');
const binding=B.build(require('../maps/arduous.json'),require('../maps/movement-configs/arduous.json'));
const {board}=binding;let checks=0;
const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++};
const adj=x=>board.edges.filter(e=>e.a===x||e.b===x).map(e=>e.a===x?e.b:e.a);
const edge=(a,b)=>board.edges.find(e=>[e.a,e.b].includes(a)&&[e.a,e.b].includes(b));
const unit=(id,owner,hex,klass='infantry',size='corps')=>({id,owner,hex,class:klass,size,mp:4});
const ctx=(u,turn=2,kind='special-movement',others=[])=>B.context(binding,{owner:u.owner,kind},Object.fromEntries([u,...others].map(x=>[x.id,x])),turn);
const move=(c,path,mode)=>M.move(c,{unitId:'u',path,mode});
// Choose an actual two-edge route through rough terrain, in enemy ZOC at origin and intermediate.
let fixture;
for(const a of Object.keys(board.cells))for(const b of adj(a))for(const c of adj(b)){
 if(c===a||edge(a,b).rail||!['forest','swamp'].includes(board.cells[b].terrain))continue;
 const enemy=adj(a).find(x=>x!==b&&x!==c&&adj(b).includes(x));
 if(enemy&&!fixture)fixture={a,b,c,enemy};
}
assert.ok(fixture);const {a,b,c,enemy}=fixture;
const g=unit('u','german',a),s=unit('e','soviet',enemy);
let q=ctx(g,1,'special-movement',[s]);
eq(M.enemyZOC(q,a,'german'),true,'origin EZOC');eq(M.enemyZOC(q,b,'german'),true,'intermediate EZOC');
eq(move(q,[a,b,c]).ok,true,'§9.5 surprise ignores EZOC and terrain');eq(move(q,[a,b,c]).cost,2,'half allowance');
const d=adj(c).find(x=>![a,b,enemy].includes(x));assert.ok(d);
eq(move(q,[a,b,c,d]).reason,'insufficient-movement-points','infantry half allowance');
eq(move(q,[a,enemy]).reason,'enemy-occupied','surprise never permits enemy occupation');
eq(move(ctx(g,2,'special-movement',[s]),[a,b]).reason,'special-ineligible','later reserve blocked in EZOC');
eq(move(ctx(g,1,'movement',[s]),[a,b,c]).reason,'ezoc-stops-movement','surprise limited to special phase');
eq(move(ctx(g,1,'combat',[s]),[a,b]).reason,'wrong-phase','no surprise movement in combat');
eq(move(ctx(g),[a,b]).cost,2,'ordinary rough cost');eq(move(ctx(g),[a,b,c]).reason,'insufficient-movement-points','ordinary reserve half allowance');
const panzer={...g,class:'panzer'};eq(move(ctx(panzer,2,'special-movement',[s]),[a,b]).ok,true,'panzer may leave EZOC');eq(move(ctx(panzer,1,'special-movement',[s]),[a,b,c,d]).remaining,1,'panzer full surprise allowance');
// Soviet rail reserve uses full allowance only on connected rails.
let rail;
for(const x of Object.keys(board.cells))for(const y of adj(x))for(const z of adj(y))if(x!==z&&edge(x,y).rail&&edge(y,z).rail&&!rail)rail=[x,y,z];
assert.ok(rail);const [x,y,z]=rail;const army=unit('u','soviet',x,'infantry','army');
eq(move(ctx(army),rail,'rail').remaining,2,'rail full allowance');eq(move(ctx(army),rail).remaining,0,'ordinary reserve half allowance');
const off=adj(y).find(h=>h!==x&&!edge(y,h).rail);assert.ok(off);
eq(move(ctx(army),[x,y,off],'rail').reason,'rail-route-required','rail must follow connected edge');
const en=unit('e','german',adj(x).find(h=>h!==y&&h!==z));eq(move(ctx(army,2,'special-movement',[en]),rail,'rail').reason,'rail-ineligible','rail reserve cannot start in EZOC');
const mech={...army,class:'mechanized',size:'corps'};eq(move(ctx(mech,2,'special-movement',[en]),[x,y]).ok,true,'mechanized can leave EZOC');eq(move(ctx(mech),rail).remaining,2,'mechanized full allowance');
// §8.1/9.2 temporary movement stacking; final limits tested separately.
const friend=unit('f','soviet',y,'infantry','army');
eq(move(ctx(army,2,'movement',[friend]),[x,y]).ok,true,'two armies temporarily permitted');
eq(move(ctx(mech,2,'movement',[friend]),[x,y]).ok,true,'army plus corps permitted');
eq(move(ctx(mech,2,'movement',[{...friend,size:'corps'}]),[x,y]).ok,true,'two corps permitted');
eq(move(ctx(mech,2,'movement',[friend,{...friend,id:'f2',size:'corps'}]),[x,y]).ok,true,'third ground unit temporarily permitted');
eq(move(ctx(mech,2,'movement',[friend,{...friend,id:'marker',marker:true}]),[x,y]).ok,true,'marker stack free');
console.log('PASS Arduous source special movement',checks,'assertions',JSON.stringify({fixture,rail}));
