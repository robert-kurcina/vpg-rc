'use strict';
// Checkpoint 122: every map uses a single SVG renderer with external profiles.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const reg=require('../maps/registry.json').maps;
assert.equal(reg.length,5);
assert.equal(new Set(reg.map(m=>m.id)).size,5);
for(const file of ['core/terrain_tiles.js','core/presentation.js','scripts/export-campaign-maps.js','maps/index.html']){
 const body=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 assert.doesNotMatch(body,/\b(?:id|board\.id|item\.id)\s*===?\s*['"](?:leningrad|arduous|battle-for-moscow|kiev|kiev-odessa)['"]/,file+' has a scenario-specific display branch');
 assert.doesNotMatch(body,/\b(?:id|board\.id|item\.id)\s*!==?\s*['"](?:leningrad|arduous|battle-for-moscow|kiev|kiev-odessa)['"]/,file+' has a scenario-specific display branch');
}
assert.match(fs.readFileSync(path.join(__dirname,'..','maps/index.html'),'utf8'),/P\.configureProfiles\(maps\)/);
assert.match(fs.readFileSync(path.join(__dirname,'..','maps/index.html'),'utf8'),/HexTerrainTiles\.svgMap\(board,opts\)/);
assert.match(fs.readFileSync(path.join(__dirname,'..','scripts/export-campaign-maps.js'),'utf8'),/T\.svgMap\(board,opts\)/);
for(const item of reg){
 const opts=P.options(item.id);
 for(const key of ['width','height','padding','majorCityLabels'])assert.deepEqual(opts[key],item[key],item.id+': '+key);
 for(const [key,val] of Object.entries(item.renderOptions))assert.deepEqual(opts[key],val,item.id+': '+key);
 assert.equal(Object.hasOwn(opts,'forestShadow'),false);
 assert.equal(opts.cityBorderWidth,11.6);
}
// ID independence: giving an unrelated ID the same registry profile must not
// alter the SVG output; no name-based presentation behavior is permitted.
const real=JSON.parse(fs.readFileSync(path.join(__dirname,'../maps/leningrad.json')));
const copy={...reg.find(x=>x.id==='leningrad'),id:'synthetic-registered-map'};
P.configureProfiles([copy]);
const one=T.svgMap(real,P.options('leningrad',{id:'unchanged-render',showNumbers:false}));
const two=T.svgMap(real,P.options(copy.id,{id:'unchanged-render',showNumbers:false}));
assert.equal(one,two,'a profile-only ID change must not affect rendered artwork');
assert.equal(P.options(copy.id).lakeFringeDepth,12.096);
const shifted={...copy,id:'only-profile-updated',renderOptions:{...copy.renderOptions,palette:{...copy.renderOptions.palette,open:'#000000'}}};
P.configureProfiles([shifted]);
const altered=T.svgMap(real,P.options(shifted.id,{id:'unchanged-render',showNumbers:false}));
assert.notEqual(altered,one,'changing only configuration must change output when an active palette field changes');
assert.throws(()=>P.configureProfiles([{}]),/Invalid map render profile/);
assert.throws(()=>P.configureProfiles({}),/Map profiles must be an array/);
console.log('PASS v356: 5 registry profiles, same SVG engine, no per-game branches in rendering consumers, ID-independent output');
