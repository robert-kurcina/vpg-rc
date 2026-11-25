'use strict';
const A=require('node:assert/strict'),V=require('../core/graduated_victory'),P=require('../maps/victory-configs/graduated-research-v1.json');let cases=0;
for(const [scenario,p] of Object.entries(P)){
 const thresholds=Array.from({length:p.moscow?7:8},(_,i)=>i+1);
 for(let n=0;n<=p.cities.length;n++){
 const report={scenario,status:'complete',exactRestore:true,terminal:{winner:'soviet'},cityControl:Object.fromEntries(p.cities.map((k,i)=>[k,i<n?'german':'soviet']))};
 const original=JSON.stringify(report),m=V.measure(report),v=V.evaluate(report,thresholds);
 A.equal(m.german,n);A.equal(m.soviet,p.cities.length-n);A.equal(JSON.stringify(report),original);A.deepEqual(v.historical,report.terminal);
 A.equal(v.graduated==='german-decisive',p.moscow?report.cityControl[p.moscow]==='german':n>=8);
 A.throws(()=>V.evaluate(report));A.throws(()=>V.evaluate(report,thresholds.map(()=>1)));A.throws(()=>V.measure({...report,status:'blocked'}));A.throws(()=>V.measure({...report,exactRestore:false}));
 const bad={...report,cityControl:{...report.cityControl}};delete bad.cityControl[p.cities[0]];A.throws(()=>V.measure(bad));cases++;
 }
}
console.log(`${cases} terminal city-count cases, ${cases*10} assertions passed`);
