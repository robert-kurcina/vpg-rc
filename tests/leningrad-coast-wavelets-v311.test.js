const fs=require('fs');
const assert=require('assert');
const T=require('../core/terrain_tiles');
const board=JSON.parse(fs.readFileSync('maps/leningrad.json','utf8'));
const svg=fs.readFileSync('exports-v311/leningrad.svg','utf8');
const count=(re)=>(svg.match(re)||[]).length;
assert.strictEqual(board.waterRenderingMode,'hexside-wavelets');
assert.strictEqual(board.sourceCoastRenderingMode,'registered-hexside-wavelets');
assert.strictEqual(board.sourceLakeRenderingMode,'exact-source-paths');
assert.equal(board.authoredShoreHexsides.filter(x=>x.kind==='coast').length,47);
assert.equal(count(/class="water-shore-fringe registered-shore-fringe"[^>]*data-water-kind="coast"/g),47);
assert.equal(count(/class="source-authored-lake"/g),4);
assert.equal(count(/class="source-authored-coast"/g),0);
for(const dir of ['N','SW','NW'])assert(svg.includes(`data-shore-cell="0208" data-shore-dir="${dir}" data-water-kind="coast"`));
assert(svg.includes('data-number-cell="0208" data-display-number="0107"'));
assert(svg.includes('data-number-cell="0901" data-display-number="0801"'));
assert(!board.cells.some(c=>c.id==='2001'||c.id==='1801'));
assert.equal(board.sourceWaterRoutes.filter(x=>x.kind==='lake').length,4);
assert.equal(board.sourceWaterRoutes.filter(x=>x.kind==='river').length,10);
assert.equal(T.validate(board,{requireReciprocal:false}).errors.length,0);
for(const e of board.authoredShoreHexsides.filter(x=>x.kind==='coast')){
 assert(svg.includes(`data-shore-cell="${e.cellId}" data-shore-dir="${e.dir}" data-water-kind="coast"`), 'missing wavelet '+e.cellId+':'+e.dir);
}
console.log('PASS v311: coast 47 wavelets; Liepaja N/SW/NW; four exact lake paths; labels and geometry retained');
