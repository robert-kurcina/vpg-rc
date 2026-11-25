/* Exact official counter vector art from the user's counters-temp.svg.
   Pure presentation: rules, AI and damage decisions remain with the engine.
   Import script: scripts/import-official-counters.py */
(function(root,factory){const t=(typeof module==='object'&&module.exports)?require('./official_counter_templates'):root.WargameOfficialCounters;const api=factory(t);if(typeof module==='object'&&module.exports)module.exports=api;root.WargameCounterVisuals=api;})(typeof globalThis!=='undefined'?globalThis:this,function(T){
'use strict';
const NATO=Object.freeze(['infantry','armor','mechanized','shock','artillery','cavalry','support','depot']);
const KINDS=Object.freeze(['army-2','army-3','stuka','air','fleet']);
// The template geometry comes from counters-temp.svg. These *optional* game
// palettes are sampled from its embedded Battle for Moscow counter-sheet.
// Never infer a counter face from a generic faction CSS color.
const PALETTES=Object.freeze({battleForMoscow:Object.freeze({
 german:Object.freeze({primary:'#d0dbd4',secondary:'#d3ddd7'}),
 soviet:Object.freeze({primary:'#d0a67e',secondary:'#eb6f77'})
})});
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toFixed(3);
// One counter-to-hex geometry standard across every historical map.
// Baseline is the approved B4M shared browser: 46 units against a 101.9-unit
// high flat-topped hex (ry=58.83199243042287, vertical extent sqrt(3)*ry).
// This is a dimensionless ratio, not a fixed 46-pixel rule for every map.
const COUNTER_TO_HEX_HEIGHT=46/101.9;
function sizeForHexHeight(hexHeight){
 if(typeof hexHeight!=='number'||!Number.isFinite(hexHeight)||hexHeight<=0)throw Error('Invalid authoritative hex height');
 return Number((hexHeight*COUNTER_TO_HEX_HEIGHT).toFixed(3));
}
function sizeForMap(map){
 const height=map?.geometry?.calibration?.pitchY;
 if(typeof height==='number')return sizeForHexHeight(height);
 // The older B4M board predates the calibrated geometry metadata. Recover
 // the same vertical pitch from consecutive rows in a single hex column.
 const byColumn=new Map();
 for(const c of map?.cells||[]){
  const center=c.pixelCenter, id=String(c.id||'');
  if(!Array.isArray(center)||!Number.isFinite(center[1])||!/^[0-9]{4}$/.test(id))continue;
  const col=id.slice(0,2),row=Number(id.slice(2));
  if(!byColumn.has(col))byColumn.set(col,[]);
  byColumn.get(col).push([row,center[1]]);
 }
 const pitches=[];
 for(const cells of byColumn.values()){
  cells.sort((a,b)=>a[0]-b[0]);
  for(let i=1;i<cells.length;i++){
   const dr=cells[i][0]-cells[i-1][0];
   if(dr>0){const pitch=Math.abs(cells[i][1]-cells[i-1][1])/dr;if(pitch>0)pitches.push(pitch)}
  }
 }
 if(!pitches.length)throw Error('No authoritative map hex height');
 pitches.sort((a,b)=>a-b);
 return sizeForHexHeight(pitches[Math.floor(pitches.length/2)]);
}
function color(s,defaultColor){return typeof s==='string'&&/^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|black|white|transparent)$/.test(s)?s:defaultColor;}
function val(x,fallback=''){return x===null||x===undefined?fallback:x;}
// Choose damage-strip contrast from the visible counter face, not its faction.
// Historical Soviet faces include scarlet fronts and pale salmon reverses;
// ochre, brown, green, blue and neutral fields retain the authored red strip.
function redCounterField(field){
 const hex=String(field||'').replace(/^#/,'');
 const digits=/^[0-9a-f]{3,4}$/i.test(hex)?hex.slice(0,3).split('').map(v=>parseInt(v+v,16)):
  /^[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(hex)?[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)):null;
 if(!digits)return false;
 const [r,g,b]=digits.map(x=>x/255),hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo;
 if(delta===0 || delta/hi<0.22)return false;
 let hue=hi===r?60*(((g-b)/delta+6)%6):hi===g?60*((b-r)/delta+2):60*((r-g)/delta+4);
 return hue<=18||hue>=342;
}
// For faction colors darker than the source grey, use black/white contrast.
function contrast(hex){const h=(hex||'').replace(/^#/,'');if(!/^[0-9a-f]{6}$/i.test(h))return '#000000';const rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const lum=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;return lum<.179?'#ffffff':'#000000';}
function model(u,base){
 const meta=u.counter||{};
 const template=meta.template||u.counterTemplate||u.counterKind||'army-2';
 const kind=KINDS.includes(template)?template:'army-2';
 const damaged=u.strength==='reduced'||u.damaged===true||u.counterStatus==='damaged';
 const face=(meta.faces||{})[damaged?'damaged':'full']||{};
 const colors=meta.colors||u.counterColors||{};
 const primary=color(face.color||colors.primary||base,'#909f97');
 const secondary=color(colors.secondary,'#d3ddd7');
 const digits=face.digits||(!damaged?meta.digits:meta.damagedDigits)||null;
 const combat=damaged?val(u.combatReduced,val(u.reduced,u.combatFull)):val(u.combatFull,val(u.full,u.combat));
 const atk=damaged?val(u.reducedAttack,combat):val(u.attack,val(u.offense,combat));
 const def=damaged?val(u.reducedDefense,combat):val(u.defense,combat);
 const mov=damaged?val(u.reducedMovement,u.movement):u.movement;
 const offense=val(face.offense,val(digits?.[0],atk));
 const defense=val(face.defense,val(digits?.[1],kind==='army-3'?def:mov));
 const movement=val(face.movement,val(digits?.[2],mov));
 const power=val(face.value,val(digits?.[0],damaged?val(u.airReducedShift,val(u.airShift,combat)):val(u.airShift,combat)));
 const rawNato=meta.nato||u.nato||u.type;
 const nato=({tank:'armor',panzer:'armor',motorized:'mechanized',mechanised:'mechanized',rifle:'infantry'})[rawNato]||rawNato;
 const palette=colors.digits||{};
 const fc=(name,index,fallback)=>color(face.digitColors?.[name]||palette[name]||(Array.isArray(palette)?palette[index]:undefined),fallback);
 const vars={
  primary,secondary,unit_id:safe(val(face.name,val(meta.name,val(u.label,u.id)))),size:safe(val(meta.size,val(u.size,'XXX'))),
  offense:safe(offense),defense:safe(kind==='army-2'?defense:kind==='army-3'?defense:power),movement:safe(movement),
  damage_text:safe(val(face.damageText,val(meta.damageText,'DAMAGED'))),
  dash:'-',dash_left:'-',dash_right:'-',
  color_reduced_bar:color(colors.reducedBar,redCounterField(primary)?'#ffffff':'#ff0000'),
  color_offense:fc('offense',0,contrast(primary)),color_defense:fc('defense',1,kind==='army-2'?'#ffffff':contrast(primary)),
  color_movement:fc('movement',2,contrast(primary)),color_damage_text:color(colors.damageText,contrast(primary)),color_unit_id:color(colors.nameText,contrast(primary)),color_size:color(colors.sizeText,contrast(primary)),
  status_reduced:damaged?'inline':'none',status_damaged:damaged?'inline':'none',status_undamaged:damaged?'none':'inline'
 };
 for(const entry of NATO)vars['nato_'+entry]=nato===entry?'inline':'none';
 return {kind,vars,damaged,nato:NATO.includes(nato)?nato:null};
}
function piece(u,x=0,y=0,factionColor='#909f97',{width=46,height=46,selected=false,activated=false}={}){
 const m=model(u,factionColor);const source=T?.[m.kind];
 if(!source)throw Error('Missing official counter template '+m.kind);
 // This is a locally extracted, unmodified geometry template; only named
 // fields, visibility and unit-specific colors receive substitutions.
 const body=source.replace(/@@([a-z0-9_]+)@@/g,(all,key)=>{if(!(key in m.vars))throw Error('Missing counter field '+key);return String(m.vars[key]);});
 const id=safe(u.id),side=safe(u.army||u.faction||u.side||'');
 // Phase activation is a pointer-inert overlay, never source counter art.
 const badge=activated?'<g class="counter-activation-badge" data-phase-activated="true" pointer-events="none" aria-hidden="true"><circle cx="47" cy="4.5" r="6.5" fill="#ffffff" stroke="#235a46" stroke-width="1.7"/><path d="M43.9 4.5 L46.2 6.8 L50.2 2.2" fill="none" stroke="#235a46" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>':'';
 return `<g class="counter-vector official-counter" style="user-select:none;-webkit-user-select:none" data-unit-id="${id}" data-counter-template="${m.kind}" data-damaged="${m.damaged?'true':'false'}" data-nato-active="${m.nato||''}" data-side="${side}" data-layer-order="15" transform="translate(${fmt(x)},${fmt(y)}) scale(${fmt(width/50)},${fmt(height/50)})">`+
 body+`<rect class="counter-hit-area" data-interaction="counter-body" x="0" y="0" width="50" height="50" fill="transparent" stroke="none" pointer-events="all"/>`+`<rect class="counter-selection-frame" x="-0.9" y="-0.9" width="51.8" height="51.8" rx="2.5" fill="none" stroke="${selected?'#f1b932':'transparent'}" stroke-width="2.6" pointer-events="none"/>`+
 `<title>${id} — ${m.kind}${m.damaged?' (damaged)':''}</title>${badge}</g>`;
}
function layer(units,centerFor,factionColor,{width=44,height=44,selectedIds=[],activatedIds=[],stackOffsetX=7,stackOffsetY=6}={}){
 let out='<g class="universal-counter-layer" data-layer="unit-counters" data-layer-order="15">';
 const groups=new Map(),select=new Set(selectedIds),activated=new Set(activatedIds);
 for(const u of units){if(!u.position||u.strength==='dead')continue;const key=u.position.x+','+u.position.y;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(u);}
 for(const group of groups.values()){
  const {x,y}=centerFor(group[0].position),n=group.length,dx=stackOffsetX,dy=stackOffsetY;
  group.forEach((u,i)=>{
   const xx=x-width/2+(i-(n-1)/2)*dx,yy=y-height/2+(i-(n-1)/2)*dy;
   const raw=typeof factionColor==='function'?factionColor(u.army||u.faction||u.side):'#909f97';
   const svg=piece(u,xx,yy,raw,{width,height,selected:select.has(u.id),activated:activated.has(u.id)});
   out+=svg.replace('data-layer-order="15"',`data-stack-key="${safe(group[0].position.x+','+group[0].position.y)}" data-stack-index="${i}" data-stack-size="${n}" data-stack-top="${i===n-1?'true':'false'}" data-layer-order="15"`);
  });
 }
 return out+'</g>';
}
return Object.freeze({KINDS,NATO,PALETTES,COUNTER_TO_HEX_HEIGHT,sizeForHexHeight,sizeForMap,model,piece,layer});
});
