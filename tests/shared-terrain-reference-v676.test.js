'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('../core/game_reference_dialog.js');
const R=globalThis.WargameReferenceDialog;
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
let checks=0;function ok(v,msg){assert.ok(v,msg);checks++;}
for(const route of ['arduous/native-preview','leningrad/native-preview','kiev/setup-preview','kiev-odessa/experimental-preview']){
 const dir='games/'+route;const c=read(dir+'/config.json');const resolve=p=>path.join(dir,p);
 const movement=read(resolve(c.profile)),combat=read(resolve(c.combatPolicy)),before=JSON.stringify({movement,combat});
 const rows=R.terrainRows({movement,combat});const find=id=>rows.find(x=>x.id===id);
 for(const [key,cost] of Object.entries(movement.terrainCosts))ok(find(key).move===`${cost} MP (base)`,route+' '+key);
 ok(find('forest').effect.startsWith('-1 attacker column'),route+' forest');
 ok(find('river').effect.includes('if all attackers cross'),route+' river');
 ok(find('swamp').effect.includes('×0.5'),route+' swamp strength');
 ok(find('railroad').move.includes('1 MP'),route+' rail');
 if(c.scenarioId==='arduous')ok(find('fortification').effect.includes('Soviet defender only'),'Brest fort');
 if(movement.majorRiverExtraCost){ok(find('major-river').move.includes('+1 MP'),'major river cost');ok(find('major-river').effect.includes('×0.5'),'major river combat');}
 ok(JSON.stringify({movement,combat})===before,'input isolation');
}
const rules=read('games/battle-for-moscow/rules.json'),over=read('games/battle-for-moscow/native-preview/config.json').overrides.rules;
const rows=R.terrainRows({movement:over.movement,combat:{...rules.combat,...over.combat},weather:over.weather}),find=id=>rows.find(x=>x.id===id);
ok(find('forest').effect==='-1 attacker column','native shift sign');ok(find('fortification').effect.includes('Soviet defender only'),'native fortification');ok(find('city-moscow').effect==='-1 attacker column','Moscow shift');ok(find('weather-mud').effect.includes('tank ×0.5'),'mud strength');ok(find('weather-mud').move.includes('rail unaffected'),'mud rail');
console.log(JSON.stringify({checks}));

const T=require('../core/terrain_tiles'),P=require('../core/presentation');
const source=read('maps/battle-for-moscow.json').cells.find(c=>c.id==='0501');
assert.equal(source.terrain,'open');assert.ok(source.tileMarkers.some(m=>m.kind==='fortification'));
const specimen=T.svgMap({id:'tec-specimen-fortification',geometry:{columnParityDown:'even'},cells:[{id:'0501',column:1,row:1,pixelCenter:[70,65],terrain:source.terrain,tileMarkers:source.tileMarkers.filter(m=>m.kind==='fortification'),tileEdges:{}}]},P.options('battle-for-moscow',{textures:{},fortificationArtwork:'../../../supplied_assets/flat/fortification-overlay.svg',showGrid:true,showNumbers:false,showWaterBodies:false,showEntryEdges:false,width:140,height:130,rx:37.8,ry:37.8}));
assert.ok(specimen.includes('data-fortification-cell="0501"')&&specimen.includes('class="fortification-asset"'));
