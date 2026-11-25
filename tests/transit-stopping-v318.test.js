'use strict';
const assert=require('node:assert/strict');
const M=require('../core/movement_rules');
const LP=require('../core/legal_pathfinding');
const config=require('../maps/movement-configs/leningrad.json');
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const yes=x=>{assert.ok(x);checks++};
function fixture(allow){
 const profile={...structuredClone(config),maxStack:1};
 if(allow!==undefined)profile.allowFriendlyOverstackTransit=allow;
 else delete profile.allowFriendlyOverstackTransit;
 const units={g:{id:'g',owner:'german',hex:'A',mp:4,class:'infantry',size:'corps',nationality:'german'},
   friendly:{id:'friendly',owner:'german',hex:'B',mp:3,class:'infantry',size:'corps',nationality:'german'}};
 const cells=Object.fromEntries(['A','B','C','D','E'].map(k=>[k,{verified:true,terrain:'open',rail:false}]));
 const edges=[['A','B'],['B','C'],['C','D'],['C','E']].map(([a,b])=>({a,b,verified:true}));
 return {profile,units,board:{cells,edges},phase:{kind:'movement',owner:'german'},turn:2};
}
for(const permit of [undefined,false]){
 const c=fixture(permit);
 eq(M.move(c,{unitId:'g',path:['A','B']}).reason,'stack-limit');
 eq(M.transit(c,{unitId:'g',path:['A','B']}).reason,'transit-not-authorized');
 eq(LP.search(c,{unitId:'g'}).pathTo('C'),null);
}
const c=fixture(true);
eq(M.move(c,{unitId:'g',path:['A','B']}).reason,'stack-limit');
const crossing=M.transit(c,{unitId:'g',path:['A','B']});yes(crossing.ok);eq(crossing.transitOnly,true);
eq(LP.search(c,{unitId:'g'}).pathTo('B'),null);
eq(LP.search(c,{unitId:'g'}).pathTo('C'),['A','B','C']);
for(const r of LP.search(c,{unitId:'g'}).reachable())yes(M.move(c,{unitId:'g',path:r.path}).ok);
// An enemy unit at D exerts ZOC on C: C may be a stop, not a transit hex.
const z=structuredClone(c);z.units.enemy={id:'enemy',owner:'soviet',hex:'D',mp:4,class:'infantry'};
eq(M.transit(z,{unitId:'g',path:['A','B','C']}).reason,'ezoc-stops-movement');
eq(LP.search(z,{unitId:'g'}).pathTo('E'),null);
yes(LP.search(z,{unitId:'g'}).pathTo('C'));
// Enemy-occupied, impassable and budget paths must not be tunneled through.
const occupied=structuredClone(c);occupied.units.enemy={id:'enemy',owner:'soviet',hex:'B',mp:4,class:'infantry'};
eq(LP.search(occupied,{unitId:'g'}).pathTo('C'),null);
const sea=structuredClone(c);sea.board.edges[0].allSea=true;
eq(LP.search(sea,{unitId:'g'}).pathTo('C'),null);
const short=structuredClone(c);short.units.g.mp=1;
eq(LP.search(short,{unitId:'g'}).pathTo('C'),null);
// Invalid opt-in profile must fail validation.
const invalid=structuredClone(config);invalid.allowFriendlyOverstackTransit='yes';eq(M.validProfile(invalid),false);
// Existing legal route remains legal, no invented stopping permissions.
const before=JSON.stringify(c);LP.search(c,{unitId:'g'});eq(JSON.stringify(c),before);
// Kiev §8.1: direct multi-hex requests and path discovery agree, in both directions.
for(const configName of ['kiev','kiev-odessa-experimental-v531']){
 const exclusions=require('../maps/movement-configs/'+configName+'.json').nationalStackExclusions;
 for(const [moving,resident] of [['romanian','hungarian'],['hungarian','romanian']]){
  for(const allow of [false,true]){
   const n=fixture(allow);n.profile.maxStack=2;n.profile.nationalStackExclusions=exclusions;
   n.units.g.nationality=moving;n.units.friendly.nationality=resident;
   const before=JSON.stringify(n);
   for(const path of [['A','B'],['A','B','C']]){
    eq(M.move(n,{unitId:'g',path}).reason,'national-stack-exclusion');
    eq(M.transit(n,{unitId:'g',path}).reason,'national-stack-exclusion');
   }
   eq(LP.search(n,{unitId:'g'}).pathTo('C'),null);
   eq(JSON.stringify(n),before);
   n.units.friendly.nationality='italian';
   yes(M.move(n,{unitId:'g',path:['A','B','C']}).ok);
   eq(LP.search(n,{unitId:'g'}).pathTo('C'),['A','B','C']);
   n.units.friendly.nationality=resident;n.units.friendly.marker=true;
   yes(M.move(n,{unitId:'g',path:['A','B','C']}).ok);
  }
 }
}
console.log('PASS transit-vs-stopping',checks,'assertions');
