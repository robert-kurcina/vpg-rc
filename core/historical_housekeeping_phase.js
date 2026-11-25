/* Shared, source-configured historical housekeeping and terminal city scoring.
 * Source-configured rule forms: literal city-count thresholds (The Arduous
 * Beginning and Kiev §5), conditional isolation draw (Leningrad §5), and
 * Odessa §5's 20-city two-tier isolation outcomes.
 * No scenario-ID branches, no guessed result for unclassified source cases.
 */
'use strict';
const Graduated=require('./graduated_mode');
const clone=v=>JSON.parse(JSON.stringify(v));
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function create({map,config,policy,initialCityControl,communicated=null}){
 const conditionalDraw=policy?.mode==='source-literal-unclassified-cases';
 const countDraw=policy?.mode==='city-count-three-way-v1';
 const twoTierIsolation=policy?.mode==='two-tier-city-isolation-v1';
 if(!obj(map)||!Array.isArray(map.cells)||!obj(config)||!obj(policy)||!obj(initialCityControl)||
    policy.schemaVersion!==1||policy.scenarioId!==config.scenarioId||
    !Array.isArray(policy.source)||!policy.source.length||!(conditionalDraw||countDraw||twoTierIsolation)||
    !Array.isArray(config.players)||!config.players.includes(policy.axisOwner)||!config.players.includes(policy.defenderOwner)||
    policy.axisOwner===policy.defenderOwner||!Number.isInteger(policy.cityCount)||
    !Number.isInteger(policy.germanVictoryAtLeast)||!Number.isInteger(policy.sovietVictoryAtMost)||
    !obj(policy.draw)||!Number.isInteger(policy.draw.axisCityCount)||
    (conditionalDraw&&(typeof policy.draw.onlyRemainingCity!=='string'||
      policy.draw.mustBeIsolatedFromDefenderEdge!==true||policy.unclassifiedOutcome!=='unresolved-source-rule'))||
    (countDraw&&(Object.keys(policy.draw).length!==1||Object.hasOwn(policy,'unclassifiedOutcome')||
      policy.initialDefaultOwner!==policy.defenderOwner||!obj(policy.initialControlOverrides)))||
    (twoTierIsolation&&(Object.keys(policy.draw).length!==3||
      !Number.isInteger(policy.draw.twoRemainingAxisCityCount)||
      policy.draw.mustBeIsolatedFromDefenderEdge!==true||
      !obj(policy.sourceCityHexes)||
      policy.initialDefaultOwner!==policy.defenderOwner||
      !obj(policy.initialControlOverrides)||Object.hasOwn(policy,'unclassifiedOutcome'))))
  throw Error('Invalid source-bound housekeeping and victory policy');
 const names=map.cells.filter(c=>c.city?.name).map(c=>c.city.name);
 if(new Set(names).size!==names.length||names.length!==policy.cityCount||
    Object.keys(initialCityControl).length!==names.length||
    names.some(n=>!Object.hasOwn(initialCityControl,n)||!config.players.includes(initialCityControl[n]))||
    ((countDraw||twoTierIsolation)&&(Object.keys(policy.initialControlOverrides).some(n=>!names.includes(n)||
       !config.players.includes(policy.initialControlOverrides[n])||policy.initialControlOverrides[n]===policy.initialDefaultOwner)||
      names.some(n=>initialCityControl[n]!==
       (policy.initialControlOverrides[n]||policy.initialDefaultOwner))))||
    (twoTierIsolation&&(Object.keys(policy.sourceCityHexes).length!==names.length||
      map.cells.filter(c=>c.city?.name).some(c=>policy.sourceCityHexes[c.city.name]!==c.id)||
      policy.sovietVictoryAtMost!==policy.cityCount-3||
      policy.draw.twoRemainingAxisCityCount!==policy.cityCount-2||
      policy.draw.axisCityCount!==policy.cityCount-1))||
    (conditionalDraw&&!names.includes(policy.draw.onlyRemainingCity))||
    policy.germanVictoryAtLeast!==policy.cityCount||
    policy.sovietVictoryAtMost!==policy.draw.axisCityCount-(twoTierIsolation?2:1)||
    policy.draw.axisCityCount!==policy.cityCount-1||
    config.phases?.at(-1)?.kind!=='housekeeping'||config.phases.at(-1)?.owner!=='system')
  throw Error('Housekeeping city or phase configuration does not match registered map');
 if(policy.graduatedVictory!==undefined)Graduated.validate(config.scenarioId,policy.graduatedVictory);
 const targetHex=conditionalDraw?map.cells.find(c=>c.city?.name===policy.draw.onlyRemainingCity).id:null;
 function evaluate(state){
  if(!obj(state)||!obj(state.cityControl)||!obj(state.units)||
     Object.keys(state.cityControl).length!==names.length||
     names.some(n=>!config.players.includes(state.cityControl[n])))
   throw Error('Uninitialized or malformed final city-control state');
  const axisControlled=names.filter(n=>state.cityControl[n]===policy.axisOwner);
  const count=axisControlled.length;
  let outcome,reason,isolated=null;
  const remaining=names.filter(n=>state.cityControl[n]===policy.defenderOwner);
  let cityIsolation=null;
  function sourceIsolation(city){
   if(typeof communicated!=='function')throw Error('Certified communication graph required for Odessa isolation test');
   const hex=policy.sourceCityHexes[city];
   const connected=communicated(hex,policy.defenderOwner,state.units);
   if(typeof connected!=='boolean')throw Error('Non-boolean source communication result for '+city);
   return !connected;
  }
  if(count>=policy.germanVictoryAtLeast){outcome=policy.axisOwner+'-victory';reason='axis-controls-all-cities';}
  else if(count<=policy.sovietVictoryAtMost){outcome=policy.defenderOwner+'-victory';reason='axis-controls-at-most-threshold';}
  else if(twoTierIsolation){
   cityIsolation=Object.fromEntries(remaining.map(city=>[city,sourceIsolation(city)]));
   isolated=remaining.some(city=>cityIsolation[city]);
   if(count===policy.draw.axisCityCount){
    outcome=isolated?policy.axisOwner+'-victory':'draw';
    reason=isolated?'one-remaining-city-isolated':'one-remaining-city-communicating';
   }else if(count===policy.draw.twoRemainingAxisCityCount){
    outcome=isolated?'draw':policy.defenderOwner+'-victory';
    reason=isolated?'at-least-one-of-two-cities-isolated':'both-remaining-cities-communicating';
   }else throw Error('Odessa source victory breakpoint coverage incomplete');
  }
  else if(count===policy.draw.axisCityCount){
   if(countDraw){outcome='draw';reason='axis-controls-draw-threshold';}
   else if(state.cityControl[policy.draw.onlyRemainingCity]===policy.defenderOwner){
    if(typeof communicated!=='function')throw Error('Certified communication graph required for draw test');
    isolated=!communicated(targetHex,policy.defenderOwner,state.units);
    if(isolated){outcome='draw';reason='only-target-city-remains-and-isolated';}
   }
  }
  if(!outcome){outcome=policy.unclassifiedOutcome;reason='published-rule-has-no-explicit-result';}
  const graded=policy.graduatedVictory?Graduated.evaluate(policy.graduatedVictory,state.cityControl):null;
  const historical=graded?{outcome,reason}:null;
  if(graded){outcome=graded.winner==='draw'?'draw':graded.winner+'-victory';reason='experimental-graduated-victory';}
  return Object.freeze({outcome,reason,...(graded?{graduated:graded,historical}:{}),axisControlledCount:count,totalCities:names.length,
   onlyRemainingCity:conditionalDraw?policy.draw.onlyRemainingCity:null,onlyRemainingCityIsolated:isolated,
   ...(twoTierIsolation?{remainingSovietCities:remaining,isolatedSovietCities:remaining.filter(c=>cityIsolation?.[c]),
    cityIsolation}:{}),
   cityControl:clone(state.cityControl)});
 }
 function close({cursor,state,actor}){
  if(!obj(cursor)||cursor.scenarioId!==config.scenarioId||cursor.complete||
     cursor.index!==config.phases.length-1||!Number.isInteger(cursor.turn)||
     cursor.turn<1||cursor.turn>config.turns||actor!=='system')
   throw Error('Housekeeping requires current system phase and legal turn');
  const last=cursor.turn===config.turns;
  const terminal=last?evaluate(state):null;
  return Object.freeze({terminal,event:{kind:last?'campaign-completed':'turn-completed',
   turn:cursor.turn,nextTurn:last?null:cursor.turn+1,...(terminal?{terminal}: {})}});
 }
 return Object.freeze({close,evaluate});
}
module.exports=Object.freeze({create});
