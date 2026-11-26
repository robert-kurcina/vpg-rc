/* GENERATED. Do not edit. */
(function(root){"use strict";const r=root.__historicalBundle;if(!r||r.revision!=="30b222356d7174806555f575e1a9cbf6d9aa1159aace23db7fcbcfeaf4f2062e")throw Error("Historical bundle version mismatch");const defs=r.definitions,parts=r.parts;
defs["core/terrain_tiles.js"]=function(module,exports,require,Buffer){
/* Universal tile geometry + SVG presentation. No terrain inference and no rules adjudication.
 * DOM/browser and Node CommonJS. Logical features live separately from bitmap visuals.
 */
(function(root,factory){const factions=(typeof module==='object'&&module.exports)?require('./factions'):root.WargameFactions;if(!factions)throw Error('Load core/factions.js before terrain_tiles.js');const api=factory(factions);if(typeof module==='object'&&module.exports)module.exports=api;root.HexTerrainTiles=api;})(typeof globalThis!=='undefined'?globalThis:this,function(FACTIONS){
'use strict';
// Flat-top hex faces, user-authoritative: 1=N, 2=NE, 3=SE, 4=S, 5=SW, 6=NW.
const DIRS=['N','NE','SE','S','SW','NW'];
const HEX_FACE=Object.freeze({1:'N',2:'NE',3:'SE',4:'S',5:'SW',6:'NW'});
const OPP={N:'S',NE:'SW',SE:'NW',S:'N',SW:'NE',NW:'SE'};
const DELTA={even:{N:[0,-1],NE:[1,0],SE:[1,1],S:[0,1],SW:[-1,1],NW:[-1,0]},odd:{N:[0,-1],NE:[1,-1],SE:[1,0],S:[0,1],SW:[-1,0],NW:[-1,-1]}};
const TERRAIN=['open','forest','woods','swamp','water','lake','sea','mountain','hills','desert','rough','other'];
const EDGES=['river','majorRiver','road','rail','coast','border','impassable'];
const MARKERS=['city','majorCity','fortification','port','depot','bridge','star','cross','fixedInfantry','fixedMechanized','fixedCavalry','airfield','objective'];
const ANG={N:-90,NE:-30,SE:30,S:90,SW:150,NW:210};
// One railway presentation standard for every historical campaign and the
// live Battle for Moscow scenario adapter. Configs store a copy for audits.
const RAILWAY_PRESENTATION=Object.freeze({schemaVersion:1,network:'hex-center-adjacency',anchor:'hex-center',
 interpolation:'clamped-cubic-b-spline',splineTension:.30,tieSpacing:11,junctionSnapRadius:32,junctionRegistration:'source-curve-to-shared-hex-center',
 sourceOfTruth:'hexCenterRailConnections',semantics:'visual-only; does not alter game movement rules'});

// The shared renderer knows one generic fallback palette. Historical game
// palettes are data in maps/registry.json, passed as options.palette.
const PALETTES=Object.freeze({generic:Object.freeze({
 woods:'#74a27c',hills:'#b9ac8e',open:'#dcd4c9ff',forest:'#727f61ff',
 swamp:'#616f6fff',water:'#82afbe',mountain:'#a6a18f',
 desert:'#e5d4a1',rough:'#aeae8b',lake:'#82afbe',sea:'#82afbe'
})});
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Normalize fully opaque CSS4 eight-digit colors for SVG 1.1 renderers.
// The shared faction configuration retains its canonical #RRGGBBAA value.
function svgColor(v){const value=String(v??'');return /^#[a-f0-9]{6}ff$/i.test(value)?value.slice(0,7):value;}
function cellId(col,row){return String(col).padStart(2,'0')+String(row).padStart(2,'0')}
// Maps may stagger opposite column parities downward. The original synthetic
// showcase uses odd-down; the printed Objective: Kiev board uses even-down.
// Preserve odd-down as the old default for existing authored games.
function parityDown(geometry){return geometry?.columnParityDown==='even'?'even':'odd'}
function neighbor(cell,dir,geometry){
 if(!DIRS.includes(dir))throw Error('Unknown direction '+dir);
 // Universal opt-in topology for boards with source-certified canonical IDs.
 // Existing five-game boards continue using their original staggered grids.
 if(geometry?.neighborMode==='explicit'){
  const entry=geometry.explicitNeighbors?.[cell.id];
  if(!entry||!Object.hasOwn(entry,dir))throw Error('Missing explicit neighbor '+cell.id+':'+dir);
  const target=entry[dir];
  if(target!==null&&!(typeof target==='string'&&target.length))throw Error('Invalid explicit neighbor '+cell.id+':'+dir);
  return target;
 }
 const c=Number(cell.column),r=Number(cell.row),down=parityDown(geometry);
 const oldIndex=(c-1)%2===0?'even':'odd';
 const lookup=down==='even'?(oldIndex==='even'?'odd':'even'):oldIndex;
 const [dx,dy]=DELTA[lookup][dir];return cellId(c+dx,r+dy);
}
function hexPoints(rx=37.8,ry=rx){return [0,60,120,180,240,300].map(a=>[rx*Math.cos(a*Math.PI/180),ry*Math.sin(a*Math.PI/180)])}
function sides(rx,ry){const p=hexPoints(rx,ry);return {N:[p[4],p[5]],NE:[p[5],p[0]],SE:[p[0],p[1]],S:[p[1],p[2]],SW:[p[2],p[3]],NW:[p[3],p[4]]}}
function coord(c,geo,{forceCalibration=false,calibration=null}={}){
 if(!forceCalibration&&Array.isArray(c.pixelCenter))return c.pixelCenter;
 const g=calibration||geo.calibration||geo,down=parityDown(geo);
 const shifted=down==='even'?(Number(c.column)%2===0):(Number(c.column)%2===1);
 return [Number(g.originX)+(Number(c.column)-1)*Number(g.pitchX),Number(g.originY)+(Number(c.row)-1)*Number(g.pitchY)+(shifted?Number(g.staggerY):0)];
}
function gridRadii(geometry,rx,ry){
 const cal=geometry?.calibration||{};
 const x=rx!=null?Number(rx):Number.isFinite(+cal.pitchX)&&+cal.pitchX>0?+cal.pitchX*2/3:37.8;
 const y=ry!=null?Number(ry):Number.isFinite(+cal.pitchY)&&+cal.pitchY>0?+cal.pitchY/Math.sqrt(3):x;
 return [x,y];
}
function recalibrate(board,values){
 const required=['originX','originY','pitchX','pitchY','staggerY'];
 for(const k of required)if(!Number.isFinite(+values[k]))throw Error('Non-numeric calibration '+k);
 if(+values.pitchX<=0||+values.pitchY<=0)throw Error('Grid pitch must be positive');
 const cal=Object.fromEntries(required.map(k=>[k,+values[k]]));
 board.geometry.calibration=cal;
 for(const c of board.cells)c.pixelCenter=coord(c,board.geometry,{forceCalibration:true});
 board.geometry.calibrationStatus='editor-adjusted-not-source-certified';
 return board;
}
function normalizeLayer(cell){
 const layers={base:cell.terrain||null, edges:{},markers:[]};
 if(cell.city){layers.markers.push({kind:cell.city.type==='major'?'majorCity':'city',label:cell.city.name||'',status:cell.city.locationStatus||'source-draft'});}
 if(Array.isArray(cell.tileMarkers)){if(cell.tileMarkers.some(m=>m.kind==='city'||m.kind==='majorCity'))layers.markers=layers.markers.filter(m=>m.kind!=='city'&&m.kind!=='majorCity');layers.markers.push(...cell.tileMarkers);}
 for(const d of DIRS)layers.edges[d]=[];
 for(const d of (cell.railEdges||[]))if(DIRS.includes(d))layers.edges[d].push({kind:'rail',status:'legacy'});
 if(cell.fortification)layers.markers.push({kind:'fortification'});
 for(const [d,e] of Object.entries(cell.hexsideFeatures||{})){
  if(DIRS.includes(d)&&e&&typeof e.type==='string'&&e.type!=='none')layers.edges[d].push({kind:e.type,status:e.reviewStatus||'historical-draft'});
 }
 for(const [d,arr] of Object.entries(cell.tileEdges||{})){
  if(!DIRS.includes(d))continue;for(const f of (Array.isArray(arr)?arr:[arr])){
   if(f&&EDGES.includes(f.kind)&&!layers.edges[d].some(x=>x.kind===f.kind))layers.edges[d].push({...f});
  }
 }
 return layers;
}
function validate(board,{requireReciprocal=true,requireReviewed=false}={}){
 const errors=[],warnings=[];
 if(!board||!Array.isArray(board.cells)||!board.geometry)throw Error('Board requires geometry and cells');
 const byId=new Map();
 for(const c of board.cells){if(!Number.isInteger(c.column)||!Number.isInteger(c.row)||byId.has(c.id)||c.id!==cellId(c.column,c.row))errors.push('Invalid or repeated cell id '+c.id);byId.set(c.id,c);if(c.terrain&&!TERRAIN.includes(c.terrain))errors.push(c.id+' unknown terrain '+c.terrain);if(requireReviewed&&!c.terrain)errors.push(c.id+' untranscribed terrain');
  for(const [d,fs] of Object.entries(c.tileEdges||{})){if(!DIRS.includes(d)){errors.push(c.id+' invalid edge direction '+d);continue;}const seen=new Set();for(const f of (Array.isArray(fs)?fs:[fs])){if(!EDGES.includes(f.kind))errors.push(c.id+' invalid feature '+f.kind);if(seen.has(f.kind))errors.push(c.id+' duplicate feature '+d+' '+f.kind);seen.add(f.kind)}}
  for(const f of (c.tileMarkers||[]))if(!MARKERS.includes(f.kind))errors.push(c.id+' invalid marker '+f.kind);
 }
 for(const c of board.cells){const layer=normalizeLayer(c);for(const d of DIRS){const features=layer.edges[d],neighborId=neighbor(c,d,board.geometry),other=byId.get(neighborId);
  if(!other){if(features.length)warnings.push(`${c.id} ${d}: ${features.map(x=>x.kind)} at unverified/off-board boundary`);continue;}
  if(!requireReciprocal)continue;
  const opposite=normalizeLayer(other).edges[OPP[d]];
  for(const f of features){if(!opposite.some(x=>x.kind===f.kind))warnings.push(`${c.id} ${d} ${f.kind} lacks reciprocal ${neighborId} ${OPP[d]}`)}
 }}
 errors.push(...waterErrors(board));
 return {valid:errors.length===0,errors,warnings,unknownTerrain:board.cells.filter(c=>!c.terrain).length,reviewedTerrain:board.cells.filter(c=>c.terrainStatus==='user-reviewed').length};
}
function addEdge(board,id,dir,kind,{on=true,reciprocal=true,status='user-reviewed'}={}){
 if(!DIRS.includes(dir)||!EDGES.includes(kind))throw Error('Invalid hexside feature');const byId=new Map(board.cells.map(c=>[c.id,c]));const cell=byId.get(id);if(!cell)throw Error('Unknown cell '+id);
 function one(c,d){if(c.hexsideFeatures?.[d]?.type===kind)delete c.hexsideFeatures[d];c.tileEdges||={};const list=Array.isArray(c.tileEdges[d])?c.tileEdges[d]:[];c.tileEdges[d]=list.filter(x=>x.kind!==kind);if(on)c.tileEdges[d].push({kind,status});}
 one(cell,dir);const partner=byId.get(neighbor(cell,dir,board.geometry));if(reciprocal&&partner)one(partner,OPP[dir]);return {neighbor:partner?.id||null,boundary:!partner};
}
function removeEdge(board,id,dir,kind){return addEdge(board,id,dir,kind,{on:false})}
function addMarker(board,id,kind,{label='',status='user-reviewed'}={}){if(!MARKERS.includes(kind))throw Error('Invalid marker '+kind);const cell=board.cells.find(c=>c.id===id);if(!cell)throw Error('Unknown cell '+id);cell.tileMarkers||=[];if(!cell.tileMarkers.some(m=>m.kind===kind))cell.tileMarkers.push({kind,label,status});}
function removeMarker(board,id,kind){const c=board.cells.find(c=>c.id===id);if(!c)throw Error('Unknown cell');c.tileMarkers=(c.tileMarkers||[]).filter(m=>m.kind!==kind)}
function setTerrain(board,id,terrain,status='user-reviewed'){if(terrain!==null&&!TERRAIN.includes(terrain))throw Error('Invalid terrain');const c=board.cells.find(c=>c.id===id);if(!c)throw Error('Unknown cell');c.terrain=terrain;c.terrainStatus=terrain?status:'not-transcribed'}
function pt(v){return Number(v).toFixed(2)}
function path(d){return 'M'+d.map(q=>q.map(pt).join(',')).join(' L')}
// Terrain is borderless. Feature lines and the optional hex-grid are independent SVG layers.
function sideInfo(c, dir, rx, ry, geometry){
 const [cx,cy]=coord(c,geometry),[a,b]=sides(rx,ry)[dir];
 const pa=[cx+a[0],cy+a[1]],pb=[cx+b[0],cy+b[1]];
 return {a:pa,b:pb,mid:[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2]};
}
function line(d,stroke,width,extra=''){return `<path d="${d}" fill="none" stroke="${safe(svgColor(stroke))}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`}
function gridSegmentData(board,rx,ry){
 const byId=new Map(board.cells.map(c=>[c.id,c])),out=[];
 const [radiusX,radiusY]=gridRadii(board.geometry,rx,ry);
 for(const c of board.cells)for(const dir of DIRS){
  const neighborId=neighbor(c,dir,board.geometry),other=byId.get(neighborId);
  if(other&&c.id>other.id)continue;
  const side=sideInfo(c,dir,radiusX,radiusY,board.geometry);
  const twin=other?sideInfo(other,OPP[dir],radiusX,radiusY,board.geometry):null;
  const mismatch=twin?Math.hypot(side.mid[0]-twin.mid[0],side.mid[1]-twin.mid[1]):null;
  // Average matching endpoints to suppress rounding irregularities in scanned maps.
  const a=twin?[(side.a[0]+twin.b[0])/2,(side.a[1]+twin.b[1])/2]:side.a;
  const b=twin?[(side.b[0]+twin.a[0])/2,(side.b[1]+twin.a[1])/2]:side.b;
  out.push({cellId:c.id,dir,neighborId:other?.id||null,a,b,mismatch});
 }
 return out;
}
function gridMetrics(board,rx,ry){
 const seg=gridSegmentData(board,rx,ry),pair=seg.filter(x=>x.neighborId);
 return {cells:board.cells.length,segments:seg.length,sharedEdges:pair.length,boundaryEdges:seg.length-pair.length,
  maxGap:pair.length?Math.max(...pair.map(x=>x.mismatch)):0,meanGap:pair.length?pair.reduce((a,x)=>a+x.mismatch,0)/pair.length:0};
}

// Presentation-only coordinates. A printed map may use a different number
// order, padding, or placement; none of this changes logical cell IDs.
const NUMBER_FORMATS=['id','column-row-4','row-column-4','column-row-dash','row-column-dash','none'];
const GRID_BLEND_MODES=['normal','multiply','screen','color-dodge'];
function numberStyle(board,options={}){
 const g=board.geometry?.hexNumbers||board.geometry?.coordinates||{};
 const o=options.numberStyle||{};
 const f={...g,...o};
 const format=NUMBER_FORMATS.includes(f.format)?f.format:'id';
 const placement=['nw','ne','sw','se','center','topRight'].includes(f.placement)?f.placement:'nw';
 return {format,placement,printedColumnOffset:Number.isInteger(f.printedColumnOffset)?f.printedColumnOffset:0,printedRowOffset:Number.isInteger(f.printedRowOffset)?f.printedRowOffset:0,printedRowOffsetsByColumn:f.printedRowOffsetsByColumn||null,fontSize:Number.isFinite(+f.fontSize)&&+f.fontSize>0?+f.fontSize:9,
  offsetX:Number.isFinite(+f.offsetX)?+f.offsetX:0,offsetY:Number.isFinite(+f.offsetY)?+f.offsetY:0,rowShift:Number.isInteger(f.rowShift)?f.rowShift:0,plate:f.plate===true,plateColor:typeof f.plateColor==='string'?f.plateColor:'#e9e9d8',
  strokeWidth:Number.isFinite(+f.strokeWidth)?+f.strokeWidth:2.2};
}
function formatHexNumber(cell,style={}){
 const format=style.format||'id',c=Number(cell.column)+(style.printedColumnOffset||0),r=Number(cell.row)+(style.printedRowOffset||0)+(Number(style.printedRowOffsetsByColumn?.[String(cell.column)])||0);
 if(format==='none')return '';
 // Source-specific printed coordinate spelling is presentation-only.
 // Preserve the internal cell id and neighbor topology.
 if(!style.printedColumnOffset&&!style.printedRowOffset&&!style.printedRowOffsetsByColumn&&cell.displayNumber&&(format==='id'||format==='column-row-4'))return String(cell.displayNumber);
 if((style.printedColumnOffset||style.printedRowOffset||style.printedRowOffsetsByColumn)&&format==='id')return String(c).padStart(2,'0')+String(r).padStart(2,'0');
 if(format==='column-row-4')return String(c).padStart(2,'0')+String(r).padStart(2,'0');
 if(format==='row-column-4')return String(r).padStart(2,'0')+String(c).padStart(2,'0');
 if(format==='column-row-dash')return `${c}-${r}`;
 if(format==='row-column-dash')return `${r}-${c}`;
 return String(cell.id);
}
function numberLayer(board,rx,ry,options={}){
 const style=numberStyle(board,options),visible=options.showNumbers??options.showIds??false;
 let out=`<g class="hex-coordinate-overlay" data-layer="coordinates" data-overlay="hex-numbers" pointer-events="none" style="display:${visible?'inline':'none'}">`;
 const cellIds=new Set(board.cells.map(c=>c.id));
 for(const cell of board.cells){
  // Sea is a non-numbered water cell in every campaign.
  if(cell.terrain==='sea')continue;
  // A row-shifted label is not allowed to spill outside the finite board.
  if(style.rowShift&& !cellIds.has(cellId(cell.column,cell.row+style.rowShift)))continue;
  const value=formatHexNumber(cell,style);if(!value)continue;
  const [cx,cy]=coord(cell,board.geometry);
  const dx={nw:-.35,ne:.35,sw:-.35,se:.35,center:0,topRight:.22}[style.placement];
  const dy={nw:-.65,ne:-.65,sw:.68,se:.68,center:0,topRight:-.74}[style.placement];
  const rowPitch=Number(board.geometry?.calibration?.pitchY)||0;
  const [x,y]=[cx+dx*rx+style.offsetX,cy+dy*ry+style.offsetY+style.rowShift*rowPitch];
  if(style.plate){const bw=Math.max(16,value.length*style.fontSize*.64+6),bh=style.fontSize+4;
   out+=`<rect class="hex-number-backplate" x="${pt(x-bw/2)}" y="${pt(y-bh/2)}" width="${pt(bw)}" height="${pt(bh)}" rx="1.4" fill="${safe(style.plateColor)}" fill-opacity=".25"/>`;}
  out+=`<text class="hex-number" data-number-cell="${safe(cell.id)}" data-display-number="${safe(value)}" x="${pt(x)}" y="${pt(y)}" text-anchor="middle" dominant-baseline="middle" font-family="ui-monospace,monospace" font-size="${pt(style.fontSize)}" fill="#253a35" stroke="#ffffff" stroke-opacity=".25" stroke-width="${pt(style.strokeWidth)}" paint-order="stroke">${safe(value)}</text>`;
 }
 return out+'</g>';
}
function gridStyle(options={}){
 const b=GRID_BLEND_MODES.includes(options.gridBlend)?options.gridBlend:'multiply';
 const opacity=Number.isFinite(+options.gridOpacity)?Math.min(1,Math.max(0,+options.gridOpacity)):.40;
 return {blend:b,opacity};
}
function svgGridOverlay(board,options={}){
 const w=Number(options.width)||1200,h=Number(options.height)||780;
 const [rx,ry]=gridRadii(board.geometry,options.rx,options.ry);
 const {blend,opacity:defaultOpacity}=gridStyle(options);
 const stroke=options.stroke||'#536d67';
 const opacity=Number.isFinite(+options.opacity)?Math.min(1,Math.max(0,+options.opacity)):defaultOpacity;
 const width=Number.isFinite(+options.strokeWidth)?Math.max(.2,+options.strokeWidth):1.0;
 let out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="source-hex-registration" role="img" aria-label="Independent hex-grid and numbering overlays for ${safe(board.sourceGame||board.id)}">`;
 out+=`<g data-layer="hex-grid" pointer-events="none" style="display:${options.showGrid===false?'none':'inline'}"><g class="hex-grid-blend" data-blend="${blend}" style="mix-blend-mode:${blend}" opacity="${pt(opacity)}">`;
 const gridById=new Map(board.cells.map(c=>[c.id,c]));
 for(const side of gridSegmentData(board,rx,ry)){
  if(gridById.get(side.cellId)?.terrain==='sea'||(side.neighborId&&gridById.get(side.neighborId)?.terrain==='sea'))continue;
  out+=line(path([side.a,side.b]),stroke,width,`class="source-grid-side" data-cell="${safe(side.cellId)}" data-dir="${side.dir}"`);
 }
 out+='</g></g>';
 out+=numberLayer(board,rx,ry,options);
 if(options.showCities||options.showAnchors){out+='<g data-layer="source-annotations" pointer-events="none">';for(const c of board.cells){const [x,y]=coord(c,board.geometry);
 if(options.showCities&&c.city)out+=`<circle cx="${pt(x)}" cy="${pt(y)}" r="4.1" fill="none" stroke="#0fa0ed" stroke-width="1.65"/>`;
 if(options.showAnchors&&(c.setupTags||[]).some(t=>t.includes('fixed')||t.includes('romania')))out+=`<circle cx="${pt(x)}" cy="${pt(y)}" r="4.4" fill="none" stroke="#ef8a1d" stroke-width="1.6"/>`;
 }out+='</g>';}
 if(options.selected){const c=board.cells.find(c=>c.id===options.selected);if(c){const [x,y]=coord(c,board.geometry);
 out+=`<polygon points="${hexPoints(rx,ry).map(([a,b])=>`${pt(x+a)},${pt(y+b)}`).join(' ')}" fill="#ffe54c" fill-opacity=".13" stroke="#f59f21" stroke-width="2.7" pointer-events="none"/>`;}}
 return out+'</svg>';
}

// 3.5. WATER REGIONS (deterministic hexside-driven shoreline generation).
// A water body is authored by its member hexes and optionally open off-board
// sea sides. The seed varies the shore silhouette, never the topology. There is
// no inference of historical geography from unverified reference-map pixels.
const DEFAULT_WATER_SEED=123456;
const WATER_KINDS=['lake','sea'];
function finiteSeed(value,fallback=DEFAULT_WATER_SEED){return Number.isInteger(value)&&Number.isFinite(value)?value>>>0:fallback>>>0}
function waterHash(seed,key){let h=(seed^2166136261)>>>0;for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619)>>>0;return h;}
function waterBodies(board){
 const owned=new Map(),result=[],cells=new Map(board.cells.map(c=>[c.id,c]));
 for(const item of (board.waterBodies||[])){
  if(!item||!WATER_KINDS.includes(item.kind)||!item.id||!Array.isArray(item.cells))throw Error('Invalid waterBody: requires id, kind lake/sea and cells');
  if(result.some(b=>b.id===item.id))throw Error('Duplicate waterBody id '+item.id);
  const ids=[...new Set(item.cells)];
  if(!ids.length)throw Error('Empty waterBody '+item.id);
  for(const id of ids){if(!cells.has(id))throw Error('Unknown waterBody hex '+id);if(owned.has(id))throw Error('Overlapping waterBody hex '+id);owned.set(id,item.id);}
  result.push({...item,cells:ids.sort()});
 }
 // If authors classify cells as lake/sea directly, automatically discover
 // connected components. No lake geometry is guessed from unclassified cells.
 const visited=new Set(owned.keys());
 for(const c of [...board.cells].sort((a,b)=>a.id.localeCompare(b.id))){
  if(visited.has(c.id)||!WATER_KINDS.includes(c.terrain))continue;
  const group=[],kind=c.terrain,stack=[c];visited.add(c.id);
  while(stack.length){const u=stack.pop();group.push(u.id);
   for(const dir of DIRS){const next=cells.get(neighbor(u,dir,board.geometry));
    if(next&&next.terrain===kind&&!visited.has(next.id)){visited.add(next.id);stack.push(next);}
   }
  }
  group.sort();result.push({id:kind+'-'+group[0],kind,cells:group});
 }
 return result;
}
function waterErrors(board){
 const errors=[],cells=new Map(board.cells.map(c=>[c.id,c]));let bodies=[];
 try{bodies=waterBodies(board)}catch(e){errors.push(e.message);return errors;}
 for(const b of bodies){
  // Each named water body must be one contiguous region. Multiple disjoint
  // lakes must have distinct ids to avoid fake continuity in the renderer.
  const members=new Set(b.cells),visited=new Set(),stack=[b.cells[0]];
  visited.add(b.cells[0]);
  while(stack.length){const u=cells.get(stack.pop());for(const dir of DIRS){const v=neighbor(u,dir,board.geometry);if(members.has(v)&&!visited.has(v)){visited.add(v);stack.push(v)}}}
  if(visited.size!==members.size)errors.push(b.id+' disconnected water region');
  if(b.seed!==undefined&&!Number.isInteger(b.seed))errors.push(b.id+' invalid seed');
  if(b.openEdges!==undefined&&!Array.isArray(b.openEdges))errors.push(b.id+' openEdges must be an array');
  for(const e of (Array.isArray(b.openEdges)?b.openEdges:[])){
   const c=cells.get(e.cellId);
   if(b.kind!=='sea'||!c||!b.cells.includes(e.cellId)||!DIRS.includes(e.dir)||cells.has(c?neighbor(c,e.dir,board.geometry):''))
    errors.push(b.id+' invalid off-board open sea edge '+String(e.cellId)+' '+String(e.dir));
  }
 }
 return errors;
}
// Shared Coast/Lake distortion primitive. This exact algorithm is used by
// registered Kiev–Odessa hexsides AND the Leningrad authored Coast polyline.
// Both callers retain their own geometric authority; only rendering varies.
function seededShoreSideSamples(a,b,normal,{seed,bodyId,edgeId,amplitude,segmentsPerSide=5,straight=false}){
 const count=straight?1:Math.max(3,Math.min(12,Number.isInteger(segmentsPerSide)?segmentsPerSide:5));
 const hash=waterHash(seed,bodyId+'|'+edgeId),phase=2*Math.PI*(hash%65521)/65521;
 const out=[];
 for(let i=0;i<=count;i++){
  const t=i/count,window=Math.sin(Math.PI*t)**2;
  const wave=.87*Math.sin(2*Math.PI*t*.8+phase)+.13*Math.sin(2*Math.PI*t*1.45+phase*.7);
  const d=straight?0:amplitude*window*wave;
  out.push([a[0]+(b[0]-a[0])*t+normal[0]*d,
            a[1]+(b[1]-a[1])*t+normal[1]*d]);
 }
 return out;
}
function waterSideSamples(c,dir,board,rx,ry,{seed,amplitude,bodyId,wetEdges,openEdges,segmentsPerSide=5}){
 const side=sideInfo(c,dir,rx,ry,board.geometry),[cx,cy]=coord(c,board.geometry);
 const isInternal=wetEdges.has(neighbor(c,dir,board.geometry));
 const isOpen=openEdges.has(c.id+':'+dir);
 const normal=[side.mid[0]-cx,side.mid[1]-cy],n=Math.hypot(...normal)||1;
 normal[0]/=n;normal[1]/=n;
 const distance=Math.hypot(side.b[0]-side.a[0],side.b[1]-side.a[1]);
 const points=seededShoreSideSamples(side.a,side.b,normal,{seed,amplitude,bodyId,edgeId:c.id+'|'+dir,segmentsPerSide,straight:isInternal||isOpen});
 return {points,isInternal,isOpen,normal,distance};
}

function bodyNearSea(body,bodies,board,options={}){
 const maxDist=Number.isFinite(+options.shallowCoastSeaAdjacencyDistance)?Math.max(0,Math.min(4,Math.round(+options.shallowCoastSeaAdjacencyDistance))):2;
 if(body.kind==='sea')return true;
 if(body.kind!=='lake')return false;
 const seaCells=new Set(bodies.filter(b=>b.kind==='sea').flatMap(b=>b.cells));
 if(!seaCells.size)return false;
 const cellsById=new Map(board.cells.map(c=>[c.id,c]));
 const visited=new Set(body.cells), frontier=[...body.cells];
 if(frontier.some(id=>seaCells.has(id)))return true;
 let current=frontier.slice();
 for(let step=1;step<=maxDist;step++){
  const next=[];
  for(const id of current){
   const c=cellsById.get(id); if(!c) continue;
   for(const dir of DIRS){
    const nid=neighbor(c,dir,board.geometry); if(!nid||visited.has(nid)) continue;
    if(seaCells.has(nid)) return true;
    visited.add(nid); next.push(nid);
   }
  }
  current=next;
  if(!current.length) break;
 }
 return false;
}

// Authored coast and lake shoreline CENTERLINES are not complete water regions.
// Draw them as distinct water bands at layer 3.5; do not treat rivers as coast
// or infer an ocean polygon without a land/water-side designation.
function authoredWaterBoundaryBands(board,options={}){
 const bundle=board?.authoredSourceVectors;
 const traces=bundle?.waterBoundaries;
 if(board.sourceWaterRoutes?.length||!Array.isArray(traces)||!traces.length||options.showAuthoredSourceVectors===false)return '';
 const reg=bundle.registration||{},sx=Number(reg.scaleX),sy=Number(reg.scaleY),tx=Number(reg.translateX),ty=Number(reg.translateY);
 if(![sx,sy,tx,ty].every(Number.isFinite)||sx<=0||sy<=0)return '';
 const baseLayerX=Number(bundle.waterBoundaryLayerOffsetX)||0;
 const baseLayerY=Number(bundle.waterBoundaryLayerOffsetY)||0;
 const transform=`translate(${pt(tx)} ${pt(ty)}) scale(${pt(sx)} ${pt(sy)}) translate(${pt(-baseLayerX)} ${pt(-baseLayerY)})`;
 const pixelScale=(sx+sy)/2;
 let out=`<g class="authored-water-boundaries" data-water-provenance="svg-shoreline-traces-not-filled-regions" transform="${transform}" pointer-events="none">`;
 for(const item of traces){
  if(typeof item.d!=='string'||!/^[mMlLcChHvVqQsStTaAzZ0-9.,+\-\sEe]*$/.test(item.d))continue;
  const kind=item.kind==='coast'?'coast':'lake', d=safe(item.d);
  const targetPx=kind==='coast'?13.2:18.0;
  const width=targetPx/pixelScale;
  const waterBandColor=safe(svgColor(options.waterColor||'#30b9bfff'));
  out+=`<path class="authored-water-shore-band" data-water-kind="${kind}" data-source-path="${safe(item.id)}" data-water-not-region="true" d="${d}" stroke="${waterBandColor}" stroke-width="${pt(width)}" stroke-linejoin="round" stroke-linecap="round" fill="none"/>`;
 }
 return out+'</g>';
}
// Source-registration diagnostics are visual-only. Compare a nominated shore
// hexside with the *actual printed sea boundary*, not with the nearest sea hex.
// This catches disconnected decoration without promoting scan pixels to rules.
function pointSegmentDistance(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 const t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function segmentsDistance(a,b,c,d){
 const cross=(u,v)=>u[0]*v[1]-u[1]*v[0];
 const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],q=[c[0]-a[0],c[1]-a[1]];
 const den=cross(r,s);
 if(Math.abs(den)>1e-10){const t=cross(q,s)/den,u=cross(q,r)/den;if(t>=0&&t<=1&&u>=0&&u<=1)return 0;}
 return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
function sourceSeaBoundaryDistance(a,b,contours){
 let min=Infinity;
 for(const ring of contours?.polygons||[]){if(ring.hole||!Array.isArray(ring.points))continue;
  for(let i=0;i<ring.points.length;i++)min=Math.min(min,segmentsDistance(a,b,ring.points[i],ring.points[(i+1)%ring.points.length]));
 }
 return min;
}
function shorelineRegistrationAudit(board,rx,ry,{tolerance=12}={}){
 const byId=new Map(board.cells.map(c=>[c.id,c]));
 const result=[];
 for(const e of board.authoredShoreHexsides||[]){
  const c=byId.get(e.cellId);if(!c||!DIRS.includes(e.dir))continue;
  const side=sideInfo(c,e.dir,rx,ry,board.geometry);
  const distance=e.kind==='coast'&&board.sourceWaterScanContours?.polygons?.length
   ?sourceSeaBoundaryDistance(side.a,side.b,board.sourceWaterScanContours):null;
  result.push({cellId:e.cellId,dir:e.dir,kind:e.kind,
   boundaryDistancePx:distance==null?null:Math.round(distance*100)/100,
   sourceRegistered:distance==null?null:distance<=tolerance});
 }
 return result;
}
// The printed sea scan includes water ink *outside* the irregular playable
// map. Restrict its visual fill to the actual union of game hexagons.
function mapCellClipDefinition(board,rx,ry,id){
 const d=board.cells.map(c=>{const [cx,cy]=coord(c,board.geometry);return path(hexPoints(rx,ry).map(p=>[p[0]+cx,p[1]+cy]))+' Z';}).join(' ');
 return `<defs><clipPath id="${safe(id)}" clipPathUnits="userSpaceOnUse"><path d="${d}"/></clipPath></defs>`;
}
// Registered coastline/lake HEXSIDES use the SAME five-interval seeded wavelet
// generator as full water regions, not constant-width SVG source strokes.
// Only source-supported edges are drawn; no unverified whole sea hexes are added.
function registeredShorelineLayer(board,rx,ry,options={}){
 const items=board.authoredShoreHexsides;
 if(board.sourceCoastRenderingMode==='source-path-coast-wavelets')return '';
 if((board.waterRenderingMode||'')!=='hexside-wavelets'&&board.sourceWaterRoutes?.length)return '';
 if(!Array.isArray(items)||!items.length)return '';
 const byId=new Map(board.cells.map(c=>[c.id,c]));
 const seed=finiteSeed(options.waterSeed,finiteSeed(board.waterSeed));
 const waterFill=safe(svgColor(options.waterColor||'#30b9bfff'));
 const coastDepth=Number.isFinite(+options.seaFringeDepth)?Math.max(0,+options.seaFringeDepth):7.2;
 const lakeDepth=Number.isFinite(+options.lakeFringeDepth)?Math.max(0,+options.lakeFringeDepth):21.6;
 const coastWave=Number.isFinite(+options.seaShoreAmplitude)?Math.max(0,+options.seaShoreAmplitude):4;
 const lakeWave=Number.isFinite(+options.waterShoreAmplitude)?Math.max(0,+options.waterShoreAmplitude):5;
 const count=Number.isInteger(options.shoreSegmentsPerSide)?options.shoreSegmentsPerSide:5;
 let out=`<g class="registered-shoreline-wavelets" data-shoreline-mode="seeded-hexside-wavelets" data-shoreline-seed="${seed}">`;
 const unique=new Set();
 const audit=shorelineRegistrationAudit(board,rx,ry);
 const auditByKey=new Map(audit.map(e=>[e.cellId+':'+e.dir,e]));
 for(const edge of items){
  if(!edge||!DIRS.includes(edge.dir)||!['lake','coast'].includes(edge.kind))continue;
  // Source-authored lakes take precedence over approximate registered wavelets.
  if((edge.kind==='lake'&&board.sourceLakeRenderingMode==='exact-source-paths')||(edge.kind==='coast'&&board.sourceCoastRenderingMode==='exact-source-paths'))continue;
  const cell=byId.get(edge.cellId);if(!cell)throw Error('Shoreline references invalid cell '+edge.cellId);
  const key=edge.cellId+':'+edge.dir;
  if(unique.has(key))continue;unique.add(key);
  const match=auditByKey.get(key);
  // Source-derived sea fill is authoritative for VISUAL area. Never place
  // a detached band where a provisional hexside differs substantially from
  // its boundary. Keep all 20 annotations in config and in the audit export.
  if(edge.kind==='coast'&&match?.sourceRegistered===false)continue;
  const adjacentCell=byId.get(neighbor(cell,edge.dir,board.geometry));
  const bordersSea=edge.kind==='coast'&&adjacentCell?.terrain==='sea';
  const isLake=edge.kind==='lake',depth=isLake?lakeDepth:coastDepth;
  // The Odessa source sea is purple. A generic cyan river/lake palette
  // created disconnected-looking cyan coast bands on the purple sea.
  const shoreFill=waterFill;
  const amplitude=isLake?lakeWave:coastWave;
  const shape=waterSideSamples(cell,edge.dir,board,rx,ry,{seed,amplitude,bodyId:'source-'+edge.kind,wetEdges:new Set(),openEdges:new Set(),segmentsPerSide:count});
  // Five-interval coast/lake wavelets vary in BOTH lateral shape and depth.
  // Zero endpoint perturbation maintains stable junctions between hexsides.
  // No authored coastline path or scan polygon contributes drawing geometry.
  const samples=shape.points,hash=waterHash(seed,edge.kind+'-depth-'+key);
  const phase=2*Math.PI*(hash%65521)/65521;
  const left=[],right=[];
  for(let i=0;i<samples.length;i++){
   const t=i/(samples.length-1),window=Math.sin(Math.PI*t)**2;
   const modulation=0.84+0.25*window*Math.sin(2*Math.PI*t*.82+phase);
   const width=depth*Math.max(.57,modulation),q=samples[i];
   left.push([q[0]+shape.normal[0]*width,q[1]+shape.normal[1]*width]);
   right.push([q[0]-shape.normal[0]*width,q[1]-shape.normal[1]*width]);
  }
  const d=path(samples),ribbon=path([...left,...right.reverse()])+' Z';
  const shared=`data-shore-cell="${safe(edge.cellId)}" data-shore-dir="${edge.dir}" data-water-kind="${edge.kind}" data-source-path="${safe(edge.sourceSvgId||'')}" data-source-boundary-distance="${match?.boundaryDistancePx??''}"`;
  out+=`<path class="water-shore-fringe registered-shore-fringe" ${shared} data-fringe-depth="${pt(depth)}" data-shore-segments="${samples.length-1}" data-depth-profile="seeded-variable-depth" d="${ribbon}" fill="${shoreFill}" stroke="${shoreFill}" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(!bordersSea)out+=`<path class="water-shoreline registered-shoreline" ${shared} d="${d}" fill="none" stroke="#165b80" stroke-opacity=".4" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>`;
 }
 return out+'</g>';
}
function waterBodyLayer(board,rx,ry,options={}){
 if(waterErrors(board).length)throw Error('Invalid water bodies: '+waterErrors(board).join('; '));
 const bodies=waterBodies(board),byId=new Map(board.cells.map(c=>[c.id,c]));
 const seed=finiteSeed(options.waterSeed,finiteSeed(board.waterSeed));
 const wave=Number.isFinite(+options.waterShoreAmplitude)?Math.max(0,Math.min(Math.min(rx,ry)*.32,+options.waterShoreAmplitude)):Math.min(rx,ry)*.19;
 const seaExtend=Number.isFinite(+options.waterSeaExtension)?Math.max(0,Math.min(250,+options.waterSeaExtension)):Math.max(rx,ry)*1.3;
 const fringeDepth=Number.isFinite(+options.waterFringeDepth)?Math.max(0,Math.min(Math.min(rx,ry)*1.45,+options.waterFringeDepth)):wave*3;
 const lakeFringeDepth=Number.isFinite(+options.lakeFringeDepth)?Math.max(0,Math.min(Math.min(rx,ry)*1.45,+options.lakeFringeDepth)):fringeDepth*2;
 // Sea-facing coast bands should not visually bridge separated water regions.
 // Coast intrusion defaults to one third of the generic fringe; inland lakes
 // preserve their independently configured depth.
 const seaFringeDepth=Number.isFinite(+options.seaFringeDepth)?Math.max(0,Math.min(Math.min(rx,ry)*1.45,+options.seaFringeDepth)):fringeDepth/3;
 const seaShoreAmplitude=Number.isFinite(+options.seaShoreAmplitude)?Math.max(0,Math.min(Math.min(rx,ry)*.32,+options.seaShoreAmplitude)):wave*.55;
 let svg=`<g class="water-body-overlay" data-layer="water-bodies" data-layer-order="3.5" data-water-seed="${seed}" display="${options.showWaterBodies===false?'none':'inline'}" pointer-events="none">`;
 for(const body of bodies){
  if(body.kind==='sea'&&board.authoritativeSeaHexes?.length)continue;
  // When a source scan defines exact partial-hex sea ink, do not draw the
  // incompatible all-or-nothing provisional sea-hex water polygon.
  if((board.waterRenderingMode!=='hexside-wavelets'||board.sourceSeaInteriorMode==='source-registered-contours')&&board.sourceWaterScanContours?.polygons?.length&&body.kind==='sea')continue;
  const own=new Set(body.cells),open=new Set((body.openEdges||[]).map(e=>e.cellId+':'+e.dir));
  const currentSeed=finiteSeed(body.seed,seed),waterFill=safe(svgColor(options.waterColor||'#30b9bfff'));
  const nearSeaBody=bodyNearSea(body,bodies,board,options);
  const bodyWave=body.kind==='sea'?seaShoreAmplitude:wave;
  const segmentsPerSide=Number.isInteger(options.shoreSegmentsPerSide)?options.shoreSegmentsPerSide:5;
  svg+=`<g class="water-region" data-water-id="${safe(body.id)}" data-water-kind="${safe(body.kind)}" data-water-region-seed="${currentSeed}" data-shore-amplitude="${pt(bodyWave)}">`;
  // Connected off-board sea extensions: each contiguous run of authored
  // outward-facing hexsides is capped as ONE polygon, not as rectangular strips.
  // Never bridge large gaps or edges facing in different directions.
  if(body.kind==='sea'&&open.size){
   for(const dir of DIRS){
    const edges=(body.openEdges||[]).filter(e=>e.dir===dir).map(e=>{
     const c=byId.get(e.cellId),side=sideInfo(c,dir,rx,ry,board.geometry);
     const [cx,cy]=coord(c,board.geometry),normal=[side.mid[0]-cx,side.mid[1]-cy],n=Math.hypot(...normal)||1;
     return {...side,normal:normal.map(v=>v/n),cellId:e.cellId};
    });
    if(!edges.length)continue;
    const tangent=[edges[0].b[0]-edges[0].a[0],edges[0].b[1]-edges[0].a[1]];
    const dot=p=>p[0]*tangent[0]+p[1]*tangent[1];
    edges.sort((a,b)=>dot(a.mid)-dot(b.mid));
    let runs=[],run=[];
    for(const edge of edges){
     if(run.length&&Math.hypot(run[run.length-1].b[0]-edge.a[0],run[run.length-1].b[1]-edge.a[1])>Math.max(rx,ry)*1.9){runs.push(run);run=[];}
     run.push(edge);
    }
    if(run.length)runs.push(run);
    for(const group of runs){
     const border=[];for(const e of group)border.push(e.a,e.b);
     const norm=group[0].normal,offset=[norm[0]*seaExtend,norm[1]*seaExtend];
     const far=[...border].reverse().map(q=>[q[0]+offset[0],q[1]+offset[1]]);
     svg+=`<path class="sea-connected-extension" data-open-sea-direction="${dir}" d="${path([...border,...far])} Z" fill="${waterFill}"/>`;
    }
   }
  }
  for(const id of body.cells){
   const c=byId.get(id),edgeSamples=DIRS.map(dir=>({dir,...waterSideSamples(c,dir,board,rx,ry,{seed:currentSeed,amplitude:bodyWave,bodyId:body.id,wetEdges:own,openEdges:open,segmentsPerSide})}));
   const all=edgeSamples.flatMap((side,i)=>i?side.points.slice(1):side.points);
   svg+=`<path class="water-region-cell" data-water-cell="${safe(id)}" d="${path(all)} Z" fill="${waterFill}" stroke="${waterFill}" stroke-width=".65"/>`;
   for(const side of edgeSamples){
    if(side.isInternal)continue;
    if(side.isOpen){
     const a=side.points[0],b=side.points[side.points.length-1],dx=side.normal[0]*seaExtend,dy=side.normal[1]*seaExtend;
     const q=[a,b,[b[0]+dx,b[1]+dy],[a[0]+dx,a[1]+dy]];
     svg+=`<path class="sea-open-continuation" data-open-sea-cell="${safe(id)}" data-open-sea-dir="${side.dir}" d="${path(q)} Z" fill="${waterFill}" stroke="${waterFill}" stroke-width=".65"/>`;
    }else{
     // Procedural shoreline fringe is a round-joined band, not an isolated
     // edge-to-point polygon. This removes triangular spikes at hex vertices.
     // Stroke radius equals the author-controlled intrusion depth; the half
     // lying over the water body is merged visually with the region fill.
     const currentFringeDepth=body.kind==='lake'?(nearSeaBody?(Number.isFinite(+options.nearSeaLakeFringeDepth)?Math.max(0,Math.min(Math.min(rx,ry)*1.45,+options.nearSeaLakeFringeDepth)):seaFringeDepth):lakeFringeDepth):seaFringeDepth;
     const shorelinePath=path(side.points);
     svg+=`<path class="water-shore-fringe" data-fringe-cell="${safe(id)}" data-fringe-dir="${side.dir}" data-fringe-depth="${pt(currentFringeDepth)}" data-shore-segments="${side.points.length-1}" data-fringe-geometry="rounded-stroke" d="${shorelinePath}" fill="none" stroke="${waterFill}" stroke-width="${pt(currentFringeDepth*2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
     svg+=`<path class="water-shoreline" data-shore-cell="${safe(id)}" data-shore-dir="${side.dir}" data-shore-segments="${side.points.length-1}" d="${shorelinePath}" fill="none" stroke="#165b80" stroke-opacity=".58" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
   }
  }
  svg+='</g>';
 }
 // Source-color-traced partial-hex water polygons. These are geometry drafts
 // derived from the printed source, not validated gameplay hexside crossings.
 // They share the 3.5 water layer; preserve each contour's exact coordinates.
 for(const trace of (options.showSourceWaterTraces===false?[]:(board.sourceWaterTraces||[]))){
  const rings=(trace.rings||[trace.points]).filter(q=>Array.isArray(q)&&q.length>=3&&q.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(+v))));
  if(!rings.length)continue;
  const color=safe(svgColor(trace.color||options.waterColor||'#20719f'));
  svg+=`<path class="source-water-contour" data-trace-id="${safe(trace.id||'unknown')}" data-trace-provenance="${safe(trace.status||'source-color-derived-unreviewed')}" data-water-kind="${safe(trace.kind||'lake')}" d="${rings.map(q=>path(q)+' Z').join(' ')}" fill="${color}" fill-rule="evenodd" pointer-events="none"/>`;
 }
 // v287: Preserve the connected printed sea INTERIOR independently of its
 // legal coastline hexside candidates. The historical water system already
 // supplies five-interval wavelets for boundaries; it cannot fill partial
 // coastal hexes from a full-cell waterBody alone. This opt-in layer fills
 // source-registered sea area below those edges, without manufacturing new
 // coast or river movement rules. Source contour edges remain visual evidence,
 // NOT certified movement barriers. No raster image or generated artwork.
 if(board.sourceSeaInteriorMode==='source-registered-contours' && options.showSourceSeaInterior!==false){
  const info=board.sourceWaterScanContours;
  if(info?.polygons?.length){
   const valid=info.polygons.filter(q=>Array.isArray(q.points)&&q.points.length>=3&&q.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)));
   if(valid.length){
    const d=valid.map(q=>path(q.points)+' Z').join(' ');
    const clipId='source-sea-playable-hex-mask';
    svg+=mapCellClipDefinition(board,rx,ry,clipId);
    svg+=`<g class="registered-source-sea-interior" data-layer="water-bodies" data-sea-status="visual-source-registration-not-gameplay-topology" data-scan-sha="${safe(info.sha256||'')}" clip-path="url(#${clipId})"><path class="source-registered-sea-fill" d="${d}" fill="${safe(svgColor(options.waterColor||'#30b9bfff'))}" fill-rule="evenodd" stroke="none"/></g>`;
   }
  }
 }
 // An explicitly authored coast edge can be used before a sea region's member
 // hexes are transcribed. Keep it in 3.5, ABOVE river layer 3.
 const used=new Set(bodies.flatMap(b=>b.cells));
 const registered=new Set((board.authoredShoreHexsides||[]).map(x=>x.cellId+':'+x.dir));
 for(const edge of gridSegmentData(board,rx,ry)){
  const c=byId.get(edge.cellId),other=byId.get(edge.neighborId);
  if(used.has(c.id)||(other&&used.has(other.id)))continue;
  const fs=[...normalizeLayer(c).edges[edge.dir],...(other?normalizeLayer(other).edges[OPP[edge.dir]]:[])];
  if(board.sourceCoastRenderingMode!=='source-path-coast-wavelets'&&fs.some(f=>f.kind==='coast')&&!registered.has(edge.cellId+':'+edge.dir))svg+=line(path([edge.a,edge.b]),safe(svgColor(options.waterColor||'#30b9bfff')),2.5,'class="explicit-coast-edge"');
 }
 // Printed source water polygons: the purple ink itself provides the
 // topology. The hand-traced SVG coast paths only mark its outer edge, not
 // a filled water polygon; rendering them as thick bands created false seas.
 if(board.waterRenderingMode!=='hexside-wavelets'&&board.sourceWaterScanContours?.polygons?.length){
  const info=board.sourceWaterScanContours,shade=safe(svgColor(options.waterColor||'#30b9bfff'));
  const rings=info.polygons.filter(q=>Array.isArray(q.points)&&q.points.length>=3);
  svg+=`<g class="source-scan-water-region" data-water-area-provenance="published-scan-purple-ink" data-source-scan-sha="${safe(info.sha256)}" data-source-scan="${safe(info.sourceScan)}">`;
  for(const [i,ring] of rings.entries()){
   svg+=`<path class="source-purple-water-area" data-water-region-index="${i}" data-water-region-hole="${ring.hole?'true':'false'}" d="${path(ring.points)} Z" fill="${ring.hole?'#c4cfa7':shade}" stroke="none" opacity=".89"/>`;
  }
  svg+='</g>';
 }
 svg+=registeredShorelineLayer(board,rx,ry,options);
 if(!(board.authoredShoreHexsides||[]).length)svg+=authoredWaterBoundaryBands(board,options);
 return svg+'</g>';
}
// Geometry-only river styling. Water ownership and edge connectivity are read
// from source scenario edges; no river paths are invented. All wave displacement
// vanishes at shared endpoints, keeping a stable, connected physical graph.
function waterStyle(options={}){
 const num=(v,fallback,min,max)=>Number.isFinite(+v)?Math.min(max,Math.max(min,+v)):fallback;
 return {scale:num(options.riverWidthScale,1,.25,4),
  majorRiverScale:num(options.majorRiverWidthScale,1,.5,3),
  amplitude:num(options.riverWaveAmplitude,0,0,8),
  wavelength:num(options.riverWaveLength,24,8,80),
  taper:num(options.riverTerminalWidthRatio,1,.2,1)};
}
function smoothstep(t){const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u)}
function smoothPointPath(points,{move=true}={}){
 if(!Array.isArray(points)||points.length<2)return '';
 const len=v=>Math.hypot(v[0],v[1]);
 const f=n=>pt(n);
 let d=move?`M${f(points[0][0])},${f(points[0][1])}`:'';
 for(let i=0;i<points.length-1;i++){
  const a=points[Math.max(0,i-1)],p=points[i],q=points[i+1],b=points[Math.min(points.length-1,i+2)];
  const mag=len([q[0]-p[0],q[1]-p[1]]);
  const v0=i===0?[q[0]-p[0],q[1]-p[1]]:[(q[0]-a[0])*.5,(q[1]-a[1])*.5];
  const v1=i===points.length-2?[q[0]-p[0],q[1]-p[1]]:[(b[0]-p[0])*.5,(b[1]-p[1])*.5];
  const clamp=v=>{const l=len(v),factor=l>0?Math.min(1,mag*.82/l)/3:0;return [v[0]*factor,v[1]*factor]};
  const [t0,t1]=[clamp(v0),clamp(v1)];
  d+=` C${f(p[0]+t0[0])},${f(p[1]+t0[1])} ${f(q[0]-t1[0])},${f(q[1]-t1[1])} ${f(q[0])},${f(q[1])}`;
 }
 return d;
}
function riverProfile(t,dist,baseWidth,style,phase,terminalStart,terminalEnd){
 const envelope=Math.sin(Math.PI*t)**2;
 const theta=2*Math.PI*dist*t/style.wavelength+phase;
 const offset=style.amplitude*envelope*(Math.sin(theta)+.27*Math.sin(theta*2.13+phase*.43))/1.27;
 const pulse=1+.055*envelope*Math.sin(theta*1.83+.9);
 // The taper is local to free ends. At all connected ends full width is
 // restored so adjacent river segments remain hydraulically continuous.
 const reach=.32;
 const start=terminalStart?style.taper+(1-style.taper)*smoothstep(t/reach):1;
 const end=terminalEnd?style.taper+(1-style.taper)*smoothstep((1-t)/reach):1;
 return {offset,radius:baseWidth*.5*pulse*start*end};
}
function riverRibbon(segment,style){
 const {a,b,width,color,cellId,dir}=segment;
 const dx=b[0]-a[0],dy=b[1]-a[1],dist=Math.hypot(dx,dy)||1;
 const normal=[-dy/dist,dx/dist];
 // Stable phase from source-owned edge ID; no random numbers or time coupling.
 const code=cellId+'-'+dir;
 let hash=2166136261;
 for(let i=0;i<code.length;i++)hash=Math.imul(hash^code.charCodeAt(i),16777619)>>>0;
 const phase=2*Math.PI*(hash%104729)/104729;
 const ta=segment.aNode.degree===1,tb=segment.bNode.degree===1;
 const n=Math.max(18,Math.ceil(dist/2.1));
 const left=[],right=[];
 for(let i=0;i<=n;i++){
  const t=i/n,profile=riverProfile(t,dist,width,style,phase,ta,tb);
  const x=a[0]+dx*t+normal[0]*profile.offset;
  const y=a[1]+dy*t+normal[1]*profile.offset;
  left.push([x+normal[0]*profile.radius,y+normal[1]*profile.radius]);
  right.push([x-normal[0]*profile.radius,y-normal[1]*profile.radius]);
 }
 const rev=right.slice().reverse();
 const d=smoothPointPath(left,{move:true})+` L${pt(rev[0][0])},${pt(rev[0][1])}`+smoothPointPath(rev,{move:false})+' Z';
 return `<path class="feature-water feature-river-ribbon" data-river-cell="${safe(cellId)}" data-river-dir="${dir}" data-river-width="${pt(width)}" data-river-taper-start="${ta?pt(style.taper):'1.00'}" data-river-taper-end="${tb?pt(style.taper):'1.00'}" data-river-wave-amplitude="${pt(style.amplitude)}" data-river-smoothing="cubic" d="${d}" fill="${color}" stroke="${color}" stroke-width=".35" stroke-linejoin="round"/>`;
}
function waterRibbons(segments,options={}){
 if(!segments.length)return '';
 const style=waterStyle(options),nodes=[];
 // PixelCenters and snapped shared-boundary averages can differ by a few
 // hundredths of a unit. Cluster source endpoints within 0.18 map units,
 // much smaller than a hex side, instead of treating those as false termini.
 for(const r of segments){
  for(const side of ['a','b']){
   const p=r[side];
   let node=nodes.find(n=>Math.hypot(n.p[0]-p[0],n.p[1]-p[1])<.18);
   if(!node){node={p:p.slice(),degree:0,width:r.width,color:r.color};nodes.push(node);}
   node.degree++;
   if(node.width<r.width){node.width=r.width;node.color=r.color;}
   r[side+'Node']=node;
  }
 }
 let out='';
 for(const r of segments)out+=riverRibbon(r,style);
 // Small source-anchored rounded joins prevent visible gaps where distinct
 // angled hex-sides meet, including 3-way confluences. Open river endpoints
 // receive only the reduced-width rounded cap, not a full-width junction.
 for(const node of nodes){
  const free=node.degree===1;
  const radius=node.width*.5*(free?style.taper:1);
  out+=`<circle class="feature-water-junction" data-water-degree="${node.degree}" cx="${pt(node.p[0])}" cy="${pt(node.p[1])}" r="${pt(radius)}" fill="${node.color}"/>`;
 }
 return out;
}
// Visual-only smoothing of straight-line authored river centerlines. Preserve
// original user SVG geometry in scenario data and preserve every endpoint.
// This handles M/m, L/l, H/h, V/v authored paths; unsupported SVG commands
// use the original path without smoothing. No gameplay hexsides are inferred.
function authoredRiverSmoothPath(d){
 if(typeof d!=='string'||/[CcQqSsTtAaZz]/.test(d))return null;
 const tokens=d.match(/[MmLlHhVv]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g);
 if(!tokens||!tokens.length)return null;
 let i=0,cmd='',x=0,y=0;const pts=[];
 const commandToken=t=>/^[MmLlHhVv]$/.test(t);
 while(i<tokens.length){
  if(commandToken(tokens[i])){cmd=tokens[i++];if(i>=tokens.length)return null;}
  if(!cmd)return null;
  const rel=cmd===cmd.toLowerCase();
  if(cmd==='m'||cmd==='M'||cmd==='l'||cmd==='L'){
   if(i+1>=tokens.length||commandToken(tokens[i])||commandToken(tokens[i+1]))return null;
   const a=Number(tokens[i++]),b=Number(tokens[i++]);
   x=rel?x+a:a;y=rel?y+b:b;
   pts.push([x,y]);
   if(cmd==='m')cmd='l';else if(cmd==='M')cmd='L';
  }else if(cmd==='h'||cmd==='H'){
   if(commandToken(tokens[i]))return null;
   const a=Number(tokens[i++]);x=rel?x+a:a;pts.push([x,y]);
  }else if(cmd==='v'||cmd==='V'){
   if(commandToken(tokens[i]))return null;
   const a=Number(tokens[i++]);y=rel?y+a:a;pts.push([x,y]);
  }else return null;
 }
 const arr=pts.filter((q,j)=>j===0||Math.hypot(q[0]-pts[j-1][0],q[1]-pts[j-1][1])>=.04);
 if(arr.length<3)return null;
 const fmt=n=>Number(n.toFixed(6));
 let out=`M${fmt(arr[0][0])} ${fmt(arr[0][1])}`;
 for(let j=0;j<arr.length-1;j++){
  const a=arr[Math.max(0,j-1)],p=arr[j],q=arr[j+1],b=arr[Math.min(arr.length-1,j+2)];
  const length=Math.hypot(q[0]-p[0],q[1]-p[1]);
  const tang0=j===0?[q[0]-p[0],q[1]-p[1]]:[(q[0]-a[0])*.5,(q[1]-a[1])*.5];
  const tang1=j===arr.length-2?[q[0]-p[0],q[1]-p[1]]:[(b[0]-p[0])*.5,(b[1]-p[1])*.5];
  const clamped=(t)=>{const mag=Math.hypot(...t);const factor=mag>0?Math.min(1,(length*.85)/mag):0;return [t[0]*factor/3,t[1]*factor/3]};
  const t0=clamped(tang0),t1=clamped(tang1);
  out+=` C${fmt(p[0]+t0[0])} ${fmt(p[1]+t0[1])} ${fmt(q[0]-t1[0])} ${fmt(q[1]-t1[1])} ${fmt(q[0])} ${fmt(q[1])}`;
 }
 return out;
}
// Convert an *authored* (not inferred) SVG M/L/H/V polyline to a finite,
// ordered centerline. This is display geometry only; never create game edges.
function authoredRiverPoints(d){
 if(typeof d!=='string'||/[CcQqSsTtAaZz]/.test(d))return null;
 const tok=d.match(/[MmLlHhVv]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g);
 if(!tok||tok.length<3)return null;
 const isCmd=x=>/^[MmLlHhVv]$/.test(x);
 let i=0,cmd='',x=0,y=0,points=[];
 while(i<tok.length){
  if(isCmd(tok[i])){cmd=tok[i++];if(i>=tok.length)return null;}
  if(!cmd)return null;
  const relative=cmd===cmd.toLowerCase();
  if(/[mMlL]/.test(cmd)){
   if(i+1>=tok.length||isCmd(tok[i])||isCmd(tok[i+1]))return null;
   const a=+tok[i++],b=+tok[i++]; x=relative?x+a:a;y=relative?y+b:b;
   points.push([x,y]);if(cmd==='m')cmd='l';else if(cmd==='M')cmd='L';
  }else if(/[hH]/.test(cmd)){
   if(isCmd(tok[i]))return null;const a=+tok[i++];x=relative?x+a:a;points.push([x,y]);
  }else if(/[vV]/.test(cmd)){
   if(isCmd(tok[i]))return null;const a=+tok[i++];y=relative?y+a:a;points.push([x,y]);
  }else return null;
  if(!Number.isFinite(x)||!Number.isFinite(y)||points.length>8000)return null;
 }
 const clean=points.filter((p,j)=>j===0||Math.hypot(p[0]-points[j-1][0],p[1]-points[j-1][1])>.002);
 return clean.length>=2?clean:null;
}
function riverDistanceToPolyline(point,poly){
 let distance=Infinity;
 for(let i=1;i<poly.length;i++){
  const a=poly[i-1],b=poly[i],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
  const t=Math.max(0,Math.min(1,length2?((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length2:0));
  distance=Math.min(distance,Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dy*t));
 }
 return distance;
}
// Pass through the original Inkscape vertices; tangent-limited cubic sampling
// softens the visual course without relocating or deducing source features.
function sampleAuthoredRiver(points,pxPerUnit){
 const samples=[];
 for(let j=0;j<points.length-1;j++){
  const a=points[Math.max(0,j-1)],p=points[j],q=points[j+1],b=points[Math.min(points.length-1,j+2)];
  const length=Math.hypot(q[0]-p[0],q[1]-p[1]);if(length<.002)continue;
  const c0=[(q[0]-a[0])/6,(q[1]-a[1])/6],c1=[(b[0]-p[0])/6,(b[1]-p[1])/6];
  for(const t of [c0,c1]){
   const mag=Math.hypot(t[0],t[1]);if(mag>length*.22){const m=length*.22/mag;t[0]*=m;t[1]*=m;}
  }
  const p1=[p[0]+c0[0],p[1]+c0[1]],q1=[q[0]-c1[0],q[1]-c1[1]];
  const n=Math.max(3,Math.ceil(length*pxPerUnit/2.3));
  for(let k=0;k<n;k++){
   const t=k/n,it=1-t;
   samples.push([it*it*it*p[0]+3*it*it*t*p1[0]+3*it*t*t*q1[0]+t*t*t*q[0],
                 it*it*it*p[1]+3*it*it*t*p1[1]+3*it*t*t*q1[1]+t*t*t*q[1]]);
  }
 }
 samples.push(points[points.length-1]);return samples;
}
// A true filled SVG polygon, not an SVG stroke, and not a coast/lake hexside.
// Uses the shared riverProfile (width pulse, phase-locked wavelets, endpoint
// taper) already used for engine-authored hexside river ribbons.
function authoredRiverRibbon(item,polyline,allPolylines,reg,options){
 const sx=reg.scaleX,sy=reg.scaleY,pxPerUnit=(sx+sy)/2;
 const samples=sampleAuthoredRiver(polyline,pxPerUnit);
 if(samples.length<2)return '';
 const cumulative=[0];for(let i=1;i<samples.length;i++){
  const d=Math.hypot((samples[i][0]-samples[i-1][0])*sx,(samples[i][1]-samples[i-1][1])*sy);
  cumulative.push(cumulative[i-1]+d);
 }
 const fullLen=cumulative[cumulative.length-1];if(fullLen<.1)return '';
 const style=waterStyle(options),base=(item.kind==='majorRiver'?19.2*style.majorRiverScale:9.6)*style.scale;
 // An end joining another authored river (including a mid-course confluence)
 // keeps full width, unlike a genuinely open endpoint.
 const nearDist=Math.max(5,base*.65)/pxPerUnit;
 const freeStart=!allPolylines.some(x=>x.id!==item.id&&riverDistanceToPolyline(polyline[0],x.points)<=nearDist);
 const freeEnd=!allPolylines.some(x=>x.id!==item.id&&riverDistanceToPolyline(polyline[polyline.length-1],x.points)<=nearDist);
 let hash=2166136261;const code=String(item.id||'')+'-river';
 for(let i=0;i<code.length;i++)hash=Math.imul(hash^code.charCodeAt(i),16777619)>>>0;
 const phase=2*Math.PI*(hash%104729)/104729,left=[],right=[];
 const fmt=n=>pt(n);
 for(let i=0;i<samples.length;i++){
  const before=samples[Math.max(0,i-2)],after=samples[Math.min(samples.length-1,i+2)];
  const dx=(after[0]-before[0])*sx,dy=(after[1]-before[1])*sy,mag=Math.hypot(dx,dy)||1;
  // Pixel-space normal compensates for nonuniform SVG registration scale.
  const nx=-dy/mag,ny=dx/mag;
  const t=cumulative[i]/fullLen;
  const profile=riverProfile(t,fullLen,base,style,phase,freeStart,freeEnd);
  const x=reg.translateX+samples[i][0]*sx+nx*profile.offset;
  const y=reg.translateY+samples[i][1]*sy+ny*profile.offset;
  left.push([x+nx*profile.radius,y+ny*profile.radius]);
  right.push([x-nx*profile.radius,y-ny*profile.radius]);
 }
 const rev=right.slice().reverse();
 const d=smoothPointPath(left,{move:true})+` L${fmt(rev[0][0])},${fmt(rev[0][1])}`+smoothPointPath(rev,{move:false})+' Z';
 return `<path class="svg-authored-river-ribbon feature-water" data-authored-path="${safe(item.id)}" data-feature-kind="${item.kind==='majorRiver'?'majorRiver':'river'}" data-river-render-mode="filled-procedural-ribbon" data-river-width="${pt(base)}" data-river-wave-amplitude="${pt(style.amplitude)}" data-river-smoothing="cubic" data-river-taper-start="${freeStart?pt(style.taper):'1.00'}" data-river-taper-end="${freeEnd?pt(style.taper):'1.00'}" data-source-provenance="user-authored-centerline" d="${d}" fill="#20719f" stroke="#165b80" stroke-width=".65" stroke-linejoin="round"/>`;
}
// Original user-authored Inkscape paths, imported as editable VECTOR source
// geometry. Both rail and river graphics are placed inside their canonical
// engine z-layers; these are visual centerlines, NOT certified hexside rules.
function sourceVectorPathsForBundle(board,bundle,kind,options={}){
 if(!bundle||options.showAuthoredSourceVectors===false)return '';
 const reg=bundle.registration||{}, sx=Number(reg.scaleX),sy=Number(reg.scaleY),tx=Number(reg.translateX),ty=Number(reg.translateY);
 if(![sx,sy,tx,ty].every(Number.isFinite)||sx<=0||sy<=0)return '';
 const tracks=kind==='railways'?bundle.railways:bundle.rivers;
 if(!Array.isArray(tracks))return '';
 const t=`translate(${tx.toFixed(6)} ${ty.toFixed(6)}) scale(${sx.toFixed(8)} ${sy.toFixed(8)})`;
 const mmPerPixel=2/(sx+sy);
 const useRibbon=kind==='rivers'&&!['legacy-stroke','source-exact-stroke'].includes(options.authoredRiverMode);
 const riverPolylines=useRibbon?tracks.map(item=>({id:item.id,points:authoredRiverPoints(item.d)})):[];
 const clipped=options.clipAuthoredSourceVectors!==false&&board.cells?.length>0;
 const clipId='authored-source-mask-'+String(board.id||'board').replace(/[^a-zA-Z0-9_-]/g,'');
 let out=clipped?`<g class="authored-vector-clipping" clip-path="url(#${clipId})">`:'';
 out+=`<g class="user-svg-vector-${kind}" data-vector-source="user-inkscape-svg" data-source-sha="${safe(bundle.sourceSvgSha256)}" ${useRibbon?'':'transform="'+t+'"'} pointer-events="none">`;
 for(const item of tracks){
  if(kind==='rivers' && board.hiddenSourceRiverSvgIds?.includes(item.id) && options.showOriginalRiverTrace!==true)continue;
  if(typeof item.d!=='string'||!/^[mMlLcChHvVqQsStTaAzZ0-9.,+\-\sEe]*$/.test(item.d))continue;
  const d=safe(item.d),id=safe(item.id);
  if(kind==='rivers'){
   if(useRibbon){
    const centerline=riverPolylines.find(p=>p.id===item.id);
    if(centerline?.points)out+=authoredRiverRibbon(item,centerline.points,riverPolylines.filter(p=>p.points),{scaleX:sx,scaleY:sy,translateX:tx,translateY:ty},options);
    // An unsupported path is deliberately skipped instead of silently drawn
    // as an inconsistent, fixed-width legacy stroke.
   }else{
    const major=item.kind==='majorRiver',sourceWidth=Number(options.sourceRiverStrokeWidth),stroke=(Number.isFinite(sourceWidth)&&sourceWidth>0?sourceWidth:(major?19.2:9.6))*mmPerPixel;
    const smooth=options.smoothAuthoredRivers===true?authoredRiverSmoothPath(item.d):null;
    const visibleD=safe(smooth||item.d);
    out+=`<path class="svg-authored-river" data-authored-path="${id}" data-feature-kind="${major?'majorRiver':'river'}" data-display-smoothing="${smooth?'cubic':'none'}" data-river-render-mode="${options.authoredRiverMode==='source-exact-stroke'?'source-exact-stroke':'legacy-stroke'}" d="${visibleD}" fill="none" stroke="#20719f" stroke-width="${stroke.toFixed(5)}" stroke-linecap="round" stroke-linejoin="round"/>`;
   }
  }else{
   out+=`<path class="svg-authored-rail-halo" data-authored-path="${id}" d="${d}" fill="none" stroke="#e8e5d6" stroke-width="${(4.5*mmPerPixel).toFixed(5)}" stroke-linecap="round" stroke-linejoin="round"/>`;
   out+=`<path class="svg-authored-rail" data-authored-path="${id}" d="${d}" fill="none" stroke="#182129" stroke-width="${(2.6*mmPerPixel).toFixed(5)}" stroke-linecap="round" stroke-linejoin="round"/>`;
   for(const seg of (item.ties||[])){
    if(!Array.isArray(seg)||seg.length!==2||seg.some(q=>!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(+v))))continue;
    out+=`<path class="svg-authored-rail-tie" d="M${seg[0][0]} ${seg[0][1]} L${seg[1][0]} ${seg[1][1]}" fill="none" stroke="#202b2d" stroke-width="${(1.4*mmPerPixel).toFixed(5)}" stroke-linecap="round"/>`;
   }
  }
 }
 return out+'</g>'+(clipped?'</g>':'');
}
function sourceVectorPaths(board,kind,options={}){
 if(options.showAuthoredSourceVectors===false || (kind==='railways' && Array.isArray(board.hexCenterRailConnections) && options.showOriginalRailTrace!==true))return '';
 const bundles=[board.authoredSourceVectors,...(board.additionalSourceVectors||[])].filter(Boolean);
 return bundles.map(bundle=>sourceVectorPathsForBundle(board,bundle,kind,options)).join('');
}

// The printed Odessa bitmap contains dark-blue river ink distinguishable
// from its purple sea. These are real, source-registered vector polygons
// derived once by scripts/extract-odessa-source-rivers.py, NEVER image-gen.
// The printable source and authored SVG paths remain unchanged and available
// in audit mode. River water uses the common layer beneath Coast/Lake.
function sourceBitmapRiverLayer(board,options={}){
 const data=board.sourceBitmapRiverInk;
 if(board.riverRenderingMode!=='source-bitmap-ink-vectors'||!data||options.showOriginalRiverTrace===true)return '';
 const components=Array.isArray(data.components)?data.components:[];
 const clipId='authored-source-mask-'+String(board.id||'board').replace(/[^a-zA-Z0-9_-]/g,'');
 let out=`<g class="source-registered-river-geometry" data-source="printed-odessa-bitmap" data-layer-mode="source-ink-vector-polygons" data-river-source-sha="${safe(data.sourceSHA256)}" clip-path="url(#${clipId})" pointer-events="none">`;
 for(const c of components){
  if(!Array.isArray(c.rings)||!c.rings.length)continue;
  const rings=c.rings.filter(r=>Array.isArray(r)&&r.length>=3&&r.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)));
  if(!rings.length)continue;
  const d=rings.map(r=>path(r)+' Z').join(' ');
  out+=`<path class="source-registered-river-fill feature-water" data-river-component="${safe(c.componentId)}" d="${d}" fill="#20719f" stroke="#165b80" stroke-width=".55" fill-rule="evenodd"/>`;
 }
 return out+'</g>';
}
function sharedBoundaryLayer(board,rx,ry,kind='features',options={}){
 const byId=new Map(board.cells.map(c=>[c.id,c]));
 let out=`<g class="${kind==='grid'?'hex-grid-overlay':'hexside-feature-overlay'}" pointer-events="none" data-layer="${kind==='grid'?'hex-grid':'rivers'}">`;
 const style=waterStyle(options),water=[],other=[];
 // Prefer the authored centerlines when available: legacy hexside candidates
 // and color-extracted scan contours would otherwise double-draw the rivers.
 const authoredVisible=!!(board.authoredSourceVectors?.rivers?.length)&&options.showAuthoredSourceVectors!==false;
 const suppressAdditionalRivers=authoredVisible&&options.showAdditionalSemanticRiverEdges!==true;
 // Use the unique physical edge geometry to keep all river joints exact,
 // including shared cell edges with a non-reciprocal source annotation.
 for(const edge of gridSegmentData(board,rx,ry)){
  const c=byId.get(edge.cellId),otherCell=byId.get(edge.neighborId),lay=normalizeLayer(c),dir=edge.dir;
  const d=path([edge.a,edge.b]);
  if(kind==='grid'){out+=line(d,'#5b6862',.95,'stroke-opacity=".58" class="grid-line"');continue;}
  const aFeatures=lay.edges[dir]||[],bFeatures=otherCell?normalizeLayer(otherCell).edges[OPP[dir]]||[]:[];
  const features=[...aFeatures,...bFeatures];
  const pick=features.find(f=>f.kind==='majorRiver')||features.find(f=>f.kind==='river');
  if(pick&&(!suppressAdditionalRivers||features.some(f=>f.forceRenderAboveAuthoredRivers===true))&&!(options.sourceVectorGeometryOnly&&board.authoredSourceVectors)){
   const color='#20719f',baseWidth=pick.kind==='majorRiver'?19.2:9.6;
   const drawWidth=baseWidth*style.scale*(pick.kind==='majorRiver'?style.majorRiverScale:1);
   if(style.amplitude===0&&style.taper===1){
    // Preserve legacy widths unless a visual major-river scale is requested.
    other.push(line(d,color,drawWidth,'class="feature-water"'));
   }else water.push({a:edge.a,b:edge.b,cellId:c.id,dir,width:drawWidth,color});
  }
  if(features.some(f=>f.kind==='border'))other.push(line(d,'#ba3946',2.3,'stroke-dasharray="5 4" class="feature-border"'));
  if(features.some(f=>f.kind==='impassable'))other.push(line(d,'#3a3436',2.4,'stroke-dasharray="2 3" class="feature-impassable"'));
 }
 out+=waterRibbons(water,options)+other.join('')+sourceBitmapRiverLayer(board,options);
 // Odessa's bitmap river mode only replaces the *extension's* authored river
 // display. The base Kiev SVG rivers must remain visible on the composite.
 if(board.riverRenderingMode==='source-bitmap-ink-vectors'&&options.showOriginalRiverTrace!==true){
  if(board.authoredSourceVectors)out+=sourceVectorPathsForBundle(board,board.authoredSourceVectors,'rivers',options);
 }else out+=sourceVectorPaths(board,'rivers',options);
 // Registered river reference: retains the printed river's pixel geometry and
 // is NOT a game-mechanics crossing graph. Used until source features are traced.
 if(options.sourceRiverArtwork){out+=`<image class="source-river-print-reference" data-source-derived-ink="river-candidate-not-rules" href="${safe(options.sourceRiverArtwork)}" x="0" y="0" width="${pt(options.width||1200)}" height="${pt(options.height||780)}" preserveAspectRatio="none"/>`;}
 // Image-color-derived river *areas*: a preliminary visual transcription of
 // the scanned map, not invented hexside movement/combat data. Add as visible
 // vector shapes over the tile artwork in layer 3.
 const showScannedRiverContours=options.showSourceRiverTraces===true||(!authoredVisible&&options.showSourceRiverTraces!==false);
 for(const trace of (!showScannedRiverContours||options.sourceRiverArtworkOnly)?[]:(board.sourceRiverTraces||[])){
  const rings=(trace.rings||[trace.points]).filter(q=>Array.isArray(q)&&q.length>=3&&q.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(+v))));
  if(!rings.length)continue;
  out+=`<path class="source-river-contour" data-trace-id="${safe(trace.id||'unknown')}" data-trace-provenance="${safe(trace.status||'source-color-derived-unreviewed')}" d="${rings.map(q=>path(q)+' Z').join(' ')}" fill="#20719f" fill-rule="evenodd"/>`;
 }
 return out+'</g>';
}
// Road+rail on one corridor are TWO adjacent routes, not two strokes on top of
// each other. A crossing's offset is defined in global map coordinates, so the
// rail from either adjacent cell reaches exactly the same shifted edge point.
// On a curve, a quadratic centre control keeps the separated track continuous.
const PARALLEL_RAIL_OFFSET=8.5;
function stableNormal(a,b){
 let dx=b[0]-a[0],dy=b[1]-a[1];
 if(dx<-.00001||(Math.abs(dx)<=.00001&&dy<0)){dx=-dx;dy=-dy;}
 const n=Math.hypot(dx,dy)||1;
 return [-dy/n,dx/n];
}
function routePlan(board,rx,ry,{railOffset=PARALLEL_RAIL_OFFSET*(rx/37.8),showProvisionalRails=true}={}){
 const plans=[],byId=new Map(board.cells.map(c=>[c.id,c]));
 for(const c of board.cells){
  const center=coord(c,board.geometry),lay=normalizeLayer(c);
  for(const kind of ['road','rail']){
   const dirs=DIRS.filter(d=>lay.edges[d].some(f=>f.kind===kind&&(kind!=='rail'||showProvisionalRails!==false||!String(f.status||'').includes('candidate-not-gameplay-v235'))));
   if(!dirs.length)continue;
   const ends=dirs.map(dir=>{
    const shared=kind==='rail'&&lay.edges[dir].some(f=>f.kind==='road');
    const ownMid=sideInfo(c,dir,rx,ry,board.geometry).mid;
    const other=byId.get(neighbor(c,dir,board.geometry));
    const partnerMid=other?sideInfo(other,OPP[dir],rx,ry,board.geometry).mid:null;
    // The SAME physical crossing point is used from both neighboring cells,
    // avoiding even tiny pixel-pitch discrepancies in the uploaded maps.
    const original=partnerMid?[(ownMid[0]+partnerMid[0])/2,(ownMid[1]+partnerMid[1])/2]:ownMid;
    const normal=shared?stableNormal(center,original):[0,0];
    return {dir,shared,original,point:[original[0]+normal[0]*railOffset,original[1]+normal[1]*railOffset],normal};
   });
   // The shared track's offset is tapered through mixed rail-only junctions.
   // If all edges have roads, the rail is parallel across the whole hex.
   const centerShift=ends.reduce((v,e)=>[v[0]+e.normal[0],v[1]+e.normal[1]],[0,0]);
   const anchor=[center[0]+centerShift[0]*railOffset/ends.length,center[1]+centerShift[1]*railOffset/ends.length];
   const segments=[];
   if(ends.length===1){segments.push({type:'line',p0:anchor,p1:ends[0].point});}
   else if(ends.length===2){segments.push({type:'quadratic',p0:ends[0].point,p1:anchor,p2:ends[1].point});}
   else for(const e of ends)segments.push({type:'line',p0:anchor,p1:e.point});
   plans.push({id:c.id,kind,ends,center:anchor,segments,sharedDirections:ends.filter(e=>e.shared).map(e=>e.dir)});
  }
 }
 return plans;
}
function segmentPath(s){
 const v=p=>`${pt(p[0])} ${pt(p[1])}`;
 return s.type==='line'?`M${v(s.p0)} L${v(s.p1)}`:`M${v(s.p0)} Q${v(s.p1)} ${v(s.p2)}`;
}
function sampleSegment(s,t){
 if(s.type==='line')return {p:[s.p0[0]*(1-t)+s.p1[0]*t,s.p0[1]*(1-t)+s.p1[1]*t],tangent:[s.p1[0]-s.p0[0],s.p1[1]-s.p0[1]]};
 const u=1-t;
 return {p:[u*u*s.p0[0]+2*u*t*s.p1[0]+t*t*s.p2[0],u*u*s.p0[1]+2*u*t*s.p1[1]+t*t*s.p2[1]],
  tangent:[2*u*(s.p1[0]-s.p0[0])+2*t*(s.p2[0]-s.p1[0]),2*u*(s.p1[1]-s.p0[1])+2*t*(s.p2[1]-s.p1[1])]};
}
// Railways use a single topology across historical boards: adjacent hex-center
// anchors, with optional explicitly sourced off-board stubs.  Each individual
// cubic Bezier span is a *clamped cubic B-spline* (end knot multiplicity four).
// Unlike an ordinary uniform B-spline that misses intermediate control points,
// this clamped formulation interpolates the authoritative hex centers exactly.
// At two-way junctions the tangent uses both neighboring centers, providing a
// smooth through-line; branches retain all individual links and do not invent
// connectivity. Curvature never changes gameplay adjacency.
function railSplineNetwork(board,options={}){
 const links=board.hexCenterRailConnections;
 if(!Array.isArray(links))return null;
 const byId=new Map(board.cells.map(c=>[c.id,c]));
 const adj=new Map(board.cells.map(c=>[c.id,new Set()]));
 const seen=new Set();
 for(const link of links){
  const a=byId.get(link.from),b=byId.get(link.to);
  if(!a||!b)throw Error('Rail anchor outside map '+link.from+' '+link.to);
  if(!DIRS.some(dir=>neighbor(a,dir,board.geometry)===b.id))throw Error('Nonadjacent rail anchor '+a.id+' '+b.id);
  const key=[a.id,b.id].sort().join(':');
  if(seen.has(key))throw Error('Duplicate rail anchor '+key);
  seen.add(key);adj.get(a.id).add(b.id);adj.get(b.id).add(a.id);
 }
 const settings=board.railwayPresentation||{};
 if(settings.anchor&&settings.anchor!=='hex-center')throw Error('Unsupported railway anchor '+settings.anchor);
 if(settings.interpolation&&settings.interpolation!=='clamped-cubic-b-spline')throw Error('Unsupported railway interpolation '+settings.interpolation);
 const tension=Number(options.railwaySplineTension??settings.splineTension??.30);
 if(!Number.isFinite(tension)||tension<0||tension>.45)throw Error('Railway spline tension out of range: '+tension);
 const spacing=Number(options.railwayTieSpacing??settings.tieSpacing??11);
 if(!Number.isFinite(spacing)||spacing<4||spacing>100)throw Error('Railway tie spacing out of range');
 const pos=id=>coord(byId.get(id),board.geometry);
 const unit=(v)=>{const length=Math.hypot(...v)||1;return [v[0]/length,v[1]/length]};
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
 const outgoing=(id,toward)=>{
  const p=pos(id),q=pos(toward),v=unit([q[0]-p[0],q[1]-p[1]]);
  const others=[...(adj.get(id)||[])].filter(x=>x!==toward);
  if(!others.length)return v;
  // For through tracks prefer the opposing neighbor. At a 3+ way junction,
  // ignore nearly perpendicular arms; do not splice two routes into one.
  let best=null,bestScore=-Infinity;
  for(const candidate of others){const r=pos(candidate),w=unit([r[0]-p[0],r[1]-p[1]]),score=-dot(v,w);
   if(score>bestScore){bestScore=score;best=r;}}
  if(others.length>1&&bestScore<.1)return v;
  const tangent=unit([q[0]-best[0],q[1]-best[1]]);
  return dot(tangent,v)<.05?v:tangent;
 };
 const cubic=(a,b,t0,t1)=>{
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),h=length*tension;
  return {p0:a,p1:[a[0]+t0[0]*h,a[1]+t0[1]*h],p2:[b[0]-t1[0]*h,b[1]-t1[1]*h],p3:b};
 };
 const segments=[];
 for(const link of links){
  const a=pos(link.from),b=pos(link.to);
  const t0=outgoing(link.from,link.to),towardStart=outgoing(link.to,link.from);
  segments.push({...cubic(a,b,t0,[-towardStart[0],-towardStart[1]]),from:link.from,to:link.to,status:link.status||'unspecified',boundary:false});
 }
 // Off-board exits are explicit exceptions, not invented off-map hexes. Their
 // rail lines end on the exported map boundary at the canonical hexside mid.
 for(const exit of board.railwayBoundaryExits||[]){
  const cell=byId.get(exit.from);
  if(!cell||!DIRS.includes(exit.dir))throw Error('Invalid railway boundary exit '+JSON.stringify(exit));
  if(byId.has(neighbor(cell,exit.dir,board.geometry)))throw Error('Rail exit not on map boundary '+exit.from+':'+exit.dir);
  const [rx,ry]=gridRadii(board.geometry,options.rx,options.ry);
  const a=coord(cell,board.geometry),b=sideInfo(cell,exit.dir,rx,ry,board.geometry).mid;
  const d=unit([b[0]-a[0],b[1]-a[1]]);
  segments.push({...cubic(a,b,d,d),from:exit.from,to:null,status:exit.status||'source-map-exit',boundary:true,dir:exit.dir});
 }
 return {segments,linkCount:links.length,exitCount:(board.railwayBoundaryExits||[]).length,tension,tieSpacing:spacing};
}
function railSplineSample(seg,t){
 const u=1-t, {p0:a,p1:b,p2:c,p3:d}=seg;
 return {p:[u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]],
 tangent:[3*u*u*(b[0]-a[0])+6*u*t*(c[0]-b[0])+3*t*t*(d[0]-c[0]),3*u*u*(b[1]-a[1])+6*u*t*(c[1]-b[1])+3*t*t*(d[1]-c[1])]};
}
function railSplinePath(s){return `M${pt(s.p0[0])},${pt(s.p0[1])} C${pt(s.p1[0])},${pt(s.p1[1])} ${pt(s.p2[0])},${pt(s.p2[1])} ${pt(s.p3[0])},${pt(s.p3[1])}`;}
// Shared exact grid-snap railway geometry. Every link visits the precise
// hex-center -> common hexside midpoint -> next hex-center, with no spline.
// This is a presentation graph; no gameplay rail links are inferred.
function hexFaceRailLayer(board,options={}){
 const cells=new Map(board.cells.map(c=>[c.id,c]));
 const [rx,ry]=gridRadii(board.geometry,options.rx,options.ry);
 const segments=[];const keys=new Set();
 for(const edge of board.hexCenterRailConnections||[]){
  const a=cells.get(edge.from),b=cells.get(edge.to);
  if(!a||!b)throw Error('Rail link references unknown cell');
  const direction=DIRS.find(dir=>neighbor(a,dir,board.geometry)===b.id);
  if(!direction)throw Error('Rail link is not between adjacent cells: '+a.id+'/'+b.id);
  const key=[a.id,b.id].sort().join(':');
  if(keys.has(key))throw Error('Duplicate rail link '+key);keys.add(key);
  const centerA=coord(a,board.geometry),centerB=coord(b,board.geometry);
  const midA=sideInfo(a,direction,rx,ry,board.geometry).mid;
  const midB=sideInfo(b,OPP[direction],rx,ry,board.geometry).mid;
  const midpoint=[(midA[0]+midB[0])/2,(midA[1]+midB[1])/2];
  if(Math.hypot(midA[0]-midB[0],midA[1]-midB[1])>2.5)
   throw Error('Railway faces fail to coincide '+key);
  segments.push({from:a.id,to:b.id,dir:direction,points:[centerA,midpoint,centerB]});
 }
 for(const exit of board.railwayBoundaryExits||[]){
  const c=cells.get(exit.from);if(!c||!DIRS.includes(exit.dir))throw Error('Invalid railway exit');
  if(cells.has(neighbor(c,exit.dir,board.geometry)))throw Error('Railway exit is not on map boundary');
  segments.push({from:c.id,dir:exit.dir,points:[coord(c,board.geometry),sideInfo(c,exit.dir,rx,ry,board.geometry).mid]});
 }
 let halos='',tracks='',ties='';
 for(const seg of segments){
  const pts=seg.points;
  const attr=`data-rail-from="${safe(seg.from)}" ${seg.to?`data-rail-to="${safe(seg.to)}"`:`data-rail-exit-dir="${safe(seg.dir)}"`} data-rail-geometry="hex-face-midpoint"`;
  const d=path(pts);
  halos+=line(d,'#ede4ce',4.0,`class="grid-face-rail-halo" ${attr}`);
  tracks+=line(d,'#151d22',2.7,`class="grid-face-rail" ${attr}`);
  let travelled=0;
  const spacing=Number(options.railwayTieSpacing||11);
  let target=spacing*.5;
  for(let i=0;i<pts.length-1;i++){
   const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
   if(length<.01)continue;
   while(target<travelled+length-.01){
    const f=(target-travelled)/length,x=a[0]+dx*f,y=a[1]+dy*f;
    const nx=-dy/length,ny=dx/length;
    ties+=line(`M${pt(x-nx*3.4)},${pt(y-ny*3.4)} L${pt(x+nx*3.4)},${pt(y+ny*3.4)}`,'#343736',1.45,`class="grid-face-rail-tie" ${attr}`);
    target+=spacing;
   }
   travelled+=length;
  }
 }
 return `<g class="hex-center-rail-network grid-face-rail-network" data-rail-geometry="hex-face-midpoint" data-rail-link-count="${(board.hexCenterRailConnections||[]).length}" data-rail-boundary-exits="${(board.railwayBoundaryExits||[]).length}" pointer-events="none">${halos}${tracks}${ties}</g>`;
}
function hexCenterRailLayer(board,options={}){
 const network=railSplineNetwork(board,options);
 if(!network)return '';
 let halos='',rails='',ties='';
 for(const s of network.segments){
  const d=railSplinePath(s);
  const at=`data-rail-from="${safe(s.from)}" ${s.to?`data-rail-to="${safe(s.to)}"`:`data-rail-exit-dir="${safe(s.dir)}"`} data-rail-anchor="hex-center" data-rail-interpolation="clamped-cubic-b-spline" data-rail-source="${safe(s.status)}"`;
  halos+=line(d,'#ede4ce',4.0,`class="hex-center-rail-halo" ${at}`);
  rails+=line(d,'#151d22',2.7,`class="hex-center-rail" ${at}`);
  const length=Array.from({length:12},(_,i)=>i/12).reduce((total,t)=>{const a=railSplineSample(s,t).p,b=railSplineSample(s,t+1/12).p;return total+Math.hypot(a[0]-b[0],a[1]-b[1]);},0);
  const count=Math.max(2,Math.round(length/network.tieSpacing));
  for(let i=1;i<count;i++){
   const {p,tangent}=railSplineSample(s,i/count),l=Math.hypot(...tangent)||1;
   const nx=-tangent[1]/l,ny=tangent[0]/l;
   ties+=line(`M${pt(p[0]-nx*3.4)} ${pt(p[1]-ny*3.4)} L${pt(p[0]+nx*3.4)} ${pt(p[1]+ny*3.4)}`,'#343736',1.5,`class="hex-center-rail-tie" ${at}`);
  }
 }
 return `<g class="hex-center-rail-network" data-rail-link-count="${network.linkCount}" data-rail-boundary-exits="${network.exitCount}" data-rail-anchor-mode="hex-center" data-rail-interpolation="clamped-cubic-b-spline" pointer-events="none">${halos}${rails}${ties}</g>`;
}

