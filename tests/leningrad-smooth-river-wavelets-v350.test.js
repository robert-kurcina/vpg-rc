'use strict';
// Regression: Leningrad must actually render the universal wavelet ribbon paths.
// A former scenario override silently kept all authored rivers in flat stroke mode.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const board=require('../maps/leningrad.json');
const opts=P.options('leningrad',{});
assert.equal(opts.authoredRiverMode,'procedural-ribbon');
assert(opts.riverWaveAmplitude>0);
const svg=T.svgMap(board,opts);
const authored=board.authoredSourceVectors.rivers;
assert.equal(authored.length,10);
assert.equal((svg.match(/class="svg-authored-river-ribbon feature-water"/g)||[]).length,10);
assert.equal((svg.match(/data-river-smoothing="cubic"/g)||[]).length,10);
assert.equal((svg.match(/data-river-render-mode="source-exact-stroke"/g)||[]).length,0);
for(const item of authored){
 const escaped=item.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 assert(new RegExp(`data-authored-path="${escaped}"`).test(svg),`missing source route ${item.id}`);
}
assert.equal((svg.match(/data-deployment-hex="[0-9]{4}" data-deployment-kind="(?:cross|star)"/g)||[]).length,10);
// Keep all river kinds under a single shared color palette, without erasing feature semantics.
assert(svg.includes('fill="#20719f" stroke="#165b80"'));
console.log('PASS v350: all ten Leningrad rivers use shared smooth wavelets; deployment preserved');
