'use strict';
/* Test-only, deterministic LEGAL SAMPLE; not a historical order of battle or
 * a default position. Kiev §6 deliberately lets players place interchangeable
 * counters within source-defined regions, with Soviet Mechanized identities
 * concealed. Keep all source-face decisions explicit at runtime. */
const map=require('../../maps/kiev.json');
const setupSpec=require('../../maps/setup/kiev.json');
const inventoryPolicy=require('../../maps/setup/kiev-inventory.json');
const counterConfig=require('../../maps/counter-configs/kiev.json');
const Inventory=require('../../core/historical_source_face_inventory');
const Setup=require('../../core/scenario_starting_setup');
const inventory=Inventory.create(inventoryPolicy);
const inspected=inventory.inspect(counterConfig);
if(!inspected.valid)throw Error('Kiev test fixture: source face inventory not valid');
const frontById=new Map(counterConfig.faces.front.map(f=>[f.faceId,f]));
const used=new Set(),allocation={};
// Source specifies exactly one 6-4 German infantry arriving on turn 3.
const germanArriving=inspected.pools.germanInfantry.find(id=>{
 const t=frontById.get(id).visualTranscription;
 return t.printedValues==='6-4'&&t.kind==='infantry';
});
if(!germanArriving)throw Error('Kiev test fixture: no source-backed 6-4 German arrival');
allocation.germanReinforcementInfantry=[germanArriving];used.add(germanArriving);
for(const [group,rule] of Object.entries(inventoryPolicy.groups)){
 if(group==='germanReinforcementInfantry')continue;
 const picks=inspected.pools[rule.pool].filter(id=>!used.has(id)).slice(0,rule.count);
 if(picks.length!==rule.count)throw Error('Kiev test fixture: missing source face for '+group);
 allocation[group]=picks;
 for(const id of picks)used.add(id);
}
const placements={};
const position=(group,hexes)=>{
 if(allocation[group].length!==hexes.length)throw Error('Kiev test fixture: invalid sample layout '+group);
 allocation[group].forEach((id,i)=>{placements[id]=hexes[i]});
};
const polish=setupSpec.groups.germanInitialPanzer.allowedHexes;
position('germanInitialPanzer',polish.slice(0,3));
position('germanPolandInfantry',polish);
const romanian=setupSpec.groups.romanianInitialArmy.allowedHexes;
position('germanRomaniaInfantry',romanian.slice(0,3));
position('romanianInitialArmy',[romanian[3]]);
position('sovietFixedArmies',setupSpec.groups.sovietFixedArmies.allowedHexes);
position('sovietFixedMechanized',setupSpec.groups.sovietFixedMechanized.allowedHexes);
// Four intentionally chosen, mutually nonadjacent front-line Army positions.
const frontArmyHexes=['0205','0401','0708','1110'];
position('sovietFrontArmies',frontArmyHexes);
const starHexes=Setup.slots(map,setupSpec).slots.star.map(s=>s.hex);
position('sovietFrontMechanized',starHexes.filter(h=>!frontArmyHexes.includes(h)));
const validation=Setup.validate({map,spec:setupSpec,counterConfig,inventory,allocation,placements});
if(!validation.valid)throw Error('Kiev test fixture: '+validation.errors.join('; '));
module.exports={map,setupSpec,counterConfig,inventory,allocation,placements,validation,frontArmyHexes};
