const assert=require('node:assert/strict');
const fs=require('node:fs');
const board=JSON.parse(fs.readFileSync('maps/leningrad.json','utf8'));
const svg=fs.readFileSync('exports-v306/leningrad.svg','utf8');
const lakes=board.sourceWaterRoutes.filter(x=>x.kind==='lake');
assert.equal(lakes.length,4,'source SVG should contain four authored lake paths');
assert.equal(board.sourceLakeRenderingMode,'exact-source-paths');
assert(svg.includes('data-lake-mode="exact-source-polyline"'));
const sourceRendered=[...svg.matchAll(/class="source-authored-lake" data-source-water-path="([^"]+)"/g)].map(x=>x[1]);
assert.deepEqual(sourceRendered.sort(),lakes.map(x=>x.sourceSvgId).sort());
for(const lake of lakes){
 const start=`M${lake.points[0][0].toFixed(2)},${lake.points[0][1].toFixed(2)}`;
 const end=lake.points.at(-1).map(x=>x.toFixed(2)).join(',');
 assert(svg.includes(start),`missing exact lake start ${lake.sourceSvgId}`);
 assert(svg.includes(end),`missing lake end ${lake.sourceSvgId}`);
}
assert.equal((svg.match(/data-shore-cell="[^"]+"[^>]*data-water-kind="lake"/g)||[]).length,0,'obsolete lake hexside wavelets still rendered');
assert(!board.cells.some(x=>x.id==='1801'||x.id==='2001'));
console.log('PASS v306: four exact-source Leningrad lake paths; no superseded wavelets; no unsupported terrain');
