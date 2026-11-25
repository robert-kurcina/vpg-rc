'use strict';
const assert=require('node:assert/strict');
const D=require('../core/historical_deployment_session');
const Bridge=require('../core/scenario_opening_bridge');
const Fixture=require('./fixtures/leningrad-source-setup-v357');
const source={map:require('../maps/leningrad.json'),setupSpec:require('../maps/setup/leningrad.json'),counterConfig:require('../maps/counter-configs/leningrad.json'),inventory:require('../core/leningrad_starting_inventory'),phaseConfig:require('../maps/phase-configs/leningrad.json'),movementProfile:require('../maps/movement-configs/leningrad.json'),supportPolicy:require('../maps/combat-configs/leningrad.json')};
let n=0;const ok=(x,msg)=>{assert.ok(x,msg);n++};const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);n++};const bad=(cb,rx)=>{assert.throws(cb,rx);n++};
const setup=()=>D.create({...source,allocation:Fixture.selected,placements:Fixture.placements});
let d=setup();eq(Object.keys(d.snapshot().units).length,19);ok(!d.snapshot().concealedMixed);
bad(()=>d.commit({requireMixed:true}),/must be mixed/);
const german=Fixture.selected.germanInitialInfantry[0];
ok(d.choices(german).includes('0511'));
let moved=d.move(german,'0511');eq(moved.snapshot().placements[german],'0511');eq(d.snapshot().placements[german],'0210');
// Already two units in this cross: cannot move the single third counter into it.
bad(()=>d.move(Fixture.selected.germanInitialPanzer[1],'0210'),/Illegal historical deployment/);
bad(()=>d.move(german,'0101'),/source-approved/);
const army=Fixture.selected.sovietFrontArmies[0];
const frontCorps=Fixture.selected.sovietFrontInfantryCorps[0];
const exchanged=d.swapPositions(army,frontCorps);
eq(exchanged.snapshot().placements[army],d.snapshot().placements[frontCorps]);
eq(exchanged.snapshot().placements[frontCorps],d.snapshot().placements[army]);
bad(()=>d.swapPositions(army,german),/same deployment marker/);
bad(()=>d.move(army,'0410'),/Illegal historical deployment|source-approved/);
const mech=[...Fixture.selected.sovietRearMechanizedCorps,...Fixture.selected.sovietFrontMechanizedCorps];
const swapped=d.swapFaces(mech[0],mech[3]);eq(swapped.snapshot().placements[mech[3]],d.snapshot().placements[mech[0]]);
const GermanSix=Fixture.selected.germanInitialInfantry.find(id=>source.counterConfig.faces.front.find(f=>f.faceId===id).visualTranscription.printedValues==='6-4');
const GermanReplacement=Fixture.selected.germanTurn4Infantry[0];
if(GermanSix){let x=d.swapFaces(GermanSix,GermanReplacement);ok(x.snapshot().allocation.germanTurn4Infantry.includes(GermanSix));}
const shuffled=d.permute(['sovietRearMechanizedCorps','sovietFrontMechanizedCorps'],mech.slice().reverse());
ok(shuffled.snapshot().concealedMixed);eq(Object.keys(shuffled.snapshot().units).length,19);
for(const id of mech){let u=shuffled.snapshot().units[id];ok(u.strengthStatus==='untried'&&u.printedCombatStrength===null)}
const result=shuffled.commit({requireMixed:true});eq(result.opening.cursor.turn,1);eq(result.opening.actor,'german');eq(Object.keys(result.opening.state.units).length,19); // Fleet is a separate support marker
const saved=shuffled.save();eq(D.restore(saved,source).save(),saved);
bad(()=>D.restore({...saved,concealedMixed:false},source),/checksum/);
bad(()=>D.restore({...saved,scenarioId:'kiev'},source),/checksum/);
bad(()=>shuffled.permute(['sovietRearMechanizedCorps','sovietFrontMechanizedCorps'],[mech[0],mech[0],mech[2],mech[3]]),/Permutation/);
const frozen=JSON.stringify(shuffled.save());bad(()=>shuffled.move(mech[0],'0000'),/source-approved/);eq(JSON.stringify(shuffled.save()),frozen);
const report={checkpoint:170,version:'v404',assertions:n,status:'PASS',scope:'Candidate historical deployment validated against §6 source markers; four hidden mechanized identities mixed, versioned save and turn-1 handoff',limitations:['Source coordinate disagreement remains open','Local browser cannot prevent developer-tools inspection of concealed identities']};
if(process.argv.includes('--write-audit'))require('node:fs').writeFileSync('rules/audit/leningrad-player-deployment-v404.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
