'use strict';
// All five boards use the same universal bottom-center deployment placement.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const registry=require('../maps/registry.json');
const composer=require('../maps/composer');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const boards={};
for(const item of registry.maps){if(item.file)boards[item.id]=require(path.join(root,'maps',item.file));}
for(const item of registry.maps){if(item.compose)boards[item.id]=composer.compose(boards[item.compose.base],require(path.join(root,'maps',item.compose.extension)));}
let count=0;
for(const item of registry.maps){
 const b=boards[item.id];
 const svg=T.svgMap(b,P.options(item.id,{showWaterBodies:false}));
 const ms=[...svg.matchAll(/<g data-deployment-hex="([0-9]{4})" data-deployment-kind="([^"]+)" data-placement="([^"]+)"[^>]*transform="translate\(([-.0-9]+) ([-.0-9]+)\) scale\(([-.0-9]+)\)"/g)];
 assert(ms.length>0,`${item.id} needs deployment markers for policy check`);
 for(const m of ms){
  const cell=b.cells.find(c=>c.id===m[1]); assert(cell,`${item.id} missing hex ${m[1]}`);
  const expected='bottom-center';
  assert.equal(m[3],expected,`${item.id} ${m[1]} placement mode`);
  if(cell.pixelCenter){
   assert(+m[5]>cell.pixelCenter[1],`${item.id} ${m[1]} must be below center`);
  }
  count++;
 }
}
console.log(`PASS v329: five-game universal bottom-center deployment renderer for ${count} icons`);
