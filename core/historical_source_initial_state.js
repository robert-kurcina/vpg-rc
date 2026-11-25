/* Single source-checked candidate setup assembler for historical games.
 * Uses the scenario-neutral setup rules and exceptional source-piece adapter.
 * A candidate setup is not authorization to bypass movement graph certification.
 */
(function(root,factory){
 const api=factory(typeof require==='function'?require('./scenario_starting_setup'):root.WargameScenarioStartingSetup,
   typeof require==='function'?require('./historical_fixed_source_pieces'):root.WargameHistoricalFixedSourcePieces);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalSourceInitialState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Setup,Fixed){'use strict';
function build({map,setupSpec,counterConfig,inventory,allocation,placements,fixedPolicy}={}){
 const selected=Setup.validate({map,spec:setupSpec,counterConfig,inventory,allocation,placements});
 if(!selected.valid)throw Error('initial-source-setup: '+selected.errors.join('; '));
 const fixed=fixedPolicy?Fixed.initialize({map,counterConfig,policy:fixedPolicy,state:selected.state}):null;
 const state=fixed?.state||selected.state;
 const units=Object.values(state.units);
 const faces=new Set();
 for(const unit of units){
  if(!unit.hex||!['german','soviet'].includes(unit.owner)||faces.has(unit.sourceFaceId))throw Error('initial-source-setup: invalid-or-duplicate-source-face');
  faces.add(unit.sourceFaceId);
 }
 const hexes=new Map(map.cells.map(c=>[c.id,c]));
 const occupancy=new Map();
 for(const unit of units){
  if(!hexes.has(unit.hex))throw Error('initial-source-setup: off-map-unit');
  const others=occupancy.get(unit.hex)||[];
  if(others.some(o=>o.owner!==unit.owner)||others.length>=2||
   (unit.owner==='soviet'&&unit.size==='army'&&others.some(o=>o.size==='army')))
    throw Error('initial-source-setup: illegal-starting-stack:'+unit.hex);
  others.push(unit);occupancy.set(unit.hex,others);
 }
 const audit={sourceFaceStartingUnits: selected.startingUnitCount,fixedSourcePieces:fixed?.audit?.length||0,
  totalStartingGroundUnits:units.length,german:units.filter(u=>u.owner==='german').length,
  soviet:units.filter(u=>u.owner==='soviet').length,
  unresolvedPrintedRearAnchors:selected.printedAnchorDisagreements,
  fixedSourceAudit:fixed?.audit||[],sourceNamedCityAnchors:Object.fromEntries(
    Object.entries(Setup.slots(map,setupSpec).slots).filter(([,v])=>v.some(s=>s.anchorSource)).map(([k,v])=>[k,v.filter(s=>s.anchorSource)]))};
 return Object.freeze({state:JSON.parse(JSON.stringify(state)),audit:JSON.parse(JSON.stringify(audit)),
  sourceSetupValid:true,gameplayAuthorized:false,movementGraphCertified:false});
}
return Object.freeze({build});
});
