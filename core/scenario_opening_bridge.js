/* Cross-game candidate setup -> true first-turn phase bridge.
 * All placement and turn-order data comes from scenario configurations.
 * Does not advance a phase, adjudicate combat, or authorize historical setup.
 * A supplied phase factory is independently responsible for source-backed
 * operation legality. The bridge never bypasses or synthesizes a phase.
 */
(function(root,factory){
 const Setup=typeof module==='object'&&module.exports?require('./scenario_starting_setup'):root.WargameScenarioStartingSetup;
 const Phase=typeof module==='object'&&module.exports?require('./phase_runtime'):root.WargamePhaseRuntime;
 const Ports=typeof module==='object'&&module.exports?require('./historical_port_support'):root.WargameHistoricalPortSupport;
 const Fixed=typeof module==='object'&&module.exports?require('./historical_fixed_source_pieces'):root.WargameHistoricalFixedSourcePieces;
 const api=factory(Setup,Phase,Ports,Fixed);
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameScenarioOpeningBridge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Setup,Phase,Ports,Fixed){'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 function create({map,setupSpec,counterConfig,inventory,allocation,placements,phaseConfig,movementProfile,phaseFactories,supportPolicy,fixedPolicy}={}){
  if(!map||!setupSpec||!phaseConfig||!movementProfile||!object(phaseFactories))
   throw Error('Explicit map, setup, phase, movement and phase factories required');
  Phase.validate(phaseConfig);
  if(!setupSpec.scenarioId||setupSpec.scenarioId!==phaseConfig.scenarioId||movementProfile.id!==phaseConfig.scenarioId)
   throw Error('Opening scenario configuration mismatch');
  const report=Setup.validate({map,spec:setupSpec,counterConfig,inventory,allocation,placements});
  if(!report.valid||!report.state)throw Error('Opening setup is invalid: '+report.errors.join('; '));
  const cursor=Phase.start(phaseConfig);
  const phase=Phase.current(phaseConfig,cursor);
  if(!phase||phase.owner==='system')throw Error('Opening phase must have a player actor');
  const handler=own(phaseFactories,phase.kind)?phaseFactories[phase.kind]:null;
  if(own(phaseFactories,phase.kind)&&typeof handler!=='function')throw Error('Invalid opening phase factory');
  // Copies prevent mutations of configuration/placement after binding from
  // rewriting the source-checked opening position and phase cursor.
  const sourceMap=clone(map),config=clone(phaseConfig),profile=clone(movementProfile);
  // Source-configured, optional support-marker setup. Existing non-Fleet
  // scenarios receive precisely their previous ground-unit-only state.
  if(supportPolicy&&!supportPolicy.portSupport)throw Error('Source-configured support marker policy required');
  const supportState=supportPolicy?Ports.create({map,policy:supportPolicy,counterConfig})
   .initialize({state:report.state}).state:report.state;
  const fixed=fixedPolicy?Fixed.initialize({map,counterConfig,policy:fixedPolicy,state:supportState}):null;
  const state=fixed?.state||supportState;
  const opening=clone({cursor,actor:phase.owner,state});
  const audit=clone({startingUnits:Object.keys(state.units).length,sourceFaceStartingUnits:report.startingUnitCount,
   fixedSourcePieces:fixed?.audit||[],printedAnchorAgreement:report.printedAnchorAgreement,
   printedAnchorDisagreements:report.printedAnchorDisagreements,scope:report.setupScope});
  function snapshot(){return clone(opening);}
  function firstPhase(){return clone(Phase.current(config,opening.cursor));}
  function controller(){
   if(!handler)throw Error('No verified opening phase controller registered for '+phase.kind);
   return handler({map:clone(sourceMap),profile:clone(profile),config:clone(config),...snapshot()});
  }
  return Object.freeze({status:'candidate-physical-setup-preview',historicalSetupAuthorized:false,
   productionGameActivated:false,snapshot,firstPhase,controller,setupAudit:()=>clone(audit)});
 }
 return Object.freeze({create});
});
