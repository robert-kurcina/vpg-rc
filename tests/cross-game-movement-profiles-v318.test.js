'use strict';
const assert=require('node:assert/strict');
const M=require('../core/movement_rules.js');
const profiles=['arduous','leningrad','kiev'].map(x=>require('../maps/movement-configs/'+x+'.json'));
let tests=0;
function fixture(profile){
 const cells={A:{terrain:'open',verified:true,rail:true},B:{terrain:'forest',verified:true,rail:true},C:{terrain:'open',verified:true,rail:true},D:{terrain:'open',verified:true,rail:true}};
 const edges=[{a:'A',b:'B',verified:true,rail:true},{a:'B',b:'C',verified:true,rail:true,majorRiver:true},{a:'C',b:'D',verified:true,rail:false}];
 const units={g:{id:'g',owner:'german',nationality:'german',class:'infantry',size:'corps',hex:'A',mp:4},s:{id:'s',owner:'soviet',nationality:'soviet',class:'infantry',size:'army',hex:'X',mp:4}};
 return {profile:M.validatedProfile(profile),board:{cells,edges},phase:{owner:'german',kind:'movement'},turn:2,units};
}
function outcome(c,path,ok,reason){const r=M.move(c,{unitId:'g',path});assert.equal(r.ok,ok,r.reason);if(reason)assert.equal(r.reason,reason);tests++;return r;}
for(const p of profiles){
 const c=fixture(p);assert.equal(outcome(c,['A','B','C'],true).cost,2);
 c.phase.kind='special-movement';c.turn=1;
 if(p.id==='arduous')assert.equal(outcome(c,['A','B','C'],true).cost,2);
 else outcome(c,['A','B','C','D'],false,'insufficient-movement-points');
 c.units.g.class='panzer';assert.equal(outcome(c,['A','B'],true).cost,1);
 c.units.g.class='infantry';c.turn=2;c.phase.kind='movement';
 c.board.edges[0].allSea=true;outcome(c,['A','B'],false,'impassable-hexside');c.board.edges[0].allSea=false;
 c.board.edges[0].lake=true;outcome(c,['A','B'],false,'impassable-hexside');c.board.edges[0].lake=false;
 c.units.s.hex='B';assert.equal(M.enemyZOC(c,'A','german'),true);tests++;
 // Kiev §7.0 projects ZOC through a land/land Coast barrier; the source
 // profile opt-in intentionally differs from older Arduous/Leningrad behavior.
 c.board.edges[0].lake=true;assert.equal(M.enemyZOC(c,'A','german'),p.id==='kiev');tests++;
}
const kRiver=fixture(profiles[2]);kRiver.board.edges[1].rail=false;assert.equal(outcome(kRiver,['A','B','C'],true).cost,3);
const lRiver=fixture(profiles[1]);lRiver.board.edges[1].rail=false;assert.equal(outcome(lRiver,['A','B','C'],true).cost,2);
const k=fixture(profiles[2]);
k.units.g.nationality='romanian';k.units.h={id:'h',owner:'german',nationality:'hungarian',class:'infantry',size:'corps',mp:4,hex:'B'};
outcome(k,['A','B'],false,'national-stack-exclusion');
const l=fixture(profiles[1]);l.units.g.nationality='romanian';l.units.h={id:'h',owner:'german',nationality:'hungarian',class:'infantry',size:'corps',mp:4,hex:'B'};
outcome(l,['A','B'],true);
k.units.g.class='motorized';k.units.g.nationality='italian';k.phase.kind='special-movement';outcome(k,['A','B'],true);
l.units.g.class='motorized';l.phase.kind='special-movement';outcome(l,['A','B'],false,'special-ineligible');
const bad=structuredClone(profiles[2]);delete bad.nationalStackExclusions;assert.throws(()=>M.validatedProfile(bad));tests++;
const bad2=structuredClone(profiles[1]);bad2.majorRiverExtraCost=-1;assert.throws(()=>M.validatedProfile(bad2));tests++;
console.log('Cross-game movement profile tests:',tests,'passed');
