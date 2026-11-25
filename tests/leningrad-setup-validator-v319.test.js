'use strict';
const A=require('node:assert/strict');
const V=require('../core/leningrad_setup_validator.js');
const M=require('../maps/leningrad.json');
const P=require('../maps/movement-configs/leningrad.json');
const B=require('../core/movement_binding.js');
const board=B.build(M,P).board;
const crosses=['0109','0210','0211','0310','0411']; // candidate, not authorized
const stars=['0108','0209','0309','0410','0510'];
const adjacency=(a,b)=>board.edges.some(e=>(e.a===a&&e.b===b)||(e.b===a&&e.a===b));
const ger=['infantry','infantry','infantry','infantry','infantry','infantry','infantry','panzer','panzer'].map((kind,i)=>({id:'g'+i,owner:'german',kind,hex:crosses[Math.min(Math.floor(i/2),4)]}));
const sov=['army','mechanized','army','mechanized','corps'].map((kind,i)=>({id:'s'+i,owner:'soviet',kind,hex:stars[i]}));
// Explicitly find two non-neighboring star placements for the 2 armies.
const pair=[];for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)if(!adjacency(stars[i],stars[j]))pair.push([i,j]);
A.ok(pair.length>0);
const [i,j]=pair[0];const sov0=stars.map((hex,k)=>({id:'s'+k,owner:'soviet',kind:k===i||k===j?'army':k===([0,1,2,3,4].find(q=>q!==i&&q!==j))?'corps':'mechanized',hex}));
const opts={germanCrosses:crosses,sovietStars:stars,units:[...ger,...sov0],adjacent:adjacency};
const evaluate=patch=>V.validate({...opts,...patch});
A.equal(evaluate().valid,true);A.equal(evaluate().historicalSetupAuthorized,false);
A.equal(evaluate({germanCrosses:crosses.slice(0,4)}).valid,false);
A.equal(evaluate({sovietStars:stars.slice(0,4)}).valid,false);
A.equal(evaluate({units:[...ger.slice(1),...sov0]}).valid,false);
A.equal(evaluate({units:[...ger,...sov0.slice(1)]}).valid,false);
A.equal(evaluate({units:[...ger.map((u,k)=>k===0?{...u,hex:'0101'}:u),...sov0]}).valid,false);
A.equal(evaluate({units:[...ger.map((u,k)=>k===0?{...u,kind:'panzer'}:u),...sov0]}).valid,false);
A.equal(evaluate({units:[...ger,...sov0.map((u,k)=>k===0?{...u,id:'g0'}:u)]}).valid,false);
A.equal(evaluate({units:[...ger,...sov0.map((u,k)=>k===i?{...u,hex:sov0[j].hex}:u)]}).valid,false);
const neighbor=[];for(let x=0;x<5;x++)for(let y=x+1;y<5;y++)if(adjacency(stars[x],stars[y]))neighbor.push([x,y]);
if(neighbor.length){const [x,y]=neighbor[0];const shifted=sov0.map((u,k)=>({...u,kind:k===x||k===y?'army':k===([0,1,2,3,4].find(q=>q!==x&&q!==y))?'corps':'mechanized'}));A.equal(evaluate({units:[...ger,...shifted]}).valid,false);}
A.throws(()=>V.validate({units:[]}),/Explicit/);
A.equal(ger[0].hex,crosses[0]);
console.log('PASS Leningrad proposed setup validator 12+ checks');
