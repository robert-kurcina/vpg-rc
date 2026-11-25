/* Shared, pure battle-odds calculation; scenario modifiers arrive through
 * source configuration. The legacy defaults preserve existing calculation-only
 * test callers; executable consequences must always pass an explicit policy.
 * Caller must certify unit strengths, geography and support eligibility.
 */
(function(root,factory){
 const C=typeof module==='object'&&module.exports?require('./historical_crt.js'):root.WargameHistoricalCRT;
 const api=factory(C);if(typeof module==='object'&&module.exports)module.exports=api;
 root.WargameHistoricalCombatOdds=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(C){'use strict';
 const OWN=x=>Object.prototype.hasOwnProperty.call(x,'value');
 function assertStrength(unit,side,zeroAttackClasses=[]){
  if(!unit||typeof unit!=='object'||!OWN(unit)||!Number.isFinite(unit.value)||(unit.value<0||(unit.value===0&&!(side==='attacker'&&zeroAttackClasses.includes(unit.kind))))||!['infantry','mechanized','panzer','motorized','cavalry','other'].includes(unit.kind))throw Error('Explicit positive verified '+side+' strength and unit kind required');
  if(unit.untried===true)throw Error('Untried unit must be revealed before combat strength is available');
  return unit.value;
 }
 const LEGACY=Object.freeze({terrainColumnShifts:{forest:-1,swamp:-1,'major-city':-1},
  allAttackersAcrossRiverShift:-1,swampTankStrengthMultiplier:.5,
  swampAffectedClasses:['panzer','mechanized'],maximumOdds:6});
 function evaluate({attackers,defenders,defenderTerrain,allAttackersAcrossRiver,airSupportShift=0,fleetShift=0,die=null,policy=null,attackerIds=null,majorRiverCrossers=[],actor=null,turn=null}={}){
  const rules=policy===null?LEGACY:policy.modifiers;
  if(!rules||!rules.terrainColumnShifts||!Array.isArray(rules.swampAffectedClasses)||
    !Number.isInteger(rules.maximumOdds)||rules.maximumOdds<1||rules.maximumOdds>6||
    !Number.isInteger(rules.allAttackersAcrossRiverShift)||rules.allAttackersAcrossRiverShift>0||
    !Number.isFinite(rules.swampTankStrengthMultiplier)||rules.swampTankStrengthMultiplier<=0||
    rules.swampTankStrengthMultiplier>1||
    Object.values(rules.terrainColumnShifts).some(x=>!Number.isInteger(x)||x>0))
   throw Error('Explicit valid source-configured combat modifiers required');
  if(rules.zeroAttackClasses!==undefined&&(!Array.isArray(rules.zeroAttackClasses)||rules.zeroAttackClasses.some(k=>!['infantry','mechanized','panzer','motorized','cavalry','other'].includes(k))))throw Error('Invalid zero-attack authorization');
  if(!Array.isArray(attackers)||!attackers.length||!Array.isArray(defenders)||!defenders.length)throw Error('Complete nonempty attacker/defender strengths required');
  // Optional source-derived, turn-limited bonuses apply only to attacking units.
  // Requiring the combat phase's real owner and turn prevents silent omissions.
  const turnBonuses=rules.attackerTurnMultipliers||[];
  if(!Array.isArray(turnBonuses)||turnBonuses.some(b=>!b||!['german','soviet'].includes(b.owner)||
    !['infantry','mechanized','panzer','motorized','cavalry','other'].includes(b.kind)||
    !Number.isInteger(b.turn)||b.turn<1||!Number.isFinite(b.multiplier)||b.multiplier<=0)||
    new Set(turnBonuses.map(b=>b.owner+':'+b.turn+':'+b.kind)).size!==turnBonuses.length)
   throw Error('Invalid scenario attacker-turn bonus policy');
  if(turnBonuses.length&&(!['german','soviet'].includes(actor)||!Number.isInteger(turn)||turn<1))
   throw Error('Turn-specific combat bonus needs source-bound owner and turn');
  if(!Array.isArray(majorRiverCrossers)||new Set(majorRiverCrossers).size!==majorRiverCrossers.length||
    majorRiverCrossers.some(id=>typeof id!=='string')||
    (majorRiverCrossers.length&&(!Array.isArray(attackerIds)||attackerIds.length!==attackers.length||
    attackerIds.some(id=>typeof id!=='string')||majorRiverCrossers.some(id=>!attackerIds.includes(id))||
    policy?.modifiers?.majorRiverAttackMultiplier!==0.5)))throw Error('Major River strength requires verified attacker IDs and an explicit scenario multiplier');
  if(!['open','forest','swamp','major-city','fortification','other'].includes(defenderTerrain))throw Error('Explicit verified defender terrain required');
  if(typeof allAttackersAcrossRiver!=='boolean')throw Error('Explicit verified river relationship required');
  if(!Number.isInteger(airSupportShift)||airSupportShift<0||airSupportShift>6||!Number.isInteger(fleetShift)||fleetShift<-1||fleetShift>1)throw Error('Invalid support shift');
  const majorSet=new Set(majorRiverCrossers);
  const attackStrength=attackers.reduce((sum,u,i)=>{
   let value=assertStrength(u,'attacker',rules.zeroAttackClasses||[]);
   const turnBonus=turnBonuses.find(b=>b.owner===actor&&b.turn===turn&&b.kind===u.kind);
   if(turnBonus)value*=turnBonus.multiplier;
   if(majorSet.size&&majorSet.has(attackerIds[i]))value=Math.floor(value*rules.majorRiverAttackMultiplier);
   return sum+(defenderTerrain==='swamp'&&rules.swampAffectedClasses.includes(u.kind)?value*rules.swampTankStrengthMultiplier:value);
  },0);
  const defenseStrength=defenders.reduce((sum,u)=>sum+assertStrength(u,'defender'),0);
  const variant=C.normalizeVariant(policy?.crtVariant||'standard');
  const rawOdds=variant==='advanced'?C.columnForRatio(attackStrength/defenseStrength,variant):Math.floor(attackStrength/defenseStrength);
  // The default calculation remains the Oberlabs B4M integer-column rule.
  // Advanced uses the user-supplied 1:2 and 3:2 intermediate columns.
  const cappedOdds=Math.min(rules.maximumOdds,rawOdds);
  const terrainShift=(rules.terrainColumnShifts[defenderTerrain]||0)+(allAttackersAcrossRiver?rules.allAttackersAcrossRiverShift:0);
  const finalOdds=C.shiftColumn(cappedOdds,terrainShift+airSupportShift+fleetShift,rules.maximumOdds,variant);
  const noEffect=finalOdds<(variant==='advanced'?0.5:1);
  if(die!==null&&(!Number.isInteger(die)||die<1||die>6))throw Error('CRT roll must be 1..6');
  return Object.freeze({attackStrength,majorRiverCrossers:[...majorRiverCrossers],defenseStrength,rawOdds,cappedOdds,terrainShift,airSupportShift,fleetShift,finalOdds,noEffect,crtResult:die===null?null:noEffect?'NE':C.result(finalOdds,die,variant),source:policy?.source||'legacy-odds-compatibility-defaults',status:'calculation-only-no-effects'});
 }
 return Object.freeze({evaluate});
});
