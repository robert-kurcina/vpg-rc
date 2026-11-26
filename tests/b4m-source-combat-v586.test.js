'use strict';
// Printed §§9.0–9.2 and 12.2; bounded fixtures on the shipped map.
const assert=require('node:assert/strict');
const {load}=require('../tools/audit-b4m-native-preview-v360');
const E=require('../core/engine'),P=require('../core/native_preview_config');
const {original,config}=load(),g=E.build(P.project(original,config));
let s,d,a,b;
function fixture(x,y,dirs,turn=2,side='german',ids=['g23','g35'],def='s3'){
 s=E.start(g,17,'auto-reference');s.units.forEach(u=>delete u.position);Object.assign(s,{side,phaseIndex:2,turn});
 d=s.units.find(u=>u.id===def);a=s.units.find(u=>u.id===ids[0]);b=s.units.find(u=>u.id===ids[1]);d.position={x,y};
 const ns=E.neighbors(x,y);for(const [u,dir] of [[a,dirs[0]],[b,dirs[1]]]){if(dir){const n=ns.find(h=>h.dir===dir);u.position={x:n.x,y:n.y};assert.ok(g.cells.has(`${n.x},${n.y}`));}}
}
const odds=(ids=[a.id,b.id])=>E.combatOdds(g,s,ids,d.id);
fixture(10,2,['S','SW'],2,'german',['g23','g35'],'s1sh');d.strength='reduced';
assert.equal(odds().attackerStrength,16);assert.equal(odds().defenderStrength,5);assert.equal(odds().raw,3);assert.equal(odds().odds,1);
assert.deepEqual(odds().shifts,[{type:'city',value:1},{type:'river',value:1}]);
fixture(10,2,['S','N']);assert.equal(odds().odds,3);assert.deepEqual(odds().shifts,[{type:'city',value:1}]);
fixture(10,6,['N','S']);assert.equal(odds().odds,2);assert.deepEqual(odds().shifts,[{type:'terrain',value:1},{type:'city',value:1}]);
fixture(3,5,['S','SE']);assert.equal(odds().odds,3);assert.deepEqual(odds().shifts,[{type:'terrain',value:1}]);
fixture(4,2,['N','NW'],2,'soviet',['s3','s5'],'g34');a.strength=b.strength='full';assert.equal(odds().odds,4);assert.deepEqual(odds().shifts,[]);
fixture(5,5,['S','SE'],2,'german',['g24','g41']);const extra=s.units.find(u=>u.id==='g57');extra.position={x:5,y:4};assert.equal(odds([a.id,b.id,extra.id]).attackerStrength,36);assert.equal(odds([a.id,b.id,extra.id]).raw,6);
fixture(10,6,['N'],2,'german',['g34','g42']);d.strength='full';assert.equal(odds([a.id]).odds,0);
fixture(5,5,['S','SE'],3,'german',['g47','g23']);assert.equal(odds().attackerFactors[a.id],4.5);assert.equal(odds().attackerFactors[b.id],8);assert.equal(odds().attackerStrength,12.5);
fixture(5,5,['S','SE'],3,'soviet',['s3','s5'],'g47');assert.equal(odds().defenderStrength,9);
fixture(5,5,['S','SE']);const ids=[a.id,b.id];assert.equal(E.combatOdds(g,s,[a.id],a.id),null);a.position={x:0,y:0};assert.equal(odds(ids),null);
console.log('PASS B4M source combat odds, terrain and mud');
fixture(5,5,['S','SE']);const second=s.units.find(u=>u.id==='s5');second.position={x:5,y:7};const third=s.units.find(u=>u.id==='g24');third.position={x:4,y:7};
const seed=s.seed;
assert.equal(E.previewNextDeclaration(g,s,1),null);
assert.equal(E.declareCombat(g,s,[a.id],d.id),true);
assert.equal(E.declareCombat(g,s,[b.id],d.id),false);
assert.ok(E.combatOdds(g,s,[a.id],second.id).odds>=1);assert.equal(E.declareCombat(g,s,[a.id],second.id),false);
assert.equal(E.declareCombat(g,s,[third.id],second.id),true);
assert.equal(s.seed,seed);
assert.equal(E.endPhase(g,s),false);
assert.equal(E.lockDeclarations(g,s),true);
assert.equal(E.clearDeclarations(g,s),false);
assert.equal(E.declareCombat(g,s,[b.id],d.id),false);
const p=E.previewNextDeclaration(g,s,5);assert.equal(p.outcome,'NE');assert.equal(p.roll,5);
assert.equal(E.previewNextDeclaration(g,s,6),null);
const before=JSON.stringify(s.units);const r=E.resolveDeclared(g,s,5,{advanceId:'none'});assert.equal(r.result,'NE');assert.equal(JSON.stringify(s.units),before);
assert.equal(s.declarations[0].defender,second.id);
assert.equal(E.previewNextDeclaration(g,s,6).outcome,'DRL');
assert.ok(E.resolveDeclared(g,s,6,{advanceId:'none'}));
assert.equal(second.strength,'dead');assert.equal(s.declarations.length,0);
assert.equal(E.endPhase(g,s),true);
fixture(5,5,['S','SE']);assert.equal(E.endPhase(g,s),true); // attacks voluntary
console.log('PASS B4M source combat commitments and resolution');

