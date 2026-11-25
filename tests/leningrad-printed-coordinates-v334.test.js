'use strict';
const assert=require('node:assert/strict');
const map=require('../maps/leningrad.json');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const style=T.numberStyle(map,{});
const cell=id=>map.cells.find(c=>c.id===id);
// Source-facing values, not the engine's internal ID. User-confirmed checks.
for(const [internal,printed] of [
 ['1701','1601'], // Leningrad
 ['0511','0411'], // southwestern southern-edge cell
 ['0707','0607'], // Riga
 ['0208','0107'], // Liepaja: second engine column starts one source row above
 ['0609','0509'], // Siauliai
 ['0710','0610']  // Kaunas
]) {
 assert(cell(internal),`missing ${internal}`);
 assert.equal(T.formatHexNumber(cell(internal),style),printed,`${internal} must display ${printed}`);
}
assert.equal(style.rowShift,0,'do not move number text into a different physical cell');
const shown=map.cells.filter(c=>c.terrain!=='sea').map(c=>T.formatHexNumber(c,style));
assert.equal(new Set(shown).size,shown.length,'distinct displayed coordinates');
const svg=T.svgMap(map,P.options('leningrad',{}));
for(const [internal,printed] of [['1701','1601'],['0511','0411'],['0707','0607'],['0208','0107']]) {
 assert(svg.includes(`data-number-cell="${internal}" data-display-number="${printed}"`),`rendered ${internal}->${printed}`);
}
assert(!svg.includes('data-number-cell="1701" data-display-number="1701"'));
assert(!svg.includes('data-number-cell="0511" data-display-number="0511"'));
// Nothing about these printed labels changes movement or placement IDs.
assert.deepEqual(map.cells.filter(c=>c.city?.name==='Leningrad').map(c=>c.id),['1701']);
assert.equal(T.validate(map,{requireReciprocal:true}).errors.length,0);
console.log('PASS v334: printed map coordinate translation is distinct from logical cell geometry');
