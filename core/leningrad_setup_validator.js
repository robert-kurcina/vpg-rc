/* Target: Leningrad §6.0 provisional FRONTLINE-only placement validator.
 * Does not cover the five fixed rear Soviet units of §6.0(3), and passing
 * cannot authorize the full initial order of battle. For inventory allocation
 * see leningrad_starting_inventory.js.
 * Validates supplied choices, never chooses a map-source family or identifies
 * a printed counter. Passing does NOT authorize historical-game activation.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.WargameLeningradSetupValidator=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const fail=(errors,message)=>{errors.push(message);};
 function validate({germanCrosses,sovietStars,units,adjacent}={}){
  if(!Array.isArray(germanCrosses)||!Array.isArray(sovietStars)||!Array.isArray(units)||typeof adjacent!=='function')throw Error('Explicit source-specific crosses, stars, units and adjacency required');
  const errors=[];
  const crosses=new Set(germanCrosses),stars=new Set(sovietStars);
  if(crosses.size!==5||germanCrosses.length!==5)fail(errors,'Exactly five unique German cross hexes required');
  if(stars.size!==5||sovietStars.length!==5)fail(errors,'Exactly five unique Soviet star hexes required');
  if([...crosses,...stars].some(h=>typeof h!=='string'||!/^[0-9]{4}$/.test(h)))fail(errors,'Invalid hex identifier');
  if([...crosses].some(h=>stars.has(h)))fail(errors,'Starting-position sides overlap');
  const ids=new Set();
  for(const u of units){
   if(!u||typeof u!=='object'||typeof u.id!=='string'||!u.id||ids.has(u.id))fail(errors,'Unit IDs must be unique nonempty strings');
   else ids.add(u.id);
   if(!['german','soviet'].includes(u?.owner)||!['infantry','panzer','army','mechanized','corps'].includes(u?.kind))fail(errors,'Unrecognized unit owner or type');
   if(typeof u?.hex!=='string')fail(errors,'Every unit must have a placement hex');
  }
  const ger=units.filter(u=>u?.owner==='german'),sov=units.filter(u=>u?.owner==='soviet');
  if(ger.length!==9||ger.filter(u=>u.kind==='infantry').length!==7||ger.filter(u=>u.kind==='panzer').length!==2)fail(errors,'German front requires seven infantry and two panzer corps');
  if(sov.length!==5||sov.filter(u=>u.kind==='army').length!==2||sov.filter(u=>u.kind==='mechanized').length!==2||sov.filter(u=>u.kind==='corps').length!==1)fail(errors,'Soviet front requires two armies, two mechanized corps, and one infantry corps');
  const count=(array,hex)=>array.filter(u=>u.hex===hex).length;
  if(ger.some(u=>!crosses.has(u.hex))||[...crosses].some(h=>count(ger,h)<1||count(ger,h)>2)||[...crosses].filter(h=>count(ger,h)===2).length!==4)fail(errors,'German units must fill five crosses: four pairs and one singleton');
  if(sov.some(u=>!stars.has(u.hex))||[...stars].some(h=>count(sov,h)!==1))fail(errors,'Soviet units must occupy each star exactly once');
  const armies=sov.filter(u=>u.kind==='army');
  if(armies.length===2&&adjacent(armies[0].hex,armies[1].hex))fail(errors,'Soviet armies cannot begin adjacent');
  return {valid:errors.length===0,errors,scope:'proposed-layout-only',historicalSetupAuthorized:false};
 }
 return Object.freeze({validate});
});
