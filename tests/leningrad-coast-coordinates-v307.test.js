const fs=require('fs'),assert=require('assert');
const T=require('../core/terrain_tiles');
const board=JSON.parse(fs.readFileSync('maps/leningrad.json','utf8'));
const svg=fs.readFileSync('exports-v307/leningrad.svg','utf8');
const path=board.sourceWaterRoutes.find(r=>r.kind==='coast');
assert(path && path.sourceSvgId==='path482' && path.points.length===54,'Authoritative 53-segment coast path missing');
assert.equal(board.sourceCoastRenderingMode,'exact-source-paths');
assert.equal(board.sourceCoastStrokeWidth,20);
assert.equal((svg.match(/class="source-authored-coast"/g)||[]).length,1,'Expected one continuous source coast');
assert(svg.includes('data-source-water-path="path482" data-water-kind="coast"'),'Coast not source authored');
assert(!/class="water-shore-fringe registered-shore-fringe"[^>]*data-water-kind="coast"/.test(svg),'Conflicting Coast wavelets still rendered');
for(const [internal,printed] of [['0208','0108'],['0804','0704'],['0901','0801']]){
 assert(svg.includes(`data-number-cell="${internal}" data-display-number="${printed}"`),`Incorrect printed column at ${internal}`);
}
assert(!board.cells.some(c=>c.id==='2001'||c.id==='1801'));
assert.equal(board.sourceWaterRoutes.filter(r=>r.kind==='lake').length,4);
assert.equal(board.sourceWaterRoutes.filter(r=>r.kind==='river').length,10);
assert.equal(T.validate(board,{requireReciprocal:false}).errors.length,0);
console.log('PASS v307: 53 coast segments; no wavelets; printed coordinates corrected; Lake/River paths retained');
