'use strict';
/* Controlled source-graph stress fixture for Leningrad §10.6. The crowded
 * placement is synthetic, NOT an independently verified historical setup. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Module=require('node:module');
const MovementBinding=require('../core/movement_binding');
const Retreat=require('../core/historical_forced_retreat');
const Bridge=require('../core/scenario_opening_bridge');
const Combat=require('../core/historical_combat_phase');
const Map=require('../maps/leningrad.json');
const Faces=require('../maps/counter-configs/leningrad.json');
const Setup=require('../maps/setup/leningrad.json');
const Movement=require('../maps/movement-configs/leningrad.json');
const Phases=require('../maps/phase-configs/leningrad.json');
const Policy=require('../maps/combat-configs/leningrad.json');
const Inventory=require('../core/leningrad_starting_inventory');
const selected=require('./fixtures/leningrad-source-setup-v357');
const copy=x=>JSON.parse(JSON.stringify(x));
let checks=0;
const eq=(x,y,why)=>{assert.deepStrictEqual(x,y,why);checks++;};
const yes=(x,why)=>{assert.ok(x,why);checks++;};
const bad=(fn,re)=>{assert.throws(fn,re);checks++;};
const opening=Bridge.create({map:Map,setupSpec:Setup,counterConfig:Faces,inventory:Inventory,
 allocation:selected.selected,placements:selected.placements,phaseConfig:Phases,
 movementProfile:Movement,phaseFactories:{combat:x=>Combat.create({...x,counterConfig:Faces,combatPolicy:Policy})}}).snapshot();
const source=opening.state.units;
const sourceIds=['leningrad-front-r01c04','leningrad-front-r01c01'];
sourceIds.forEach(id=>yes(source[id]?.owner==='soviet'&&source[id]?.size==='corps'));
const origin='0309',oneAllowed='0508',extension='0608';
// Use four connected, verified source-board cells as a controlled topology.
// The production solver still receives the complete map in normal gameplay.
const chain=['0309','0409','0508','0608'];
const sourceBoard=MovementBinding.build(Map,Movement).board;
const wanted=new Set(chain.slice(1).map((h,i)=>[h,chain[i]].sort().join(':')));
const edges=sourceBoard.edges.filter(e=>wanted.has([e.a,e.b].sort().join(':')));
eq(edges.length,3,'each stress-fixture edge is source verified');
yes(edges.every(e=>e.verified&&!e.impassable&&!e.lake&&!e.allSea));
const cells=Object.fromEntries(chain.map(h=>[h,sourceBoard.cells[h]]));
yes(Object.values(cells).every(c=>c?.verified));
const sourceText=fs.readFileSync('core/historical_forced_retreat.js','utf8');
const fake=new Module('source-certified-retreat-chain',module);
fake.filename=require.resolve('../core/historical_forced_retreat');
fake.require=(name)=>name==='./movement_binding.js'?{build:()=>({board:{edges,cells}})}:name==='./movement_rules.js'?require('../core/movement_rules'):name==='./territorial_state_transition.js'?require('../core/territorial_state_transition'):require(name);
fake._compile(sourceText,fake.filename);
const ControlledRetreat=fake.exports;
const st={units:Object.fromEntries(sourceIds.map(id=>[id,{...copy(source[id]),hex:origin}]))};
st.units['synthetic-soviet-crowd']={id:'synthetic-soviet-crowd',hex:oneAllowed,
 owner:'soviet',size:'corps',strengthStatus:'printed-full'};
const solver=ControlledRetreat.create({map:Map,profile:Movement,combatPolicy:Policy,counterConfig:Faces});
const before=copy(st);
const r=solver.enumerate({state:st,defenderHex:origin,defenderIds:sourceIds});
eq(st,before,'discovery must not mutate caller');
eq(r.status,'certified-forced-retreat-options');
eq(r.exhaustive,true);eq(r.orderDependent,true);
yes(r.combinations.length>=2,'either defender can retreat first');
yes(r.combinations.every(c=>Object.values(c).filter(Boolean).length===2), 'both must survive');
yes(r.combinations.every(c=>Object.values(c).some(x=>x.route.length===2&&x.route.at(-1)===oneAllowed)));
yes(r.combinations.every(c=>Object.values(c).some(x=>x.route.length===3&&
 x.route.at(-1)===extension&&x.route[1]===oneAllowed)));
yes(r.jointOrders.every(order=>order.length===2&&new Set(order).size===2));
for(let i=0;i<r.combinations.length;i++){
 const c=r.combinations[i],paths=Object.fromEntries(Object.entries(c).map(([id,o])=>[id,o.route]));
 const target=copy(st),applied=solver.apply({state:target,defenderHex:origin,
  defenderIds:sourceIds,paths,loseStep:()=>{throw Error('No EZOC loss in controlled fixture');}});
 eq(applied.retreatOrder,r.jointOrders[i]);
 eq(applied.losses,[]);
 for(const id of sourceIds)eq(target.units[id].hex,c[id].route.at(-1));
 eq(st,before);
}
const c=r.combinations[0],paths=Object.fromEntries(Object.entries(c).map(([id,o])=>[id,o.route]));
const extendedId=sourceIds.find(id=>paths[id].length===3);
bad(()=>solver.apply({state:copy(st),defenderHex:origin,defenderIds:sourceIds,
 paths:{...paths,[extendedId]:paths[extendedId].slice(0,2)},loseStep:()=>{}}),/Complete retreat paths/);
bad(()=>solver.apply({state:copy(st),defenderHex:origin,defenderIds:sourceIds,
 paths:{...paths,[extendedId]:[...paths[extendedId],'0708']},loseStep:()=>{}}),/Complete retreat paths/);
const reversed=solver.enumerate({state:st,defenderHex:origin,defenderIds:[...sourceIds].reverse()});
eq(reversed.status,'certified-forced-retreat-options');
yes(reversed.combinations.some(c=>Object.keys(c).length===2));
const conflicting=copy(st);conflicting.units[sourceIds[1]].owner='german';
bad(()=>solver.enumerate({state:conflicting,defenderHex:origin,defenderIds:sourceIds}),/same faction/);
const text=sourceText;
yes(!/\b(?:leningrad|moscow|kiev|arduous)\b/i.test(text),'no scenario-ID branching');
const report={checkpoint:161,version:'v395',assertions:checks,scope:'controlled four-cell, three-edge topology selected from source-certified Leningrad board, synthetic traffic',
 sourceRule:'references/rules/leningrad-rules.pdf §10.6',
 sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/leningrad-rules.pdf')).digest('hex'),
 results:{orders:r.jointOrders,combinations:r.combinations.length,first:r.combinations[0]},
 limitations:['Synthetic reduced topology and crowded unit placement are not a published historical board/deployment',
 'Only when independent joint route search offers no certified pair',
 'Longer and more complex multi-unit retreat equivalence remains unverified']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-joint-order-retreat-v395.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS v395:',checks,'joint-order, compulsory overstack extension, atomicity checks');
