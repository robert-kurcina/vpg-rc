/* Strict source-city and conditional-victory preflight for combined campaigns.
 * This is a read-only diagnostic and does not register an executable scenario.
 */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const fail=what=>{throw Error('composite-city-candidate: '+what);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clone=x=>JSON.parse(JSON.stringify(x));
function build(map,ledger,{root='.'}={}){
 if(!map||!Array.isArray(map.cells)||!ledger||ledger.schemaVersion!==1||
  ledger.status!=='source-candidate-not-gameplay-authorized'||ledger.mapId!==map.id||
  ledger.cityCount!==20||!Array.isArray(ledger.cities)||ledger.cities.length!==20||
  !obj(ledger.sourceSHA256))fail('invalid-source-city-ledger');
 for(const [file,sha] of Object.entries(ledger.sourceSHA256)){
  if(!file.startsWith('maps/source/')&&!file.startsWith('references/rules/'))fail('source-path-not-allowed');
  if(!/^[a-f0-9]{64}$/.test(sha))fail('invalid-source-hash');
  const data=fs.readFileSync(require('node:path').join(root,file));
  if(crypto.createHash('sha256').update(data).digest('hex')!==sha)fail('source-file-changed:'+file);
 }
 const sourceCities=map.cells.filter(c=>c.city?.name);
 if(sourceCities.length!==ledger.cityCount)fail('map-city-count');
 const idMap=new Map(map.cells.map(c=>[c.id,c]));
 const named=new Map(),ids=new Set();
 for(const entry of ledger.cities){
  if(!entry||typeof entry.name!=='string'||typeof entry.hex!=='string'||
   !['city','major-city'].includes(entry.kind)||named.has(entry.name)||ids.has(entry.hex))fail('duplicate-or-invalid-city');
  const c=idMap.get(entry.hex),mark=c?.tileMarkers?.filter(m=>m.kind==='city'||m.kind==='majorCity')||[];
  if(!c||c.city?.name!==entry.name||mark.length!==1||mark[0].label!==entry.name||
   mark[0].kind!==(entry.kind==='major-city'?'majorCity':'city')||c.terrain==='sea')fail('map-city-disagreement:'+entry.name);
  named.set(entry.name,entry);ids.add(entry.hex);
 }
 if(sourceCities.some(c=>!ids.has(c.id)))fail('unlisted-source-city');
 const expectedNew=['Brăila','Chisinau','Odessa','Nikolaev'];
 if(JSON.stringify(ledger.addedCityNames)!==JSON.stringify(expectedNew)||
  ledger.cities.filter(c=>expectedNew.includes(c.name)).length!==4||
  ledger.cities.find(c=>c.name==='Brăila')?.hex!=='1016'||
  JSON.stringify(ledger.initialAxisCities)!==JSON.stringify(['Lublin','Iasi','Brăila'])||
  JSON.stringify(ledger.ports)!==JSON.stringify(['Odessa','Nikolaev'])||
  ledger.victoryRule?.turns!==7||ledger.victoryRule?.axisAllCities!==20||
  ledger.victoryRule?.axis19Isolated!==true||ledger.victoryRule?.sovietAtMost!==17||
  ledger.victoryRule?.soviet18BothCommunicated!==true||
  ledger.victoryRule?.draw19NotIsolated!==true||ledger.victoryRule?.draw18EitherIsolated!==true)
  fail('published-rule-conditions-disagree');
 const axisCities=new Set(ledger.initialAxisCities);
 const initialControl=Object.fromEntries(ledger.cities.map(e=>[e.name,axisCities.has(e.name)?'german':'soviet']));
 const output=Object.freeze({status:'diagnostic-not-gameplay-authorized',cityCount:20,
  axisInitiallyControlled:3, ports:clone(ledger.ports),majorCities:['Kiev','Odessa'],
  initialControl:Object.freeze(initialControl),cities:Object.freeze(clone(ledger.cities))});
 // Isolation flags must come from a separately certified land/ZOC/communication
 // calculation. Missing flags NEVER default to isolated or connected.
 function evaluate(control,{isolationByCity=null}={}){
  if(!obj(control)||Object.keys(control).length!==named.size||
   [...named.keys()].some(n=>!['german','soviet'].includes(control[n])))fail('malformed-control-map');
  const remaining=[...named.keys()].filter(n=>control[n]==='soviet');
  const german=20-remaining.length;
  let outcome,reason;
  if(german===20){outcome='german-victory';reason='all-20-cities';}
  else if(german<=17){outcome='soviet-victory';reason='at-most-17-axis-cities';}
  else{
   if(!obj(isolationByCity)||Object.keys(isolationByCity).length!==remaining.length||
     remaining.some(n=>typeof isolationByCity[n]!=='boolean')){
    return Object.freeze({outcome:'undetermined',reason:'certified-eastern-edge-isolation-required',germanCities:german,remainingSovietCities:remaining});
   }
   const isolated=remaining.filter(n=>isolationByCity[n]);
   if(german===19){outcome=isolated.length===1?'german-victory':'draw'; reason=isolated.length===1?'last-soviet-city-isolated':'last-soviet-city-connected';}
   else {outcome=isolated.length===0?'soviet-victory':'draw';reason=isolated.length===0?'two-soviet-cities-connected':'at-least-one-soviet-city-isolated';}
  }
  return Object.freeze({outcome,reason,germanCities:german,remainingSovietCities:remaining});
 }
 return Object.freeze({metadata:output,evaluate});
}
module.exports=Object.freeze({build});
