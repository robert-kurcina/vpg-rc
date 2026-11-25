/* Presentation-only adapter: native game cells -> universal layered terrain map.
 * Does not alter WargameCore legality, phases, moves, CRT or objectives. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameTerrainAdapter=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function nativeBoard(game,center,options={}){if(!game?.map?.cells)throw Error('Missing native map cells');const cells=game.map.cells.map(h=>{
 const [cx,cy]=[center(h.x,h.y).x,center(h.x,h.y).y];let terrain=h.terrain||null;
 const terrainAlias={hill:options.artworkSource==='supplied'?'hills':'rough',plain:'open',clear:'open',urban:'open',wetland:'swamp'};
 terrain=terrainAlias[terrain]||terrain;
 if(!['open','forest','woods','swamp','water','mountain','hills','desert','rough'].includes(terrain))terrain=null;
 const markers=[];
 if(h.city&&h.city!=='none')markers.push({kind:h.city==='capital'?'majorCity':h.city==='depot'?'depot':'city',label:((h.city==='capital'?'Capital':h.city==='depot'?'Depot':h.city))});
 if(h.fortification)markers.push({kind:'fortification'});
 return {id:String(h.x+1).padStart(2,'0')+String(h.y+1).padStart(2,'0'),column:h.x+1,row:h.y+1,pixelCenter:[cx,cy],terrain,terrainStatus:'scenario-config',tileMarkers:markers,tileEdges:h.tileEdges||{},sourceRef:{x:h.x,y:h.y}};
 });return {id:game.game.id+'-terrain-display',sourceGame:game.game.title||game.game.id,geometry:{topology:'even-q-flat',calibration:{},hexNumbers:game.map.coordinatePresentation||{format:'column-row-4',placement:'nw',fontSize:8}},cells};}
// Faithful visual adapter of the preserved Oberlabs digital scenario. The
// paper B4M edition is a separate source and must not be substituted here.
function oberlabsBoard(scenario,center){
 if(!Array.isArray(scenario?.hexes)||!Array.isArray(scenario?.units))throw Error('Oberlabs scenario requires hexes and units');
 const sovietFixed=new Set(scenario.units.filter(u=>u.army==='soviet'&&u.position)
  .map(u=>u.position.x+','+u.position.y));
 const cells=scenario.hexes.map(h=>{
  const p=center(h.x,h.y),id=String(h.x+1).padStart(2,'0')+String(h.y+1).padStart(2,'0');
  const terr=h.terrain==='fortification'?'open':h.terrain;
  if(!['open','forest','swamp','water','mountain','hills','woods','rough'].includes(terr))throw Error('Unmapped source terrain '+h.terrain+' at '+id);
  const markers=[];
  if(h.terrain==='fortification')markers.push({kind:'fortification',status:'source-scenario'});
  if(h.city)markers.push({kind:h.city==='moscow'||h.city==='major'?'majorCity':'city',status:'source-scenario'});
  if(h.germanStart)markers.push({kind:'cross',status:'source-scenario'});
  if(sovietFixed.has(h.x+','+h.y))markers.push({kind:'star',status:'source-unit-roster'});
  const edges={};
  for(const [kind,key] of [['rail','rail'],['river','river']])for(const dir of (h[key]||[])){
   if(!HexDirs.includes(dir))throw Error('Unsupported source edge '+dir+' at '+id);
   (edges[dir]||=([])).push({kind,status:'source-scenario'});
  }
  return {id,column:h.x+1,row:h.y+1,displayNumber:String(h.x+1).padStart(2,'0')+String(h.y+(h.x%2?0:1)).padStart(2,'0'),pixelCenter:[p.x,p.y],terrain:terr,sourceTerrain:h.terrain,
   terrainStatus:'source-scenario',tileMarkers:markers,tileEdges:edges,
   entryTags:[...(h.germanReplacement?['german']:[]),...(h.sovietReplacement?['soviet']:[])],
   sourceRef:{x:h.x,y:h.y,city:h.city||null}};
 });
 // The live game constructs its presentation board on every New Game.
 // Derive the same canonical railway graph as maps/battle-for-moscow.json
 // directly from scenario edges, so the playable UI and map exporter agree.
 const T=(typeof HexTerrainTiles!=='undefined')?HexTerrainTiles:
  ((typeof module==='object'&&module.exports)?require('./terrain_tiles'):null);
 if(!T)throw Error('HexTerrainTiles required for center-anchored Moscow railway graphics');
 const geometry={topology:'even-q-flat',columnParityDown:'odd',hexNumbers:{format:'column-row-4',placement:'nw',fontSize:9}};
 const byId=new Map(cells.map(c=>[c.id,c]));const seen=new Set(),links=[],exits=[];
 for(const cell of cells){
  for(const [dir,arr] of Object.entries(cell.tileEdges||{})){
   if(!arr.some(f=>f.kind==='rail'))continue;
   const otherId=T.neighbor(cell,dir,geometry),other=byId.get(otherId);
   if(!other){exits.push({from:cell.id,dir,source:'oberlabs-scenario-tile-edge',status:'source-scenario-map-edge-exit'});continue;}
   if(!other.tileEdges?.[T.OPP[dir]]?.some(f=>f.kind==='rail'))
    throw Error('Source scenario railway not reciprocal '+cell.id+' '+dir+' '+otherId);
   const pair=[cell.id,other.id].sort(),key=pair.join(':');
   if(seen.has(key))continue;seen.add(key);
   links.push({from:pair[0],to:pair[1],source:'oberlabs-scenario-tile-edges',status:'source-scenario'});
  }
 }
 links.sort((a,b)=>(a.from+':'+a.to).localeCompare(b.from+':'+b.to));
 exits.sort((a,b)=>(a.from+':'+a.dir).localeCompare(b.from+':'+b.dir));
 return {id:'oberlabs-b4m-visual',sourceGame:'Battle for Moscow — Oberlabs digital rules',
  geometry,cells,hexCenterRailConnections:links,railwayBoundaryExits:exits,
  railwayPresentation:{...T.RAILWAY_PRESENTATION}};
}
const HexDirs=['N','NE','SE','S','SW','NW'];
return {nativeBoard,oberlabsBoard};
});