// 2.68: exact user-SVG railway path routing.  These are the SVG author's
// individual railway curves in calibrated map coordinates.  Snap *nearby*
// canonical hex centers without replacing the authored path by a reconstructed
// graph of independent straight/curved cell-to-cell edges.  Connectivity
// remains the separate hexCenterRailConnections game-data candidate graph.
function sourceRailSplinePath(points){
 if(!Array.isArray(points)||points.length<2)return '';
 const len=v=>Math.hypot(v[0],v[1]);
 const f=n=>pt(n);
 let d=`M${f(points[0][0])},${f(points[0][1])}`;
 for(let i=0;i<points.length-1;i++){
  const a=points[Math.max(0,i-1)],p=points[i],q=points[i+1],b=points[Math.min(points.length-1,i+2)];
  const mag=len([q[0]-p[0],q[1]-p[1]]);
  const v0=i===0?[q[0]-p[0],q[1]-p[1]]:[(q[0]-a[0])*.5,(q[1]-a[1])*.5];
  const v1=i===points.length-2?[q[0]-p[0],q[1]-p[1]]:[(b[0]-p[0])*.5,(b[1]-p[1])*.5];
  const clamp=v=>{const l=len(v),factor=l>0?Math.min(1,mag*.82/l)/3:0;return [v[0]*factor,v[1]*factor]};
  const [t0,t1]=[clamp(v0),clamp(v1)];
  d+=` C${f(p[0]+t0[0])},${f(p[1]+t0[1])} ${f(q[0]-t1[0])},${f(q[1]-t1[1])} ${f(q[0])},${f(q[1])}`;
 }
 return d;
}
// Source paths are the visual routing reference; the configured graph specifies
// *exact* common center anchors.  Earlier releases reported center anchors in
// metadata but never used them to draw the authored paths, leaving separate
// paths visibly disconnected inside hexes.  This registration applies only to
// COPY points for rendering; no source artwork or logical rail edges mutate.
function sourceRailNearest(points,target){
 let along=0,best=null;
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,l=Math.sqrt(l2);
  const frac=l2?Math.max(0,Math.min(1,((target[0]-a[0])*dx+(target[1]-a[1])*dy)/l2)):0;
  const q=[a[0]+frac*dx,a[1]+frac*dy],distance=Math.hypot(q[0]-target[0],q[1]-target[1]);
  if(!best||distance<best.distance)best={distance,point:q,along:along+frac*l,segment:i,frac};
  along+=l;
 }
 return best;
}
function registeredSourceRailRoutes(board,options={}){
 const routes=board.sourceRailRoutes||[];
 if(!routes.length)return [];
 // Standalone crop of an already registered composite: preserve its exact
 // engine-rendered rail vertices. Re-snapping against a smaller cropped
 // railway graph otherwise changes the visual shape of shared routes.
 if(board.preRegisteredRailGeometry===true)return routes.map(route=>({...route,points:route.points.map(p=>p.slice())}));
 // Exact author-specified hex-center anchors are authoritative on source-registered
 // railway maps. Keep all source vertices, displace only the neighboring portion
 // of each authored route, and pin the named anchor index exactly to its host
 // hex center. This does not invent connectivity or rewrite playable rail edges.
 if(board.railwayPresentation?.explicitSourceAnchorSnap){
  const byId=new Map((board.cells||[]).map(c=>[c.id,c]));
  const maxDistance=Number(board.railwayPresentation.maximumSourceAnchorDeviationPx??26);
  return routes.map(route=>{
   const original=route.points.map(p=>p.slice());
   const anchors=(route.anchors||[]).filter(a=>Number.isInteger(a.index));
   if(!anchors.length)throw Error('Rail path has no authored hex-center anchors: '+route.sourceSvgId);
   const cumulative=[0];for(let i=1;i<original.length;i++)cumulative.push(cumulative[i-1]+Math.hypot(original[i][0]-original[i-1][0],original[i][1]-original[i-1][1]));
   const corrections=anchors.map(a=>{
    const cell=byId.get(a.hex);
    if(!cell||a.index<0||a.index>=original.length)throw Error('Invalid rail source anchor '+route.sourceSvgId+'/'+a.hex);
    const center=coord(cell,board.geometry),p=original[a.index],deviation=Math.hypot(center[0]-p[0],center[1]-p[1]);
    if(deviation>maxDistance)throw Error('Rail source anchor exceeds source tolerance '+route.sourceSvgId+'/'+a.hex+': '+deviation);
    return {index:a.index,hex:a.hex,center,at:cumulative[a.index],dx:center[0]-p[0],dy:center[1]-p[1],deviation};
   });
   const points=original.map((p,i)=>{
    const closest=corrections.find(a=>a.index===i);
    if(closest)return closest.center.slice();
    let dx=0,dy=0,sum=0;
    for(const a of corrections){const delta=Math.abs(cumulative[i]-a.at),w=Math.exp(-.5*(delta/21)**2);dx+=w*a.dx;dy+=w*a.dy;sum+=w;}
    const norm=Math.max(1,sum);
    return [p[0]+dx/norm,p[1]+dy/norm];
   });
   return {...route,points,junctionRegistration:corrections.map(a=>a.hex),junctionSnapDistances:corrections.map(a=>a.deviation),sourceAnchorsExact:true};
  });
 }
 const settings=board.railwayPresentation||{};
 const radius=Number(options.railwayJunctionSnapRadius??settings.junctionSnapRadius??32);
 if(!Number.isFinite(radius)||radius<1||radius>40)throw Error('Railway junction snap radius invalid: '+radius);
 const cells=board.cells||[],byId=new Map(cells.map(c=>[c.id,c]));
 const adjacency=new Map(cells.map(c=>[c.id,new Set()]));
 for(const link of (board.hexCenterRailConnections||[])){
  if(!byId.has(link.from)||!byId.has(link.to))throw Error('Railway junction uses unknown hex');
  adjacency.get(link.from).add(link.to);adjacency.get(link.to).add(link.from);
 }
 const routeOverrides=new Map();
 for(const correction of board.bitmapRailCorrections?.routes||[]){
  const i=correction.sourceRouteIndex;
  if(!Number.isInteger(i)||i<0||i>=routes.length||routes[i].sourceSvgId!==correction.sourceSvgId)
   throw Error('Bitmap railway override route identity mismatch');
  if(!Array.isArray(correction.points)||correction.points.length<2)throw Error('Invalid bitmap railway override');
  routeOverrides.set(i,correction);
 }
 const prepared=routes.map((route,i)=>({route,
  points:routeOverrides.has(i)?routeOverrides.get(i).points.map(p=>p.slice()):route.points,
  bitmapOverride:routeOverrides.get(i)||null,attachments:[],endpoints:[]}));
 // Only centers that logically host a railway can become shared junctions.
 // At a junction every qualifying authored path is deflected smoothly into
 // the same point, including paths with an internal (rather than end) pass.
 for(const [id,neighbors] of adjacency){
  if(!neighbors.size)continue;
  const point=coord(byId.get(id),board.geometry);
  // Bitmap-registered routes already have an explicit, independently audited
  // ordered center-chain. Never magnetically snap them to *other* nearby hexes.
  // That was the root cause of the cumulative phantom Odessa railways.
  const near=prepared.map((r,i)=>r.bitmapOverride?.strictHexAnchorTopology?null:({i,...sourceRailNearest(r.points,point)}))
   .filter(x=>x && x.distance<=radius);
  if(!near.length)continue;
  // An isolated end of one track needs registration only when the source
  // actual endpoint is close.  A multi-track or through station is always
  // a common center anchor, even if one line runs offset by source inking.
  for(const hit of near){
   const r=prepared[hit.i],last=r.points.length-1;
   const endpoint=(hit.segment===0&&hit.frac<.08)||(hit.segment===last-1&&hit.frac>.92);
   if(neighbors.size>=2||near.length>=2||endpoint){
    const exactVertex=r.points.some(q=>Math.hypot(q[0]-point[0],q[1]-point[1])<.75);
    if(!exactVertex)r.attachments.push({hex:id,center:point,at:hit.along,offset:[point[0]-hit.point[0],point[1]-hit.point[1]],distance:hit.distance});
    else r.endpoints.push(id);
   }
  }
 }
 // When a traced railway really terminates within a playable hex center,
 // close its last few pixels even if the legacy graph omitted that terminal.
 // This is a presentation-only closure; absent graph links are audited instead
 // of being silently invented by this geometry routine.
 for(const r of prepared){
  if(r.bitmapOverride?.strictHexAnchorTopology)continue;
  for(const end of [0,r.points.length-1]){
   const p=r.points[end];let best=null;
   for(const c of cells){const center=coord(c,board.geometry),d=Math.hypot(p[0]-center[0],p[1]-center[1]);
    if(d<=19&&(!best||d<best.d))best={id:c.id,center,d};}
   if(!best||best.d<=.75)continue;
   const at=end===0?0:r.points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-r.points[i][0],p[1]-r.points[i][1]),0);
   if(!r.attachments.some(a=>Math.abs(a.at-at)<7))r.attachments.push({hex:best.id,center:best.center,at,offset:[best.center[0]-p[0],best.center[1]-p[1]],distance:best.d,terminal:true});
  }
 }
 const out=[];
 for(const r of prepared){
  const original=r.points;if(!Array.isArray(original)||original.length<2)continue;
  if(r.bitmapOverride?.strictHexAnchorTopology){
   // Canonical center-to-center route already checked against the bitmap.
   // No heuristic path deformation or segment insertion may change it.
   out.push({...r.route,points:original.map(p=>p.slice()),
    bitmapRailAnchorIds:r.bitmapOverride.hexAnchors,
    junctionRegistration:r.bitmapOverride.hexAnchors.slice(),junctionSnapDistances:[]});
   continue;
  }
  const cumulative=[0];for(let i=1;i<original.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(original[i][0]-original[i-1][0],original[i][1]-original[i-1][1]));
  // Source paths sometimes touch the same hex more than once.  Keep the
  // closest encounter if two registrations land within 12 route units.
  const selected=[];
  for(const a of r.attachments.sort((x,y)=>x.distance-y.distance)){
   if(selected.every(b=>Math.abs(a.at-b.at)>12))selected.push(a);
  }
  selected.sort((a,b)=>a.at-b.at);
  const moved=original.map((p,i)=>{
   let sx=0,sy=0,sum=0;
   for(const a of selected){const delta=Math.abs(cumulative[i]-a.at),w=Math.exp(-.5*(delta/25)**2);
    sx+=w*a.offset[0];sy+=w*a.offset[1];sum+=w;}
   const norm=Math.max(1,sum);
   let q=[p[0]+sx/norm,p[1]+sy/norm];
   // Existing exact center vertices must remain exact after nearby warps.
   const existing=Array.from(adjacency).find(([id,n])=>n.size&&Math.hypot(...coord(byId.get(id),board.geometry).map((v,j)=>v-p[j]))<.75);
   if(existing)q=coord(byId.get(existing[0]),board.geometry);
   return q;
  });
  const insertions=[];
  for(const a of selected){
   if(a.at<.5){moved[0]=a.center.slice();continue;}
   if(a.at>cumulative.at(-1)-.5){moved[moved.length-1]=a.center.slice();continue;}
   const at=cumulative.findIndex(s=>s>=a.at);
   if(at<1)continue;
   if(Math.abs(cumulative[at]-a.at)<.5){moved[at]=a.center.slice();continue;}
   if(Math.abs(cumulative[at-1]-a.at)<.5){moved[at-1]=a.center.slice();continue;}
   insertions.push({before:at,center:a.center});
  }
  for(const a of insertions.sort((a,b)=>b.before-a.before))moved.splice(a.before,0,a.center.slice());
  out.push({...r.route,points:moved,bitmapRailAnchorIds:r.bitmapOverride?.hexAnchors||null,junctionRegistration:selected.map(a=>a.hex),junctionSnapDistances:selected.map(a=>a.distance)});
 }
 return out;
}
function sourceRailPathLayer(board,options={}){
 const routes=board.sourceRailRoutes;
 if(!Array.isArray(routes)||routes.length===0)return '';
 const allHex=board.cells||[],[rx,ry]=gridRadii(board.geometry,options.rx,options.ry);
 const [minx,miny,maxx,maxy]=allHex.reduce((b,c)=>{const p=coord(c,board.geometry);return [Math.min(b[0],p[0]-rx),Math.min(b[1],p[1]-ry),Math.max(b[2],p[0]+rx),Math.max(b[3],p[1]+ry)];},[Infinity,Infinity,-Infinity,-Infinity]);
 const id='authored-tracks-'+String(board.id||'board').replace(/[^a-zA-Z0-9_-]/g,'');
 const boardMask='authored-source-mask-'+String(board.id||'board').replace(/[^a-zA-Z0-9_-]/g,'');
 let out=`<g class="authored-rail-to-map-edge" clip-path="url(#${boardMask})"><g class="hex-center-rail-network authored-source-rail-network" data-rail-geometry="source-svg" data-authored-path-count="${routes.length}" data-rail-link-count="${(board.hexCenterRailConnections||[]).length}" data-rail-boundary-exits="${(board.railwayBoundaryExits||[]).length}" data-rail-anchor-mode="hex-center" data-rail-interpolation="clamped-cubic-b-spline" pointer-events="none">`;
 // Don't extend beyond actual board footprint; originally authored off-map
 // exits reach the perimeter, whereas stray paths should not float outside.
 let h='',r='',t='';
 for(const [routeIndex,route] of registeredSourceRailRoutes(board,options).entries()){
  if(board.hiddenSourceRailRouteIndices?.includes(routeIndex) && options.showOriginalRailTrace!==true)continue;
  const points=route.points;if(!Array.isArray(points)||points.length<2)continue;
  const d=board.authoritativeRailPolylineGeometry?('M'+points.map(p=>pt(p[0])+','+pt(p[1])).join(' L')):sourceRailSplinePath(points),attr=`data-source-rail-path="${safe(route.sourceSvgId)}" data-source-rail-sha="${safe((route.sourceSvgSha256||'').slice(0,12))}" data-center-anchors="${(route.anchors||[]).length}" data-registered-junctions="${safe((route.junctionRegistration||[]).join(","))}"`;
  h+=line(d,'#ede4ce',4.0,`class="authored-center-rail-halo" ${attr}`);
  r+=line(d,'#151d22',2.7,`class="authored-center-rail" ${attr}`);
  // Sleepers follow the actual authored spline, not the old invented graph.
  // Use each cubic span's control points to place normal-aligned ties.
  let travelled=0,target=(Number(options.railwayTieSpacing)||11)*.5;
  for(let i=0;i<points.length-1;i++){
   const p=points[i],q=points[i+1],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+2)];
   const span=Math.hypot(q[0]-p[0],q[1]-p[1]);
   if(span<.15)continue;
   // At the configured size the source's native sampling is sufficiently
   // fine to compute sleeper normals directly along the local chord.
   const dx=(q[0]-p[0])/span,dy=(q[1]-p[1])/span;
   while(target<travelled+span){
    const f=(target-travelled)/span,x=p[0]+f*(q[0]-p[0]),y=p[1]+f*(q[1]-p[1]);
    t+=line(`M${pt(x+dy*3.4)},${pt(y-dx*3.4)} L${pt(x-dy*3.4)},${pt(y+dx*3.4)}`,'#333736',1.45,`class="authored-center-rail-tie" ${attr}`);
    target+=Number(options.railwayTieSpacing)||11;
   }
   travelled+=span;
  }
 }
 // The source railways are the authority for their overall shape, but a
 // published composite map can reveal a missing continuation between two
 // individually-authored SVG routes.  Explicitly audited connectors bridge
 // those two canonical hex-center anchors, using the shared clamped-cubic
 // spline network for identical geometry and sleeper styling.  This is a
 // local, sourced map-data correction, not permission to infer connections
 // for other hexes or to mutate either SVG path.
 let extraHalo='',extraTrack='',extraTies='';
 const bridges=(board.hexCenterRailConnections||[]).filter(link=>link.renderConnector===true);
 // Source rail tracks already reach most of the perimeter. Only exits marked
 // renderConnector need an additional visible center-to-hexside continuation.
 // Ordinary exit metadata must NOT draw a duplicate track over authored art.
 const missingExitStubs=(board.railwayBoundaryExits||[]).filter(exit=>exit.renderConnector===true);
 if(bridges.length||missingExitStubs.length){
  const permitted=new Set(bridges.map(link=>[link.from,link.to].sort().join(':')));
  const explicitExits=new Set(missingExitStubs.map(exit=>exit.from+':'+exit.dir));
  const network=railSplineNetwork(board,options);
  let drawn=0;
  for(const segment of network.segments){
   const isExit=!segment.to;
   const key=isExit?segment.from+':'+segment.dir:[segment.from,segment.to].sort().join(':');
   if(!(isExit?explicitExits:permitted).has(key))continue;
   let visibleSegment=segment;
   if(!isExit){
    const requested=bridges.find(link=>[link.from,link.to].sort().join(':')===key);
    const fraction=requested?.terminalFraction;
    if(fraction!==undefined){
     if(!(fraction>.15&&fraction<1))throw Error('Invalid railway termination fraction');
     const lerp=(a,b)=>a.map((v,i)=>v+(b[i]-v)*fraction);
     const a=lerp(segment.p0,segment.p1),b=lerp(segment.p1,segment.p2),c=lerp(segment.p2,segment.p3);
     const d0=lerp(a,b),d1=lerp(b,c),end=lerp(d0,d1);
     visibleSegment={...segment,p1:a,p2:d0,p3:end};
    }
   }
   // Optional center-to-center monotone cubic for sensitive shore-adjacent links.
   // Keeps exact hex-center anchors but prevents the shared tangent solver from
   // looping into the sea between 1812 and 1913.
   const direct=(!isExit && bridges.find(link=>[link.from,link.to].sort().join(':')===key)?.renderStyle==='straight-cubic');
   if(direct){
    const p0=visibleSegment.p0,p3=visibleSegment.p3;
    const lerp=t=>[p0[0]+(p3[0]-p0[0])*t,p0[1]+(p3[1]-p0[1])*t];
    visibleSegment={...visibleSegment,p1:lerp(1/3),p2:lerp(2/3)};
   }
   const d=railSplinePath(visibleSegment);
   const attr=isExit
    ?`class="authored-center-rail-exit-connector" data-rail-from="${safe(segment.from)}" data-rail-exit-dir="${safe(segment.dir)}" data-rail-interpolation="clamped-cubic-b-spline" data-source="printed-map-railway-exit"`
    :`class="authored-center-rail-connector" data-rail-from="${safe(segment.from)}" data-rail-to="${safe(segment.to)}" data-rail-interpolation="clamped-cubic-b-spline" data-source="scan-confirmed-composite-rail-continuation"`;
   extraHalo+=line(d,'#ede4ce',4.0,attr);
   extraTrack+=line(d,'#151d22',2.7,attr);
   const distance=Math.hypot(visibleSegment.p3[0]-visibleSegment.p0[0],visibleSegment.p3[1]-visibleSegment.p0[1]);
   const ties=Math.max(2,Math.round(distance/network.tieSpacing));
   for(let j=1;j<ties;j++){
    const {p,tangent}=railSplineSample(visibleSegment,j/ties);
    const l=Math.hypot(...tangent)||1,nx=-tangent[1]/l,ny=tangent[0]/l;
    extraTies+=line(`M${pt(p[0]-nx*3.4)},${pt(p[1]-ny*3.4)} L${pt(p[0]+nx*3.4)},${pt(p[1]+ny*3.4)}`,'#333736',1.45,attr);
   }
   drawn++;
  }
  if(drawn!==bridges.length+missingExitStubs.length)throw Error('Unrendered source railway continuation or exterior exit');
 }
 // Explicit rail-to-port terminus: the print places Odessa's port at the
 // land/sea interface of 1513 and 1514. This short visible section does NOT
 // create rail movement through a coastal water hex or toward 1613.
 let portHalo='',portTracks='',portTies='';
 for(const term of board.railwayCoastalTerminals||[]){
  const from=allHex.find(c=>c.id===term.from),to=allHex.find(c=>c.id===term.toward);
  if(!from||!to)throw Error('Rail port terminus references unknown hex');
  const adjacent=Object.values(DIRS).some(dir=>neighbor(from,dir,board.geometry)===to.id);
  if(!adjacent)throw Error('Rail port terminus requires an adjacent coastal hex');
  const frac=Number(term.stopAtFraction??.5);
  if(!(frac>=.35&&frac<=.65))throw Error('Port stop must lie on shared coastal hexside');
  const start=coord(from,board.geometry),end=coord(to,board.geometry);
  const p=[start[0]+(end[0]-start[0])*frac,start[1]+(end[1]-start[1])*frac];
  const d=sourceRailSplinePath([start,p]);
  const attr=`class="authored-coastal-rail-terminal" data-rail-port-from="${safe(term.from)}" data-rail-port-toward="${safe(term.toward)}" data-rail-visual-only="true"`;
  portHalo+=line(d,'#ede4ce',4.0,attr);
  portTracks+=line(d,'#151d22',2.7,attr);
  const length=Math.hypot(p[0]-start[0],p[1]-start[1]);
  for(let offset=6;offset<length-3;offset+=11){
   const f=offset/length,x=start[0]+(p[0]-start[0])*f,y=start[1]+(p[1]-start[1])*f;
   const nx=-(p[1]-start[1])/length,ny=(p[0]-start[0])/length;
   portTies+=line(`M${pt(x-nx*3.4)},${pt(y-ny*3.4)} L${pt(x+nx*3.4)},${pt(y+ny*3.4)}`,'#333736',1.45,attr);
  }
 }
 // Rendered curves, not the display-only adjacency reconstruction.
 return out+h+extraHalo+portHalo+r+extraTrack+portTracks+t+extraTies+portTies+'</g></g>';
}
// Keep the authored SVG shoreline as the sole geometric authority.  The sea
// lies on the RIGHT of the directed Leningrad path.  A water-colored band
// seaward of that boundary is invisible on a water-colored Sea hex; the
// *visible* wavelets must instead intrude slightly landward.  This profile is
// continuous along the entire path, with sample spacing locked to its source
// vertices, and never introduces a separate per-hexside coastline.
function sourcePathCoastWavelet(route,board,options={}){
 const pts=route.points;
 if(!Array.isArray(pts)||pts.length<2)return '';
 const seed=finiteSeed(options.waterSeed,finiteSeed(board.waterSeed));
 const amplitude=Number.isFinite(+options.seaShoreAmplitude)?Math.max(0,+options.seaShoreAmplitude):4;
 const depth=Number.isFinite(+options.seaFringeDepth)?Math.max(0,+options.seaFringeDepth):14.4;
 const count=Number.isInteger(options.shoreSegmentsPerSide)?options.shoreSegmentsPerSide:5;
 const waterFill=safe(svgColor(options.waterColor||'#30b9bfff'));
 const reference=[],landward=[];
 // The source path is oriented with Sea to its right; the left normal faces
 // land. Use the SAME seededShoreSideSamples() displacement and variable-depth
 // envelope as the registered hexside renderer, not a second sine function.
 for(let k=0;k<pts.length-1;k++){
  const a=pts[k],b=pts[k+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<.001)continue;
  const normal=[-dy/length,dx/length];
  const samples=seededShoreSideSamples(a,b,normal,{seed,amplitude,bodyId:'source-coast',edgeId:String(route.sourceSvgId||'')+'|'+k,segmentsPerSide:count});
  const hash=waterHash(seed,'coast-depth-'+String(route.sourceSvgId||'')+'|'+k);
  const phase=2*Math.PI*(hash%65521)/65521;
  for(let j=0;j<samples.length;j++){
   // Suppress the repeated shared corner; both segments resolve the same point.
   if(k>0&&j===0)continue;
   const t=j/(samples.length-1),window=Math.sin(Math.PI*t)**2;
   const modulation=.84+.25*window*Math.sin(2*Math.PI*t*.82+phase);
   const width=depth*Math.max(.57,modulation);
   const q=samples[j];
   reference.push([a[0]+dx*t,a[1]+dy*t]);
   landward.push([q[0]+normal[0]*width,q[1]+normal[1]*width]);
  }
 }
 if(reference.length<2)return '';
 // The fixed SVG path is the SEA boundary; the water-colored ribbon extends
 // across its landward side, so wavelets change actual visible land/water pixels.
 const d=path([...reference,...landward.reverse()])+' Z';
 const id=safe(route.sourceSvgId||'');
 return `<path class="source-coast-connected-wavelet-fringe" data-source-water-path="${id}" data-water-kind="coast" data-coast-source-vertices="${pts.length}" data-coast-wavelet-samples="${reference.length}" data-coast-reference="exact-svg-polyline" data-coast-render-source="sourceWaterRoutes-only" data-wavelet-algorithm="shared-seeded-shore-side-samples" data-wavelet-direction="landward" d="${d}" fill="${waterFill}" stroke="none"/>`;
}

