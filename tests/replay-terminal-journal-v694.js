'use strict';
const A=require('node:assert/strict'), fs=require('node:fs');
const R=p=>require('../'+p), C=R('core/historical_campaign_session'), Auto=R('core/historical_campaign_autoplay');
const [scenario,variant,input,output]=process.argv.slice(2);
A.ok(['arduous','leningrad','kiev','kiev-odessa'].includes(scenario)); A.ok(['standard','advanced'].includes(variant));
function contextFor(name){
 if(name==='kiev-odessa')return {...structuredClone(R('games/kiev-odessa/experimental-preview/opening-v531.json').contextStart),map:R('maps/kiev-odessa-composite-experimental-v531.json'),profile:R('maps/movement-configs/kiev-odessa-experimental-v531.json'),config:R('maps/phase-configs/kiev-odessa.json'),counterConfig:R('maps/counter-configs/kiev-odessa-experimental-v531.json'),combatPolicy:R('maps/combat-configs/kiev-odessa-experimental-v531.json'),rosterOverlay:R('maps/roster-overlays/kiev-odessa.json'),enableAirSupport:true,buildupPolicy:R('maps/buildup-configs/kiev-odessa-experimental-v533.json'),buildupAllocation:R('games/kiev-odessa/experimental-preview/allocation-v533.json'),housekeepingPolicy:R('maps/housekeeping-configs/kiev-odessa-candidate-v521.json')};
 const map=R(`maps/${name}.json`),profile=R(`maps/movement-configs/${name}.json`),config=R(`maps/phase-configs/${name}.json`),counterConfig=R(`maps/counter-configs/${name}.json`),combatPolicy=R(`maps/combat-configs/${name}.json`),setupSpec=R(`maps/setup/${name}.json`);
 const base={map,profile,config,counterConfig,combatPolicy,enableAirSupport:true,buildupPolicy:R(`maps/buildup-configs/${name}.json`),housekeepingPolicy:R(`maps/housekeeping-configs/${name}.json`)};
 const dep={map,setupSpec,counterConfig,phaseConfig:config,movementProfile:profile,phaseFactories:{combat:()=>({})}};
 if(name==='leningrad'){const f=require('./fixtures/leningrad-source-setup-v357');const opening=R('core/scenario_opening_bridge').create({...dep,inventory:R('core/leningrad_starting_inventory'),allocation:f.selected,placements:f.placements,supportPolicy:combatPolicy}).snapshot();return {...opening,...base,buildupAllocation:f.selected};}
 if(name==='arduous'){const f=require('./fixtures/arduous-source-setup-v419'),fixedPolicy=R('maps/setup/arduous-fixed-pieces.json');const d=R('core/historical_deployment_session').create({...dep,fixedPolicy,inventory:R('core/historical_source_face_inventory').create(R('maps/setup/arduous-inventory.json')),allocation:f.allocation,placements:f.placements}).commit({requireMixed:false});return {...d.opening,...base,fixedPolicy,buildupAllocation:d.allocation};}
 const f=require('./fixtures/kiev-source-opening-v437'),d=R('core/historical_deployment_session').create({...dep,inventory:f.inventory,allocation:f.allocation,placements:f.placements}).commit();return {...d.opening,...base,buildupAllocation:d.allocation};
}

const context=R('core/graduated_mode').withHistorical(contextFor(scenario),process.env.VICTORY_MODE||'historical');
context.combatPolicy={...context.combatPolicy};if(variant==='advanced')context.combatPolicy.crtVariant='advanced';else delete context.combatPolicy.crtVariant;
let session=C.create(context);const journal=JSON.parse(fs.readFileSync(input,'utf8'));
for(const record of journal){session=session.execute(record.action).session;A.deepEqual(session.journal().at(-1),record);}
A.equal(session.snapshot().cursor.complete,true);
const saved=R('core/historical_campaign_human').create({session,context}).save();
fs.writeFileSync(output,JSON.stringify(saved)+'\n');console.log(JSON.stringify({scenario,actions:journal.length,terminal:session.snapshot().terminal}));
