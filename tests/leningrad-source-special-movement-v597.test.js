'use strict';
// Printed §§8,9.3–9.5, actual shipped graph, controlled positions.
const assert=require('node:assert/strict');
const B=require('../core/movement_binding'),M=require('../core/movement_rules');
const binding=B.build(require('../maps/leningrad.json'),require('../maps/movement-configs/leningrad.json'));
const {board}=binding;let checks=0;
const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++};
const adj=x=>board.edges.filter(e=>(e.a===x||e.b===x)&&!e.impassable&&!e.allSea&&!e.lake).map(e=>e.a===x?e.b:e.a);
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
eq(move(q,[a,b,c]).reason,'special-ineligible','no Surprise Attack in Leningrad');
eq(move(ctx(g,2,'special-movement',[s]),[a,b]).reason,'special-ineligible','reserve blocked in EZOC');
eq(move(ctx(g,1,'movement',[s]),[a,b,c]).reason,'ezoc-stops-movement','normal ZOC stop');
eq(move(ctx(g),[a,b]).cost,2,'ordinary rough cost');
eq(move(ctx(g),[a,b,c]).reason,'insufficient-movement-points','ordinary reserve half allowance');
const panzer={...g,class:'panzer'};eq(move(ctx(panzer,2,'special-movement',[s]),[a,b]).ok,true,'panzer may leave EZOC');
// Soviet rail reserve uses full allowance only on connected rails.
let rail;
for(const x of Object.keys(board.cells))for(const y of adj(x))for(const z of adj(y))if(x!==z&&edge(x,y).rail&&edge(y,z).rail&&!rail)rail=[x,y,z];
assert.ok(rail);const [x,y,z]=rail;const army=unit('u','soviet',x,'infantry','army');
eq(move(ctx(army),rail,'rail').remaining,2,'rail full allowance');eq(move(ctx(army),rail).remaining,0,'ordinary reserve half allowance');
const off=adj(y).find(h=>h!==x&&!edge(y,h).rail);assert.ok(off);
eq(move(ctx(army),[x,y,off],'rail').reason,'rail-route-required','rail must follow connected edge');
const en=unit('e','german',adj(x).find(h=>h!==y&&h!==z));eq(move(ctx(army,2,'special-movement',[en]),rail,'rail').reason,'rail-ineligible','rail reserve cannot start in EZOC');
const mech={...army,class:'mechanized',size:'corps'};eq(move(ctx(mech,2,'special-movement',[en]),[x,y]).ok,true,'mechanized can leave EZOC');eq(move(ctx(mech),rail).remaining,2,'mechanized full allowance');
// §8.1/9.2 final stacking combinations.
const friend=unit('f','soviet',y,'infantry','army');
eq(move(ctx(army,2,'movement',[friend]),[x,y]).reason,'army-stack-limit','two armies forbidden');
eq(move(ctx(mech,2,'movement',[friend]),[x,y]).ok,true,'army plus corps permitted');
eq(move(ctx(mech,2,'movement',[{...friend,size:'corps'}]),[x,y]).ok,true,'two corps permitted');
eq(move(ctx(mech,2,'movement',[friend,{...friend,id:'f2',size:'corps'}]),[x,y]).reason,'stack-limit','third ground unit forbidden');
eq(move(ctx(mech,2,'movement',[friend,{...friend,id:'marker',marker:true}]),[x,y]).ok,true,'marker stack free');
const LP=require('../core/legal_pathfinding');
let stack;
for(const a of Object.keys(board.cells)){for(const b of adj(a))for(const c of adj(b)){
 if(c===a||adj(a).includes(c))continue;
 const q=ctx(unit('u','german',a),2,'movement',[unit('f','german',b),unit('f2','german',b)]);
 if(!move(q,[a,b,c]).ok)continue;
 const old={...q,profile:{...q.profile,allowFriendlyOverstackTransit:false}};
 if(LP.search(old,{unitId:'u'}).pathTo(c)!==null)continue;
 stack={a,b,c,q};break;
}if(stack)break;}
assert.ok(stack);eq(move(stack.q,[stack.a,stack.b]).reason,'stack-limit');eq(M.transit(stack.q,{unitId:'u',path:[stack.a,stack.b]}).ok,true);eq(LP.search(stack.q,{unitId:'u'}).pathTo(stack.b),null);eq(LP.search(stack.q,{unitId:'u'}).pathTo(stack.c)!==null,true);
console.log('PASS Leningrad source special movement',checks,'assertions',JSON.stringify({fixture,rail}));
