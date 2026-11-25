'use strict';
const assert=require('node:assert/strict');
const map=require('../maps/leningrad.json');
const T=require('../core/terrain_tiles');
assert.equal(map.geometry.hexNumbers.printedColumnOffset,-1);
assert.deepEqual(map.geometry.hexNumbers.printedRowOffsetsByColumn,{'2':-1});
for(const id of ['0110','0210','0211','0310','0411','0510']){
 const c=map.cells.find(c=>c.id===id);
 assert.match(T.formatHexNumber(c,T.numberStyle(map,{})),/^\d{4}$/);
}
const get=id=>map.cells.find(c=>c.id===id);
const crosses=map.cells.flatMap(c=>(c.tileMarkers||[]).filter(m=>m.kind==='cross').map(()=>c.id)).sort();
assert.deepEqual(crosses,['0210','0310','0311','0411','0511']);
assert.deepEqual(map.cells.filter(c=>c.city?.name==='Insterburg').map(c=>c.id),['0311']);
assert.deepEqual(map.cells.filter(c=>(c.tileMarkers||[]).some(m=>m.kind==='city'&&m.label==='Insterburg')).map(c=>c.id),['0311']);
assert(get('0510').tileMarkers.some(m=>m.kind==='star'&&m.faction==='soviet'));
assert((get('0511').tileMarkers||[]).some(m=>m.kind==='cross'));  // user-approved left v343
assert((get('0311').tileMarkers||[]).some(m=>m.kind==='cross'));  // user-approved left v343
assert(get('0311').tileMarkers.some(m=>m.kind==='city'&&m.sourceSvgId==='use434'));
const snap=map.v327DeploymentRegistrationCorrection.originalMarkerSnapshots;
assert(snap['0311'].some(m=>m.kind==='city'));
assert(snap['0511'].some(m=>m.kind==='cross'));
const temporary=map.authoredSvgImportAudit.details.deployment.filter(x=>x.kind==='cross').map(x=>x.cellId).sort();
assert.deepEqual(temporary,['0109','0210','0310','0411']);
assert.equal(map.v327DeploymentRegistrationCorrection.status.includes('still-unauthorized'),true);
assert.deepEqual(T.validate(map,{requireReciprocal:true}).errors,[]);
console.log('PASS v344: original v327 audit preserved; active markers follow user authority');