// Source-defined coastline/lake centerlines.  Preserve all source SVG paths,
// including Odessa path61, rather than replacing their topology with a small
// set of hexside candidates.  A seeded, width-varying ribbon produces natural
// water fringes *around* the source centerline without moving the centerline.
function sourceWaterRouteLayer(board,options={}){
 const routes=board.sourceWaterRoutes;
 if(!Array.isArray(routes)||!routes.length)return '';
 // Exact author-drawn lake paths are visually distinct from Coast and River.
 // Do not turn these open paths into invented water polygons, and do not use
 // spline interpolation which would displace the original geometry.
 if((board.sourceLakeRenderingMode==='exact-source-paths'||['exact-source-paths','source-path-coast-wavelets'].includes(board.sourceCoastRenderingMode))&&options.showSourceCoastAudit!==true){
  let out='<g class="source-authored-water" data-water-mode="exact-source-polyline" pointer-events="none">';
  for(const route of routes){
   const kind=route.kind;
   if(kind!=='lake'&&kind!=='coast')continue;
   if(kind==='lake'&&board.sourceLakeRenderingMode!=='exact-source-paths')continue;
   if(kind==='coast'&&!['exact-source-paths','source-path-coast-wavelets'].includes(board.sourceCoastRenderingMode))continue;
   if(!Array.isArray(route.points)||route.points.length<2)continue;
   const width=Number(kind==='lake'?(board.sourceLakeStrokeWidth??20):(board.sourceCoastStrokeWidth??20));
   if(!Number.isFinite(width)||width<=0||width>60)throw Error('Invalid authored '+kind+' stroke width');
   const color=kind==='lake'?(board.sourceLakeColor||'#209eb1'):(board.sourceCoastColor||'#209eb1');
   if(kind==='coast'&&board.sourceCoastRenderingMode==='source-path-coast-wavelets'){
    // Source path is the sole Coast geometry authority. Never paint a second
    // thick centerline or any registered-hexside Coast bands over this fringe.
    out+=sourcePathCoastWavelet(route,board,options);
    continue;
   }
   out+=line(path(route.points),color,pt(width),`class="source-authored-${kind}" data-source-water-path="${safe(route.sourceSvgId)}" data-water-kind="${kind}" data-water-vertex-count="${route.points.length}"`);
  }
  return out+'</g>';
 }
 if(board.waterRenderingMode==='hexside-wavelets'&&options.showSourceCoastAudit!==true)return '';
 if(board.sourceWaterScanContours?.polygons?.length){
  // Audit only: all source coast SVG paths are in the configuration and can
  // be toggled on to compare with the independent printed water-area mask.
  if(options.showSourceCoastAudit!==true)return '';
  return `<g class="source-coast-audit" data-provenance="original-user-svg-coast-lake-paths" pointer-events="none">`+
   routes.map(route=>line(sourceRailSplinePath(route.points),'#ffc300',2.4,
    `class="source-coast-authored-path" data-source-water-path="${safe(route.sourceSvgId)}"`)).join('')+'</g>';
 }

 const seed=finiteSeed(options.waterSeed,finiteSeed(board.waterSeed));
 let out='<g class="source-authored-water-routes" data-water-mode="source-svg-waterlines-with-variable-depth" pointer-events="none">';
 const color=safe(svgColor(options.waterColor||'#4688b4'));
 for(const route of routes){
  const pts=route.points;
  if(!Array.isArray(pts)||pts.length<2)continue;
  const isLake=route.kind==='lake',base=isLake?14.4:18.5;
  const key=String(route.sourceSvgId||''),hash=waterHash(seed,key),phase=2*Math.PI*(hash%65521)/65521;
  let total=0,left=[],right=[];
  for(let i=0;i<pts.length;i++){
   const p=pts[i],before=pts[Math.max(0,i-1)],after=pts[Math.min(pts.length-1,i+1)];
   const dx=after[0]-before[0],dy=after[1]-before[1],mag=Math.hypot(dx,dy)||1;
   const nx=-dy/mag,ny=dx/mag;
   if(i>0)total+=Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1]);
   const amplitude=isLake?1.1:2.25;
   const width=base/2+amplitude*(.55*Math.sin(total/29+phase)+.30*Math.sin(total/11+phase*.7));
   left.push([p[0]+nx*width,p[1]+ny*width]);
   right.push([p[0]-nx*width,p[1]-ny*width]);
  }
  const id=safe(route.sourceSvgId),d=path([...left,...right.reverse()])+' Z';
  out+=`<path class="source-water-variable-depth" data-source-water-path="${id}" data-water-kind="${isLake?'lake':'coast'}" data-original-centerline="retained" data-water-depth="${pt(base)}" d="${d}" fill="${color}" fill-opacity=".90"/>`;
  out+=line(sourceRailSplinePath(pts),'#275a80',1.6,`class="source-water-centerline" data-source-water-path="${id}" data-water-kind="${isLake?'lake':'coast'}"`);
 }
 return out+'</g>';
}

