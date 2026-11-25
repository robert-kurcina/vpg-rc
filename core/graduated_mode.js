/* Optional territorial scoring. Fixed experimental profiles are configuration, not printed historical rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameGraduatedMode=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PROFILES={
 "battle-for-moscow": {
  "id": "territorial-experimental-v1",
  "scenario": "battle-for-moscow",
  "weights": {
   "1,4": 1,
   "2,6": 1,
   "4,8": 1,
   "5,1": 1,
   "5,3": 1,
   "7,3": 1,
   "7,5": 1,
   "7,9": 1,
   "10,2": 3,
   "10,6": 2,
   "13,5": 1
  },
  "thresholds": [
   3,
   4,
   5,
   6,
   7,
   9,
   10
  ],
  "decisiveCity": "10,2"
 },
 "arduous": {
  "id": "territorial-experimental-v1",
  "scenario": "arduous",
  "weights": {
   "Brest-Litovsk": 1,
   "Vilnius": 1,
   "Baranovichi": 1,
   "Minsk": 2,
   "Polotsk": 1,
   "Velikie Luki": 1,
   "Vitebsk": 1,
   "Orsha": 1,
   "Mogilev": 1,
   "Gomel": 1,
   "Smolensk": 2,
   "Roslavl": 1
  },
  "thresholds": [
   3,
   4,
   6,
   7,
   8,
   10,
   12,
   14
  ],
  "decisiveCity": null
 },
 "leningrad": {
  "id": "territorial-experimental-v1",
  "scenario": "leningrad",
  "weights": {
   "Liepaja": 1,
   "Insterburg": 1,
   "Siauliai": 1,
   "Riga": 1,
   "Kaunas": 1,
   "Parnu": 1,
   "Tallinn": 1,
   "Daugavpils": 1,
   "Tartu": 1,
   "Narva": 1,
   "Pskov": 1,
   "Luga": 1,
   "Leningrad": 3,
   "Novgorod": 1
  },
  "thresholds": [
   3,
   5,
   6,
   7,
   8,
   10,
   12,
   16
  ],
  "decisiveCity": null
 },
 "kiev": {
  "id": "territorial-experimental-v1",
  "scenario": "kiev",
  "weights": {
   "Lublin": 1,
   "Lvov": 1,
   "Kovel": 1,
   "Stanislavov": 1,
   "Tarnopol": 1,
   "Chernovtsy": 1,
   "Rovno": 1,
   "Sarny": 1,
   "Shepetovka": 1,
   "Iasi": 1,
   "Zhitomir": 1,
   "Vinnitsa": 1,
   "Kiev": 3,
   "Uman": 1,
   "Chernigov": 1,
   "Kirovograd": 1
  },
  "thresholds": [
   4,
   6,
   8,
   9,
   10,
   12,
   15,
   18
  ],
  "decisiveCity": null
 },
 "kiev-odessa": {
  "id": "territorial-experimental-v1",
  "scenario": "kiev-odessa",
  "weights": {
   "Lublin": 1,
   "Lvov": 1,
   "Kovel": 1,
   "Stanislavov": 1,
   "Tarnopol": 1,
   "Chernovtsy": 1,
   "Rovno": 1,
   "Sarny": 1,
   "Shepetovka": 1,
   "Iasi": 1,
   "Brăila": 1,
   "Zhitomir": 1,
   "Vinnitsa": 1,
   "Chisinau": 1,
   "Kiev": 3,
   "Uman": 1,
   "Odessa": 3,
   "Chernigov": 1,
   "Kirovograd": 1,
   "Nikolaev": 1
  },
  "thresholds": [
   5,
   7,
   9,
   10,
   11,
   14,
   18,
   24
  ],
  "decisiveCity": null
 }
};
const labels=Object.freeze(['soviet-decisive','soviet-major','soviet-minor','soviet-marginal','draw','german-marginal','german-minor','german-major','german-decisive']);
const clone=x=>JSON.parse(JSON.stringify(x));
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
function profile(scenario){if(!Object.hasOwn(PROFILES,scenario))throw Error('No graduated victory profile for '+scenario);return clone(PROFILES[scenario]);}
function validate(scenario,p){if(JSON.stringify(stable(p))!==JSON.stringify(stable(profile(scenario))))throw Error('Unknown or altered graduated victory profile');return p;}
function classify(ledger,weights,thresholds,decisiveCity=null){
 const keys=Object.keys(weights);if(!ledger||typeof ledger!=='object'||Array.isArray(ledger)||Object.keys(ledger).length!==keys.length||keys.some(k=>!Object.hasOwn(ledger,k)||!['german','soviet'].includes(ledger[k])))throw Error('Graduated city ledger mismatch');
 const totalVP=keys.reduce((n,k)=>n+weights[k],0),germanVP=keys.reduce((n,k)=>n+(ledger[k]==='german'?weights[k]:0),0);
 const index=decisiveCity&&ledger[decisiveCity]==='german'?8:thresholds.filter(v=>germanVP>=v).length;
 const grade=labels[index],winner=index===4?'draw':index<4?'soviet':'german';
 return {germanVP,sovietVP:totalVP-germanVP,totalVP,grade,index,winner};
}
function evaluate(p,ledger){validate(p.scenario,p);return classify(ledger,p.weights,p.thresholds,p.decisiveCity);}
function withNative(base,mode='historical'){const out=clone(base);if(mode==='historical'){delete out.objectives.graduatedVictory;return out;}if(mode!=='graduated')throw Error('Invalid victory mode');out.objectives.graduatedVictory=profile(out.game.id);return out;}
function withHistorical(base,mode='historical'){if(!['historical','graduated'].includes(mode))throw Error('Invalid victory mode');const out={...base};if(!base.housekeepingPolicy){if(mode==='graduated')throw Error('No campaign victory policy');return out;}out.housekeepingPolicy={...base.housekeepingPolicy};delete out.housekeepingPolicy.graduatedVictory;if(mode==='graduated')out.housekeepingPolicy.graduatedVictory=profile(base.config.scenarioId);return out;}
function description(p,ledger,complete){const r=evaluate(p,ledger);return `${complete?'Final':'Current projected'} experimental victory: ${r.grade.replaceAll('-',' ')} · German ${r.germanVP} VP / Soviet ${r.sovietVP} VP`;}
function criteria(p){
 validate(p.scenario,p);const cap=p.decisiveCity?Object.keys(p.weights).filter(k=>k!==p.decisiveCity).reduce((n,k)=>n+p.weights[k],0):Object.values(p.weights).reduce((a,b)=>a+b,0);
 const bands=[0,...p.thresholds].map((lo,i)=>{const hi=i<p.thresholds.length?p.thresholds[i]-1:cap;return labels[i].replaceAll('-',' ')+': '+(lo===hi?lo:lo+'–'+hi);});
 return 'German VP bands: '+bands.join('; ')+'. '+(p.decisiveCity?'Holding Moscow overrides as German decisive. ':'')+'City weights: '+Object.entries(p.weights).filter(([,v])=>v>1).map(([k,v])=>(k==='10,2'?'Moscow':k==='10,6'?'Tula':k)+' '+v).join(', ')+'; all other cities 1. No casualties or isolation bonuses. Experimental, not calibrated for human balance.';
}
return Object.freeze({profile,validate,classify,evaluate,withNative,withHistorical,description,criteria});
});
