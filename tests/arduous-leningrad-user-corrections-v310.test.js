const fs=require('fs');const assert=require('node:assert/strict');const T=require('../core/terrain_tiles');
const b=JSON.parse(fs.readFileSync('maps/arduous.json','utf8'));
const l=JSON.parse(fs.readFileSync('maps/leningrad.json','utf8'));
const links=new Set(b.hexCenterRailConnections.map(x=>[x.from,x.to].sort().join(':')));
for(const pair of [['1804','1805'],['1807','1808'],['1801','1802']])assert(!links.has(pair.sort().join(':')),'removed railway still present');
for(const [id,dir] of [['1805','NE'],['1807','SE'],['0405','N']]){
 assert(b.railwayBoundaryExits.some(x=>x.from===id&&x.dir===dir),'missing requested railway exit '+id+'/'+dir);
 const cell=b.cells.find(c=>c.id===id);
 assert(!b.cells.some(x=>x.id===T.neighbor(cell,dir,b.geometry)),'exit does not lead off map');
}
for(const id of ['0907','1510']){
 const symbols=b.cells.find(c=>c.id===id).tileMarkers;
 assert(symbols.some(m=>m.kind==='fixedInfantry'&&m.faction==='soviet'));
 assert(symbols.some(m=>m.kind==='fixedMechanized'&&m.faction==='german'));
}
assert.equal(l.sourceCoastRenderingMode,'exact-source-paths');
const ardu=fs.readFileSync('exports-v310/arduous.svg','utf8');
assert(ardu.includes('data-faction="german"'));
for(const [id,dir] of [['1805','NE'],['1807','SE'],['0405','N']])assert(ardu.includes(`data-rail-from="${id}" data-rail-exit-dir="${dir}"`));
const len=fs.readFileSync('exports-v310/leningrad.svg','utf8');assert(len.includes('data-layer="water-bodies"'));
console.log('PASS v310 user-corrected rails/deployments and exact-source Leningrad Coast');
