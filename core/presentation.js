/* Universal display configuration for all hex games. No rules or AI logic. */
(function(root,factory){const factions=(typeof module==='object'&&module.exports)?require('./factions'):root.WargameFactions;if(!factions)throw Error('Load core/factions.js before presentation.js');const initialRegistry=(typeof module==='object'&&module.exports)?require('../maps/registry.json').maps:[];const api=factory(factions,initialRegistry);if(typeof module==='object'&&module.exports)module.exports=api;root.WargamePresentation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(FACTIONS,initialRegistry){
'use strict';
const KINDS=Object.freeze(['open','forest','woods','swamp','hills','mountain','rough']);
const MAPS=Object.create(null);
function configureProfiles(entries){
 if(!Array.isArray(entries))throw Error('Map profiles must be an array');
 for(const item of entries){
  if(!item||typeof item.id!=='string'||!item.id||typeof item.renderOptions!=='object'||Array.isArray(item.renderOptions)||!item.renderOptions)throw Error('Invalid map render profile');
  MAPS[item.id]={width:item.width,height:item.height,padding:item.padding,majorCityLabels:item.majorCityLabels,...item.renderOptions};
 }
}
configureProfiles(initialRegistry||[]);
const DEFAULTS=Object.freeze({tileFit:'stretch',tileOpacity:1,reuseTerrainTextures:true,unknownTerrainFill:'#bec6bf',gridOpacity:.94,gridStrokeColor:'#192528',gridStrokeWidth:1.2,showGrid:true,showNumbers:true,showWaterBodies:true,showFortifications:true,showCityHexHighlights:true,showEntryEdges:true,entryBorderExteriorOffsetFraction:.14,germanEntryColor:FACTIONS.reinforcements.german.color,sovietEntryColor:FACTIONS.reinforcements.soviet.color,showCandidateEntryEdges:false,showCandidateDeployment:true,deploymentPairSpacing:FACTIONS.deploymentIcons.pairSpacing,deploymentScale:FACTIONS.deploymentIcons.scale,showOffHexAuthoredCityCenters:false,showAuthoredSourceVectors:true,showOriginalRailTrace:false,showSourceReinforcementAudit:false,sourceVectorGeometryOnly:true,seamlessTerrainTextureSizes:{swamp:180},showProvisionalRails:false,showSourceWaterTraces:false,showSourceRiverTraces:false,authoredRiverMode:'procedural-ribbon',riverWidthScale:1,majorRiverWidthScale:1,riverWaveAmplitude:1.8,riverWaveLength:24,riverTerminalWidthRatio:.6,waterColor:'#30b9bfff',waterSeed:123456,waterFringeDepth:21.6,lakeFringeDepth:15.12,seaFringeDepth:14.4,nearSeaLakeFringeDepth:5.04,shallowCoastSeaAdjacencyDistance:2,seaShoreAmplitude:4,numberStyle:{placement:'topRight',offsetX:-5,offsetY:5}});
// Per-kind source-pixel presentation: all terrain variants remain configurable.
// v441 Swamp is the exact user-supplied seamless raster, not a generated recolor.
const TERRAIN_TEXTURE_VARIANTS=Object.freeze({open:'v439',forest:'v439',swamp:'user-v441'});
function textures(prefix='supplied_assets/flat/'){
 return Object.fromEntries(KINDS.map(kind=>{
  const variant=TERRAIN_TEXTURE_VARIANTS[kind];
  return [kind,prefix+'terrain-'+kind+(variant?'-'+variant:'')+'.png'];
 }));
}
function options(id,custom={}){const k=MAPS[id]||{};
 const sharedStyle={openTerrainLighten:0,forestLayering:true,majorCityGrayHex:true,cityBorderWidth:4.5,cityBorderDotGap:28.2,cityBorderOutsideGrid:false};
 return {...DEFAULTS,...k,...sharedStyle,id:id+'-shared',theme:k.theme||'generic',textures:textures(),...custom};}
function genericCenter(x,y){return {x:61+x*63,y:63+y*71-(x%2?35.5:0)};}
function renderedLayers(svg){return [...svg.matchAll(/data-layer="([^"]+)"/g)].map(m=>m[1]);}
return Object.freeze({KINDS,MAPS,DEFAULTS,textures,configureProfiles,options,genericCenter,renderedLayers});
});
