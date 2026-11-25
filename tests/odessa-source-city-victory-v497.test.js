'use strict';
/* Printed Objective: Odessa city identities, opening ownership and the exact
 * §5 result partition. Conditional isolation remains externally unverified. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../maps/composer'),G=require('../core/map_movement_graph');
const Candidate=require('../core/composite_city_victory_candidate');
const base=require('../maps/kiev.json'),extension=require('../maps/odessa-extension.json');
const source=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const map=C.compose(base,extension),clone=v=>JSON.parse(JSON.stringify(v));
let checks=0;const eq=(a,b,s)=>{assert.deepEqual(a,b,s);checks++};
const ok=(a,s)=>{assert.ok(a,s);checks++};const rejects=(f,p,s)=>{assert.throws(f,p,s);checks++};
const candidate=Candidate.build(map,source),m=candidate.metadata;
eq(m.status,'diagnostic-not-gameplay-authorized','not authorized');
eq(m.cityCount,20,'printed expansion total');
eq(m.cities.length,20,'20 named cities');
eq(new Set(m.cities.map(x=>x.name)).size,20,'unique printed names');
eq(m.axisInitiallyControlled,3,'three Axis opening cities');
eq(m.ports,['Odessa','Nikolaev'],'source §15.1 ports');
eq(m.majorCities,['Kiev','Odessa'],'major cities');
eq(Object.keys(m.initialControl).length,20,'complete initial control');
for(const city of m.cities){
 const cell=map.cells.find(c=>c.id===city.hex),marks=(cell.tileMarkers||[]).filter(x=>['city','majorCity'].includes(x.kind));
 eq(cell.city.name,city.name,'matched printed city name '+city.name);
 eq(marks.length,1,'one City symbol '+city.hex);
 eq(marks[0].label,city.name,'source marker label matches city '+city.name);
 eq(city.kind,marks[0].kind==='majorCity'?'major-city':'city','City type '+city.name);
 eq(m.initialControl[city.name],['Lublin','Iasi','Brăila'].includes(city.name)?'german':'soviet','initial control '+city.name);
}
eq(map.cells.find(x=>x.id==='1016').city.name,'Brăila','printed map name corrected at 1016');
ok(!base.cells.some(x=>x.city?.name==='Brăila'),'Kiev-alone remains unchanged');
eq(extension.v497PrintedCityNameCorrection.correctLabel,'Brăila','current source adjudication recorded');
eq(extension.v290GeometryAudit.restoredCityNames['1016'],'Balti','legacy review history preserved');
ok(!map.cells.some(c=>c.city?.name==='Balti'),'erroneous city name absent');
const makeAxisCount=n=>Object.fromEntries(m.cities.map((city,i)=>[city.name,i<n?'german':'soviet']));
function result(control,conditions){return candidate.evaluate(control,conditions?{isolationByCity:conditions}:{})}
const c20=makeAxisCount(20),c17=makeAxisCount(17),c18=makeAxisCount(18),c19=makeAxisCount(19);
eq(result(c20).outcome,'german-victory','20 cities German win');
eq(result(c17).outcome,'soviet-victory','17 cities Soviet win');
eq(result(m.initialControl).outcome,'soviet-victory','opening counts in Soviet threshold, if hypothetically terminal');
eq(result(c18).outcome,'undetermined','18 requires connectivity proof');
eq(result(c19).outcome,'undetermined','19 requires connectivity proof');
const last2=m.cities.slice(18).map(x=>x.name),last=m.cities[19].name;
eq(result(c18,Object.fromEntries(last2.map(x=>[x,false]))).outcome,'soviet-victory','18 and both connected Soviet victory');
eq(result(c18,{[last2[0]]:false,[last2[1]]:true}).outcome,'draw','18 and one isolated draw');
eq(result(c18,Object.fromEntries(last2.map(x=>[x,true]))).outcome,'draw','18 and both isolated draw');
eq(result(c19,{[last]:true}).outcome,'german-victory','19 last isolated German victory');
eq(result(c19,{[last]:false}).outcome,'draw','19 last connected draw');
eq(result(c19,{wrong:true}).outcome,'undetermined','unrecognized proof does not certify outcome');
eq(result(c18,{[last2[0]]:false}).outcome,'undetermined','incomplete proof does not certify outcome');
const bad=clone(m.initialControl);delete bad['Brăila'];rejects(()=>result(bad),/malformed-control-map/,'missing city control rejected');
const bad2=clone(m.initialControl);bad2['Brăila']='none';rejects(()=>result(bad2),/malformed-control-map/,'unrecognized owner rejected');
{const altered=clone(map);altered.cells.find(c=>c.id==='1016').city.name='Balti';rejects(()=>Candidate.build(altered,source),/map-city-disagreement/,'old name rejected');}
{const altered=clone(map);altered.cells.find(c=>c.id==='1016').tileMarkers.find(x=>x.kind==='city').label='Balti';rejects(()=>Candidate.build(altered,source),/map-city-disagreement/,'wrong symbol name rejected');}
{const altered=clone(map);altered.cells.find(c=>c.id==='1513').city=null;rejects(()=>Candidate.build(altered,source),/map-city-count/,'missing Odessa rejected');}
{const altered=clone(source);altered.cities.find(x=>x.name==='Brăila').hex='1017';rejects(()=>Candidate.build(map,altered),/map-city-disagreement/,'wrong printed hex rejected');}
{const altered=clone(source);altered.victoryRule.axisAllCities=19;rejects(()=>Candidate.build(map,altered),/published-rule-conditions-disagree/,'invented victory condition rejected');}
{const altered=clone(source);altered.initialAxisCities=['Lublin','Iasi'];rejects(()=>Candidate.build(map,altered),/published-rule-conditions-disagree/,'missing initial Axis city rejected');}
{const altered=clone(source);altered.sourceSHA256['references/rules/odessa-rules.pdf']='0'.repeat(64);rejects(()=>Candidate.build(map,altered),/source-file-changed/,'tampered rule source rejected');}
rejects(()=>G.build(map),/source-geometry-not-gameplay-certified/,'production authorization remains denied');
const report={checkpoint:263,version:'v497',status:'diagnostic-not-gameplay-authorized',correctedCity:{hex:'1016',name:'Brăila',oldName:'Balti'},cityCount:20,initialAxisCities:['Lublin','Iasi','Brăila'],additionalCities:source.addedCityNames,ports:source.ports,majorCities:['Kiev','Odessa'],victoryConditionCases:{axis20:'german-victory',axis19Isolated:'german-victory',axis19Connected:'draw',axis18BothConnected:'soviet-victory',axis18AnyIsolated:'draw',axis17OrBelow:'soviet-victory',missingIsolation:'undetermined'},checks};
if(process.env.WRITE_AUDIT==='1')fs.writeFileSync('rules/audit/odessa-source-city-victory-v497.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Odessa source City and victory preflight v497',checks,'assertions');
