'use strict';
const assert=require('node:assert/strict');
const Tooltip=require('../core/terrain_tooltips');
const Binding=require('../core/movement_binding');
const Terrain=require('../core/terrain_tiles');
const Combat=require('../maps/combat-configs/arduous.json');
const Profile=require('../maps/movement-configs/arduous.json');
const Battle=require('../games/battle-for-moscow/rules.json');
let n=0;const test=(condition,msg)=>{assert(condition,msg);n++};
test(Tooltip.FIRST_HOVER_MS>=300&&Tooltip.FIRST_HOVER_MS<=600,'first hover delayed');
test(Tooltip.NEXT_HEX_MS>0&&Tooltip.NEXT_HEX_MS<Tooltip.FIRST_HOVER_MS,'next hex short dwell');
const cell={id:'0709',terrain:'forest',tileMarkers:[{kind:'city',label:'Minsk'}],tileEdges:{NW:[{kind:'river'},{kind:'rail'}],S:[{kind:'rail'}]}};
const d=Tooltip.describe(cell,{movement:Profile,combat:Combat});
test(d.startsWith('0709 · City · Minsk'),'hex and city');
test(d.includes('Movement: 2 MP to enter'),'city marker does not override registered forest entry cost');
test(d.includes('Rail sides: S, NW'),'ordered explicit rail sides');
test(d.includes('River sides: NW'),'river source side');
test(d.includes('if every attacker crosses'),'conditional river');
test(d.includes('Combat: -1 attacker odds column'),'city marker does not mask registered forest combat modifier');
test(!d.includes('Major River'),'ordinary river does not imply major');
const mark={id:'0205',terrain:'forest',tileMarkers:[{kind:'fortification'}]};
const f=Tooltip.describe(mark,{movement:Profile,combat:Combat});
test(f.includes('Combat: -1 attacker odds column'),'historical negative shift unchanged');
test(f.includes('Fortification: -1 attacker odds column (Soviet defender only)'),'fort effect conditional');
const b4m=Tooltip.describe(mark,{movement:Battle.movement||{},combat:Battle.combat||{}});
test(b4m.includes('Combat: -1 attacker odds column'),'legacy positive defensive shift displayed as negative attacker shift');
const major=Tooltip.describe({id:'0501',terrain:'open',tileEdges:{NE:[{kind:'majorRiver'},{kind:'rail'}]}},{movement:{majorRiverExtraCost:1,terrainCosts:{open:1},railCost:1},combat:{modifiers:{terrainColumnShifts:{},majorRiverAttackMultiplier:0.5}}});
test(major.includes('Major River sides: NE'),'major river separately labelled');
test(major.includes('each crossing attacker ×½, rounded down individually'),'per unit rounding supported');
const unspecified=Tooltip.describe({id:'0908',terrain:'open',tileEdges:{NE:[{kind:'majorRiver'}]}},{movement:{terrainCosts:{open:1}},combat:{modifiers:{terrainColumnShifts:{}}}});
test(!unspecified.includes('+1 MP')&&!unspecified.includes('×½'),'no unsupported fallback rules');
const unknown=Tooltip.describe({id:'0912',terrain:'sea',terrainStatus:'source-resampled-provisional'},{movement:Profile,combat:Combat});
test(unknown.includes('No base land-entry cost specified'),'no impassability invented');
test(unknown.includes('Source status: provisional'),'source warning');
for(const id of ['arduous','leningrad']){
 const map=require('../maps/'+id+'.json');
 const profile=require('../maps/movement-configs/'+id+'.json');
 const board=Binding.build(map,profile).board;
 const source=Tooltip.certifiedSides(map,board,Terrain.neighbor);
 const count=kind=>Object.values(source).reduce((sum,v)=>sum+v[kind].length,0)/2;
 const graphCount=kind=>board.edges.filter(e=>e[kind]).length;
 test(count('rail')===graphCount('rail'),id+' certified rails count');
 test(count('river')===graphCount('river'),id+' certified rivers count');
 test(count('majorRiver')===0,id+' no fabricated major rivers');
 for(const e of board.edges.filter(e=>e.rail||e.river)){
  const a=map.cells.find(c=>c.id===e.a),b=map.cells.find(c=>c.id===e.b);
  const side=Terrain.DIRS.find(dir=>Terrain.neighbor(a,dir,map.geometry)===b.id);
  const reverse=Terrain.OPP[side];
  for(const kind of ['rail','river'])if(e[kind]){
   test(source[a.id][kind].includes(side),id+' directed edge '+e.a);
   test(source[b.id][kind].includes(reverse),id+' reciprocal edge '+e.b);
  }
 }
 const target=map.cells.find(c=>source[c.id].river.length);
 const info=Tooltip.describe(target,{movement:profile,combat:require('../maps/combat-configs/'+id+'.json'),sourceSides:source});
 test(info.includes('River sides: '+source[target.id].river.join(', ')),id+' source graph visible in tooltip');
}
const am=require('../maps/arduous.json'),ap=Binding.build(am,Profile).board;
const revised=am.cells.map(x=>({...x}));revised[0].id='INVALID';
assert.throws(()=>Tooltip.certifiedSides({...am,cells:revised},ap,Terrain.neighbor),/unknown hex|geometry/);n++;
console.log('PASS source-certified tooltip policies/hexside reciprocity:',n,'assertions');
