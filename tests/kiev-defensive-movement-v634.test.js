'use strict';
const A=require('node:assert/strict'),Auto=require('../core/historical_campaign_autoplay'),Binding=require('../core/movement_binding');
const F=require('./fixtures/kiev-source-opening-v437');
const map=F.map,profile=require('../maps/movement-configs/kiev.json'),context={map,profile};
const board=Binding.build(map,profile).board;
const adj=new Map(Object.keys(board.cells).map(h=>[h,[]]));
for(const e of board.edges)if(!e.impassable&&!e.allSea&&!e.lake){adj.get(e.a).push(e.b);adj.get(e.b).push(e.a);}
const cityHex=new Set(map.cells.filter(c=>c.city?.name).map(c=>c.id));
const city=map.cells.find(c=>c.city?.name&&adj.get(c.id)?.filter(h=>!cityHex.has(h)).length>=2);
const [enemy,origin]=adj.get(city.id).filter(h=>!cityHex.has(h));
const unit=(id,owner,hex)=>({id,owner,hex});
const move=(id,from,to)=>({type:'declare-ground-move',request:{unitId:id,path:[from,to]}});
const control=Object.fromEntries(map.cells.filter(c=>c.city?.name).map(c=>[c.city.name,'german']));
let n=0;const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
// Unit-level ranking fixtures on actual map graph, not legal route discovery.
for(const actor of ['german','soviet']){
 const other=actor==='german'?'soviet':'german';
 const cityControl=Object.fromEntries(Object.keys(control).map(k=>[k,actor]));
 const rank=(units,commands,cc=cityControl)=>{const snapshot={actor,state:{units:Object.fromEntries(units.map(u=>[u.id,u])),cityControl:cc}};const before=JSON.stringify(snapshot);const r=Auto.rankObjectiveMoves({snapshot,context,commands});eq(JSON.stringify(snapshot),before);return r;};
 const e=unit('e',other,enemy),g=unit('g',actor,city.id),r=unit('r',actor,origin);
 const enter=move('r',origin,city.id),leave=move('g',city.id,origin);
 let out=rank([e,r],[enter]);eq(out.length,1);eq(out[0].reinforced,1);eq(out[0].action,enter);eq(out[0].progress,0);
 eq(rank([e,g],[leave]),[]);
 eq(rank([r],[enter]),[]);
 eq(rank([e,g,r],[enter]),[]);
 // Capture along a synthetic catalogue path cannot override last-garrison guard.
 const target=map.cells.find(c=>c.city?.name&&c.id!==city.id);
 const cc={...cityControl,[target.city.name]:other};
 const capture=move('g',city.id,target.id);
 eq(rank([e,g],[capture],cc),[]);
 out=rank([e,g,unit('g2',actor,city.id)],[capture],cc);eq(out.length,1);eq(out[0].captured,1);eq(out[0].abandoned,0);
 out=rank([g],[capture],cc);eq(out.length,1);eq(out[0].captured,1);
}
console.log('PASS defensive movement',n,'assertions',city.id,city.city.name);
