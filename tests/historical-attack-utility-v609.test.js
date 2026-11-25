'use strict';
const A=require('node:assert/strict'),U=require('../core/historical_attack_utility'),CRT=require('../core/historical_crt');
let n=0;const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};
const values={AL:-1,NE:0,EX:0,DR:0.5,DRL:1.5,DE:2};
const assess=(odds,variant,rest={})=>U.evaluate({odds,variant,outcomeUtility:values,inactionUtility:0,...rest});
for(const variant of ['standard','advanced']){
 for(const [col,rolls] of Object.entries(CRT.columns(variant))){
  const r=assess(+col,variant),counts={};for(const x of rolls)counts[x]=(counts[x]||0)+1;
  eq(r.distribution,counts);eq(r.expectedUtility,rolls.reduce((s,x)=>s+values[x],0)/6);
  eq(r.eligible,+col>1&&r.delta>0);
 }
 eq(assess(0,variant,{reason:'desperation',eliminationRisk:1,inactionUtility:-100}).eligible,false);
}
for(const [odds,risk] of [[0.5,.75],[1,.5]]){
 const forecast={reason:'desperation',eliminationRisk:risk,inactionUtility:-2};
 eq(assess(odds,'advanced',forecast).eligible,true);
 eq(assess(odds,'advanced',{...forecast,eliminationRisk:risk-.01}).eligible,false);
 eq(assess(odds,'advanced',{...forecast,eliminationRisk:null}).eligible,false);
 eq(assess(odds,'advanced',{...forecast,opportunityCost:3}).eligible,false);
 eq(assess(odds,'advanced',{...forecast,inactionUtility:1}).eligible,false);
}
eq(assess(1,'standard',{reason:'preemptive',inactionUtility:-1}).eligible,true);
eq(assess(1,'standard',{reason:'breakout',inactionUtility:1}).eligible,false);
eq(assess(1,'standard',{inactionUtility:-100}).eligible,false,'Risk requires a named justification');
for(const invalid of [{eliminationRisk:1.1},{opportunityCost:-1},{reason:'unknown'},{outcomeUtility:{}}]){A.throws(()=>assess(1,'standard',invalid));n++;}
A.throws(()=>assess(.5,'standard'));n++;
console.log('PASS v609 utility arithmetic',n,'assertions');
