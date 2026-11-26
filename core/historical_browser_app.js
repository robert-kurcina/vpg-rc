/* Source-configured experimental historical gameplay UI. The underlying rules,
 * action discovery, combat, save and Undo are the same shared-engine modules
 * used by Node qualification tests. No renderer mockups or gameplay API server.
 * The original historical UX is deferred by user decision.
 */
(function(root){
'use strict';
const E=root.HistoricalCampaignBrowserEngine;
const Art=root.WargameCounterVisuals;
const Activation=root.WargameCounterPhaseActivation;
const BuildupMap=root.WargameHistoricalBuildupMapUX;
const SupportMap=root.WargameHistoricalSupportTargetMapUX;
const RetreatMap=root.WargameHistoricalRetreatMapUX;
const Face=root.WargameHistoricalCounterFaceProjection;
const SupportVectors=root.WargameSupportCounterVectors;
const Display=root.WargameDisplaySettings;
const SourceSetup=root.WargameHistoricalSourceSetupEditor;
const $=id=>document.getElementById(id);
const enc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
let human=null,context=null,config=null,actionList=[],view=null,sourceData=null,deployment=null,setupActive=false,customGame=false,setupOnly=false,candidateMode=false,candidateOpening=null;
const redoHistory=root.WargameMissionStorage?.redoHistory();
let setupMaster=null,setupDraws=0;
let candidateAllocation=null,candidatePlacements=null,candidateEditor=null;
let query='',selectedBattles=new Set(),aiRunning=false,aiStopRequested=false,postRollPage=0;
let postRollSearchToken=0,postRollLoading=false;
// Player configuration is portable; execution state is transient.
let aiAssignment='manual',aiPaused=true,aiTimer=null,aiReady=false;
const perfStats=Object.create(null);
function measured(name,fn){const start=performance.now();try{return fn();}finally{const elapsed=performance.now()-start;const entry=perfStats[name]||(perfStats[name]={count:0,ms:0,maxMs:0});entry.count++;entry.ms+=elapsed;entry.maxMs=Math.max(entry.maxMs,elapsed);}}
let aiProgressActive=false,lastAIFrame=-Infinity;
// Housekeeping is a deterministic system phase, not a third human faction.
function computerOwns(actor){return actor==='system'?aiAssignment!=='manual':['german','soviet'].includes(actor)&&(aiAssignment==='both'||aiAssignment===actor);}
function autoEligible(){return aiReady&&!aiPaused&&!aiRunning&&!setupActive&&human&&!human.snapshot().cursor.complete&&!human.hasPendingRoll()&&computerOwns(human.snapshot().actor);}
function pauseAutomatic(){aiPaused=true;if(aiTimer!==null){clearTimeout(aiTimer);aiTimer=null;}}
function syncHistory(){
 redoHistory?.observe(human);const blocked=setupActive||aiRunning||!human;
 if($('undo'))$('undo').disabled=blocked||!(human.hasPendingRoll()||human.snapshot().actionCount>0);
 if($('redo'))$('redo').disabled=blocked||!redoHistory?.available(human);
}
function syncAutomatic(){
 syncHistory();
 if(!aiReady)return;
 $('ai-assignment').disabled=aiRunning;
 const complete=!setupActive&&!!human?.snapshot().cursor.complete;
 $('ai-resume').disabled=aiRunning||complete||aiAssignment==='manual';
 $('ai-step').disabled=aiRunning||complete;
 $('ai-side').disabled=aiRunning||complete;
 $('ai-resume').textContent=aiPaused?'Resume automatic play':'Pause automatic play';
 syncPhaseBar();
 $('ai-ownership-status').textContent=complete?'Campaign complete':aiAssignment==='manual'?'Manual handoff':aiPaused?'Automatic play paused — manual control available':human?.hasPendingRoll()?'Waiting for committed human die resolution':setupActive?'Waiting for deployment':human?.snapshot().cursor.complete?'Campaign complete':computerOwns(human?.snapshot().actor)?(human?.snapshot().actor==='system'?'Automatic housekeeping':'Computer controls current side'):'Human controls current side';
 if(autoEligible()&&aiTimer===null)aiTimer=setTimeout(()=>{aiTimer=null;if(autoEligible())$('ai-side').onclick();},0);
}
function syncPhaseBar(){
 const shell=root.WargameResponsiveShell;if(!shell)return;
 if(setupActive){
  const ready=$('setup-ready');
  shell.setPhase({label:'Pre-game deployment',action:ready&&!ready.disabled?{label:ready.textContent,run:()=>ready.click()}:{label:'Deployment controls',run:()=>shell.openAt('setup-panel')}});
  return;
 }
 if(!human||!view)return;
 const s=human.snapshot(),c=s.cursor||{};
 const label=c.complete?($('campaign-result')?.querySelector('strong')?.textContent||'Campaign complete'):
  'Turn '+(c.turn||'—')+' / '+sourceData.contextSettings.config.turns+' · '+String(s.actor||'').toUpperCase()+' · '+String(s.phaseId||'').replaceAll('-',' ');
 let action=null;
 if(!c.complete){
  if(aiRunning)action={label:'Stop AI',run:()=>$('ai-stop').click()};
  else if(humanActionBlocked())action={label:'Pause AI',run:()=>$('ai-resume').click()};
  else if(view.kind==='post-roll-choice')action={label:'Resolve consequences',run:()=>shell.openAt('orders-section')};
  else if(!$('roll-panel').hidden)action={label:'Combat decision',run:()=>shell.openAt('roll-panel')};
  else if(supportWindow&&actionList.some(a=>['commit-ground-air','declare-fleet-attack'].includes(a.action?.type)||['declare-fleet-move','commit-forced-port'].includes(a.type)))action={label:'Support orders',run:()=>supportWindow.show()};
  else if(view.stackingCleanup||view.stackPenalty)action={label:'Stacking orders',run:()=>shell.openAt('orders-section')};
  else if(selectedBattles.size&&!$('commit-battles').disabled)action={label:'Commit battles',run:()=>$('commit-battles').click()};
  else {
   // Mirror only a unique, already enumerated completion action. Decisions
   // with other mandatory choices stay in their contextual panels.
   const choices=actionList.filter(a=>['finish-phase','finish-combat','finish-air-sea','finish-housekeeping','finish-buildup'].includes(a.action?.type||a.type)||(a.action?.type==='commit-battles'&&!a.action.battles.length));
   if(choices.length===1&&!selectedBattles.size&&!view.stackingCleanup&&!view.stackPenalty&&!moveSelection&&!supportSelection&&!retreatSelection){
    const a=choices[0];action={label:formatAction(a),run:()=>{if(actionList.includes(a)&&!humanActionBlocked()&&!selectedBattles.size&&!moveSelection&&!supportSelection&&!retreatSelection&&!view.stackingCleanup&&!view.stackPenalty)choose(a);else shell.openAt('orders-section');}};
   }else action={label:'Required orders',run:()=>shell.openAt('orders-section')};
  }
 }
 shell.setPhase({label,action});
}
function humanActionBlocked(){return aiRunning||(!aiPaused&&human&&!human.hasPendingRoll()&&computerOwns(human.snapshot().actor));}

function cancelPostRollSearch(){postRollSearchToken++;postRollLoading=false;const button=$('post-roll-cancel');if(button)button.hidden=true;}
let setupSelection=null,setupPointer=null,setupDragClickUntil=0,setupDragClickTarget=null;
const centerById=new Map();
let displayControl=null,selectPanel=null,inlineMap=null,terrainTooltip=null,supportWindow=null,referenceDialog=null;
let buildupMode=null,buildupSlot=null,buildupReserve=null;
let supportSelection=null,supportTargetHex=null,previousSupportTargetCount=0;
let retreatSelection=null;
let moveSelection=null,moveDestination=null;
function movesFor(id){return actionList.filter(a=>a.type==='declare-ground-move'&&a.request?.unitId===id);}
function clearMoveSelection(){moveSelection=null;moveDestination=null;}
function cityLedgerView(state,map){
 const owners=state.cityControl||{};
 return map.cells.filter(c=>c.city?.name&&['german','soviet'].includes(owners[c.city.name])).map(c=>({cell:c,owner:owners[c.city.name]}));
}
let crtPreference='standard',crtCheckbox=null,crtInfo=null,victoryPreference='historical',victorySelect=null,victoryInfo=null;
function withCRT(base,variant=crtPreference,victory=victoryPreference){
 if(!['standard','advanced'].includes(variant))throw Error('Unknown selected CRT variant');
 const policy={...base.combatPolicy};delete policy.crtVariant;
 if(variant==='advanced')policy.crtVariant='advanced';
 return E.Graduated.withHistorical({...base,combatPolicy:policy},victory);
}
function restoreHumanWithCRT(save,base){
 for(const victory of ['historical','graduated'])for(const variant of ['standard','advanced']){
  if(victory==='graduated'&&!base.housekeepingPolicy)continue;
  const candidate=withCRT(base,variant,victory);
  try{return {human:E.Human.restore(save,candidate),context:candidate,variant,victory};}
  catch(e){if(!/Campaign source\/configuration mismatch/.test(e.message))throw e;}
 }
 throw Error('Save rejected: its source configuration or rules version does not match this game. Use the original game version to resume it; starting a new mission does not modify the saved file.');
}
function syncCRTControls(){
 if(crtCheckbox)crtCheckbox.checked=crtPreference==='advanced';
 if(victorySelect)victorySelect.value=victoryPreference;
 if(victoryInfo)victoryInfo.textContent='Active game: '+(context?.housekeepingPolicy?.graduatedVictory?'Experimental graduated':'Historical')+'. Selection applies to the next game. '+E.Graduated.criteria(E.Graduated.profile(context?.config?.scenarioId||sourceData.contextSettings.config.scenarioId));
 if(crtInfo)crtInfo.textContent='Current game: '+(context?.combatPolicy?.crtVariant==='advanced'?'Advanced':'Standard')+
  ' CRT. '+((context?.combatPolicy?.crtVariant==='advanced')===(crtPreference==='advanced')?'':'New selection will apply on starting a new game. ')+
  'Standard is the default; Advanced uses the user-supplied eight-column table.';
}
function mountCRTSettings(){
 if(setupOnly)return;
 const holder=$('settings-display');if(!holder)return;
 const wrap=document.createElement('div');wrap.id='historical-crt-settings';
 const heading=document.createElement('h3');heading.textContent='Combat Results Table';
 const label=document.createElement('label');label.className='setting-switch';
 crtCheckbox=document.createElement('input');crtCheckbox.type='checkbox';crtCheckbox.id='advanced-crt';
 label.append(crtCheckbox,document.createTextNode(' Advanced CRT (1:2 and 3:2 odds)'));
 crtInfo=document.createElement('p');crtInfo.className='setting-caption';
 wrap.append(heading,label,crtInfo);
 const source=root.WargameHistoricalCRT;
 if(source){
  for(const variant of ['advanced','standard']){
   const details=document.createElement('details');details.className='crt-reference-details';details.dataset.crtVariant=variant;
   const summary=document.createElement('summary');summary.textContent='View '+(variant==='advanced'?'Advanced':'Standard')+' CRT';details.append(summary);
   const scroll=document.createElement('div');scroll.className='crt-reference-scroll';
   scroll.append(Display.renderCRT(source.columns(variant),variant));details.append(scroll);wrap.append(details);
  }
 }
 holder.after(wrap);
 if(sourceData?.contextSettings?.housekeepingPolicy){
  const h=document.createElement('h3');h.textContent='Victory conditions';
  const l=document.createElement('label');l.textContent='Victory ';victorySelect=document.createElement('select');victorySelect.id='victory-mode';
  for(const [v,t] of [['historical','Historical'],['graduated','Experimental — graduated territorial VP']]){const o=document.createElement('option');o.value=v;o.textContent=t;victorySelect.append(o);}
  l.append(victorySelect);victoryInfo=document.createElement('p');victoryInfo.className='setting-caption';wrap.append(h,l,victoryInfo);victorySelect.addEventListener('change',()=>{victoryPreference=victorySelect.value;syncCRTControls();});
 }
 crtCheckbox.addEventListener('change',()=>{crtPreference=crtCheckbox.checked?'advanced':'standard';syncCRTControls();});
 syncCRTControls();
}
const stackTopByHex=new Map();
function currentRetreatMap(){
 if(!RetreatMap||setupActive||!human||view?.kind!=='post-roll-choice')return {active:false,routes:[],byDestination:{}};
 return RetreatMap.model({options:view.options,units:human.snapshot().state.units,cells:sourceData.contextSettings.map.cells});
}
function stageRetreat(routeId){
 const m=currentRetreatMap(),route=RetreatMap?.routeById(m,routeId);
 if(!route){message('This retreat route is not in the current validated consequence page.');return false;}
 retreatSelection=routeId;query='';$('filter').value='';renderActions();showBoard();
 message('Retreat preview: '+route.label+'. Choose an exact combat result to confirm; no move has been committed.');return true;
}
function clearRetreat(){retreatSelection=null;renderActions();showBoard();message('Retreat preview cleared. No combat result was committed.');}
function readableUnit(id){
 const face=sourceData?.counterConfig?.faces?.front?.find(f=>f.faceId===id)||sourceData?.counterConfig?.faces?.back?.find(f=>f.faceId===id);
 const name=face?.visualTranscription?.printedIdentifier||id;
 const unit=human?.snapshot()?.state?.units?.[id];return name+(unit?.hex?' at '+unit.hex:'');
}
async function updateMapDisplay(){
 if(!displayControl||!sourceData)return;
 const settings=displayControl.get(),asset=$('map-art'),holder=$('map-art-inline');
 if(settings.showCoast&&settings.coastWavelets){asset.hidden=false;holder.hidden=true;return;}
 if(!inlineMap){
  const response=await fetch(config.mapExport);
  if(!response.ok)throw Error('Unable to load approved map SVG for Coast settings');
  const svgText=await response.text();
  const parsed=new DOMParser().parseFromString(svgText,'image/svg+xml');
  if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')throw Error('Invalid approved SVG map');
  inlineMap=document.importNode(parsed.documentElement,true);
  holder.replaceChildren(inlineMap);
 }
 Display.applyCoast(inlineMap,sourceData.contextSettings.map,settings);
 asset.hidden=true;holder.hidden=false;
}
function refreshDisplay(){
 showBoard();
 updateMapDisplay().catch(e=>message(e.message));
}
async function loadJson(path){const response=await fetch(path);if(!response.ok)throw Error('Missing source file '+path+' ('+response.status+')');return response.json()}
function message(s){$('message').textContent=s||'';root.WargameResponsiveShell?.feedback(s||'');}
function formatAction(action,effects=null){
 const type=action.action?.type||action.type;
 if(type==='commit-battles')return action.action.battles.length?'Commit '+action.action.battles.length+' battle(s)':'Declare no battles';
 if(type==='select-battle')return 'Resolve battle at '+action.action.defenderHex;
 if(type==='commit-ground-air')return action.action.faceId?'Commit Air Corps '+action.action.faceId:'Commit no air support';
 if(type==='resolve-battle')return 'Apply combat '+String(action.action.die??'automatic')+(effects?.outcome?' ('+effects.outcome+')':'')+' · '+summarizeCombat(action.action.choices||{},effects);
 if(type==='commit-fleet-displacement')return 'Commit Fleet displacement to '+action.action.to;
 if(type==='declare-ground-move')return 'Move '+action.request.unitId+' through '+action.request.path.join(' → ')+(action.request.mode?' ('+action.request.mode+')':'');
 if(type==='remove-overstack-unit')return 'Remove excess unit: '+readableUnit(action.unitId);
 if(type==='finish-phase'&&view?.stackingCleanup)return 'Complete phase after overstack removal';
 if(type==='finish-phase'&&view?.stackPenalty)return 'End movement — remove '+view.stackPenalty+' excess unit(s)';
 if(type==='place-reinforcement')return 'Place '+action.slotId+' at '+action.hex;
 if(type==='apply-replacement')return 'Replace '+action.unitId+(action.hex?' at '+action.hex:'');
 if(type==='declare-fleet-move'||type==='commit-forced-port')return type.replaceAll('-',' ')+' to '+action.to;
 if(type==='declare-naval-ground-transport')return (action.destination.kind==='off-map'?'Evacuate ':'Transport ')+readableUnit(action.unitId)+(action.destination.kind==='off-map'?' off-map':' to port '+action.destination.hex);
 if(type==='place-evacuated-reinforcement')return 'Return evacuated '+readableUnit(action.unitId)+' at '+action.hex;
 if(type==='declare-fleet-attack')return 'Commit naval attack '+action.action.faceId;
 if(type==='roll-fleet-displacement')return 'Apply committed Fleet die '+action.action.die;
 return type.replaceAll('-',' ');
}
function summarizeCombat(x,effects=null){
 const parts=[];
 // Losses/revelations are returned by the authoritative trial transaction;
 // do not describe AL/DE/NE from the shape of the optional player choices.
 if(Array.isArray(effects?.losses)){
  for(const loss of effects.losses){
   if(!loss?.unitId)continue;
   parts.push((loss.removed?'Eliminated: ':'Reduced: ')+readableUnit(loss.unitId));
  }
 }else{
  if(x.lossUnitId)parts.push('Attacker loss: '+readableUnit(x.lossUnitId));
  if(x.defenderLossId)parts.push('Defender loss: '+readableUnit(x.defenderLossId));
  if(x.attackerLossIds?.length)parts.push('Attacker losses: '+x.attackerLossIds.map(readableUnit).join(' + '));
 }
 // Revealing a one-step counter changes its printed face, not its strength.
 // Do not disclose the hidden reverse strength in a pre-commit description.
 if(Array.isArray(effects?.revealed))for(const id of effects.revealed){
  const u=human?.snapshot()?.state?.units?.[id];
  const label=u?u.owner+' '+u.class+(u.hex?' at '+u.hex:''):id;
  parts.push('Revealed: '+label);
 }
 if(x.retreatPaths)parts.push('Retreat: '+Object.entries(x.retreatPaths).map(([id,path])=>readableUnit(id)+' → '+path.join(' → ')).join('; '));
 if(x.advanceUnitId)parts.push('Advance: '+readableUnit(x.advanceUnitId));
 if(x.ignoreRetreat)parts.push('Fleet retreat exception');
 if(x.fleetDisplacement)parts.push('Fleet displacement: '+JSON.stringify(x.fleetDisplacement));
 return parts.join(' · ')||'No losses or movement';
}
function piece(unit,x,y,index,total,activated=false,isStackTop=false,extraTooltip=''){
 const projected=Face.project(unit,sourceData.counterConfig);
 const width=Art.sizeForMap(sourceData.contextSettings.map)*(displayControl?Display.counterScale(displayControl.get()):1),height=width,offset=index-(total-1)/2;
 const dx=width*(8/46),dy=width*(7/46);
 const art=Art.piece(projected.art,x-width/2+offset*dx,y-height/2+offset*dy,'#a1b7b4',{width,height,
  selected:setupActive?setupSelection?.kind==='map'&&setupSelection.id===unit.id:moveSelection===unit.id,activated});
 // CSS can identify the visually uppermost counter; the source counter art
 // itself is never modified. SVG title supplies an accessible hover hint.
 return art.replace('class="counter-vector official-counter"',
  'class="counter-vector official-counter'+(isStackTop?' buildup-stack-top':'')+'"'+(setupActive||movesFor(unit.id).length?' role="button" tabindex="0" aria-label="'+enc('Select counter '+unit.id)+'"':''))
  .replace('<title>','<title>'+(extraTooltip?enc(extraTooltip)+' · ':'') );
}
function stackAt(hex,units){return BuildupMap.orderedStack(units,stackTopByHex.get(hex));}
function currentBuildupMap(state){return BuildupMap.model({phaseKind:setupActive?null:view?.phaseKind,
 commands:actionList,units:state.units,mode:buildupMode,slotId:buildupSlot,reserveId:buildupReserve});}
function currentSupportMap(){
 if(!SupportMap||setupActive||!human)return SupportMap?.model()||{active:false,hexes:[],byHex:{}};
 const state=human.snapshot();
 const fleetPolicy=sourceData?.contextSettings?.combatPolicy?.portSupport;
 const fleetHex=fleetPolicy?state.state?.supportMarkers?.[fleetPolicy.markerKey]?.hex:null;
 return SupportMap.model({selection:supportSelection,commands:aiRunning?[]:actionList,
  battleHex:state.combat?.selected||null,fleetHex});
}
function cancelSupportSelection(){supportSelection=null;supportTargetHex=null;previousSupportTargetCount=0;refreshSupportWindow();showBoard();}
function pickSupport(selection){
 if(!SupportMap||setupActive||aiRunning)return;
 if(supportSelection?.id===selection.id&&supportSelection?.kind===selection.kind){cancelSupportSelection();return;}
 supportSelection=selection;supportTargetHex=null;previousSupportTargetCount=0;
 refreshSupportWindow();showBoard();
 message(currentSupportMap().instruction);
}
function supportMapHit(hex){
 if(!supportSelection)return false;
 const map=currentSupportMap(),options=SupportMap.choicesAt(map,hex);
 if(!options.length){message('Choose a highlighted legal Support target, or cancel the Support selection.');return true;}
 supportTargetHex=hex;refreshSupportWindow();showBoard();supportWindow?.revealTarget();message('Review target '+hex+' and confirm in the Support Window.');return true;
}

function rotateStack(hex){
 if(setupActive||!human||aiRunning)return false;
 const stacks=Object.values(human.snapshot().state.units||{}).filter(u=>u.hex===hex&&
  !['eliminated','dead'].includes(u.strengthStatus));
 const next=BuildupMap.nextTop(stacks,stackTopByHex.get(hex));
 if(!next)return false;
 stackTopByHex.set(hex,next);showBoard();
 const m=currentBuildupMap(human.snapshot().state);
 const target=BuildupMap.actionAtHex({...m,mode:'repair'},hex,stackAt(hex,stacks));
 message('Stack at '+hex+' swapped. Top: '+next+'.'+
  (target?' Eligible repair target: '+target.unitId+'. Click the highlighted hex to restore it.':''));
 return true;
}
function renderBuildupControls(){
 const controls=$('buildup-map-controls');if(!controls)return;
 const state=!setupActive&&human?human.snapshot():null;
 const m=state?currentBuildupMap(state.state):{active:false};
 controls.hidden=!m.active;
 // A generic pointer hover must never resemble a legal highlighted repair.
 document.body.classList.toggle('buildup-map-active',m.active);
 if(!m.active)return;
 buildupMode=m.mode;buildupSlot=m.slotId;buildupReserve=m.reserveId;
 const mode=$('buildup-operation'),target=$('buildup-target'),label=controls.querySelector('label[for="buildup-target"]');
 const modes={entry:'Place reinforcements',repair:'Restore a reduced unit (resupply)',rebuild:'Rebuild an eliminated unit'};
 mode.replaceChildren();
 for(const name of m.modes){const o=document.createElement('option');o.value=name;o.textContent=modes[name];mode.appendChild(o)}
 if(!m.modes.length){const o=document.createElement('option');o.value='';o.textContent='No legal placements or repairs';mode.appendChild(o)}
 mode.value=m.mode||'';mode.disabled=!m.modes.length;
 const candidates=m.mode==='entry'?m.slotIds:m.mode==='rebuild'?m.reserveIds:[];
 label.hidden=!candidates.length;target.hidden=!candidates.length;
 if(candidates.length){target.replaceChildren();for(const id of candidates){const o=document.createElement('option');o.value=id;o.textContent=id;target.appendChild(o)}
  target.value=m.mode==='entry'?m.slotId:m.reserveId;
  label.textContent=m.mode==='entry'?'Reinforcement counter to place':'Eliminated unit to rebuild';}
 const count=m.mode==='entry'?m.entryHexes.length:m.mode==='repair'?m.repairHexes.length:m.rebuildHexes.length;
 $('buildup-map-help').textContent=(m.mode==='entry'?'Dark-yellow outlines: legal reinforcement entry destinations.':
  m.mode==='repair'?'Dark-yellow outlines: reduced counters eligible to receive a replacement step.':
  m.mode==='rebuild'?'Dark-yellow outlines: legal rebuild destinations.':'No available map actions at this phase.')+
  ' All highlights come from the current legal-action catalogue. '+
  (m.mode==='repair'?'For two eligible counters in one hex, the top one repairs by default. Click either counter (or Shift-click the hex) to swap which is on top, then click the highlighted hex outside the counters to repair.':'');
 $('buildup-map-status').textContent=count+' legal highlighted hex'+(count===1?'':'es')+
  (m.mode==='entry'&&m.slotId?' for '+m.slotId:'');
}

// Compatibility with the committed monolith until split production migration.
// Only buildup activation needs the journal; movement and combat use snapshot data.
function displayJournal(){return typeof human.journal==='function'?measured('journalCopy',()=>human.journal()):measured('boardSave',()=>human.save().campaign.journal);}
function showBoard(){
 if(!setupActive&&!human)return;
 const snapshot=setupActive?null:human.snapshot();
 const state=setupActive?{units:(candidateMode?candidateEditor:deployment).snapshot().units}:snapshot.state;
 const journal=setupActive||snapshot.phaseKind!=='buildup'?[]:displayJournal();
 const allocation=context?.buildupAllocation||{};
 const slots=sourceData?.contextSettings?.buildupPolicy?.reinforcements||[];
 const slotFaces=Object.fromEntries(slots.map(slot=>[slot.slotId,allocation[slot.group]?.[slot.index]]));
 const activated=setupActive?new Set():Activation?.historical(snapshot,journal,slotFaces)||new Set();
 const stacks=new Map();
 for(const u of Object.values(state.units||{})){
  if(!centerById.has(u.hex)||['eliminated','dead'].includes(u.strengthStatus))continue;
  if(!stacks.has(u.hex))stacks.set(u.hex,[]);stacks.get(u.hex).push(u);
 }
 const map=sourceData.contextSettings.map;
 const cells=map.cells.filter(c=>c.pixelCenter&& !['sea','lake'].includes(c.terrain));
 const radius=map.geometry.calibration.staggerY/33.179;
 const eligible=setupActive&&setupSelection?.kind==='map'?new Set((candidateMode?candidateEditor:deployment).choices(setupSelection.id)):null;
 const buildup=currentBuildupMap(state);
 const support=currentSupportMap();
 const retreatMap=currentRetreatMap();
 const retreatsPendingHex=hex=>retreatMap.active&&!!retreatMap.byDestination[hex];
 document.body.classList.toggle('support-map-active',support.active);
 document.body.classList.toggle('retreat-map-active',retreatMap.active);
 const cityRows=cityLedgerView(state,map);
 const citySummary=$('historical-city-summary')||(()=>{const el=document.createElement('p');el.id='historical-city-summary';el.className='small';$('status').after(el);return el;})();
 citySummary.hidden=setupActive||!cityRows.length;
 citySummary.textContent='City control · German '+cityRows.filter(r=>r.owner==='german').length+' · Soviet '+cityRows.filter(r=>r.owner==='soviet').length;
 let svg='<g id="historical-city-control-layer" pointer-events="none">';
 for(const {cell,owner} of (displayControl?.get().cityOwnership===false?[]:cityRows)){if(!cell.pixelCenter)continue;const [x,y]=cell.pixelCenter;
  const color=owner==='german'?'#284b74':'#963d3d',label=owner==='german'?'G':'S';
  svg+='<g data-city-control="'+enc(cell.id)+'" data-city-owner="'+owner+'" aria-label="'+enc(cell.city.name+' — '+owner+' control')+'"><circle cx="'+(x-23*radius)+'" cy="'+(y-15*radius)+'" r="'+(5.5*radius)+'" fill="'+color+'" stroke="white" stroke-width="'+radius+'"/><text x="'+(x-23*radius)+'" y="'+(y-15*radius)+'" dy=".34em" text-anchor="middle" font-size="'+(8*radius)+'" font-weight="bold" fill="white">'+label+'</text></g>';
 }
 svg+='</g><g id="playable-hex-hits">';
 const battleHexes=new Set(setupActive||humanActionBlocked()?[]:actionList.filter(a=>a.action?.type==='select-battle').map(a=>a.action.defenderHex));
 const moveHexes=new Set((setupActive||humanActionBlocked()?[]:movesFor(moveSelection)).map(a=>a.request.path.at(-1)));
 for(const c of cells){const [x,y]=c.pixelCenter;
  const marked=eligible?.has(c.id)===true;
  const kind=buildup.mode==='entry'&&buildup.entryByHex[c.id]?'entry':
   buildup.mode==='repair'&&buildup.repairByHex[c.id]?'repair':
   buildup.mode==='rebuild'&&buildup.rebuildByHex[c.id]?'rebuild':null;
  const isSupport=support.active&&!!support.byHex[c.id];
  const isRetreat=retreatsPendingHex(c.id);
  const isSupportTarget=isSupport&&supportTargetHex===c.id;
  const hint=isRetreat?'Engine-validated retreat destination '+c.id+'. Click to preview the route and then confirm a complete result.':
   isSupport?'Legal Support target '+c.id+'. Click to review, then confirm in the Support Window.':
   kind?BuildupMap.tooltip(buildup,c.id,stackAt(c.id,stacks.get(c.id)||[])):'';
  const points=[
   [37.55,0],[18.78,33.18],[-18.78,33.18],[-37.55,0],[-18.78,-33.18],[18.78,-33.18]
  ].map(([dx,dy])=>(x+dx*radius).toFixed(2)+','+(y+dy*radius).toFixed(2)).join(' ');
  const isMove=moveHexes.has(c.id);
  const isBattle=battleHexes.has(c.id);
  const highlighted=marked||!!kind||isSupport||isRetreat||isMove||isBattle;
  if(highlighted)svg+='<polygon class="hex-highlight-pulse'+(isRetreat?' retreat-highlight':'')+(isSupportTarget?' highlight-selected':'')+'" aria-hidden="true" points="'+points+'"></polygon>';
  svg+='<polygon class="hex-hit'+(marked?' setup-eligible-hex':'')+(isMove?' movement-target-hex':'')+(isBattle?' battle-target-hex':'')+(kind?' buildup-'+kind+'-hex':'')+(isSupport?' support-target-hex':'')+(isSupportTarget?' support-target-selected':'')+(isRetreat?' retreat-target-hex':'')+(isRetreat&&RetreatMap.atDestination(retreatMap,c.id).includes(retreatSelection)?' retreat-target-selected':'')+'" data-hex="'+enc(c.id)+'" data-setup-eligible="'+marked+'"'+
   (isRetreat?' data-retreat-target="'+enc(c.id)+'"':isSupport?' data-support-target="'+enc(c.id)+'"':kind?' data-buildup-action="'+kind+'"':'')+
   ((kind||isSupport||marked||isRetreat||isMove||isBattle)?' role="button" tabindex="0" aria-label="'+enc(hint||((isBattle?'Select committed battle at ':isMove?'Legal movement destination ':'Legal setup destination ')+c.id))+'"':'')+
   ' fill="transparent" stroke="transparent" points="'+points+'">'+
  (hint?'<title>'+enc(hint)+'</title>':'')+'</polygon>';
  // A separate, pointer-inert inset outline preserves the cobalt interaction
  // target while clearly distinguishing its thin light-blue inner border.
  if(isRetreat){
   const inset=Math.max(.5,1-4.8/(33.18*radius));
   const innerPoints=[
    [37.55,0],[18.78,33.18],[-18.78,33.18],[-37.55,0],[-18.78,-33.18],[18.78,-33.18]
   ].map(([dx,dy])=>(x+dx*radius*inset).toFixed(2)+','+(y+dy*radius*inset).toFixed(2)).join(' ');
   svg+='<polygon class="retreat-target-inner" data-retreat-inner="'+enc(c.id)+'" aria-hidden="true" points="'+innerPoints+'"></polygon>';
  }
 }
 svg+='</g>';
 const retreats=retreatMap;
 if(retreats.active){
  svg+='<g id="historical-retreat-route-layer" aria-label="Engine-validated retreat arrows">';
  for(const r of retreats.routes){
   const selected=retreatSelection===r.id;
   svg+='<g class="retreat-route'+(selected?' is-selected':retreatSelection?' is-muted':'')+'" data-retreat-group="'+r.id+'">';
   for(const leg of r.routes){
    for(let i=0;i<leg.points.length-1;i++){
     const segment=RetreatMap.segment(leg.points[i],leg.points[i+1]);if(!segment)continue;
     const d='M '+segment.start.join(' ')+' L '+segment.end.join(' ');
     const block=RetreatMap.blockArrowPoints(segment.start,segment.end);if(!block)continue;
     const label=enc('Preview retreat '+leg.hexes.join(' to '));
     svg+='<polygon class="retreat-arrow-block" points="'+block+'" aria-hidden="true"></polygon>'+
      '<path class="retreat-arrow-hit" d="'+d+'" data-retreat-route="'+r.id+'" role="button" tabindex="0" aria-label="'+label+'"><title>'+label+'</title></path>';
    }
   }
   svg+='</g>';
  }
  svg+='</g>';
 }
 svg+='<g id="live-historical-counter-layer">';
 for(const [hex,original] of stacks){const c=centerById.get(hex);const [x,y]=c.pixelCenter;
  const units=stackAt(hex,original);
  const hint=buildup.mode==='repair'?BuildupMap.tooltip(buildup,hex,units):'';
  const multiEligibleRepair=buildup.mode==='repair'&&(buildup.repairByHex[hex]||[]).length>1;
  const repairTarget=multiEligibleRepair?BuildupMap.actionAtHex(buildup,hex,units)?.unitId:null;
  units.forEach((u,i)=>svg+=piece(u,x,y,i,units.length,activated.has(u.id),
   multiEligibleRepair&&u.id===repairTarget,units.length>1?'Click this counter to swap the top of the stack. '+hint:hint));
 }
 svg+='</g>';
 const overlay=$('counter-overlay'),shell=root.WargameResponsiveShell,focused=shell?.captureMapFocus(overlay);
 overlay.innerHTML=svg;
 shell?.restoreMapFocus(overlay,focused);
}
function renderActions(){
 if(!view)return;
 const q=query.toLowerCase();
 const inSupportWindow=a=>supportWindow&&(
  ['commit-ground-air','declare-fleet-attack'].includes(a?.action?.type)||
  ['declare-fleet-move','commit-forced-port'].includes(a?.type));
 const retreatMap=currentRetreatMap();
 const route=RetreatMap?.routeById(retreatMap,retreatSelection);
 const stage=$('retreat-route-controls')||(()=>{const el=document.createElement('div');el.id='retreat-route-controls';el.setAttribute('aria-live','polite');$('actions').before(el);return el;})();
 stage.replaceChildren();stage.hidden=!retreatMap.active;
 if(retreatMap.active){
  const heading=document.createElement('div');heading.className='retreat-route-heading';
  heading.textContent=retreatMap.routes.length+' legal retreat route'+(retreatMap.routes.length===1?'':'s')+' · select an arrow or destination on the map';stage.append(heading);
  const controls=document.createElement('div');controls.className='retreat-route-buttons';
  for(const r of retreatMap.routes){const b=document.createElement('button');b.type='button';b.dataset.retreatSelect=r.id;
   b.textContent=r.label+' ('+r.options.length+' result'+(r.options.length===1?'':'s')+')';
   b.setAttribute('aria-pressed',String(retreatSelection===r.id));if(retreatSelection===r.id)b.classList.add('is-selected');
   b.onclick=()=>stageRetreat(r.id);controls.append(b);}
  stage.append(controls);
  if(route){const p=document.createElement('p');p.className='retreat-confirm-instruction';p.textContent='Route preview only. Select a complete consequence below to commit losses, retreat and any advance.';
   stage.append(p);
   const cancel=document.createElement('button');cancel.type='button';cancel.dataset.retreatClear='true';cancel.textContent='Show all consequences';cancel.onclick=clearRetreat;stage.append(cancel);
  }else {const p=document.createElement('p');p.className='retreat-confirm-instruction';p.textContent='No retreat has been committed. The complete legal combat choices are still listed below.';stage.append(p);}
 }
 const eligible=route?new Set(route.options):null;
 const effectsFor=a=>view.kind==='post-roll-choice'?view.optionEffects?.[view.options.indexOf(a)]||null:null;
 const phaseAction=a=>['finish-phase','finish-combat','finish-air-sea','finish-housekeeping','finish-buildup','resolve-ground-move'].includes(a.action?.type||a.type)||(a.action?.type==='commit-battles'&&!a.action.battles.length);
 const filtered=actionList.filter(a=>phaseAction(a)||((!moveDestination||a.type==='declare-ground-move'&&a.request.unitId===moveSelection&&a.request.path.at(-1)===moveDestination)&&!inSupportWindow(a)&&(!eligible||eligible.has(a))&&(!q||formatAction(a,effectsFor(a)).toLowerCase().includes(q)||JSON.stringify(a).toLowerCase().includes(q))));
 const visible=filtered.slice(0,view.kind==='post-roll-choice'?128:100);
 // A search filter or long action catalogue must never hide phase progression.
 for(const a of filtered.filter(phaseAction))if(!visible.includes(a))visible.unshift(a);
 $('filter-note').textContent=filtered.length+' matching authoritative choices on this page'+(filtered.length>visible.length?' · first '+visible.length+' shown (filter to narrow)':'');
 const panel=$('actions');panel.replaceChildren();
 visible.forEach(a=>{
  const b=document.createElement('button');b.type='button';b.textContent=formatAction(a,effectsFor(a));
  b.dataset.actionIndex=String(actionList.indexOf(a));
  b.onclick=()=>{if(a.action?.type==='commit-battles'&&selectedBattles.size){message('Commit the selected battles or clear the selection first.');return;}choose(a);};if(route)b.dataset.retreatConfirm='true';panel.appendChild(b);
 });
 if(!filtered.length)panel.textContent='No matching choices at this decision.';
}
function renderBattleProposals(){
 const details=$('battle-choices');const container=$('battle-proposals');container.replaceChildren();
 const available=view?.kind==='action-choice'&&view.proposals?.length&&view.phaseKind==='combat';
 details.hidden=!available;if(!available){selectedBattles.clear();syncPhaseBar();return;}details.open=true;
 const proposals=view.proposals;const validKeys=new Set(proposals.map(p=>JSON.stringify(p)));
 for(const k of selectedBattles)if(!validKeys.has(k))selectedBattles.delete(k);
 // The source catalog can expose >100 independently validated battles.
 // They must all remain accessible to human players without an engine API.
 const q=query.toLowerCase();
 const matched=proposals.filter(p=>!q||p.defenderHex.toLowerCase().includes(q)||
  p.attackers.some(id=>id.toLowerCase().includes(q)));
 const note=document.createElement('p');note.className='small';note.id='battle-filter-note';
 note.textContent=`${matched.length} matching battle proposals · ${selectedBattles.size} selected`+
  (matched.length>100?' · showing first 100; filter by defender hex or counter ID':'');
 container.appendChild(note);
 const clear=document.createElement('button');clear.type='button';clear.textContent='Clear battle selection';clear.id='clear-battle-selection';clear.disabled=!selectedBattles.size||humanActionBlocked();
 clear.onclick=()=>{selectedBattles.clear();renderBattleProposals();};container.appendChild(clear);
 const commit=$('commit-battles');commit.disabled=!selectedBattles.size||humanActionBlocked();syncPhaseBar();
 const conflicts=p=>[...selectedBattles].some(k=>{const b=JSON.parse(k);return k!==JSON.stringify(p)&&(b.defenderHex===p.defenderHex||b.attackers.some(id=>p.attackers.includes(id)));});
 for(const p of matched.slice(0,100)){
  const key=JSON.stringify(p);const label=document.createElement('label');
  const check=document.createElement('input');check.type='checkbox';check.checked=selectedBattles.has(key);check.disabled=humanActionBlocked()||(!check.checked&&conflicts(p));
  check.onchange=()=>{
   if(check.checked&&conflicts(p)){check.checked=false;return;}
   check.checked?selectedBattles.add(key):selectedBattles.delete(key);
   clear.disabled=!selectedBattles.size;commit.disabled=!selectedBattles.size;syncPhaseBar();
   for(const c of container.querySelectorAll('input[data-battle-key]'))c.disabled=humanActionBlocked()||(!c.checked&&conflicts(JSON.parse(c.dataset.battleKey)));
   note.textContent=`${matched.length} matching battle proposals · ${selectedBattles.size} selected`+
    (matched.length>100?' · showing first 100; filter by defender hex or counter ID':'');
  };
  check.dataset.battleKey=key;label.appendChild(check);label.appendChild(document.createTextNode(' '+p.attackers.join(', ')+' → '+p.defenderHex));
  container.appendChild(label);
 }
}

function sourceName(id){
 const f=sourceData.counterConfig.faces.front.find(x=>x.faceId===id);
 const t=f?.visualTranscription||{};
 if(typeof t.printedValues==='string'&&t.printedValues.startsWith('?'))return 'Concealed counter';
 return [t.printedIdentifier||t.kind||'unit',t.printedValues||''].filter(Boolean).join(' · ');
}
function bindDeployment(d,requireMixed=false){
 const committed=d.commit({requireMixed});
 context=withCRT({...clone(committed.opening),...sourceData.contextSettings,buildupAllocation:committed.allocation});
}
const playerStrategies=['diagnostic','operational','reserve-relief'];
function playerConfig(){return {assignment:aiAssignment,german:$('ai-policy')?.value||'diagnostic',soviet:$('ai-policy-soviet')?.value||'diagnostic',germanDifficulty:Number($('ai-difficulty')?.value||0),sovietDifficulty:Number($('ai-difficulty-soviet')?.value||0)};}
function applyPlayers(players){aiAssignment=players.assignment;for(const [id,value] of [['ai-assignment',players.assignment],['ai-policy',players.german],['ai-policy-soviet',players.soviet],['ai-difficulty',players.germanDifficulty??0],['ai-difficulty-soviet',players.sovietDifficulty??0]])if($(id)){if(id.startsWith('ai-difficulty'))globalThis.WargameAIDifficulty.restoreSelect($(id),value);else $(id).value=value;}pauseAutomatic();}
function saveCurrent(){const raw=saveEngine();return $('ai-policy-soviet')?root.WargamePlayerSaveConfig.pack(raw,playerConfig(),playerStrategies):raw;}
function saveEngine(){
 if(setupActive){
  const original=(candidateMode?candidateEditor:deployment).save();
  const rng={seed:setupMaster,draws:setupDraws};
  return {...original,missionRandom:{...rng,digest:WargameSyncSha256.sha256(JSON.stringify([original,rng]))}};
 }
 if(!customGame)return human.save();
 const payload={format:'historical-custom-campaign',version:1,deployment:(candidateMode?candidateEditor:deployment).save(),human:human.save()};
 return {...payload,integrity:{algorithm:'SHA-256',digest:WargameSyncSha256.sha256(JSON.stringify(payload))}};
}
function enterSetup(){
 retreatSelection=null;
 if(candidateMode&&!candidateEditor)throw Error('Source-constrained candidate deployment not loaded');
 if(aiRunning)throw Error('Stop the AI before changing deployment');pauseAutomatic();
 if(human?.snapshot().actionCount>0)throw Error('A game already in progress cannot be redeployed; start a new candidate game first');
 if(!candidateMode&&!deployment)deployment=E.Deployment.create({...sourceData.deploymentSource,
  allocation:candidateAllocation,placements:candidatePlacements});
 if(!setupMaster)setupMaster=human?.missionSeed()||E.Random.generate();
 redoHistory?.clear();setupActive=true;setupSelection=null;supportSelection=null;supportTargetHex=null;if(selectPanel)selectPanel('play');message('');refresh();
}
function updateSetup(next){deployment=next;setupSelection=null;message('');refresh()}
function setupMove(id,to){try{if(candidateMode){candidateEditor=candidateEditor.move(id,to);setupSelection=null;message('');refresh();return true}updateSetup(deployment.move(id,to));return true}catch(e){message(e.message);return false}}
function setupSwapPosition(a,b){try{if(candidateMode){candidateEditor=candidateEditor.swapPositions(a,b);setupSelection=null;message('');refresh();return true}updateSetup(deployment.swapPositions(a,b));return true}catch(e){message(e.message);return false}}
function setupSwap(a,b){try{if(candidateMode)throw Error('Use the German reserve selection control to exchange one source-eligible 6–4 infantry face with the Turn 3 reserve.');updateSetup(deployment.swapFaces(a,b));return true}catch(e){message(e.message);return false}}
function setupSelectInfantryReserve(slot){
 try{
  if(!candidateMode||!setupActive)throw Error('German infantry selection is available only in source deployment');
  candidateEditor=candidateEditor.selectInfantryReserve(slot||null);
  setupSelection=null;message('');refresh();return true;
 }catch(e){message(e.message);return false}
}
function setupShuffle(){
 try{
  const s=candidateMode?candidateEditor.snapshot():deployment.snapshot();
  const old=candidateMode?s.concealedSlots:sourceData.setupSpec.concealedSetup.groups.flatMap(g=>s.allocation[g]);
  const order=[...old];
  if(!setupMaster)setupMaster=E.Random.generate();
  let draws=setupDraws;
  for(let i=order.length-1;i>0;i--){
   const j=E.Random.integer(setupMaster,'deployment',draws++,i+1);
   [order[i],order[j]]=[order[j],order[i]];
  }
  if(candidateMode){candidateEditor=candidateEditor.mixConcealed(order);setupSelection=null;refresh();}
  else updateSetup(deployment.permute(sourceData.setupSpec.concealedSetup.groups,order));
  setupDraws=draws;
  message('Ten original Soviet Mechanized Corps identities mixed. Printed untried faces remain concealed until revealed by the shared combat rules.');return true;
 }catch(e){message(e.message);return false}
}
function beginFromSetup(){
 try{
  if(!setupActive)throw Error('Not in deployment');
  if(candidateMode){
   const sourceOpening=candidateEditor.commit();
   context=withCRT({...clone(sourceOpening),...sourceData.contextSettings,
    buildupAllocation:candidateEditor.selectedAllocation()});
   customGame=true;human=E.Human.create({session:E.Campaign.create(context),context,missionSeed:setupMaster||E.Random.generate(),deploymentDraws:setupDraws});
   setupActive=false;selectedBattles.clear();query='';$('filter').value='';message('');refresh();return true;
  }
  if(setupOnly){
   const ready=deployment.commit({requireMixed:true});
   message('Source-constrained sample deployment validated: '+Object.keys(ready.opening.state.units).length+' units. Gameplay is NOT enabled; save this deployment or continue editing.');
   return true;
  }
  bindDeployment(deployment,true);
  customGame=true;
  human=E.Human.create({session:E.Campaign.create(context),context,missionSeed:setupMaster||E.Random.generate(),deploymentDraws:setupDraws});
  setupActive=false;selectedBattles.clear();query='';$('filter').value='';message('');refresh();return true;
 }catch(e){message(e.message);return false}
}
/* Deployment is an interaction layer, not an alternative setup validator.
 * Pool counters remain assigned to their later source turns; the existing
 * atomic swapFaces() validates both sides before altering either assignment.
 */
function setupPoolEntries(snapshot,groups){
 const placed=new Set(Object.keys(snapshot.placements));
 const rows=[];const seen=new Set();
 for(const [group,rule] of Object.entries(groups)){
  if(seen.has(rule.pool))continue;
  seen.add(rule.pool);
  const available=(sourceData.inventoryReport.pools[rule.pool]||[]).filter(id=>!placed.has(id));
  if(available.length)rows.push({pool:rule.pool,owner:rule.owner,kind:rule.class,size:rule.size,faces:available});
 }
 return rows;
}
function poolCounterArt(id,size,selected){
 const front=sourceData.counterConfig.faces.front.find(f=>f.faceId===id);
 if(!front)throw Error('Missing source counter '+id);
 const hidden=(front.visualTranscription?.printedValues||'').startsWith('?');
 const projected=Face.project({id,sourceFaceId:id,reverseFaceId:front.pairedFaceId,
  strengthStatus:hidden?'untried':'printed-full',size},sourceData.counterConfig);
 return '<svg class="setup-pool-art" viewBox="0 0 50 50" aria-hidden="true">'+
   Art.piece(projected.art,0,0,'#a1b7b4',{width:50,height:50,selected})+'</svg>';
}
function renderSetup(){
 document.body.classList.toggle('historical-deployment-active',setupActive);
 $('setup-panel').hidden=!setupActive;
 for(const id of ['decision-section','orders-section','ai-section'])$(id).hidden=setupActive;
 if(!setupActive)return;
 if(candidateMode){
  const s=candidateEditor.snapshot();
  $('status').innerHTML='<div class="phase">Pre-game deployment · experimental</div><div class="summary">36 source ground counters plus fixed Fleet · 11 of 12 Soviet frontline stars · '+
   (s.concealedMixed?'10 original Mechanized Corps mixed':'10 Mechanized Corps still in sample identity order')+'</div>';
  const picked=setupSelection?.kind==='map'?setupSelection.id:null;
  const hiddenSlot=id=>s.concealedSlots.includes(id);
  $('setup-selection').textContent=picked?'Selected '+(hiddenSlot(picked)?'concealed Soviet Mechanized Corps':picked)+' at '+s.placements[picked]+'. Choose another counter to exchange hexes, or a yellow legal empty hex. Escape cancels.':
   'Select any counter to reposition it within the source-verified setup region. Select two counters to exchange their initial hexes.';
  const panel=$('setup-choices');panel.replaceChildren();
  const intro=document.createElement('p');intro.className='small';
  intro.textContent='Soviet spare star: '+s.unselectedFrontlineHexes.join(', ')+'. '+
   (s.concealedMixed?'All ten original untried Mechanized identities have been mixed; their printed front/reverse pairings are preserved.':
    'Press Mix 10 concealed Corps to satisfy the printed concealed-setup procedure. The unchanged sample can still be started experimentally.')+
   ' The German 6–4 infantry reserve can be selected below.';
  panel.appendChild(intro);
  if(s.infantryFaceSelection){
   const pool=s.infantryFaceSelection;
   const wrap=document.createElement('div');wrap.className='setup-infantry-face-selector';
   const label=document.createElement('label');label.htmlFor='setup-infantry-reserve';
   label.textContent='Turn 3 German infantry reinforcement (6–4)';wrap.appendChild(label);
   const select=document.createElement('select');select.id='setup-infantry-reserve';
   const original=document.createElement('option');original.value='';
   original.textContent='Original sample: 29 (6–4) arrives Turn 3';select.appendChild(original);
   for(const choice of pool.choices){const option=document.createElement('option');option.value=choice.slot;
    option.textContent='Hold '+choice.printedIdentifier+' ('+choice.printedStrength+') for Turn 3 · deploy 29 instead';
    select.appendChild(option);}
   select.value=pool.swappedDeployedSlot||'';
   select.onchange=()=>setupSelectInfantryReserve(select.value||null);
   wrap.appendChild(select);
   const info=document.createElement('p');info.className='small';
   info.textContent='Only printed 6–4 German infantry may enter the Turn 3 reserve. Original 8–4 infantry remain on the board. Each physical front/reverse counter pair is preserved.';
   wrap.appendChild(info);panel.appendChild(wrap);
  }
  for(const [name,g] of Object.entries(s.groups)){
   const line=document.createElement('p');line.className='small';
   line.textContent=name.replace(/([A-Z])/g,' $1')+': '+g.ids.map(id=>(hiddenSlot(id)?'Concealed Corps':id.replace('kiev-front-','').replace('kiev-odessa/',''))+' @ '+s.placements[id]).join(' · ');
   panel.appendChild(line);
  }
  $('setup-mix').hidden=false;$('setup-mix').textContent=(s.concealedMixed?'Remix':'Mix')+' 10 concealed Corps';
  $('setup-ready').disabled=false;
  showBoard();syncPhaseBar();return;
 }
 const snapshot=deployment.snapshot();
 $('status').innerHTML='<div class="phase">Pre-game deployment</div><div class="summary">'+
  Object.keys(snapshot.units).length+' source-validated units · '+
  (snapshot.concealedMixed?'Concealed units mixed':'Concealed units not yet mixed')+'</div>';
 const selected=setupSelection;
 $('setup-selection').textContent=selected?
  'Selected '+(selected.kind==='map'?'on map at '+snapshot.placements[selected.id]:'in counter pool')+': '+sourceName(selected.id)+
  '. Click a second counter or a legal empty marked hex; click the selected counter again or press Escape to cancel.':
  'Select a deployed counter, then select another map counter to exchange positions or an available counter to exchange source assignments. You can also select the pool counter first, or move to a legal empty marked hex.';
 const panel=$('setup-choices');const scroll=panel.scrollTop;panel.replaceChildren();
 const rows=setupPoolEntries(snapshot,deployment.groups());
 const header=document.createElement('h3');header.textContent='Available source counters ('+rows.reduce((n,r)=>n+r.faces.length,0)+')';panel.appendChild(header);
 if(!rows.length){const info=document.createElement('p');info.className='small';info.textContent='All starting-eligible counters are already deployed.';panel.appendChild(info)}
 for(const row of rows){
  const name=document.createElement('h4');name.className='setup-pool-heading';
  name.textContent=(row.owner==='german'?'German':row.owner==='soviet'?'Soviet':row.owner)+' · '+
   (row.kind==='panzer'?'Panzer':row.kind==='mechanized'?'Mechanized':row.kind[0].toUpperCase()+row.kind.slice(1))+
   ' '+(row.size==='army'?'Armies':'Corps')+' ('+row.faces.length+')';panel.appendChild(name);
  const grid=document.createElement('div');grid.className='setup-counter-pool';grid.setAttribute('role','group');grid.setAttribute('aria-label',name.textContent);
  for(const id of row.faces){
   const button=document.createElement('button');button.type='button';button.className='setup-pool-counter';
   if(selected?.kind==='pool'&&selected.id===id)button.classList.add('is-selected');
   button.dataset.poolId=id;button.setAttribute('aria-pressed',String(selected?.kind==='pool'&&selected.id===id));
   button.setAttribute('aria-label',sourceName(id)+' · available '+row.owner+' '+row.kind);
   button.innerHTML=poolCounterArt(id,row.size,selected?.kind==='pool'&&selected.id===id)+
    '<span>'+enc(sourceName(id))+'</span>';
   grid.appendChild(button);
  }
  panel.appendChild(grid);
 }
 panel.scrollTop=scroll;
 $('setup-ready').disabled=!snapshot.concealedMixed;
 const concealed=sourceData.setupSpec.concealedSetup;
 $('setup-mix').textContent=(snapshot.concealedMixed?'Remix ':'Mix ')+concealed.count+' concealed '+concealed.displayName;
 showBoard();syncPhaseBar();
}
/* Two-click selection and drag/drop converge on these same atomic methods. */
function setupPick(item){
 if(!setupActive||!item)return false;
 if(candidateMode){
  const before=setupSelection;
  if(item.kind==='pool'){message('Source-face pool changes are not yet qualified for the combined setup.');return false}
  if(!before){if(item.kind!=='map')return false;setupSelection=item;message('');renderSetup();return true}
  if(item.kind==='map'&&before.id===item.id){setupSelection=null;message('');renderSetup();return true}
  if(item.kind==='hex')return setupMove(before.id,item.id);
  if(item.kind==='map')return setupSwapPosition(before.id,item.id);
  return false;
 }
 const before=setupSelection;
 if(item.kind==='hex'){
  if(before?.kind!=='map'){message('Select a deployed counter before choosing a destination hex.');return false}
  if(deployment.snapshot().placements[before.id]===item.id){setupSelection=null;message('');renderSetup();return true}
  return setupMove(before.id,item.id);
 }
 if(!before){setupSelection=item;message('');renderSetup();return true}
 if(before.kind===item.kind&&before.id===item.id){setupSelection=null;message('');renderSetup();return true}
 if(before.kind==='pool'&&item.kind==='pool'){
  setupSelection=item;message('');renderSetup();return true;
 }
 if(before.kind==='map'&&item.kind==='map'){
  const positions=deployment.snapshot().placements;
  if(positions[before.id]===positions[item.id]){
   message('These counters already occupy the same hex; choose a different deployed position.');return false;
  }
  return setupSwapPosition(before.id,item.id);
 }
 const map=before.kind==='map'?before:item;
 const pool=before.kind==='pool'?before:item;
 return setupSwap(map.id,pool.id);
}
function setupHit(node){
 if(!node?.closest)return null;
 const pool=node.closest('[data-pool-id]');
 if(pool&&$('setup-choices').contains(pool))return {kind:'pool',id:pool.dataset.poolId};
 const counter=node.closest('[data-unit-id]');
 if(counter&&$('counter-overlay').contains(counter))return {kind:'map',id:counter.getAttribute('data-unit-id')};
 const cell=node.closest('[data-hex]');
 if(cell&&$('counter-overlay').contains(cell))return {kind:'hex',id:cell.getAttribute('data-hex')};
 return null;
}
function setupClick(e){
 if(!setupActive)return;
 const hit=setupHit(e.target);
 // Only suppress a synthetic click on the actual drag-drop target, not an
 // unrelated fast user click immediately after the gesture.
 if(hit&&Date.now()<setupDragClickUntil&&setupDragClickTarget?.kind===hit.kind&&
    setupDragClickTarget.id===hit.id){setupDragClickUntil=0;return}
 setupPick(hit);
}
/* Pointer gestures support dragging SVG counters (not reliably HTML-draggable)
 * across the map/pool, with ordinary clicks and keyboard still primary. */
function setupPointerDown(e){
 if(!setupActive||e.button!==0||!Number.isFinite(e.clientX)||e.pointerType==='touch'||e.pointerType==='pen')return;
 const from=setupHit(e.target);
 if(from?.kind==='map'||from?.kind==='pool')
  setupPointer={from,x:e.clientX,y:e.clientY,pointerId:e.pointerId,dragging:false};
}
function setupPointerMove(e){
 if(!setupPointer||e.pointerId!==setupPointer.pointerId)return;
 if(Math.hypot(e.clientX-setupPointer.x,e.clientY-setupPointer.y)>9){
  setupPointer.dragging=true;document.body.classList.add('setup-is-dragging');
 }
}
function setupPointerUp(e){
 if(!setupPointer||e.pointerId!==setupPointer.pointerId)return;
 const pending=setupPointer;setupPointer=null;document.body.classList.remove('setup-is-dragging');
 if(!setupActive||!pending.dragging)return;
 const to=setupHit(document.elementFromPoint(e.clientX,e.clientY));
 setupDragClickUntil=Date.now()+220;setupDragClickTarget=to;
 if(!to){message('Drop on another counter or a source-marked destination hex.');return}
 setupSelection=null;setupPick(pending.from);setupPick(to);
}

function refreshSupportWindow(){
 if(!supportWindow||!sourceData)return;
 const combatPolicy=sourceData.contextSettings.combatPolicy||{};
 const policy=combatPolicy.airSupport;
 const portPolicy=combatPolicy.portSupport;
 if(!policy&&!portPolicy)return;
 const state=!setupActive&&human?human.snapshot():null;
 const turn=state?.cursor?.turn||1;
 const airUse=state?.state?.airUse||{};
 const usedThisTurn=airUse[String(turn)]||{};
 const legalActions=state&&!setupActive&&!aiRunning?actionList:[];
 const pendingActions=legalActions.filter(a=>a?.type==='combat'&&a.action?.type==='commit-ground-air');
 const navalAttacks=legalActions.filter(a=>a?.type==='combat'&&a.action?.type==='declare-fleet-attack');
 const finishNavalAction=legalActions.find(a=>a?.type==='combat'&&a.action?.type==='finish-air-sea')||null;
 const fronts=new Map(sourceData.counterConfig.faces.front.map(f=>[f.faceId,f]));
 const backs=new Map(sourceData.counterConfig.faces.back.map(f=>[f.faceId,f]));
 const markers=(policy?.markers||[]).map(entry=>{
  const original=fronts.get(entry.faceId);
  const label=original?.visualTranscription?.printedIdentifier||String(original?.visualTranscription?.visibleNotation||'').split(';')[0]||entry.faceId;
  const priorTurn=Object.keys(airUse).map(Number).filter(t=>Number.isInteger(t)&&t<turn&&Object.prototype.hasOwnProperty.call(airUse[String(t)]||{},entry.faceId)).sort((a,b)=>b-a)[0];
  const refit=!!entry.cooldownTurns&&priorTurn!==undefined&&turn-priorTurn<=entry.cooldownTurns;
  const preCommitted=state?.combat?.groundAirLocked&&state?.combat?.groundAirChoice===entry.faceId;
  const committed=Object.prototype.hasOwnProperty.call(usedThisTurn,entry.faceId)||preCommitted;
  const notArrived=turn<entry.firstTurn;
  const status=notArrived?'not-arrived':committed?'committed':refit?'refit':'available';
  const action=pendingActions.find(a=>a.action.faceId===entry.faceId)||null;
  const artFace=status==='refit'&&entry.refitFaceId&&backs.has(entry.refitFaceId)?entry.refitFaceId:entry.faceId;
  return {id:entry.faceId,label,shift:entry.shiftRating,status,
   statusLabel:notArrived?'Not arrived':committed?'Committed':refit?'REFIT':'Ready',
   vectorSvg:SupportVectors.render(backs.get(artFace)||fronts.get(artFace),{label,shiftRating:entry.shiftRating,condition:status==='refit'?'refit':'undamaged'}),artFaceId:artFace,
   note:notArrived?'Available from Turn '+entry.firstTurn:
    refit?'Reavailable Turn '+(priorTurn+entry.cooldownTurns+1):
    committed?preCommitted?'Assigned to pending battle':'Already used this turn':
    action?'Eligible for selected battle':'Waiting for eligible combat',
   action:status==='available'?action:null,
   navalAction:status==='available'?navalAttacks.find(a=>a.action.faceId===entry.faceId)||null:null};
 });
 const none=pendingActions.find(a=>a.action.faceId===null)||null;
 const mapTargets=currentSupportMap();
 const newlyEligible=!!supportSelection&&!supportTargetHex&&!previousSupportTargetCount&&mapTargets.hexes.length>0;
 previousSupportTargetCount=mapTargets.hexes.length;
 if(supportTargetHex&&!mapTargets.byHex[supportTargetHex])supportTargetHex=null;
 const targetChoices=supportTargetHex?SupportMap.choicesAt(mapTargets,supportTargetHex):[];
 let fleet=null,fleetActions=[];
 if(portPolicy){
  const marker=state?.state?.supportMarkers?.[portPolicy.markerKey]||null;
  const ports=new Map();
  for(const c of sourceData.contextSettings.map.cells||[]){
   for(const m of c.tileMarkers||[])if(['city','majorCity'].includes(m.kind)&&portPolicy.portNames.includes(m.label))ports.set(c.id,m.label);
  }
  const port=marker?.hex?ports.get(marker.hex)||marker.hex:setupActive?portPolicy.initialPortName:null;
  const status=setupActive?'setup':marker?.condition||'eliminated';
  const pendingNaval=state?.combat?.pendingSeaFaceId!==null&&state?.combat?.pendingSeaFaceId!==undefined;
  const pendingFleetMove=state?.pendingFleet!==null&&state?.pendingFleet!==undefined;
  const pendingForcedPort=state?.pendingPort!==null&&state?.pendingPort!==undefined;
  const face=status==='damaged'?portPolicy.reverseFaceId:portPolicy.sourceFaceId;
  fleet={id:portPolicy.markerKey,label:String(portPolicy.markerKey).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase()),status,
   statusLabel:status==='setup'?'In setup':status==='damaged'?'DAMAGED':status==='undamaged'?'Undamaged':'Eliminated',
   port,vectorSvg:status==='eliminated'?null:SupportVectors.render(backs.get(face)||fronts.get(face),{label:'Black Sea',shiftRating:1,condition:status}),artFaceId:face,
   effect:status==='undamaged'?'At Fleet port: −1 defending / +1 attacking CRT column':
    status==='damaged'?'Damaged: no Fleet odds shift':'No current Fleet combat shift',
   note:pendingFleetMove?'Destination committed to '+(ports.get(state.pendingFleet)||state.pendingFleet)+'; roll the movement damage die in combat controls.':
    pendingForcedPort?'Forced destination committed; resolve its die in the combat controls.':
    pendingNaval?'German naval air attack pending; roll the damage die in combat controls.':
    status==='damaged'?'Port retreat exception remains governed separately by the rules.':
    'Relocation and naval combat use separate legal actions.'};
  const availableFleetActions=legalActions.filter(a=>a?.type==='declare-fleet-move'||a?.type==='commit-forced-port');
  fleetActions=availableFleetActions.map(a=>({kind:a.type,
   label:(a.type==='declare-fleet-move'?'Move Fleet to ':'Force Fleet to ')+(ports.get(a.to)||a.to),action:a}));
 }
 supportWindow.update({turn,owner:[policy?'Air Corps ('+policy.owner+')':null,portPolicy?'Fleet ('+portPolicy.owner+')':null].filter(Boolean).join(' / '),
  phase:setupActive?'Setup':state?(state.actor+' '+state.phaseKind):'Not started',markers,
  pending:pendingActions.length>0,noSupportAction:none,fleet,fleetActions,
  finishNavalAction,navalPending:state?.combat?.pendingSeaFaceId!==null&&state?.combat?.pendingSeaFaceId!==undefined,
  fleetChoiceCount:view?.kind==='post-roll-choice'?(view.fleetCommitments||[]).length:0,
  targetSelection:supportSelection,targetHex:supportTargetHex,targetChoices,
  targetHelp:supportTargetHex?'Target '+supportTargetHex+' selected. Confirm or cancel the assignment.':mapTargets.instruction});
 if(newlyEligible||
  (currentRetreatMap().active&&matchMedia('(max-width:800px), (pointer:coarse)').matches&&!supportWindow.getState().collapsed))
  supportWindow.focusMap();
}
// AI owns the transaction stream; human action discovery is unnecessary until
// control returns. Keep the same board renderer and authoritative session.
function refreshAIProgress(force=false){
 const now=performance.now();const entering=!aiProgressActive;
 if(!force&&!entering&&now-lastAIFrame<250)return;
 aiProgressActive=true;lastAIFrame=now;
 const s=human.snapshot();
 view={kind:'ai-progress',phaseId:s.phaseId,phaseKind:s.phaseKind,actor:s.actor,commands:[],proposals:[],prompts:[]};
 actionList=[];
 $('status').innerHTML='<div class="phase">Turn '+enc(s.cursor.turn)+' · '+enc(s.actor||'complete')+'</div><div class="summary">Phase: '+enc(s.phaseId)+' · Actions: '+enc(s.actionCount)+' · Computer playing</div>';
 if(entering){
  $('decision').textContent='Computer playing. Stop AI to resume manual orders.';
  $('roll-panel').hidden=true;$('post-roll-pages').hidden=true;
  $('orders-section').hidden=true;
  $('actions').replaceChildren();$('battle-proposals').replaceChildren();
  $('battle-choices').hidden=true;
  if($('retreat-route-controls'))$('retreat-route-controls').hidden=true;
  $('filter-note').textContent='';
  buildupMode=null;buildupSlot=null;buildupReserve=null;
  renderBuildupControls();refreshSupportWindow();
 }
 measured('aiBoard',()=>showBoard());
 syncAutomatic();
}
function refresh(){
 if(!setupActive&&human&&(aiRunning||autoEligible())){refreshAIProgress();syncAutomatic();return;}
 aiProgressActive=false;
 if(moveSelection){query='';$('filter').value='';}clearMoveSelection();syncCRTControls();syncAutomatic();
 if(setupActive){refreshSupportWindow();renderSetup();return}
 if(!human)return;
 renderSetup();view=measured('humanView',()=>human.view(postRollPage));const s=human.snapshot();
 const c=s.cursor||{};
 $('status').innerHTML='<div class="phase">Turn '+enc(c.turn||'—')+' · '+enc(s.actor||'complete')+'</div>'+
  '<div class="summary">Phase: '+enc(s.phaseId||'Complete')+' · '+enc(s.phaseKind||'terminal')+'<br>Actions: '+enc(s.actionCount)+' · '+(c.complete?'Final result available':'In progress')+'</div>';
 $('decision').innerHTML=view.kind==='post-roll-choice'?'<p class="highlight">Committed die: '+enc(view.die===null?'automatic NE':view.die)+'</p><p>CRT result: '+enc(view.crtOutcome)+' · select a validated consequence below.'+
  ' Page '+enc(view.choicePage+1)+': source-validated alternatives. This catalogue is not necessarily exhaustive.'+'</p>':
  '<p class="highlight">'+enc(view.phaseKind||'Campaign complete')+'</p><p>'+enc(view.actor||'')+(view.blocked?' · Blocked: '+enc(view.blocked):'')+'</p>'+
 (view.stackingCleanup?'<p class="highlight">'+(view.stackPenalty?'Movement closed. Select '+enc(view.stackPenalty)+' excess unit(s) to remove.':'Stacking limits restored. Complete the phase.')+'</p>':view.stackPenalty?'<p class="highlight">Temporary overstacking: move another unit out or remove '+enc(view.stackPenalty)+' excess unit(s) at phase end.</p>':'');
 if(c.complete&&s.terminal){
  const t=s.terminal,labels={'german-victory':'German victory','soviet-victory':'Soviet victory','draw':'Draw','unresolved-source-rule':'Result unresolved by printed rules'};
  const result=document.createElement('div');result.id='campaign-result';result.className='summary';
  const heading=document.createElement('strong');heading.textContent=(labels[t.outcome]||'Unclassified result');result.append(heading);
  const detail=document.createElement('p');detail.textContent='German-controlled cities: '+t.axisControlledCount+' / '+t.totalCities;result.append(detail);
  if(t.outcome==='unresolved-source-rule'){const note=document.createElement('p');note.textContent='The printed victory conditions do not classify this outcome. It is not a draw.';result.append(note);}
  if(t.graduated&&t.historical){const note=document.createElement('p');note.textContent='Historical adjudication: '+(labels[t.historical.outcome]||'Unclassified result');result.append(note);}
  $('status').append(result);
 }
 if(context?.housekeepingPolicy?.graduatedVictory){const score=document.createElement('p');score.id='graduated-score';score.textContent=E.Graduated.description(context.housekeepingPolicy.graduatedVictory,s.state.cityControl,!!c.complete);$('status').append(score);}
 const prompts=(view.prompts||[]).filter(p=>p.kind==='die-and-choice');
 const automaticNoDie=prompts.length===1&&prompts[0].type==='resolve-battle'&&prompts[0].automaticNoDie===true;
 $('roll-panel').hidden=view.kind==='post-roll-choice'||!prompts.length;
 $('automatic-ne').hidden=!automaticNoDie;
 $('submit-die').hidden=automaticNoDie;
 $('random-die').hidden=automaticNoDie;
 $('die').disabled=automaticNoDie;
 $('die').hidden=automaticNoDie;
 $('roll-panel').querySelector('label[for="die"]').hidden=automaticNoDie;
 $('roll-guidance').textContent=automaticNoDie?'Automatic NE — the rules require no die roll. Commit the result below.':
  'Enter a recorded d6 result or roll the browser’s fair d6.';
 actionList=view.kind==='post-roll-choice'?[...view.options,...view.fleetCommitments]:[...(view.commands||[])];
 if(retreatSelection&&!RetreatMap?.routeById(currentRetreatMap(),retreatSelection))retreatSelection=null;
 const paged=view.kind==='post-roll-choice';
 $('post-roll-pages').hidden=!paged||(!view.hasNextPage&&postRollPage===0);
 $('post-roll-previous').disabled=postRollLoading||postRollPage===0;
 $('post-roll-next').disabled=postRollLoading||!view.hasNextPage;
 $('post-roll-cancel').hidden=!postRollLoading;
 $('post-roll-page-label').textContent=paged?'Page '+(postRollPage+1)+' · '+actionList.length+' validated choices':'';
 measured('humanControls',()=>{renderActions();renderBattleProposals();renderBuildupControls();refreshSupportWindow();});measured('humanBoard',()=>showBoard());syncPhaseBar();
 $('journal').textContent=JSON.stringify({phase:s.phaseId,actor:s.actor,units:Object.values(s.state.units||{}).length,
  pendingGround:s.pendingGround,combat:s.combat?.status,terminal:s.terminal,
  journalTail:displayJournal().slice(-8)},null,2);
}
// Report only actual source-ledger changes after a committed shared-engine action.
// No inference from the target hex, terrain art or presumed country boundaries.
function cityControlNotice(before,after){
 const old=before?.state?.cityControl,newer=after?.state?.cityControl;
 if(!old||!newer)return '';
 const changed=Object.keys(newer).filter(name=>Object.prototype.hasOwnProperty.call(old,name)&&
   old[name]!==newer[name]).map(name=>name+': '+old[name]+' → '+newer[name]);
 return changed.length?'City control changed — '+changed.join(' · '):'';
}
function choose(a){try{cancelPostRollSearch();if(setupActive)throw Error('Finish deployment before playing');if(humanActionBlocked())throw Error('Pause automatic play before submitting a human action');const old=human.snapshot();const next=human.choose(a);const nextState=next.snapshot();const cityNotice=cityControlNotice(old,nextState);human=next;postRollPage=0;retreatSelection=null;
 if(old.phaseId!==nextState.phaseId||old.actor!==nextState.actor||!old.stackingCleanup&&nextState.stackingCleanup){query='';$('filter').value='';selectedBattles.clear();}
 const type=a?.action?.type||a?.type;
 if(type==='declare-ground-move'||type==='resolve-ground-move'){query='';$('filter').value='';}
 if(['commit-ground-air','declare-fleet-attack','declare-fleet-move','commit-forced-port','finish-combat','finish-phase'].includes(type)){
  supportSelection=null;supportTargetHex=null;
 }else supportTargetHex=null;
 message('');refresh();if(cityNotice)message(cityNotice);return true}catch(e){message(e.message);return false}}
function roll(die){try{cancelPostRollSearch();if(setupActive)throw Error('Finish deployment before rolling');if(humanActionBlocked())throw Error('Pause automatic play before rolling');human=human.roll(die);postRollPage=0;retreatSelection=null;message('');refresh();return true}catch(e){message(e.message);return false}}
function undo(){try{cancelPostRollSearch();if(setupActive)throw Error('Use the deployment controls before starting the game');if(aiRunning)throw Error('Stop the active AI side before Undo');const response=human.undo();if(!response.ok){message('There is no earlier action to undo.');return false}
 pauseAutomatic();selectedBattles.clear();redoHistory?.recordUndo(human,response.session);human=response.session;postRollPage=0;retreatSelection=null;supportSelection=null;supportTargetHex=null;message('');refresh();return true}catch(e){message(e.message);return false}}
function redo(){try{if(setupActive||aiRunning||!human)throw Error('Redo unavailable');const next=redoHistory?.take(human);if(!next)return false;
 pauseAutomatic();cancelPostRollSearch();human=next;postRollPage=0;retreatSelection=null;supportSelection=null;supportTargetHex=null;selectedBattles.clear();query='';$('filter').value='';message('Next committed action restored.');refresh();return true;
 }catch(e){message(e.message);return false;}}
function restore(saved){try{cancelPostRollSearch();retreatSelection=null;if(aiRunning)throw Error('Stop the active AI side before loading a save');pauseAutomatic();
 const decoded=root.WargamePlayerSaveConfig?root.WargamePlayerSaveConfig.unpack(saved,playerStrategies):{save:saved,players:{assignment:"manual",german:"diagnostic",soviet:"diagnostic"}};saved=decoded.save;
 let restoredSetupRandom=null;
 if(saved?.missionRandom){
  if(![SourceSetup?.FORMAT,E.Deployment.FORMAT].includes(saved.format))throw Error('Unexpected deployment randomness');
  const {missionRandom,...original}=saved;
  const {digest,...rng}=missionRandom;
  if(Object.keys(rng).sort().join(',')!=='draws,seed'||!Number.isSafeInteger(rng.draws)||rng.draws<0||
     E.Random.validate(rng.seed)!==rng.seed||digest!==WargameSyncSha256.sha256(JSON.stringify([original,rng])))throw Error('Invalid deployment randomness');
  restoredSetupRandom=rng;saved=original;
 }
 if(candidateMode){
  if(saved?.format===SourceSetup.FORMAT){
   const editor=SourceSetup.restore(saved,{opening:candidateOpening,map:sourceData.contextSettings.map,
    policy:sourceData.setupPolicy,counterConfig:sourceData.counterConfig,
    buildupAllocation:sourceData.contextSettings.buildupAllocation});
   candidateEditor=editor;setupMaster=restoredSetupRandom?.seed||E.Random.generate();setupDraws=restoredSetupRandom?.draws||0;redoHistory?.clear();setupActive=true;setupSelection=null;supportSelection=null;if(selectPanel)selectPanel('play');applyPlayers(decoded.players);message('');refresh();return true;
  }
  if(saved?.format==='historical-custom-campaign'){
   if(saved.version!==1||!saved.deployment||!saved.human||saved.integrity?.algorithm!=='SHA-256'||
      Object.keys(saved).sort().join(',')!==['format','version','deployment','human','integrity'].sort().join(','))throw Error('Invalid candidate campaign envelope');
   const {integrity,...payload}=saved;
   if(WargameSyncSha256.sha256(JSON.stringify(payload))!==integrity.digest)throw Error('Candidate campaign checksum mismatch');
   const editor=SourceSetup.restore(saved.deployment,{opening:candidateOpening,map:sourceData.contextSettings.map,
    policy:sourceData.setupPolicy,counterConfig:sourceData.counterConfig,
    buildupAllocation:sourceData.contextSettings.buildupAllocation});
   const nextContext={...clone(editor.commit()),...sourceData.contextSettings,
    buildupAllocation:editor.selectedAllocation()};
   const resolved=restoreHumanWithCRT(saved.human,nextContext);
   candidateEditor=editor;context=resolved.context;human=resolved.human;crtPreference=resolved.variant;victoryPreference=resolved.victory;setupActive=false;customGame=true;
  }else{
   if(saved?.format!==E.Human.FORMAT)throw Error('Unrecognized candidate save format');
   const nextContext={...clone(candidateOpening),...sourceData.contextSettings};
   const resolved=restoreHumanWithCRT(saved,nextContext);
   candidateEditor=SourceSetup.create({opening:candidateOpening,map:nextContext.map,
    policy:sourceData.setupPolicy,counterConfig:sourceData.counterConfig,
    buildupAllocation:sourceData.contextSettings.buildupAllocation});
   context=resolved.context;human=resolved.human;crtPreference=resolved.variant;victoryPreference=resolved.victory;setupActive=false;customGame=false;
  }
  setupMaster=human.missionSeed();setupDraws=human.deploymentDraws();stackTopByHex.clear();postRollPage=0;supportSelection=null;supportTargetHex=null;selectedBattles.clear();query='';$('filter').value='';applyPlayers(decoded.players);message('');refresh();return true;
 }
 if(setupOnly&&saved?.format!==E.Deployment.FORMAT)throw Error('Only source-constrained deployment saves are accepted in this preview');
 if(saved?.format===E.Deployment.FORMAT){deployment=E.Deployment.restore(saved,sourceData.deploymentSource);redoHistory?.clear();setupMaster=restoredSetupRandom?.seed||E.Random.generate();setupDraws=restoredSetupRandom?.draws||0;setupActive=true;setupSelection=null;}
 else if(saved?.format==='historical-custom-campaign'){
  if(saved.version!==1||!saved.deployment||!saved.human||
    saved.integrity?.algorithm!=='SHA-256'||
    Object.keys(saved).sort().join(',')!==['format','version','deployment','human','integrity'].sort().join(','))
   throw Error('Invalid customized campaign envelope');
  const {integrity,...payload}=saved;
  if(integrity.digest!==WargameSyncSha256.sha256(JSON.stringify(payload)))throw Error('Customized campaign checksum mismatch');
  const restoredDeployment=E.Deployment.restore(saved.deployment,sourceData.deploymentSource);
  // Do not alter live session/context until BOTH restore validations pass.
  const committed=restoredDeployment.commit({requireMixed:true});
  const nextContext={...clone(committed.opening),...sourceData.contextSettings,buildupAllocation:committed.allocation};
  const resolved=restoreHumanWithCRT(saved.human,nextContext);
  deployment=restoredDeployment;context=resolved.context;human=resolved.human;crtPreference=resolved.variant;victoryPreference=resolved.victory;setupActive=false;customGame=true;
 }
 else{
  // Historical v401/v402 saves have no embedded deployment. They are only
  // restorable against the original candidate source setup, not a custom game.
  const defaultDeployment=E.Deployment.create({...sourceData.deploymentSource,
   allocation:candidateAllocation,placements:candidatePlacements});
  const opening=defaultDeployment.commit();
  const defaultContext={...clone(opening.opening),...sourceData.contextSettings,buildupAllocation:opening.allocation};
  const resolved=restoreHumanWithCRT(saved,defaultContext);
  deployment=defaultDeployment;context=resolved.context;human=resolved.human;crtPreference=resolved.variant;victoryPreference=resolved.victory;setupActive=false;customGame=false;
 }if(!setupActive){setupMaster=human.missionSeed();setupDraws=human.deploymentDraws();}stackTopByHex.clear();buildupMode=null;buildupSlot=null;buildupReserve=null;supportSelection=null;supportTargetHex=null;postRollPage=0;setupSelection=null;selectedBattles.clear();query='';$('filter').value='';applyPlayers(decoded.players);message('');refresh();return true}
 catch(e){message('Load rejected: '+e.message);return false}}
function reset(){cancelPostRollSearch();retreatSelection=null;supportSelection=null;supportTargetHex=null;previousSupportTargetCount=0;stackTopByHex.clear();buildupMode=null;buildupSlot=null;buildupReserve=null;if(aiRunning){message('Stop the active AI side before restarting');return}pauseAutomatic();
 setupMaster=E.Random.generate();setupDraws=0;
 if(candidateMode){
  deployment=null;candidateEditor=SourceSetup.create({opening:candidateOpening,map:sourceData.contextSettings.map,
   policy:sourceData.setupPolicy,counterConfig:sourceData.counterConfig,
   buildupAllocation:sourceData.contextSettings.buildupAllocation});context=withCRT({...clone(candidateOpening),...sourceData.contextSettings});customGame=false;setupActive=false;setupSelection=null;
  human=E.Human.create({session:E.Campaign.create(context),context,missionSeed:setupMaster||E.Random.generate(),deploymentDraws:setupDraws});
  postRollPage=0;selectedBattles.clear();query='';$('filter').value='';message('');refresh();return;
 }
 deployment=E.Deployment.create({...sourceData.deploymentSource,allocation:candidateAllocation,placements:candidatePlacements});
 if(setupOnly){
  human=null;context=null;customGame=false;setupActive=true;setupSelection=null;
  postRollPage=0;selectedBattles.clear();query='';$('filter').value='';message('');refresh();return;
 }
 bindDeployment(deployment);customGame=false;setupSelection=null;
 human=E.Human.create({session:E.Campaign.create(context),context,missionSeed:setupMaster||E.Random.generate(),deploymentDraws:setupDraws});setupActive=false;
 postRollPage=0;selectedBattles.clear();query='';$('filter').value='';message('');refresh()}
async function start(){
 try{
  if(!E||!Art||!Face||!Display||!BuildupMap)throw Error('Required shared historical modules unavailable');
  config=await loadJson(document.body.dataset.historicalConfig);
  setupOnly=config.mode==='deployment-preview-only';candidateMode=config.mode==='experimental-candidate-campaign';
  if(config.mode&&!setupOnly&&!candidateMode)throw Error('Unrecognized historical browser mode');
  const names=candidateMode?['map','counterConfig','profile','phaseConfig','combatPolicy','rosterOverlay','opening','setupPolicy',
   ...(config.firstTurnEmptyBuildupPolicy?['firstTurnEmptyBuildupPolicy']:[]),
   ...(config.buildupPolicy?['buildupPolicy','buildupAllocation','housekeepingPolicy']:[])]:
   setupOnly?['map','counterConfig','setup','profile','phaseConfig']:
   ['map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy'];
  const all=await Promise.all(names.map(k=>loadJson(config[k])));
  const data=Object.fromEntries(names.map((k,i)=>[k,all[i]]));
  const {map,counterConfig,setup,setupPolicy,profile,phaseConfig,combatPolicy,buildupPolicy,housekeepingPolicy,rosterOverlay,opening,firstTurnEmptyBuildupPolicy,buildupAllocation}=data;
  if(map.sourceGame!==config.sourceGame||phaseConfig.scenarioId!==config.scenarioId||map.id!==profile.sourceMapId&&profile.sourceMapId!==undefined)
   throw Error('Scenario source mismatch');
  // An external source-bounded sample is used only for unplayable previews.
  // Never embed Kiev-only fixtures in the shared game bundle.
  if(candidateMode){
   if(opening?.schemaVersion!==1||opening.status!=='source-pinned-experimental-opening-not-historically-certified'||
      opening.mapId!==map.id||opening.profileScope!==profile.experimentalGraphScope||
      opening.contextStart?.cursor?.scenarioId!==phaseConfig.scenarioId||
      opening.audit?.historicalCertified!==false||opening.audit?.groundUnits!==36||
      opening.audit?.navalMarkers!==1||Object.keys(opening.contextStart?.state?.units||{}).length!==36)
    throw Error('Invalid source-bound experimental starting manifest');
   candidateOpening=opening.contextStart;
   if(!SourceSetup)throw Error('Historical candidate setup editor script missing');
   candidateEditor=SourceSetup.create({opening:candidateOpening,map,policy:setupPolicy,
    counterConfig,buildupAllocation});
   sourceData={counterConfig,setupPolicy,contextSettings:{map,profile,config:phaseConfig,counterConfig,combatPolicy,rosterOverlay,
    ...(firstTurnEmptyBuildupPolicy?{firstTurnEmptyBuildupPolicy}:{}),
    ...(buildupPolicy?{buildupPolicy,buildupAllocation,housekeepingPolicy}:{}),
    enableAirSupport:true}};
   const setupBtn=$('configure-setup');if(setupBtn)setupBtn.hidden=false;
  }
  const fixture=candidateMode?null:setupOnly?await loadJson(config.candidateData):E.Fixtures?.[config.candidateFixture];
  if(!candidateMode&&(!fixture||(!setupOnly&&typeof config.candidateFixture!=='string')))throw Error('Required candidate setup fixture missing');
  if(!candidateMode){candidateAllocation=fixture.selected||fixture.allocation;
  candidatePlacements=fixture.placements;
  if(!candidateAllocation||!candidatePlacements)throw Error('Incomplete fixture');}
  const [inventoryPolicy,fixedPolicy]=await Promise.all([
   config.inventoryPolicy?loadJson(config.inventoryPolicy):Promise.resolve(null),
   config.fixedPolicy?loadJson(config.fixedPolicy):Promise.resolve(null)]);
  if(!candidateMode){
   const inventory=inventoryPolicy?E.SourceFaceInventory.create(inventoryPolicy):E.Inventory;
   const inventoryReport=inventory.inspect(counterConfig);
   if(!inventoryReport.valid)throw Error('Invalid source face inventory');
   sourceData={setupSpec:setup,counterConfig,inventoryReport,
    deploymentSource:{map,setupSpec:setup,counterConfig,inventory,phaseConfig,fixedPolicy,
     movementProfile:profile,phaseFactories:{combat:()=>({})},supportPolicy:combatPolicy?.portSupport?combatPolicy:null},
    contextSettings:{map,profile,config:phaseConfig,counterConfig,combatPolicy,fixedPolicy,
     enableAirSupport:true,buildupPolicy,housekeepingPolicy}};
  }
  for(const c of map.cells)centerById.set(c.id,c);
  const mapAsset=$('map-art');mapAsset.src=config.mapExport;
  const bounds=config.mapViewBox;
  if(!Array.isArray(bounds)||bounds.length!==4||bounds.some(x=>!Number.isFinite(x))||bounds[2]<=0||bounds[3]<=0)throw Error('Missing validated map viewport geometry');
  $('counter-overlay').setAttribute('viewBox',bounds.join(' '));
  $('map-viewport').style.aspectRatio=bounds[2]+' / '+bounds[3];
  root.WargameTouchMap.mount({scroll:$('map-scroll'),stage:$('map-viewport'),toolbar:$('map-navigation')});
  if(combatPolicy?.airSupport?.markers?.length||combatPolicy?.portSupport){
   if(!root.WargameSupportWindow)throw Error('Shared Air Support Window module missing');
   supportWindow=root.WargameSupportWindow.mount({scenario:config.scenarioId,mapTargeting:true,
    onAction:action=>choose(action),onSelect:pickSupport,onCancel:cancelSupportSelection});
  }
  selectPanel=Display.setupTabs($('game-sidebar'));
  displayControl=Display.mount($('settings-display'),map,{onChange:()=>{terrainTooltip?.hide();refreshDisplay()}});
  mountCRTSettings();
  if(!setupOnly)referenceDialog=root.WargameReferenceDialog.mount(document.querySelector('#game-sidebar > section'),(tab,holder)=>root.WargameReferenceDialog.historical(tab,holder,{phaseConfig,profile,combatPolicy,variant:context?.combatPolicy?.crtVariant==='advanced'?'advanced':'standard'}));
  // Non-playable setup previews must never require/claim a certified movement graph.
  // The approved map and counters still render using the shared visual modules.
  if(!setupOnly)terrainTooltip=root.WargameTerrainTooltips.mount({surface:$('map-scroll'),board:map,settings:displayControl,
   gameRules:{movement:profile,combat:combatPolicy},edgeBoard:E.MovementReference.build(map,profile).board,unitsAtHex:el=>{const id=el?.closest?.('[data-unit-id]')?.dataset.unitId;return (setupActive?(candidateMode?candidateEditor:deployment)?.snapshot().units:human?.snapshot().state.units)?.[id]?.hex||null}});
  reset();
  $('new-game').onclick=reset;
  $('configure-setup').onclick=()=>{try{enterSetup();selectPanel('play')}catch(e){message(e.message)}};
  $('setup-mix').onclick=setupShuffle;
  $('setup-ready').onclick=beginFromSetup;
  $('setup-choices').addEventListener('click',setupClick);
  document.addEventListener('keydown',e=>{if(setupActive&&e.key==='Escape'){setupSelection=null;message('');renderSetup()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&retreatSelection&&!setupActive){e.preventDefault();clearRetreat();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&supportSelection&&!setupActive){e.preventDefault();cancelSupportSelection();message('Support selection cancelled.')}});
  document.addEventListener('pointerdown',setupPointerDown);
  document.addEventListener('pointermove',setupPointerMove);
  document.addEventListener('pointerup',setupPointerUp);
  document.addEventListener('pointercancel',()=>{setupPointer=null;document.body.classList.remove('setup-is-dragging')});
  $('undo').onclick=undo;
  if(document.documentElement.dataset.missionId)root.WargameMissionStorage?.mountToolbar({undo:$('undo'),redo,settings:()=>selectPanel('settings')});
  syncHistory();
  $('filter').oninput=()=>{clearMoveSelection();query=$('filter').value;renderActions();renderBattleProposals();showBoard()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&moveSelection){clearMoveSelection();query='';$('filter').value='';renderActions();showBoard();}});
  $('buildup-operation').onchange=()=>{buildupMode=$('buildup-operation').value;buildupSlot=null;buildupReserve=null;renderBuildupControls();showBoard()};
  $('buildup-target').onchange=()=>{
   if(buildupMode==='entry')buildupSlot=$('buildup-target').value;
   if(buildupMode==='rebuild')buildupReserve=$('buildup-target').value;
   renderBuildupControls();showBoard();
  };
  function onLiveMapHit(node,shift=false){
   if(setupActive)return false;
   if(!human)return false;
   if(human.snapshot().cursor.complete){message('Campaign complete. Start a new mission to play again.');return true;}
   if(humanActionBlocked()){message('Computer controls this side. Pause automatic play to issue orders.');return true;}
   const routeHit=node.closest('[data-retreat-route]'),unit=node.closest('[data-unit-id]'),hexHit=node.closest('[data-hex]');
   if(routeHit){const staged=stageRetreat(routeHit.dataset.retreatRoute);if(staged)root.WargameResponsiveShell?.openAt('orders-section');return staged;}
   const current=human.snapshot();const hex=unit?current.state.units[unit.dataset.unitId]?.hex:hexHit?.dataset.hex;
   const stack=hex?Object.values(current.state.units).filter(u=>u.hex===hex&&!['eliminated','dead'].includes(u.strengthStatus)):[];
   if(supportSelection){if(hex)return supportMapHit(hex);message('Select a highlighted legal hex, or cancel Support selection.');return true;}
   const retreatMap=currentRetreatMap();
   if(hex&&retreatMap.byDestination?.[hex]?.length){
    const candidates=retreatMap.byDestination[hex];
    // Overlapping legal destinations cycle through distinct validated paths.
    const index=candidates.indexOf(retreatSelection),next=candidates[(index+1)%candidates.length];
    const staged=stageRetreat(next);if(staged)root.WargameResponsiveShell?.openAt('orders-section');return staged;
   }
   if(hex&&stack.length>1&&(current.phaseKind==='buildup'&&unit||shift))return rotateStack(hex);
   if(current.phaseKind==='buildup'&&hex){
    const m=currentBuildupMap(current.state);
    const chosen=BuildupMap.actionAtHex(m,hex,stackAt(hex,stack));
    if(chosen){if(aiRunning){message('Stop the AI side before placing or repairing.');return true}
     choose(chosen);return true;}
   }
   if(!humanActionBlocked()&&moveSelection&&hex){
    const options=movesFor(moveSelection).filter(a=>a.request.path.at(-1)===hex);
    if(options.length===1){if(choose(options[0]))root.WargameResponsiveShell?.openAt('orders-section');return true;}
    if(options.length>1){moveDestination=hex;query='';$('filter').value='';renderActions();showBoard();message('Choose the movement route or mode from Orders.');root.WargameResponsiveShell?.openAt('orders-section');return true;}
   }
   if(!humanActionBlocked()&&hex){
    const battle=actionList.find(a=>a.action?.type==='select-battle'&&a.action.defenderHex===hex);
    if(battle){query='';$('filter').value='';if(choose(battle))root.WargameResponsiveShell?.openAt('decision-section');return true;}
   }
   if(moveSelection&&hex&&!unit){message('This hex is not a legal destination for the selected counter. Choose a highlighted hex, or press Escape to cancel.');return true;}
   const term=hex&&view?.phaseKind==='combat'&&view.proposals?.some(p=>p.defenderHex===hex)?hex:unit?.getAttribute('data-unit-id')||hex;
   if(term){
    const next=!humanActionBlocked()&&unit&&movesFor(term).length?term:null;
    if(next&&moveSelection===next){clearMoveSelection();query='';$('filter').value='';message('Selection cleared.');}
    else{clearMoveSelection();moveSelection=next;query=term;$('filter').value=term;message(next?'Counter selected. Choose a highlighted destination.':view?.phaseKind==='combat'?'Filtered combat choices for '+term+'.':'Selected '+term+' for inspection; no movement action selected.');}
    renderActions();renderBattleProposals();showBoard();
    if(hex&&view?.phaseKind==='combat'&&view.proposals?.some(p=>p.defenderHex===hex)){const details=$('battle-choices');details.open=true;root.WargameResponsiveShell?.openAt('battle-choices');}
   }
   if(!term)message('Select a counter or highlighted legal hex.');
   return Boolean(term);
  }
  $('counter-overlay').addEventListener('click',e=>{
   if(setupActive){setupClick(e);return}
   onLiveMapHit(e.target,e.shiftKey);
  });
  $('counter-overlay').addEventListener('keydown',e=>{
   if(setupActive){if(['Enter',' '].includes(e.key)){const hit=setupHit(e.target);if(hit){e.preventDefault();setupPick(hit)}}return}
   if(!['Enter',' '].includes(e.key)||!e.target.matches('[data-buildup-action],[data-support-target],[data-retreat-route],[data-retreat-target],.movement-target-hex,.battle-target-hex,[data-unit-id][role=button]'))return;
   e.preventDefault();onLiveMapHit(e.target,e.shiftKey);
  });
  $('commit-battles').onclick=()=>{
   const battles=[...selectedBattles].map(x=>JSON.parse(x));
   if(battles.length&&choose({type:'combat',action:{type:'commit-battles',battles}}))selectedBattles.clear();
  };
  $('post-roll-previous').onclick=()=>{if(!postRollLoading&&postRollPage>0){postRollPage--;retreatSelection=null;message('');refresh()}};
  $('post-roll-cancel').onclick=()=>{
   if(!postRollLoading)return;
   cancelPostRollSearch();message('Consequence search cancelled; committed die unchanged.');refresh();
  };
  $('post-roll-next').onclick=async()=>{
   if(postRollLoading||view?.kind!=='post-roll-choice'||!view.hasNextPage)return;
   const targetPage=postRollPage+1,token=++postRollSearchToken;
   postRollLoading=true;
   $('post-roll-next').disabled=true;
   $('post-roll-cancel').hidden=false;
   $('post-roll-page-label').textContent='Checking more source-valid choices…';
   // Yield before the first batch. Subsequent batches validate a bounded
   // number of candidates and yield again, allowing Cancel to take effect.
   await new Promise(resolve=>setTimeout(resolve,0));
   try{
    while(token===postRollSearchToken){
     const progress=human.preparePage(targetPage,24);
     if(token!==postRollSearchToken)return;
     if(progress.ready){
      postRollLoading=false;postRollPage=targetPage;retreatSelection=null;message('');refresh();return;
     }
     $('post-roll-page-label').textContent='Checking consequences… '+progress.examined+
      ' attempted · '+progress.validated+' validated. Cancel is available.';
     await new Promise(resolve=>setTimeout(resolve,0));
    }
   }catch(e){
    if(token!==postRollSearchToken)return;
    postRollLoading=false;refresh();message(e.message);
   }
  };
  $('submit-die').onclick=()=>roll(Number($('die').value));
  $('random-die').onclick=()=>{if(human.missionSeed()){try{cancelPostRollSearch();if(setupActive||humanActionBlocked())throw Error('Random roll unavailable');human=human.rollRandom();postRollPage=0;retreatSelection=null;message('');refresh();}catch(e){message(e.message)}return;}const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
   const threshold=4294967296-(4294967296%6);let n=bytes[0];while(n>=threshold){crypto.getRandomValues(bytes);n=bytes[0]}
   roll(n%6+1)};
  $('automatic-ne').onclick=()=>roll(null);
  $('save').onclick=()=>{
   const blob=new Blob([JSON.stringify(saveCurrent(),null,2)],{type:'application/json'});
   const href=URL.createObjectURL(blob);const link=document.createElement('a');link.href=href;
   link.download=setupActive?'historical-deployment-save.json':'historical-candidate-save.json';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  $('load').onchange=async e=>{try{const file=e.target.files[0];if(file){const content=await file.text();restore(JSON.parse(content))}}
   catch(err){message('Load rejected: '+err.message)}finally{e.target.value=''}};
  // Per-faction policy is persistent configuration, separate from authoritative rules state.
  // Capture once per side so a running side cannot silently change doctrine.
  function selectedAIPolicy(){
   const mode=$(human.snapshot().actor==='soviet'?'ai-policy-soviet':'ai-policy')?.value||$('ai-policy')?.value||'diagnostic';
   const difficulty=Number($(human.snapshot().actor==='soviet'?'ai-difficulty-soviet':'ai-difficulty')?.value||0);
   if(mode==='diagnostic'&&!difficulty)return {selectionMode:'first'};
   if(['diagnostic','operational','reserve-relief'].includes(mode))return {selectionMode:'first',phaseScope:'operational',objectivePolicy:mode==='reserve-relief'?'reserve-relief':'baseline',...(difficulty?{difficulty}:{})};
   throw Error('Unknown computer strategy');
  }
  $('ai-side').onclick=async()=>{
   if(aiRunning||setupActive||!human||human.snapshot().cursor.complete)return;
   if(human.hasPendingRoll()){message('Resolve the committed human die before passing control to the AI.');return}
   if(!aiPaused&&aiAssignment!=='manual'&&!computerOwns(human.snapshot().actor)){message('This side is assigned to the human. Pause automatic play to override.');return}
   cancelPostRollSearch();postRollPage=0;retreatSelection=null;clearMoveSelection();selectedBattles.clear();query='';$('filter').value='';
   supportSelection=null;supportTargetHex=null;aiRunning=true;aiStopRequested=false;$('ai-stop').hidden=false;$('ai-side').disabled=true;
   const actor=human.snapshot().actor;let count=0;
   for(const id of ['ai-policy','ai-policy-soviet','ai-difficulty','ai-difficulty-soviet'])if($(id))$(id).disabled=true;
   $('ai-step').disabled=true;syncAutomatic();
   try{
    refreshAIProgress();
    const policy=selectedAIPolicy();
    while(count<128&&!aiStopRequested&&human.snapshot().actor===actor&&!human.snapshot().cursor.complete){
     const next=measured('aiTransaction',()=>human.autoplayStep(policy));
     if(!next.session)throw Error('AI policy blocked: '+(next.decision.reason||next.decision.status));
     human=next.session;redoHistory?.observe(human);count++;
     refreshAIProgress();
     // Yield independently of painting; Stop remains available at legal boundaries.
     const yieldStart=performance.now();await new Promise(resolve=>setTimeout(resolve,0));
     const elapsed=performance.now()-yieldStart;const timing=perfStats.aiYield||(perfStats.aiYield={count:0,ms:0,maxMs:0});timing.count++;timing.ms+=elapsed;timing.maxMs=Math.max(timing.maxMs,elapsed);
    }
    const sameActor=!human.snapshot().cursor.complete&&human.snapshot().actor===actor;
    const chunkEnded=count===128&&sameActor;
    // Keep the bounded browser chunk, but only pause a manual side request.
    // Automatic continuation is scheduled by syncAutomatic after refresh,
    // which rechecks ownership, committed human rolls and stop requests.
    if(aiStopRequested||(chunkEnded&&(aiPaused||!computerOwns(actor))))pauseAutomatic();
    message(aiStopRequested?'AI play stopped after '+count+' actions.':
     chunkEnded?(aiPaused?'AI action budget reached (128); resume explicitly.':'AI continuing '+actor+' side after '+count+' actions.'): 'AI finished '+actor+' side ('+count+' actions).');
   }catch(err){pauseAutomatic();message('AI stopped: '+err.message)}
   finally{aiRunning=false;$('ai-stop').hidden=true;$('ai-side').disabled=false;$('ai-step').disabled=false;for(const id of ['ai-policy','ai-policy-soviet','ai-difficulty','ai-difficulty-soviet'])if($(id))$(id).disabled=false;refresh()}
  };
  $('ai-stop').onclick=()=>{pauseAutomatic();aiStopRequested=true;syncAutomatic()};
  $('ai-step').onclick=()=>{
   if(aiRunning){message('Wait for or stop the current AI side.');return}
   if(setupActive||!human||human.snapshot().cursor.complete)return;
   if(!aiPaused&&aiAssignment!=='manual'){message('Pause automatic play before using manual AI step.');return}
   try{
    const next=human.autoplayStep(selectedAIPolicy());
    if(!next.session)throw Error('AI controller blocked: '+(next.decision.reason||next.decision.status));
    cancelPostRollSearch();postRollPage=0;retreatSelection=null;supportSelection=null;supportTargetHex=null;selectedBattles.clear();query='';$('filter').value='';
    human=next.session;message('');refresh();
   }catch(err){message(err.message)}
  };
  if($('ai-assignment')){
   $('ai-assignment').onchange=()=>{pauseAutomatic();aiAssignment=$('ai-assignment').value;refresh()};
   $('ai-resume').onclick=()=>{if(aiRunning||aiAssignment==='manual')return;if(aiPaused)aiPaused=false;else pauseAutomatic();refresh()};
   aiReady=true;syncAutomatic();
  }
  if(document.documentElement.dataset.missionId)await root.WargameMissionStorage?.mount({id:document.documentElement.dataset.missionId,anchor:$('save').parentElement,save:saveCurrent,restore,busy:()=>aiRunning,pause:()=>{pauseAutomatic();syncAutomatic()},reference:referenceDialog?.open,notice:message});
  // Test/API interface uses the exact human gateway for all state changes.
  root.HistoricalBrowserPreview=Object.freeze({view:()=>setupOnly?{kind:'deployment-preview',gameplayAuthorized:false}:setupActive&&candidateMode?{kind:'source-constrained-deployment',gameplayAuthorized:false}:clone(setupActive?human.view():view),
   snapshot:()=>setupOnly?clone(deployment.snapshot()):setupActive&&candidateMode?clone(candidateEditor.snapshot()):clone(human.snapshot()),
   save:()=>saveCurrent(),performanceStats:()=>clone(perfStats),choose,roll,undo,redo,restore,reset,
   enterSetup,setupView:()=>candidateMode?candidateEditor?.snapshot():deployment?.snapshot(),setupMove,setupSwapPosition,setupSwap,setupShuffle,setupSelectInfantryReserve,beginFromSetup,
   setupSelection:()=>clone(setupSelection),setupPick:(kind,id)=>setupPick({kind,id}),
   buildupMap:()=>setupActive?null:clone(currentBuildupMap(human.snapshot().state)),
   supportMap:()=>setupActive?null:clone(currentSupportMap()),supportSelection:()=>clone(supportSelection),
   retreatMap:()=>clone(currentRetreatMap()),retreatSelection:()=>retreatSelection,stageRetreat,clearRetreat,
   stackTop:hex=>stackAt(hex,Object.values(human.snapshot().state.units).filter(u=>u.hex===hex)).at(-1)?.id||null,
   displaySettings:()=>displayControl.get(),setDisplaySettings:next=>displayControl.set(next),selectTab:name=>selectPanel(name)});
 }catch(e){$('status').textContent='Source/engine initialization failed';message(e.stack||e.message)}
}
start();
})(typeof globalThis!=='undefined'?globalThis:this);
