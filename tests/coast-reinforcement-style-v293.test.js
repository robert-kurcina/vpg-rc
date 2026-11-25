'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const T=require('../core/terrain_tiles'),P=require('../core/presentation'),F=require('../core/factions');
const C=require('../maps/composer'),base=require('../maps/kiev.json'),ext=require('../maps/odessa-extension.json');
const b=C.compose(base,ext);
const svg=fs.readFileSync('exports-v298/kiev-odessa.svg','utf8');
assert.equal(b.cells.length,261);
assert.equal(b.cells.filter(c=>c.terrain==='sea').length,31);
assert.equal(F.reinforcements.german.width,F.reinforcements.soviet.width);
assert.equal(F.reinforcements.german.width,20);
assert(svg.indexOf('data-layer="entry-edges"')<svg.indexOf('data-layer="terrain"'),'reinforcements must be below terrain tiles');
assert(svg.includes('data-layer-order="0"'));
assert.equal(P.options('kiev-odessa').entryBorderExteriorOffsetFraction,.14);
assert(P.options('kiev-odessa').openTerrainLighten>.1);
assert(P.options('kiev').openTerrainLighten>.1,'v297 universal Open texture lightening');
assert(svg.includes('class="open-terrain-lightening"'));
assert(svg.includes('class="german-deployment-backplate"'));
assert(svg.includes('fill="#08004c" fill-opacity=".68"'));
// SVG shore bands have distinct metadata; sea-adjacent coast sides cannot get the
// dark decorative shoreline, even though the filled wavelet band is retained.
const shorePaths=[...svg.matchAll(/<path class="water-shoreline registered-shoreline"[^>]*>/g)].map(m=>m[0]);
const byId=new Map(b.cells.map(c=>[c.id,c]));
for(const p of shorePaths){
 const id=p.match(/data-shore-cell="([^"]+)"/)?.[1],dir=p.match(/data-shore-dir="([^"]+)"/)?.[1];
 if(!id||!dir||p.includes('data-water-kind="lake"'))continue;
 const seaId=T.neighbor(byId.get(id),dir,b.geometry);
 assert.notEqual(byId.get(seaId)?.terrain,'sea',`sea coast halo present on ${id}:${dir}`);
}
assert.equal((svg.match(/class="authored-center-rail"/g)||[]).length,24);
assert.equal((svg.match(/data-deployment-hex=/g)||[]).length,36);
assert.equal(T.validate(b,{requireReciprocal:false}).errors.length,0);
console.log('PASS v293: coast sea halo removed; reinforcement layer 0 and identical faction geometry; light Open and cross; source geometry preserved');
