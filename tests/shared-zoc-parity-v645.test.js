'use strict';
const A=require('node:assert/strict'), M=require('../core/movement_rules');
function oracle(ctx,hex,owner){
 const through=ctx.profile?.zocAcrossImpassableHexsides===true;
 if(!ctx.board?.cells?.[hex]?.verified)return false;
 const adjacent=new Set((ctx.board.edges||[]).filter(e=>e.verified&&!e.allSea&&(through||(!e.lake&&!e.impassable))&&(e.a===hex||e.b===hex)).map(e=>e.a===hex?e.b:e.a));
 return Object.values(ctx.units||{}).some(x=>x.owner!==owner&&x.marker!==true&&x.strengthStatus!=='eliminated'&&x.hex&&ctx.board.cells[x.hex]?.verified&&adjacent.has(x.hex));
}
let checks=0;
for(let mask=0;mask<256;mask++)for(const through of [false,true])for(const owner of ['german','soviet']){
 const ctx={profile:{zocAcrossImpassableHexsides:through},board:{cells:{a:{verified:true},b:{verified:!(mask&1)},c:{verified:true}},edges:[{a:'a',b:'b',verified:!(mask&2),allSea:!!(mask&4),lake:!!(mask&8),impassable:!!(mask&16)},{a:'c',b:'a',verified:true}]},units:{x:{owner:'soviet',hex:'b',marker:!!(mask&32),strengthStatus:mask&64?'eliminated':'full'},y:{owner:'german',hex:mask&128?'c':'a'}}};
 for(const hex of ['a','b','c','missing']){A.equal(M.enemyZOC(ctx,hex,owner),oracle(ctx,hex,owner));checks++;}
 // mutable board and units must never use stale cached adjacency
 ctx.board.edges[0].verified=false;ctx.units.x.hex='c';
 A.equal(M.enemyZOC(ctx,'a',owner),oracle(ctx,'a',owner));checks++;
}
console.log(`PASS ${checks} ZOC oracle parity checks`);
