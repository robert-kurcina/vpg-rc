'use strict';
// Research-only terminal scoring. Never used to adjudicate historical play.
const profiles=require('../maps/victory-configs/graduated-research-v1.json');
const Mode=require('./graduated_mode');
const labels=Object.freeze(['soviet-decisive','soviet-major','soviet-minor','soviet-marginal','draw','german-marginal','german-minor','german-major','german-decisive']);
function measure(report){
 if(!report||!Object.hasOwn(profiles,report.scenario)||report.status!=='complete'||report.exactRestore!==true||!report.terminal)throw Error('Complete restored campaign report required');
 const p=profiles[report.scenario],c=report.cityControl;
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).length!==p.cities.length||p.cities.some(k=>!Object.hasOwn(c,k)||!['german','soviet'].includes(c[k])))throw Error('City ledger mismatch');
 const german=p.cities.filter(k=>c[k]==='german').length;
 return {scenario:report.scenario,seed:report.seed,variant:report.variant,german,soviet:p.cities.length-german,total:p.cities.length,moscowHeld:p.moscow?c[p.moscow]==='german':null,historical:report.terminal};
}
function evaluate(report,thresholds){
 const m=measure(report);
 // Integer minimum Axis city counts for successive bands. No implicit defaults.
 // In Moscow, decisive German achievement is exclusively the approved objective.
 const n=m.moscowHeld===null?8:7;
 if(!Array.isArray(thresholds)||thresholds.length!==n||thresholds.some((v,i)=>!Number.isInteger(v)||v<1||v>m.total||(i>0&&v<=thresholds[i-1])))throw Error('Explicit strictly increasing integer thresholds required');
 const band=thresholds.filter(v=>m.german>=v).length;
 return {...m,graduated:m.moscowHeld===true?'german-decisive':labels[band],status:'research-only-unapproved'};
}
// Weighted VP candidates must be explicit and positive; a city is scored exactly once.
// Moscow's decisive override remains separate from the VP bands.
function evaluateWeighted(report,config){
 const m=measure(report),p=profiles[m.scenario];
 if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Explicit weighted configuration required');
 const {weights,thresholds}=config;
 if(!weights||typeof weights!=='object'||Array.isArray(weights)||Object.keys(weights).length!==p.cities.length||p.cities.some(k=>!Object.hasOwn(weights,k)||!Number.isSafeInteger(weights[k])||weights[k]<1||weights[k]>100))throw Error('Explicit positive integer weight required for every city (1–100)');
 const totalVP=p.cities.reduce((a,k)=>a+weights[k],0);
 const n=p.moscow?7:8;
 if(!Array.isArray(thresholds)||thresholds.length!==n||thresholds.some((v,i)=>!Number.isSafeInteger(v)||v<1||v>totalVP||(i>0&&v<=thresholds[i-1])))throw Error('Explicit strictly increasing integer VP thresholds required');
 const scored=Mode.classify(report.cityControl,weights,thresholds,p.moscow||null);
 return {...m,germanVP:scored.germanVP,sovietVP:scored.sovietVP,totalVP,graduated:scored.grade,status:'research-only-unapproved'};
}
module.exports={measure,evaluate,evaluateWeighted};
