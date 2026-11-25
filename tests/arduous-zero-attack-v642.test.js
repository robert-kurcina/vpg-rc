'use strict';
const A=require('node:assert/strict'), R=p=>require('../'+p), Odds=R('core/historical_combat_odds'), C=R('core/historical_combat_consequences');
const map=R('maps/arduous.json'), profile=R('maps/movement-configs/arduous.json'), config=R('maps/phase-configs/arduous.json'), counterConfig=R('maps/counter-configs/arduous.json'), policy=R('maps/combat-configs/arduous.json');
const f=require('./fixtures/arduous-source-setup-v419');
const d=R('core/historical_deployment_session').create({map,profile,phaseConfig:config,movementProfile:profile,setupSpec:R('maps/setup/arduous.json'),counterConfig,fixedPolicy:R('maps/setup/arduous-fixed-pieces.json'),inventory:R('core/historical_source_face_inventory').create(R('maps/setup/arduous-inventory.json')),allocation:f.allocation,placements:f.placements,phaseFactories:{combat:()=>({})}}).commit({requireMixed:false});
const all=Object.values(d.opening.state.units), fronts=counterConfig.faces.front, backs=counterConfig.faces.back;
const zero=all.find(u=>u.strengthStatus==='untried'&&backs.find(b=>b.faceId===u.reverseFaceId)?.visualTranscription.printedValues==='0·1-6');
const army=all.find(u=>u.owner==='soviet'&&u.printedCombatStrength>=8), defender=all.find(u=>u.owner==='german'&&u.printedCombatStrength===6);
A.ok(zero&&army&&defender);let n=1;const eq=(a,b)=>{A.deepEqual(a,b);n++};
const board=R('core/movement_binding').build(map,profile).board, neighbors=h=>board.edges.filter(e=>(e.a===h||e.b===h)&&e.verified&&!e.impassable&&!e.lake&&!e.allSea&&!e.river&&!e.majorRiver).map(e=>e.a===h?e.b:e.a);
const target=map.cells.find(c=>board.cells[c.id].terrain==='open'&&!c.city&&neighbors(c.id).length>=3), [h1,h2,h3]=neighbors(target.id);
for(const variant of ['standard','advanced']){
 const combatPolicy={...policy,crtVariant:variant}, geo=R('core/historical_combat_geography').create(map,profile,{cityMarkerMode:policy.cityMarkerMode,fortificationMode:policy.fortificationMode}), e=C.create({map,profile,counterConfig,combatPolicy,phaseConfig:config,geography:geo});
 const cursor={...d.opening.cursor,turn:2,index:config.phases.findIndex(p=>p.id==='soviet-combat')};
 const state={...structuredClone(d.opening.state),units:Object.fromEntries([{...zero,hex:h1},{...army,hex:h2},{...defender,hex:target.id}].map(u=>[u.id,u]))};
 const battle={defenderHex:target.id,attackers:[zero.id],defenders:[defender.id]}, args={state,battle,actor:'soviet',cursor};
 const est=e.previewEstimatedOdds(args);eq(est.complete,true);eq(est.assignments,10);A.ok(est.distribution['0']>=2);n++;
 const no=e.resolve({...args,die:null,choices:{}});eq(no.event.outcome,'NE');eq(no.state.units[zero.id].revealedAttackStrength,0);eq(no.state.units[zero.id].revealedDefenseStrength,1);eq(state.units[zero.id].strengthStatus,'untried');
 const pair={...battle,attackers:[zero.id,army.id]}, known=e.previewKnownOdds({...args,state:no.state,battle:pair});eq(known.attackStrength,army.printedCombatStrength);
 const withZero=Odds.evaluate({attackers:[{kind:'mechanized',value:0},{kind:'infantry',value:8}],defenders:[{kind:'infantry',value:6}],defenderTerrain:'open',allAttackersAcrossRiver:false,policy:combatPolicy});eq(withZero.attackStrength,8);
 const base={attackers:[{kind:'mechanized',value:0}],defenders:[{kind:'infantry',value:1}],defenderTerrain:'open',allAttackersAcrossRiver:false};A.throws(()=>Odds.evaluate(base),/positive verified/);n++;A.throws(()=>Odds.evaluate({...base,policy:combatPolicy,attackers:[{kind:'infantry',value:0}]}),/positive verified/);n++;A.throws(()=>Odds.evaluate({...base,policy:combatPolicy,defenders:[{kind:'mechanized',value:0}]}),/positive verified/);n++;
 const second=all.find(u=>u.owner==='soviet'&&u.printedCombatStrength===8&&u.id!==army.id);A.ok(second);n++;const strongState={...no.state,units:{...no.state.units,[defender.id]:{...no.state.units[defender.id],strengthStatus:"printed-reduced",printedCombatStrength:3,activeFaceId:defender.reverseFaceId},[second.id]:{...second,hex:h3}}};const strongBattle={...pair,attackers:[zero.id,army.id,second.id]};const strongOdds=e.previewKnownOdds({...args,state:strongState,battle:strongBattle}).finalOdds;const de=Array.from({length:6},(_,i)=>i+1).find(die=>R('core/historical_crt').result(strongOdds,die,variant)==='DE');A.ok(de);n++;const adv=e.resolve({...args,state:strongState,battle:strongBattle,die:de,choices:{advanceUnitId:zero.id}});eq(adv.state.units[zero.id].hex,target.id);eq(adv.event.advanced,zero.id);
 const al=Array.from({length:6},(_,i)=>i+1).find(die=>R('core/historical_crt').result(known.finalOdds,die,variant)==='AL');if(al){const res=e.resolve({...args,state:no.state,battle:pair,die:al,choices:{lossUnitId:zero.id}});eq(res.state.units[zero.id],undefined);}
}
console.log('PASS source rule 10.1.2 zero attack',n,'assertions');
