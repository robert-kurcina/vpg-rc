/* Recoverable stage-metrics module: analysis only, never changes battle rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.B4MStage=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const E=typeof B4MEngine!=='undefined'?B4MEngine:require('./engine.js');
const B=typeof B4MOpeningBook!=='undefined'?B4MOpeningBook:require('./opening-book.js');
function reachTurn3(c,{germanId='G2',sovietId='S2',combatSeed=1941,deploymentSeed=0}={}){
 let s=B.setup(c,germanId,combatSeed,deploymentSeed);
 const opening=[];
 for(let i=0;i<4&&!s.over;i++){
  const side=s.side,turn=s.turn;
  s=B.play(c,s,germanId,sovietId);
  E.validate(c,s);
  opening.push({turn,side,ply:s.ply});
 }
 const metrics=E.sweepMetrics(c,s);
 return {germanId,sovietId,combatSeed,deploymentSeed,ply:s.ply,turn:s.turn,side:s.side,opening,
  germanScore:E.strategicValue(c,s,'german'),sovietScore:E.strategicValue(c,s,'soviet'),
  moscowOwner:s.control['10,2']||null,moscowGarrison:E.occupant(s,10,2)?.id||null,
  germanDenied:metrics.germanDenied,totalEntry:metrics.total,
  status:s.ply>=4||s.over?'complete':'incomplete',
  note:'State-based diagnostics after four side-turns, not a probability of victory.'};
}
return {reachTurn3};
});
