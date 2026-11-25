'use strict';
const assert=require('node:assert/strict');
const M=require('../core/movement_rules.js');
const P=require('../core/phase_runtime.js');
const A=require('../core/phase_actions.js');
const config=require('../maps/phase-configs/arduous.json');
const profile=require('../maps/movement-configs/arduous.json');
let n=0;function check(c,r,expected){const got=M.move(c,r);assert.equal(got.ok,expected,got.reason);n++;return got;}
function fixture(phase='german-movement',turn=2){
 const cells={A:{terrain:'open',verified:true,rail:true},B:{terrain:'forest',verified:true,rail:true},C:{terrain:'swamp',verified:true,rail:true},D:{terrain:'open',verified:true,rail:false},E:{terrain:'city',verified:true,rail:false},F:{terrain:'open',verified:true,rail:false}};
 const edges=[['A','B',true],['B','C',true],['C','D',false],['D','E',false],['E','F',false],['B','E',false]].map(([a,b,rail])=>({a,b,rail,verified:true}));
 return {profile:M.validatedProfile(profile),board:{cells,edges},phase:config.phases.find(p=>p.id===phase),turn,units:{g:{id:'g',owner:'german',class:'infantry',size:'corps',hex:'A',mp:4},s:{id:'s',owner:'soviet',class:'infantry',size:'army',hex:'F',mp:4}}};
}
const req=(unitId,path,mode)=>({unitId,path,mode});
let c=fixture();
c.board.edges[0].rail=false;c.board.edges[1].rail=false;
assert.equal(check(c,req('g',['A','B','C']),true).cost,4);
check(c,req('g',['A','B','C','D']),false); // insufficient MPs
assert.equal(check(c,req('g',['A','B','E']),true).cost,3);
c.board.edges[0].verified=false;check(c,req('g',['A','B']),false);c.board.edges[0].verified=true;
c.board.cells.B.verified=false;check(c,req('g',['A','B']),false);c.board.cells.B.verified=true;
c.units.s.hex='C';check(c,req('g',['A','B','C']),false); // enemy occupied
c.units.s.hex='D';check(c,req('g',['A','B','C']),true); // enter EZOC at C
check(c,req('g',['A','B','C','D']),false);
c.units.s.hex='F';
c.units.friend={id:'friend',owner:'german',class:'infantry',size:'corps',hex:'B',mp:3};
c.units.friend2={id:'friend2',owner:'german',class:'infantry',size:'corps',hex:'B',mp:3};check(c,req('g',['A','B']),false);delete c.units.friend2;
check(c,req('g',['A','B']),true);
c=fixture('german-special-movement');c.board.edges[0].rail=false;c.board.edges[1].rail=false;assert.equal(check(c,req('g',['A','B']),true).cost,2);check(c,req('g',['A','B','C']),false);
c.units.s.hex='B';check(c,req('g',['A','E']),false); // unverified connection
c=fixture('german-special-movement',1);assert.equal(check(c,req('g',['A','B','C']),true).cost,2); // surprise ignored terrain
c=fixture('soviet-special-movement');c.units.s.hex='C';c.units.g.hex='F';
assert.equal(check(c,req('s',['C','B','A'],'rail'),true).cost,2); // rail full allowance
check(c,req('s',['C','B','E'],'rail'),false); // B-E not rail
c.units.g.hex='B';check(c,req('s',['C','D']),false); // reserve starts in EZOC
c=fixture('soviet-special-movement');c.units.s.hex='C';c.units.g.hex='F';
assert.equal(check(c,req('s',['C','D']),true).cost,1); // reserve half allowance
c.units.s.class='mechanized';assert.equal(check(c,req('s',['C','D','E']),true).cost,2); // mech full allowance
c=fixture('soviet-movement');c.units.s.hex='C';c.units.g.hex='F';
c.units.s2={id:'s2',owner:'soviet',class:'infantry',size:'army',hex:'D',mp:4};check(c,req('s',['C','D']),false); // Army stacking
c.units.s2.size='corps';check(c,req('s',['C','D']),true);
// Actual shared dispatcher, using an explicit movement legality and application handler.
const cursor={scenarioId:'arduous',turn:2,index:1,complete:false};
c=fixture();const state={units:structuredClone(c.units)};
const binding={config,cursor,actor:'german',state,rules:{move:{legal(s,a){return M.move({...c,units:s.units},a).ok;},apply(s,a){s.units[a.unitId].hex=a.path.at(-1);return {ok:true,state:s,result:{to:a.path.at(-1)}};}}}};
assert.equal(A.legal(binding,'move',req('g',['A','B'])),true);
const result=A.execute(binding,'move',req('g',['A','B']));assert.equal(result.ok,true);assert.equal(result.state.units.g.hex,'B');assert.equal(state.units.g.hex,'A');n+=3;
assert.equal(A.execute(binding,'move',req('g',['A','B','C','E'])).ok,false);n++;
assert.throws(()=>A.execute({...binding,actor:'soviet'},'move',req('g',['A','B'])));n++;
c=fixture();c.profile.terrainCosts.forest=0;check(c,req('g',['A','B']),false);
c=fixture();c.board.edges[0].verified=false;check(c,req('g',['A','B']),false);
console.log(`Cross-game movement: ${n} assertions passed`);
