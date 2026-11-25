/* Display-only order for overlapping counters. The gameplay state and stacking
 * capacity/legality remain exclusively in their respective rules engines.
 * The first item is at the back; the last is visually on top.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameStackView=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function key(position){return `${position.x},${position.y}`;}
function create(){
 const orders=new Map();
 function ordered(units,position){
  const group=units.filter(u=>u.position&&key(u.position)===key(position)&&u.strength!=='dead');
  const known=orders.get(key(position))||[];
  // Preserve the prior visible order for counters that remain at this hex,
  // append newly arrived counters on top. A moved-away counter is discarded.
  const ids=new Set(group.map(u=>u.id));
  const next=[...known.filter(id=>ids.has(id)),...group.filter(u=>!known.includes(u.id)).map(u=>u.id)];
  orders.set(key(position),next);
  const byId=new Map(group.map(u=>[u.id,u]));
  return next.map(id=>byId.get(id));
 }
 function top(units,position){const group=ordered(units,position);return group[group.length-1]||null;}
 function swapTopBottom(units,position){const group=ordered(units,position);if(group.length<2)return null;
  const ids=group.map(u=>u.id);[ids[0],ids[ids.length-1]]=[ids[ids.length-1],ids[0]];
  orders.set(key(position),ids);return top(units,position);
 }
 function orderUnits(units){const groups=new Map();for(const u of units){if(!u.position||u.strength==='dead')continue;
  const k=key(u.position);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(u);
 }
 const result=[];for(const members of groups.values())result.push(...ordered(members,members[0].position));return result;
 }
 function reset(){orders.clear();}
 return {ordered,top,swapTopBottom,orderUnits,reset};
}
return Object.freeze({create});
});
