'use strict';
/* Shared renderer: four rule-defined setup hexes highlighted, without touching rules. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const T=require('../core/terrain_tiles');
const P=require('../core/presentation');
const reg=require('../maps/registry.json').maps;
const combat=require('../maps/combat-configs/kiev.json');
let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++};
const yes=(x,m)=>{assert.ok(x,m);checks++};
const bad=(f,m)=>{assert.throws(f,m);checks++};
const expected=['0709','0809','0910','1010'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceMapBefore={kiev:sha('maps/kiev.json'),odessa:sha('maps/odessa-extension.json'),rules:sha('references/rules/kiev-rules.pdf'),crt:sha('rules_profiles/shared-crt.json')};
eq(combat.firstTurnTerritorialRestriction.targetHexes,expected,'visual outline anchored to approved Turn 1 target convention');
eq(combat.firstTurnCombatRestriction.setupHexes,expected,'corresponding Axis setup restriction unchanged');
for(const id of ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']){
 const item=reg.find(x=>x.id===id);
 const map=id==='kiev-odessa'?require('../maps/composer').compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json')):require('../maps/'+id+'.json');
 const opts=P.options(id,{textures:{}});
 const svg=T.svgMap(map,opts);
 const exported=fs.readFileSync('exports/'+id+'.svg','utf8');
 // Later Kiev–Odessa revisions added Bessarabia polygons to the same shared layer.
 // Keep this original Romania test scoped to its own four source-selected cells.
 const tags=[...svg.matchAll(/<polygon class="setup-region-outline" data-region="romanian-turn1-setup"[^>]*\/>/g)].map(x=>x[0]);
 const expTags=[...exported.matchAll(/<polygon class="setup-region-outline" data-region="romanian-turn1-setup"[^>]*\/>/g)].map(x=>x[0]);
 const shouldShow=id==='kiev'||id==='kiev-odessa';
 eq(tags.length,shouldShow?4:0,id+' expected number of per-hex annotations');
 eq(expTags.length,shouldShow?4:0,id+' export corresponds to live engine overlay');
 if(shouldShow){
  eq(opts.hexRegionOutlines.length,id==='kiev-odessa'?2:1,'region groups include expansion only on combined map');
  eq(opts.hexRegionOutlines[0].hexes,expected,'same four hexes in presentation');
  eq(tags.map(t=>t.match(/data-region-hex="([^"]+)"/)[1]),expected,id+' unique hexes');
  for(const tag of tags){
   yes(tag.includes('stroke="#ed8d30"'),id+' original v444 orange');
   yes(tag.includes('stroke-width="4.50"'),id+' v444 width');
   yes(tag.includes('stroke-dasharray="10 4"'),id+' v444 dash');
   yes(tag.includes('fill="none"'),id+' transparent hex interior');
  }
  yes(svg.indexOf('data-layer="setup-region-outlines"')<svg.indexOf('data-layer="roads"'),id+' orange below roads');
  yes(svg.indexOf('data-layer="setup-region-outlines"')<svg.indexOf('data-layer="railways"'),id+' orange below railways');
  yes(svg.indexOf('data-layer="setup-region-outlines"')<svg.indexOf('data-layer="hex-grid"'),id+' orange below grid');
  yes(svg.indexOf('data-layer="setup-region-outlines"')<svg.indexOf('data-layer="coordinates"'),id+' below labels');
  yes(svg.indexOf('data-layer="setup-region-outlines"')<svg.indexOf('data-layer="deployment"'),id+' below units');
  eq((exported.match(/data-region="romanian-turn1-setup"/g)||[]).length,4,id+' annotation ID');
  yes(!tags.join('').includes('data-city-hex'),id+' no city-border substitution');
 }
}
const b=require('../maps/kiev.json');
for(const invalid of [
 {id:'bad!',hexes:expected},
 {id:'test',hexes:['0709','0709']},
 {id:'test',hexes:['9999']},
 {id:'test',hexes:expected,inset:0},
 {id:'test',hexes:expected,dash:'3" onclick="evil'},
 ]) bad(()=>T.svgMap(b,P.options('kiev',{textures:{},hexRegionOutlines:[invalid]})),'malformed overlay must reject');
for(const [id,p] of Object.entries({kiev:'maps/kiev.json',odessa:'maps/odessa-extension.json',rules:'references/rules/kiev-rules.pdf',crt:'rules_profiles/shared-crt.json'}))eq(sha(p),sourceMapBefore[id],id+' source unchanged');
console.log('PASS Kiev Romanian setup outlines',checks,'assertions');
