/* Shared, read-only scenario reference dialog. Content is supplied by the
 * active controller; never changes game settings or dispatches actions. */
(function(root){'use strict';
 const tabs=[['sequence','Sequence of Play'],['howto','How To'],['terrain','Terrain Effects'],['crt','Combat Results']];
 function mount(host,render){
  const trigger=document.createElement('button');trigger.type='button';trigger.id='game-reference-open';trigger.textContent='Rules & Charts';trigger.setAttribute('aria-haspopup','dialog');host.append(trigger);
  const dialog=document.createElement('dialog');dialog.id='game-reference-dialog';dialog.setAttribute('aria-labelledby','game-reference-title');
  const heading=document.createElement('h2');heading.id='game-reference-title';heading.textContent='Rules & Charts';
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.setAttribute('aria-label','Close rules and charts');
  const bar=document.createElement('div');bar.className='reference-dialog-heading';bar.append(heading,close);
  const strip=document.createElement('div');strip.className='reference-dialog-tabs';strip.setAttribute('role','tablist');strip.setAttribute('aria-label','Rules and charts');
  const panel=document.createElement('div');panel.id='game-reference-panel';panel.setAttribute('role','tabpanel');panel.tabIndex=0;
  const buttons=tabs.map(([id,label])=>{const b=document.createElement('button');b.type='button';b.id='game-reference-tab-'+id;b.dataset.referenceDialogTab=id;b.textContent=label;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);strip.append(b);return b;});
  let active=0,returnFocus=trigger;
  function select(i,focus=false){active=i;for(const [j,b] of buttons.entries()){b.tabIndex=i===j?0:-1;b.setAttribute('aria-selected',String(i===j));}panel.setAttribute('aria-labelledby',buttons[i].id);panel.replaceChildren();render(tabs[i][0],panel);if(focus)buttons[i].focus();}
  buttons.forEach((b,i)=>b.addEventListener('click',()=>select(i)));
  strip.addEventListener('keydown',e=>{const i=buttons.indexOf(document.activeElement);if(i<0)return;const next={ArrowRight:(i+1)%4,ArrowLeft:(i+3)%4,Home:0,End:3}[e.key];if(next===undefined)return;e.preventDefault();select(next,true);});
  // Do not let modal keyboard events reach the underlying game or mobile drawer.
  dialog.addEventListener('keydown',e=>e.stopPropagation());
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus?.focus());
  function open(tab=tabs[active][0],focusTarget=trigger){const index=tabs.findIndex(([id])=>id===tab);if(index<0)throw Error('Unknown reference tab');returnFocus=focusTarget;select(index);if(!dialog.open)dialog.showModal();buttons[active].focus();}
  trigger.addEventListener('click',()=>open());
  dialog.append(bar,strip,panel);document.body.append(dialog);
  return Object.freeze({open,refresh(){if(dialog.open)select(active);}});
 }
 // Printed aids are preserved as source evidence, not as an alternate CRT.
 const sourceAids={ 'battle-for-moscow':['b4m-aid.webp','b4m-rules.pdf'],arduous:['arduous-aid.webp','arduous-rules.pdf'],leningrad:['leningrad-aid.webp','leningrad-rules.pdf'],kiev:['kiev-player-aid.webp','kiev-rules.pdf'],'kiev-odessa':['kiev-player-aid.webp','kiev-rules.pdf','odessa-rules.pdf'] };
 const captionKey=k=>k.replace(/-/g,' ').replace(/(^| )\w/g,c=>c.toUpperCase());
 const signed=n=>n===0?'No shift':`${n>0?'+':''}${n} attacker column${Math.abs(n)===1?'':'s'}`;
 function originalRules(holder,scenario){
  const aid=sourceAids[scenario];if(!aid)return;
  const heading=document.createElement('h3');heading.textContent='Original printed rules';holder.append(heading);
  for(const file of aid.slice(1)){const p=document.createElement('p'),a=document.createElement('a');a.textContent=file==='odessa-rules.pdf'?'Odessa expansion rules (PDF)':'Original scenario rules (PDF)';a.href='../../../references/rules/'+file;a.target='_blank';a.rel='noopener';const reader=document.createElement('a');reader.textContent=file==='odessa-rules.pdf'?'Odessa expansion reading edition (HTML)':'Scenario reading edition (HTML)';reader.href=a.href.replace(/\.pdf$/,'.html');reader.target='_blank';reader.rel='noopener';p.append(reader,document.createTextNode(' · '),a);holder.append(p);}
 }
 function terrainRows({movement={},combat={},weather=[]}){
  const m=combat.modifiers||combat,legacy=!combat.modifiers,sign=n=>legacy?-n:n;
  const costs=movement.terrainCosts||{},shifts=m.terrainColumnShifts||combat.terrainShifts||{},rows=[];
  const onlySoviet=combat.fortificationMode==='soviet-defender-only-v1'||(combat.terrainDefenderFactions?.fortification||[]).join(',')==='soviet';
  for(const key of new Set([...Object.keys(costs),...Object.keys(shifts)])){
   let effect=signed(sign(shifts[key]??0));
   if(key==='fortification'&&onlySoviet)effect+='; Soviet defender only';
   if(key==='swamp'&&Number.isFinite(m.swampTankStrengthMultiplier))effect+=`; attacking ${(m.swampAffectedClasses||[]).join(' / ')} strength ×${m.swampTankStrengthMultiplier}`;
   rows.push({id:key,name:captionKey(key),move:costs[key]===undefined?'Underlying terrain / scenario rules':`${costs[key]} MP (base)`,effect});
  }
  for(const [key,value] of Object.entries(combat.cityShifts||{}))rows.push({id:'city-'+key,name:key==='moscow'?'Moscow':captionKey(key)+' city',move:'Underlying terrain',effect:signed(sign(value))});
  if(m.allAttackersAcrossRiverShift!==undefined)rows.push({id:'river',name:'River',move:'No separate cost in base profile',effect:signed(sign(m.allAttackersAcrossRiverShift))+' if all attackers cross'});
  if(movement.majorRiverExtraCost>0||Number.isFinite(m.majorRiverAttackMultiplier))rows.push({id:'major-river',name:'Major River',move:movement.majorRiverExtraCost>0?`+${movement.majorRiverExtraCost} MP off connected rail`:'See scenario rules',effect:Number.isFinite(m.majorRiverAttackMultiplier)?`Crossing attacker strength ×${m.majorRiverAttackMultiplier}`:'See scenario rules'});
  if(Number.isFinite(movement.railCost))rows.push({id:'railroad',name:'Railway',move:`${movement.railCost} MP on eligible connected rail`,effect:'No separate railway shift configured'});
  else if(legacy)rows.push({id:'railroad',name:'Railway',move:'Soviet Rail Movement phase; see phase rules',effect:'No separate railway shift configured'});
  for(const w of weather){if(!w.name)continue;const multipliers=Object.entries(w.combatMultipliers||{}).map(([type,n])=>`${type} ×${n}`).join('; ');rows.push({id:'weather-'+w.name,name:`${captionKey(w.name)} (turns ${(w.turns||[]).join(', ')})`,move:w.normalMovementLimit===undefined?'See weather rules':`Non-rail movement limit ${w.normalMovementLimit}${w.railUnaffected?'; rail unaffected':''}`,effect:multipliers||'See weather rules'});}
  return rows;
 }
 function terrain(holder,{scenario,movement,combat,weather}){
  const add=(tag,text,parent=holder)=>{const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;};
  const link=(label,url,parent)=>{const a=add('a',label,parent);a.href=url;a.target='_blank';a.rel='noopener';return a;};
  const base='../../../',aid=sourceAids[scenario];
  add('h3','Active engine terrain effects');
  add('p','Base movement and attacker odds-column shifts; unit class, terrain combinations, weather, phase and hexside restrictions may change the result. City markers do not replace underlying terrain.');
  const table=add('table','');table.className='reference-terrain-table';table.setAttribute('aria-label','Active engine terrain effects');
  const header=table.createTHead().insertRow();for(const label of ['Terrain / feature','Movement','Combat']){const th=add('th',label,header);th.scope='col';}
  const body=table.createTBody();const kiev=scenario==='kiev'||scenario==='kiev-odessa';
  // Reuse certified shared-engine specimens; never invent scenario-specific artwork.
  const specimens=Object.freeze({open:'kiev/open',forest:'kiev/forest',swamp:'kiev/swamp',city:'kiev/city','city-city':'kiev/city','major-city':'kiev/major-city','city-major':'kiev/major-city','city-major-city':'kiev/major-city','city-moscow':'kiev/major-city',river:'kiev/river','major-river':'kiev/major-river',railroad:'kiev/railroad',railway:'kiev/railroad',lake:'leningrad/lake',coast:'kiev-odessa/coast',sea:'kiev-odessa/sea'});
  const specimenFor=id=>Object.hasOwn(specimens,id)?specimens[id]:null;
  const rows=terrainRows({movement,combat,weather});
  for(const row of rows.filter(r=>!r.id.startsWith('weather-'))){
   const tr=body.insertRow();tr.dataset.terrain=row.id;const th=add('th','',tr);th.scope='row';
   const specimen=specimenFor(row.id);
   if(row.id==='fortification'&&root.HexTerrainTiles&&root.WargamePresentation){
    const T=root.HexTerrainTiles,P=root.WargamePresentation;
    const cell={id:'0501',column:1,row:1,pixelCenter:[70,65],terrain:'open',tileMarkers:[{kind:'fortification',status:'source-scenario'}],tileEdges:{}};
    const sample=add('div','',th);sample.className='reference-terrain-specimen';sample.setAttribute('aria-hidden','true');
    sample.innerHTML=T.svgMap({id:'tec-specimen-fortification',geometry:{columnParityDown:'even'},cells:[cell]},P.options('battle-for-moscow',{textures:P.textures(base+'supplied_assets/flat/'),fortificationArtwork:base+'supplied_assets/flat/fortification-overlay.svg',showGrid:true,showNumbers:false,showWaterBodies:false,showEntryEdges:false,width:140,height:130,padding:10,rx:37.8,ry:37.8,hexRegionOutlines:[]}));
    const svg=sample.querySelector('svg');if(svg){svg.setAttribute('width','100%');svg.setAttribute('height','100%');}
   }else if(specimen){const img=add('img','',th);img.src=base+'assets/terrain-chart/'+specimen+'.png';img.alt='';img.className='reference-terrain-specimen';img.loading='lazy';}
   add('span',row.name,th);add('td',row.move,tr);add('td',row.effect,tr);
  }
  add('p','Illustrations are shared-engine terrain examples, not necessarily hexes from this mission. Text values are from the active scenario.');
  const conditional=rows.filter(r=>r.id.startsWith('weather-'));
  if(conditional.length){
   add('h3','Conditional weather effects');
   add('p','These effects apply only during the specified turns and do not replace the terrain artwork.');
   const weatherTable=add('table','');weatherTable.className='reference-terrain-table';weatherTable.setAttribute('aria-label','Conditional weather effects');
   const head=weatherTable.createTHead().insertRow();for(const label of ['Condition','Movement','Combat']){const th=add('th',label,head);th.scope='col';}
   const weatherBody=weatherTable.createTBody();
   for(const row of conditional){const tr=weatherBody.insertRow();tr.dataset.terrain=row.id;const th=add('th',row.name,tr);th.scope='row';add('td',row.move,tr);add('td',row.effect,tr);}
  }
  if(kiev){const p=add('p','');link('Illustrated Kiev–Odessa terrain and territorial reference (existing combined chart)',base+'tools/terrain-effects-chart/index.html',p);}
  if(aid){
   add('h3','Original printed terrain reference');
   add('p','Original player aid, retained unmodified. Printed values may differ from active engine adaptations; use the Combat Results tab for the shared active CRT.');
   const details=add('details','');add('summary','Show original illustrated player aid',details);
   const image=add('img','',details);image.src=base+'references/rules/'+aid[0];image.alt='Original printed terrain effects player aid; full-size version available below';image.className='reference-source-aid';image.loading='lazy';
   const p=add('p','',details);link('Open original player aid at full size',image.getAttribute('src'),p);
   for(const file of aid.slice(1)){const item=add('p','');link(file==='odessa-rules.pdf'?'Odessa expansion rules (PDF)':'Original scenario rules (PDF)',base+'references/rules/'+file,item);}
  }
 }
 function historical(tab,holder,{phaseConfig,profile,combatPolicy,variant}){
  const add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;holder.append(el);return el;};
  add('p','Active engine configuration; consult the original rulebook for complete explanations.');
  if(tab==='sequence'){
   add('p',`${phaseConfig.turns} turns. First-turn starting phase: ${phaseConfig.firstTurnStart}. Special opening and phase exceptions remain governed by the scenario.`);
   const list=add('ol','');for(const p of phaseConfig.phases){const li=document.createElement('li');li.textContent=p.id.replace(/-/g,' ');list.append(li);}
  }else if(tab==='howto'){
   for(const text of ['Choose a legal deployment and confirm the setup when required.','Movement: select a friendly formation and a legal highlighted destination, then confirm any required action.','Combat: select a legal battle proposal and declare the battles before committing dice. Choose the available consequences for each committed roll.','Use the phase action controls for mandatory decisions, reinforcement, support and phase completion.','Undo and Redo restore committed actions. Save JSON exports the current session.'])add('p',text);
   originalRules(holder,phaseConfig.scenarioId);
  }else if(tab==='terrain'){
   terrain(holder,{scenario:phaseConfig.scenarioId,movement:profile,combat:combatPolicy});
  }else if(tab==='crt'){
   add('p',`${variant==='advanced'?'Advanced':'Standard'} CRT — active game, not the next-game preference.`);
   const scroll=add('div','');scroll.className='crt-reference-scroll';scroll.append(root.WargameDisplaySettings.renderCRT(root.WargameHistoricalCRT.columns(variant),variant));
  }
 }
 root.WargameReferenceDialog=Object.freeze({mount,historical,terrain,terrainRows,originalRules});
})(globalThis);
