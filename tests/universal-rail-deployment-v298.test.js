const fs=require('fs'),assert=require('assert'),T=require('../core/terrain_tiles'),P=require('../core/presentation');
const read=name=>JSON.parse(fs.readFileSync('maps/'+name+'.json','utf8'));
let total=0;
for(const name of ['arduous','leningrad']){
 const b=read(name),before=JSON.stringify(b.sourceRailRoutes);
 assert(b.railwayPresentation.explicitSourceAnchorSnap,name+' must use explicit author-anchored rails');
 const routes=T.registeredSourceRailRoutes(b);
 assert.equal(routes.length,name==='arduous'?34:26);
 for(let i=0;i<routes.length;i++){
  const original=b.sourceRailRoutes[i],route=routes[i];
  assert.equal(route.points.length,original.points.length,name+' path vertex count changed');
  for(const a of original.anchors){
   const c=b.cells.find(c=>c.id===a.hex);assert(c,name+' missing anchor hex '+a.hex);
   const center=T.coord(c,b.geometry),rendered=route.points[a.index];
   assert(Math.hypot(rendered[0]-center[0],rendered[1]-center[1])<1e-8,`${name}/${original.sourceSvgId}/${a.hex} rail anchor is not centered`);
   total++;
  }
 }
 assert.equal(JSON.stringify(b.sourceRailRoutes),before,name+' source geometry mutated');
 const svg=fs.readFileSync(`exports-v298/${name}.svg`,'utf8');
 assert(svg.includes('data-rail-geometry="source-svg"'),name+' missing existing source-style rail renderer');
 assert(svg.includes('data-layer="city-hex-highlights"'),name+' city emphasis missing');
 assert(svg.includes('class="city-hex-highlight-layer" data-layer="city-hex-highlights" data-layer-order="2.5" clip-path='),name+' city border not clipped to footprint');
 const iconCount=b.cells.reduce((s,c)=>s+(c.tileMarkers||[]).filter(m=>['cross','star','fixedInfantry','fixedMechanized','fixedCavalry'].includes(m.kind)).length,0);
 assert.equal((svg.match(/data-standard="universal-deployment-v1"/g)||[]).length,iconCount,name+' deployment count changed');
 assert(svg.includes('class="german-deployment-backplate"'),name+' does not use standard German cross backing');
 assert(svg.includes('class="deployment-halo"'),name+' does not use standard Soviet star artwork');
 assert(!svg.includes('class="hex-center-rail-network" data-rail-link-count='),name+' still drawing legacy standalone rail network');
}
for(const name of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const opts=P.options(name);
 for(const k of ['forestLayering','majorCityGrayHex','cityBorderOutsideGrid'])assert.equal(opts[k],true,`${name} not using universal style: ${k}`);
 assert.equal(Object.hasOwn(opts,'forestShadow'),false,`${name}: obsolete forest shadow toggle`);
}
console.log('PASS v298: '+total+' exact railway anchors; source geometry preserved; city clipping, universal deployment and styling across five maps');