// Source-vector reinforcement trace is for provenance comparison only. The
// visible 10px line stays on the canonical exterior edge on layer zero.
function sourceReinforcementAuditLayer(board,options={}){
 if(!options.showSourceReinforcementAudit)return '';
 let out='<g data-layer="source-reinforcement-audit" data-provenance-only="true" pointer-events="none">';
 for(const item of (board.authoredReinforcementTraces||[])){
  if(!Array.isArray(item.points)||item.points.length<2)continue;
  out+=line(path(item.points),item.side==='german'?'#08004c':'#fa2d1f',2.4,
   `class="source-reinforcement-audit" data-source-id="${safe(item.sourceSvgId||'')}" stroke-dasharray="5 5"`);
 }
 return out+'</g>';
}
function routeLayer(board,rx,ry,options={}){
 const plans=board.authoritativeSourceGeometry?[]:(options.sourceVectorGeometryOnly&&board.authoredSourceVectors)?[]:routePlan(board,rx,ry,options).filter(plan=>!(plan.kind==='rail'&&Array.isArray(board.hexCenterRailConnections)));
 let roadShadows='',roads='',railHalos='',rails='',ties='',roadTerminals='',railTerminals='';
 for(const r of plans){
  for(const segment of r.segments){
   const d=segmentPath(segment);
   if(r.kind==='road'){
    roadShadows+=line(d,'#73573e',5.3,'stroke-opacity=".56" class="route-road-shadow"');
    roads+=line(d,'#c6a478',3.9,'class="route-road"');
   }else{
    const attrs=`data-route-cell="${safe(r.id)}" data-shared-edges="${r.sharedDirections.length}"`;
    railHalos+=line(d,'#ede4ce',3.6,`stroke-opacity=".87" class="route-rail-halo" ${attrs}`);
    rails+=line(d,'#151d22',2.7,`class="route-rail" ${attrs}`);
    // Follow the rendered rail, including an offset or bend. The old radial
    // ties stayed on the unshifted centreline and obscured adjacent roads.
    const length=segment.type==='line'?Math.hypot(segment.p1[0]-segment.p0[0],segment.p1[1]-segment.p0[1]):
     [0,.25,.5,.75].reduce((sum,t)=>{const a=sampleSegment(segment,t).p,b=sampleSegment(segment,t+.25).p;return sum+Math.hypot(b[0]-a[0],b[1]-a[1]);},0);
    const count=Math.max(1,Math.floor(length/11));
    for(let i=0;i<count;i++){
     const {p,tangent}=sampleSegment(segment,(i+.5)/count),l=Math.hypot(...tangent)||1;
     const nx=-tangent[1]/l,ny=tangent[0]/l;
     ties+=line(`M${pt(p[0]-nx*3.3)} ${pt(p[1]-ny*3.3)} L${pt(p[0]+nx*3.3)} ${pt(p[1]+ny*3.3)}`,'#343736',1.45,'class="rail-tie"');
    }
   }
  }
  if(r.ends.length===1){const color=r.kind==='road'?'#c6a478':'#20282a';if(r.kind==='road')roadTerminals+=`<circle cx="${pt(r.center[0])}" cy="${pt(r.center[1])}" r="${r.kind==='rail'?2.4:2.9}" fill="${color}" class="route-terminal"/>`;else railTerminals+=`<circle cx="${pt(r.center[0])}" cy="${pt(r.center[1])}" r="2.4" fill="${color}" class="route-terminal"/>`;}
 }
 const referenceRail=options.sourceRailArtwork?`<image class="source-rail-print-reference" data-source-derived-ink="railway-candidate-not-rules" href="${safe(options.sourceRailArtwork)}" x="0" y="0" width="${pt(options.width||1200)}" height="${pt(options.height||780)}" opacity=".85" preserveAspectRatio="none"/>`:'';
 return `<g class="route-overlay" pointer-events="none"><g data-layer="roads" data-route="road">${roadShadows}${roads}${roadTerminals}</g><g data-layer="railways" data-route="rail">${railHalos}${rails}${ties}${railTerminals}${referenceRail}${board.railwayPresentation?.geometry==='center-face-center'?hexFaceRailLayer(board,{...options,rx,ry}):(board.sourceRailRoutes?.length?sourceRailPathLayer(board,{...options,rx,ry}):hexCenterRailLayer(board,{...options,rx,ry}))}${sourceVectorPaths(board,'railways',options)}</g></g>`;
}