// Find an eligible major-city DR using the existing roster and CRT, without a fabricated combat table.
let holdFixture=null;
for(const cell of g.cells.values()){
 if(!['major','moscow'].includes(cell.city))continue;
 const dirs=E.neighbors(cell.x,cell.y).filter(n=>g.playable(n.x,n.y)).map(n=>n.dir);
 if(dirs.length<2)continue;
 fixture(cell.x,cell.y,dirs.slice(0,2),2,'german',['g24','g41'],'s3');
 d.strength='full';
 const ids=[a.id,b.id];
 for(let die=1;die<=6;die++){
  const p=E.combatPreview(g,s,ids,d.id,die);
  if(p?.cityHoldOptions?.includes(d.id)&&p.retreat.length){holdFixture={state:JSON.parse(JSON.stringify(s)),ids,def:d.id,die,route:p.retreat[0]};break;}
 }
 if(holdFixture)break;
}
assert.ok(holdFixture,'eligible city defense must allow both choices');
const hf=holdFixture;
function resolveHoldChoice(options){
 const state=JSON.parse(JSON.stringify(hf.state));
 assert.ok(E.declareCombat(g,state,hf.ids,hf.def));assert.ok(E.lockDeclarations(g,state));
 assert.equal(E.previewNextDeclaration(g,state,hf.die).outcome,'DR');
 const before=JSON.stringify(state);
 const result=E.resolveDeclared(g,state,hf.die,options);
 return {state,result,before,defender:state.units.find(u=>u.id===hf.def)};
}
const held=resolveHoldChoice({standFastId:hf.def,advanceId:'none'});
assert.ok(held.result?.cityHold);assert.equal(held.defender.strength,'reduced');
assert.deepEqual(held.defender.position,hf.state.units.find(u=>u.id===hf.def).position);
const withdrew=resolveHoldChoice({standFastId:'none',retreatTo:{x:hf.route.x,y:hf.route.y},advanceId:'none'});
assert.ok(withdrew.result);assert.equal(withdrew.result.cityHold,false);
assert.deepEqual(withdrew.defender.position,{x:hf.route.x,y:hf.route.y});
const invalid=resolveHoldChoice({standFastId:hf.def,retreatTo:{x:hf.route.x,y:hf.route.y}});
assert.equal(invalid.result,null);assert.equal(JSON.stringify(invalid.state),invalid.before);
console.log('PASS optional single-defender Stand Fast');
