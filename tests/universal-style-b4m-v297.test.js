const fs=require('fs'), assert=require('assert');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const board=JSON.parse(fs.readFileSync('maps/battle-for-moscow.json','utf8'));
assert(Array.isArray(board.sourceRailRoutes) && board.sourceRailRoutes.length>0,'Battle for Moscow lacks derived source rail routes');
assert(board.authoritativeRailPolylineGeometry===true,'Battle for Moscow not set to exact polyline rail rendering');
assert(board.railwayBoundaryExits.every(x=>x.renderConnector===true),'Battle for Moscow exits must render explicit connectors');
const moscow=board.cells.find(c=>c.id==='1103');
assert(moscow,'Moscow hex missing');
assert((moscow.tileMarkers||[]).some(m=>m.kind==='majorCity'),'Moscow is not marked majorCity');
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
  const opts=P.options(id,{});
  assert.equal(opts.forestLayering,true,id+' not using shared forest layering');
  assert.equal(Object.hasOwn(opts,'forestShadow'),false,id+' still exposes removed forest shadow');
  assert.equal(opts.majorCityGrayHex,true,id+' not using shared majorCity gray hex styling');
  assert.equal(opts.cityBorderWidth,11.6,id+' city border width not universalized');
}
const svg=fs.readFileSync('exports-v298/battle-for-moscow.svg','utf8');
assert(svg.includes('data-rail-geometry="source-svg"'),'Battle for Moscow did not use source-style railway layer');
assert(svg.includes('Moscow'),'Moscow label missing in exported SVG');
console.log('PASS v297 universal style + Battle for Moscow source-style railways');
