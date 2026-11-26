/* Generic historical scenario policy projection for shared-native gameplay.
 * Never changes a scenario's source board, units,
 * CRT, or objectives. No legacy engine is referenced or dynamically executed.
 * Source-coordinate and Oberlabs UX certification are tracked separately.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameNativePreviewConfig=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const sections={
 game:new Set(['engine']),
 rules:new Set(['initialPhaseId','phasesBySide','movement','weather','combat','replacements']),
 deployments:new Set(['presets','requiredCounts','placementTags','manualSetup','interactiveReinforcements','openingRedeployment'])
};
function fail(what){throw new Error('Native scenario config: '+what);}
// Shared-native policy may supply only presentation-neutral policy selection and
// source-compatible implementation details. The CRT and source modifiers are
// immutable and remain defined by the scenario's original rules package.
function validateCombatDelta(source,value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!Object.keys(value).length)fail('invalid combat profile');
 const allowed=new Set(['terrainDefenderFactions','retreatModule','exchangeMode','defaultLossPriority','defaultAdvancePriority','retreatTieBreakByFaction']);
 if(Object.keys(value).some(k=>!allowed.has(k)))fail('combat CRT and modifiers must come from source');
 const sides=(source.game.factions||[]).map(x=>x.id);
 if(value.retreatModule!==undefined&&(!['one-hex-open-v1','retreat-radial-zoc-v1'].includes(value.retreatModule)||
    value.retreatModule==='retreat-radial-zoc-v1'&&!(source.rules.specialRules||[]).some(x=>x.module===value.retreatModule)))fail('unsupported combat retreat policy');
 if(value.exchangeMode!==undefined&&!['match-defender-step-loss','one-step'].includes(value.exchangeMode))fail('unsupported exchange policy');
 for(const name of ['defaultLossPriority','defaultAdvancePriority'])
  if(value[name]!==undefined&&!['weakest','first'].includes(value[name]))fail('unsupported combat default priority');
 if(value.retreatTieBreakByFaction!==undefined){
  const table=value.retreatTieBreakByFaction;
  if(!table||typeof table!=='object'||Array.isArray(table)||
    Object.keys(table).some(k=>!sides.includes(k)||!['x-asc','x-desc'].includes(table[k])))fail('invalid retreat tie-break configuration');
 }
 if(value.terrainDefenderFactions!==undefined){
  const table=value.terrainDefenderFactions;
  if(!table||typeof table!=='object'||Array.isArray(table)||Object.values(table).some(x=>!Array.isArray(x)||x.some(side=>!sides.includes(side))))fail('invalid terrain defender factions');
 }
}
function project(source,profile){
 if(!source||!source.game||!source.rules||!source.deployments||!source.map||!source.units||!source.objectives)fail('missing source package');
 if(!profile||profile.schemaVersion!==1||!['shared-native','differential-only'].includes(profile.status)||profile.scenarioId!==source.game.id)fail('unknown preview profile');
 if(!profile.overrides||typeof profile.overrides!=='object'||Array.isArray(profile.overrides))fail('missing overrides');
 const result=copy(source);
 if(profile.adjudications!==undefined&&profile.adjudications!=='historical-20261125-v1')fail('unknown historical adjudications');
 if(profile.adjudications==='historical-20261125-v1')result.rules.adjudications=profile.adjudications;
 for(const [section,entries] of Object.entries(profile.overrides)){
  if(!sections[section]||!entries||typeof entries!=='object'||Array.isArray(entries))fail('unsupported section '+section);
  for(const [field,value] of Object.entries(entries)){
   if(!sections[section].has(field))fail('unsupported override '+section+'.'+field);
   if(section==='rules'&&field==='replacements'){
    if(!value||typeof value!=='object'||Array.isArray(value)||
      Object.keys(value).some(k=>!['excludedTypesUntilTurn','entryStrength','preventSameTurnEntryRestore'].includes(k))||
      value.preventSameTurnEntryRestore!==undefined&&typeof value.preventSameTurnEntryRestore!=='boolean')
     fail('invalid replacement profile');
    result.rules.replacements={...result.rules.replacements,...copy(value)};
   }else if(section==='rules'&&field==='combat'){
    validateCombatDelta(source,value);
    result.rules.combat={...result.rules.combat,...copy(value)};
   }else result[section][field]=copy(value);
  }
 }
 if(result.game.engine!=='generic-hex-v1')fail('not a generic engine package');
 if(JSON.stringify(result.map)!==JSON.stringify(source.map)||JSON.stringify(result.units)!==JSON.stringify(source.units)||JSON.stringify(result.objectives)!==JSON.stringify(source.objectives)||JSON.stringify(result.rules.combat.table)!==JSON.stringify(source.rules.combat.table)||JSON.stringify(result.rules.specialRules)!==JSON.stringify(source.rules.specialRules))fail('source data mutation detected');
 return result;
}
// Variant rules are authored in the trusted scenario profile, never in a save.
function withStacking(source,profile,mode='historical'){
 const result=copy(source);
 if(mode==='historical')return result;
 const v=profile?.stackingVariant;
 if(mode!=='double'||profile.scenarioId!==source.game.id||!v||v.id!=='double'||v.maxCombatUnits!==2||v.cityHoldPolicy!=='one-step-choice'||v.strictMinimumOdds!==true)fail('unsupported stacking variant');
 if((result.rules.specialRules||[]).some(x=>['stacking-capacity-v1','stacked-battle-v1'].includes(x.module)))fail('existing stacking policy');
 result.rules.specialRules.push({module:'stacking-capacity-v1',maxCombatUnits:v.maxCombatUnits},{module:'stacked-battle-v1',maxDefenders:2,cityHoldPolicy:v.cityHoldPolicy,strictMinimumOdds:v.strictMinimumOdds});
 return result;
}
return {project,withStacking};
});
