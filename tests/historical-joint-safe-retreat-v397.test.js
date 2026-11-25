'use strict';
/* A bounded, source-edge Leningrad §10.6 adversarial test. Traffic is
 * synthetic; unit identities and all traversable edges come from source. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Module=require('node:module');
const MovementBinding=require('../core/movement_binding');
const Bridge=require('../core/scenario_opening_bridge');
const Combat=require('../core/historical_combat_phase');
const Inventory=require('../core/leningrad_starting_inventory');
const Board=require('../maps/leningrad.json');
const Faces=require('../maps/counter-configs/leningrad.json');
const Setup=require('../maps/setup/leningrad.json');
const Movement=require('../maps/movement-configs/leningrad.json');
const Phases=require('../maps/phase-configs/leningrad.json');
const Policy=require('../maps/combat-configs/leningrad.json');
const selected=require('./fixtures/leningrad-source-setup-v357');
const cp=x=>JSON.parse(JSON.stringify(x));
const opening=Bridge.create({map:Board,setupSpec:Setup,counterConfig:Faces,inventory:Inventory,
 allocation:selected.selected,placements:selected.placements,phaseConfig:Phases,
 movementProfile:Movement,phaseFactories:{combat:x=>Combat.create({...x,counterConfig:Faces,combatPolicy:Policy})}}).snapshot();
const ids=['leningrad-front-r02c01','leningrad-front-r02c02'];
const nodes=['0309','0409','0508','0608','0410','0510','0408','0610'];
const routeEdges=[['0309','0409'],['0409','0508'],['0508','0608'],['0309','0410'],
 ['0410','0510'],['0408','0409'],['0610','0510']];
const sourceBoard=MovementBinding.build(Board,Movement).board;
const edgeSet=new Set(routeEdges.map(([a,b])=>[a,b].sort().join(':')));
const edges=sourceBoard.edges.filter(e=>edgeSet.has([e.a,e.b].sort().join(':')));
assert.equal(edges.length,routeEdges.length,'all edges must exist on the certified Leningrad map');
assert.ok(edges.every(e=>e.verified&&!e.impassable&&!e.lake&&!e.allSea));
const cells=Object.fromEntries(nodes.map(h=>[h,sourceBoard.cells[h]]));
assert.ok(Object.values(cells).every(c=>c?.verified));
function load(source){
 const fake=new Module('source-certified-joint-safety',module);
 fake.filename=require.resolve('../core/historical_forced_retreat');
 fake.require=n=>n==='./movement_binding.js'?{build:()=>({board:{edges,cells}})}:n==='./movement_rules.js'?require('../core/movement_rules'):n==='./territorial_state_transition.js'?require('../core/territorial_state_transition'):require(n);
 fake._compile(source,fake.filename);
 return fake.exports.create({map:Board,profile:Movement,combatPolicy:Policy,counterConfig:Faces});
}
const current=load(fs.readFileSync('core/historical_forced_retreat.js','utf8'));
const state={units:Object.fromEntries(ids.map(id=>[id,{...cp(opening.state.units[id]),hex:'0309'}]))};
for(const [id,hex] of [['synthetic-german-zoc-x','0408'],['synthetic-german-zoc-q','0610']])
 state.units[id]={id,hex,owner:'german',size:'corps',strengthStatus:'printed-full'};
for(const id of ids){
 assert.equal(state.units[id].owner,'soviet');assert.equal(state.units[id].size,'army');
 const back=Faces.faces.back.find(f=>f.faceId===state.units[id].reverseFaceId);
 assert.match(back.visualTranscription.printedValues,/^\d+-\d+$/);
}
const original=cp(state);
const now=current.enumerate({state,defenderHex:'0309',defenderIds:ids});
// Construct the two competing independent (non-ordered) two-hex outcomes.
// They are valid endpoint combinations, yet each kills a defender at Q.
const dangerous=ids.map((id,i)=>{
 const safe=now.perDefender[id].options.find(o=>o.route.at(-1)==='0508'&&o.route.length===2);
 const deadly=now.perDefender[ids[1-i]].options.find(o=>o.route.at(-1)==='0510'&&o.route.length===2);
 assert.ok(safe&&!safe.endInEZOC&&deadly&&deadly.endInEZOC);
 return [safe,deadly];
});
assert.equal(dangerous.length,2);
assert.deepEqual(state,original,'catalog must never mutate caller');
assert.equal(now.status,'certified-forced-retreat-options');
assert.equal(now.exhaustive,true);
assert.ok(now.combinations.length>0);
assert.ok(now.combinations.every(combo=>ids.every(id=>combo[id]&&!combo[id].endInEZOC)),
 'ordered mandatory extension must save both defenders when legal');
assert.ok(now.combinations.every(c=>ids.some(id=>c[id].route.length===3&&c[id].route.at(-1)==='0608')));
assert.ok(now.combinations.every(c=>ids.some(id=>c[id].route.length===2&&c[id].route.at(-1)==='0508')));
assert.ok(now.jointOrders.every(order=>order.length===2));
let assertions=21;
for(let i=0;i<now.combinations.length;i++){
 const c=now.combinations[i],paths=Object.fromEntries(ids.map(id=>[id,c[id].route]));
 const state2=cp(original),losses=[];
 const ret=current.apply({state:state2,defenderHex:'0309',defenderIds:ids,paths,
  loseStep:(s,id)=>{losses.push(id);s.units[id].strengthStatus='printed-reduced';return {unitId:id,removed:false};}});
 assert.equal(ret.retreats.length,2);
 assert.equal(ret.losses.length,2,'each Army enters exactly one unavoidable EZOC');
 assert.equal(losses.length,2);
 assert.ok(ids.every(id=>state2.units[id].strengthStatus==='printed-reduced'));
 assert.ok(ids.every(id=>state2.units[id].hex!=='0309'));
 assert.deepEqual(state,original);
 assertions+=6;
}
assert.match(fs.readFileSync('core/historical_forced_retreat.js','utf8'),/allIndependentKill/);
assert.ok(!/scenarioId\s*===\s*['"]leningrad/.test(fs.readFileSync('core/historical_forced_retreat.js','utf8')));
assertions+=2;
const audit={checkpoint:163,version:'v397',assertions,source:'references/rules/leningrad-rules.pdf §10.6',
 sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('references/rules/leningrad-rules.pdf')).digest('hex'),
 scenario:'Controlled source-verified eight-cell seven-edge graph with synthetic congestion and two source-face Soviet Armies',
 result:{independentFatalTwoHexAssignments:dangerous.length,
 improvedSurvivingOrderedChoices:now.combinations.length,orders:now.jointOrders},
 limitations:['Synthetic traffic and reduced edge subset are not an independently certified original-game position',
 'Improved when existing independent candidates cause elimination; exhaustive general joint retreat rule not certified',
 'Historical counter assignment and coordinate issues remain unresolved']};
if(process.argv.includes('--write-audit'))fs.writeFileSync('rules/audit/leningrad-joint-safe-retreat-v397.json',JSON.stringify(audit,null,2)+'\n');
console.log('PASS v397:',assertions,'adversarial source-graph retreat assertions');
