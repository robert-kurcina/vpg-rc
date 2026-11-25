/* Kiev §7.0 six-neighbor ZOC: movement Coast barrier != ZOC barrier.
 * Exercises the shared executable movement adjudicator against the actual
 * source-traced composite edges. Composite edge data remain PLAYTEST CANDIDATES:
 * these checks do not register Odessa gameplay or certify the map.
 */
'use strict';
const assert=require('node:assert/strict');
const Rules=require('../core/movement_rules');
const Compose=require('../maps/composer');
const Land=require('../core/composite_land_movement_candidate');
const original=require('../maps/kiev.json');
const extension=require('../maps/odessa-extension.json');
const rail=require('../maps/movement-configs/odessa-source-route-rail-ledger-v496.json');
const cities=require('../maps/victory-configs/odessa-source-city-ledger-v497.json');
const profile=require('../maps/movement-configs/kiev-odessa-territory-candidate-v504.json');
const kievProfile=require('../maps/movement-configs/kiev.json');
const arduousProfile=require('../maps/movement-configs/arduous.json');
const map=Compose.compose(original,extension);
const board=Land.build(original,extension,map,rail,cities).board;
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const ok=(v,msg)=>{assert.ok(v,msg);checks++};
const copied=o=>JSON.parse(JSON.stringify(o));
const u=(id,owner,hex)=>({id,owner,nationality:owner,class:'infantry',size:'corps',hex,mp:12});
const ctx=(p,units)=>({profile:p,board,phase:{owner:'german',kind:'movement'},turn:2,units});
eq(profile.zocAcrossImpassableHexsides,true,'Odessa §7 opt-in');
eq(kievProfile.zocAcrossImpassableHexsides,true,'Kiev §7 opt-in');
eq(arduousProfile.zocAcrossImpassableHexsides,undefined,'unrelated scenario remains unchanged');
eq(board.metadata.noRulesAuthorization,true,'source board is still an unapproved candidate');
const shores=board.edges.filter(e=>e.lake&&!e.allSea);
ok(shores.length>0,'source board contains a land/land Coast barrier');
for(const shore of shores){
 eq(shore.impassable,true,'Coast is impassable to ground movement');
 for(const [from,to] of [[shore.a,shore.b],[shore.b,shore.a]]){
  const units={enemy:u('enemy','soviet',from)};
  const live=ctx(profile,units),prior=ctx({...profile,zocAcrossImpassableHexsides:false},units);
  eq(Rules.enemyZOC(live,to,'german'),true,'ZOC crosses the source Coast barrier '+from+' -> '+to);
  eq(Rules.enemyZOC(prior,to,'german'),false,'old policy does not silently change');
  eq(Rules.enemyZOC(live,to,'soviet'),false,'friendly unit creates no EZOC');
  const markerCtx=ctx(profile,{enemy:{...units.enemy,marker:true}});
  eq(Rules.enemyZOC(markerCtx,to,'german'),false,'support marker cannot project ground ZOC');
  const deadCtx=ctx(profile,{enemy:{...units.enemy,strengthStatus:'eliminated'}});
  eq(Rules.enemyZOC(deadCtx,to,'german'),false,'eliminated counter cannot project ZOC');
  const noMove=Rules.move(ctx(profile,{enemy:units.enemy,mover:u('mover','german',to)}),
   {unitId:'mover',path:[to,from]});
  eq(noMove.reason,'impassable-hexside','ZOC cannot make Coast traversable');
 }
}
// Demonstrate a previously incorrectly accepted TWO-STEP move using exact
// 261-hex board coordinates, rather than a synthetic hex topology.
const units={mover:u('mover','german','1215'),enemy:u('enemy','soviet','1414')};
const request={unitId:'mover',path:['1215','1315','1214']};
const live=ctx(profile,units);
eq(Rules.enemyZOC(live,'1315','german'),true,'source-defined Coast EZOC at 1315');
eq(Rules.move(live,{unitId:'mover',path:['1215','1315']}).ok,true,'can stop upon entering EZOC');
eq(Rules.move(live,request).reason,'ezoc-stops-movement','cannot pass through Coast-projected EZOC');
eq(Rules.move(ctx({...profile,zocAcrossImpassableHexsides:false},units),request).ok,true,
 'regression demonstrably fails under the previous interpretation');
// The full-scope scenario profile is not a universal switch. Unrelated
// profiles must retain traversable-only ZOC logic on the same test data.
eq(Rules.enemyZOC(ctx(arduousProfile,units),'1315','german'),false,
 'no unreviewed rule change to Arduous');
const invalid=copied(profile);invalid.zocAcrossImpassableHexsides='yes';
eq(Rules.validProfile(invalid),false,'invalid ZOC policy is rejected');
eq(Rules.validProfile(profile),true,'source configured Kiev–Odessa profile valid');
console.log('PASS v530 Kiev/Odessa Coast-ZOC executable rules:',checks,'assertions;',shores.length,'source Coast edges');
