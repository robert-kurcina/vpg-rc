#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T=require('../core/terrain_tiles'), P=require('../core/presentation'), F=require('../core/factions'), C=require('../maps/composer');
const root=path.join(__dirname,'..'), read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const reg=read('maps/registry.json'), entries=new Map(reg.maps.map(e=>[e.id,e]));
assert.deepEqual([...entries.keys()],['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']);
assert.equal(entries.get('kiev-odessa').standalone,false);
assert.equal(F.reinforcements.german.color,'#08004cff');
assert.equal(F.reinforcements.german.width,20);
assert.equal(F.reinforcements.soviet.width,20);
const boards=Object.fromEntries(reg.maps.filter(m=>m.file).map(m=>[m.id,read('maps/'+m.file)]));
const baseSnapshot=JSON.stringify(boards.kiev), ext=read('maps/odessa-extension.json');
boards['kiev-odessa']=C.compose(boards.kiev,ext);
assert.equal(JSON.stringify(boards.kiev),baseSnapshot,'Odessa composition must not mutate Kiev');
const expected={"battle-for-moscow":147,arduous:155,leningrad:151,kiev:165,"kiev-odessa":261};
for(const [id,count] of Object.entries(expected)){
 const board=boards[id],item=entries.get(id);
 assert.equal(board.cells.length,count,id+' hex count');
 const check=T.validate(board,{requireReciprocal:false});assert.deepEqual(check.errors,[],id+' invalid topology');
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 assert(svg.startsWith('<svg ')&&svg.endsWith('</svg>'),id+' malformed root');
 assert(svg.includes('data-layer="terrain"')&&svg.includes('data-layer="deployment"'),id+' missing layers');
 const loc=name=>svg.indexOf('data-layer="'+name+'"');
 for(const [a,b] of [['terrain','rivers'],['rivers','water-bodies'],['water-bodies','entry-edges'],['entry-edges','railways'],['railways','hex-grid'],['hex-grid','coordinates'],['coordinates','deployment'],['deployment','city-labels']])assert(loc(a)>=0&&loc(a)<loc(b),id+' z order '+a+'/'+b);
 assert(svg.includes('data-layer-order="3.75"'),id+' entry boundary not above water');
 assert(svg.includes('data-layer="water-bodies" data-layer-order="3.5"'),id+' Coast/Lake should be above rivers on layer 3.5');
 for(const m of svg.matchAll(/<path[^>]*class="entry-boundary [^>]*>/g))assert(m[0].includes('stroke-width="20"'),id+' entry stroke inconsistent');
 assert(!svg.includes('#08004cff"'),id+' SVG contains unsupported CSS4 opaque color');
 assert(!svg.includes('#30b9bfff"'),id+' SVG contains unsupported CSS4 opaque water');
 assert(svg.includes('stroke="#08004c"')||id==='battle-for-moscow',id+' no German border');
 assert(!svg.includes('<pattern id="terrain-sprite-'),id+' deprecated texture pattern');
 assert(svg.includes('<use class="terrain-texture" href="#terrain-sprite-'),id+' no reusable textures');
 assert(svg.includes('data:image/png;base64,'),id+' not self-contained terrain');
 assert(fs.existsSync(path.join(root,'exports',id+'.png')),id+' PNG absent');
 console.log(id, 'OK',count+' hexes', (svg.match(/class="entry-boundary /g)||[]).length+' entry perimeter paths', 'warnings',check.warnings.length);
}
assert.equal(boards['kiev-odessa'].cells.filter(c=>c.visualExtension==='odessa').length,65);
assert.equal(boards['kiev-odessa'].compositeEntryEdges.every(e=>{
 const c=boards['kiev-odessa'].cells.find(c=>c.id===e.cellId);
 return !boards['kiev-odessa'].cells.some(c2=>c2.id===T.neighbor(c,e.dir,boards['kiev-odessa'].geometry));
}),true,'seam must not retain interior entry edges');
assert(boards['kiev-odessa'].cells.some(c=>c.id==='1914'),'1914 printed shore hex is missing');
assert.equal(boards['kiev-odessa'].cells.find(c=>c.id==='1813').terrain,'open');
// Source-authored cities are now rendered at printed host-hex centers.
const composite=fs.readFileSync(path.join(root,'exports/kiev-odessa.svg'),'utf8');
const correctedCities={Braila:'1017',Chisinau:'1212',Odessa:'1513',Nikolaev:'1812'};
for(const [name,cellId] of Object.entries(correctedCities)){
 const city=boards['kiev-odessa'].cells.find(c=>c.id===cellId);
 assert.equal(city?.city?.name,name,'wrong printed-city ownership '+name);
 assert(composite.includes('data-symbol-hex="'+cellId+'" data-city-placement="hex-center"'),name+' city not at canonical hex center');
}
for(const original of ['1118','1313','1413','1514','1711','1913'])assert(!boards['kiev-odessa'].cells.find(c=>c.id===original)?.city,'old, incorrect Odessa city assignment '+original);
for(const [id,board] of Object.entries(boards)){
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 for(const cell of board.cells){
  if(!cell.city)continue;
  const [x,y]=T.coord(cell,board.geometry),fmt=x=>Number(x).toFixed(2);
  const expected='data-symbol-hex="'+cell.id+'" data-city-placement="hex-center" transform="translate('+fmt(x)+' '+fmt(y)+')"';
  assert(svg.includes(expected),id+' city '+cell.city.name+' is not at exact center of '+cell.id);
 }
 const expectedRails=board.hexCenterRailConnections||[];
 const expectedExits=board.railwayBoundaryExits||[];
 if(board.sourceRailRoutes?.length){
  // Source-authored path display must not be silently replaced by the
  // independent hex-center logical network (the v2.67 regression).
  assert.equal((svg.match(/class="authored-center-rail"/g)||[]).length,board.sourceRailRoutes.length-(board.hiddenSourceRailRouteIndices||[]).length,id+' rendered wrong visible source railway path count');
  assert(svg.includes('data-rail-geometry="source-svg"'),id+' reconstruction drawn instead of source curves');
  const cellsById=new Map(board.cells.map(c=>[c.id,c]));
  const adjusted=T.registeredSourceRailRoutes(board);
  for(let routeIndex=0;routeIndex<board.sourceRailRoutes.length;routeIndex++){
   const route=board.sourceRailRoutes[routeIndex],renderRoute=adjusted[routeIndex];
   const visible=!(board.hiddenSourceRailRouteIndices||[]).includes(routeIndex);
   if(visible)assert(svg.includes('data-source-rail-path="'+route.sourceSvgId+'"'),id+' missing visible railway source '+route.sourceSvgId);
   if(visible)assert(svg.includes('d="'+T.sourceRailSplinePath(renderRoute.points)+'"'),id+' source-led junction registered geometry missing '+route.sourceSvgId);
   for(const anchor of route.anchors){
    const p=route.points[anchor.index],center=T.coord(cellsById.get(anchor.hex),board.geometry);
    assert(p&&center&&Math.hypot(p[0]-center[0],p[1]-center[1])<.002,
      id+' SVG railway point not snapped to center '+route.sourceSvgId+'/'+anchor.hex);
   }
  }
 }else assert.equal((svg.match(/class="hex-center-rail"/g)||[]).length,expectedRails.length+expectedExits.length,id+' rail connection render count');
 assert(svg.includes('data-rail-interpolation="clamped-cubic-b-spline"'),id+' railway interpolation not configured');
 const t=T.railSplineNetwork(board,{rx:id==='battle-for-moscow'?57.275:undefined,ry:id==='battle-for-moscow'?101.9/Math.sqrt(3):undefined});
 assert.equal(t.linkCount,expectedRails.length,id+' spline link count mismatch');
 assert.equal(t.exitCount,expectedExits.length,id+' spline exit count mismatch');
 assert.equal((svg.match(/class="svg-authored-rail"/g)||[]).length,0,id+' showing raw source rails in default map');
 const keySet=new Set();
 for(const rail of expectedRails){
  const a=board.cells.find(c=>c.id===rail.from),b=board.cells.find(c=>c.id===rail.to);
  assert(a&&b,id+' missing rail host hex');
  assert(T.DIRS.some(dir=>T.neighbor(a,dir,board.geometry)===b.id),id+' nonadjacent rail '+a.id+':'+b.id);
  const key=[a.id,b.id].sort().join(':');assert(!keySet.has(key),id+' repeated link '+key);keySet.add(key);
  const [ax,ay]=T.coord(a,board.geometry),[bx,by]=T.coord(b,board.geometry);
  const m=(n)=>Number(n).toFixed(2);
  const spline=T.railSplineNetwork(board,{rx:id==='battle-for-moscow'?57.275:undefined,ry:id==='battle-for-moscow'?101.9/Math.sqrt(3):undefined}).segments.find(s=>s.from===rail.from&&s.to===rail.to);
  assert(spline,id+' missing spline '+key);
  const seg=T.railSplinePath(spline);
  assert(seg.startsWith('M'+m(ax)+','+m(ay)+' C'),id+' rail not anchored at source center '+key);
  assert(seg.endsWith(' '+m(bx)+','+m(by)),id+' rail not anchored at destination center '+key);
  if(!board.sourceRailRoutes?.length)assert(svg.includes('d="'+seg+'"'),id+' clamped spline path absent '+key);
  assert.deepEqual(T.railSplineSample(spline,0).p,[ax,ay],id+' spline mathematical source center mismatch '+key);
  assert.deepEqual(T.railSplineSample(spline,1).p,[bx,by],id+' spline mathematical destination center mismatch '+key);
 }
}
assert.equal(boards['battle-for-moscow'].hexCenterRailConnections.length,70,'Moscow reciprocal rail topology changed');
assert.equal(boards['battle-for-moscow'].railwayBoundaryExits.length,10,'Moscow map-edge railroad exits lost');
const expectedRailGraphs={arduous:[88,10],leningrad:[80,5],kiev:[97,9],'kiev-odessa':[126,10]};
for(const [id,[links,exits]] of Object.entries(expectedRailGraphs)){
 assert.equal(boards[id].hexCenterRailConnections.length,links,id+' source-backed rail links');
 assert.equal(boards[id].railwayBoundaryExits.length,exits,id+' sourced off-map rail exits');
}
const arduousExits=boards.arduous.railwayBoundaryExits;
for(const hex of ['0106','0205','0109','0110','1810','1802','0803'])
 assert(arduousExits.some(e=>e.from===hex), 'Arduous missing off-map exit at '+hex);
assert(boards['kiev-odessa'].compositeEntryEdges.some(e=>e.cellId==='1911'&&e.dir==='N'&&e.side==='soviet'),
 'Missing Soviet north reinforcement at 1911');
assert.equal(P.options('leningrad').lakeFringeDepth,12.096,'Leningrad lake depth 30% thinner than v269');
assert.equal(P.options('leningrad').seaFringeDepth,11.52,'Leningrad coast depth double v269');
assert.equal(P.options('kiev-odessa').seaFringeDepth,14.4,'Odessa coast depth double v269');
assert.equal(P.options('leningrad').waterColor,'#30b9bfff','Leningrad water must use shared blue');
assert.equal(P.options('kiev-odessa').waterColor,'#30b9bfff','Odessa water must use shared blue');
assert.equal(P.options('arduous').entryBorderExteriorOffsetFraction,.28,'Arduous outer border seam fix');
// Deployment markers must lie below their hex centers, no matter where city labels were authored.
for(const [id,board] of Object.entries(boards)){
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 assert(svg.includes('data-layer="deployment" data-placement="bottom-center"'),id+' deployment anchor policy');
 const all=Array.from(svg.matchAll(/<g data-deployment-hex="([0-9]{4})"[^>]+data-placement="bottom-center"[^>]+transform="translate\(([-0-9.]+) ([-0-9.]+)\)/g));
 const groups=new Map();
 for(const [,hex,x,y] of all){
  const c=board.cells.find(c=>c.id===hex);assert(c,id+' deployment host missing '+hex);
  const [cx,cy]=T.coord(c,board.geometry);
  assert(+y>cy,id+' deployment not below city/hex center '+hex);
  if(!groups.has(hex))groups.set(hex,[]);groups.get(hex).push([+x,+y,cx,cy]);
 }
 for(const [hex,g] of groups){
  const mid=g.reduce((a,q)=>a+q[0],0)/g.length;
  assert(Math.abs(mid-g[0][2])<.011,id+' deployment symbols not horizontally centered in '+hex);
  if(g.length>1){assert.equal(new Set(g.map(q=>q[0])).size,g.length,id+' deployment overlap in '+hex);
   assert(g.every(q=>q[1]===g[0][1]),id+' deployment row not side-by-side in '+hex);}
 }
}

assert.equal(boards['kiev-odessa'].hexCenterRailConnections.length,
 boards.kiev.hexCenterRailConnections.length+ext.hexCenterRailConnections.length,'Odessa rail composition lost source links');
assert(boards['kiev-odessa'].authoredReinforcementTraces.length>=4,'Missing provenance source reinforcement traces');
const auditSvg=T.svgMap(boards['kiev-odessa'],{...P.options('kiev-odessa',entries.get('kiev-odessa')),
 showOriginalRailTrace:true,showSourceReinforcementAudit:true});
assert(auditSvg.includes('data-layer="source-reinforcement-audit"'),'Original reinforcement paths not inspectable');
assert(auditSvg.includes('class="svg-authored-rail"'),'Original SVG railway paths not inspectable');
const expectedInput={'kiev':'kiev-map-temp(3).svg',arduous:'arduous-map-temp(1).svg',leningrad:'leningrad-map-temp(1).svg','odessa-extension':'odessa-map-temp(1).svg'};
const crypto=require('node:crypto');
for(const [name,filename] of Object.entries(expectedInput)){
 const board= name==='odessa-extension'?ext:boards[name];
 const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'maps/source/user-svg',filename))).digest('hex');
 assert.equal(board.v260SourceRegistration.sha256,sha,name+' is not sourced from the exact supplied SVG');
}
const leningrad=fs.readFileSync(path.join(root,'exports/leningrad.svg'),'utf8');
assert(boards.leningrad.sourceWaterRoutes.length===4,'Leningrad all lakes and coast paths absent');
assert(ext.sourceWaterRoutes.length===5,'Odessa authored 5 coast paths are missing');
for(const [id,board] of [['leningrad',boards.leningrad],['kiev-odessa',boards['kiev-odessa']]]){
 const markup=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 assert(!markup.includes('class="source-purple-water-area"'),id+' source-scan ink must not be the coastline');
 assert(!markup.includes('class="source-water-variable-depth"'),id+' source coastline strokes must not be drawn');
 assert(!markup.includes('class="source-coast-authored-path"'),id+' source coastline should only be an audit option');
 assert(markup.includes('class="water-shoreline registered-shoreline"'),id+' missing procedural coastline');
 assert(markup.includes('data-depth-profile="seeded-variable-depth"'),id+' shoreline depth wavelet absent');
 assert.equal(board.waterRenderingMode,'hexside-wavelets',id+' not configured for universal water routine');
 assert(board.sourceWaterScanContours?.polygons?.length>0,id+' printed source scan areas missing');
 const scan=board.sourceWaterScanContours;
 const diskScan=id==='leningrad'?'leningrad-map-scan-current.jpg':'odessa-map-scan.webp';
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'maps/source',diskScan))).digest('hex'),scan.sha256,id+' source scan changed');
}
const coastSvg=T.svgMap(boards['kiev-odessa'],{...P.options('kiev-odessa'),showSourceCoastAudit:true});
for(const id of ['path57','path58','path59','path60','path61'])
 assert(coastSvg.includes('data-source-water-path="'+id+'"'),id+' lost authored Odessa shoreline path');

// Cross and star presentation is uniform across all campaigns, regardless of
// SVG source position or candidate marker status.
assert.equal(F.deploymentIcons.scale,.86);
assert.equal(F.deploymentIcons.pairSpacing,19);
const kinds=new Set();
for(const [id,board] of Object.entries(boards)){
 const svg=fs.readFileSync(path.join(root,'exports',id+'.svg'),'utf8');
 const tags=[...svg.matchAll(/<g data-deployment-hex="([0-9]{4})" data-deployment-kind="(star|cross)"[^>]*>/g)];
 for(const [tag,hex,kind] of tags){
  kinds.add(kind);
  assert(tag.includes('data-standard="universal-deployment-v1"'),id+' noncanonical deployment '+hex);
  assert(tag.includes(' opacity="1"'),id+' variable star/cross opacity '+hex);
  assert(tag.includes('scale(0.86)'),id+' variable star/cross size '+hex);
 }
}
assert.deepEqual([...kinds].sort(),['cross','star']);
console.log('Composition, rail anchors, procedural coast/lake wavelets and standardized deployment glyphs pass.');
