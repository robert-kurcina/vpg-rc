'use strict';
// Printed Kiev §§10.0,10.8,10.9. Actual map, source faces, synthetic battle positions.
const A=require('node:assert/strict'), F=require('./fixtures/kiev-source-opening-v437');
const map=F.map, profile=require('../maps/movement-configs/kiev.json'), config=require('../maps/phase-configs/kiev.json'), combatPolicy=require('../maps/combat-configs/kiev.json'), counterConfig=F.counterConfig;
const D=require('../core/historical_combat_declarations').create({map,profile,config,combatPolicy});
const P=require('../core/historical_combat_phase');
const state=require('../core/historical_source_initial_state').build({map,setupSpec:F.setupSpec,counterConfig,inventory:F.inventory,allocation:F.allocation,placements:F.placements}).state;
let n=0;const eq=(a,b,m)=>{A.deepEqual(a,b,m);n++};const ok=(x,m)=>{A.ok(x,m);n++};const bad=(f,r)=>{A.throws(f,r);n++};
const pick=(hex,owner)=>Object.values(state.units).find(u=>u.hex===hex&&u.owner===owner);
const cursor=(turn,actor)=>({scenarioId:'kiev',turn,index:actor==='soviet'?6:2,complete:false});
for(const [a,b] of [['0708','0709'],['0808','0809'],['1110','1010']]){
 const s=pick(a,'soviet'),g=pick(b,'german');ok(s&&g);
 const dec=(turn,actor,st,att,target)=>D.declare({cursor:cursor(turn,actor),actor,state:st},[{defenderHex:target,attackers:[att]}]);
 eq(dec(1,'soviet',state,s.id,b).battles.length,1);
 bad(()=>dec(1,'german',state,g.id,a),/source-designated setup unit cannot attack/);
 eq(dec(2,'german',state,g.id,a).battles.length,1);
 const moved=structuredClone(state);moved.units[s.id].openingHex='0502';
 bad(()=>dec(1,'soviet',moved,s.id,b),/eligible original setup hex/);
 eq(dec(2,'soviet',moved,s.id,b).battles.length,1);
}
const board=require('../core/movement_binding').build(map,profile).board;
const edge=board.edges.find(e=>!e.river&&!e.majorRiver&&!e.impassable&&board.cells[e.b].terrain==='open'&&!map.cells.find(c=>c.id===e.b).city&&!combatPolicy.firstTurnTerritorialRestriction.targetHexes.includes(e.b));
const mech=Object.values(state.units).find(u=>u.owner==='soviet'&&u.class==='mechanized');
const g=Object.values(state.units).find(u=>u.owner==='german'&&u.printedCombatStrength===6);
const face=counterConfig.faces.back.find(f=>f.faceId===mech.reverseFaceId).visualTranscription.printedValues;
const [attack,defense]=face.split(/[·.\-]/).map(Number);ok(attack>0&&defense>0);ok(edge&&g);
const isolated={...structuredClone(state),units:{[mech.id]:{...mech,hex:edge.a},[g.id]:{...g,hex:edge.b}}};
for(const turn of [1,2,3,7]){
 const ctx={map,profile,config,cursor:cursor(turn,'soviet'),actor:'soviet',state:isolated,counterConfig,combatPolicy,enableAirSupport:true};
 const phase=P.create(ctx);eq(phase.commit([]).snapshot().declaration.battles.length,0,'attacking voluntary');
 const selected=phase.commit([{defenderHex:edge.b,attackers:[mech.id]}]).select(edge.b);
 const calc=selected.evaluateSelectedFromMap({strengths:{[mech.id]:{kind:'mechanized',value:attack},[g.id]:{kind:'infantry',value:6}}});
 eq(calc.attackStrength,attack*({1:2,2:1.5}[turn]||1));eq(calc.defenseStrength,6);
}
console.log('PASS Kiev actual-map first-turn restrictions and counterattack',n,'assertions');
