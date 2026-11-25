'use strict';
// v331 temporary row shift must remain auditable, but must never be active.
const assert=require('node:assert/strict');const T=require('../core/terrain_tiles');const P=require('../core/presentation');
const b=require('../maps/leningrad.json');
assert.equal(b.v333SourceRegistrationRepair.priorPresentationRowShift,1);
assert.equal(b.geometry.hexNumbers.rowShift,undefined);
const svg=T.svgMap(b,P.options('leningrad',{showWaterBodies:false}));
assert(svg.includes('data-number-cell="0211"'));
assert.equal(T.numberStyle(require('../maps/kiev.json'),{}).rowShift,0);
console.log('PASS v331 shift preserved as historical finding but removed from active rendering');
