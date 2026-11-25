'use strict';
const A=require('node:assert/strict');
const {selectCoordinatedPlan:choose,selectRankedPlan:greedy}=require('../core/historical_campaign_autoplay');
let checks=0; const eq=(a,b)=>{A.deepEqual(a,b);checks++};
const make=(hex,attackers,delta,method)=>({battle:{defenderHex:hex,attackers},delta,...(method?{method}:{})});
const a=make('0101',['a','b'],9), b=make('0102',['a'],6),c=make('0103',['b'],6),d=make('0104',['d'],2);
const evaluated=[a,b,c,d], before=JSON.stringify(evaluated);
const run=(extra={})=>choose({evaluated,limit:2,validate:()=>true,...extra});
eq(greedy({ranked:evaluated.map(x=>x.battle),limit:2,validate:()=>true}),[a.battle,d.battle]);
eq(run(),[b.battle,c.battle]);
eq(run({maxTrials:0}),[a.battle,d.battle]);
eq(run({limit:0}),[]);
eq(run({limit:1}),[a.battle]);
eq(run({validate:()=>false}),[]);
eq(run({validate:xs=>!(xs.includes(b.battle)&&xs.includes(c.battle))}),[a.battle,d.battle]);
eq(JSON.stringify(evaluated),before);
const air=make('0105',['e'],8,'supported-detailed-utility'),air2=make('0106',['f'],7,'supported-detailed-utility');
const proxy=make('0107',['a'],100,'known-odds-proxy');
eq(run({evaluated:[b,air,air2,proxy],validate:xs=>!xs.includes(air.battle)||xs[0]===air.battle}),[air.battle,b.battle]);
eq(run({evaluated:[b,proxy,d]}),[b.battle,d.battle]);
eq(run({evaluated:[b,make('0108',['z'],100,'public-roster-proxy')]}).length,2);
// Compare against exhaustive subset oracle for small deterministic fixtures.
for(let seed=1;seed<=20;seed++){
 const entries=Array.from({length:6},(_,i)=>make(String(i%4),[String((seed+i*i)%5)],1+(seed*(i+2))%11));
 const valid=xs=>new Set(xs.map(x=>x.defenderHex)).size===xs.length&&new Set(xs.flatMap(x=>x.attackers)).size===xs.flatMap(x=>x.attackers).length;
 let best=0;for(let mask=0;mask<64;mask++){const xs=entries.filter((_,i)=>mask&(1<<i));if(xs.length<=3&&valid(xs.map(x=>x.battle)))best=Math.max(best,xs.reduce((n,x)=>n+x.delta,0));}
 const selected=run({evaluated:entries,limit:3,validate:valid,maxTrials:1000});
 eq(valid(selected),true);eq(selected.reduce((n,x)=>n+entries.find(e=>e.battle===x).delta,0),best);
}
console.log('PASS coordinated attack plan',checks,'assertions');
