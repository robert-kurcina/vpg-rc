/* Certified, shared map-derived combat geography; no caller-supplied
 * terrain/river flags. The movement-graph policy checks per-map provenance.
 * Default conservatively refuses ordinary city-marker combat; explicit
 * source-typed city mode distinguishes ordinary city from major city.
 */
(function(root,factory){
 const M=typeof module==='object'&&module.exports?require('./movement_binding.js'):root.WargameMovementBinding;
 const api=factory(M);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalCombatGeography=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(M){'use strict';
 const key=(a,b)=>[a,b].sort().join(':');
 function create(map,profile,options={}){
  const typedCities=options.cityMarkerMode==='source-typed-v1';
  if(options.cityMarkerMode!==undefined&&!typedCities)throw Error('Unsupported city marker geography mode');
  const sovietFort=options.fortificationMode==='soviet-defender-only-v1';
  if(options.fortificationMode!==undefined&&!sovietFort)throw Error('Unsupported fortification geography mode');
  const bound=M.build(map,profile);
  const edges=new Map(bound.board.edges.map(e=>[key(e.a,e.b),e]));
  const cells=new Map(map.cells.map(c=>[c.id,c]));
  function evaluate(battle,units){
   if(!battle||!Array.isArray(battle.attackers)||!battle.attackers.length||!cells.has(battle.defenderHex))throw Error('Invalid selected battle');
   const cell=cells.get(battle.defenderHex);
   if(!['open','forest','swamp'].includes(cell.terrain)||bound.board.cells[battle.defenderHex]?.verified!==true)throw Error('Defender terrain not source-certified');
   if(!typedCities&&(cell.tileMarkers||[]).some(m=>m.kind==='city'))throw Error('City modifier requires verified major-city classification');
   const markerKinds=(cell.tileMarkers||[]).filter(m=>['city','majorCity'].includes(m.kind));
   if(typedCities&&(markerKinds.length>1||markerKinds.some(m=>!m.label||!m.sourceSvgId)))throw Error('Unverified city marker identity');
   const fortifications=(cell.tileMarkers||[]).filter(m=>m.kind==='fortification');
   const sovietDefense=sovietFort&&Array.isArray(battle.defenders)&&battle.defenders.length>0&&
    battle.defenders.every(id=>units?.[id]?.owner==='soviet');
   if(sovietFort&&fortifications.some(m=>!m.sourceSvgId))throw Error('Fortification lacks source registration');
   const defenderTerrain=sovietDefense&&fortifications.length?'fortification':
    typedCities&&markerKinds.some(m=>m.kind==='majorCity')?'major-city':cell.terrain;
   const crossings=[];
   for(const id of battle.attackers){
    const origin=units?.[id]?.hex;
    const edge=origin&&edges.get(key(origin,battle.defenderHex));
    if(!edge||!edge.verified||edge.impassable||edge.lake||edge.allSea)throw Error('Attacker edge not source-certified and passable');
    crossings.push({unitId:id,from:origin,to:battle.defenderHex,river:edge.river===true,majorRiver:edge.majorRiver===true,source:edge.source});
   }
   return Object.freeze({defenderTerrain,allAttackersAcrossRiver:crossings.every(x=>x.river),
    evidence:Object.freeze({hex:battle.defenderHex,terrainStatus:cell.terrainStatus,crossings:Object.freeze(crossings.map(x=>Object.freeze(x)))}),status:'certified-geography-only'});
  }
  return Object.freeze({evaluate});
 }
 return Object.freeze({create});
});
