/* Shared browser-only presentation settings for all historical games.
 * No movement, rules, saved campaign data, source SVG or counter art is modified.
 */
(function(root,factory){
 const terrain=(typeof module==='object'&&module.exports)?require('./terrain_tiles'):root.HexTerrainTiles;
 const api=factory(terrain);root.WargameDisplaySettings=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(T){
'use strict';
const STORAGE_KEY='russian-campaign.display-settings.v1';
const DEFAULT=Object.freeze({largerCounters:false,showCoast:true,coastWavelets:true,terrainTooltips:true});
const ENLARGEMENT=1.25;
function normalize(value){return Object.fromEntries(Object.entries(DEFAULT).map(([k,v])=>[k,typeof value?.[k]==='boolean'?value[k]:v]));}
function load(){try{return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)))}catch(_){return normalize();}}
function store(value){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(normalize(value)))}catch(_){/* file: and blocked storage remain usable */}}
function coastSupported(board){
 return !!((board?.sourceWaterRoutes||[]).some(r=>r.kind==='coast') ||
   (board?.authoredShoreHexsides||[]).some(e=>e.kind==='coast') ||
   (board?.cells||[]).some(c=>Object.values(c.hexsideFeatures||{}).some(f=>f?.type==='coast')||
    Object.values(c.tileEdges||{}).some(edges=>(Array.isArray(edges)?edges:[edges]).some(e=>e?.kind==='coast')))||
   (board?.waterBodies||[]).some(body=>body.kind==='sea'));
}
function counterScale(value){return normalize(value).largerCounters?ENLARGEMENT:1;}
function setupTabs(aside){
 const buttons=[...aside.querySelectorAll('[data-game-tab]')];
 const select=name=>{
  if(!['play','settings'].includes(name))throw Error('Unknown browser tab');
  aside.dataset.activeTab=name;
  for(const b of buttons){const active=b.dataset.gameTab===name;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
  const settings=aside.querySelector('#settings-section');if(settings)settings.hidden=name!=='settings';
 };
 for(const b of buttons)b.addEventListener('click',()=>select(b.dataset.gameTab));
 aside.addEventListener('keydown',ev=>{
  if(!['ArrowLeft','ArrowRight'].includes(ev.key)||!buttons.includes(document.activeElement))return;
  ev.preventDefault();const i=buttons.indexOf(document.activeElement),next=buttons[(i+(ev.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];
  select(next.dataset.gameTab);next.focus();
 });
 select('play');return select;
}
function mount(rootElement,board,{onChange=()=>{}}={}){
 if(!rootElement)throw Error('Missing game display settings container');
 const controls=[
  ['largerCounters','Larger counters (125%)'],
  ['showCoast','Show Coast'],
  ['coastWavelets','Render Coast wavelets'],
  ['terrainTooltips','Terrain and effects on desktop hover']
 ];
 rootElement.replaceChildren();
 const heading=document.createElement('h3');heading.textContent='Map display';rootElement.append(heading);
 const inputs={};let value=load();const supported=coastSupported(board);
 for(const [id,title] of controls){
  const label=document.createElement('label');label.className='setting-switch';
  const input=document.createElement('input');input.type='checkbox';input.id='display-'+id;
  label.append(input,document.createTextNode(' '+title));rootElement.append(label);inputs[id]=input;
  input.addEventListener('change',()=>{
   value=normalize({...value,[id]:input.checked});store(value);sync();onChange({...value});
  });
 }
 const help=document.createElement('p');help.className='setting-caption';
 help.textContent=supported?'Coast settings affect map appearance only; movement and combat geography are unchanged.':'This map has no authored Coast feature. Coast controls are unavailable.';
 rootElement.append(help);
 const tipHelp=document.createElement('p');tipHelp.className='setting-caption';
 tipHelp.textContent='Pause over a hex to inspect its base movement and combat effects. The reference disappears during map actions; touch devices do not display it.';rootElement.append(tipHelp);
 function sync(){for(const [k] of controls)inputs[k].checked=value[k];
  inputs.showCoast.disabled=!supported;
  inputs.coastWavelets.disabled=!supported||!value.showCoast;
  inputs.coastWavelets.closest('label').classList.toggle('setting-disabled',inputs.coastWavelets.disabled);
  inputs.showCoast.closest('label').classList.toggle('setting-disabled',!supported);
 }
 sync();globalThis.WargameResponsiveShell?.attachSettings(rootElement);return {get:()=>({...value}),set:next=>{value=normalize({...value,...next});store(value);sync();onChange({...value})},supported};
}
/* Coast geometry is owned exclusively by the universal terrain renderer.
 * This control module does not draw or interpret map hexsides. */
function applyCoast(svg,board,settings){
 if(!T?.applyCoastPresentation)throw Error('Shared terrain renderer not loaded');
 return T.applyCoastPresentation(svg,board,normalize(settings));
}
/* One browser presentation for either CRT. Values come from the active rules, never artwork. */
const CRT_OUTCOME_COLORS=Object.freeze({
 EX:Object.freeze(['#FF9900','#000000']),
 AL:Object.freeze(['#FF2000','#FFFFFF']),
 NE:Object.freeze(['#FFFFFF','#000000']),
 DR:Object.freeze(['#CCCCCC','#000000']),
 DE:Object.freeze(['#555649','#FFFFFF']),
 DRL:Object.freeze(['#B8BAA9','#000000'])
});
function renderCRT(columns,variant){
 const table=document.createElement('table');table.className='crt-reference-table';table.dataset.crtVariant=variant;
 const odds=Object.keys(columns).map(Number).sort((a,b)=>a-b);
 const label=x=>x===0.5?'1:2':x===1.5?'3:2':x+':1';
 const heading=table.createTHead().insertRow();
 const cell=(row,tag,value,bg,fg='#000')=>{const c=document.createElement(tag);c.textContent=value;c.style.backgroundColor=bg;c.style.color=fg;c.style.fontWeight='700';row.append(c);return c;};
 cell(heading,'th','Die','#9eafb9').scope='col';
 odds.forEach((x,i)=>{cell(heading,'th',label(x),i%2?'#333333':'#000000','#fff').scope='col';});
 const body=table.createTBody();
 for(let d=1;d<=6;d++){
  const row=body.insertRow(),odd=d%2===1;
  cell(row,'th',String(d),odd?'#c5cdd2':'#9eafb9').scope='row';
  for(const x of odds){
   const v=columns[String(x)][d-1];
   const [bg,fg]=CRT_OUTCOME_COLORS[v]||['#FFFFFF','#000000'];
   const c=cell(row,'td',v,bg,fg);
   c.className='crt-cell crt-cell-'+v.toLowerCase()+' crt-row-'+d+' crt-odds-'+label(x).replace(':','-');
   c.dataset.outcome=v;c.dataset.die=String(d);c.dataset.odds=label(x);
  }
 }
 return table;
}
return Object.freeze({DEFAULT,ENLARGEMENT,STORAGE_KEY,normalize,counterScale,coastSupported,setupTabs,mount,applyCoast,renderCRT});
});