// Single universal reinforcement perimeter renderer (z=3.75, above water). Source tracing selects borders;
// hex geometry supplies the actual exterior segments. Strokes are offset OUTSIDE
// the tiles by half the stroke width so opaque terrain does not obscure 50% of
// the 10px reinforcement line. No map-specific SVG stroke scaling is allowed.
function entryBoundaryLayer(board,rx,ry,options={}){
 const segments=gridSegmentData(board,rx,ry).filter(s=>!s.neighborId);
 const byKey=new Map(segments.map(s=>[s.cellId+':'+s.dir,s]));
 const byCell=new Map(board.cells.map(c=>[c.id,c]));
 const paths=[];
 if(Array.isArray(board.compositeEntryEdges)){
  const seen=new Set();
  for(const entry of board.compositeEntryEdges){
   const key=entry.cellId+':'+entry.dir;
   if(seen.has(key))continue;seen.add(key);
   const seg=byKey.get(key);
   if(!seg)throw Error('Composite reinforcement not exterior: '+key);
   paths.push({side:entry.side,segments:[{...seg,reverse:false}]});
  }
 }else if(Array.isArray(board.entryBoundarySelections?.paths)&&board.entryBoundarySelections.paths.length){
  for(const route of board.entryBoundarySelections.paths){
   const chain=[];
   for(const step of route.edges||[]){
    const key=step.cellId+':'+step.dir,seg=byKey.get(key);
    if(!seg)throw Error('Reinforcement not exterior: '+key);
    chain.push({...seg,reverse:!!step.reverse});
   }
   if(chain.length)paths.push({side:route.side,segments:chain});
  }
 }else{
  for(const seg of segments){
   const c=byCell.get(seg.cellId);
   const marked=options.showCandidateEntryEdges===false?null:c?.entryEdgeTags?.[seg.dir];
   const tags=c?.entryTags||[];
   const side=marked||(tags.includes('soviet')?'soviet':tags.includes('german')?'german':null);
   if(side)paths.push({side,segments:[{...seg,reverse:false}]});
  }
 }
 // Join individually sourced exterior sides into continuous runs, using the
 // same miter logic for Moscow, Kiev, Leningrad, Arduous and the composite.
 // A disconnected run remains distinct. Never join across faction colors.
 const bySide={german:[],soviet:[]};
 for(const route of paths){const side=route.side==='soviet'?'soviet':'german';
  for(const seg of route.segments){const a=seg.reverse?seg.b:seg.a,b=seg.reverse?seg.a:seg.b;
   bySide[side].push({...seg,a,b,reverse:false});}
 }
 const key=v=>`${Math.round(v[0]*10)/10},${Math.round(v[1]*10)/10}`;
 const grouped=[];
 for(const side of ['german','soviet']){
  const edges=bySide[side],byEnd=new Map();
  for(let i=0;i<edges.length;i++)for(const xy of [edges[i].a,edges[i].b]){
   const k=key(xy);if(!byEnd.has(k))byEnd.set(k,[]);byEnd.get(k).push(i);
  }
  const used=new Set();
  for(let s=0;s<edges.length;s++){
   if(used.has(s))continue;
   const source=edges[s];
   let startKey=key(source.a),endKey=key(source.b);
   if((byEnd.get(endKey)||[]).length===1 && (byEnd.get(startKey)||[]).length>1){
    startKey=endKey;
   }
   const chain=[],seen=new Set();
   let cursor=startKey;
   while(true){
    const next=(byEnd.get(cursor)||[]).find(i=>!used.has(i));
    if(next===undefined)break;
    used.add(next);
    const edge=edges[next],reverse=key(edge.b)===cursor;
    chain.push({...edge,reverse});
    cursor=key(reverse?edge.a:edge.b);
    if(cursor===startKey)break;
   }
   if(chain.length)grouped.push({side,segments:chain});
  }
 }
 let out=`<g class="entry-edge-overlay" data-layer="entry-edges" data-layer-order="0" data-stroke-offset="exterior-overlap" pointer-events="none" style="display:${options.showEntryEdges===false?'none':'inline'}">`;
 for(const route of grouped){
  const faction=route.side==='soviet'?'soviet':'german';
  const spec=FACTIONS.reinforcements[faction],width=spec.width;
  const shifted=route.segments.map(seg=>{
   const center=coord(byCell.get(seg.cellId),board.geometry);
   const mid=[(seg.a[0]+seg.b[0])/2,(seg.a[1]+seg.b[1])/2];
   const dir=[mid[0]-center[0],mid[1]-center[1]];
   const len=Math.hypot(...dir)||1;
   // A small inward overlap avoids exposed white background between tile
   // geometry and the layer-zero reinforcement stroke (Arduous regression).
   const offsetFraction=Number.isFinite(+options.entryBorderExteriorOffsetFraction)
    ?Math.max(0,Math.min(.5,+options.entryBorderExteriorOffsetFraction)):.14;
   const off=[dir[0]/len*width*offsetFraction,dir[1]/len*width*offsetFraction];
   const a=seg.reverse?seg.b:seg.a,b=seg.reverse?seg.a:seg.b;
   return {a:[a[0]+off[0],a[1]+off[1]],b:[b[0]+off[0],b[1]+off[1]],rawA:a,rawB:b,cell:seg.cellId};
  });
  // Offset paths share mitered joins at common exterior vertices.
  // Disconnected source sections remain separate and are not fabricated.
  let run=[];
  const flush=()=>{
   if(!run.length)return;
   const pts=[run[0].a];
   for(let i=1;i<run.length;i++){
    const u=run[i-1],v=run[i];
    const x=u.b[0]-u.a[0],y=u.b[1]-u.a[1];
    const xx=v.b[0]-v.a[0],yy=v.b[1]-v.a[1];
    const den=x*yy-y*xx;
    if(Math.abs(den)>1e-6){
     const dx=v.a[0]-u.a[0],dy=v.a[1]-u.a[1];
     const t=(dx*yy-dy*xx)/den;
     const meet=[u.a[0]+t*x,u.a[1]+t*y];
     if(Math.hypot(meet[0]-u.b[0],meet[1]-u.b[1])<width*2)pts.push(meet);
     else pts.push(u.b,v.a);
    }else pts.push([(u.b[0]+v.a[0])/2,(u.b[1]+v.a[1])/2]);
   }
   pts.push(run[run.length-1].b);
   out+=line(path(pts),spec.color,width,`class="entry-boundary entry-${faction} normalized-entry-boundary" data-entry-side="${faction}" data-border-visible-width="${pt(width)}" data-border-segments="${run.length}" vector-effect="non-scaling-stroke"`);
   run=[];
  };
  for(const seg of shifted){
   if(run.length && Math.hypot(run[run.length-1].rawB[0]-seg.rawA[0],run[run.length-1].rawB[1]-seg.rawA[1])>1){flush();}
   run.push(seg);
  }
  flush();
 }
 return out+'</g>';
}
function fixedSetupGlyph(kind,faction="soviet"){
 if(kind==='fixedCavalry'){
  // Exact symbol12 geometry from the user-supplied Odessa SVG: red cavalry
  // deployment rectangle with a single diagonal. Do not replace with a star.
  return `<svg class="official-soviet-cavalry-deployment" data-symbol-library-id="symbol12" x="-9.4" y="-6.1" width="18.8" height="12.2" viewBox="133.43 95.91 7.60 4.72" overflow="visible"><rect x="133.55817" y="95.981216" width="7.3232141" height="4.5566669" fill="#c83b45"/><rect x="133.55817" y="95.981216" width="7.3232141" height="4.5566669" fill="#c83b45"/><path d="m 133.51025,100.42674 7.27087,-4.407732" fill="none" stroke="#000000" stroke-width="0.529167"/></svg>`;
 }
 // Compact NATO-style symbols: infantry X; mechanized infantry X plus track oval.
 // Actual source SVG placement is supplied as sourcePixelCenter in the scenario.
 const x=`<path d="M-7 -4 L7 4 M7 -4 L-7 4" fill="none" stroke="#232b2a" stroke-width="1.25" stroke-linecap="round"/>`;
 const track=kind==='fixedMechanized'?`<rect x="-5.4" y="-3.4" width="10.8" height="6.8" rx="3.2" ry="3.2" fill="none" stroke="#232b2a" stroke-width="1.05"/>`:'';
 const unitType=kind==='fixedInfantry'?(faction==='german'?'infantryCorps':'infantryArmy'):'mechanizedCorps';
 return `<g class="fixed-setup-symbol" data-faction="${safe(faction)}" data-unit-type="${unitType}"><rect x="-9.2" y="-6" width="18.4" height="12" rx="0.6" fill="${faction==='german'?'#92989d':'#c83b45'}" stroke="#fff" stroke-opacity="0.5" stroke-width="2.0"/>${x}${track}</g>`;
}
function deploymentGlyph(kind){
 // White exterior knock-out is deliberately strong over forest, rivers,
 // fortifications, and rail tracks. Rendered LAST per required layer order.
 const cross='M-9 -3.2 H-3.2 V-9 H3.2 V-3.2 H9 V3.2 H3.2 V9 H-3.2 V3.2 H-9 Z';
 const star='M0 -9 L2.4 -3 L9 -3 L4 1.5 L5.6 9 L0 4.8 L-5.6 9 L-4 1.5 L-9 -3 L-2.4 -3 Z';
 // Authoritative German deployment symbol122 from odessa-map-temp(6).svg.
 // Preserve both original path geometries and fills. Same shared renderer on every map.
 if(kind==='cross')return `<rect class="german-deployment-backplate" x="-10" y="-10" width="20" height="20" fill="#ffffff" fill-opacity=".5"/><svg class="official-german-deployment" data-symbol-library-id="symbol122" x="-9.25" y="-9.25" width="18.5" height="18.5" viewBox="60.75 1.18 7.4 7.5" overflow="visible"><path data-source-svg-path="path121" d="m 63.167721,1.7130737 v 0.038757 h -0.714686 v 1.16427 h -1.172021 v 0.6816121 0.1328084 2.7285157 0.1307413 0.6816122 h 1.172021 v 1.1663371 h 0.714686 v 0.038757 h 2.91455 0.07803 0.736389 V 7.3044637 h 1.163753 V 6.4977946 h -0.01344 v -2.806547 h 0.01344 V 2.8830282 H 66.896692 V 1.7130737 h -0.736389 -0.07803 z" fill="#ffffff" fill-opacity="0.24283"/><path data-source-svg-path="path122" d="m 63.432821,1.9771403 v 1.885673 h -1.88619 v 2.4628988 h 1.88619 v 1.8861898 h 2.462898 V 6.3257121 h 1.88619 V 3.8628133 h -1.88619 v -1.885673 z m 2.913517,0 V 3.427181 h 1.450041 V 3.1481283 h -1.165304 v -1.170988 z m -3.628719,0.038757 V 3.1812009 H 61.546631 V 3.465938 h 1.450041 V 2.0158976 Z M 61.546631,6.7231038 V 7.007841 h 1.170988 v 1.1653035 h 0.279053 V 6.7231038 Z m 4.799707,0.038757 v 1.4500407 h 0.284737 v -1.170988 h 1.165304 V 6.7618612 Z" fill="#08004c" fill-opacity=".68"/></svg>`;
 if(kind==='star')return `<path class="deployment-halo" d="${star}" fill="#c83b45" stroke="#ffffff" stroke-opacity="0.5" stroke-width="4.1" stroke-linejoin="round" paint-order="stroke fill"/><path class="deployment-ink" d="${star}" fill="none" stroke="#7d3034" stroke-width=".85" stroke-linejoin="round"/>`;
 return markerGlyph(kind);
}
function markerGlyph(k){
 if(k==='city'||k==='majorCity')return k==='majorCity'?'<circle r="9" fill="#eee4c6" stroke="#454c42" stroke-width="1.4"/><path d="M-5 4 V-3 L0 -7 L5 -3 V4 Z M-2 -2 V4 M2 -2 V4" fill="#737970" stroke="#434941" stroke-width=".7"/>':'<circle r="6.5" fill="#ece3cb" stroke="#444b46" stroke-width="1.1"/><path d="M-3 3 V-2 L0 -4 L3 -2 V3 Z" fill="#66766c"/>';
 if(k==='fortification')return '<path d="M-8 7 V-7 H-4 V-4 H0 V-7 H4 V-4 H8 V7 Z" fill="#999d92" stroke="#373d3b" stroke-width="1.2"/>';
 if(k==='star')return '<path d="M0 -9 L2.2 -3 L9 -3 L3.7 1 L5.2 7 L0 3.5 L-5.2 7 L-3.7 1 L-9 -3 L-2.2 -3 Z" fill="#c83b45" stroke="#6b3335" stroke-width=".8"/>';
 if(k==='cross')return '<path d="M-7 -2.5 H-2.5 V-7 H2.5 V-2.5 H7 V2.5 H2.5 V7 H-2.5 V2.5 H-7 Z" fill="#303b3c"/>';
 if(k==='port')return '<path d="M0 -9 V5 M-5 -2 H5 M-9 2 Q0 12 9 2 M-2 -7 A2 2 0 1 0 2 -7" stroke="#245b73" stroke-width="2.1" fill="none"/>';
 if(k==='airfield')return '<path d="M0 -11 L2 -2 L10 2 V5 L2 3 L1 8 L4 10 V12 L0 10 L-4 12 V10 L-1 8 L-2 3 L-10 5 V2 L-2 -2 Z" fill="#465259"/>';
 if(k==='objective')return '<circle r="8" stroke="#c79330" stroke-width="2.5" fill="none"/><circle r="2" fill="#c79330"/>';
 if(k==='bridge')return '<path d="M-8 5 V-5 M8 5 V-5 M-8 1 H8 M-5 -5 Q0 -11 5 -5" stroke="#8e6c44" stroke-width="1.9" fill="none"/>';
 if(k==='depot')return '<rect x="-7" y="-7" width="14" height="14" fill="#d5ac62" stroke="#554b39"/><path d="M-4 0 H4 M0 -4 V4" stroke="#554b39"/>';
 return '';
}
function markerSvg(markers){
 // One primary city, remaining glyphs occupy separate supporting slots.
 const major=markers.find(m=>m.kind==='majorCity'||m.kind==='city');
 const others=markers.filter(m=>m!==major);
 const positioned=[];
 if(major)positioned.push({m:major,x:0,y:-7});
 const slots=major?[[19,-5],[-19,-5],[17,12],[-17,12]]:markers.length===1?[[0,0]]:[[-14,-5],[14,-5],[-14,11],[14,11],[0,-12]];
 for(const [i,m] of others.entries()){
  const [x,y]=slots[i%slots.length];positioned.push({m,x,y});
 }
 let out='';
 for(const {m,x,y} of positioned)out+=`<g class="overlay-marker marker-${safe(m.kind)}" transform="translate(${pt(x)} ${pt(y)})" data-marker-kind="${safe(m.kind)}">${markerGlyph(m.kind)}</g>`;
 if(major?.label){const width=Math.min(62,Math.max(28,String(major.label).length*5.2+8));out+=`<rect x="${pt(-width/2)}" y="12" width="${pt(width)}" height="14" rx="3" fill="#e9e9d6" fill-opacity=".91"/><text class="city-label" x="0" y="22" text-anchor="middle" font-size="9.5" fill="#1b2928" font-weight="700">${safe(major.label)}</text>`;}
 return out;
}
// Source SVG city locations are provenance only. Printed hex ownership is
// encoded in the scenario, and every city symbol/label uses the canonical
// engine hex center. Rendering must never silently use an off-center SVG use.
function cityRenderPosition(city,mapped,rx,ry,options={}){
 const original=Array.isArray(city?.visualCenter)?city.visualCenter:
  Array.isArray(city?.sourceSvgVisualCenter)?city.sourceSvgVisualCenter:mapped;
 return {position:mapped,fallback:false,authored:original};
}
function svgMap(board,options={}){
 // All campaigns, including source-configured Kiev–Odessa, use the SAME renderer.
 if(options.deploymentMarkerOverrides!==undefined){
  if(!options.deploymentMarkerOverrides||typeof options.deploymentMarkerOverrides!=='object'||Array.isArray(options.deploymentMarkerOverrides))
   throw Error('Invalid deployment marker override configuration');
  const cells=new Set(board.cells.map(c=>c.id));
  for(const id of Object.keys(options.deploymentMarkerOverrides))if(!cells.has(id))
   throw Error('Unrecognized deployment override cell '+id);
 }
 const p=options.palette?{...PALETTES.generic,...options.palette,lake:options.palette.lake||options.palette.water,sea:options.palette.sea||options.palette.water}:PALETTES.generic;
 const imgPrefix=options.imagePrefix||'',textures=options.textures||{};
 // Seamless bitmap textures use one board-coordinate pattern, not separate
 // copies restarted at each hex. The ordinary terrain system is unchanged.
 const seamlessTextureSizes=options.seamlessTerrainTextureSizes||{};
 const seamlessPatterns={};
 for(const [kind,size] of Object.entries(seamlessTextureSizes)){
  if(!TERRAIN.includes(kind)||!Number.isFinite(size)||size<8||size>4096)
   throw Error('Invalid seamless terrain texture size '+kind);
  if(textures[kind]&&board.cells.some(c=>normalizeLayer(c).base===kind))seamlessPatterns[kind]='terrain-seamless-'+String(options.id||board.id).replace(/[^a-zA-Z0-9_-]/g,'')+'-'+kind;
 }
 const [rx,ry]=gridRadii(board.geometry,options.rx,options.ry);
 const points=hexPoints(rx,ry).map(q=>q.map(pt).join(',')).join(' '),clipId='hex-clip-'+(String(options.id||board.id).replace(/[^a-zA-Z0-9_-]/g,''));
 const w=Number(options.width)||1200,h=Number(options.height)||780;
 // Presentation frame expands the SVG viewBox rather than shifting logical
 // coordinates, preserving legacy game hit-testing and overlay registration.
 const padding=Math.max(0,Number(options.padding)||0);
 const viewBox=`${pt(-padding)} ${pt(-padding)} ${pt(w+2*padding)} ${pt(h+2*padding)}`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}" role="img" aria-label="Composited hex terrain map: ${safe(board.sourceGame||board.id)}" class="hex-tile-map" style="user-select:none;-webkit-user-select:none"><defs><clipPath id="${clipId}"><polygon points="${points}"/></clipPath><pattern id="tile-unknown" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#e9e7df"/><path d="M-2 8 L8 -2 M2 10 L10 2" stroke="#9eaaa7" stroke-width="1"/></pattern>`;
 if(board.authoredSourceVectors){const boardClipId='authored-source-mask-'+String(board.id||'board').replace(/[^a-zA-Z0-9_-]/g,'');
  svg+=`<clipPath id="${boardClipId}" clipPathUnits="userSpaceOnUse">`;
  for(const c of board.cells){const [cx,cy]=coord(c,board.geometry),pts=hexPoints(rx,ry).map(([x,y])=>`${pt(cx+x)},${pt(cy+y)}`).join(' ');svg+=`<polygon points="${pts}"/>`;}
  svg+='</clipPath>';
 }
 // Define a single reusable image per terrain type. SVG <use> places the
 // original pixel artwork at exactly the same per-hex rectangle as <image>
 // (including alpha at its corners), without changing its proportions.
 // Object-bounding-box <pattern> units distorted the raster in some viewers.
 if(options.reuseTerrainTextures){
  for(const [kind,href] of Object.entries(textures)){
   if(!TERRAIN.includes(kind)||typeof href!=='string'||!href)continue;
   // A seamless texture is painted through one board-anchored pattern; do not
   // also embed a hidden per-hex sprite (or an unused sprite on maps without it).
   if(Object.hasOwn(seamlessTextureSizes,kind))continue;
   const spriteId='terrain-sprite-'+String(options.id||board.id).replace(/[^a-zA-Z0-9_-]/g,'')+'-'+kind;
   svg+=`<image id="${safe(spriteId)}" href="${safe(imgPrefix+href)}" x="0" y="0" width="${pt(rx*2)}" height="${pt(ry*2)}" preserveAspectRatio="${options.tileFit==='stretch'?'none':'xMidYMid slice'}"/>`;
  }
 }
 // Patterns are defined in board coordinates; their phase must not restart
 // when a cell is translated. The source bitmap is embedded or linked unchanged.
 for(const [kind,patternId] of Object.entries(seamlessPatterns)){
  const size=seamlessTextureSizes[kind];
  svg+=`<pattern id="${safe(patternId)}" patternUnits="userSpaceOnUse" x="0" y="0" width="${pt(size)}" height="${pt(size)}"><image href="${safe(imgPrefix+textures[kind])}" x="0" y="0" width="${pt(size)}" height="${pt(size)}" preserveAspectRatio="none"/></pattern>`;
 }
 if(options.cityBorderOutsideGrid){
  // Both the shadow and city yellow outlines must stay on dry playable cells.
  // Coasts are hexsides (not a separate terrain type), so cut their water
  // corridors out as well as excluding complete Sea cells.
  const dryCells=board.cells.filter(c=>c.terrain!=='sea');
  svg+=`<clipPath id="${clipId}-forest-footprint" clipPathUnits="userSpaceOnUse">`;
  for(const c of dryCells){const [cx,cy]=coord(c,board.geometry);svg+=`<polygon points="${hexPoints(rx,ry).map(([x,y])=>`${pt(cx+x)},${pt(cy+y)}`).join(' ')}"/>`;}
  svg+='</clipPath>';
  const coastSideKeys=new Set();
  for(const c of board.cells){for(const [dir,features] of Object.entries(normalizeLayer(c).edges)){
   if(features.some(f=>f.kind==='coast'))coastSideKeys.add(c.id+':'+dir);
  }}
  for(const e of board.authoredShoreHexsides||[]){if(e.kind==='coast')coastSideKeys.add(e.cellId+':'+e.dir);}
  svg+=`<mask id="${clipId}-dry-coast-mask" maskUnits="userSpaceOnUse" x="${pt(-padding)}" y="${pt(-padding)}" width="${pt(w+2*padding)}" height="${pt(h+2*padding)}"><rect x="${pt(-padding)}" y="${pt(-padding)}" width="${pt(w+2*padding)}" height="${pt(h+2*padding)}" fill="white"/>`;
  const byCell=new Map(board.cells.map(c=>[c.id,c]));
  for(const key of coastSideKeys){const [id,dir]=key.split(':'),c=byCell.get(id);
   if(!c||!DIRS.includes(dir))continue;
   const side=sideInfo(c,dir,rx,ry,board.geometry);
   svg+=line(path([side.a,side.b]),'#000000',Math.max(18,Number(options.seaFringeDepth||14.4)*2),`class="coast-land-exclusion" data-coast-exclusion="${safe(key)}"`);
  }
  svg+='</mask>';
 }
 // A coast cannot paint over an existing reinforcement perimeter. Derive
 // the knockout from the *same* rendered boundary geometry, not a parallel
 // hand-authored path or a newly introduced visible upper border layer.
 const reinforcementSvg=entryBoundaryLayer(board,rx,ry,options);
 svg+=`<mask id="${clipId}-shore-under-reinforcements" maskUnits="userSpaceOnUse" x="${pt(-padding)}" y="${pt(-padding)}" width="${pt(w+2*padding)}" height="${pt(h+2*padding)}"><rect x="${pt(-padding)}" y="${pt(-padding)}" width="${pt(w+2*padding)}" height="${pt(h+2*padding)}" fill="white"/>`;
 if(options.showEntryEdges!==false){
  const boundaryPattern=/<path d="([^"]+)"[^>]*class="entry-boundary [^"]*"[^>]*data-border-visible-width="([^"]+)"[^>]*\/>/g;
  for(const match of reinforcementSvg.matchAll(boundaryPattern)){
   const knockWidth=Math.max(1,Number(match[2])+1.5);
   svg+=`<path class="reinforcement-water-knockout" d="${match[1]}" fill="none" stroke="#000" stroke-width="${pt(knockWidth)}" stroke-linejoin="miter" stroke-linecap="butt"/>`;
  }
 }
 svg+='</mask>';
 svg+='</defs>';
 if(options.sourceUnderlay)svg+=`<image href="${safe(options.sourceUnderlay)}" x="0" y="0" width="${w}" height="${h}" opacity="${options.sourceInspection?1:.87}"/>`;
 else svg+=`<rect x="${pt(-padding)}" y="${pt(-padding)}" width="${pt(w+2*padding)}" height="${pt(h+2*padding)}" fill="${safe(board.sourceBackgroundColor||(padding?'#fff':'#d2d7cd'))}"/>`;
 // 0. Reinforcement lines are beneath terrain, sharing the exact tile perimeter.
 svg+=reinforcementSvg;
 // City ground and yellow borders stay below forest tile artwork when enabled.
 function majorCityGroundLayer(){let out=''; // Opaque major-objective ground replaces Open texture. Does not modify terrain rules.
 if(options.majorCityGrayHex){
  out+='<g class="major-city-ground-layer" data-layer="major-city-ground" pointer-events="none">';
  const majorNames=new Set(['kiev','odessa']);
  for(const c of board.cells){const city=normalizeLayer(c).markers.find(m=>m.kind==='city'||m.kind==='majorCity');
   if(!city||!(city.kind==='majorCity'||majorNames.has(String(city.label||'').trim().toLowerCase())))continue;
   const [cx,cy]=coord(c,board.geometry),poly=hexPoints(rx,ry).map(([x,y])=>`${pt(cx+x)},${pt(cy+y)}`).join(' ');
   out+=`<polygon class="major-city-gray-hex" data-major-city-hex="${safe(c.id)}" points="${poly}" fill="#ccc" stroke="none"/>`;
  }
  out+='</g>';
 }
return out;}
 function cityBorderMarkup(id,cx,cy,rx,ry){
 // City dots use the exact hex grid outline; no additional solid city border.
 // The ordinary hex grid remains separate and is not modified here.
 const vertices=hexPoints(rx,ry).map(([x,y])=>[cx+x,cy+y]);
 const dotRadius=pt((Number(options.cityBorderWidth)||4.5)/2);
 let out='';
 const addDot=(x,y,role)=>{out+=`<circle class="city-hex-highlight" data-city-hex="${safe(id)}" data-city-dot-role="${role}" cx="${pt(x)}" cy="${pt(y)}" r="${dotRadius}" fill="#000000" stroke="none"/>`;};
 for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length];
  const lerp=(t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  addDot(a[0],a[1],'vertex');
  {const [x,y]=lerp(.25);addDot(x,y,'quarter');}
  {const [x,y]=lerp(.5);addDot(x,y,'midpoint');}
  {const [x,y]=lerp(.75);addDot(x,y,'quarter');}
 }
 return out;
}
 function cityHexBorderLayer(){let out=''; if(options.cityBorderOutsideGrid){
 // 2.5. City-hex emphasis: actual city markers determine membership.
 // Separate editable vector art stays above the entry boundaries and below deployment;
 // its transparent interior leaves terrain/rail/river/hex number untouched.
 out+=`<g class="city-hex-highlight-layer" data-layer="city-hex-highlights" data-layer-order="2.5" clip-path="url(#${clipId}-forest-footprint)" mask="url(#${clipId}-dry-coast-mask)" pointer-events="none" style="display:${options.showCityHexHighlights===false?'none':'inline'}">`;
 for(const c of board.cells){
  if(options.sourceInspection)continue;
  const hasCity=normalizeLayer(c).markers.some(m=>m.kind==='city'||m.kind==='majorCity');
  if(!hasCity)continue;
  const [cx,cy]=coord(c,board.geometry);
  if(options.cityHexArtwork){
   out+=`<image class="city-hex-highlight" data-city-hex="${safe(c.id)}" href="${safe(options.cityHexArtwork)}" x="${pt(cx-rx)}" y="${pt(cy-ry)}" width="${pt(rx*2)}" height="${pt(ry*2)}" preserveAspectRatio="none"/>`;
  }else{
   // Self-contained fallback for other games without the optional artwork file.
   const cityBorderW=Number(options.cityBorderWidth)||4.5;
   // Expand the six corners so the INSIDE edge of the wider border coincides
   // with the canonical grid hex (rather than shrinking its playable area).
   const delta=options.cityBorderOutsideGrid?cityBorderW/2:0;
   const radiusX=options.cityBorderOutsideGrid?rx+delta*2/Math.sqrt(3):rx*.93;
   const radiusY=options.cityBorderOutsideGrid?ry+delta*2/Math.sqrt(3):ry*.93;
   out+=cityBorderMarkup(c.id,cx,cy,radiusX,radiusY);
  }
 }
 out+='</g>';

 }
return out;}
 // 1. Terrain images, unchanged authentic tile pixels.
 // Reinforcement paths are deliberately emitted AFTER rivers and Coast/Lake,
 // on canonical layer 3.75, so shore and river water cannot cover the border.
 svg+='<g class="terrain-base-layer" data-layer="terrain">';
 // Existing terrain imagery remains the sole tile implementation. Composite presentation
 // draws Open / other first, Swamp second, and Forest last.
 // Forest has no shadow or separate outline effect.
 const orderedTerrain=options.forestLayering
  ?board.cells.slice().sort((a,b)=>terrainSort(a)-terrainSort(b))
  :board.cells;
 function terrainSort(c){const t=normalizeLayer(c).base;return t==='forest'||t==='woods'?2:t==='swamp'?1:0;}
 let terrainPass=-1,cityGroundEmitted=false;
 for(const c of orderedTerrain){
  const currentPass=options.forestLayering?terrainSort(c):0;
  if(options.forestLayering&&currentPass!==terrainPass){
   if(terrainPass>=0)svg+='</g>';
   if(currentPass===2){
    // Keep the existing city ground and yellow border beneath forest tiles.
    // Close the outer terrain group momentarily to avoid nesting these layers.
    svg+='</g>';
    svg+=majorCityGroundLayer();
    svg+=cityHexBorderLayer();
    cityGroundEmitted=true;
    svg+='<g class="terrain-base-layer terrain-resume" data-layer="terrain-resume">';

   }
   svg+=`<g class="terrain-pass" data-layer="${currentPass===2?'forest':currentPass===1?'swamp':'open'}-terrain">`;
   terrainPass=currentPass;
  }
  const [cx,cy]=coord(c,board.geometry),l=normalizeLayer(c),sourcePartialSea=board.waterRenderingMode!=='hexside-wavelets'&&!!board.sourceWaterScanContours?.polygons?.length&&l.base==='sea',visibleBase=sourcePartialSea?'open':l.base,tex=visibleBase==='sea'?null:textures[visibleBase],fill=visibleBase==='sea'?svgColor(options.waterColor||'#30b9bfff'):visibleBase?(p[visibleBase]||'#b7b4a5'):(options.unknownTerrainFill||'url(#tile-unknown)');
  let seamlessOverlay='';
  svg+=`<g class="hex-tile" data-hex-id="${safe(c.id)}" transform="translate(${pt(cx)},${pt(cy)})">`;
  if(!(options.sourceInspection&&!l.base))svg+=`<polygon class="terrain-fill" data-interaction="hex-body" points="${points}" fill="${fill}" fill-opacity="${options.sourceUnderlay?'.56':'1'}" stroke="${visibleBase==='sea'?fill:'none'}" stroke-width="${visibleBase==='sea'?'.8':'0'}"/>`;
  if(options.sourceInspection&&!l.base)svg+=`<polygon class="terrain-hit-area" data-interaction="hex-body" points="${points}" fill="transparent" stroke="none" pointer-events="all"/>`;
  if(tex){
   const loc=imgPrefix+tex,rect=`x="-${pt(rx)}" y="-${pt(ry)}" width="${pt(rx*2)}" height="${pt(ry*2)}"`;
   // Source-review display density is per hex and never changes the terrain
   // rules classification. Default is exactly the historical renderer value.
   const textureMultiplier=Number(c.terrainTextureOpacityMultiplier??1);
   if(!Number.isFinite(textureMultiplier)||textureMultiplier<0||textureMultiplier>1)
    throw Error('Invalid terrainTextureOpacityMultiplier '+c.id);
   const tileOpacity=Math.max(0,Math.min(1,Number(options.tileOpacity??.75)*textureMultiplier));
   const attrs=`clip-path="url(#${clipId})" opacity="${pt(tileOpacity)}" pointer-events="none"`;
   if(seamlessPatterns[visibleBase]){
    // Paint OUTSIDE the translated cell group: all cells share the same world
    // coordinate origin and adjacent Swamp hexes join seamlessly. Preserve
    // per-cell visual opacity, including intentionally untextured source cells.
    const absolute=hexPoints(rx,ry).map(([x,y])=>`${pt(cx+x)},${pt(cy+y)}`).join(' ');
    seamlessOverlay=`<polygon class="terrain-seamless-texture" data-texture-hex="${safe(c.id)}" points="${absolute}" fill="url(#${safe(seamlessPatterns[visibleBase])})" opacity="${pt(tileOpacity)}" pointer-events="none"/>`;
   }else if(options.reuseTerrainTextures){const spriteId='terrain-sprite-'+String(options.id||board.id).replace(/[^a-zA-Z0-9_-]/g,'')+'-'+visibleBase;
    svg+=`<g class="texture-clip" ${attrs}><use class="terrain-texture" href="#${safe(spriteId)}" x="-${pt(rx)}" y="-${pt(ry)}"/></g>`;
   }else svg+=`<image href="${safe(loc)}" ${rect} preserveAspectRatio="${options.tileFit==='stretch'?'none':'xMidYMid slice'}" ${attrs}/>`;
  }
  if(visibleBase==='open'&&Number(options.openTerrainLighten||0)>0){
   const alpha=Math.max(0,Math.min(.45,Number(options.openTerrainLighten)));
   svg+=`<polygon class="open-terrain-lightening" points="${points}" fill="#f0f8d9" fill-opacity="${pt(alpha)}" stroke="none" pointer-events="none"/>`;
  }
  svg+='</g>';
  if(seamlessOverlay)svg+=seamlessOverlay;
 }
 if(options.forestLayering&&terrainPass>=0)svg+='</g>';
 svg+='</g>';
 if(!cityGroundEmitted) { svg+=majorCityGroundLayer();svg+=cityHexBorderLayer(); }
 // 2. Fortification artwork: centered, transparent, and UNDER all map features.
 // Source shape remains intact in separate overlay asset; no opaque black stroke.
 const fortAlpha=Number.isFinite(+options.fortificationAlpha)?Math.min(1,Math.max(0,+options.fortificationAlpha)):.5;
 svg+=`<g class="fortification-overlay" data-layer="fortifications" pointer-events="none" style="mix-blend-mode:screen;display:${options.showFortifications===false?'none':'inline'}">`;
 for(const c of board.cells){if(options.sourceInspection)continue;const m=normalizeLayer(c).markers;
  if(!m.some(x=>x.kind==='fortification'))continue;
  const [cx,cy]=coord(c,board.geometry);
  if(options.fortificationArtwork){const scale=Number(options.fortificationScale)||.78;
   svg+=`<image class="fortification-asset" data-fortification-cell="${safe(c.id)}" href="${safe(options.fortificationArtwork)}" x="${pt(cx-rx*scale)}" y="${pt(cy-ry*scale)}" width="${pt(rx*2*scale)}" height="${pt(ry*2*scale)}" preserveAspectRatio="none" opacity="${pt(fortAlpha)}"/>`;
  }else svg+=`<g data-fortification-cell="${safe(c.id)}" transform="translate(${pt(cx)} ${pt(cy)})" opacity="${pt(fortAlpha)}">${markerGlyph('fortification')}</g>`;
 }
 svg+='</g>';
 // 2.75. Scenario-configured setup-region outlines, presentation only.
 // These are independent per-hex strokes, not a claimed national boundary,
 // and do not change movement, deployment legality or combat territories.
 // Above terrain/fortifications, BELOW Rivers, Lakes, Coasts, roads, rails, grid and labels.
 // Water graphics now conceal those dashed segments wherever they overlap.
 if(Array.isArray(options.hexRegionOutlines)&&options.hexRegionOutlines.length){
  const cellsById=new Map(board.cells.map(c=>[c.id,c]));
  svg+='<g class="setup-region-outline-layer" data-layer="setup-region-outlines" pointer-events="none">';
  for(const group of options.hexRegionOutlines){
   if(!group||typeof group.id!=='string'||!/^[a-z0-9-]+$/.test(group.id)||
     !Array.isArray(group.hexes)||!group.hexes.length)throw Error('Invalid setup-region outline group');
   const stroke=svgColor(group.stroke||'#ed8d30');
   const width=Number(group.strokeWidth??4.5),inset=Number(group.inset??.88);
   if(!Number.isFinite(width)||width<=0||width>12||!Number.isFinite(inset)||inset<.5||inset>1)
    throw Error('Invalid setup-region outline style '+group.id);
   const dash=group.dash||'10 4';
   if(typeof dash!=='string'||!/^\d+(?:\.\d+)?(?: \d+(?:\.\d+)?)+$/.test(dash))
    throw Error('Invalid setup-region dash '+group.id);
   const seen=new Set();
   for(const id of group.hexes){
    const cell=cellsById.get(id);
    if(!cell||seen.has(id)||cell.terrain==='sea')throw Error('Invalid setup-region outline hex '+id);
    seen.add(id);
    const [cx,cy]=coord(cell,board.geometry);
    const points=hexPoints(rx*inset,ry*inset).map(([x,y])=>`${pt(cx+x)},${pt(cy+y)}`).join(' ');
    svg+=`<polygon class="setup-region-outline" data-region="${safe(group.id)}" data-region-hex="${safe(id)}" points="${points}" fill="none" stroke="${safe(stroke)}" stroke-width="${pt(width)}" stroke-dasharray="${dash}" stroke-linejoin="round" stroke-linecap="round" opacity=".95"/>`;
   }
  }
  svg+='</g>';
 }
 // 3. Rivers and other sourced hex-side features.
 svg+=sharedBoundaryLayer(board,rx,ry,'features',options);
 // 3.5. Lakes and coasts: deliberately ABOVE rivers, BELOW roads/rails/grid/markers.
 // Retain the same seeded coast/lake wavelet generator, water-blue palette,
 // and semantic water topology. No source bitmap or coastline is substituted.
 svg+=`<g class="shoreline-reinforcement-masked" mask="url(#${clipId}-shore-under-reinforcements)">`;
 svg+=waterBodyLayer(board,rx,ry,options);
 svg+=sourceWaterRouteLayer(board,options);
 svg+='</g>';
 // 3.75. Reinforcement perimeter sits above BOTH River and Coast/Lake,
 // but below railways, hex grid and map symbols. Shared across all campaigns.
 // Entry boundaries render at layer zero, beneath opaque terrain tiles.
 // 3.95. Territory perimeter. Draw ONLY hexsides separating the configured
 // region from other cells, using sourceTerritory data on the composited board.
 // Shared engine: no scenario-specific geometry, no inferred classifications.
 // Above terrain/water and below rails/grid/numbers/city/deployment markers.
 if(Array.isArray(options.territoryOutlines)&&options.territoryOutlines.length){
  const regionIds=new Set(),cellsById=new Map(board.cells.map(c=>[c.id,c]));
  svg+='<g class="territory-outline-layer" data-layer="territory-outlines" pointer-events="none">';
  for(const spec of options.territoryOutlines){
   if(!spec||typeof spec.region!=='string'||!/^[a-z-]+$/.test(spec.region)||regionIds.has(spec.region))
    throw Error('Invalid territory outline region');
   regionIds.add(spec.region);
   const stroke=svgColor(spec.stroke||'#9475A9'),width=Number(spec.strokeWidth??5.8);
   if(!Number.isFinite(width)||width<=0||width>12)throw Error('Invalid territory outline stroke '+spec.region);
   const members=new Set(board.cells.filter(c=>c.sourceTerritory===spec.region).map(c=>c.id));
   if(!members.size)throw Error('Territory outline has no approved cells: '+spec.region);
   svg+=`<g data-territory="${safe(spec.region)}" data-member-count="${members.size}">`;
   for(const edge of gridSegmentData(board,rx,ry)){
    const a=members.has(edge.cellId),b=members.has(edge.neighborId);
    if(a===b)continue; // interior hexsides are NOT border segments
    const memberId=a?edge.cellId:edge.neighborId;
    if(cellsById.get(memberId)?.terrain==='sea')throw Error('Sea hex in territory outline');
    svg+=`<path class="territory-perimeter-side" data-region="${safe(spec.region)}" data-region-hex="${safe(memberId)}" d="${path([edge.a,edge.b])}" fill="none" stroke="${safe(stroke)}" stroke-width="${pt(width)}" stroke-linecap="round" stroke-linejoin="round" opacity=".98"/>`;
   }
   svg+='</g>';
  }
  svg+='</g>';
 }
 // 4. Roads, 5. rails: each has a separate physical SVG layer in routeLayer.
 svg+=routeLayer(board,rx,ry,options);
 // 6. Hex grid uses multiply mode. Later labels and icons stay fully opaque.
 const {blend,opacity}=gridStyle(options);
 const gridStroke=safe(options.gridStrokeColor||'#536d67');
 const gridWidth=Number.isFinite(+options.gridStrokeWidth)?Math.max(.2,+options.gridStrokeWidth):.95;
 svg+=`<g class="hex-grid-overlay" data-layer="hex-grid" pointer-events="none" style="display:${options.showGrid?'inline':'none'}"><g class="hex-grid-blend" data-blend="${blend}" style="mix-blend-mode:${blend}" opacity="${pt(opacity)}">`;
 const gridCellsById=new Map(board.cells.map(c=>[c.id,c]));
 // A source-authoritative Coast line replaces the corresponding grid edge.
 // Match the geometric segment rather than provisional cell/face labels: the
 // latter are ambiguous when a shoreline coincides with two adjacent hexes.
 const coastSourceSegments=[];
 if(['exact-source-paths','source-path-coast-wavelets'].includes(board.sourceCoastRenderingMode))for(const route of board.sourceWaterRoutes||[]){
  if(route.kind!=='coast'||!Array.isArray(route.points))continue;
  for(let i=1;i<route.points.length;i++)coastSourceSegments.push([route.points[i-1],route.points[i]]);
 }
 const coastalGridSide=(side)=>coastSourceSegments.some(([a,b])=>
  (Math.hypot(side.a[0]-a[0],side.a[1]-a[1])<1&&Math.hypot(side.b[0]-b[0],side.b[1]-b[1])<1)||
  (Math.hypot(side.a[0]-b[0],side.a[1]-b[1])<1&&Math.hypot(side.b[0]-a[0],side.b[1]-a[1])<1));
 // A registered wavelet occupies an actual canonical hexside. Suppress its
 // underlying grid edge in either cell orientation, just as for an exact
 // authored coastline. This does not change the railway or gameplay geometry.
 const waveletCoastSegments=board.sourceCoastRenderingMode==='registered-hexside-wavelets'
  ?(board.authoredShoreHexsides||[]).filter(e=>e.kind==='coast'&&gridCellsById.has(e.cellId)&&DIRS.includes(e.dir))
   .map(e=>sideInfo(gridCellsById.get(e.cellId),e.dir,rx,ry,board.geometry)) : [];
 const waveletCoastalGridSide=(side)=>waveletCoastSegments.some(e=>
  (Math.hypot(side.a[0]-e.a[0],side.a[1]-e.a[1])<.1&&Math.hypot(side.b[0]-e.b[0],side.b[1]-e.b[1])<.1)||
  (Math.hypot(side.a[0]-e.b[0],side.a[1]-e.b[1])<.1&&Math.hypot(side.b[0]-e.a[0],side.b[1]-e.a[1])<.1));
 for(const side of gridSegmentData(board,rx,ry)){
  if(gridCellsById.get(side.cellId)?.terrain==='sea'||(side.neighborId&&gridCellsById.get(side.neighborId)?.terrain==='sea'))continue;
  if(coastalGridSide(side)||waveletCoastalGridSide(side))continue;
  svg+=line(path([side.a,side.b]),gridStroke,gridWidth,'class="grid-line"');
 }
 svg+='</g></g>';
 // 7. Numbers must never be hidden by fortifications, even in fortified hexes.
 svg+=numberLayer(board,rx,ry,options);
 // Reinforcement boundaries were rendered at layer 3.75 above rivers and coasts.
 // 8. City and objective symbols, centered on exact engine hex centers.
 const majorCityLabelSet=new Set(Array.isArray(options.majorCityLabels)?options.majorCityLabels.map(x=>String(x).trim().toLowerCase()).filter(Boolean):[]);
 svg+='<g class="map-symbol-layer" data-layer="cities" pointer-events="none">';
 for(const c of board.cells){if(options.sourceInspection)continue;const m=normalizeLayer(c).markers,city=m.find(x=>x.kind==='city'||x.kind==='majorCity'),obj=m.find(x=>x.kind==='objective');if(!city&&!obj)continue;
  const mappedCenter=coord(c,board.geometry);
  const cityPlacement=cityRenderPosition(city,mappedCenter,rx,ry,options),[cx,cy]=cityPlacement.position;
  const cityLabel=String(city?.label||'').trim().toLowerCase();
  const emphasizedCity=!!city&&(city.kind==='majorCity'||majorCityLabelSet.has(cityLabel));
  const outerR=emphasizedCity?14.5:11;
  const innerR=emphasizedCity?6.0:5.1;
  const haloR=emphasizedCity?17.3:13.8;
  const haloW=emphasizedCity?6.6:4.8;
  svg+=`<g data-symbol-hex="${safe(c.id)}" data-city-placement="${'hex-center'}" transform="translate(${pt(cx)} ${pt(cy)})">`;
  if(city){svg+=`<g class="overlay-marker marker-${safe(city.kind)}${emphasizedCity?' marker-major-emphasis':''}" data-marker-kind="${safe(city.kind)}" data-city-emphasis="${emphasizedCity?'major':'standard'}">${emphasizedCity?`<circle class="city-major-fringe" r="${pt(haloR)}" fill="none" stroke="#e8cd63" stroke-opacity=".40" stroke-width="${pt(haloW)}"/>`:''}<circle class="city-outer" r="${pt(outerR)}" fill="#fff" stroke="#333e43" stroke-width="2"/><circle class="city-inner-dot" r="${pt(innerR)}" fill="#929c9e" stroke="none"/></g>`;}
  if(obj)svg+=`<g class="overlay-marker marker-objective" transform="${city?'translate(17 -13)':''}">${markerGlyph('objective')}</g>`;
  svg+='</g>';
 }
 svg+='</g>';
 // 9. City/victory labels are emitted at layer 16 later, above every other map element.
 if(!options.cityBorderOutsideGrid){
 // 10.5. City-hex emphasis: actual city markers determine membership.
 // Separate editable vector art stays above the entry boundaries and below deployment;
 // its transparent interior leaves terrain/rail/river/hex number untouched.
 svg+=`<g class="city-hex-highlight-layer" data-layer="city-hex-highlights" data-layer-order="10.5" pointer-events="none" style="display:${options.showCityHexHighlights===false?'none':'inline'}">`;
 for(const c of board.cells){
  if(options.sourceInspection)continue;
  const hasCity=normalizeLayer(c).markers.some(m=>m.kind==='city'||m.kind==='majorCity');
  if(!hasCity)continue;
  const [cx,cy]=coord(c,board.geometry);
  if(options.cityHexArtwork){
   svg+=`<image class="city-hex-highlight" data-city-hex="${safe(c.id)}" href="${safe(options.cityHexArtwork)}" x="${pt(cx-rx)}" y="${pt(cy-ry)}" width="${pt(rx*2)}" height="${pt(ry*2)}" preserveAspectRatio="none"/>`;
  }else{
   // Self-contained fallback for other games without the optional artwork file.
   svg+=cityBorderMarkup(c.id,cx,cy,rx,ry);
  }
 }
 svg+='</g>';
 }
 // 11. Universal bottom-center deployment placement across every map.
 // Source marker geometry is audit evidence, not a renderer mode.
 // Geometry never derives from formatted printed numbers.
 // When both armies (or two fixed setup icons) share a hex, lay them out SIDE BY
 // SIDE using the same geometry and scale for all campaigns. The authored SVG
 // positions remain provenance metadata, never runtime placement coordinates.
 svg+='<g class="deployment-overlay" data-layer="deployment" data-placement="bottom-center" pointer-events="none">';
 for(const c of board.cells){
  if(options.sourceInspection)continue;
  const markers=normalizeLayer(c).markers.filter(m=>
   ['star','cross','fixedInfantry','fixedMechanized','fixedCavalry'].includes(m.kind) &&
   (options.showCandidateDeployment!==false||!String(m.status||'').includes('candidate')));
  // Generic, presentation-only overrides: user-requested diagram changes can
  // be displayed without rewriting source SVG provenance or silently changing
  // the source-validated historical setup rules. A matching source marker is
  // required; invented marker positions are rejected.
  const visualOverride=options.deploymentMarkerOverrides?.[c.id];
  if(visualOverride){
   const eligible=['star','cross','fixedInfantry','fixedMechanized','fixedCavalry'];
   const ix=markers.findIndex(m=>m.kind===visualOverride.fromKind);
   if(ix<0||markers.filter(m=>m.kind===visualOverride.fromKind).length!==1||
      !eligible.includes(visualOverride.toKind)||
      !['german','soviet'].includes(visualOverride.faction))
    throw Error('Invalid deployment marker override at '+c.id);
   markers[ix]={...markers[ix],kind:visualOverride.toKind,faction:visualOverride.faction,
     sourceSvgId:'',displayOverride:true,status:'user-directed-presentation-override'};
  }
  if(!markers.length)continue;
  const [cx,cy]=coord(c,board.geometry);
  // One canonical scale for one or two deployment icons on EVERY map.
  // Only crowded 3+ groups may shrink; the source never supplies such a group.
  const standard=FACTIONS.deploymentIcons;
  // Shared glyphs and placement; smaller historical hexes use the same
  // proportional footprint as Kiev-Odessa instead of an absolute-size
  // placement that pushed Arduous markers toward their hex centers.
  const referenceRy=38.40;
  const fittedScale=Math.min(1,Math.max(.60,ry/referenceRy));
  const layout=options.deploymentMarkerLayout||{};
  const crowdedScaleMultiplier=Number.isFinite(+layout.crowdedScaleMultiplier)?Math.max(.2,+layout.crowdedScaleMultiplier):1;
  const useStandardScale=layout.useStandardScale===true;
  const scale=((markers.length>2&&!useStandardScale?standard.crowdedScale*crowdedScaleMultiplier:standard.scale))*fittedScale;
  const placement=Array.isArray(layout.slotOffsets)?'custom-slots':'bottom-center';
  const bottomFraction=Number.isFinite(+layout.bottomCenterFraction)?Math.max(0,+layout.bottomCenterFraction):standard.bottomCenterFraction;
  const bottomOffset=Math.max(0,Math.min(ry*bottomFraction,ry*Math.sqrt(3)/2-12*scale-2));
  const spacingMultiplier=Number.isFinite(+layout.spacingMultiplier)?Math.max(.2,+layout.spacingMultiplier):1;
  const spacing=standard.pairSpacing*fittedScale*spacingMultiplier;
  const customSlots=Array.isArray(layout.slotOffsets)?layout.slotOffsets:null;
  for(let i=0;i<markers.length;i++){
   const m=markers[i],tentative=String(m.status||'').includes('candidate');
   const fixed=m.kind==='fixedInfantry'||m.kind==='fixedMechanized'||m.kind==='fixedCavalry';
   let markerX=cx+(i-(markers.length-1)/2)*spacing,markerY=cy+bottomOffset,markerScale=scale;
   if(customSlots&&customSlots[i]){
    const slot=customSlots[i];
    if(Array.isArray(slot)){
     markerX=cx+Number(slot[0]||0); markerY=cy+Number(slot[1]||0); if(Number.isFinite(+slot[2]))markerScale=scale*(+slot[2]);
    }else if(typeof slot==='object'){
     markerX=cx+Number(slot.dx||0); markerY=cy+Number(slot.dy||0); if(Number.isFinite(+slot.scale))markerScale=scale*(+slot.scale);
    }
   }
   const transform=`translate(${pt(markerX)} ${pt(markerY)}) scale(${pt(markerScale)})`;
   svg+=`<g data-deployment-hex="${safe(c.id)}" data-deployment-kind="${safe(m.kind)}" data-placement="${placement}" data-standard="universal-deployment-v1" data-slot="${i+1}" data-slot-count="${markers.length}" data-source-svg-id="${safe(m.sourceSvgId||'')}"${m.displayOverride===true?' data-visual-override="true"':''} data-setup-mode="${fixed?'fixed':'flexible'}" data-source-visual-candidate="${tentative?'true':'false'}" opacity="1" transform="${transform}">${fixed?fixedSetupGlyph(m.kind,m.faction):deploymentGlyph(m.kind)}</g>`;
  }
 }
 svg+='</g>';
 // 12. Other modifiers (port, airfield, bridge, depot). Avoid centered cities.
 svg+='<g class="modifier-overlay" data-layer="modifiers" pointer-events="none">';
 for(const c of board.cells){if(options.sourceInspection)continue;const markers=normalizeLayer(c).markers.filter(m=>!['star','cross','fixedInfantry','fixedMechanized','fixedCavalry','city','majorCity','objective','fortification'].includes(m.kind));if(!markers.length)continue;
  const city=normalizeLayer(c).markers.some(m=>m.kind==='city'||m.kind==='majorCity');const [cx,cy]=coord(c,board.geometry);
  const slots=city?[[rx*.43,-ry*.33],[-rx*.43,-ry*.32],[rx*.43,ry*.33],[-rx*.43,ry*.33]]:[[0,0],[rx*.32,-ry*.3],[-rx*.32,-ry*.3]];
  for(const [i,m] of markers.entries()){const [dx,dy]=slots[i%slots.length];svg+=`<g data-modifier-hex="${safe(c.id)}" data-modifier-kind="${safe(m.kind)}" transform="translate(${pt(cx+dx)} ${pt(cy+dy)})">${markerGlyph(m.kind)}</g>`;}
 }
 svg+='</g>';
 // Comparison-only source boundary trace; not a game reinforcement line.
 svg+=sourceReinforcementAuditLayer(board,options);
 // 16. City/victory labels at the highest layer so names stay readable over every overlay.
 svg+='<g class="city-label-layer" data-layer="city-labels" data-layer-order="16" pointer-events="none">';
 for(const c of board.cells){if(options.sourceInspection)continue;const m=normalizeLayer(c).markers,city=m.find(x=>x.kind==='city'||x.kind==='majorCity'),obj=m.find(x=>x.kind==='objective');if(!city&&!obj)continue;
  const mappedCenter=coord(c,board.geometry);
  const cityPlacement=cityRenderPosition(city,mappedCenter,rx,ry,options),[cx,cy]=cityPlacement.position;
  svg+=`<g data-label-hex="${safe(c.id)}" data-city-placement="${'hex-center'}" transform="translate(${pt(cx)} ${pt(cy)})">`;
  const label=city?.label||obj?.label||'';
  if(label)svg+=`<text class="city-label" x="9" y="-8" text-anchor="start" font-size="11" font-weight="800" fill="#253336" stroke="#eef0e4" stroke-width="3" paint-order="stroke">${safe(label)}</text>`;
  svg+='</g>';
 }
 svg+='</g>';
 if(options.selected){const c=board.cells.find(c=>c.id===options.selected);if(c){const [cx,cy]=coord(c,board.geometry);svg+=`<polygon class="selected-hex-outline" points="${hexPoints(rx,ry).map(([x,y])=>`${pt(x+cx)},${pt(y+cy)}`).join(' ')}" fill="none" stroke="#db9020" stroke-width="2.5" pointer-events="none"/>`;}}
 svg+='</svg>';return svg;
}
// Browser appearance-only Coast choices. Geometry is derived solely from the
// same authored routes and registered hexsides as svgMap(). Default exported
// map rendering remains unchanged. Never modifies scenario game geography.
const NS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
function pointsPath(points){return points.map((p,i)=>(i?'L':'M')+Number(p[0]).toFixed(2)+','+Number(p[1]).toFixed(2)).join(' ');}
function flatSourceFringe(route,reference){
 const points=route?.points;
 if(!Array.isArray(points)||points.length<2)return null;
 const depth=14.4,landward=points.map((p,i)=>{
  const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
  const dx=after[0]-before[0],dy=after[1]-before[1],length=Math.hypot(dx,dy)||1;
  return [p[0]-dy*depth/length,p[1]+dx*depth/length];
 });
 return svgEl('path',{class:'settings-flat-coast',d:pointsPath([...points,...landward.reverse()])+' Z',fill:reference.getAttribute('fill')||'#30b9bf','pointer-events':'none'});
}
function flatRegisteredFringe(node,board){
 const cellId=node.dataset.shoreCell,dir=node.dataset.shoreDir;
 const cell=board?.cells?.find(c=>c.id===cellId);
 if(!cell||!['N','NE','SE','S','SW','NW'].includes(dir))return null;
 const cal=board.geometry?.calibration;
 if(!cal||!Array.isArray(cell.pixelCenter))return null;
 const rx=cal.pitchX*2/3,ry=cal.pitchY/Math.sqrt(3);
 const corner=Array.from({length:6},(_,i)=>[cell.pixelCenter[0]+rx*Math.cos(i*Math.PI/3),cell.pixelCenter[1]+ry*Math.sin(i*Math.PI/3)]);
 const sides={N:[4,5],NE:[5,0],SE:[0,1],S:[1,2],SW:[2,3],NW:[3,4]};
 const [a,b]=sides[dir].map(i=>corner[i]);
 const depth=Number(node.dataset.fringeDepth)||7.2;
 return svgEl('path',{class:'settings-flat-coast',d:pointsPath([a,b]),fill:'none',stroke:node.getAttribute('fill')||'#30b9bf','stroke-width':(2*depth).toFixed(2),'stroke-linecap':'round','pointer-events':'none'});
}
/* Updates only coast artwork already present in the generated map SVG.
 * Lakes, rivers, Sea terrain, grid, labels and source data are untouched.
 * On disable-wavelets, the geometry is the corresponding original source
 * polyline or exact hexside: no synthetic meandering is introduced.
 */
function applyCoastPresentation(svg,board,settings){
 if(!svg)return;
 const cfg={showCoast:settings?.showCoast!==false,coastWavelets:settings?.coastWavelets!==false};
 svg.querySelectorAll('.settings-flat-coast').forEach(n=>n.remove());
 const wave=svg.querySelectorAll('.source-coast-connected-wavelet-fringe, .registered-shore-fringe[data-water-kind="coast"], .water-region[data-water-kind="sea"] .water-shore-fringe');
 const plain=svg.querySelectorAll('.source-authored-coast, .explicit-coast-edge, .registered-shoreline[data-water-kind="coast"], .source-water-variable-depth[data-water-kind="coast"], .source-water-centerline[data-water-kind="coast"], .water-region[data-water-kind="sea"] .water-shoreline');
 for(const node of plain)node.style.display=cfg.showCoast?'':'none';
 for(const node of wave){node.style.display=cfg.showCoast&&cfg.coastWavelets?'':'none';
  if(!cfg.showCoast||cfg.coastWavelets)continue;
  let flat=null;
  if(node.classList.contains('source-coast-connected-wavelet-fringe')){
   const route=(board?.sourceWaterRoutes||[]).find(r=>r.sourceSvgId===node.dataset.sourceWaterPath&&r.kind==='coast');
   flat=flatSourceFringe(route,node);
  }else if(node.classList.contains('registered-shore-fringe'))flat=flatRegisteredFringe(node,board);
  else if(node.classList.contains('water-shore-fringe')){
   // Sea water-bodies without a separately registered coast preserve the
   // exact water area, but flatten their visible shore using path endpoints.
   const d=node.getAttribute('d')||'',nums=[...d.matchAll(/[-+]?(?:\d*\.)?\d+/g)].map(m=>Number(m[0]));
   if(nums.length>=4)flat=svgEl('path',{class:'settings-flat-coast',d:pointsPath([[nums[0],nums[1]],[nums[nums.length-2],nums[nums.length-1]]]),fill:'none',stroke:node.getAttribute('stroke')||'#30b9bf','stroke-width':node.getAttribute('stroke-width')||'4','pointer-events':'none'});
  }
  if(flat)node.parentNode.insertBefore(flat,node.nextSibling);
 }
}

function derivePreview(board,style='kiev'){const cells=board.cells.slice(0,18).map(c=>({...c,tileEdges:{...(c.tileEdges||{})},tileMarkers:[...(c.tileMarkers||[])]}));return {...board,cells,theme:style}}
/**
 * Source-backed rendering for historical boards WITHOUT a verified semantic map.
 * The source scan is an authentic base map layer, not an invented terrain layer.
 * Vector registration overlays may be toggled independently and are explicitly
 * not evidence that terrain, rivers, ports, roads or setup have been transcribed.
 */
function svgSourceReference(board,options={}){
 const w=Number(options.width),h=Number(options.height),pad=Math.max(28,Number(options.padding)||34);
 if(!Number.isFinite(w)||w<=0||!Number.isFinite(h)||h<=0)throw Error('Source map requires true raster dimensions');
 if(!options.sourceImage)throw Error('Source image required');
 const title=String(options.title||board?.sourceGame||'Historical reference map');
 const status=String(options.status||'UNVERIFIED SOURCE REGISTRATION');
 const foot=String(options.note||'SOURCE SCAN • independent feature transcription pending');
 const data=String(options.sourceImage);
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="source-reference-map" role="img" aria-label="Source-backed engine composition of ${safe(title)}" viewBox="${pt(-pad)} ${pt(-pad-55)} ${pt(w+2*pad)} ${pt(h+2*pad+84)}">`;
 svg+=`<rect x="${pt(-pad)}" y="${pt(-pad-55)}" width="${pt(w+2*pad)}" height="${pt(h+2*pad+84)}" fill="#fff"/>`;
 svg+=`<g data-layer="source-map-artwork"><image x="0" y="0" width="${pt(w)}" height="${pt(h)}" href="${safe(data)}" preserveAspectRatio="none" /></g>`;
 if(board&&options.showGrid){
  const overlay=svgGridOverlay(board,{width:w,height:h,showGrid:true,showNumbers:options.showNumbers===true,
   gridBlend:'multiply',stroke:options.gridStroke||'#213a44',opacity:options.gridOpacity??.28,
   strokeWidth:options.gridStrokeWidth??1.05,showCities:false,showAnchors:false});
  const match=overlay.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if(match)svg+=`<g data-layer="provisional-grid" data-registration-status="${safe(options.registrationStatus||'provisional')}">${match[1]}</g>`;
 }
 if(board&&options.showCityHexes){
  const [rx,ry]=gridRadii(board.geometry);
  svg+='<g data-layer="provisional-city-hexes" pointer-events="none">';
  for(const c of board.cells){if(!c.city)continue;const [cx,cy]=coord(c,board.geometry);
   svg+=cityBorderMarkup(c.id,cx,cy,rx*.9,ry*.9);
  }
  svg+='</g>';
 }
 svg+=`<g data-layer="map-provenance" pointer-events="none"><text x="0" y="-38" fill="#20313c" font-family="Arial,sans-serif" font-size="23" font-weight="700">${safe(title)}</text><text x="${pt(w)}" y="-38" text-anchor="end" fill="#8a5730" font-family="Arial,sans-serif" font-size="12" font-weight="700">${safe(status)}</text><text x="0" y="${pt(h+25)}" fill="#49565a" font-family="Arial,sans-serif" font-size="12">${safe(foot)}</text></g>`;
 return svg+'</svg>';
}
return {shorelineRegistrationAudit,sourceSeaBoundaryDistance,DIRS,HEX_FACE,OPP,TERRAIN,EDGES,MARKERS,PALETTES,RAILWAY_PRESENTATION,NUMBER_FORMATS,GRID_BLEND_MODES,cellId,neighbor,coord,gridRadii,gridSegmentData,gridMetrics,waterBodies,waterBodyLayer,waterErrors,DEFAULT_WATER_SEED,svgGridOverlay,svgSourceReference,recalibrate,hexPoints,numberStyle,formatHexNumber,numberLayer,normalizeLayer,validate,addEdge,removeEdge,addMarker,removeMarker,setTerrain,routePlan,railSplineNetwork,railSplineSample,railSplinePath,sourceRailSplinePath,registeredSourceRailRoutes,sourceRailPathLayer,sourceWaterRouteLayer,entryBoundaryLayer,svgMap,applyCoastPresentation,derivePreview};
});

};
defs["core/territorial_state_transition.js"]=function(module,exports,require,Buffer){
/* Optional source-qualified territory lifecycle: immutable annexation state.
 * The candidate 261-hex Odessa graph has NO certified country coverage;
 * this module cannot authorize or fabricate missing country boundaries.
 */
(function(root,factory){
 const Rules=typeof module==='object'&&module.exports?require('./movement_rules.js'):root.WargameMovementRules;
 const api=factory(Rules);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameTerritorialStateTransition=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Rules){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 function commit({profile,board,state}={}){
  if(!profile||!board||!state||!state.units||typeof state.units!=='object'||Array.isArray(state.units))
   return {ok:false,reason:'invalid-territorial-commit-context'};
  if(!profile.territorialPolicy)return {ok:true,state,event:null};
  const status=Rules.bessarabiaAnnexation({profile,board,units:state.units,territory:state.territory});
  if(!status.ok)return {ok:false,reason:status.reason};
  const next=clone(state);next.territory=status.territory;
  return {ok:true,state:next,event:status.changed?{
   kind:'bessarabia-annexed',region:'bessarabia',permanent:true}:null};
 }
 function retreatStep({profile,board,state,unit,from,to}){
  const access=Rules.territorialAccess({profile,board,territory:state?.territory},unit,to,'retreat',from);
  if(access.ok)return true;
  if(['national-territory-exclusion','home-army-territory-restricted'].includes(access.reason))return false;
  throw Error('Retreat country identity/coverage unverified: '+access.reason);
 }
 return Object.freeze({commit,retreatStep});
});

};
})(globalThis);
