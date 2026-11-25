'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const SourceSetup=require('../core/scenario_starting_setup');
const map=require('../maps/arduous.json');
const spec=require('../maps/setup/arduous.json');
const reg=require('../maps/registry.json');
let checks=0;
const check=(v,label)=>{assert.ok(v,label);checks++;};
const entry=reg.maps.find(x=>x.id==='arduous');
const replacements=entry.renderOptions.deploymentMarkerOverrides;
check(JSON.stringify(Object.keys(replacements).sort())===JSON.stringify(['0209','0211']),'only requested locations overridden');
const before=Object.fromEntries(['0209','0211'].map(id=>[id,map.cells.find(x=>x.id===id)]));
check(before['0209'].tileMarkers.some(x=>x.kind==='star'),'source data still has Soviet star at 0209');
check(before['0211'].tileMarkers.some(x=>x.kind==='fixedMechanized'),'source SVG still has Brest glyph at 0211');
const svg=T.svgMap(map,P.options('arduous',{reuseTerrainTextures:false}));
for(const h of ['0209','0211']){
 const m=svg.match(new RegExp(`<g data-deployment-hex="${h}"[^>]*>[\\s\\S]*?<\\/g>`));
 check(Boolean(m),'visible '+h+' deployment icon');
 check(m[0].includes('data-deployment-kind="fixedInfantry"'),'fixed Infantry at '+h);
 check(m[0].includes('data-visual-override="true"'),'explicit override flag at '+h);
 check(m[0].includes('data-faction="german"'),'German attribution at '+h);
 check(m[0].includes('data-unit-type="infantryCorps"'),'German Corps semantics at '+h);
}
const sourceSetup=SourceSetup.slots(map,spec);
check(sourceSetup.errors.length===0,'published setup rules remain valid');
check(sourceSetup.slots.star.length===7,'seven Soviet setup stars retained for rule testing');
check(sourceSetup.slots.fixedMechanized.length===3,'named-city rear Mechanized slots retained');
check(sourceSetup.slots.cross.length===8,'eight German cross slots retained');
check(map.cells.find(c=>c.id==='0609').city.name==='Baranovichi','Baranovichi label remains at 0609');
check(svg.includes('data-deployment-hex="0209"')&&svg.includes('data-deployment-hex="0211"'),'both rendered in common map');
assert.throws(()=>T.svgMap(map,P.options('arduous',{deploymentMarkerOverrides:{'9999':{fromKind:'star',toKind:'fixedInfantry',faction:'german'}}})),/Unrecognized deployment override/);checks++;
assert.throws(()=>T.svgMap(map,P.options('arduous',{deploymentMarkerOverrides:{'0209':{fromKind:'cross',toKind:'fixedInfantry',faction:'german'}}})),/Invalid deployment marker override/);checks++;
for(const id of ['leningrad','battle-for-moscow','kiev','kiev-odessa']){
 check(P.options(id).deploymentMarkerOverrides===undefined,id+' unaffected by Arduous presentation override');
}
const exported=fs.readFileSync(require('node:path').join(__dirname,'../exports/arduous.svg'),'utf8');
check(exported.includes('data-deployment-hex="0209" data-deployment-kind="fixedInfantry"'),'export uses override at 0209');
check(exported.includes('data-deployment-hex="0211" data-deployment-kind="fixedInfantry"'),'export uses override at 0211');
console.log('PASS Arduous presentation-only German Infantry corrections',checks,'checks');
