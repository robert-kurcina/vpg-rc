'use strict';
const A=require('node:assert/strict'),V=require('../core/graduated_victory'),P=require('../maps/victory-configs/graduated-research-v1.json');
let count=0;
for(const [scenario,p] of Object.entries(P)){
 const weights=Object.fromEntries(p.cities.map((k,i)=>[k,i%3+1]));
 const thresholds=Array.from({length:p.moscow?7:8},(_,i)=>i+1);
 const config={weights,thresholds};
 for(let n=0;n<=p.cities.length;n++){
  const report={scenario,status:'complete',exactRestore:true,terminal:{winner:'soviet'},cityControl:Object.fromEntries(p.cities.map((k,i)=>[k,i<n?'german':'soviet']))};
  const before=JSON.stringify([report,config]); const out=V.evaluateWeighted(report,config);
  A.equal(out.germanVP,p.cities.slice(0,n).reduce((a,k)=>a+weights[k],0));
  A.equal(out.germanVP+out.sovietVP,out.totalVP);A.equal(JSON.stringify([report,config]),before);
  A.deepEqual(out.historical,report.terminal);
  const unit=V.evaluateWeighted(report,{weights:Object.fromEntries(p.cities.map(k=>[k,1])),thresholds});
  A.equal(unit.graduated,V.evaluate(report,thresholds).graduated);
  A.equal(unit.germanVP,n);
  if(p.moscow)A.equal(out.graduated==='german-decisive',report.cityControl[p.moscow]==='german');
  else A.equal(out.graduated==='german-decisive',out.germanVP>=thresholds.at(-1));
  count+=7;
 }
 const report={scenario,status:'complete',exactRestore:true,terminal:{winner:'soviet'},cityControl:Object.fromEntries(p.cities.map(k=>[k,'soviet']))};
 for(const bad of [0,-1,1.5,101,NaN]){A.throws(()=>V.evaluateWeighted(report,{...config,weights:{...weights,[p.cities[0]]:bad}}));count++;}
 const missing={...weights};delete missing[p.cities[0]];
 A.throws(()=>V.evaluateWeighted(report,{...config,weights:missing}));A.throws(()=>V.evaluateWeighted(report,{...config,weights:{...weights,extra:1}}));A.throws(()=>V.evaluateWeighted(report,{...config,thresholds:[1,1]}));count+=3;
}
console.log(`${count} weighted scoring assertions passed`);
