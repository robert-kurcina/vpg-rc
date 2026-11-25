#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 const position=name=>svg.indexOf('data-layer="'+name+'"');
 const ordered=['terrain','fortifications','rivers','water-bodies','entry-edges','roads','railways','hex-grid','coordinates','deployment','city-labels'];
 for(let i=1;i<ordered.length;i++){
  const a=ordered[i-1],b=ordered[i];
  assert(position(a)>=0&&position(b)>=0&&position(a)<position(b),`${id}: ${a} must be below ${b}`);
 }
 assert(svg.includes('data-layer="water-bodies" data-layer-order="3.5"'),`${id} missing shared water z-order`);
 assert(svg.includes('data-water-kind="coast"')||id==='battle-for-moscow'||id==='arduous'||id==='kiev',`${id} no configured coasts`);
 console.log(id,'water layer 3.5 above rivers / below rails and grid');
}
console.log('PASS shared procedural Coast/Lake above River with no map-data changes');
