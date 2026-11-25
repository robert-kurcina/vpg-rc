/* Shared, presentation-only visualization of engine-validated post-roll retreats.
 * No route is inferred from terrain or rules here. No action is created here:
 * every route references one or more exact authoritative combat consequences.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameHistoricalRetreatMapUX=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const validHex=s=>typeof s==='string'&&/^\d{4}$/.test(s);
 const finitePoint=c=>Array.isArray(c?.pixelCenter)&&c.pixelCenter.length===2&&c.pixelCenter.every(Number.isFinite);
 function model({options=[],units={},cells=[]}={}){
  if(!Array.isArray(options))throw Error('Retreat preview expects validated post-roll options');
  const centers=new Map((Array.isArray(cells)?cells:[]).filter(c=>validHex(c.id)&&finitePoint(c)).map(c=>[c.id,c.pixelCenter]));
  const grouped=new Map();
  for(const action of options){
   if(action?.type!=='combat'||action.action?.type!=='resolve-battle')continue;
   const paths=action.action.choices?.retreatPaths;
   if(!paths||typeof paths!=='object'||Array.isArray(paths)||!Object.keys(paths).length)continue;
   const order=Object.keys(paths).sort();let valid=true;const routes=[];
   for(const unitId of order){
    const from=units?.[unitId]?.hex,via=paths[unitId];
    if(!validHex(from)||!centers.has(from)||!Array.isArray(via)||via.length===0||
       via.some(h=>!validHex(h)||!centers.has(h))){valid=false;break;}
    const hexes=[from,...via];
    routes.push({unitId,from,to:via.at(-1),hexes,points:hexes.map(h=>[...centers.get(h)])});
   }
   if(!valid)continue; // Never draw speculative/incomplete map paths.
   const key=JSON.stringify(order.map(id=>[id,paths[id]]));
   if(!grouped.has(key))grouped.set(key,{key,routes,options:[]});
   grouped.get(key).options.push(action);
  }
  const routes=[...grouped.values()].map((g,i)=>({...g,id:'retreat-'+i,
   label:g.routes.map(r=>r.hexes.join(' → ')).join(' ; '),
   destinations:[...new Set(g.routes.map(r=>r.to))]}));
  const byDestination=Object.create(null);
  for(const route of routes)for(const hex of route.destinations)(byDestination[hex]??=[]).push(route.id);
  return {active:routes.length>0,routes,byDestination,optionsCount:options.length,
   instruction:routes.length?'Choose an engine-legal retreat arrow or destination to preview its path. Then choose and confirm a complete combat result.':''};
 }
 function routeById(m,id){return m?.routes?.find(r=>r.id===id)||null;}
 function actionsForRoute(m,id){return routeById(m,id)?.options||[];}
 function atDestination(m,hex){return m?.byDestination?.[hex]||[];}
 function segment(from,to,trim=5){
  const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy);
  if(!length||length<=trim*2)return null;
  const u=dx/length,v=dy/length;
  return {start:[from[0]+u*trim,from[1]+v*trim],end:[to[0]-u*trim,to[1]-v*trim]};
 }
 // Filled block arrow with square shaft ends and sharp right-angle shoulders.
 // Unlike SVG stroked lines + markers, its corners cannot be rounded by
 // linecap/linejoin styles or scaled marker outlines. Geometry only: the
 // authoritative campaign continues to provide every legal retreat route.
 function blockArrowPoints(start,end,{shaftHalfWidth=5.2,headHalfWidth=12,headLength=17}={}){
  if(!Array.isArray(start)||!Array.isArray(end)||start.length!==2||end.length!==2||
     ![...start,...end,shaftHalfWidth,headHalfWidth,headLength].every(Number.isFinite)||
     shaftHalfWidth<=0||headHalfWidth<=shaftHalfWidth||headLength<=0)return null;
  const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy);
  if(length<=headLength+shaftHalfWidth)return null;
  const ux=dx/length,uy=dy/length,nx=-uy,ny=ux;
  const shoulder=[end[0]-ux*headLength,end[1]-uy*headLength];
  const point=(p,side,half)=>[(p[0]+nx*side*half).toFixed(2),(p[1]+ny*side*half).toFixed(2)].join(',');
  return [point(start,1,shaftHalfWidth),point(shoulder,1,shaftHalfWidth),
   point(shoulder,1,headHalfWidth),end.map(v=>v.toFixed(2)).join(','),
   point(shoulder,-1,headHalfWidth),point(shoulder,-1,shaftHalfWidth),
   point(start,-1,shaftHalfWidth)].join(' ');
 }
 return Object.freeze({model,routeById,actionsForRoute,atDestination,segment,blockArrowPoints});
});
