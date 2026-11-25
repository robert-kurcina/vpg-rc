/* TEST-ONLY deterministic face and slot choices. Not the historically
 * authenticated individual formation assignments, and NEVER production setup.
 * The source permits choices; this fixture is one legal illustrative choice.
 */
'use strict';
const I=require('../../core/leningrad_starting_inventory');
const S=require('../../core/scenario_starting_setup');
const M=require('../../maps/leningrad.json');
const C=require('../../maps/counter-configs/leningrad.json');
const cfg=require('../../maps/setup/leningrad.json');
const inv=I.inspect(C);
const pick=(pool,n,exclude=[])=>inv.pools[pool].filter(id=>!exclude.includes(id)).slice(0,n);
const germanTurn4=pick('germanReinforcementInfantry',2);
const sovietFrontArmies=pick('sovietInfantryArmies',2);
const otherArmies=pick('sovietInfantryArmies',8,sovietFrontArmies);
const rearInfantry=pick('sovietInfantryCorps',3),rearMech=pick('sovietMechanized',2);
const selected={
 germanInitialInfantry:pick('germanInfantry',9,germanTurn4),
 germanInitialPanzer:pick('germanPanzer',2),germanTurn4Infantry:germanTurn4,
 sovietTurn3WorkersMilitia:pick('workersMilitia',1),
 sovietRearInfantryCorps:rearInfantry,sovietRearMechanizedCorps:rearMech,
 sovietFrontInfantryCorps:pick('sovietInfantryCorps',1,rearInfantry),
 sovietFrontMechanizedCorps:pick('sovietMechanized',2,rearMech),sovietFrontArmies,
 sovietTurn4Army:otherArmies.slice(0,1),sovietTurn5Army:otherArmies.slice(1,2),sovietTurn6Army:otherArmies.slice(2,3),
 sovietTurn7Armies:otherArmies.slice(3,5),sovietTurn8Army:otherArmies.slice(5,6)
};
const allocReport=I.validateAllocation(C,selected);
const slotData=S.slots(M,cfg);
const sides=Object.fromEntries(Object.entries(slotData.slots).map(([k,a])=>[k,a.map(o=>o.hex).sort()]));




// Deliberate test fixture, NOT a fixed historical allocation: two armies on
// nonadjacent stars; four German pairs plus one single.
const placements={};
const place=(ids,targets)=>ids.forEach((face,i)=>placements[face]=targets[i]);
place(selected.germanInitialInfantry,['0210','0210','0310','0310','0311','0311','0411']);
place(selected.germanInitialPanzer,['0411','0511']);
place(selected.sovietRearInfantryCorps,sides.fixedInfantry);
place(selected.sovietRearMechanizedCorps,sides.fixedMechanized);
place(selected.sovietFrontArmies,['0209','0611']);
place(selected.sovietFrontInfantryCorps,['0309']);
place(selected.sovietFrontMechanizedCorps,['0410','0510']);

module.exports={inv,selected,placements,slotData,sides,allocReport};
