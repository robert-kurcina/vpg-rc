'use strict';
const assert=require('node:assert/strict');
const Naval=require('../core/historical_naval_logistics');
const Ports=require('../core/historical_port_support');
const Compose=require('../maps/composer');
const map=Compose.compose(require('../maps/kiev.json'),require('../maps/odessa-extension.json'));
const policy=require('../maps/combat-configs/kiev-odessa-air-sea-candidate-v518.json');
const p=require('../maps/buildup-configs/kiev-odessa-naval-logistics-candidate-v519.json');
const kiev=require('../maps/counter-configs/kiev.json'),odessa=require('../maps/counter-configs/odessa-extension.json');
const cc={mapId:'kiev-odessa',faces:{front:[...kiev.faces.front,...odessa.faces.front],back:[...kiev.faces.back,...odessa.faces.back]}};
const n=Naval.create({map,combatPolicy:policy,counterConfig:cc,sourcePolicy:p});
const id='kiev-front-r03c05',f=cc.faces.front.find(x=>x.faceId===id),b=cc.faces.back.find(x=>x.faceId===f.pairedFaceId);
const u={id,hex:'1513',owner:'soviet',sourceFaceId:id,reverseFaceId:b.faceId,nationality:'soviet',class:'infantry',size:'army',mp:4,marker:false,strengthStatus:'printed-full',printedCombatStrength:+f.visualTranscription.printedValues.split('-')[0]};
const starting=Ports.create({map,policy,counterConfig:cc}).initialize({state:{scenarioId:'kiev-odessa',units:{[id]:u},cityControl:{Odessa:'soviet',Nikolaev:'soviet'}}}).state;
const c=x=>structuredClone(x);let checks=0;
function ok(a,msg){assert.ok(a,msg);checks++}
function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++}
function bad(fn,rx){assert.throws(fn,rx);checks++}
for(const die of [1,2,3,4,5,6]){
 const evacuated=n.transport({state:starting,actor:'soviet',unitId:id,destination:{kind:'off-map'},turn:4,die}).state;
 const frozen=c(evacuated);
 bad(()=>n.returnAsReinforcement({state:evacuated,actor:'soviet',unitId:id,turn:4,hex:'1911',validateRegularEntry:()=>true}),/not eligible/);
 bad(()=>n.returnAsReinforcement({state:evacuated,actor:'soviet',unitId:id,turn:5,hex:'1911'}),/authority/);
 bad(()=>n.returnAsReinforcement({state:evacuated,actor:'soviet',unitId:id,turn:5,hex:'1911',validateRegularEntry:()=>false}),/edge, EZOC or stacking/);
 const r=n.returnAsReinforcement({state:evacuated,actor:'soviet',unitId:id,turn:5,hex:'1911',validateRegularEntry:({state,unit,hex})=>{
  eq(state,evacuated,'candidate state unchanged');eq(unit.strengthStatus,die===1?'printed-reduced':'printed-full');eq(hex,'1911');return true;
 }});
 eq(evacuated,frozen,'failed and successful attempts leave source immutable');
 eq(r.state.units[id].hex,'1911','reentered normal edge hex');
 eq(r.state.units[id].strengthStatus,die===1?'printed-reduced':'printed-full','naval damage face preserved');
 eq(r.state.evacuatedNavalUnits[id],undefined,'only one return');
 eq(r.event.kind,'naval-evacuee-reinforced');
 bad(()=>n.returnAsReinforcement({state:r.state,actor:'soviet',unitId:id,turn:6,hex:'1911',validateRegularEntry:()=>true}),/not eligible/);
}
const evacuated=n.transport({state:starting,actor:'soviet',unitId:id,destination:{kind:'off-map'},turn:4,die:6}).state;
const changed=c(evacuated);changed.evacuatedNavalUnits[id].firstReturnTurn=4;
bad(()=>n.returnAsReinforcement({state:changed,actor:'soviet',unitId:id,turn:5,hex:'1911',validateRegularEntry:()=>true}),/Unverified naval evacuation/);
const forged=c(evacuated);forged.evacuatedNavalUnits[id].unit.reverseFaceId='fake';
bad(()=>n.returnAsReinforcement({state:forged,actor:'soviet',unitId:id,turn:5,hex:'1911',validateRegularEntry:()=>true}),/Source-paired/);
const wrongOrigin=c(evacuated);wrongOrigin.evacuatedNavalUnits[id].unit.hex='0302';
bad(()=>n.returnAsReinforcement({state:wrongOrigin,actor:'soviet',unitId:id,turn:5,hex:'1911',validateRegularEntry:()=>true}),/provenance/);
console.log(`PASS v520 Odessa source naval return: ${checks} assertions`);
