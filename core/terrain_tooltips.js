/* Non-interactive desktop map reference; reads source cells and scenario rules.
 * Never computes a legal move, certifies a hexside, or changes game state.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameTerrainTooltips=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const FIRST_HOVER_MS=380, NEXT_HEX_MS=190, PADDING=8, OFFSET=18;
 const ARROW_DEPTH=8, ARROW_HALF_BASE=8, ARROW_SAFE=14;
 const SIDES=['N','NE','SE','S','SW','NW'];
 const cap=s=>String(s||'unknown').replace(/(^|[- ])\w/g,x=>x.toUpperCase());
 const signed=n=>(n>0?'+':'')+String(n);
 const effect=n=>n===0?'No terrain odds-column modifier':`${signed(n)} attacker odds column${Math.abs(n)===1?'':'s'}`;
 const edgeSides=(cell,kind,sourceSides=null)=>sourceSides?.[cell.id]?.[kind]??SIDES.filter(side=>
  (Array.isArray(cell.tileEdges?.[side])?cell.tileEdges[side]:cell.tileEdges?.[side]?[cell.tileEdges[side]]:[]).some(e=>e?.kind===kind));
 // Explicitly certified movement edges are the only non-SVG route to a side.
 // This has no effect on the movement graph or on the map renderer.
 function certifiedSides(board,edgeBoard,neighbor){
  if(!edgeBoard)return null;
  if(!Array.isArray(edgeBoard.edges)||typeof neighbor!=='function')throw Error('Certified hexside lookup unavailable');
  const cells=new Map(board.cells.map(c=>[c.id,c]));
  const result=Object.fromEntries(board.cells.map(c=>[c.id,{rail:[],river:[],majorRiver:[]}]));
  for(const e of edgeBoard.edges){
   if(e.verified!==true)throw Error('Tooltip edge lacks movement certification');
   for(const [a,b] of [[e.a,e.b],[e.b,e.a]]){
    const cell=cells.get(a);if(!cell||!cells.has(b))throw Error('Tooltip graph references unknown hex');
    const dir=SIDES.find(side=>neighbor(cell,side,board.geometry)===b);
    if(!dir)throw Error('Tooltip graph does not match source hex geometry');
    for(const kind of ['rail','river','majorRiver'])if(e[kind]===true)result[a][kind].push(dir);
   }
  }
  for(const sides of Object.values(result))for(const key of Object.keys(sides))sides[key].sort((a,b)=>SIDES.indexOf(a)-SIDES.indexOf(b));
  return result;
 }
 function describe(cell,{movement={},combat={},sourceSides=null}={}){
  if(!cell?.id)throw Error('Hex must have an ID');
  const terrain=cell.terrain||'unknown',markers=cell.tileMarkers||[];
  const major=markers.find(m=>m.kind==='majorCity'),city=markers.find(m=>m.kind==='city');
  const fortified=markers.some(m=>m.kind==='fortification');
  const location=major||city;
  const name=location?.label?` · ${location.label}`:'';
  const title=`${cell.id} · ${major?'Major City':city?'City':cap(terrain)}${name}`;
  const costs=movement.terrainCosts||{};
  // The executable movement board charges the underlying registered terrain.
  // City is a marker, not an automatic movement-cost override.
  const costKey=terrain;
  const cost=costs[costKey];
  const move=Number.isFinite(cost)?`${cost} MP to enter (base)`:'No base land-entry cost specified';
  const modifiers=combat.modifiers||combat;
  // Historical shared CRT records negative attacker shifts; B4M's legacy
  // engine stores positive defensive steps, then subtracts them from the odds.
  const shifts=modifiers.terrainColumnShifts||combat.terrainShifts||{};
  const oldConvention=!modifiers.terrainColumnShifts;
  const attackingShift=x=>oldConvention?-x:x;
  const cityShift=combat.cityShifts||{};
  const terrainValue=major?(shifts['major-city']??(oldConvention?(cityShift.major??cityShift.moscow??shifts[terrain]??0):(shifts[terrain]??0))):
   city?(shifts.city??shifts[terrain]??0):(shifts[terrain]??0);
  const lines=[title,`Movement: ${move}`,`Combat: ${effect(attackingShift(terrainValue))}`];
  if(fortified){
   const fortShift=attackingShift(shifts.fortification??0);
   const onlySoviet=combat.fortificationMode==='soviet-defender-only-v1'||
    (combat.terrainDefenderFactions?.fortification||[]).join(',')==='soviet';
   if(fortShift)lines.push(`Fortification: ${effect(fortShift)}${onlySoviet?' (Soviet defender only)':' (when applicable)'}; not additive to terrain by default`);
   else lines.push('Fortification: see scenario rules');
  }
  if(terrain==='swamp'&&Number.isFinite(modifiers.swampTankStrengthMultiplier)&&modifiers.swampTankStrengthMultiplier<1)
   lines.push(`Swamp attack: ×${modifiers.swampTankStrengthMultiplier} for ${(modifiers.swampAffectedClasses||['armor']).join(' / ')}`);
  const rails=edgeSides(cell,'rail',sourceSides),rivers=edgeSides(cell,'river',sourceSides),majorRivers=edgeSides(cell,'majorRiver',sourceSides);
  if(rails.length)lines.push(`Rail sides: ${rails.join(', ')}${Number.isFinite(movement.railCost)?` · ${movement.railCost} MP on eligible rail moves`:' · rail mode subject to rules'}`);
  if(rivers.length){
   const shift=attackingShift(modifiers.allAttackersAcrossRiverShift??0);
   lines.push(`River sides: ${rivers.join(', ')}${shift?` · ${effect(shift)} if every attacker crosses`:' · crossing effects subject to rules'}`);
  }
  if(majorRivers.length){
   const terms=[];
   if(movement.majorRiverExtraCost>0)terms.push(`+${movement.majorRiverExtraCost} MP when crossing off rail`);
   if(modifiers.majorRiverAttackMultiplier===0.5)terms.push('each crossing attacker ×½, rounded down individually');
   lines.push(`Major River sides: ${majorRivers.join(', ')}${terms.length?' · '+terms.join('; '):' · see scenario rules'}`);
  }
  if(typeof cell.terrainStatus==='string'&&(/provisional|unverified|candidate/.test(cell.terrainStatus)))
   lines.push('Source status: provisional; do not use as verified rules evidence');
  return lines.join('\n');
 }
 // A placement is calculated once per hovered hex and never follows cursor jitter.
 // Direction names refer to the panel's position relative to its anchor.
 // A separate noninteractive pointer avoids clipping by the panel's overflow rule.
 function placement(x,y,width,height,viewportWidth,viewportHeight){
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const w=Math.max(0,width),h=Math.max(0,height),vw=viewportWidth,vh=viewportHeight;
  const room={right:vw-PADDING-x-OFFSET,left:x-OFFSET-PADDING,
   bottom:vh-PADDING-y-OFFSET,top:y-OFFSET-PADDING};
  const need={right:w,left:w,bottom:h,top:h};
  // Preserve a horizontal side callout where there is room; fall back to vertical
  // sides and then the least-overflowing direction in tiny desktop windows.
  const preference=['right','left','bottom','top'];
  const side=preference.find(k=>room[k]>=need[k])||preference.reduce((best,k)=>
   (room[k]-need[k])>(room[best]-need[best])?k:best);
  const limX=Math.max(PADDING,vw-w-PADDING),limY=Math.max(PADDING,vh-h-PADDING);
  const horizontal=side==='right'||side==='left';
  const left=clamp(horizontal?(side==='right'?x+OFFSET:x-OFFSET-w):x-w*0.3,PADDING,limX);
  const top=clamp(horizontal?y-Math.min(48,Math.max(22,h*0.25)):(side==='bottom'?y+OFFSET:y-OFFSET-h),PADDING,limY);
  const arrowX=horizontal?(side==='right'?left-ARROW_DEPTH:left+w):
   clamp(x,left+ARROW_SAFE,left+w-ARROW_SAFE)-ARROW_HALF_BASE;
  const arrowY=horizontal?clamp(y,top+ARROW_SAFE,top+h-ARROW_SAFE)-ARROW_HALF_BASE:
   (side==='bottom'?top-ARROW_DEPTH:top+h);
  return {left,top,side,arrowX,arrowY};
 }
 function canHover(){return typeof matchMedia==='function'&&matchMedia('(hover: hover) and (pointer: fine)').matches&&!(navigator.maxTouchPoints>0);}
 function mount({surface,board,settings,gameRules={},edgeBoard=null,unitsAtHex=null}={}){
  if(!surface||!Array.isArray(board?.cells)||!settings)throw Error('Tooltip requires source map and Settings');
  const map=new Map(board.cells.map(c=>[c.id,c]));
  const sourceSides=certifiedSides(board,edgeBoard,globalThis.HexTerrainTiles?.neighbor);
  const node=document.createElement('div');node.className='wargame-terrain-tooltip';node.hidden=true;
  node.id='wargame-terrain-hover-reference';node.setAttribute('role','tooltip');document.body.append(node);
  const pointer=document.createElement('div');pointer.className='wargame-tooltip-pointer';
  pointer.setAttribute('aria-hidden','true');pointer.hidden=true;document.body.append(pointer);
  let timer=null,pendingHex=null,visibleHex=null,dismissedHex=null,priorVisible=false;
  function cancel(){if(timer!==null){clearTimeout(timer);timer=null;}pendingHex=null;}
  function hide(){cancel();priorVisible=!!visibleHex;visibleHex=null;node.hidden=true;pointer.hidden=true;delete node.dataset.hex;}
  function fill(hex){
   const lines=describe(map.get(hex),{...gameRules,sourceSides}).split('\n');node.replaceChildren();
   const heading=document.createElement('div');heading.className='wargame-tooltip-heading';heading.textContent=lines.shift();node.append(heading);
   for(const line of lines){const row=document.createElement('div');row.className='wargame-tooltip-line';const cut=line.indexOf(':');
    if(cut>0){const label=document.createElement('strong');label.className='wargame-tooltip-label';label.textContent=line.slice(0,cut+1);row.append(label,document.createTextNode(line.slice(cut+1)));}
    else row.textContent=line;node.append(row);}
   const footer=document.createElement('div');footer.className='wargame-tooltip-note';footer.textContent='Base effects only · weather, units and phases may alter results';node.append(footer);
  }
  function place(x,y){
   const rect=node.getBoundingClientRect();
   const layout=placement(x,y,rect.width,rect.height,innerWidth,innerHeight);
   node.style.left=layout.left+'px';node.style.top=layout.top+'px';
   pointer.dataset.side=layout.side;
   pointer.style.left=layout.arrowX+'px';pointer.style.top=layout.arrowY+'px';
   pointer.hidden=false;
  }
  function reveal(hex,x,y){
   timer=null;pendingHex=null;
   if(dismissedHex===hex||!settings.get().terrainTooltips||!canHover()||!surface.isConnected)return;
   fill(hex);node.hidden=false;node.dataset.hex=hex;visibleHex=hex;priorVisible=true;place(x,y);
  }
  function onmove(event){
   if(event.pointerType&&event.pointerType!=='mouse'||event.buttons||!settings.get().terrainTooltips||!canHover())return hide();
   const hit=event.target.closest?.('[data-hex],[data-board-cell],[data-native-unit],[data-unit-id]');
   let hex=hit?.getAttribute('data-hex')||hit?.getAttribute('data-board-cell');
   if(!hex&&typeof unitsAtHex==='function')hex=unitsAtHex(hit);
   if(!map.has(hex)){dismissedHex=null;return hide();}
   if(hex!==dismissedHex)dismissedHex=null;
   if(visibleHex===hex)return; // retain original anchor, do not follow cursor
   if(pendingHex===hex)return; // pointer jitter within one hex
   const quick=!!visibleHex||priorVisible;
   hide();pendingHex=hex;
   const x=event.clientX,y=event.clientY;
   timer=setTimeout(()=>reveal(hex,x,y),quick?NEXT_HEX_MS:FIRST_HOVER_MS);
  }
  function onexit(){hide();dismissedHex=null;priorVisible=false;}
  function onkey(event){if(event.key==='Escape'&&(visibleHex||pendingHex)){dismissedHex=visibleHex||pendingHex;hide();}}
  const onvisibility=()=>{if(document.hidden)onexit();};
  surface.addEventListener('pointermove',onmove);
  surface.addEventListener('pointerleave',onexit);
  surface.addEventListener('pointerdown',onexit);
  surface.addEventListener('pointercancel',onexit);
  surface.addEventListener('wheel',onexit,{passive:true});
  surface.addEventListener('contextmenu',onexit);
  document.addEventListener('scroll',onexit,true); // scroll ancestors and map scroll
  document.addEventListener('keydown',onkey);
  document.addEventListener('visibilitychange',onvisibility);
  window.addEventListener('blur',onexit);
  window.addEventListener('resize',onexit);
  const destroy=()=>{
   onexit();surface.removeEventListener('pointermove',onmove);surface.removeEventListener('pointerleave',onexit);
   surface.removeEventListener('pointerdown',onexit);surface.removeEventListener('pointercancel',onexit);
   surface.removeEventListener('wheel',onexit);surface.removeEventListener('contextmenu',onexit);
   document.removeEventListener('scroll',onexit,true);document.removeEventListener('keydown',onkey);
   document.removeEventListener('visibilitychange',onvisibility);window.removeEventListener('blur',onexit);window.removeEventListener('resize',onexit);node.remove();pointer.remove();
  };
  return Object.freeze({hide,destroy,element:node,pointer});
 }
 return Object.freeze({describe,mount,canHover,FIRST_HOVER_MS,NEXT_HEX_MS,edgeSides,certifiedSides,placement});
});
