/* Candidate fixed-seed legal allocation, NOT a claim of historical unique initial identities. */
'use strict';
const map=require('../../maps/arduous.json');
const spec=require('../../maps/setup/arduous.json');
const poolPolicy=require('../../maps/setup/arduous-inventory.json');
const Inventory=require('../../core/historical_source_face_inventory');
const Setup=require('../../core/scenario_starting_setup');
const counterConfig=require('../../maps/counter-configs/arduous.json');
const inv=Inventory.create(poolPolicy),scanned=inv.inspect(counterConfig);
if(!scanned.valid)throw Error('Arduous source inventory invalid');
const slots=Setup.slots(map,spec).slots;
const allocation={},placements={};
const selected=new Set();
for(const [name,g] of Object.entries(poolPolicy.groups)){
 allocation[name]=scanned.pools[g.pool].filter(id=>!selected.has(id)).slice(0,g.count);
 allocation[name].forEach(id=>selected.add(id));
 if(allocation[name].length!==g.count)throw Error('Arduous group '+name+' unassigned');
}
const cross=slots.cross.map(s=>s.hex).sort();
const germ=[...allocation.germanInitialPanzer,...allocation.germanInitialInfantry];
germ.forEach((id,i)=>{placements[id]=cross[Math.floor(i/2)]});
allocation.sovietFrontArmies.forEach((id,i)=>{placements[id]=['0208','0210','0305'][i]});
allocation.sovietFrontMechanized.forEach((id,i)=>{placements[id]=slots.star.map(s=>s.hex).filter(h=>!['0208','0210','0305'].includes(h))[i]});
allocation.sovietFixedArmies.forEach((id,i)=>{placements[id]=slots.fixedInfantry.map(s=>s.hex).sort()[i]});
allocation.sovietFixedMechanized.forEach((id,i)=>{placements[id]=['0609','0907','1510'][i]});
const validated=Setup.validate({map,spec,counterConfig,inventory:inv,allocation,placements});
if(!validated.valid)throw Error('Arduous initial allocation invalid: '+validated.errors.join('; '));
module.exports={allocation,placements};
