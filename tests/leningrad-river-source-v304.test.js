const assert=require('node:assert/strict');
const fs=require('node:fs');
const b=JSON.parse(fs.readFileSync('maps/leningrad.json','utf8'));
const routes=b.sourceWaterRoutes.filter(r=>r.kind==='river'||r.kind==='majorRiver');
const vectors=b.authoredSourceVectors;
assert.equal(routes.length,10);
assert.equal(routes.filter(r=>r.kind==='majorRiver').length,0,'Source has no major river features');
assert.equal(vectors.rivers.length,10);
assert.deepEqual(vectors.registration,{scaleX:1,scaleY:1,translateX:0,translateY:0});
for(const route of routes){
 const path=vectors.rivers.find(r=>r.id===route.sourceSvgId);
 assert(path,`Missing authored river ${route.sourceSvgId}`);
 assert.equal(path.kind,route.kind);
 const expected='M'+route.points.map(p=>p.map(x=>Number(x).toFixed(6)).join(',')).join(' L');
 assert.equal(path.d,expected,`River ${route.sourceSvgId} vertices differ from source`);
}
const out=fs.readFileSync('exports-v304/leningrad.svg','utf8');
assert.equal((out.match(/class="svg-authored-river-ribbon feature-water"/g)||[]).length,10);
assert.equal((out.match(/class="source-river-contour"/g)||[]).length,0);
assert.equal((out.match(/class="svg-authored-river-ribbon feature-water"/g)||[]).length,10);
for(const route of routes) assert(out.includes(`data-authored-path="${route.sourceSvgId}"`));
assert(!b.cells.some(c=>c.id==='1801'||c.id==='2001'));
for(const c of b.cells.filter(c=>c.terrain==='sea'))assert(!out.includes(`class="hex-number" data-number-hex="${c.id}"`));
console.log('PASS v304: source-authored Leningrad rivers, no inferred visual edges or fabricated major rivers');
